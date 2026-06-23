"""Gemini generation (google-genai).

Builds a grounded prompt from reranked chunks and asks gemini-3.5-flash to
answer using only that context, citing pages. An optional highlighted passage
(from the PDF "Highlight & Ask" feature) is given extra emphasis.
"""

from __future__ import annotations

from functools import lru_cache

from google import genai
from google.genai import types

from src.config import GEMINI_API_KEY, GEMINI_MODEL
from src.rag.store import Candidate

SYSTEM_INSTRUCTION = (
    "You are a precise research assistant embedded in an arxiv paper reader. "
    "Answer the user's question using ONLY the provided context excerpts from the "
    "paper. Cite the pages you used inline like [p. 3]. If the context does not "
    "contain the answer, say so plainly instead of guessing. Be concise and "
    "technical; preserve notation and terminology from the paper."
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


def answer(query: str, candidates: list[Candidate], highlight: str | None = None) -> str:
    context = _format_context(candidates) or "(no relevant context found)"

    parts = [f"Context excerpts from the paper:\n\n{context}"]
    if highlight:
        parts.append(
            "The user highlighted this passage in the PDF; focus your answer on it:\n"
            f'"""{highlight.strip()}"""'
        )
    parts.append(f"Question: {query}")
    prompt = "\n\n".join(parts)

    response = _client().models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.2,
        ),
    )
    return (response.text or "").strip()
