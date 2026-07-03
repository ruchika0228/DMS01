import httpx
import logging

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
EMBEDDING_MODEL = "nomic-embed-text"

async def generate_embedding(text: str):
    """
    Generate a numerical vector embedding for the given text using Ollama.
    """
    if not text:
        return None
        
    # Clean text to avoid issues with very large documents
    # (nomic-embed-text has 8k context, but we should be safe)
    clean_text = text[:8000].replace("\n", " ")

    url = f"{OLLAMA_BASE_URL}/api/embeddings"
    payload = {
        "model": EMBEDDING_MODEL,
        "prompt": clean_text
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                data = response.json()
                return data.get("embedding")
            else:
                logger.error(f"Ollama Embedding Error: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"Failed to generate embedding: {str(e)}")
        
    return None
