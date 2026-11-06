-- Auditable human review workflow for ingested legal sources.
create table if not exists public.legal_document_verification_events (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete restrict,
  reviewer_id uuid not null,
  previous_status text not null,
  resulting_status text not null,
  decision text not null check (decision in ('verified', 'historical', 'rejected')),
  rationale text not null check (char_length(trim(rationale)) >= 20),
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists legal_document_verification_events_document_idx
  on public.legal_document_verification_events (legal_document_id, created_at desc);

alter table public.legal_document_verification_events enable row level security;
revoke all on public.legal_document_verification_events from public, anon, authenticated;
grant select on public.legal_document_verification_events to service_role;

create or replace function public.review_legal_document(
  p_document_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_rationale text,
  p_checklist jsonb
)
returns table (
  event_id uuid,
  legal_document_id uuid,
  decision text,
  resulting_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_document public.legal_documents%rowtype;
  v_resulting_status text;
  v_event_id uuid;
  v_created_at timestamptz;
  v_checklist_key text;
  v_required_checks text[] := array[
    'official_source_confirmed',
    'document_identity_confirmed',
    'content_integrity_confirmed',
    'jurisdiction_confirmed',
    'effective_dates_reviewed',
    'amendments_reviewed',
    'legal_applicability_reviewed'
  ];
begin
  if p_reviewer_id is null then
    raise exception 'A reviewer ID is required';
  end if;
  if p_decision not in ('verified', 'historical', 'rejected') then
    raise exception 'Unsupported legal document review decision';
  end if;
  if p_rationale is null or char_length(trim(p_rationale)) < 20
     or char_length(p_rationale) > 2000 then
    raise exception 'Review rationale must contain 20 to 2000 characters';
  end if;
  if p_checklist is null or jsonb_typeof(p_checklist) is distinct from 'object' then
    raise exception 'A review checklist object is required';
  end if;

  if p_decision in ('verified', 'historical') then
    foreach v_checklist_key in array v_required_checks loop
      if p_checklist->v_checklist_key is distinct from 'true'::jsonb then
        raise exception 'All legal verification checklist items must be true';
      end if;
    end loop;
  end if;

  select * into v_document
  from public.legal_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Legal document not found';
  end if;
  if v_document.verification_status <> 'unverified' then
    raise exception 'Only unverified legal documents can be reviewed';
  end if;
  if p_decision = 'historical' and v_document.effective_to is null then
    raise exception 'Historical documents require an effective_to date';
  end if;

  v_resulting_status := case
    when p_decision = 'verified' then 'verified'
    when p_decision = 'historical' then 'historical'
    else 'unverified'
  end;

  if p_decision in ('verified', 'historical') then
    update public.legal_documents
    set verification_status = v_resulting_status,
        verified_at = now(),
        verified_by = p_reviewer_id
    where id = p_document_id;
  end if;

  insert into public.legal_document_verification_events (
    legal_document_id, reviewer_id, previous_status, resulting_status,
    decision, rationale, checklist
  ) values (
    p_document_id, p_reviewer_id, v_document.verification_status,
    v_resulting_status, p_decision, trim(p_rationale), p_checklist
  )
  returning id, public.legal_document_verification_events.created_at
  into v_event_id, v_created_at;

  return query select v_event_id, p_document_id, p_decision,
                      v_resulting_status, v_created_at;
end;
$$;

revoke all on function public.review_legal_document(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.review_legal_document(uuid, uuid, text, text, jsonb)
  to service_role;
