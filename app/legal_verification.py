from typing import Any

from fastapi import HTTPException
from supabase import create_client

from app.config import get_settings


def _client():
    settings = get_settings()
    if not (settings.supabase_url and settings.effective_supabase_secret_key):
        raise HTTPException(503, detail="Legal verification service is not configured")
    return create_client(settings.supabase_url, settings.effective_supabase_secret_key)


def list_pending_documents(limit: int = 20, offset: int = 0) -> dict[str, Any]:
    response = (
        _client()
        .table("legal_documents")
        .select(
            "id,title,document_type,act_name,jurisdiction,category,source_url,"
            "source_name,publication_date,effective_from,effective_to,version_label,"
            "amendment_details,verification_status,review_decision,language,"
            "content_sha256,created_at"
        )
        .eq("verification_status", "unverified")
        .is_("review_decision", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"items": response.data or [], "limit": limit, "offset": offset}


def get_document_review_detail(
    document_id: str, chunks_limit: int = 100, chunks_offset: int = 0
) -> dict[str, Any] | None:
    client = _client()
    document_response = (
        client.table("legal_documents")
        .select("*")
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    if not document_response.data:
        return None

    chunks_response = (
        client.table("legal_chunks")
        .select(
            "id,ordinal,act_name,chapter_label,section_label,subsection_label,"
            "paragraph_label,heading,content,language"
        )
        .eq("legal_document_id", document_id)
        .order("ordinal")
        .range(chunks_offset, chunks_offset + chunks_limit - 1)
        .execute()
    )
    events_response = (
        client.table("legal_document_verification_events")
        .select(
            "id,reviewer_id,previous_status,resulting_status,decision,"
            "rationale,checklist,created_at"
        )
        .eq("legal_document_id", document_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {
        "document": document_response.data[0],
        "chunks": chunks_response.data or [],
        "review_history": events_response.data or [],
        "chunks_limit": chunks_limit,
        "chunks_offset": chunks_offset,
    }


def review_document(
    document_id: str,
    reviewer_id: str,
    decision: str,
    rationale: str,
    checklist: dict[str, bool],
) -> dict[str, Any]:
    response = _client().rpc(
        "review_legal_document",
        {
            "p_document_id": document_id,
            "p_reviewer_id": reviewer_id,
            "p_decision": decision,
            "p_rationale": rationale,
            "p_checklist": checklist,
        },
    ).execute()
    if not response.data:
        raise HTTPException(500, detail="Document review did not return a result")
    return response.data[0]
