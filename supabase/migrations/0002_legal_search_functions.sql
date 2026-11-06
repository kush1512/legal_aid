-- Hybrid legal retrieval RPCs. These functions expose only indexed public legal text.
create or replace function public.match_legal_chunks(
  query_embedding extensions.vector(384),
  match_count int default 10,
  filter_category text default null,
  filter_jurisdiction text default 'IN'
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
    and d.jurisdiction=filter_jurisdiction
    and d.verification_status in ('verified','historical')
    and (filter_category is null or d.category::text=filter_category)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

create or replace function public.search_legal_keyword(
  search_text text,
  match_count int default 10,
  filter_category text default null,
  filter_jurisdiction text default 'IN'
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
    and d.jurisdiction=filter_jurisdiction
    and d.verification_status in ('verified','historical')
    and (filter_category is null or d.category::text=filter_category)
  order by ts_rank_cd(c.keyword_text, websearch_to_tsquery('simple', search_text)) desc
  limit greatest(1, least(match_count, 50));
$$;

-- The backend uses a server-side service role for KB ingestion/search only.
-- Do not grant RPC execution to anon/authenticated until a public access policy is reviewed.
revoke all on function public.match_legal_chunks(extensions.vector,int,text,text) from public;
revoke all on function public.search_legal_keyword(text,int,text,text) from public;
grant execute on function public.match_legal_chunks(vector,int,text,text) to service_role;
grant execute on function public.search_legal_keyword(text,int,text,text) to service_role;
