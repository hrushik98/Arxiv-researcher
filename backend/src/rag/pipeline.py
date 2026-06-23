"""RAG orchestration: ingestion (build the index) and retrieval (answer a query).

Ingestion:  PDF -> extract -> chunk -> embed -> upsert into local Qdrant.
Retrieval:  query -> hybrid search (RRF) + adjacent expansion -> rerank -> Gemini,
            falling back to a Tavily web search when the paper doesn't have the
            answer (or immediately when the user forces a web search).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from src.config import pdf_path
from src.llm import gemini, websearch
from src.llm.gemini import Attachment
from src.llm.websearch import WebResult
from src.rag import store
from src.rag.chunk import chunk_document
from src.rag.extract import extract_document
from src.rag.rerank import rerank


@dataclass
class Citation:
    page: int
    section_path: str
    text: str


@dataclass
class WebSource:
    title: str
    url: str


@dataclass
class ChatResult:
    answer: str
    citations: list[Citation]
    web_sources: list[WebSource] = field(default_factory=list)


def ingest(req_id: str) -> int:
    """Build the vector index for an already-downloaded PDF. Returns chunk count."""
    document = extract_document(pdf_path(req_id))
    chunks = chunk_document(document)
    return store.build_index(req_id, chunks)


def chat(
    req_id: str,
    query: str,
    highlight: str | None = None,
    attachments: list[Attachment] | None = None,
    force_web_search: bool = False,
) -> ChatResult:
    """Retrieve, rerank, and generate an answer for a question about the paper.

    Falls back to a live Tavily web search when Gemini signals (via a sentinel
    response) that the paper's context doesn't answer the question, or
    immediately when `force_web_search` is set (the user's explicit toggle).
    """
    search_query = query if not highlight else f"{highlight}\n{query}"
    candidates = store.search(req_id, search_query)
    top = rerank(query, candidates)

    web_results: list[WebResult] | None = websearch.search(search_query) if force_web_search else None
    text = gemini.answer(query, top, highlight=highlight, attachments=attachments, web_results=web_results)

    if web_results is None and text == gemini.WEB_SEARCH_SENTINEL:
        web_results = websearch.search(search_query)
        text = gemini.answer(query, top, highlight=highlight, attachments=attachments, web_results=web_results)

    seen: set[tuple[int, str]] = set()
    citations: list[Citation] = []
    for c in top:
        key = (c.page, c.section_path)
        if key not in seen:
            seen.add(key)
            citations.append(
                Citation(page=c.page, section_path=c.section_path, text=c.text)
            )

    web_sources = [WebSource(title=r.title, url=r.url) for r in (web_results or [])]
    return ChatResult(answer=text, citations=citations, web_sources=web_sources)
