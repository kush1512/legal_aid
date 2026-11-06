-- Legal Aid initial Supabase schema (PostgreSQL 15+)
-- Apply this file in Supabase SQL Editor or as a migration.
-- The backend must use verified Supabase JWT identity; never trust client user_id.
create extension if not exists pgcrypto;
create schema if not exists extensions;\ncreate extension if not exists vector with schema extensions;
create extension if not exists pg_trgm;

create type public.case_category as enum ('property_real_estate','marriage_family','digital_fraud_cybercrime','personal_safety_privacy');
create type public.case_status as enum ('intake','needs_information','analysed','closed');
create type public.message_role as enum ('user','assistant','system');
create type public.fact_source as enum ('user_provided','document','ai_inference');
create type public.legal_source_status as enum ('verified','unverified','historical','superseded');
create type public.lawyer_verification_status as enum ('pending','verified','rejected');
create type public.document_type as enum ('legal_notice','complaint','reply','application','incident_summary','evidence_checklist');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text, preferred_language text not null default 'en',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.cases (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, category public.case_category not null,
 status public.case_status not null default 'intake',
 jurisdiction jsonb not null default '{"country":"IN"}'::jsonb,
 preferred_language text not null default 'en',
 sensitive boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index cases_owner_updated_idx on public.cases(user_id,updated_at desc);
create index cases_category_status_idx on public.cases(category,status);

create table public.case_messages (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role public.message_role not null, content text not null,
 input_mode text not null default 'text' check (input_mode in ('text','voice_transcription')),
 ai_provider text, ai_model text, ai_is_mock boolean,
 created_at timestamptz not null default now()
);
create index case_messages_case_created_idx on public.case_messages(case_id,created_at);

create table public.case_facts (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 fact_key text not null, value jsonb not null, source public.fact_source not null,
 confidence numeric(4,3) check (confidence between 0 and 1),
 verified boolean not null default false, created_at timestamptz not null default now()
);
create index case_facts_case_idx on public.case_facts(case_id);

create table public.case_parties (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text, role text, description text, is_user boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.case_timeline (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event_date date, event_text text not null,
 source public.fact_source not null default 'user_provided',
 created_at timestamptz not null default now()
);

-- Private Storage bucket: case-files. Object key: {auth.uid()}/{case_id}/{uuid}/{filename}
create table public.case_documents (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 storage_bucket text not null default 'case-files',
 storage_path text not null unique, file_name text not null,
 mime_type text not null, size_bytes bigint not null check(size_bytes > 0),
 sha256 text, created_at timestamptz not null default now()
);
create index case_documents_owner_case_idx on public.case_documents(user_id,case_id);

create table public.legal_documents (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 document_type text not null check(document_type in ('act','amendment','rule','regulation','judgment','notification','other')),
 act_name text, jurisdiction text not null default 'IN',
 category public.case_category, source_url text not null, source_name text not null,
 publication_date date, effective_from date, effective_to date,
 version_label text, amendment_details text,
 verification_status public.legal_source_status not null default 'unverified',
 verified_at timestamptz, verified_by text, language text not null default 'en',
 content_sha256 text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index legal_documents_act_idx on public.legal_documents(act_name);
create index legal_documents_validity_idx on public.legal_documents(effective_from,effective_to);
create index legal_documents_category_idx on public.legal_documents(category);

-- intfloat/multilingual-e5-small outputs 384 dimensions. Model changes require
-- re-embedding all chunks and a compatible vector column/index migration.
create table public.legal_chunks (
 id uuid primary key default gen_random_uuid(),
 legal_document_id uuid not null references public.legal_documents(id) on delete cascade,
 parent_chunk_id uuid references public.legal_chunks(id) on delete set null,
 act_name text, chapter_label text, section_label text, subsection_label text,
 paragraph_label text, heading text, content text not null,
 keyword_text tsvector generated always as
  (to_tsvector('simple',coalesce(heading,'') || ' ' || coalesce(content,''))) stored,
 embedding vector(384), ordinal integer not null default 0,
 language text not null default 'en', created_at timestamptz not null default now()
);
create index legal_chunks_document_idx on public.legal_chunks(legal_document_id,ordinal);
create index legal_chunks_keyword_idx on public.legal_chunks using gin(keyword_text);
create index legal_chunks_embedding_idx on public.legal_chunks using hnsw(embedding vector_cosine_ops);

create table public.case_assessments (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cases(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 summary text not null, assessment jsonb not null,
 model_provider text not null, model_name text not null, model_version text,
 is_mock boolean not null default false, retrieved_source_ids uuid[] not null default '{}',
 created_at timestamptz not null default now()
);
create index case_assessments_case_created_idx on public.case_assessments(case_id,created_at desc);

create table public.legal_citations (
 id uuid primary key default gen_random_uuid(),
 case_id uuid references public.cases(id) on delete cascade,
 assessment_id uuid references public.case_assessments(id) on delete cascade,
 legal_document_id uuid not null references public.legal_documents(id),
 legal_chunk_id uuid references public.legal_chunks(id),
 exact_reference text not null, cited_excerpt text not null,
 applicability text not null default 'uncertain'
  check(applicability in ('likely','possible','uncertain','not_applicable')),
 verification_status public.legal_source_status not null,
 created_at timestamptz not null default now()
);

create table public.generated_drafts (
 id uuid primary key default gen_random_uuid(),
 case_id uuid references public.cases(id) on delete set null,
 user_id uuid not null references auth.users(id) on delete cascade,
 document_type public.document_type not null, title text not null, content text not null,
 placeholders text[] not null default '{}', citation_ids uuid[] not null default '{}',
 review_required boolean not null default true check(review_required),
 model_provider text not null, model_name text not null, is_mock boolean not null default false,
 created_at timestamptz not null default now()
);

create table public.community_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, content text not null, category public.case_category not null,
 anonymous boolean not null default false, display_name text,
 moderation_status text not null default 'pending'
  check(moderation_status in ('pending','approved','rejected','removed')),
 created_at timestamptz not null default now()
);
create index community_posts_public_idx on public.community_posts(moderation_status,created_at desc);
create table public.community_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 content text not null,
 moderation_status text not null default 'pending'
  check(moderation_status in ('pending','approved','rejected','removed')),
 created_at timestamptz not null default now()
);
create table public.votes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references public.community_posts(id) on delete cascade,
 comment_id uuid references public.community_comments(id) on delete cascade,
 value smallint not null check(value in (-1,1)), created_at timestamptz not null default now(),
 check(num_nonnulls(post_id,comment_id)=1),
 unique(user_id,post_id), unique(user_id,comment_id)
);

create table public.lawyer_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 display_name text not null, bio text, bar_council_enrolment text,
 jurisdictions text[] not null default '{}',
 practice_areas public.case_category[] not null default '{}',
 languages text[] not null default '{}', city text, state text,
 verification_status public.lawyer_verification_status not null default 'pending',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.lawyer_verifications (
 id uuid primary key default gen_random_uuid(),
 lawyer_id uuid not null references public.lawyer_profiles(id) on delete cascade,
 verifier_id uuid references auth.users(id) on delete set null,
 status public.lawyer_verification_status not null default 'pending',
 evidence_storage_path text, notes text, verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.endorsements (
 id uuid primary key default gen_random_uuid(),
 lawyer_id uuid not null references public.lawyer_profiles(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 endorsement text, created_at timestamptz not null default now(),
 unique(lawyer_id,user_id)
);
create table public.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid references auth.users(id) on delete set null,
 post_id uuid references public.community_posts(id) on delete cascade,
 comment_id uuid references public.community_comments(id) on delete cascade,
 lawyer_id uuid references public.lawyer_profiles(id) on delete cascade,
 reason text not null, details text,
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 check(num_nonnulls(post_id,comment_id,lawyer_id)=1)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger cases_updated_at before update on public.cases for each row execute function public.set_updated_at();
create trigger legal_documents_updated_at before update on public.legal_documents for each row execute function public.set_updated_at();
create trigger lawyer_profiles_updated_at before update on public.lawyer_profiles for each row execute function public.set_updated_at();

create or replace function public.owns_case(target_case_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.cases c where c.id=target_case_id and c.user_id=auth.uid()) $$;
revoke all on function public.owns_case(uuid) from public;
grant execute on function public.owns_case(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_messages enable row level security;
alter table public.case_facts enable row level security;
alter table public.case_parties enable row level security;
alter table public.case_timeline enable row level security;
alter table public.case_documents enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_chunks enable row level security;
alter table public.legal_citations enable row level security;
alter table public.case_assessments enable row level security;
alter table public.generated_drafts enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.votes enable row level security;
alter table public.lawyer_profiles enable row level security;
alter table public.lawyer_verifications enable row level security;
alter table public.endorsements enable row level security;
alter table public.reports enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_self_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy cases_owner_all on public.cases for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy messages_owner_all on public.case_messages for all to authenticated using(user_id=auth.uid() and public.owns_case(case_id)) with check(user_id=auth.uid() and public.owns_case(case_id));
create policy facts_owner_all on public.case_facts for all to authenticated using(user_id=auth.uid() and public.owns_case(case_id)) with check(user_id=auth.uid() and public.owns_case(case_id));
create policy parties_owner_all on public.case_parties for all to authenticated using(user_id=auth.uid() and public.owns_case(case_id)) with check(user_id=auth.uid() and public.owns_case(case_id));
create policy timeline_owner_all on public.case_timeline for all to authenticated using(user_id=auth.uid() and public.owns_case(case_id)) with check(user_id=auth.uid() and public.owns_case(case_id));
create policy case_documents_owner_all on public.case_documents for all to authenticated using(user_id=auth.uid() and public.owns_case(case_id)) with check(user_id=auth.uid() and public.owns_case(case_id));
create policy assessments_owner_read on public.case_assessments for select to authenticated using(user_id=auth.uid() and public.owns_case(case_id));
create policy drafts_owner_all on public.generated_drafts for all to authenticated using(user_id=auth.uid() and (case_id is null or public.owns_case(case_id))) with check(user_id=auth.uid() and (case_id is null or public.owns_case(case_id)));
create policy citations_owner_read on public.legal_citations for select to authenticated using(case_id is null or public.owns_case(case_id));
create policy legal_documents_authenticated_read on public.legal_documents for select to authenticated using(true);
create policy legal_chunks_authenticated_read on public.legal_chunks for select to authenticated using(true);
create policy community_posts_public_read on public.community_posts for select to anon,authenticated using(moderation_status='approved');
create policy community_posts_owner_insert on public.community_posts for insert to authenticated with check(user_id=auth.uid());
create policy community_posts_owner_update on public.community_posts for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy community_comments_public_read on public.community_comments for select to anon,authenticated using(moderation_status='approved' and exists(select 1 from public.community_posts p where p.id=post_id and p.moderation_status='approved'));
create policy community_comments_owner_insert on public.community_comments for insert to authenticated with check(user_id=auth.uid());
create policy community_comments_owner_update on public.community_comments for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy votes_owner_all on public.votes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy lawyers_verified_public_read on public.lawyer_profiles for select to anon,authenticated using(verification_status='verified' or user_id=auth.uid());
create policy lawyers_owner_insert on public.lawyer_profiles for insert to authenticated with check(user_id=auth.uid());
create policy lawyers_owner_update on public.lawyer_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy lawyer_verifications_owner_read on public.lawyer_verifications for select to authenticated using(exists(select 1 from public.lawyer_profiles lp where lp.id=lawyer_id and lp.user_id=auth.uid()));
create policy endorsements_public_read on public.endorsements for select to anon,authenticated using(true);
create policy endorsements_owner_insert on public.endorsements for insert to authenticated with check(user_id=auth.uid());
create policy reports_owner_insert on public.reports for insert to authenticated with check(reporter_id=auth.uid());
create policy reports_reporter_read on public.reports for select to authenticated using(reporter_id=auth.uid());

-- Create a private Storage bucket named case-files in Supabase (public=false).
-- Storage object path convention: {auth.uid()}/{case_id}/{uuid}/{safe_filename}
-- Storage policies must restrict first path segment to auth.uid(); API must also validate case ownership
-- before issuing a short-lived signed URL. Never expose service-role keys to browser clients.
