-- Stop campers writing their own profiles.status.
--
-- `grant update (full_name, status) on public.profiles to authenticated` in
-- 20260807020000 let any signed-in camper set their own status to any value,
-- because the update policy admits a camper to their own row and the column
-- was in the grant. Nothing in the product asks a camper to do that:
--
--   * leave_campsite sets status = 'left' server-side, as the service role,
--     which is unaffected by grants to `authenticated`;
--   * staff changes go through /admin/users, also server-side;
--   * the settings page never writes it.
--
-- Meanwhile the value is read as though it were trustworthy — transfer_admin
-- refuses a recipient whose status is not 'active' — so leaving it writable
-- lets a camper answer a question the server is asking about them.
--
-- full_name stays writable: it is the camper's own name, and the settings
-- page is a reasonable place to correct it.

revoke update (status) on public.profiles from authenticated;
