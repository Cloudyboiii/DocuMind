from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from services.rag_engine import query_documents
from services.guardrails import evaluate
from services.vector_store import get_stats
from config import get_settings

router = APIRouter(tags=["Query"])
settings = get_settings()


class QueryRequest(BaseModel):
    question: str
    document_ids: list[str] | None = None
    conversation_history: list[dict] | None = None

_session_metrics = {}

def get_session_metrics(session_id: str):
    if session_id not in _session_metrics:
        _session_metrics[session_id] = {
            "total_queries": 0,
            "sum_confidence_score": 0.0,
            "sum_total_latency_ms": 0,
            "sum_retrieval_latency_ms": 0,
            "hallucination_flagged_count": 0,
        }
    return _session_metrics[session_id]

@router.get("/metrics")
async def get_metrics(session_id: str = Header(alias="X-Session-ID", default="default")):
    """Get aggregate metrics for the session."""
    metrics = get_session_metrics(session_id)
    total = metrics["total_queries"]
    
    if total == 0:
        return {
            "total_queries": 0,
            "avg_confidence_score": 0,
            "avg_total_latency_ms": 0,
            "avg_retrieval_latency_ms": 0,
            "hallucination_flagged_count": 0,
        }
        
    return {
        "total_queries": total,
        "avg_confidence_score": round(metrics["sum_confidence_score"] / total, 2),
        "avg_total_latency_ms": round(metrics["sum_total_latency_ms"] / total),
        "avg_retrieval_latency_ms": round(metrics["sum_retrieval_latency_ms"] / total),
        "hallucination_flagged_count": metrics["hallucination_flagged_count"],
    }


@router.post("/query")
async def query(req: QueryRequest, session_id: str = Header(alias="X-Session-ID", default="default")):
    """Ask a question against uploaded documents."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Check if any documents exist
    stats = get_stats(session_id)
    if stats["total_chunks"] == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded yet. Please upload a PDF first.",
        )

    # Run RAG pipeline
    try:
        rag_result = query_documents(
            req.question, 
            session_id, 
            document_ids=req.document_ids, 
            conversation_history=req.conversation_history
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    # Run guardrails
    guardrails_result = evaluate(
        answer=rag_result["answer"],
        distances=rag_result["distances"],
    )

    # Update metrics
    retrieval_latency = rag_result.get("retrieval_latency_ms", 0)
    generation_latency = rag_result.get("generation_latency_ms", 0)
    total_latency = retrieval_latency + generation_latency
    confidence = guardrails_result["confidence_score"]
    
    metrics = get_session_metrics(session_id)
    metrics["total_queries"] += 1
    metrics["sum_confidence_score"] += confidence
    metrics["sum_total_latency_ms"] += total_latency
    metrics["sum_retrieval_latency_ms"] += retrieval_latency
    if guardrails_result["hallucination_risk"]:
        metrics["hallucination_flagged_count"] += 1

    top_chunk_distances = rag_result["distances"][:3]
    chunks_retrieved = len(rag_result["distances"])

    return {
        "answer": rag_result["answer"],
        "confidence_score": confidence,
        "confidence_label": guardrails_result["confidence_label"],
        "hallucination_risk": guardrails_result["hallucination_risk"],
        "guardrails_explanation": guardrails_result["explanation"],
        "sources": rag_result["sources"],
        "model": settings.GEMINI_MODEL,
        "retrieval_latency_ms": retrieval_latency,
        "generation_latency_ms": generation_latency,
        "total_latency_ms": total_latency,
        "top_chunk_distances": top_chunk_distances,
        "chunks_retrieved": chunks_retrieved,
    }
