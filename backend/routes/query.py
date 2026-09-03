from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.rag_engine import query_documents
from services.guardrails import evaluate
from services.vector_store import get_stats
from config import get_settings

router = APIRouter(tags=["Query"])
settings = get_settings()


class QueryRequest(BaseModel):
    question: str


@router.post("/query")
async def query(req: QueryRequest):
    """Ask a question against uploaded documents."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Check if any documents exist
    stats = get_stats()
    if stats["total_chunks"] == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded yet. Please upload a PDF first.",
        )

    # Run RAG pipeline
    try:
        rag_result = query_documents(req.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    # Run guardrails
    guardrails_result = evaluate(
        answer=rag_result["answer"],
        distances=rag_result["distances"],
    )

    return {
        "answer": rag_result["answer"],
        "confidence_score": guardrails_result["confidence_score"],
        "confidence_label": guardrails_result["confidence_label"],
        "hallucination_risk": guardrails_result["hallucination_risk"],
        "guardrails_explanation": guardrails_result["explanation"],
        "sources": rag_result["sources"],
        "model": settings.GEMINI_MODEL,
    }
