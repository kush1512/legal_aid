-- Case-scoped citation ownership for generated assessments.
alter table public.legal_citations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists citations_owner_insert on public.legal_citations;
create policy citations_owner_insert on public.legal_citations
for insert to authenticated
with check (
  user_id=auth.uid()
  and case_id is not null
  and public.owns_case(case_id)
);
