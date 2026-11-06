-- Sanitized, backend-only community feed projection with real engagement counts.
-- Do not grant this view to anon/authenticated; FastAPI serves the approved projection.
create or replace view public.community_posts_public as
select
  p.id,
  p.title,
  p.content,
  p.category,
  case when p.anonymous then 'Anonymous'
       else coalesce(nullif(p.display_name,''),'Community member')
  end as display_name,
  p.anonymous,
  p.created_at,
  count(distinct c.id)::integer as comment_count,
  count(distinct v.id)::integer as vote_count
from public.community_posts p
left join public.community_comments c
  on c.post_id=p.id and c.moderation_status='approved'
left join public.votes v
  on v.post_id=p.id
where p.moderation_status='approved'
group by p.id,p.title,p.content,p.category,p.anonymous,p.display_name,p.created_at;

revoke all on public.community_posts_public from anon, authenticated;
grant select on public.community_posts_public to service_role;
