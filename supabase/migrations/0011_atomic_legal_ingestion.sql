-- Atomic legal document + chunk ingestion.
create unique index if not exists legal_documents_source_checksum_uidx
  on public.legal_documents(source_url, content_sha256)
  where content_sha256 is not null;

create or replace function public.ingest_legal_document(p_document jsonb, p_chunks jsonb)
returns table (legal_document_id uuid, inserted boolean)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_document_id uuid;
  v_chunk jsonb;
begin
  if jsonb_typeof(p_document) <> 'object' then
    raise exception 'p_document must be a JSON object';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'p_chunks must be a non-empty JSON array';
  end if;
  if coalesce(p_document->>'verification_status', 'unverified') <> 'unverified'
     or p_document->>'verified_at' is not null
     or p_document->>'verified_by' is not null then
    raise exception 'Ingestion may only create unverified legal documents';
  end if;

  insert into public.legal_documents (
    title, document_type, act_name, jurisdiction, category, source_url,
    source_name, publication_date, effective_from, effective_to,
    version_label, amendment_details, verification_status, verified_at,
    verified_by, language, content_sha256
  ) values (
    p_document->>'title', p_document->>'document_type', p_document->>'act_name',
    coalesce(p_document->>'jurisdiction', 'IN'),
    nullif(p_document->>'category', '')::public.case_category,
    p_document->>'source_url', p_document->>'source_name',
    nullif(p_document->>'publication_date', '')::date,
    nullif(p_document->>'effective_from', '')::date,
    nullif(p_document->>'effective_to', '')::date,
    p_document->>'version_label', p_document->>'amendment_details',
    'unverified', null, null, coalesce(p_document->>'language', 'en'),
    p_document->>'content_sha256'
  )
  on conflict (source_url, content_sha256)
    where content_sha256 is not null
    do nothing
  returning id into v_document_id;

  if v_document_id is null then
    select d.id into v_document_id from public.legal_documents d
    where d.source_url = p_document->>'source_url'
      and d.content_sha256 = p_document->>'content_sha256'
    limit 1;
    return query select v_document_id, false;
    return;
  end if;

  for v_chunk in select value from jsonb_array_elements(p_chunks)
  loop
    insert into public.legal_chunks (
      legal_document_id, act_name, chapter_label, section_label,
      subsection_label, paragraph_label, heading, content, embedding,
      ordinal, language
    ) values (
      v_document_id, v_chunk->>'act_name', v_chunk->>'chapter_label',
      v_chunk->>'section_label', v_chunk->>'subsection_label',
      v_chunk->>'paragraph_label', v_chunk->>'heading', v_chunk->>'content',
      case when v_chunk->'embedding' is null or v_chunk->'embedding' = 'null'::jsonb
        then null else (v_chunk->'embedding')::text::extensions.vector end,
      coalesce((v_chunk->>'ordinal')::integer, 0),
      coalesce(v_chunk->>'language', 'en')
    );
  end loop;
  return query select v_document_id, true;
end;
$$;

revoke all on function public.ingest_legal_document(jsonb, jsonb) from public;
revoke all on function public.ingest_legal_document(jsonb, jsonb) from anon, authenticated;
grant execute on function public.ingest_legal_document(jsonb, jsonb) to service_role;
