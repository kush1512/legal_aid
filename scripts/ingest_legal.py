#!/usr/bin/env python3
"""Ingest one official Indian legal PDF/HTML source into Supabase.

A document remains unverified by default. Pass --verified only after a human has
checked the source authority, text, amendment state and effective dates.
"""
import argparse
import asyncio
import hashlib
import os
import re
from datetime import date
from urllib.parse import urlparse

import httpx
import fitz
from bs4 import BeautifulSoup
from supabase import create_client
from app.config import get_settings
from app.embeddings import get_embedding_provider

MAX_SOURCE_BYTES = 50 * 1024 * 1024
MAX_CHARS_PER_CHUNK = 6500
OFFICIAL_SUFFIXES = (".gov.in", ".nic.in", ".gov", ".sci.gov.in", ".ecourts.gov.in")

def is_official_https_url(url: str) -> bool:
    parsed=urlparse(url)
    host=(parsed.hostname or "").lower()
    return parsed.scheme=="https" and (
        host.endswith(OFFICIAL_SUFFIXES) or host in {"indiacode.nic.in","legislative.gov.in","egazette.nic.in"}
    )

def extract_pdf(raw: bytes) -> str:
    with fitz.open(stream=raw,filetype="pdf") as document:
        pages=[page.get_text("text",sort=True) for page in document]
    return "\n\n".join(pages).strip()

def extract_html(raw: bytes) -> str:
    soup=BeautifulSoup(raw,"html.parser")
    for tag in soup(["script","style","nav","footer","header","noscript"]):
        tag.decompose()
    for node in soup.find_all(["h1","h2","h3","h4","p","li","table"]):
        node.insert_before("\n")
        node.insert_after("\n")
    return re.sub(r"\n{3,}","\n\n",soup.get_text(" ",strip=False)).strip()

SECTION_RE=re.compile(r"^\s*(?:(?:SECTION|Section|Sec\.)\s*)?(\d+[A-Z]?)\s*[.)-]\s*(.{2,180})\s*$")
CHAPTER_RE=re.compile(r"^\s*(CHAPTER\s+[IVXLCDM0-9]+.*|PART\s+[IVXLCDM0-9]+.*)\s*$",re.I)

def split_long_block(text: str, max_chars: int=MAX_CHARS_PER_CHUNK) -> list[str]:
    paragraphs=[p.strip() for p in re.split(r"\n\s*\n",text) if p.strip()]
    output=[]; current=""
    for paragraph in paragraphs:
        if len(paragraph)>max_chars:
            if current: output.append(current); current=""
            # Only long individual statutory paragraphs are split at sentence boundaries.
            sentences=re.split(r"(?<=[.;])\s+(?=[A-Z(\[])",paragraph)
            if len(sentences)==1:
                output.extend(paragraph[i:i+max_chars] for i in range(0,len(paragraph),max_chars))
            else:
                buf=""
                for sentence in sentences:
                    if len(buf)+len(sentence)>max_chars and buf:
                        output.append(buf); buf=""
                    buf=(buf+" "+sentence).strip()
                if buf: output.append(buf)
            continue
        if current and len(current)+len(paragraph)+2>max_chars:
            output.append(current); current=paragraph
        else:
            current=(current+"\n\n"+paragraph).strip()
    if current: output.append(current)
    return output

def structure_chunks(text: str) -> list[dict]:
    lines=text.splitlines()
    sections=[]
    chapter=None
    active=None
    preamble=[]
    for line in lines:
        stripped=line.strip()
        if not stripped:
            if active: active["text"] += "\n"
            elif preamble: preamble.append("")
            continue
        chapter_match=CHAPTER_RE.match(stripped)
        if chapter_match:
            chapter=stripped
            if active: sections.append(active); active=None
            continue
        match=SECTION_RE.match(stripped)
        if match and len(match.group(2).split())>=1:
            if active: sections.append(active)
            active={"section":match.group(1),"heading":match.group(2).strip(),"chapter":chapter,"text":stripped}
        elif active:
            active["text"] += "\n"+stripped
        else:
            preamble.append(stripped)
    if active: sections.append(active)

    if preamble:
        pre="\n".join(preamble).strip()
        if pre:
            sections.insert(0,{"section":None,"heading":"Preamble / introductory text","chapter":None,"text":pre})
    if not sections:
        # Preserve paragraph boundaries when an official HTML/PDF source has no
        # machine-readable section labels; do not synthesize section citations.
        sections=[{"section":None,"heading":"Unnumbered source paragraphs","chapter":None,"text":p}
                  for p in re.split(r"\n\s*\n",text) if p.strip()]

    chunks=[]
    for section in sections:
        pieces=split_long_block(section["text"])
        for index,piece in enumerate(pieces):
            chunks.append({
                "act_name":None,
                "chapter_label":section["chapter"],
                "section_label":section["section"],
                "heading":section["heading"] if index==0 else f'{section["heading"]} (continued {index+1})',
                "content":piece,
                "ordinal":len(chunks)
            })
    return chunks

async def download(url: str) -> tuple[bytes,str,str]:
    if not is_official_https_url(url):
        raise ValueError("Only HTTPS official government/court domains are accepted.")
    async with httpx.AsyncClient(timeout=45,follow_redirects=True,headers={"User-Agent":"LegalAid-KB-Ingestion/1.0"}) as client:
        response=await client.get(url)
        response.raise_for_status()
        if len(response.content)>MAX_SOURCE_BYTES:
            raise ValueError("Source exceeds 50 MB ingestion limit")
        final_url=str(response.url)
        if not is_official_https_url(final_url):
            raise ValueError("Source redirected outside the official domain allowlist")
        return response.content,response.headers.get("content-type","").lower(),final_url

async def ingest(args):
    settings=get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for ingestion")
    raw,mime,source_url=await download(args.url)
    path=urlparse(source_url).path.lower()
    if path.endswith(".pdf") or "application/pdf" in mime:
        text=extract_pdf(raw)
    elif path.endswith((".html",".htm")) or "text/html" in mime:
        text=extract_html(raw)
    else:
        raise ValueError(f"Unsupported source format: {mime}")
    if len(text)<100:
        raise ValueError("No usable text was extracted; OCR is intentionally not performed automatically")
    chunks=structure_chunks(text)
    provider=get_embedding_provider()
    embeddings=[]
    for start in range(0,len(chunks),32):
        batch=chunks[start:start+32]
        embeddings.extend(await provider.embed_passages([c["heading"]+"\n"+c["content"] for c in batch]))

    client=create_client(settings.supabase_url,settings.supabase_service_role_key)
    checksum=hashlib.sha256(raw).hexdigest()
    document={
        "title":args.title,"document_type":args.document_type,"act_name":args.act_name,
        "jurisdiction":args.jurisdiction,"category":args.category,
        "source_url":source_url,"source_name":args.source_name,
        "publication_date":args.publication_date,"effective_from":args.effective_from,
        "effective_to":args.effective_to,"version_label":args.version_label,
        "amendment_details":args.amendment_details,
        "verification_status":"verified" if args.verified else "unverified",
        "verified_at":date.today().isoformat() if args.verified else None,
        "verified_by":args.verified_by if args.verified else None,
        "language":args.language,"content_sha256":checksum
    }
    stored=client.table("legal_documents").insert(document).execute().data[0]
    rows=[]
    for chunk,embedding in zip(chunks,embeddings):
        rows.append({
            "legal_document_id":stored["id"],"act_name":args.act_name,
            "chapter_label":chunk["chapter_label"],"section_label":chunk["section_label"],
            "heading":chunk["heading"],"content":chunk["content"],
            "embedding":embedding,"ordinal":chunk["ordinal"],"language":args.language
        })
    for start in range(0,len(rows),100):
        client.table("legal_chunks").insert(rows[start:start+100]).execute()
    print({
        "legal_document_id":stored["id"],"chunks":len(rows),
        "verification_status":document["verification_status"],
        "source_url":source_url,"sha256":checksum
    })

def parse_args():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--url",required=True)
    p.add_argument("--title",required=True)
    p.add_argument("--source-name",required=True)
    p.add_argument("--document-type",choices=["act","amendment","rule","regulation","judgment","notification","other"],default="act")
    p.add_argument("--act-name",default=None)
    p.add_argument("--jurisdiction",default="IN")
    p.add_argument("--category",choices=["property_real_estate","marriage_family","digital_fraud_cybercrime","personal_safety_privacy"],default=None)
    p.add_argument("--language",default="en")
    p.add_argument("--publication-date",default=None)
    p.add_argument("--effective-from",default=None)
    p.add_argument("--effective-to",default=None)
    p.add_argument("--version-label",default=None)
    p.add_argument("--amendment-details",default=None)
    p.add_argument("--verified",action="store_true",help="Human has reviewed the exact official source and current effective status.")
    p.add_argument("--verified-by",default=os.getenv("LEGAL_KB_VERIFIED_BY"))
    return p.parse_args()

if __name__=="__main__":
    asyncio.run(ingest(parse_args()))
