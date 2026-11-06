-- Reports are validated by FastAPI against visible targets and created through service_role.
-- Endorsements have no public API yet; keep the table unavailable to direct clients until
-- an authenticated, rate-limited endpoint and moderation policy are added.
revoke select, insert, update, delete on public.reports from anon, authenticated;
drop policy if exists reports_owner_insert on public.reports;
drop policy if exists reports_reporter_read on public.reports;

revoke select, insert, update, delete on public.endorsements from anon, authenticated;
drop policy if exists endorsements_public_read on public.endorsements;
drop policy if exists endorsements_owner_insert on public.endorsements;
