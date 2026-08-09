-- Open the L2 Board and the request log to the whole class.
--
-- 20260815000000 gated both behind tasks.view_all / requests.view_all and gave
-- neither to Member, so the two tabs were leadership-only. That was the wrong
-- read of what they are for: the board exists so everyone can see what each
-- committee is up to, and the request log is the paper trail that stops work
-- getting lost in group chats. Neither works if most of the class cannot open
-- it.
--
-- Reading is not writing, and nothing about writing changes here:
--
--   * adding or editing a task still needs tasks.manage_committee for that
--     committee, or tasks.manage_all;
--   * filing a request still needs membership of the committee it is filed on
--     behalf of, or requests.manage_all;
--   * answering one still belongs to the committee it was sent to, or to
--     requests.manage_all.
--
-- Class Advisors are deliberately left out. Their bundle is a deliberate
-- minimum — class_officers.view plus notifications.view_own — and they are not
-- in the operational loop this board describes.

insert into public.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from public.roles r
cross join public.permissions p
where r.slug = 'member'
  and p.key in ('tasks.view_all', 'requests.view_all')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- Hold the paper trail at the privilege layer too
-- ---------------------------------------------------------------------------

-- 20260815000000 granted only select, insert and update on committee_requests,
-- but the shared project carries default privileges that hand `all` on new
-- public tables to `authenticated`, so DELETE arrived anyway.
--
-- Nothing can use it today: RLS is enabled and there is no policy covering
-- DELETE, so Postgres refuses. That makes this defence in depth rather than a
-- fix — but the guarantee "a request is a permanent record" should not rest on
-- the continued absence of a policy nobody has written yet.
revoke delete on public.committee_requests from authenticated;
