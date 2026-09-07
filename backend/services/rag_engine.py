import time
import google.generativeai as genai
from config import get_settings
from services.embedder import embed_query
from services.vector_store import query as vector_query

settings = get_settings()
genai.configure(api_key=settings.GOOGLE_API_KEY)

SYSTEM_PROMPT = """You are DocuMind, an accurate document Q&A assistant. Your job is to answer questions using ONLY the provided context from uploaded documents.

RULES:
1. Answer ONLY from the provided context. Never use outside knowledge.
2. Cite page numbers for every claim using the format (Page X).
3. If the context does not contain enough information to answer, say exactly: "I don't have enough information in the uploaded documents to answer this question."
4. Never fabricate or guess information.
5. Be concise but thorough. Use markdown formatting for readability.
6. If multiple pages discuss the topic, synthesize the information and cite all relevant pages."""


def query_documents(question: str, session_id: str, document_ids: list[str] | None = None, conversation_history: list[dict] | None = None) -> dict:
    """Run the full RAG pipeline: embed query -> retrieve -> generate answer."""
    t0 = time.time()
    # Step 1: Embed the question
    query_embedding = embed_query(question)

    # Step 2: Retrieve top chunks from vector store
    results = vector_query(session_id, query_embedding, n_results=settings.TOP_K_RESULTS, document_ids=document_ids)
    t1 = time.time()
    retrieval_latency_ms = int((t1 - t0) * 1000)

    if not results["documents"] or not results["documents"][0]:
        return {
            "answer": "I don't have enough information in the uploaded documents to answer this question.",
            "sources": [],
            "distances": [],
            "retrieval_latency_ms": retrieval_latency_ms,
            "generation_latency_ms": 0,
        }

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    # Step 3: Build context prompt
    context_parts = []
    for i, (doc, meta) in enumerate(zip(documents, metadatas)):
        context_parts.append(f"[Source {i+1} - Page {meta['page_number']}]\n{doc}")

    context = "\n\n---\n\n".join(context_parts)

    history_prompt = ""
    if conversation_history:
        recent_history = conversation_history[-6:]
        history_parts = []
        for msg in recent_history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_parts.append(f"{role}: {msg.get('content')}")
        if history_parts:
            history_prompt = "Previous conversation:\n" + "\n".join(history_parts) + "\n\n"

    user_prompt = f"""Context from uploaded documents:

{context}

---

{history_prompt}Question: {question}

Answer the question using ONLY the context above. Cite page numbers."""

    # Step 4: Call Gemini
    t2 = time.time()
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )

    response = model.generate_content(user_prompt)
    answer = response.text
    t3 = time.time()
    generation_latency_ms = int((t3 - t2) * 1000)

    # Step 5: Build sources
    sources = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        sources.append({
            "text": doc[:200] + "..." if len(doc) > 200 else doc,
            "page_number": meta["page_number"],
            "distance": round(dist, 4),
        })

    return {
        "answer": answer,
        "sources": sources,
        "distances": distances,
        "retrieval_latency_ms": retrieval_latency_ms,
        "generation_latency_ms": generation_latency_ms,
    }
