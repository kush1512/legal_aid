-- Per-case privacy preference. Existing cases default to the protected state (false means
-- private mode is off; sensitive=true remains an independent hard block).
alter table public.cases
  add column if not exists private_conversation boolean not null default false;

comment on column public.cases.private_conversation is
  'When true, the API must not send case content to any external LLM or speech provider.';
