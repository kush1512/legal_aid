from typing import Any
from fastapi import HTTPException
from supabase import create_client
from app.config import get_settings
from app.embeddings import get_embedding_provider

def _kb_client():
    settings=get_settings()
    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise HTTPException(503,"Legal knowledge base is not configured")
    return create_client(settings.supabase_url,settings.supabase_service_role_key)

async def hybrid_legal_search(query: str, *, category: str | None, jurisdiction: str, limit: int) -> list[dict[str,Any]]:
    """Combine semantic and PostgreSQL full-text retrieval; retain exact source provenance."""
    import asyncio
    from starlette.concurrency import run_in_threadpool
    embedder=get_embedding_provider()
    query_vector=await embedder.embed_query(query)
    params={"query_embedding":query_vector,"match_count":limit,"filter_category":category,"filter_jurisdiction":jurisdiction}
    keyword_params={"search_text":query,"match_count":limit,"filter_category":category,"filter_jurisdiction":jurisdiction}
    def retrieve():
        client=_kb_client()
        semantic=client.rpc("match_legal_chunks",params).execute().data or []
        keyword=client.rpc("search_legal_keyword",keyword_params).execute().data or []
        return semantic,keyword
    semantic,keyword=await run_in_threadpool(retrieve)
    # Reciprocal-rank fusion avoids mixing incomparable cosine and ts_rank scales.
    fused: dict[str,dict[str,Any]]={}
    for source,weight in ((semantic,0.65),(keyword,0.35)):
        for rank,row in enumerate(source,1):
            key=str(row["id"])
            item=fused.setdefault(key,{**row,"score":0.0,"methods":[]})
            item["score"] += weight/(60+rank)
            item["methods"].append("semantic" if weight==0.65 else "keyword")
    output=sorted(fused.values(),key=lambda x:x["score"],reverse=True)[:limit]
    return output

def verify_indexed_source(row: dict[str,Any]) -> bool:
    # Verification status is maintained by the ingestion workflow, not inferred by the model.
    return (
        row.get("verification_status") in ("verified","historical")
        and isinstance(row.get("source_url"),str)
        and row["source_url"].startswith("https://")
        and bool(row.get("legal_document_id"))
        and bool(row.get("content"))
    )

async def get_provision(chunk_id: str) -> dict[str,Any] | None:
    from starlette.concurrency import run_in_threadpool
    def retrieve():
        client=_kb_client()
        rows=client.table("legal_chunks").select("*,legal_documents(*)").eq("id",chunk_id).limit(1).execute().data
        return rows[0] if rows else None
    row=await run_in_threadpool(retrieve)
    if not row:
        return None
    document=row.get("legal_documents") or {}
    return {
        "id":row["id"],"legal_document_id":row["legal_document_id"],
        "act_name":row.get("act_name") or document.get("act_name"),
        "section_label":row.get("section_label"),"heading":row.get("heading"),
        "full_text":row.get("content"),"source_url":document.get("source_url"),
        "source_name":document.get("source_name"),
        "source_status":document.get("verification_status"),
        "document_version":document.get("version_label"),
        "effective_from":document.get("effective_from"),"effective_to":document.get("effective_to"),
        "jurisdiction":document.get("jurisdiction")
    }
