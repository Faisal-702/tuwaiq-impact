-- Supabase Storage bucket for project media.
--
-- Objects are stored under unguessable UUID paths. The bucket is public-read
-- so published media can be served from Supabase's CDN; uploads are only
-- possible through short-lived signed upload URLs that the server issues to
-- an authenticated administrator. No storage policies grant anon writes.
--
-- Guarded so the same migration set also runs against plain PostgreSQL
-- (local development without the Supabase storage schema).

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, allowed_mime_types)
    values (
      'project-media',
      'project-media',
      true,
      array[
        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
        'video/mp4', 'video/webm', 'video/quicktime',
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    )
    on conflict (id) do update
      set public = excluded.public,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
