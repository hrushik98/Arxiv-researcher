import pytest

from src.helpers.arvix_downloader import extract_arxiv_id


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://arxiv.org/abs/1706.03762", "1706.03762"),
        ("https://arxiv.org/pdf/1706.03762", "1706.03762"),
        ("https://arxiv.org/pdf/1706.03762v7.pdf", "1706.03762v7"),
        ("1706.03762", "1706.03762"),
        ("arxiv.org/abs/2310.06825v1", "2310.06825v1"),
    ],
)
def test_extract_arxiv_id(url, expected):
    assert extract_arxiv_id(url) == expected


def test_extract_arxiv_id_invalid():
    with pytest.raises(ValueError):
        extract_arxiv_id("https://example.com/not-a-paper")
