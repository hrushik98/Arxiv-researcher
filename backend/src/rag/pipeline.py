"""RAG orchestration: ingestion (build the index) and retrieval (answer a query).

Ingestion:  PDF -> extract -> chunk -> embed -> upsert into local Qdrant.
Retrieval:  query -> hybrid search (RRF) + adjacent expansion -> rerank -> Gemini.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.config import pdf_path
from src.llm import gemini
from src.rag import store
from src.rag.chunk import chunk_document
from src.rag.extract import extract_document
from src.rag.rerank import rerank


@dataclass
class Citation:
    page: int
    section_path: str


@dataclass
class ChatResult:
    answer: str
    citations: list[Citation]


def ingest(req_id: str) -> int:
    """Build the vector index for an already-downloaded PDF. Returns chunk count."""
    document = extract_document(pdf_path(req_id))
    chunks = chunk_document(document)
    return store.build_index(req_id, chunks)


def chat(req_id: str, query: str, highlight: str | None = None) -> ChatResult:
    """Retrieve, rerank, and generate an answer for a question about the paper."""
    candidates = store.search(req_id, query if not highlight else f"{highlight}\n{query}")
    top = rerank(query, candidates)
    text = gemini.answer(query, top, highlight=highlight)

    seen: set[tuple[int, str]] = set()
    citations: list[Citation] = []
    for c in top:
        key = (c.page, c.section_path)
        if key not in seen:
            seen.add(key)
            citations.append(Citation(page=c.page, section_path=c.section_path))
    return ChatResult(answer=text, citations=citations)
