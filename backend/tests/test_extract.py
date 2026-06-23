import pymupdf

from src.rag.extract import extract_document


def _make_pdf(path):
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_text((72, 72), "Introduction. The transformer is a neural network.")
    p2 = doc.new_page()
    p2.insert_text((72, 72), "Methods. We use multi-head attention here.")
    doc.set_metadata({"title": "A Test Paper"})
    doc.set_toc([[1, "Introduction", 1], [1, "Methods", 2]])
    doc.save(str(path))
    doc.close()


def test_extract_pages_and_sections(tmp_path):
    pdf = tmp_path / "test.pdf"
    _make_pdf(pdf)

    document = extract_document(pdf)

    assert document.title == "A Test Paper"
    assert len(document.pages) == 2

    page1, page2 = document.pages
    assert page1.page == 1 and "transformer" in page1.text
    assert page2.page == 2 and "attention" in page2.text
    assert page1.section_path == "Introduction"
    assert page2.section_path == "Methods"


def test_title_fallback_when_no_metadata(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Body text", fontsize=10)
    page.insert_text((72, 120), "Big Title Here", fontsize=28)
    pdf = tmp_path / "notitle.pdf"
    doc.save(str(pdf))
    doc.close()

    document = extract_document(pdf)
    assert "Big Title Here" in document.title
