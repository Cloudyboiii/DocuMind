import chromadb
from config import get_settings

settings = get_settings()

_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)


def _get_collection(session_id: str):
    return _client.get_or_create_collection(
        name=f"session_{session_id}",
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(session_id: str, chunks: list[dict], embeddings: list[list[float]]) -> None:
    """Add chunks and their embeddings to the vector store."""
    _get_collection(session_id).add(
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


def query(session_id: str, query_embedding: list[float], n_results: int = 8) -> dict:
    """Query the vector store for the most similar chunks."""
    results = _get_collection(session_id).query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    return results


def delete_document(session_id: str, document_id: str) -> None:
    """Delete all chunks belonging to a document."""
    coll = _get_collection(session_id)
    results = coll.get(
        where={"document_id": document_id},
        include=[],
    )
    if results["ids"]:
        coll.delete(ids=results["ids"])


def get_stats(session_id: str) -> dict:
    """Return store statistics."""
    coll = _get_collection(session_id)
    total = coll.count()
    if total == 0:
        return {"total_chunks": 0, "unique_documents": 0}

    all_meta = coll.get(include=["metadatas"])
    doc_ids = set(m["document_id"] for m in all_meta["metadatas"])
    return {"total_chunks": total, "unique_documents": len(doc_ids)}


def get_all_documents(session_id: str) -> list[dict]:
    """Return a list of unique documents with their metadata."""
    coll = _get_collection(session_id)
    total = coll.count()
    if total == 0:
        return []

    all_data = coll.get(include=["metadatas"])
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
