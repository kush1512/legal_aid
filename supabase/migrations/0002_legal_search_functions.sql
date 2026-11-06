-- Hybrid legal retrieval RPCs. Validity is filtered as of an explicit date.
-- Historical versions can be retrieved by requesting an as_of_date within their effective period.
create or replace function public.match_legal_chunks(
  query_embedding extensions.vector(384),
  match_count int default 10,
  filter_category text default null,
  filter_jurisdiction text default 'IN',
  as_of_date date default current_date
)
returns table (
  id uuid, legal_document_id uuid, act_name text, section_label text,
  heading text, content text, source_url text, verification_status text,
  effective_from date, effective_to date, score double precision
)
language sql stable
as $$
  select c.id, d.id, coalesce(c.act_name,d.act_name), c.section_label,
         c.heading, c.content, d.source_url, d.verification_status::text,
         d.effective_from, d.effective_to,
         1 - (c.embedding <=> query_embedding) as score
  from public.legal_chunks c
  join public.legal_documents d on d.id=c.legal_document_id
  where c.embedding is not null
    and d.jurisdiction in ('IN',filter_jurisdiction)
    and d.verification_status in ('verified','historical')
    and (d.effective_from is null or d.effective_from <= as_of_date)
    and (d.effective_to is null or d.effective_to >= as_of_date)
    and (d.verification_status <> 'historical' or d.effective_to is not null)
    and (filter_category is null or d.category::text=filter_category)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

create or replace function public.search_legal_keyword(
  search_text text,
  match_count int default 10,
  filter_category text default null,
  filter_jurisdiction text default 'IN',
  as_of_date date default current_date
)
returns table (
  id uuid, legal_document_id uuid, act_name text, section_label text,
  heading text, content text, source_url text, verification_status text,
  effective_from date, effective_to date, score double precision
)
language sql stable
as $$
  select c.id, d.id, coalesce(c.act_name,d.act_name), c.section_label,
         c.heading, c.content, d.source_url, d.verification_status::text,
         d.effective_from, d.effective_to,
         ts_rank_cd(c.keyword_text, websearch_to_tsquery('simple', search_text))::double precision as score
  from public.legal_chunks c
  join public.legal_documents d on d.id=c.legal_document_id
  where c.keyword_text @@ websearch_to_tsquery('simple', search_text)
    and d.jurisdiction in ('IN',filter_jurisdiction)
    and d.verification_status in ('verified','historical')
    and (d.effective_from is null or d.effective_from <= as_of_date)
    and (d.effective_to is null or d.effective_to >= as_of_date)
    and (d.verification_status <> 'historical' or d.effective_to is not null)
    and (filter_category is null or d.category::text=filter_category)
  order by ts_rank_cd(c.keyword_text, websearch_to_tsquery('simple', search_text)) desc
  limit greatest(1, least(match_count, 50));
$$;

-- Legal KB is server-side. The service-role key never leaves the backend.
revoke all on function public.match_legal_chunks(extensions.vector,int,text,text,date) from public;
revoke all on function public.search_legal_keyword(text,int,text,text,date) from public;
grant execute on function public.match_legal_chunks(extensions.vector,int,text,text,date) to service_role;
grant execute on function public.search_legal_keyword(text,int,text,text,date) to service_role;
