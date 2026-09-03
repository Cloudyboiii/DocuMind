import uuid
import pdfplumber
from fastapi import APIRouter, UploadFile, File, HTTPException
from config import get_settings
from services.chunker import chunk_document
from services.embedder import embed_texts
from services.vector_store import add_chunks, get_all_documents, delete_document

router = APIRouter(tags=["Documents"])
settings = get_settings()

# In-memory filename map (document_id -> filename)
_doc_names: dict[str, str] = {}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a PDF, extract text, chunk, embed, and store in vector DB."""
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Read file content
    content = await file.read()

    # Validate file size
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit.",
        )

    # Extract text from PDF
    try:
        pages = []
        with pdfplumber.open(file.file) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append({"page_number": i + 1, "text": text})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")

    if not pages:
        raise HTTPException(status_code=400, detail="No text could be extracted from this PDF.")

    # Generate document ID and chunk
    document_id = str(uuid.uuid4())
    chunks = chunk_document(
        pages=pages,
        document_id=document_id,
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )

    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks generated from the document.")

    # Generate embeddings
    try:
        texts = [c["text"] for c in chunks]
        embeddings = embed_texts(texts, task_type="retrieval_document")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

    # Store in vector DB
    add_chunks(chunks, embeddings)

    # Save filename
    _doc_names[document_id] = file.filename

    return {
        "document_id": document_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks": len(chunks),
        "status": "success",
    }


@router.get("/documents")
async def list_documents():
    """List all uploaded documents."""
    docs = get_all_documents()
    for doc in docs:
        doc["filename"] = _doc_names.get(doc["document_id"], "Unknown")
    return {"documents": docs}


@router.delete("/documents/{document_id}")
async def remove_document(document_id: str):
    """Delete a document and its chunks from the vector store."""
    delete_document(document_id)
    _doc_names.pop(document_id, None)
    return {"status": "deleted", "document_id": document_id}
