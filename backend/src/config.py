"""Central configuration for the backend.

Loads environment variables and exposes paths / model names used across the
RAG pipeline. Everything is overridable via env so the same code runs locally
and inside Docker.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# backend/src/config.py -> parents[1] == backend/
BACKEND_ROOT = Path(__file__).resolve().parents[1]

# Load backend/.env if present (no-op in prod where env is injected).
load_dotenv(BACKEND_ROOT / ".env")

# --- Secrets ---------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# --- Storage ---------------------------------------------------------------
# Root for per-request temp dirs: papers/<req_id>/{paper.pdf, qdrant/}.
# Created on app startup and removed on shutdown.
PAPERS_ROOT = Path(os.getenv("PAPERS_ROOT", str(BACKEND_ROOT / "papers")))

# --- Models ----------------------------------------------------------------
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
DENSE_MODEL = os.getenv("DENSE_MODEL", "BAAI/bge-small-en-v1.5")
DENSE_DIM = int(os.getenv("DENSE_DIM", "384"))  # bge-small-en-v1.5 -> 384
SPARSE_MODEL = os.getenv("SPARSE_MODEL", "Qdrant/bm25")
RERANK_MODEL = os.getenv("RERANK_MODEL", "Xenova/ms-marco-MiniLM-L-6-v2")

# --- Chunking --------------------------------------------------------------
CHUNK_TARGET_TOKENS = int(os.getenv("CHUNK_TARGET_TOKENS", "256"))  # 200-300
CHUNK_MAX_TOKENS = int(os.getenv("CHUNK_MAX_TOKENS", "400"))
CHUNK_OVERLAP_TOKENS = int(os.getenv("CHUNK_OVERLAP_TOKENS", "40"))  # ~15%

# --- Retrieval -------------------------------------------------------------
# Reciprocal Rank Fusion weights: 70% dense embeddings / 30% BM25 keyword.
RRF_DENSE_WEIGHT = float(os.getenv("RRF_DENSE_WEIGHT", "0.7"))
RRF_SPARSE_WEIGHT = float(os.getenv("RRF_SPARSE_WEIGHT", "0.3"))
RRF_K = int(os.getenv("RRF_K", "60"))  # RRF damping constant

PREFETCH_LIMIT = int(os.getenv("PREFETCH_LIMIT", "50"))  # per-branch candidates
FUSED_LIMIT = int(os.getenv("FUSED_LIMIT", "20"))  # candidates kept after fusion
ADJACENT_WINDOW = int(os.getenv("ADJACENT_WINDOW", "1"))  # ±N neighbour chunks
TOP_K = int(os.getenv("TOP_K", "6"))  # final chunks after reranking


def paper_dir(req_id: str) -> Path:
    """Directory holding a single request's artifacts."""
    return PAPERS_ROOT / req_id


def pdf_path(req_id: str) -> Path:
    return paper_dir(req_id) / "paper.pdf"


def qdrant_path(req_id: str) -> Path:
    return paper_dir(req_id) / "qdrant"
