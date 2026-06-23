from fastapi.testclient import TestClient

import main
from src.config import PAPERS_ROOT
from src.rag import pipeline
from src.services import ingest


def test_lifespan_creates_and_removes_papers_root():
    with TestClient(main.app) as client:
        assert PAPERS_ROOT.exists()
        assert client.get("/").json()["message"]
    # papers/ is wiped on shutdown
    assert not PAPERS_ROOT.exists()


def test_status_unknown_returns_404():
    with TestClient(main.app) as client:
        assert client.get("/status/does-not-exist").status_code == 404


def test_pdf_missing_returns_404():
    with TestClient(main.app) as client:
        assert client.get("/pdf/does-not-exist").status_code == 404


def test_chat_conflict_when_not_ready():
    with TestClient(main.app) as client:
        resp = client.post("/chat", json={"req_id": "x", "message": "hi"})
        assert resp.status_code == 409


def test_chat_success(monkeypatch):
    monkeypatch.setattr(ingest, "is_ready", lambda req_id: True)
    monkeypatch.setattr(
        pipeline,
        "chat",
        lambda req_id, message, highlight=None: pipeline.ChatResult(
            answer="ok", citations=[pipeline.Citation(page=2, section_path="2 Methods")]
        ),
    )
    with TestClient(main.app) as client:
        resp = client.post("/chat", json={"req_id": "x", "message": "hi"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["answer"] == "ok"
        assert body["citations"] == [{"page": 2, "section_path": "2 Methods"}]


def test_ingest_seeds_status(monkeypatch):
    # Avoid running the real background pipeline.
    monkeypatch.setattr(ingest, "run_ingestion", lambda req_id, url: None)
    with TestClient(main.app) as client:
        resp = client.post("/ingest", json={"url": "https://arxiv.org/abs/1706.03762", "req_id": "seed-1"})
        assert resp.status_code == 202
        assert client.get("/status/seed-1").json()["status"] == "downloading"
