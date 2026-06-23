"""Cross-encoder reranking (FastEmbed TextCrossEncoder).

Takes the fused candidate pool and scores each (query, chunk) pair with a
cross-encoder, returning the top-k most relevant chunks. This is the precision
boost the article calls for after recall-oriented hybrid retrieval.
"""

from __future__ import annotations

from functools import lru_cache

from fastembed.rerank.cross_encoder import TextCrossEncoder

from src.config import RERANK_MODEL, TOP_K
from src.rag.store import Candidate


@lru_cache(maxsize=1)
def _reranker() -> TextCrossEncoder:
    return TextCrossEncoder(model_name=RERANK_MODEL)


def rerank(query: str, candidates: list[Candidate], top_k: int = TOP_K) -> list[Candidate]:
    if not candidates:
        return []
    scores = list(_reranker().rerank(query, [c.text for c in candidates]))
    ranked = sorted(zip(candidates, scores), key=lambda pair: pair[1], reverse=True)
    return [c for c, _ in ranked[:top_k]]


def warmup() -> None:
    _reranker()
