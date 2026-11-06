-- Keep rejected documents non-searchable and out of the pending review queue.
-- Their verification_status intentionally remains 'unverified'.
alter table public.legal_documents
  add column if not exists review_decision text
  check (review_decision in ('verified', 'historical', 'rejected'));

create index if not exists legal_documents_review_queue_idx
  on public.legal_documents (created_at desc)
  where verification_status = 'unverified'
    and review_decision is null;

create or replace function public.set_legal_document_review_decision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.legal_documents
  set review_decision = new.decision
  where id = new.legal_document_id;
  return new;
end;
$$;

drop trigger if exists legal_document_review_decision_trigger
  on public.legal_document_verification_events;

create trigger legal_document_review_decision_trigger
after insert on public.legal_document_verification_events
for each row
execute function public.set_legal_document_review_decision();

revoke all on function public.set_legal_document_review_decision()
  from public, anon, authenticated, service_role;
