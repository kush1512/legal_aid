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
                "cases","case_messages","case_facts","case_parties","case_timeline","case_assessments","case_documents",
                "legal_documents","legal_chunks","legal_citations","generated_drafts",
                "community_posts","community_comments","votes","lawyer_profiles","lawyer_verifications","reports"
            )
        }

    @property
    def is_mock(self) -> bool:
        return bool(self.s.mock_storage and self.s.app_env == "development")

    def _client(self, token: str | None):
        if not self.s.supabase_url or not self.s.effective_supabase_publishable_key:
            raise HTTPException(503, "Supabase is not configured")
        client = create_client(self.s.supabase_url, self.s.effective_supabase_publishable_key)
        if token:
            client.postgrest.auth(token)
        return client

    def _service_client(self):
        if not self.s.supabase_url or not self.s.effective_supabase_secret_key:
            raise HTTPException(503, "Backend service storage is not configured")
        return create_client(self.s.supabase_url, self.s.effective_supabase_secret_key)

    SERVER_WRITE_TABLES = {
        "case_messages", "case_facts", "case_assessments",
        "legal_citations", "generated_drafts", "community_posts", "community_comments", "lawyer_profiles", "lawyer_verifications", "reports"
    }

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
            # The API derives user_id from a verified Supabase JWT before this privileged insert.
            # Service-role insertion is required for server-controlled sensitive/demo columns.
            return self._service_client().table("cases").insert(row).execute().data[0]
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

    async def update_case_privacy(self, user: dict, case_id: str, private_conversation: bool):
        if self.is_mock:
            def op():
                with self._lock:
                    row=next((x for x in self._memory["cases"] if x["id"]==case_id and x["user_id"]==user["id"]),None)
                    if row:
                        row["private_conversation"]=private_conversation
                        row["updated_at"]=utcnow()
                    return row.copy() if row else None
            row=await self._run(op)
        else:
            def op():
                # The API performs an owner-scoped read before this server-controlled update.
                result=self._service_client().table("cases").update(
                    {"private_conversation":private_conversation,"updated_at":utcnow()}
                ).eq("id",case_id).eq("user_id",user["id"]).execute()
                return result.data[0] if result.data else None
            row=await self._run(op)
        if row is None:
            raise HTTPException(404,"Case not found")
        return row

    async def insert(self, table: str, user: dict, row: dict):
        row = {"id": str(uuid4()), "created_at": utcnow(), **row}
        if self.is_mock:
            return await self._run(self._memory_insert, table, row)
        def op():
            client = self._service_client() if table in self.SERVER_WRITE_TABLES else self._client(user["token"])
            return client.table(table).insert(row).execute().data[0]
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

    async def approved_posts(
        self, user: dict, limit: int, offset: int, category: str | None,
        sort: str = "newest"
    ):
        if sort not in ("newest", "popular"):
            raise HTTPException(422, "sort must be newest or popular")
        if self.is_mock:
            def op():
                with self._lock:
                    posts = [
                        row.copy() for row in self._memory["community_posts"]
                        if row.get("moderation_status") == "approved"
                    ]
                    comments = [
                        row for row in self._memory["community_comments"]
                        if row.get("moderation_status") == "approved"
                    ]
                    votes = list(self._memory["votes"])
                if category:
                    posts = [row for row in posts if row["category"] == category]
                for row in posts:
                    row["comment_count"] = sum(
                        1 for comment in comments if comment.get("post_id") == row["id"]
                    )
                    row["vote_count"] = sum(
                        1 for vote in votes if vote.get("post_id") == row["id"]
                    )
                    row["display_name"] = (
                        "Anonymous" if row.get("anonymous")
                        else (row.get("display_name") or "Community member")
                    )
                if sort == "popular":
                    posts.sort(
                        key=lambda row: (row["vote_count"], row["comment_count"], row["created_at"]),
                        reverse=True,
                    )
                else:
                    posts.sort(key=lambda row: row["created_at"], reverse=True)
                return posts[offset:offset + limit], len(posts)
            return await self._run(op)

        def op():
            query = (
                self._service_client()
                .table("community_posts_public")
                .select("*", count="exact")
            )
            if category:
                query = query.eq("category", category)
            if sort == "popular":
                query = query.order("vote_count", desc=True).order("comment_count", desc=True)
            query = query.order("created_at", desc=True)
            result = query.range(offset, offset + limit - 1).execute()
            return result.data, result.count or len(result.data)
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
            q=self._service_client().table("lawyer_profiles").select("*",count="exact").eq("verification_status","verified")
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

    async def list_messages(self, user: dict, case_id: str):
        if self.is_mock:
            def op():
                with self._lock:
                    rows=[x.copy() for x in self._memory["case_messages"] if x.get("case_id")==case_id and x.get("user_id")==user["id"]]
                return sorted(rows,key=lambda x:x["created_at"])
            return await self._run(op)
        def op():
            rows=self._client(user["token"]).table("case_messages").select("*").eq("case_id",case_id).eq("user_id",user["id"]).order("created_at").execute()
            return rows.data
        return await self._run(op)

    async def update_case_status(self, user: dict, case_id: str, status: str):
        if self.is_mock:
            def op():
                with self._lock:
                    row=next((x for x in self._memory["cases"] if x["id"]==case_id and x["user_id"]==user["id"]),None)
                    if row:
                        row["status"]=status
                        row["updated_at"]=utcnow()
                    return row
            return await self._run(op)
        def op():
            # This method is called only after an owner-scoped case read in the API layer.
            res=self._service_client().table("cases").update({"status":status}).eq("id",case_id).eq("user_id",user["id"]).execute()
            return res.data[0] if res.data else None
        return await self._run(op)

    async def get_lawyer(self, user: dict, lawyer_id: str):
        if self.is_mock:
            def op():
                with self._lock:
                    return next((x.copy() for x in self._memory["lawyer_profiles"] if x["id"]==lawyer_id and x.get("verification_status")=="verified"),None)
            return await self._run(op)
        def op():
            res=self._service_client().table("lawyer_profiles").select("*").eq("id",lawyer_id).eq("verification_status","verified").limit(1).execute()
            return res.data[0] if res.data else None
        return await self._run(op)

    @staticmethod
    def _assert_case_storage_path(user_id: str, case_id: str, storage_path: str) -> None:
        expected_prefix = f"{user_id}/{case_id}/"
        if not storage_path.startswith(expected_prefix):
            raise HTTPException(404, "Document not found")
    async def signed_url(
        self, user: dict, case_id: str, storage_path: str, expires_in: int = 300
    ):
        self._assert_case_storage_path(user["id"], case_id, storage_path)
        if self.is_mock:
            return None
        # Storage SDK v2 does not inherit the PostgREST JWT configured above.
        # Use the backend key only after verifying case ownership and the exact object prefix.
        await self.get_case(user, case_id)
        def op():
            result=self._service_client().storage.from_("case-files").create_signed_url(
                storage_path, expires_in
            )
            return result.get("signedURL") or result.get("signedUrl")
        return await self._run(op)

    async def upload_case_document(self, user: dict, case_id: str, file_name: str,
                                   mime_type: str, content: bytes, sha256: str):
        if self.is_mock:
            raise HTTPException(503,"Private document storage requires Supabase; mock storage does not accept file uploads")
        # Defence in depth: only allow writes under a case that belongs to this JWT subject.
        await self.get_case(user, case_id)
        import re
        object_name=re.sub(r"[^A-Za-z0-9._-]","_",file_name)[:120] or "document"
        object_path=f'{user["id"]}/{case_id}/{uuid4()}/{object_name}'
        def op():
            # Storage is accessed with the backend key because the sync SDK client
            # does not propagate postgrest.auth(token) into the storage sub-client.
            # Owner check above and the unguessable object key scope this privileged operation.
            client=self._service_client()
            bucket=client.storage.from_("case-files")
            bucket.upload(object_path,content,{"content-type":mime_type,"upsert":"false"})
            try:
                row=client.table("case_documents").insert({
                    "case_id":case_id,"user_id":user["id"],
                    "storage_bucket":"case-files","storage_path":object_path,
                    "file_name":object_name,"mime_type":mime_type,
                    "size_bytes":len(content),"sha256":sha256
                }).execute().data[0]
                return row
            except Exception:
                try:
                    bucket.remove([object_path])
                except Exception:
                    pass
                raise
        return await self._run(op)


    async def report_target_exists(self, target_type: str, target_id: str) -> bool:
        if target_type not in {"post_id", "comment_id", "lawyer_id"}:
            return False
        if self.is_mock:
            def op():
                with self._lock:
                    if target_type == "post_id":
                        return any(
                            row.get("id") == target_id and row.get("moderation_status") == "approved"
                            for row in self._memory["community_posts"]
                        )
                    if target_type == "lawyer_id":
                        return any(
                            row.get("id") == target_id and row.get("verification_status") == "verified"
                            for row in self._memory["lawyer_profiles"]
                        )
                    comment = next((
                        row for row in self._memory["community_comments"]
                        if row.get("id") == target_id and row.get("moderation_status") == "approved"
                    ), None)
                    if not comment:
                        return False
                    return any(
                        post.get("id") == comment.get("post_id")
                        and post.get("moderation_status") == "approved"
                        for post in self._memory["community_posts"]
                    )
            return await self._run(op)

        def op():
            client = self._service_client()
            if target_type == "post_id":
                result = (
                    client.table("community_posts").select("id")
                    .eq("id", target_id).eq("moderation_status", "approved").limit(1).execute()
                )
                return bool(result.data)
            if target_type == "lawyer_id":
                result = (
                    client.table("lawyer_profiles").select("id")
                    .eq("id", target_id).eq("verification_status", "verified").limit(1).execute()
                )
                return bool(result.data)
            result = (
                client.table("community_comments").select("id,post_id")
                .eq("id", target_id).eq("moderation_status", "approved").limit(1).execute()
            )
            if not result.data:
                return False
            post_id = result.data[0]["post_id"]
            parent = (
                client.table("community_posts").select("id")
                .eq("id", post_id).eq("moderation_status", "approved").limit(1).execute()
            )
            return bool(parent.data)
        return await self._run(op)

    async def list_admin_reports(self, limit: int, offset: int, status: str | None):
        if self.is_mock:
            def op():
                with self._lock:
                    rows = [row.copy() for row in self._memory["reports"]]
                if status:
                    rows = [row for row in rows if row.get("status") == status]
                rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
                return rows[offset:offset + limit], len(rows)
            return await self._run(op)
        def op():
            query = self._service_client().table("reports").select("*", count="exact")
            if status:
                query = query.eq("status", status)
            result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
            return result.data, result.count or len(result.data)
        return await self._run(op)

    async def update_report_status(self, report_id: str, status: str):
        if self.is_mock:
            def op():
                with self._lock:
                    row = next((item for item in self._memory["reports"] if item["id"] == report_id), None)
                    if row:
                        row["status"] = status
                    return row.copy() if row else None
            return await self._run(op)
        def op():
            result = self._service_client().table("reports").update({"status": status}).eq("id", report_id).execute()
            return result.data[0] if result.data else None
        return await self._run(op)

    async def moderate_community_post(self, post_id: str, moderation_status: str):
        if self.is_mock:
            def op():
                with self._lock:
                    row = next((item for item in self._memory["community_posts"] if item["id"] == post_id), None)
                    if row:
                        row["moderation_status"] = moderation_status
                    return row.copy() if row else None
            return await self._run(op)
        def op():
            result = self._service_client().table("community_posts").update(
                {"moderation_status": moderation_status}
            ).eq("id", post_id).execute()
            return result.data[0] if result.data else None
        return await self._run(op)

    async def update_lawyer_verification(
        self, lawyer_id: str, status: str, verifier_id: str, notes: str | None
    ):
        if self.is_mock:
            def op():
                with self._lock:
                    row = next((item for item in self._memory["lawyer_profiles"] if item["id"] == lawyer_id), None)
                    if not row:
                        return None
                    row["verification_status"] = status
                    self._memory["lawyer_verifications"].append({
                        "id": str(uuid4()), "lawyer_id": lawyer_id,
                        "verifier_id": verifier_id, "status": status,
                        "notes": notes, "verified_at": utcnow(), "created_at": utcnow()
                    })
                    return row.copy()
            return await self._run(op)
        def op():
            client = self._service_client()
            updated = client.table("lawyer_profiles").update(
                {"verification_status": status}
            ).eq("id", lawyer_id).execute()
            if not updated.data:
                return None
            client.table("lawyer_verifications").insert({
                "lawyer_id": lawyer_id,
                "verifier_id": verifier_id,
                "status": status,
                "notes": notes,
                "verified_at": utcnow(),
            }).execute()
            return updated.data[0]
        return await self._run(op)
    async def moderate_community_comment(self, comment_id: str, moderation_status: str):
        if self.is_mock:
            def op():
                with self._lock:
                    row = next((item for item in self._memory["community_comments"] if item["id"] == comment_id), None)
                    if row:
                        row["moderation_status"] = moderation_status
                    return row.copy() if row else None
            return await self._run(op)
        def op():
            result = self._service_client().table("community_comments").update(
                {"moderation_status": moderation_status}
            ).eq("id", comment_id).execute()
            return result.data[0] if result.data else None
        return await self._run(op)



    async def approved_comments(self, post_id: str, limit: int, offset: int):
        if self.is_mock:
            def op():
                with self._lock:
                    rows = [
                        row.copy() for row in self._memory["community_comments"]
                        if row.get("post_id") == post_id and row.get("moderation_status") == "approved"
                    ]
                rows.sort(key=lambda row: row.get("created_at", ""))
                return rows[offset:offset + limit], len(rows)
            return await self._run(op)

        def op():
            result = (
                self._service_client().table("community_comments")
                .select("id,post_id,content,created_at,moderation_status", count="exact")
                .eq("post_id", post_id)
                .eq("moderation_status", "approved")
                .order("created_at")
                .range(offset, offset + limit - 1)
                .execute()
            )
            return result.data, result.count or len(result.data)
        return await self._run(op)

    async def cast_post_vote(self, user: dict, post_id: str, value: int):
        if value not in (-1, 1):
            raise HTTPException(422, "Vote must be -1 or 1")
        if self.is_mock:
            def op():
                with self._lock:
                    existing = next((
                        row for row in self._memory["votes"]
                        if row.get("user_id") == user["id"] and row.get("post_id") == post_id
                    ), None)
                    if existing:
                        existing["value"] = value
                        existing["created_at"] = utcnow()
                        return existing.copy()
                    row = {
                        "id": str(uuid4()), "user_id": user["id"],
                        "post_id": post_id, "comment_id": None,
                        "value": value, "created_at": utcnow()
                    }
                    self._memory["votes"].append(row)
                    return row.copy()
            return await self._run(op)

        def op():
            result = self._service_client().table("votes").upsert(
                {"user_id": user["id"], "post_id": post_id, "comment_id": None, "value": value},
                on_conflict="user_id,post_id"
            ).execute()
            return result.data[0] if result.data else None
        return await self._run(op)

    async def remove_post_vote(self, user: dict, post_id: str):
        if self.is_mock:
            def op():
                with self._lock:
                    before = len(self._memory["votes"])
                    self._memory["votes"] = [
                        row for row in self._memory["votes"]
                        if not (row.get("user_id") == user["id"] and row.get("post_id") == post_id)
                    ]
                    return before != len(self._memory["votes"])
            return await self._run(op)

        def op():
            result = (
                self._service_client().table("votes").delete()
                .eq("user_id", user["id"]).eq("post_id", post_id).execute()
            )
            return bool(result.data)
        return await self._run(op)
