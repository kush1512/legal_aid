-- Server-controlled synthetic demo marker. Real user cases default to sensitive.
alter table public.cases
  add column if not exists synthetic_demo boolean not null default false;

-- Every pre-existing row predates the server-controlled demo workflow; mark it as real/sensitive.
update public.cases set sensitive=true, synthetic_demo=false;

