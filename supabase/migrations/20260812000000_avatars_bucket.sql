-- Avatar storage.
--
-- Avatars go to Supabase Storage rather than through the backend's
-- ObjectStorage abstraction, which is a local-disk implementation intended for
-- anonymous feedback attachments. Two reasons: the browser can upload straight
-- to Storage without a multipart endpoint (apiFetch only speaks JSON), and an
-- avatar needs a durable public URL that survives a backend restart, which a
-- file:// path under backend/.local-storage does not.
--
-- Objects are keyed by owner: "<user-id>/avatar.<ext>". The policies below
-- read that first path segment, so a camper can only write inside their own
-- folder no matter what filename the client asks for.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    -- Public read. Avatars appear next to names all over the product, and
    -- signed URLs would mean a round trip per face on every roster.
    true,
    2 * 1024 * 1024,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists "avatars are readable by anyone" on storage.objects;
create policy "avatars are readable by anyone"
    on storage.objects
    for select
    using (bucket_id = 'avatars');

-- The owner check is on the first path segment, so "<someone-else>/avatar.png"
-- is rejected regardless of what the client sends.
drop policy if exists "campers upload their own avatar" on storage.objects;
create policy "campers upload their own avatar"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "campers replace their own avatar" on storage.objects;
create policy "campers replace their own avatar"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

drop policy if exists "campers remove their own avatar" on storage.objects;
create policy "campers remove their own avatar"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
