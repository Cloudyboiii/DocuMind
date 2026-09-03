import time
import re
import google.generativeai as genai
from config import get_settings

settings = get_settings()
genai.configure(api_key=settings.GOOGLE_API_KEY)

BATCH_SIZE = 100
MAX_RETRIES = 5


def embed_texts(texts: list[str], task_type: str = "retrieval_document") -> list[list[float]]:
    """Embed a list of texts using Gemini embedding model with batching and retry."""
    all_embeddings = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        embeddings = _embed_batch_with_retry(batch, task_type)
        all_embeddings.extend(embeddings)
        if i + BATCH_SIZE < len(texts):
            time.sleep(1)

    return all_embeddings


def embed_query(text: str) -> list[float]:
    """Embed a single query text."""
    result = _embed_batch_with_retry([text], task_type="retrieval_query")
    return result[0]


def _embed_batch_with_retry(texts: list[str], task_type: str) -> list[list[float]]:
    """Embed a batch with exponential backoff retry for rate limits."""
    for attempt in range(MAX_RETRIES):
        try:
            result = genai.embed_content(
                model=f"models/{settings.EMBEDDING_MODEL}",
                content=texts,
                task_type=task_type,
            )
            return result["embedding"]
        except Exception as e:
            if "task_type" in str(e).lower() or "not supported" in str(e).lower():
                result = genai.embed_content(
                    model=f"models/{settings.EMBEDDING_MODEL}",
                    content=texts,
                )
                return result["embedding"]
            if "429" in str(e) and attempt < MAX_RETRIES - 1:
                wait = 10 * (2 ** attempt)
                match = re.search(r'(\d+(?:\.\d+)?)\s*(?:s|second)', str(e).lower())
                if match:
                    try:
                        wait = float(match.group(1))
                    except ValueError:
                        pass
                time.sleep(wait)
            else:
                raise e
