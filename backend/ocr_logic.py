import httpx
import logging
import uuid
import json
import ollama
from sqlalchemy.orm import Session
from models.file import File, OCRResult
from models.user import User
from embeddings import generate_embedding
import chromadb
from sentence_transformers import SentenceTransformer
from datetime import datetime

logger = logging.getLogger(__name__)

# OCR Server Configuration
OCR_URL = "http://164.52.194.98:9058/api/ocr/ipfs"
OCR_API_KEY = "012d54a665d040fcc3fac8f8e74fee03825bfb96ccc76aaae6439ff4ebbc076e"

# AI Models Configuration
LLM_MODEL = "llama3.2:1b"
ST_MODEL_NAME = 'all-MiniLM-L6-v2'

# Initialize Models (Lazy loading to avoid overhead if not needed immediately)
_st_model = None
_chroma_client = None
_collection = None

def get_st_model():
    global _st_model
    if _st_model is None:
        _st_model = SentenceTransformer(ST_MODEL_NAME)
    return _st_model

def get_chroma_collection():
    global _chroma_client, _collection
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path="./chroma_db")
        _collection = _chroma_client.get_or_create_collection(name="file_vectors")
    return _collection

def chunk_text(text, size=600, overlap=100):
    chunks = []
    if not text: return []
    for i in range(0, len(text), size - overlap):
        chunks.append(text[i:i + size])
    if not chunks and text:
        chunks.append(text)
    return chunks

async def auto_classify_document(text: str):
    if not text or len(text.strip()) < 10:
        return "Uncategorized"

    categories = ["Government", "Financial", "Medical", "Legal", "Technical", "Educational", "Personal"]
    prompt = f"""Analyze the following document text and classify it into EXACTLY ONE category from this list: {categories}.
If it's a government ID like Aadhar, Passport, or PAN, use 'Government'.
If it's an invoice, bill, or bank statement, use 'Financial'.
If it's a doctor's note or medical report, use 'Medical'.
If it's a contract or legal notice, use 'Legal'.
If it's a CAD drawing or technical spec, use 'Technical'.
If it's a degree, marksheet or certificate, use 'Educational'.

Respond with ONLY the category name. No other text.

Text: {text[:2000]}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://127.0.0.1:11434/api/chat",
                json={
                    "model": LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False
                }
            )
            if response.status_code == 200:
                result = response.json()
                category = result['message']['content'].strip()
                for cat in categories:
                    if cat.lower() in category.lower():
                        return cat
    except Exception as e:
        logger.error(f"Classification Error: {str(e)}")
    return "Uncategorized"

async def generate_rag_summary(text: str):
    if not text: return None
    prompt = "Summarize the key facts of this document concisely."
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://127.0.0.1:11434/api/chat",
                json={
                    "model": LLM_MODEL,
                    "messages": [{"role": "user", "content": f"You are a summarization assistant. {prompt}\n\nText: {text[:2000]}"}],
                    "stream": False
                }
            )
            if response.status_code == 200:
                result = response.json()
                return result['message']['content'].strip()
    except Exception as e:
        logger.error(f"RAG Summary Error: {str(e)}")
    return None

async def perform_ocr_request(cid: str, file_id: str):
    """
    Performs the OCR request to the external server as per the user's specific curl format.
    """
    payload = {
        "cid": cid,
        "file_id": str(file_id)
    }
    headers = {
        "X-Api-Key": OCR_API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            logger.info(f"Sending OCR request to {OCR_URL} for file {file_id}")
            response = await client.post(OCR_URL, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"OCR Request Failed: {str(e)}")
        return None

async def process_ocr_and_ai(db: Session, file: File, user_id: uuid.UUID, ocr_data: dict = None, raw_text: str = None):
    """
    The unified 'AI Analysis' part.
    1. Extracts text from OCR response (or uses provided raw_text).
    2. Generates vector embeddings for DB.
    3. Chunks text and adds to ChromaDB for chatbot.
    4. Generates RAG summary.
    5. Auto-classifies the document.
    6. Saves everything to the database.
    """
    text = raw_text
    if not text and ocr_data and (ocr_data.get("status") in ["complete", "done"]):
        results = ocr_data.get("results", [])
        if results:
            text = results[0].get("ocr_text") or results[0].get("text")
    
    if not text:
        logger.warning(f"No text extracted for file {file.id}")
        return None

    try:
        # 1. Traditional Embedding (for SQL Search)
        embedding = await generate_embedding(text)
        
        # 2. VectorDB (ChromaDB) Processing
        st = get_st_model()
        coll = get_chroma_collection()
        chunks = chunk_text(text)
        chunk_embeddings = st.encode(chunks).tolist()
        for i, (chunk, c_emb) in enumerate(zip(chunks, chunk_embeddings)):
            coll.add(
                embeddings=[c_emb],
                documents=[chunk],
                metadatas=[{"file_id": str(file.id), "filename": file.file_name, "chunk_id": i}],
                ids=[f"{file.id}_{i}"]
            )
        
        # 3. RAG Summary
        rag_summary = await generate_rag_summary(text)
        
        # 4. Auto-Classification
        category = await auto_classify_document(text)
        if file and (not file.category or file.category == "Uncategorized"):
            file.category = category

        # 5. Save to Database
        existing = db.query(OCRResult).filter(OCRResult.file_id == file.id).first()
        if existing:
            existing.extracted_text = text
            existing.text_embedding = embedding
            existing.vectordb = json.dumps(chunk_embeddings[0]) if chunk_embeddings else None
            existing.rag = rag_summary
            existing.user_id = user_id
        else:
            new_res = OCRResult(
                file_id=file.id,
                user_id=user_id,
                extracted_text=text,
                text_embedding=embedding,
                vectordb=json.dumps(chunk_embeddings[0]) if chunk_embeddings else None,
                rag=rag_summary
            )
            db.add(new_res)
        
        db.commit()
        logger.info(f"Successfully processed OCR and AI Analysis for file {file.id}")
        return text
    except Exception as e:
        db.rollback()
        logger.error(f"Error in Post-OCR Processing for file {file.id}: {str(e)}")
        return text
