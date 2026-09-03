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


def query_documents(question: str) -> dict:
    """Run the full RAG pipeline: embed query -> retrieve -> generate answer."""
    # Step 1: Embed the question
    query_embedding = embed_query(question)

    # Step 2: Retrieve top chunks from vector store
    results = vector_query(query_embedding, n_results=settings.TOP_K_RESULTS)

    if not results["documents"] or not results["documents"][0]:
        return {
            "answer": "I don't have enough information in the uploaded documents to answer this question.",
            "sources": [],
            "distances": [],
        }

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    # Step 3: Build context prompt
    context_parts = []
    for i, (doc, meta) in enumerate(zip(documents, metadatas)):
        context_parts.append(f"[Source {i+1} - Page {meta['page_number']}]\n{doc}")

    context = "\n\n---\n\n".join(context_parts)

    user_prompt = f"""Context from uploaded documents:

{context}

---

Question: {question}

Answer the question using ONLY the context above. Cite page numbers."""

    # Step 4: Call Gemini
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )

    response = model.generate_content(user_prompt)
    answer = response.text

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
    }
