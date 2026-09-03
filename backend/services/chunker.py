import uuid
import re


def clean_text(text: str) -> str:
    """Clean extracted PDF text."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'-\n(\w)', r'\1', text)  # fix hyphenated line breaks
    return text.strip()


def chunk_text(
    text: str,
    page_number: int,
    document_id: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[dict]:
    """Split text into overlapping chunks using recursive character splitting."""
    text = clean_text(text)
    if not text:
        return []

    separators = ["\n\n", "\n", ". ", " "]
    chunks = _recursive_split(text, separators, chunk_size)

    result = []
    for i, chunk_text_piece in enumerate(chunks):
        chunk_text_piece = chunk_text_piece.strip()
        if not chunk_text_piece:
            continue
        result.append({
            "chunk_id": str(uuid.uuid4()),
            "text": chunk_text_piece,
            "page_number": page_number,
            "chunk_index": i,
            "document_id": document_id,
        })

    return result


def _recursive_split(text: str, separators: list[str], chunk_size: int) -> list[str]:
    """Recursively split text by separators until chunks are within size."""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    sep = separators[0] if separators else " "
    remaining_seps = separators[1:] if len(separators) > 1 else []

    parts = text.split(sep)
    chunks = []
    current = ""

    for part in parts:
        candidate = f"{current}{sep}{part}" if current else part
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            if current:
                chunks.append(current)
            if len(part) > chunk_size and remaining_seps:
                chunks.extend(_recursive_split(part, remaining_seps, chunk_size))
            else:
                current = part
                continue
            current = ""

    if current:
        chunks.append(current)

    return chunks


def chunk_document(pages: list[dict], document_id: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[dict]:
    """Chunk an entire document (list of {page_number, text} dicts)."""
    all_chunks = []
    for page in pages:
        page_chunks = chunk_text(
            text=page["text"],
            page_number=page["page_number"],
            document_id=document_id,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        all_chunks.extend(page_chunks)

    # Re-index chunk_index globally
    for i, chunk in enumerate(all_chunks):
        chunk["chunk_index"] = i

    return all_chunks
