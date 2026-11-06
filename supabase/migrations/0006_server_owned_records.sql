-- Make server-controlled case sensitivity, demo classification and AI-generated records immutable
-- to ordinary authenticated clients. The FastAPI backend validates JWT ownership first and
-- uses the service-role key for these narrowly defined writes.

-- Cases: clients may read their own records but cannot create/update/delete them directly.
-- All case creation and state transitions go through the API.
drop policy if exists cases_owner_all on public.cases;
create policy cases_owner_select on public.cases
for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.cases from anon, authenticated;
grant select on public.cases to authenticated;

-- Messages: user messages and assistant messages are both written by the backend after
-- the owner-scoped API check. Direct clients may only read their own conversation.
drop policy if exists messages_owner_all on public.case_messages;
create policy messages_owner_select on public.case_messages
for select to authenticated
using (user_id = auth.uid() and public.owns_case(case_id));
revoke insert, update, delete on public.case_messages from anon, authenticated;
grant select on public.case_messages to authenticated;

-- Facts, assessments, citations and generated drafts are server-authored records.
drop policy if exists facts_owner_all on public.case_facts;
create policy facts_owner_select on public.case_facts
for select to authenticated
using (user_id = auth.uid() and public.owns_case(case_id));
revoke insert, update, delete on public.case_facts from anon, authenticated;
grant select on public.case_facts to authenticated;

drop policy if exists assessments_owner_insert on public.case_assessments;
drop policy if exists assessments_owner_read on public.case_assessments;
create policy assessments_owner_read on public.case_assessments
for select to authenticated
using (user_id = auth.uid() and public.owns_case(case_id));
revoke insert, update, delete on public.case_assessments from anon, authenticated;
grant select on public.case_assessments to authenticated;

drop policy if exists citations_owner_insert on public.legal_citations;
drop policy if exists citations_owner_read on public.legal_citations;
create policy citations_owner_read on public.legal_citations
for select to authenticated
using (case_id is not null and public.owns_case(case_id));
revoke insert, update, delete on public.legal_citations from anon, authenticated;
grant select on public.legal_citations to authenticated;

drop policy if exists drafts_owner_all on public.generated_drafts;
create policy drafts_owner_read on public.generated_drafts
for select to authenticated
using (user_id = auth.uid() and (case_id is null or public.owns_case(case_id)));
revoke insert, update, delete on public.generated_drafts from anon, authenticated;
grant select on public.generated_drafts to authenticated;

-- Case document metadata is inserted by the backend only after a private Storage upload.
drop policy if exists case_documents_owner_all on public.case_documents;
create policy case_documents_owner_read on public.case_documents
for select to authenticated
using (user_id = auth.uid() and public.owns_case(case_id));
revoke insert, update, delete on public.case_documents from anon, authenticated;
grant select on public.case_documents to authenticated;

-- Do not let direct Supabase reads reveal author UUIDs from anonymous community posts,
-- lawyer profiles or endorsements. The API returns a sanitized projection.
revoke select on public.community_posts from anon, authenticated;
revoke select on public.community_comments from anon, authenticated;
revoke select on public.lawyer_profiles from anon, authenticated;
revoke select on public.endorsements from anon, authenticated;

-- Community write operations remain available only for pending submissions and are
-- exposed through the API, which strips author identifiers from public responses.
grant insert on public.community_posts to authenticated;
grant insert on public.community_comments to authenticated;
grant insert on public.lawyer_profiles to authenticated;
grant insert on public.endorsements to authenticated;

-- Public content is served only through the backend API. RLS remains enabled as a
-- second layer for all user-owned/private tables.
