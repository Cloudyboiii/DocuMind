import chromadb
from config import get_settings

settings = get_settings()

_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
_collection = _client.get_or_create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"},
)


def add_chunks(chunks: list[dict], embeddings: list[list[float]]) -> None:
    """Add chunks and their embeddings to the vector store."""
    _collection.add(
        ids=[c["chunk_id"] for c in chunks],
        embeddings=embeddings,
        documents=[c["text"] for c in chunks],
        metadatas=[
            {
                "page_number": c["page_number"],
                "chunk_index": c["chunk_index"],
                "document_id": c["document_id"],
            }
            for c in chunks
        ],
    )


def query(query_embedding: list[float], n_results: int = 8) -> dict:
    """Query the vector store for the most similar chunks."""
    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    return results


def delete_document(document_id: str) -> None:
    """Delete all chunks belonging to a document."""
    results = _collection.get(
        where={"document_id": document_id},
        include=[],
    )
    if results["ids"]:
        _collection.delete(ids=results["ids"])


def get_stats() -> dict:
    """Return store statistics."""
    total = _collection.count()
    if total == 0:
        return {"total_chunks": 0, "unique_documents": 0}

    all_meta = _collection.get(include=["metadatas"])
    doc_ids = set(m["document_id"] for m in all_meta["metadatas"])
    return {"total_chunks": total, "unique_documents": len(doc_ids)}


def get_all_documents() -> list[dict]:
    """Return a list of unique documents with their metadata."""
    total = _collection.count()
    if total == 0:
        return []

    all_data = _collection.get(include=["metadatas"])
    docs = {}
    for meta in all_data["metadatas"]:
        doc_id = meta["document_id"]
        if doc_id not in docs:
            docs[doc_id] = {
                "document_id": doc_id,
                "pages": set(),
                "chunks": 0,
            }
        docs[doc_id]["pages"].add(meta["page_number"])
        docs[doc_id]["chunks"] += 1

    result = []
    for doc in docs.values():
        result.append({
            "document_id": doc["document_id"],
            "pages": len(doc["pages"]),
            "chunks": doc["chunks"],
        })
    return result
