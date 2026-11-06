-- Keep community content writes and votes behind FastAPI validation/moderation checks.
-- The backend derives the author from the verified JWT and uses service_role only after
-- validating ownership, approved-parent status, and input schemas.

revoke insert, update, delete on public.community_posts from anon, authenticated;
revoke insert, update, delete on public.community_comments from anon, authenticated;
revoke select, insert, update, delete on public.votes from anon, authenticated;
revoke insert, update, delete on public.lawyer_profiles from anon, authenticated;

-- Remove now-unused end-user write policies. Service-role operations bypass RLS.
drop policy if exists community_posts_owner_insert on public.community_posts;
drop policy if exists community_comments_owner_insert on public.community_comments;
drop policy if exists votes_owner_all on public.votes;
drop policy if exists lawyers_owner_insert on public.lawyer_profiles;

-- Public client reads remain revoked. Read operations are served through sanitized API projections.
