import pytest

from app.utils.domains import normalise_domain


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("  Example.COM  ", "example.com"),
        ("blog.example.co.uk", "blog.example.co.uk"),
        ("my-tool.io", "my-tool.io"),
        ("xn--bcher-kva.de", "xn--bcher-kva.de"),
    ],
)
def test_normalise_domain(value: str, expected: str) -> None:
    assert normalise_domain(value) == expected


@pytest.mark.parametrize(
    "value",
    [
        "",
        "http://x.com",
        "https://example.com",
        "example.com/path",
        "example.com/",
        "example.com:443",
        "exam ple.com",
        "example.com\n.evil.com",
        "example.com?x=1",
        "example.com#fragment",
        "user@example.com",
        "localhost",
        "127.0.0.1",
        "-example.com",
        "example-.com",
        "a..com",
        "under_score.com",
        "example.com.",
        "a" * 64 + ".com",
        ".".join(["a" * 63] * 4) + ".com",
    ],
)
def test_reject_invalid_domain(value: str) -> None:
    with pytest.raises(ValueError):
        normalise_domain(value)
