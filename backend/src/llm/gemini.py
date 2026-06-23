"""Gemini generation (google-genai).

Builds a grounded prompt from reranked chunks and asks gemini-3.5-flash to
answer using only that context, citing pages. An optional highlighted passage
(from the PDF "Highlight & Ask" feature) is given extra emphasis. When the
paper's context doesn't cover the question, the model is instructed to emit
WEB_SEARCH_SENTINEL so the pipeline can retry with a Tavily web search.
"""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from functools import lru_cache

from google import genai
from google.genai import types

from src.config import GEMINI_API_KEY, GEMINI_MODEL
from src.llm.websearch import WebResult
from src.rag.store import Candidate


@dataclass
class Attachment:
    """A user-uploaded file forwarded inline to Gemini (e.g. image or PDF)."""

    name: str
    mime_type: str
    data: str  # base64-encoded bytes


# Emitted verbatim by the model -- and only by the model -- when the paper's
# context (and any attachments) don't answer the question. The pipeline
# detects this exact string and retries with a web search appended.
WEB_SEARCH_SENTINEL = "NEED_WEB_SEARCH"

BASE_SYSTEM_INSTRUCTION = (
    "You are a precise research assistant embedded in an arxiv paper reader. "
    "Be concise and technical; preserve notation and terminology from the paper."
)


def _build_system_instruction(has_attachments: bool, web_results: list[WebResult] | None) -> str:
    """Pick the right instruction for the current pass.

    `web_results` distinguishes three states: None (first pass, paper-only --
    may end in the sentinel), [] (a web search ran but found nothing), or a
    non-empty list (web context is available to answer with).
    """
    attachment_clause = " and the attached file(s)" if has_attachments else ""

    if web_results is None:
        return (
            f"{BASE_SYSTEM_INSTRUCTION} Answer the user's question using ONLY the "
            f"provided context excerpts from the paper{attachment_clause}. Cite the "
            "pages you used inline like [p. 3]. If those sources do not contain the "
            f'answer, respond with exactly the token "{WEB_SEARCH_SENTINEL}" and '
            "nothing else -- no explanation, no apology, no other text."
        )

    if web_results:
        return (
            f"{BASE_SYSTEM_INSTRUCTION} Answer the user's question using the context "
            f"excerpts from the paper{attachment_clause} together with the web search "
            "results below. Cite paper pages inline like [p. 3] and web sources "
            "inline like [web 1]. Prefer the paper when it answers the question; use "
            "the web results to fill gaps or answer questions outside the paper's "
            "scope. If nothing answers the question, say so plainly."
        )

    return (
        f"{BASE_SYSTEM_INSTRUCTION} The context excerpts from the paper"
        f"{attachment_clause} do not seem to contain the answer, and a web search for "
        "it came back empty. Answer from your own general knowledge if you can, and "
        "say plainly that the answer isn't sourced from the paper or a web search."
    )


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=GEMINI_API_KEY)


def _format_context(candidates: list[Candidate]) -> str:
    blocks = []
    for i, c in enumerate(candidates, start=1):
        header = f"[{i}] (p. {c.page}"
        if c.section_path:
            header += f", {c.section_path}"
        header += ")"
        blocks.append(f"{header}\n{c.text}")
    return "\n\n".join(blocks)


def _format_web_context(results: list[WebResult]) -> str:
    blocks = []
    for i, r in enumerate(results, start=1):
        blocks.append(f"[web {i}] {r.title} ({r.url})\n{r.content}")
    return "\n\n".join(blocks)


def _attachment_parts(attachments: list[Attachment]) -> list[types.Part]:
    """Decode user-uploaded files into inline Gemini parts (images, PDFs, …)."""
    parts: list[types.Part] = []
    for a in attachments:
        if not a.data or not a.mime_type:
            continue
        try:
            raw = base64.b64decode(a.data, validate=True)
        except (binascii.Error, ValueError):
            continue
        parts.append(types.Part.from_bytes(data=raw, mime_type=a.mime_type))
    return parts


def answer(
    query: str,
    candidates: list[Candidate],
    highlight: str | None = None,
    attachments: list[Attachment] | None = None,
    web_results: list[WebResult] | None = None,
) -> str:
    context = _format_context(candidates) or "(no relevant context found)"

    parts = [f"Context excerpts from the paper:\n\n{context}"]
    if highlight:
        parts.append(
            "The user highlighted this passage in the PDF; focus your answer on it:\n"
            f'"""{highlight.strip()}"""'
        )
    if web_results:
        parts.append(f"Web search results:\n\n{_format_web_context(web_results)}")
    if attachments:
        names = ", ".join(a.name for a in attachments if a.name) or "an uploaded file"
        parts.append(
            "The user also attached the following file(s); use them when answering: "
            f"{names}."
        )
    parts.append(f"Question: {query}")
    prompt = "\n\n".join(parts)

    # Mix the text prompt with any inline file parts in a single content turn.
    contents: list = [prompt]
    if attachments:
        contents.extend(_attachment_parts(attachments))

    response = _client().models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=_build_system_instruction(
                has_attachments=bool(attachments), web_results=web_results
            ),
            temperature=0.2,
        ),
    )
    return (response.text or "").strip()
