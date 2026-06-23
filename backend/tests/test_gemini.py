from src.llm import gemini
from src.rag.store import Candidate


class _FakeResponse:
    def __init__(self, text):
        self.text = text


class _FakeModels:
    def __init__(self, sink):
        self.sink = sink

    def generate_content(self, model, contents, config):
        self.sink["model"] = model
        self.sink["contents"] = contents
        self.sink["system"] = config.system_instruction
        return _FakeResponse("Answer using [p. 3].")


class _FakeClient:
    def __init__(self, sink):
        self.models = _FakeModels(sink)


def test_answer_builds_grounded_prompt(monkeypatch):
    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))

    candidates = [
        Candidate(text="Attention maps queries to keys.", page=3, section_path="3 Attention", chunk_index=5, score=1.0),
    ]
    out = gemini.answer("What is attention?", candidates, highlight="queries to keys")

    assert out == "Answer using [p. 3]."
    assert sink["model"] == gemini.GEMINI_MODEL
    # context, citation hint, highlight, and question all present in the prompt
    assert "Attention maps queries to keys." in sink["contents"]
    assert "p. 3" in sink["contents"]
    assert "queries to keys" in sink["contents"]
    assert "What is attention?" in sink["contents"]
    assert "research assistant" in sink["system"]


def test_answer_handles_no_candidates(monkeypatch):
    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))
    out = gemini.answer("Anything?", [])
    assert out == "Answer using [p. 3]."
    assert "no relevant context" in sink["contents"]
