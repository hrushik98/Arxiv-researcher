"""Download the PDF (only) for an arxiv paper.

Uses the `arxiv` Python package directly so we fetch just the PDF — no source
`.tar.gz`. Returns the paper's title for display.
"""

from __future__ import annotations

import re
from pathlib import Path

import arxiv

_ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")


def extract_arxiv_id(url: str) -> str:
    """Extract the arxiv id from an abs/pdf URL or a bare id string."""
    match = _ARXIV_ID_RE.search(url.strip())
    if not match:
        raise ValueError(f"Could not parse an arxiv id from: {url!r}")
    return match.group(0)


def download_pdf(url: str, dest_dir: str | Path, filename: str = "paper.pdf") -> str:
    """Download the paper PDF into dest_dir/filename. Returns the paper title."""
    arxiv_id = extract_arxiv_id(url)
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    client = arxiv.Client()
    result = next(client.results(arxiv.Search(id_list=[arxiv_id])))
    result.download_pdf(dirpath=str(dest_dir), filename=filename)
    return result.title
