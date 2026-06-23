from src.config import CHUNK_MAX_TOKENS
from src.rag.chunk import chunk_document
from src.rag.extract import Document, PageText

# ~60 short sentences -> several chunks per page.
SENTENCES = " ".join(
    f"This is sentence number {i} describing the transformer architecture in detail."
    for i in range(60)
)


def _doc() -> Document:
    return Document(
        title="Test Paper",
        pages=[
            PageText(page=1, text=SENTENCES, section_path="1 Intro"),
            PageText(page=2, text=SENTENCES, section_path="2 Methods"),
        ],
    )


def test_chunks_have_metadata_and_sequential_indexes():
    chunks = chunk_document(_doc())
    assert len(chunks) > 2
    for i, c in enumerate(chunks):
        assert c.chunk_index == i
        assert c.doc_name == "Test Paper"
        assert c.page in (1, 2)
        assert c.section_path in ("1 Intro", "2 Methods")
        assert c.text.strip()


def test_chunks_respect_max_tokens():
    chunks = chunk_document(_doc())
    for c in chunks:
        assert c.token_count <= CHUNK_MAX_TOKENS


def test_chunks_do_not_cross_pages():
    chunks = chunk_document(_doc())
    page1 = [c for c in chunks if c.page == 1]
    page2 = [c for c in chunks if c.page == 2]
    assert page1 and page2
    # page metadata is consistent with section metadata
    assert all(c.section_path == "1 Intro" for c in page1)
    assert all(c.section_path == "2 Methods" for c in page2)


def test_consecutive_chunks_overlap():
    chunks = chunk_document(_doc())
    page1 = [c for c in chunks if c.page == 1]
    # With overlap enabled, the start of chunk i+1 repeats the tail of chunk i.
    overlaps = 0
    for a, b in zip(page1, page1[1:]):
        tail_words = a.text.split()[-6:]
        if " ".join(tail_words) in b.text:
            overlaps += 1
    assert overlaps >= 1
