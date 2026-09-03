# DocuMind — RAG Document Q&A with Hallucination Guardrails

An AI-powered document question-answering system that uses Retrieval-Augmented Generation (RAG) with confidence scoring and hallucination detection.

**Live Demo:** [documind.vercel.app](https://documind.vercel.app)

## Features

- **PDF Upload & Processing** — Upload PDFs, extract text page-by-page, chunk with overlap, and embed using Gemini
- **Semantic Search** — ChromaDB vector store with cosine similarity for accurate chunk retrieval
- **RAG Query Engine** — Gemini Flash generates answers grounded in document context with page citations
- **Hallucination Guardrails** — Confidence scoring based on embedding distances, hallucination risk flagging
- **Dark UI** — Chat interface with confidence badges, collapsible source viewer, typing indicators

## Architecture

```
User uploads PDF
  → pdfplumber extracts text (page-by-page)
  → Recursive chunker (~500 char, 50 overlap)
  → Gemini text-embedding-004 (task: retrieval_document)
  → ChromaDB stores vectors + metadata

User asks question
  → Gemini text-embedding-004 (task: retrieval_query)
  → ChromaDB retrieves top 8 chunks (cosine)
  → Gemini Flash generates answer from context
  → Guardrails score confidence from distances
  → Frontend renders answer + badge + sources
```

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| LLM       | Google Gemini API (Flash + Embeddings) |
| Backend   | Python, FastAPI                   |
| Frontend  | Next.js 14, React, Tailwind CSS   |
| Vector DB | ChromaDB (persistent, cosine)     |
| Hosting   | Render (backend) + Vercel (frontend) |

## Setup

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your GOOGLE_API_KEY
uvicorn main:app --reload --port 10000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

**Backend (Render):** New Web Service → connect repo → root directory `backend` → start command `uvicorn main:app --host 0.0.0.0 --port 10000` → add `GOOGLE_API_KEY` env var.

**Frontend (Vercel):** Import repo → root directory `frontend` → add `NEXT_PUBLIC_API_URL` env var pointing to Render URL.

---

Built by [Badal Gupta](https://github.com/Cloudyboiii)
