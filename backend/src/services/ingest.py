"""Request lifecycle + status tracking for paper ingestion.

A simple in-memory status map keyed by req_id drives the frontend's polling.
The heavy work (download + embed + index) runs as a background task off the
event loop.
"""

from __future__ import annotations

import threading
from dataclasses import asdict, dataclass
from typing import Literal

from src.config import paper_dir
from src.helpers.arvix_downloader import download_pdf
from src.rag import pipeline

Status = Literal["downloading", "indexing", "ready", "error"]


@dataclass
class IngestState:
    status: Status
    paper_name: str | None = None
    chunk_count: int | None = None
    error: str | None = None


_states: dict[str, IngestState] = {}
_lock = threading.Lock()


def _set(req_id: str, **kwargs) -> None:
    with _lock:
        current = _states.get(req_id) or IngestState(status="downloading")
        for k, v in kwargs.items():
            setattr(current, k, v)
        _states[req_id] = current


def seed(req_id: str) -> None:
    """Record an initial 'downloading' state before the background task runs."""
    _set(req_id, status="downloading")


def get_status(req_id: str) -> dict | None:
    with _lock:
        state = _states.get(req_id)
        return asdict(state) if state else None


def is_ready(req_id: str) -> bool:
    with _lock:
        state = _states.get(req_id)
        return bool(state and state.status == "ready")


def run_ingestion(req_id: str, url: str) -> None:
    """Blocking pipeline: download the PDF, then build the RAG index."""
    _set(req_id, status="downloading", error=None)
    try:
        title = download_pdf(url, paper_dir(req_id))
        _set(req_id, status="indexing", paper_name=title)
        chunk_count = pipeline.ingest(req_id)
        _set(req_id, status="ready", chunk_count=chunk_count)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the client
        _set(req_id, status="error", error=str(exc))
