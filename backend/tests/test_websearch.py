from src.config import TAVILY_API_KEY
from src.llm import websearch


def test_search_returns_empty_without_api_key(monkeypatch):
    monkeypatch.setattr(websearch, "TAVILY_API_KEY", "")
    assert websearch.search("anything") == []


def test_search_parses_results(monkeypatch):
    monkeypatch.setattr(websearch, "TAVILY_API_KEY", "tvly-fake")
    websearch._client.cache_clear()

    class _FakeClient:
        def search(self, query, search_depth, max_results):
            return {
                "results": [
                    {"title": "Result one", "url": "https://example.com/1", "content": "Snippet one."},
                    {"title": "Result two", "url": "https://example.com/2", "content": "Snippet two."},
                ]
            }

    monkeypatch.setattr(websearch, "TavilyClient", lambda api_key: _FakeClient())

    results = websearch.search("latest transformer architectures")
    websearch._client.cache_clear()

    assert len(results) == 2
    assert results[0] == websearch.WebResult(
        title="Result one", url="https://example.com/1", content="Snippet one."
    )


def test_search_handles_client_errors_gracefully(monkeypatch):
    from tavily import InvalidAPIKeyError

    monkeypatch.setattr(websearch, "TAVILY_API_KEY", "tvly-fake")
    websearch._client.cache_clear()

    class _FailingClient:
        def search(self, query, search_depth, max_results):
            raise InvalidAPIKeyError("bad key")

    monkeypatch.setattr(websearch, "TavilyClient", lambda api_key: _FailingClient())

    assert websearch.search("anything") == []
    websearch._client.cache_clear()
