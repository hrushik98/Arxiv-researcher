"""PDF text extraction with layout/section awareness (PyMuPDF).

Pulls per-page text and resolves each page to its section path using the PDF's
table of contents (bookmarks). This mirrors the article's "BookmarkPdfExtractor"
idea: capture the document hierarchy so chunks can carry section metadata for
filtering and citations.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pymupdf


@dataclass
class PageText:
    page: int  # 1-based page number
    text: str
    section_path: str  # e.g. "3 Model Architecture > 3.2 Attention"


@dataclass
class Document:
    title: str
    pages: list[PageText]


def _section_for_page(toc: list[list], page: int) -> str:
    """Build the hierarchical section path active on a given 1-based page.

    `toc` entries are [level, title, page] (page is 1-based). We keep a stack of
    the most recent title at each level whose start page is <= the current page.
    """
    stack: dict[int, str] = {}
    last_level = 0
    for level, title, start_page in toc:
        if start_page > page:
            break
        # Reset deeper levels when a shallower heading appears.
        for lvl in list(stack):
            if lvl >= level:
                del stack[lvl]
        stack[level] = title.strip()
        last_level = max(last_level, level)
    parts = [stack[lvl] for lvl in sorted(stack)]
    return " > ".join(parts)


def _derive_title(doc: pymupdf.Document) -> str:
    meta_title = (doc.metadata or {}).get("title", "").strip()
    if meta_title:
        return meta_title
    # Fall back to the largest text spans on the first page (likely the title).
    if doc.page_count == 0:
        return "Untitled paper"
    page = doc.load_page(0)
    spans: list[tuple[float, str]] = []
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                txt = span.get("text", "").strip()
                if txt:
                    spans.append((span.get("size", 0.0), txt))
    if not spans:
        return "Untitled paper"
    max_size = max(size for size, _ in spans)
    title_parts = [txt for size, txt in spans if size >= max_size - 0.5]
    return " ".join(title_parts).strip() or "Untitled paper"


def extract_document(pdf_path: str | Path) -> Document:
    """Extract per-page text and section paths from a PDF."""
    doc = pymupdf.open(str(pdf_path))
    try:
        toc = doc.get_toc(simple=True)  # [[level, title, page], ...]
        title = _derive_title(doc)
        pages: list[PageText] = []
        for i in range(doc.page_count):
            page = doc.load_page(i)
            text = page.get_text("text").strip()
            if not text:
                continue
            pages.append(
                PageText(
                    page=i + 1,
                    text=text,
                    section_path=_section_for_page(toc, i + 1),
                )
            )
        return Document(title=title, pages=pages)
    finally:
        doc.close()
