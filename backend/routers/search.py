import re
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
import uuid
import logging
from database import get_db
import schemas
from models.file import File, OCRResult, Transfer
from models.user import User
from routers.auth import get_current_user
from duckduckgo_search import DDGS
from rank_bm25 import BM25Okapi
import chromadb
from sentence_transformers import SentenceTransformer
import ollama
import numpy as np

router = APIRouter(prefix="/search", tags=["Search"])

logger = logging.getLogger(__name__)

# Initialize ChromaDB and Embedding model (same as chatbot.py)
try:
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    collection = chroma_client.get_or_create_collection(name="file_vectors")
    st_model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    logger.error(f"Failed to initialize search components: {e}")

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
LLM_MODEL = "llama3.2:1b"

# --- Hybrid Search Helpers ---

def tokenize(text: str) -> List[str]:
    return re.findall(r'\w+', text.lower())

def chunk_text(text, size=600, overlap=100):
    chunks = []
    if not text: return []
    for i in range(0, len(text), size - overlap):
        chunks.append(text[i:i + size])
    if not chunks and text:
        chunks.append(text)
    return chunks

class BM25Searcher:
    def __init__(self, contents: List[Dict[str, Any]]):
        self.items = contents
        self.corpus = [item["content"] for item in contents]
        self.tokenized_corpus = [tokenize(doc) for doc in self.corpus]
        self.bm25 = BM25Okapi(self.tokenized_corpus) if self.corpus else None

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.bm25 or not query.strip():
            return []
        tokenized_query = tokenize(query)
        scores = self.bm25.get_scores(tokenized_query)
        results = []
        for idx, score in enumerate(scores):
            if score > 0:
                item = self.items[idx]
                results.append({**item, "score": float(score)})
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

def reciprocal_rank_fusion(vector_results: List[Dict[str, Any]], bm25_results: List[Dict[str, Any]], limit: int = 10, k: int = 60) -> List[Dict[str, Any]]:
    item_map = {}
    
    # Use chunk_id as key
    for item in vector_results: item_map[item["chunk_id"]] = item
    for item in bm25_results: item_map[item["chunk_id"]] = item
    
    vector_ranks = {item["chunk_id"]: rank for rank, item in enumerate(vector_results, 1)}
    bm25_ranks = {item["chunk_id"]: rank for rank, item in enumerate(bm25_results, 1)}
    
    rrf_scores = {}
    for chunk_id in item_map.keys():
        score = 0.0
        if chunk_id in vector_ranks: score += 1.0 / (k + vector_ranks[chunk_id])
        if chunk_id in bm25_ranks: score += 1.0 / (k + bm25_ranks[chunk_id])
        rrf_scores[chunk_id] = score
        
    sorted_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)
    final = []
    for cid in sorted_ids[:limit]:
        item = item_map[cid]
        types = []
        if cid in vector_ranks: types.append("semantic")
        if cid in bm25_ranks: types.append("keyword")
        
        final.append({
            "chunk_id": str(cid),
            "document_id": str(item["document_id"]),
            "filename": item["filename"],
            "content": item["content"],
            "score": rrf_scores[cid],
            "search_type": "+".join(types)
        })
    return final

def highlight_content(content: str, query: str) -> str:
    keywords = set(tokenize(query))
    keywords = {kw for kw in keywords if len(kw) > 1}
    if not keywords: return content
    escaped = [re.escape(kw) for kw in keywords]
    pattern = re.compile(r'\b(' + '|'.join(escaped) + r')\b', re.IGNORECASE)
    return pattern.sub(r'<mark style="background-color: #ffd700; color: black; padding: 0 2px; border-radius: 2px;">\1</mark>', content)

# --- Web Search ---

def web_search(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    results = []
    try:
        with DDGS() as ddgs:
            ddgs_gen = ddgs.text(query, max_results=limit)
            if ddgs_gen:
                for r in ddgs_gen:
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "content": r.get("body", ""),
                        "source_type": "web"
                    })
    except Exception as e:
        logger.error(f"Web search error: {e}")
    return results

# --- Routes ---

@router.get("/meta", response_model=schemas.MetaSearchResponse)
async def meta_search_ai(
    query: str = Query(..., description="Search query"),
    limit: int = Query(5, description="Results limit"),
    generate_answer: bool = Query(True, description="Generate AI answer"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Hybrid search in local documents
    owned = db.query(File).filter(File.owner_id == current_user.id).all()
    received = [t.file for t in db.query(Transfer).filter(Transfer.receiver_id == current_user.id).all() if t.file]
    all_files_map = {str(f.id): f for f in owned + received}
    allowed_ids = list(all_files_map.keys())

    doc_results = []
    if allowed_ids:
        # A. Vector Search
        vector_formatted = []
        try:
            q_emb = st_model.encode(query).tolist()
            v_results = collection.query(
                query_embeddings=[q_emb],
                n_results=limit * 2,
                where={"file_id": {"$in": allowed_ids}}
            )
            
            if v_results['documents'] and v_results['documents'][0]:
                for doc, meta, cid in zip(v_results['documents'][0], v_results['metadatas'][0], v_results['ids'][0]):
                    vector_formatted.append({
                        "chunk_id": cid,
                        "document_id": meta.get("file_id"),
                        "filename": meta.get("filename", "Unknown"),
                        "content": doc
                    })
        except Exception as e:
            logger.error(f"Vector search failed: {e}")

        # B. Keyword Search
        all_chunks = []
        ocr_results = db.query(OCRResult).filter(OCRResult.file_id.in_(allowed_ids)).all()
        for ocr in ocr_results:
            file_obj = all_files_map.get(str(ocr.file_id))
            fname = file_obj.file_name if file_obj else "Unknown"
            chunks = chunk_text(ocr.extracted_text)
            for i, chunk in enumerate(chunks):
                all_chunks.append({
                    "chunk_id": f"{ocr.file_id}_{i}",
                    "document_id": str(ocr.file_id),
                    "filename": fname,
                    "content": chunk
                })
        
        bm25_searcher = BM25Searcher(all_chunks)
        b_results = bm25_searcher.search(query, limit=limit * 2)

        # C. Fusion
        doc_results = reciprocal_rank_fusion(vector_formatted, b_results, limit=limit)
        
        # D. Highlighting
        for item in doc_results:
            item["highlighted_content"] = highlight_content(item["content"], query)

    # 2. Web search
    web_results = web_search(query, limit=limit)

    # 3. LLM Answer
    answer = None
    if generate_answer:
        doc_ctx = ""
        if doc_results:
            doc_ctx = "\n".join([f"[Local {i+1}] (File: {r['filename']}): {r['content'][:300]}" for i, r in enumerate(doc_results[:3])])
        
        web_ctx = ""
        if web_results:
            web_ctx = "\n".join([f"[Web {i+1}] (Title: {r['title']}): {r['content'][:300]}" for i, r in enumerate(web_results[:3])])
            
        combined_context = f"--- LOCAL DOCUMENTS ---\n{doc_ctx or 'No relevant local docs.'}\n\n--- WEB RESULTS ---\n{web_ctx or 'No relevant web results.'}"
        
        prompt = f"Context:\n{combined_context}\n\nQuestion: {query}\n\nAnswer the question using ONLY the context provided above. Cite sources like [Local 1] or [Web 1]. If you cannot answer, say so. Be direct and concise."
        
        try:
            client = ollama.AsyncClient(host=OLLAMA_BASE_URL)
            resp = await client.chat(
                model=LLM_MODEL,
                messages=[{'role': 'system', 'content': 'You are a helpful AI assistant with access to local documents and the web.'},
                          {'role': 'user', 'content': prompt}],
                options={'temperature': 0.0}
            )
            answer = re.sub(r"<think>.*?</think>", "", resp['message']['content'], flags=re.DOTALL).strip()
        except Exception as e:
            logger.error(f"Ollama Meta Search Error: {e}")
            answer = "Error generating AI answer. Make sure Ollama is running with llama3.2:3b model."

    return {
        "answer": answer,
        "document_results": doc_results,
        "web_results": web_results
    }
