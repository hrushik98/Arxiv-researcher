"""Embedding models (FastEmbed).

- Dense semantic vectors via BAAI/bge-small-en-v1.5 (384-dim).
- Sparse keyword vectors via Qdrant/bm25 (the article's token-hasher role).

Models are loaded lazily and cached as module-level singletons because loading
ONNX weights is expensive and they are thread-safe to reuse.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from fastembed import SparseTextEmbedding, TextEmbedding

from src.config import DENSE_MODEL, SPARSE_MODEL


@dataclass
class Sparse:
    indices: list[int]
    values: list[float]


@lru_cache(maxsize=1)
def _dense_model() -> TextEmbedding:
    return TextEmbedding(model_name=DENSE_MODEL)


@lru_cache(maxsize=1)
def _sparse_model() -> SparseTextEmbedding:
    return SparseTextEmbedding(model_name=SPARSE_MODEL)


def embed_documents(texts: list[str]) -> list[list[float]]:
    return [vec.tolist() for vec in _dense_model().embed(texts)]


def embed_query(text: str) -> list[float]:
    return next(iter(_dense_model().query_embed(text))).tolist()


def embed_sparse_documents(texts: list[str]) -> list[Sparse]:
    return [
        Sparse(indices=emb.indices.tolist(), values=emb.values.tolist())
        for emb in _sparse_model().embed(texts)
    ]


def embed_sparse_query(text: str) -> Sparse:
    emb = next(iter(_sparse_model().query_embed(text)))
    return Sparse(indices=emb.indices.tolist(), values=emb.values.tolist())


def warmup() -> None:
    """Trigger model downloads/initialisation ahead of first request."""
    _dense_model()
    _sparse_model()
