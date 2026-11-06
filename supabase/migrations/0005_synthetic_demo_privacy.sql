-- Server-controlled synthetic demo marker. Real user cases default to sensitive.
alter table public.cases
  add column if not exists synthetic_demo boolean not null default false;

-- Existing records are treated as real/sensitive; no row is backfilled as demo.
update public.cases set sensitive=true, synthetic_demo=false
where synthetic_demo is distinct from false;

