#!/usr/bin/env python3
"""Validate and ingest one official Indian legal PDF/HTML source into Supabase.

Every ingested document remains unverified. Verification is a separate human
review operation and cannot be performed through this ingestion command.
"""
import argparse
import asyncio
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
import fitz
from bs4 import BeautifulSoup
from supabase import create_client

from app.config import get_settings
from app.embeddings import get_embedding_provider

MAX_SOURCE_BYTES = 50 * 1024 * 1024
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DATABASE_DIR = REPOSITORY_ROOT / "database"
MAX_CHARS_PER_CHUNK = 6500
MAX_REDIRECTS = 5
OFFICIAL_SUFFIXES = (".gov.in", ".nic.in", ".gov", ".sci.gov.in", ".ecourts.gov.in")
OFFICIAL_EXACT_HOSTS = {"indiacode.nic.in", "legislative.gov.in", "egazette.nic.in"}
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


def is_official_https_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        return (
            parsed.scheme == "https"
            and bool(host)
            and parsed.username is None
            and parsed.password is None
            and parsed.port in (None, 443)
            and (host.endswith(OFFICIAL_SUFFIXES) or host in OFFICIAL_EXACT_HOSTS)
        )
    except ValueError:
        return False


def extract_pdf(raw: bytes) -> str:
    if b"%PDF-" not in raw[:1024]:
        raise ValueError("The source claims to be a PDF but has no valid PDF header")
    with fitz.open(stream=raw, filetype="pdf") as document:
        pages = [page.get_text("text", sort=True) for page in document]
    return "\n\n".join(pages).strip()


def extract_html(raw: bytes) -> str:
    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    for node in soup.find_all(["h1", "h2", "h3", "h4", "p", "li", "table"]):
        node.insert_before("\n")
        node.insert_after("\n")
    return re.sub(r"\n{3,}", "\n\n", soup.get_text(" ", strip=False)).strip()


SECTION_RE = re.compile(
    r"^\s*(?:(?:SECTION|Section|Sec\.)\s*)?(\d+[A-Z]?)\s*[.)-]\s*(.{2,180})\s*$"
)
CHAPTER_RE = re.compile(
    r"^\s*(CHAPTER\s+[IVXLCDM0-9]+.*|PART\s+[IVXLCDM0-9]+.*)\s*$", re.I
)


def split_long_block(text: str, max_chars: int = MAX_CHARS_PER_CHUNK) -> list[str]:
    """Preserve order and paragraph boundaries while enforcing a hard chunk size."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    output = []
    current = ""

    def flush():
        nonlocal current
        if current:
            output.append(current)
            current = ""

    for paragraph in paragraphs:
        if len(paragraph) <= max_chars:
            candidate = (current + "\n\n" + paragraph).strip() if current else paragraph
            if len(candidate) <= max_chars:
                current = candidate
            else:
                flush()
                current = paragraph
            continue

        flush()
        sentences = re.split(r"(?<=[.;])\s+(?=[A-Z(\[])", paragraph)
        buffer = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) > max_chars:
                if buffer:
                    output.append(buffer)
                    buffer = ""
                output.extend(
                    sentence[index:index + max_chars]
                    for index in range(0, len(sentence), max_chars)
                )
                continue
            candidate = (buffer + " " + sentence).strip() if buffer else sentence
            if len(candidate) <= max_chars:
                buffer = candidate
            else:
                if buffer:
                    output.append(buffer)
                buffer = sentence
        if buffer:
            output.append(buffer)

    flush()
    return output


def structure_chunks(text: str) -> list[dict]:
    lines = text.splitlines()
    sections = []
    chapter = None
    active = None
    preamble = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if active:
                active["text"] += "\n"
            elif preamble:
                preamble.append("")
            continue
        chapter_match = CHAPTER_RE.match(stripped)
        if chapter_match:
            chapter = stripped
            if active:
                sections.append(active)
                active = None
            continue
        match = SECTION_RE.match(stripped)
        if match and len(match.group(2).split()) >= 1:
            if active:
                sections.append(active)
            active = {
                "section": match.group(1),
                "heading": match.group(2).strip(),
                "chapter": chapter,
                "text": stripped,
            }
        elif active:
            active["text"] += "\n" + stripped
        else:
            preamble.append(stripped)
    if active:
        sections.append(active)

    if preamble:
        pre = "\n".join(preamble).strip()
        if pre:
            sections.insert(
                0,
                {
                    "section": None,
                    "heading": "Preamble / introductory text",
                    "chapter": None,
                    "text": pre,
                },
            )
    if not sections:
        sections = [
            {
                "section": None,
                "heading": "Unnumbered source paragraphs",
                "chapter": None,
                "text": paragraph,
            }
            for paragraph in re.split(r"\n\s*\n", text)
            if paragraph.strip()
        ]

    chunks = []
    for section in sections:
        pieces = split_long_block(section["text"])
        for index, piece in enumerate(pieces):
            chunks.append(
                {
                    "act_name": None,
                    "chapter_label": section["chapter"],
                    "section_label": section["section"],
                    "heading": (
                        section["heading"]
                        if index == 0
                        else f'{section["heading"]} (continued {index + 1})'
                    ),
                    "content": piece,
                    "ordinal": len(chunks),
                }
            )
    return chunks


def read_local_source(relative_path: str) -> tuple[bytes, str, str]:
    """Read a PDF/HTML file only from the repository's database/ directory.

    Local files still require an official HTTPS source URL for provenance; the
    URL is validated but not fetched.
    """
    candidate = (REPOSITORY_ROOT / relative_path).resolve()
    database_root = DATABASE_DIR.resolve()
    try:
        candidate.relative_to(database_root)
    except ValueError as exc:
        raise ValueError("Local source files must be stored inside database/") from exc

    if not candidate.is_file():
        raise FileNotFoundError(f"Local source file does not exist: {relative_path}")
    suffix = candidate.suffix.lower()
    mime_by_suffix = {
        ".pdf": "application/pdf",
        ".html": "text/html",
        ".htm": "text/html",
    }
    if suffix not in mime_by_suffix:
        raise ValueError("Local source must be a .pdf, .html or .htm file")

    size = candidate.stat().st_size
    if size <= 0:
        raise ValueError("Local source file is empty")
    if size > MAX_SOURCE_BYTES:
        raise ValueError("Source exceeds 50 MB ingestion limit")

    return candidate.read_bytes(), mime_by_suffix[suffix], candidate.as_posix()


def load_local_source(args) -> tuple[bytes, str, str]:
    if not args.source_url or not is_official_https_url(args.source_url):
        raise ValueError(
            "Local ingestion requires --source-url with an allowed official HTTPS URL"
        )
    return (*read_local_source(args.file), args.source_url)


async def download(url: str) -> tuple[bytes, str, str]:
    """Download with per-hop allowlist checks and a streaming size limit."""
    current_url = url
    async with httpx.AsyncClient(
        timeout=45,
        follow_redirects=False,
        headers={"User-Agent": "LegalAid-KB-Ingestion/1.0"},
    ) as client:
        for redirect_count in range(MAX_REDIRECTS + 1):
            if not is_official_https_url(current_url):
                raise ValueError("Every source and redirect must use an allowed official HTTPS domain")
            async with client.stream("GET", current_url) as response:
                if response.status_code in REDIRECT_STATUSES:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("Official source returned a redirect without a Location header")
                    if redirect_count >= MAX_REDIRECTS:
                        raise ValueError("Source exceeded the maximum redirect count")
                    current_url = urljoin(str(response.url), location)
                    continue

                response.raise_for_status()
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > MAX_SOURCE_BYTES:
                    raise ValueError("Source exceeds 50 MB ingestion limit")

                content = bytearray()
                async for part in response.aiter_bytes():
                    content.extend(part)
                    if len(content) > MAX_SOURCE_BYTES:
                        raise ValueError("Source exceeds 50 MB ingestion limit")

                return (
                    bytes(content),
                    response.headers.get("content-type", "").lower(),
                    str(response.url),
                )
    raise ValueError("Unable to download source")


def extract_source(raw: bytes, mime: str, source_url: str) -> str:
    path = urlparse(source_url).path.lower()
    if path.endswith(".pdf") or "application/pdf" in mime:
        return extract_pdf(raw)
    if path.endswith((".html", ".htm")) or "text/html" in mime:
        return extract_html(raw)
    raise ValueError(f"Unsupported source format: {mime or 'unknown content type'}")


def build_document(args, source_url: str, checksum: str) -> dict:
    return {
        "title": args.title,
        "document_type": args.document_type,
        "act_name": args.act_name,
        "jurisdiction": args.jurisdiction,
        "category": args.category,
        "source_url": source_url,
        "source_name": args.source_name,
        "publication_date": args.publication_date,
        "effective_from": args.effective_from,
        "effective_to": args.effective_to,
        "version_label": args.version_label,
        "amendment_details": args.amendment_details,
        "verification_status": "unverified",
        "verified_at": None,
        "verified_by": None,
        "language": args.language,
        "content_sha256": checksum,
    }


async def ingest(args):
    if args.file:
        raw, mime, _local_path, source_url = load_local_source(args)
    else:
        raw, mime, source_url = await download(args.url)
    extracted_text = extract_source(raw, mime, source_url)
    if len(extracted_text) < 100:
        raise ValueError(
            "No usable text was extracted; OCR is intentionally not performed automatically"
        )

    chunks = structure_chunks(extracted_text)
    if not chunks:
        raise ValueError("No legal text chunks were produced")

    checksum = hashlib.sha256(raw).hexdigest()
    summary = {
        "title": args.title,
        "source_url": source_url,
        "content_type": mime,
        "source_bytes": len(raw),
        "extracted_characters": len(extracted_text),
        "chunk_count": len(chunks),
        "sha256": checksum,
        "verification_status": "unverified",
        "sample_headings": [chunk["heading"] for chunk in chunks[:5]],
    }

    if args.dry_run:
        print(json.dumps({"dry_run": True, **summary}, indent=2))
        return

    settings = get_settings()
    if not settings.supabase_url or not settings.effective_supabase_secret_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for ingestion"
        )

    client = create_client(settings.supabase_url, settings.effective_supabase_secret_key)
    existing = (
        client.table("legal_documents")
        .select("id,title,source_url,content_sha256")
        .eq("source_url", source_url)
        .eq("content_sha256", checksum)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        print(
            json.dumps(
                {
                    "duplicate": True,
                    "legal_document_id": existing[0]["id"],
                    "title": existing[0]["title"],
                    "source_url": source_url,
                    "sha256": checksum,
                    "message": "Identical content from this source is already ingested.",
                },
                indent=2,
            )
        )
        return

    provider = get_embedding_provider()
    embeddings = []
    for start in range(0, len(chunks), 32):
        batch = chunks[start:start + 32]
        embeddings.extend(
            await provider.embed_passages(
                [chunk["heading"] + "\n" + chunk["content"] for chunk in batch]
            )
        )

    if len(embeddings) != len(chunks):
        raise RuntimeError("Embedding provider returned a different number of vectors than chunks")
    for vector in embeddings:
        if len(vector) != settings.embedding_dimensions or not all(
            math.isfinite(float(value)) for value in vector
        ):
            raise RuntimeError("Embedding provider returned an invalid vector")

    chunk_rows = []
    for chunk, embedding in zip(chunks, embeddings):
        chunk_rows.append(
            {
                "act_name": args.act_name,
                "chapter_label": chunk["chapter_label"],
                "section_label": chunk["section_label"],
                "subsection_label": None,
                "paragraph_label": None,
                "heading": chunk["heading"],
                "content": chunk["content"],
                "embedding": embedding,
                "ordinal": chunk["ordinal"],
                "language": args.language,
            }
        )

    result = client.rpc(
        "ingest_legal_document",
        {"p_document": build_document(args, source_url, checksum), "p_chunks": chunk_rows},
    ).execute().data

    if not result:
        raise RuntimeError("Atomic legal ingestion RPC returned no result")
    outcome = result[0]
    if not outcome.get("inserted"):
        print(
            json.dumps(
                {
                    "duplicate": True,
                    "legal_document_id": outcome["legal_document_id"],
                    "source_url": source_url,
                    "sha256": checksum,
                    "message": "Identical content was concurrently ingested; no duplicate was created.",
                },
                indent=2,
            )
        )
        return

    print(
        json.dumps(
            {
                "legal_document_id": outcome["legal_document_id"],
                "chunks": len(chunk_rows),
                "verification_status": "unverified",
                "source_url": source_url,
                "sha256": checksum,
            },
            indent=2,
        )
    )


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--url", help="Official HTTPS PDF/HTML URL to download.")
    source_group.add_argument(
        "--file",
        help="Local PDF/HTML path inside database/; requires --source-url for provenance.",
    )
    parser.add_argument(
        "--source-url",
        default=None,
        help="Canonical official HTTPS source URL for a local file (not downloaded).",
    )
    parser.add_argument("--title", required=True)
    parser.add_argument("--source-name", required=True)
    parser.add_argument(
        "--document-type",
        choices=["act", "amendment", "rule", "regulation", "judgment", "notification", "other"],
        default="act",
    )
    parser.add_argument("--act-name", default=None)
    parser.add_argument("--jurisdiction", default="IN")
    parser.add_argument(
        "--category",
        choices=[
            "property_real_estate",
            "marriage_family",
            "digital_fraud_cybercrime",
            "personal_safety_privacy",
        ],
        default=None,
    )
    parser.add_argument("--language", default="en")
    parser.add_argument("--publication-date", default=None)
    parser.add_argument("--effective-from", default=None)
    parser.add_argument("--effective-to", default=None)
    parser.add_argument("--version-label", default=None)
    parser.add_argument("--amendment-details", default=None)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Download, validate, extract and chunk without embeddings or database writes.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(ingest(parse_args()))
