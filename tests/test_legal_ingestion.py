from scripts.ingest_legal import (
    extract_html,
    is_official_https_url,
    split_long_block,
    structure_chunks,
    MAX_CHARS_PER_CHUNK,
)


def test_official_source_allowlist_requires_https_and_expected_host():
    assert is_official_https_url("https://www.indiacode.nic.in/handle/123")
    assert is_official_https_url("https://legislative.gov.in/acts")
    assert not is_official_https_url("http://www.indiacode.nic.in/handle/123")
    assert not is_official_https_url("https://indiacode.nic.in.attacker.example/document.pdf")
    assert not is_official_https_url("https://example.com/india-code.pdf")


def test_split_long_block_enforces_maximum_without_losing_tokens():
    source = ("statutoryword " * 1100).strip()
    chunks = split_long_block(source, max_chars=MAX_CHARS_PER_CHUNK)
    assert chunks
    assert all(0 < len(chunk) <= MAX_CHARS_PER_CHUNK for chunk in chunks)
    assert "".join("".join(chunk.split()) for chunk in chunks) == "".join(source.split())


def test_split_long_block_preserves_paragraph_order():
    source = (
        "FIRST PARAGRAPH has several legal facts. "
        "SECOND PARAGRAPH contains the next statutory condition.\n\n"
        "THIRD PARAGRAPH contains the final exception."
    )
    chunks = split_long_block(source, max_chars=65)
    combined = " ".join(chunks)
    assert combined.index("FIRST PARAGRAPH") < combined.index("SECOND PARAGRAPH")
    assert combined.index("SECOND PARAGRAPH") < combined.index("THIRD PARAGRAPH")
    assert all(len(chunk) <= 65 for chunk in chunks)


def test_structure_chunks_preserves_act_chapter_and_section_labels():
    source = """CHAPTER I
PRELIMINARY
1. Short title and commencement
This section contains the short title and commencement details.

2. Application
This section describes the application of the Act.
"""
    chunks = structure_chunks(source)
    numbered = [chunk for chunk in chunks if chunk["section_label"]]
    assert [chunk["section_label"] for chunk in numbered] == ["1", "2"]
    assert numbered[0]["chapter_label"] == "CHAPTER I"
    assert numbered[0]["heading"] == "Short title and commencement"
    assert "commencement details" in numbered[0]["content"]
    assert "application of the Act" in numbered[1]["content"]
    assert [chunk["ordinal"] for chunk in chunks] == list(range(len(chunks)))


def test_structure_chunks_splits_long_sections_under_hard_limit():
    long_body = "This is a legal sentence about a statutory rule. " * 250
    source = "CHAPTER II\n3. Long provision\n" + long_body
    chunks = structure_chunks(source)
    assert len(chunks) > 1
    assert all(len(chunk["content"]) <= MAX_CHARS_PER_CHUNK for chunk in chunks)
    assert all(chunk["section_label"] == "3" for chunk in chunks)


def test_html_extractor_removes_script_and_navigation_content():
    html = b"""<html><body>
    <nav>Navigation noise</nav>
    <h1>Example Act</h1>
    <h2>1. Short title</h2>
    <p>The short title provision.</p>
    <script>ignore_this_script_value()</script>
    </body></html>"""
    extracted = extract_html(html)
    assert "Example Act" in extracted
    assert "The short title provision" in extracted
    assert "Navigation noise" not in extracted
    assert "ignore_this_script_value" not in extracted
