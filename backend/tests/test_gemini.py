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
    # contents is a list whose first element is the grounded text prompt.
    prompt = sink["contents"][0]
    # context, citation hint, highlight, and question all present in the prompt
    assert "Attention maps queries to keys." in prompt
    assert "p. 3" in prompt
    assert "queries to keys" in prompt
    assert "What is attention?" in prompt
    assert "research assistant" in sink["system"]


def test_answer_handles_no_candidates(monkeypatch):
    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))
    out = gemini.answer("Anything?", [])
    assert out == "Answer using [p. 3]."
    assert "no relevant context" in sink["contents"][0]


def test_answer_includes_attachment_parts(monkeypatch):
    import base64

    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))

    raw = b"\x89PNG fake image bytes"
    attachment = gemini.Attachment(
        name="figure.png",
        mime_type="image/png",
        data=base64.b64encode(raw).decode(),
    )
    gemini.answer("Describe this", [], attachments=[attachment])

    contents = sink["contents"]
    # Prompt text first, then one inline file part with the decoded bytes.
    assert "figure.png" in contents[0]
    assert len(contents) == 2
    assert contents[1].inline_data.data == raw
    assert contents[1].inline_data.mime_type == "image/png"
    # System instruction should switch to the attachment-aware variant.
    assert "attached file" in sink["system"]


def test_answer_first_pass_instructs_sentinel_on_miss(monkeypatch):
    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))
    gemini.answer("Anything?", [])
    assert gemini.WEB_SEARCH_SENTINEL in sink["system"]


def test_answer_includes_web_results(monkeypatch):
    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))

    web_results = [
        gemini.WebResult(title="Recent survey", url="https://example.com/survey", content="A relevant snippet."),
    ]
    gemini.answer("What's the latest on this?", [], web_results=web_results)

    prompt = sink["contents"][0]
    assert "A relevant snippet." in prompt
    assert "[web 1]" in prompt
    assert "example.com/survey" in prompt
    assert gemini.WEB_SEARCH_SENTINEL not in sink["system"]


def test_answer_with_empty_web_results_falls_back_to_general_knowledge(monkeypatch):
    sink = {}
    monkeypatch.setattr(gemini, "_client", lambda: _FakeClient(sink))
    gemini.answer("Anything?", [], web_results=[])
    assert gemini.WEB_SEARCH_SENTINEL not in sink["system"]
    assert "general knowledge" in sink["system"]
