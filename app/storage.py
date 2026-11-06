import threading
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from supabase import create_client
from app.config import Settings

def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()

class Storage:
    """Supabase-backed storage. In-memory mode is explicit and development-only."""
    def __init__(self, settings: Settings):
        self.s = settings
        self._lock = threading.RLock()
        self._memory: dict[str, list[dict[str, Any]]] = {
            name: [] for name in (
                "cases","case_messages","case_assessments","case_documents",
                "legal_documents","legal_chunks","legal_citations","generated_drafts",
                "community_posts","lawyer_profiles"
            )
        }

    @property
    def is_mock(self) -> bool:
        return bool(self.s.mock_storage and self.s.app_env == "development")

    def _client(self, token: str | None):
        if not self.s.supabase_url or not self.s.supabase_anon_key:
            raise HTTPException(503, "Supabase is not configured")
        client = create_client(self.s.supabase_url, self.s.supabase_anon_key)
        if token:
            client.postgrest.auth(token)
        return client

    async def _run(self, fn, *args):
        return await run_in_threadpool(fn, *args)

    def _memory_insert(self, table: str, row: dict):
        with self._lock:
            self._memory[table].append(row.copy())
        return row

    async def create_case(self, user: dict, row: dict):
        row = {"id": str(uuid4()), "created_at": utcnow(), "updated_at": utcnow(), **row}
        if self.is_mock:
            return await self._run(self._memory_insert, "cases", row)
        def op():
            return self._client(user["token"]).table("cases").insert(row).execute().data[0]
        return await self._run(op)

    async def list_cases(self, user: dict, limit: int, offset: int, category: str | None, status: str | None):
        if self.is_mock:
            def op():
                with self._lock:
                    items = [x.copy() for x in self._memory["cases"] if x["user_id"] == user["id"]]
                if category: items = [x for x in items if x["category"] == category]
                if status: items = [x for x in items if x["status"] == status]
                items.sort(key=lambda x: x["updated_at"], reverse=True)
                return items[offset:offset+limit], len(items)
            return await self._run(op)
        def op():
            q = self._client(user["token"]).table("cases").select("*", count="exact").eq("user_id",user["id"])
            if category: q = q.eq("category",category)
            if status: q = q.eq("status",status)
            result = q.order("updated_at", desc=True).range(offset,offset+limit-1).execute()
            return result.data, result.count or len(result.data)
        return await self._run(op)

    async def get_case(self, user: dict, case_id: str):
        if self.is_mock:
            def op():
                with self._lock:
                    return next((x.copy() for x in self._memory["cases"] if x["id"]==case_id and x["user_id"]==user["id"]),None)
            row = await self._run(op)
        else:
            def op():
                result = self._client(user["token"]).table("cases").select("*").eq("id",case_id).eq("user_id",user["id"]).limit(1).execute()
                return result.data[0] if result.data else None
            row = await self._run(op)
        if row is None:
            raise HTTPException(404, "Case not found")
        return row

    async def insert(self, table: str, user: dict, row: dict):
        row = {"id": str(uuid4()), "created_at": utcnow(), **row}
        if self.is_mock:
            return await self._run(self._memory_insert, table, row)
        def op():
            return self._client(user["token"]).table(table).insert(row).execute().data[0]
        return await self._run(op)

    async def list_owned(self, table: str, user: dict, limit: int, offset: int, *, case_id: str | None = None):
        if self.is_mock:
            def op():
                with self._lock:
                    rows = [x.copy() for x in self._memory[table] if x.get("user_id")==user["id"]]
                if case_id: rows = [x for x in rows if x.get("case_id")==case_id]
                rows.sort(key=lambda x:x.get("created_at",""), reverse=True)
                return rows[offset:offset+limit],len(rows)
            return await self._run(op)
        def op():
            q = self._client(user["token"]).table(table).select("*", count="exact").eq("user_id",user["id"])
            if case_id: q = q.eq("case_id",case_id)
            result = q.order("created_at",desc=True).range(offset,offset+limit-1).execute()
            return result.data,result.count or len(result.data)
        return await self._run(op)

    async def latest_assessment(self, user: dict, case_id: str):
        if self.is_mock:
            def op():
                with self._lock:
                    rows=[x for x in self._memory["case_assessments"] if x["user_id"]==user["id"] and x["case_id"]==case_id]
                return sorted(rows,key=lambda x:x["created_at"],reverse=True)[0] if rows else None
            return await self._run(op)
        def op():
            result=self._client(user["token"]).table("case_assessments").select("*").eq("user_id",user["id"]).eq("case_id",case_id).order("created_at",desc=True).limit(1).execute()
            return result.data[0] if result.data else None
        return await self._run(op)

    async def approved_posts(self, user: dict, limit: int, offset: int, category: str | None):
        if self.is_mock:
            def op():
                with self._lock:
                    rows=[x.copy() for x in self._memory["community_posts"] if x.get("moderation_status")=="approved"]
                if category: rows=[x for x in rows if x["category"]==category]
                rows.sort(key=lambda x:x["created_at"],reverse=True)
                return rows[offset:offset+limit],len(rows)
            return await self._run(op)
        def op():
            q=self._client(user.get("token")).table("community_posts").select("*",count="exact").eq("moderation_status","approved")
            if category:q=q.eq("category",category)
            res=q.order("created_at",desc=True).range(offset,offset+limit-1).execute()
            return res.data,res.count or len(res.data)
        return await self._run(op)

    async def verified_lawyers(self, user: dict, limit: int, offset: int, category: str | None, state: str | None, city: str | None, language: str | None):
        if self.is_mock:
            def op():
                with self._lock: rows=[x.copy() for x in self._memory["lawyer_profiles"] if x.get("verification_status")=="verified"]
                if category:rows=[x for x in rows if category in x.get("practice_areas",[])]
                if state:rows=[x for x in rows if x.get("state","").lower()==state.lower()]
                if city:rows=[x for x in rows if x.get("city","").lower()==city.lower()]
                if language:rows=[x for x in rows if language in x.get("languages",[])]
                return rows[offset:offset+limit],len(rows)
            return await self._run(op)
        def op():
            q=self._client(user.get("token")).table("lawyer_profiles").select("*",count="exact").eq("verification_status","verified")
            if category:q=q.contains("practice_areas",[category])
            if state:q=q.ilike("state",state)
            if city:q=q.ilike("city",city)
            if language:q=q.contains("languages",[language])
            res=q.range(offset,offset+limit-1).execute()
            return res.data,res.count or len(res.data)
        return await self._run(op)

    async def provision(self, provision_id: str):
        # Provision detail access is intentionally server-side; never accept unverified client text as a citation.
        if self.is_mock:
            return None
        def op():
            # Use service role only for public knowledge-base read; this key never leaves the backend.
            if not self.s.supabase_service_role_key:
                raise HTTPException(503,"Knowledge base service credentials are not configured")
            client=create_client(self.s.supabase_url,self.s.supabase_service_role_key)
            row=client.table("legal_chunks").select("*,legal_documents(*)").eq("id",provision_id).limit(1).execute()
            return row.data[0] if row.data else None
        return await self._run(op)
