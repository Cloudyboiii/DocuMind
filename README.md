# DocuMind 📄

**AI-Powered Document Q&A with Hallucination Guardrails**

Upload PDFs. Ask questions in plain English. Get cited answers with confidence scores.

[![Live Demo](https://img.shields.io/badge/Live_Demo-DocuMind-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://docu-mind-5bps.vercel.app)
[![API](https://img.shields.io/badge/API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://documind-sfza.onrender.com/api/health)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)

---

## What is DocuMind?

DocuMind is a full-stack RAG (Retrieval-Augmented Generation) application that lets you upload PDF documents and ask questions about their content. Every answer is grounded in the actual document text with page citations, and a confidence scoring system flags potential hallucinations before they reach you.

If the answer isn't in the document, DocuMind says so — and its confidence score reflects that honesty.

**Try it live:** [docu-mind-5bps.vercel.app](https://docu-mind-5bps.vercel.app)

---

## Features

- **Semantic Search** — Finds relevant passages using vector embeddings and cosine similarity, not keyword matching
- **Page-Level Citations** — Every answer cites which page the information came from
- **Hallucination Guardrails** — Confidence scoring (0-100%) based on embedding distances with visual warnings
- **Confidence Badges** — Green (70-100%), Yellow (40-69%), Red (0-39%) for answer trustworthiness
- **Multi-Document Support** — Upload and query across multiple PDFs at once
- **Source Transparency** — Expandable panel shows exact text chunks used for each answer

---

## Architecture

### Ingestion (Upload)

```
PDF Upload
  → pdfplumber (extract text page-by-page)
  → Recursive Chunker (~500 chars, 50 char overlap)
  → Gemini Embedding API (gemini-embedding-001)
  → ChromaDB (store vectors + page metadata)
```

### Query (Ask)

```
User Question
  → Gemini Embedding API (convert to query vector)
  → ChromaDB (retrieve top 8 chunks via cosine similarity)
  → Gemini Flash (generate answer from context only, cite pages)
  → Guardrails Module (score confidence from embedding distances)
  → Frontend (render answer + confidence badge + collapsible sources)
```

---

## Guardrails — How Confidence Scoring Works

DocuMind doesn't just answer — it tells you how much to trust the answer.

The confidence score is computed from the cosine distances between the user's question and the top 3 retrieved chunks from ChromaDB:

```
confidence = max(0, 1 - (avg_distance_top_3 / 2.0))
```

| Avg Distance | Confidence | Badge | Meaning |
|:---:|:---:|:---:|---|
| 0.0 - 0.6 | 70 - 100% | 🟢 Green | Strong match — well-supported answer |
| 0.6 - 1.2 | 40 - 69% | 🟡 Yellow | Moderate match — answer may be partial |
| 1.2 - 2.0 | 0 - 39% | 🔴 Red | Weak match — answer may not be reliable |
| > 1.5 | — | ⚠️ Warning | Hallucination risk flagged |

**Honest refusals get 100% confidence.** If the model responds with "I don't have enough information," that is scored as a fully confident and correct response.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| LLM | Google Gemini API | gemini-3.6-flash (chat) + gemini-embedding-001 (vectors) |
| Backend | Python + FastAPI | Async REST API with auto-generated Swagger docs |
| Frontend | Next.js 14 + React + Tailwind CSS | Dark-themed responsive chat interface |
| Vector DB | ChromaDB | Persistent vector store with cosine similarity search |
| PDF Parser | pdfplumber | Page-by-page text extraction preserving structure |
| Hosting | Render (backend) + Vercel (frontend) | Free tier with auto-deploy from GitHub |

**Total hosting cost: $0** — every service and API used is on a free tier.

---

## Project Structure

```
DocuMind/
├── backend/
│   ├── main.py                  # FastAPI entry point, CORS config
│   ├── config.py                # Env vars via pydantic-settings
│   ├── Dockerfile               # Production container for Render
│   ├── requirements.txt         # Python dependencies
│   ├── routes/
│   │   ├── health.py            # GET  /api/health
│   │   ├── upload.py            # POST /api/upload, GET/DELETE /api/documents
│   │   └── query.py             # POST /api/query
│   └── services/
│       ├── chunker.py           # Recursive character text splitter
│       ├── embedder.py          # Gemini embedding with batching and retry
│       ├── vector_store.py      # ChromaDB add, query, delete, stats
│       ├── rag_engine.py        # Full RAG pipeline: embed → retrieve → generate
│       └── guardrails.py        # Confidence scoring and hallucination detection
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx         # Main UI: sidebar, chat, upload modal
    │   │   ├── layout.tsx       # Root layout with metadata
    │   │   └── globals.css      # Dark theme and markdown prose styles
    │   └── lib/
    │       └── api.ts           # API client helpers
    ├── tailwind.config.ts       # Custom theme colors and animations
    ├── next.config.js
    └── package.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns service status and version |
| `POST` | `/api/upload` | Upload a PDF file (multipart form data) |
| `GET` | `/api/documents` | List all uploaded documents with chunk counts |
| `DELETE` | `/api/documents/{id}` | Remove a document and its vectors |
| `POST` | `/api/query` | Ask a question — `{"question": "..."}` |

### Example Query Response

```json
{
  "answer": "Based on the document, the company reported...",
  "confidence_score": 0.82,
  "confidence_label": "high",
  "hallucination_risk": false,
  "sources": [
    {"text": "Revenue increased by 15%...", "page_number": 3, "distance": 0.31},
    {"text": "The quarterly report shows...", "page_number": 7, "distance": 0.38}
  ],
  "model": "gemini-3.6-flash"
}
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Gemini API key (free) — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Run the Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
echo "GOOGLE_API_KEY=your_key_here" > .env
uvicorn main:app --reload --port 10000
```

Swagger docs at [localhost:10000/docs](http://localhost:10000/docs)

### Run the Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:10000" > .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000) — upload a PDF and start asking questions.

---

## Deployment

| Component | Platform | Configuration |
|---|---|---|
| Backend | [Render](https://render.com) — Free | Root: `backend`, Runtime: Docker, Env: `GOOGLE_API_KEY` |
| Frontend | [Vercel](https://vercel.com) — Free | Root: `frontend`, Env: `NEXT_PUBLIC_API_URL` = Render URL |

Both platforms auto-deploy on every push to `main`.

---

## What I Learned Building This

- Designing a RAG pipeline end-to-end: chunking strategies, embedding model selection, retrieval tuning
- Why cosine distance makes a practical confidence signal and how to threshold it for hallucination detection
- Structuring system prompts that enforce citation behavior and honest refusals
- Handling Gemini API rate limits with batching, exponential backoff, and retry logic
- Deploying a full-stack app (FastAPI + Next.js) on free infrastructure with zero cost

---

Built by **[Badal Gupta](https://github.com/Cloudyboiii)** — MS Data Science, University at Albany (SUNY)
