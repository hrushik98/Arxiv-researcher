"""Token-aware semantic chunking.

Targets 200-300 token chunks (max 400) with ~10-20% overlap, breaking on
sentence boundaries to keep chunks cohesive. Each chunk carries metadata
(doc name, page, section path, chunk index) for filtering and citations.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import tiktoken

from src.config import CHUNK_MAX_TOKENS, CHUNK_OVERLAP_TOKENS, CHUNK_TARGET_TOKENS
from src.rag.extract import Document

_ENC = tiktoken.get_encoding("cl100k_base")

# Split on sentence terminators followed by whitespace. Good enough for prose.
_SENT_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    text: str
    page: int
    section_path: str
    chunk_index: int  # global, document-wide order
    doc_name: str
    token_count: int


def _ntokens(text: str) -> int:
    return len(_ENC.encode(text))


def _split_sentences(text: str) -> list[str]:
    # Normalise whitespace, then split into sentence-ish units.
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    return [s for s in _SENT_RE.split(text) if s.strip()]


def _hard_split(sentence: str, max_tokens: int) -> list[str]:
    """Split an over-long sentence into <= max_tokens token windows."""
    tokens = _ENC.encode(sentence)
    out: list[str] = []
    for i in range(0, len(tokens), max_tokens):
        out.append(_ENC.decode(tokens[i : i + max_tokens]))
    return out


def _overlap_tail(sentences: list[str], overlap_tokens: int) -> list[str]:
    """Return trailing sentences summing to about `overlap_tokens` tokens."""
    tail: list[str] = []
    total = 0
    for sent in reversed(sentences):
        t = _ntokens(sent)
        if total + t > overlap_tokens and tail:
            break
        tail.insert(0, sent)
        total += t
    return tail


def chunk_document(
    document: Document,
    target_tokens: int = CHUNK_TARGET_TOKENS,
    max_tokens: int = CHUNK_MAX_TOKENS,
    overlap_tokens: int = CHUNK_OVERLAP_TOKENS,
) -> list[Chunk]:
    """Chunk a Document page-by-page. Chunks never span pages, so page metadata
    (and therefore citations) stay accurate."""
    chunks: list[Chunk] = []
    index = 0

    for page in document.pages:
        sentences: list[str] = []
        for sent in _split_sentences(page.text):
            if _ntokens(sent) > max_tokens:
                sentences.extend(_hard_split(sent, max_tokens))
            else:
                sentences.append(sent)

        current: list[str] = []
        current_tokens = 0

        def flush(current: list[str]) -> None:
            nonlocal index
            text = " ".join(current).strip()
            if not text:
                return
            chunks.append(
                Chunk(
                    text=text,
                    page=page.page,
                    section_path=page.section_path,
                    chunk_index=index,
                    doc_name=document.title,
                    token_count=_ntokens(text),
                )
            )
            index += 1

        for sent in sentences:
            t = _ntokens(sent)
            # Close the chunk once we've passed the target (respecting max).
            if current and (current_tokens + t > target_tokens):
                if current_tokens + t <= max_tokens:
                    current.append(sent)
                    current_tokens += t
                    flush(current)
                    current = _overlap_tail(current, overlap_tokens)
                else:
                    flush(current)
                    current = _overlap_tail(current, overlap_tokens)
                    current.append(sent)
                current_tokens = sum(_ntokens(s) for s in current)
            else:
                current.append(sent)
                current_tokens += t

        flush(current)

    return chunks
