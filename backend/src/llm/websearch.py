"""Tavily web search fallback for questions the paper's own context can't answer.

Used by the RAG pipeline when Gemini signals it doesn't have enough grounding
in the paper, or when the user explicitly asks for a web search.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from tavily import TavilyClient
from tavily.errors import (
    BadRequestError,
    ForbiddenError,
    InvalidAPIKeyError,
    TimeoutError as TavilyTimeoutError,
    UsageLimitExceededError,
)

from src.config import TAVILY_API_KEY

MAX_RESULTS = 5


@dataclass
class WebResult:
    title: str
    url: str
    content: str


@lru_cache(maxsize=1)
def _client() -> TavilyClient:
    return TavilyClient(api_key=TAVILY_API_KEY)


def search(query: str, max_results: int = MAX_RESULTS) -> list[WebResult]:
    """Run a Tavily web search. Returns an empty list if unconfigured or on failure."""
    if not TAVILY_API_KEY:
        return []
    try:
        response = _client().search(
            query,
            search_depth="basic",
            max_results=max_results,
        )
    except (InvalidAPIKeyError, UsageLimitExceededError, BadRequestError, ForbiddenError, TavilyTimeoutError):
        return []
    return [
        WebResult(title=r.get("title", ""), url=r.get("url", ""), content=r.get("content", ""))
        for r in response.get("results", [])
    ]
