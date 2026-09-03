---

<div align="center">

# 📄 DocuMind

### AI-Powered Document Q&A with Hallucination Guardrails

Upload PDFs. Ask questions. Get cited answers with confidence scores.

[![Live Demo](https://img.shields.io/badge/Live_Demo-DocuMind-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://docu-mind-5bps.vercel.app)
[![Backend API](https://img.shields.io/badge/API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://documind-sfza.onrender.com/api/health)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)]()

</div>

---

## What is DocuMind?

DocuMind is a full-stack RAG (Retrieval-Augmented Generation) application that lets you upload PDF documents and ask questions about their content in natural language. Every answer is grounded in the actual document text with page citations, and a confidence scoring system flags potential hallucinations before they reach the user.

Unlike generic chatbots, DocuMind **never makes things up** — if the answer isn't in the document, it says so, and its confidence score reflects that honesty.

---

## Key Features

🔍 **Semantic Search** — Finds the most relevant passages using vector embeddings and cosine similarity, not just keyword matching

📑 **Page-Level Citations** — Every answer cites exactly which page the information came from

🛡️ **Hallucination Guardrails** — Confidence scoring (0–100%) based on embedding distances between the question and retrieved context. Flags high-risk answers with visual warnings

📊 **Confidence Badges** — Green (70–100%), Yellow (40–69%), Red (0–39%) so you know at a glance how trustworthy the answer is

📂 **Multi-Document Support** — Upload and query across multiple PDFs simultaneously

🔎 **Source Transparency** — Expandable source panel shows the exact text chunks used to generate each answer

---

## How It Works

┌─────────────────────────────────────────────────────────────────┐
│ INGESTION FLOW │
│ │
│ Upload PDF │
│ │ │
│ ▼ │
│ pdfplumber ──► Extract text page-by-page │
│ │ │
│ ▼ │
│ Chunker ────► Split into ~500 char overlapping chunks │
│ │ │
│ ▼ │
│ Gemini Embedding API ──► Convert chunks to vectors │
│ │ │
│ ▼ │
│ ChromaDB ───► Store vectors + metadata (page number, doc ID) │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ QUERY FLOW │
│ │
│ User asks a question │
│ │ │
│ ▼ │
│ Gemini Embedding API ──► Convert question to vector │
│ │ │
│ ▼ │
│ ChromaDB ───► Retrieve top 8 most similar chunks (cosine) │
│ │ │
│ ▼ │
│ Gemini Flash ──► Generate answer from context only │
│ │ (with system prompt enforcing citations) │
│ ▼ │
│ Guardrails ─► Score confidence from embedding distances │
│ │ Flag hallucination if avg distance > 1.5 │
│ ▼ │
│ Frontend ───► Render answer + badge + sources │
└─────────────────────────────────────────────────────────────────┘


---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **LLM** | Google Gemini API | Chat (gemini-3.6-flash) + Embeddings (gemini-embedding-001) |
| **Backend** | Python + FastAPI | REST API with async support and auto-generated docs |
| **Frontend** | Next.js 14 + React + Tailwind | Dark-themed chat UI with real-time state management |
| **Vector DB** | ChromaDB | Persistent vector store with cosine similarity search |
| **PDF Parsing** | pdfplumber | Page-by-page text extraction preserving structure |
| **Deployment** | Render (backend) + Vercel (frontend) | Free tier, auto-deploy from GitHub |

---

## Project Structure

DocuMind/
├── backend/
│ ├── main.py # FastAPI app entry point + CORS
│ ├── config.py # Environment variables (pydantic-settings)
│ ├── Dockerfile # Container config for Render
│ ├── requirements.txt
│ ├── routes/
│ │ ├── health.py # GET /api/health
│ │ ├── upload.py # POST /api/upload + GET/DELETE /api/documents
│ │ └── query.py # POST /api/query
│ └── services/
│ ├── chunker.py # Recursive text splitter (~500 char, 50 overlap)
│ ├── embedder.py # Gemini embedding with batching + retry
│ ├── vector_store.py # ChromaDB operations (add, query, delete)
│ ├── rag_engine.py # RAG pipeline: embed → retrieve → generate
│ └── guardrails.py # Confidence scoring + hallucination detection
│
└── frontend/
├── src/
│ ├── app/
│ │ ├── layout.tsx # Root layout with metadata
│ │ ├── page.tsx # Main UI: sidebar + chat + upload modal
│ │ └── globals.css # Dark theme + markdown prose styles
│ └── lib/
│ └── api.ts # API client (upload, query, delete)
├── tailwind.config.ts
├── next.config.js
└── package.json


---

## Guardrails: How Confidence Scoring Works

DocuMind doesn't just give you an answer — it tells you how much to trust it.

Confidence = max(0, 1 - (avg_distance_top_3 / 2.0))


The formula uses the average cosine distance of the top 3 retrieved chunks from ChromaDB:

| Avg Distance | Confidence | Badge | Meaning |
|-------------|-----------|-------|---------|
| 0.0 – 0.6 | 70 – 100% | 🟢 Green | Strong match — answer is well-supported |
| 0.6 – 1.2 | 40 – 69% | 🟡 Yellow | Moderate match — answer may be partial |
| 1.2 – 2.0 | 0 – 39% | 🔴 Red | Weak match — answer may not be reliable |
| > 1.5 | — | ⚠️ Warning | Hallucination risk flagged |

**Honest refusals get 100% confidence** — if the model says "I don't have enough information," that's a correct and trustworthy response.

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Google Gemini API key](https://aistudio.google.com/apikey) (free)

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create .env with your API key
echo "GOOGLE_API_KEY=your_key_here" > .env

uvicorn main:app --reload --port 10000
```

API docs available at `http://localhost:10000/docs`

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:10000" > .env.local

npm run dev
```

Open `http://localhost:3000`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload` | Upload a PDF (multipart form) |
| `GET` | `/api/documents` | List all uploaded documents |
| `DELETE` | `/api/documents/{id}` | Delete a document |
| `POST` | `/api/query` | Ask a question (`{"question": "..."}`) |

---

## Deployment

**Backend → [Render](https://render.com)** (Free tier)
- New Web Service → connect GitHub repo
- Root Directory: `backend`
- Runtime: Docker
- Environment variable: `GOOGLE_API_KEY`

**Frontend → [Vercel](https://vercel.com)** (Free tier)
- Import GitHub repo
- Root Directory: `frontend`
- Environment variable: `NEXT_PUBLIC_API_URL` = Render backend URL

---

## Built With

Built by [Badal Gupta](https://github.com/Cloudyboiii) — MS Data Science, University at Albany (SUNY)

Part of a portfolio demonstrating RAG, embeddings, vector databases, prompt engineering, guardrails, and full-stack AI development.
