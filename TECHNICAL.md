# DocuMind — Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [API Reference](#api-reference)
3. [Guardrails Algorithm](#guardrails-algorithm)
4. [Design Decisions](#design-decisions)
5. [Performance & Limitations](#performance--limitations)
6. [Future Improvements](#future-improvements)

---

## 1. System Architecture

### High-Level Overview

┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND │
│ Next.js 14 + React │
│ Sidebar (docs) │ Chat UI │ Metrics Modal │ Source Viewer │
└────────────────────────┬────────────────────────────────────────┘
│ HTTP (REST)
▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND │
│ FastAPI (Python) │
│ │
│ /api/upload │ /api/query │ /api/documents │ /api/metrics │
└──────┬──────────────────┬──────────────────────────────────────┘
│ │
▼ ▼
┌─────────────┐ ┌──────────────────────────────────────────────┐
│ pdfplumber │ │ Gemini API │
│ (extract) │ │ text-embedding: gemini-embedding-001 │
└──────┬──────┘ │ generation: gemini-3.6-flash │
│ └──────────────────────────────────────────────┘
▼
┌─────────────┐
│ Chunker │ Recursive character splitter
│ ~500 chars │ 50 char overlap
│ 50 overlap │
└──────┬──────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ ChromaDB │
│ Persistent vector store (cosine similarity) │
│ Collection per session (session_{session_id}) │
└─────────────────────────────────────────────────────────────────┘


### Ingestion Pipeline (Upload Flow)

User uploads PDF
│
├─► Validate: PDF only, max 25MB
│
├─► pdfplumber: extract text page-by-page (preserving page numbers)
│
├─► Chunker: recursive character split (~500 chars, 50 overlap)
│ Separators: ["\n\n", "\n", ". ", " "]
│
├─► Gemini Embedding API (task_type=retrieval_document)
│ Model: gemini-embedding-001
│ Batched: max 100 texts per API call
│ Retry: exponential backoff on 429 rate limit
│
└─► ChromaDB: store vectors + metadata
{chunk_id, page_number, chunk_index, document_id}


### Query Pipeline (Ask Flow)

User asks question
│
├─► Gemini Embedding API (task_type=retrieval_query)
│ Converts question to query vector
│
├─► ChromaDB: cosine similarity search
│ Returns top 8 chunks + distances
│ Filtered by session_id (user isolation)
│ Optional: filtered by selected document_ids
│
├─► Gemini Flash (gemini-3.6-flash)
│ System prompt: answer ONLY from context, cite pages
│ Includes: retrieved chunks + conversation history (last 3 turns)
│
├─► Guardrails Module
│ Confidence score from embedding distances
│ Hallucination risk flag
│
└─► Response: answer + confidence + sources + latency metrics


---

## 2. API Reference

### POST /api/upload
Upload a PDF document for processing.

**Request:** `multipart/form-data`
| Field | Type | Description |
|---|---|---|
| file | File | PDF file (max 25MB) |

**Headers:**
| Header | Description |
|---|---|
| X-Session-ID | UUID identifying the user session |

**Response:**
```json
{
  "document_id": "uuid",
  "filename": "report.pdf",
  "pages": 12,
  "chunks": 47,
  "status": "success"
}
```

---

### POST /api/query
Ask a question against uploaded documents.

**Request:** `application/json`
```json
{
  "question": "What are the main findings?",
  "document_ids": ["uuid1", "uuid2"],
  "conversation_history": [
    {"role": "user", "content": "Previous question"},
    {"role": "assistant", "content": "Previous answer"}
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| question | string | Yes | The question to ask |
| document_ids | string[] | No | Filter to specific docs. Omit to query all |
| conversation_history | object[] | No | Last N turns for follow-up context |

**Headers:**
| Header | Description |
|---|---|
| X-Session-ID | UUID identifying the user session |

**Response:**
```json
{
  "answer": "Based on the document...",
  "confidence_score": 0.82,
  "confidence_label": "high",
  "hallucination_risk": false,
  "guardrails_explanation": "Based on semantic similarity...",
  "sources": [
    {
      "text": "excerpt from document...",
      "page_number": 3,
      "distance": 0.31
    }
  ],
  "model": "gemini-3.6-flash",
  "retrieval_latency_ms": 210,
  "generation_latency_ms": 1840,
  "total_latency_ms": 2050,
  "top_chunk_distances": [0.31, 0.38, 0.42],
  "chunks_retrieved": 8
}
```

---

### GET /api/documents
List all documents uploaded in the current session.

**Headers:** `X-Session-ID`

**Response:**
```json
{
  "documents": [
    {
      "document_id": "uuid",
      "filename": "report.pdf",
      "pages": 12,
      "chunks": 47
    }
  ]
}
```

---

### DELETE /api/documents/{document_id}
Delete a document and all its vectors from the session.

**Headers:** `X-Session-ID`

**Response:**
```json
{
  "status": "deleted",
  "document_id": "uuid"
}
```

---

### GET /api/metrics
Get aggregate query statistics for the current session.

**Headers:** `X-Session-ID`

**Response:**
```json
{
  "total_queries": 12,
  "avg_confidence_score": 0.76,
  "avg_total_latency_ms": 2340,
  "avg_retrieval_latency_ms": 198,
  "hallucination_flagged_count": 1
}
```

---

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "DocuMind API"
}
```

---

## 3. Guardrails Algorithm

### Confidence Scoring

DocuMind computes a confidence score for every answer based on the **cosine distances** returned by ChromaDB — not keyword overlap or heuristics.

**Formula:**

confidence = max(0.0, min(1.0, 1.0 - (avg_distance_top_3 / 2.0)))


Where `avg_distance_top_3` is the average cosine distance of the 3 most similar chunks retrieved.

**Intuition:**
- Cosine distance of 0.0 = identical vectors (perfect match)
- Cosine distance of 2.0 = maximally dissimilar vectors
- Dividing by 2.0 normalizes the distance to a 0–1 scale
- Subtracting from 1.0 flips it to a similarity score

**Confidence Bands:**
| Avg Distance | Confidence Score | Label | Meaning |
|---|---|---|---|
| 0.0 – 0.6 | 70% – 100% | 🟢 High | Strong semantic match |
| 0.6 – 1.2 | 40% – 69% | 🟡 Medium | Partial match |
| 1.2 – 2.0 | 0% – 39% | 🔴 Low | Weak match |
| > 1.5 | — | ⚠️ Risk | Hallucination flagged |

### Honest Refusal Detection

If the model responds with phrases like "I don't have enough information", the system detects this and sets `confidence_score = 1.0` — because an honest refusal is a **correct** response and should be treated as high-confidence.

Detected phrases:
- "i don't have enough information"
- "not enough information"
- "cannot answer"
- "unable to find"

### Hallucination Risk Flag

`hallucination_risk = True` when `avg_distance_top_3 > 1.5`

This means the retrieved context was highly dissimilar to the question, yet the model still attempted an answer — which is the primary signal for a potentially hallucinated response.

---

## 4. Design Decisions

### Why ChromaDB over Pinecone or FAISS?

| Factor | ChromaDB | Pinecone | FAISS |
|---|---|---|---|
| Cost | Free (persistent local) | Paid after free tier | Free (in-memory) |
| Setup | Zero config | API key + cloud | Manual index management |
| Persistence | Yes (disk) | Yes (cloud) | No (lost on restart) |
| Multi-collection | Yes | Yes | Complex |

ChromaDB was chosen because it runs in-process with zero infrastructure cost, supports persistent storage, and natively supports per-collection isolation (used for session separation).

### Why Recursive Character Splitting over Sentence Splitting?

Sentence splitters break on abbreviations, decimal numbers, and domain-specific text. Recursive character splitting is more robust because:
1. It tries paragraph breaks first (`\n\n`)
2. Falls back to line breaks (`\n`)
3. Then sentence endings (`. `)
4. Finally word boundaries (` `)

This preserves semantic units better across diverse PDF content (research papers, legal docs, financial reports).

### Why Session-Based ChromaDB Collections?

Each user gets their own ChromaDB collection (`session_{uuid}`). This means:
- Complete data isolation — users cannot access each other's documents
- No authentication required — the session UUID (stored in browser localStorage) acts as the identifier
- Clean deletion — deleting a session deletes only that collection

### Why gemini-embedding-001 with Task Types?

The Gemini embedding API supports `task_type` parameters that optimize embeddings for specific use cases:
- `retrieval_document` — used when storing chunks (optimized for being retrieved)
- `retrieval_query` — used when embedding questions (optimized for querying)

Using mismatched task types degrades retrieval quality by up to 15–20%.

### Why conversation_history is capped at 3 turns?

Each additional turn adds tokens to the Gemini prompt. 3 turns (6 messages) provides enough context for natural follow-up questions while staying well within the free tier token limits and keeping latency low.

---

## 5. Performance & Limitations

### Benchmarks (Approximate, Free Tier)

| Operation | Typical Latency |
|---|---|
| PDF upload + embedding (10 pages) | 8–15 seconds |
| Query (retrieval) | 150–300ms |
| Query (Gemini generation) | 1.5–3 seconds |
| Query (end-to-end) | 2–4 seconds |

### Known Limitations

**Rate Limits (Gemini Free Tier):**
- Embedding: 100 requests/minute, 1500/day
- Generation: 15 requests/minute, 1500/day
- Uploading many large PDFs simultaneously can hit the embedding limit

**Storage:**
- ChromaDB data is stored on Render's ephemeral filesystem
- Data is lost when Render redeploys or the free tier instance restarts
- Users must re-upload documents after a restart

**PDF Quality:**
- Scanned PDFs (image-based) return no text — pdfplumber only extracts selectable text
- Complex multi-column layouts may produce garbled extraction order

**Chunk Size:**
- Fixed ~500 character chunks may split mid-sentence on some documents
- Very short documents (< 5 chunks) may produce lower confidence scores

---

## 6. Future Improvements

| Feature | Description | Priority |
|---|---|---|
| Persistent storage | Move ChromaDB to a cloud vector DB (Pinecone, Weaviate) so data survives restarts | High |
| OCR support | Add Tesseract OCR for scanned/image PDFs | Medium |
| Re-ranking | Add a cross-encoder re-ranker after retrieval to improve chunk quality | Medium |
| Streaming responses | Stream Gemini output token-by-token for faster perceived latency | Medium |
| Multi-modal | Support images and tables extracted from PDFs | Low |
| Evaluation dataset | Build a ground-truth Q&A dataset to benchmark retrieval accuracy | Low |
| Export chat | Allow users to download the full Q&A session as PDF or markdown | Low |

---

*Built by [Badal Gupta](https://github.com/Cloudyboiii) — MS Data Science, University at Albany (SUNY)*
