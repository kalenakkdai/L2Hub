-- Durable object storage for the backend's ObjectStorage abstraction.
--
-- Everything written through STORAGE_BACKEND=supabase lands here: Note Taker
-- meeting recordings, anonymous feedback attachments, and whatever else goes
-- through `opaque_storage_key`. The alternative in production was the
-- container's own filesystem, which is wiped on every deploy and not shared
-- between tasks — recordings of students that nobody could retrieve and
-- nobody was tracking.
--
-- Unlike `avatars`, this bucket is PRIVATE. Objects are reached one of two
-- ways, both mediated by the backend: it reads them with the secret key, or
-- it hands out a short-lived signed URL. The browser never gets a durable
-- public link to a recording.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'attachments',
    'attachments',
    -- Private. A meeting recording is not an avatar.
    false,
    -- 50 MB. A long meeting at Opus-in-webm bitrates lands well under this,
    -- and the ceiling stops a malformed upload from filling the project quota.
    50 * 1024 * 1024,
    array[
        'audio/webm',
        'audio/ogg',
        'audio/wav',
        'audio/x-wav',
        'audio/mpeg',
        'audio/mp4',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/pdf',
        'text/plain'
    ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
--
-- Deliberately none. RLS on storage.objects denies by default, so with no
-- policy naming this bucket, neither `anon` nor `authenticated` can read,
-- write, or list it — which is exactly right. The only client is the backend,
-- and it uses the secret key, which bypasses RLS. Authorization for these
-- objects is decided by `require_permission` on the API routes, where the
-- rules can consider who owns a note session; a storage policy could only see
-- the path.
--
-- If the browser ever needs to upload here directly, that is the moment to add
-- an insert policy scoped to the uploader's own folder — the way `avatars`
-- does it — and not before.

-- Retract any policy an earlier hand-run experiment may have left behind, so
-- the deny-by-default posture above is what actually holds.
drop policy if exists "attachments are readable by anyone" on storage.objects;
drop policy if exists "attachments are writable by anyone" on storage.objects;
