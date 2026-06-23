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
        lambda req_id, message, highlight=None, attachments=None, force_web_search=False: pipeline.ChatResult(
            answer="ok",
            citations=[
                pipeline.Citation(page=2, section_path="2 Methods", text="The encoder is composed of N=6 layers.")
            ],
        ),
    )
    with TestClient(main.app) as client:
        resp = client.post("/chat", json={"req_id": "x", "message": "hi"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["answer"] == "ok"
        assert body["citations"] == [
            {"page": 2, "section_path": "2 Methods", "text": "The encoder is composed of N=6 layers."}
        ]
        assert body["web_sources"] == []


def test_chat_forwards_web_search_flag(monkeypatch):
    monkeypatch.setattr(ingest, "is_ready", lambda req_id: True)
    captured = {}

    def fake_chat(req_id, message, highlight=None, attachments=None, force_web_search=False):
        captured["force_web_search"] = force_web_search
        return pipeline.ChatResult(
            answer="ok",
            citations=[],
            web_sources=[pipeline.WebSource(title="Example", url="https://example.com")],
        )

    monkeypatch.setattr(pipeline, "chat", fake_chat)
    with TestClient(main.app) as client:
        resp = client.post("/chat", json={"req_id": "x", "message": "hi", "web_search": True})
        assert resp.status_code == 200
        assert captured["force_web_search"] is True
        assert resp.json()["web_sources"] == [{"title": "Example", "url": "https://example.com"}]


def test_ingest_seeds_status(monkeypatch):
    # Avoid running the real background pipeline.
    monkeypatch.setattr(ingest, "run_ingestion", lambda req_id, url: None)
    with TestClient(main.app) as client:
        resp = client.post("/ingest", json={"url": "https://arxiv.org/abs/1706.03762", "req_id": "seed-1"})
        assert resp.status_code == 202
        assert client.get("/status/seed-1").json()["status"] == "downloading"
