"""Per-paper vector store (embedded Qdrant, on-disk under papers/<req_id>/qdrant).

Hybrid retrieval: dense (semantic) + sparse (BM25 keyword) branches fused with
weighted Reciprocal Rank Fusion (0.7 dense / 0.3 BM25, per the article), then
expanded with adjacent chunks for broader context. Reranking happens upstream.

Qdrant local mode holds a file lock, so every client is opened for a short
operation and closed immediately.
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator

from qdrant_client import QdrantClient, models

from src.config import (
    ADJACENT_WINDOW,
    DENSE_DIM,
    FUSED_LIMIT,
    PREFETCH_LIMIT,
    RRF_DENSE_WEIGHT,
    RRF_K,
    RRF_SPARSE_WEIGHT,
    qdrant_path,
)
from src.rag.chunk import Chunk
from src.rag.embed import (
    embed_documents,
    embed_query,
    embed_sparse_documents,
    embed_sparse_query,
)

COLLECTION = "paper"


@dataclass
class Candidate:
    text: str
    page: int
    section_path: str
    chunk_index: int
    score: float


@contextmanager
def _client(req_id: str) -> Iterator[QdrantClient]:
    client = QdrantClient(path=str(qdrant_path(req_id)))
    try:
        yield client
    finally:
        client.close()


def build_index(req_id: str, chunks: list[Chunk]) -> int:
    """Embed and upsert all chunks into a fresh local Qdrant collection."""
    if not chunks:
        raise ValueError("No chunks to index")

    texts = [c.text for c in chunks]
    dense = embed_documents(texts)
    sparse = embed_sparse_documents(texts)

    with _client(req_id) as client:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config={
                "dense": models.VectorParams(size=DENSE_DIM, distance=models.Distance.COSINE),
            },
            sparse_vectors_config={
                # IDF is computed by Qdrant from collection stats at query time.
                "sparse": models.SparseVectorParams(modifier=models.Modifier.IDF),
            },
        )

        points = [
            models.PointStruct(
                id=c.chunk_index,
                vector={
                    "dense": dense[i],
                    "sparse": models.SparseVector(indices=sparse[i].indices, values=sparse[i].values),
                },
                payload={
                    "text": c.text,
                    "page": c.page,
                    "section_path": c.section_path,
                    "chunk_index": c.chunk_index,
                    "doc_name": c.doc_name,
                },
            )
            for i, c in enumerate(chunks)
        ]
        client.upsert(collection_name=COLLECTION, points=points, wait=True)
    return len(points)


def _ranks(points) -> dict[int, int]:
    """Map point id -> 0-based rank."""
    return {p.id: rank for rank, p in enumerate(points)}


def search(req_id: str, query: str) -> list[Candidate]:
    """Hybrid retrieval with weighted RRF + adjacent-chunk expansion."""
    dense_q = embed_query(query)
    sparse_q = embed_sparse_query(query)

    with _client(req_id) as client:
        dense_hits = client.query_points(
            collection_name=COLLECTION,
            query=dense_q,
            using="dense",
            limit=PREFETCH_LIMIT,
        ).points
        sparse_hits = client.query_points(
            collection_name=COLLECTION,
            query=models.SparseVector(indices=sparse_q.indices, values=sparse_q.values),
            using="sparse",
            limit=PREFETCH_LIMIT,
        ).points

        # Weighted Reciprocal Rank Fusion.
        dense_rank = _ranks(dense_hits)
        sparse_rank = _ranks(sparse_hits)
        fused: dict[int, float] = {}
        for pid, rank in dense_rank.items():
            fused[pid] = fused.get(pid, 0.0) + RRF_DENSE_WEIGHT / (RRF_K + rank)
        for pid, rank in sparse_rank.items():
            fused[pid] = fused.get(pid, 0.0) + RRF_SPARSE_WEIGHT / (RRF_K + rank)

        top_ids = sorted(fused, key=lambda p: fused[p], reverse=True)[:FUSED_LIMIT]

        # Adjacent-chunk expansion: pull ±N neighbours around each hit. Neighbours
        # inherit a slightly reduced score so originals stay ahead pre-rerank.
        wanted: dict[int, float] = {}
        for pid in top_ids:
            wanted[pid] = max(wanted.get(pid, 0.0), fused[pid])
            for d in range(1, ADJACENT_WINDOW + 1):
                for nb in (pid - d, pid + d):
                    if nb >= 0:
                        wanted.setdefault(nb, fused[pid] * 0.5)

        records = client.retrieve(
            collection_name=COLLECTION,
            ids=list(wanted),
            with_payload=True,
        )

    candidates = [
        Candidate(
            text=r.payload["text"],
            page=r.payload["page"],
            section_path=r.payload.get("section_path", ""),
            chunk_index=r.payload["chunk_index"],
            score=wanted.get(r.id, 0.0),
        )
        for r in records
    ]
    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates
