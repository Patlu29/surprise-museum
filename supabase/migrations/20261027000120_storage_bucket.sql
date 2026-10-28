-- Surprise Museum: the private photo bucket. Idempotent.
--
-- One private bucket, JPEG only, 2 MiB per object (ADR 0004). There are deliberately NO policies
-- on storage.objects for this bucket: Supabase enables RLS on storage.objects, so without a
-- policy anon and authenticated can neither list, read, write nor delete. Reads use signed URLs
-- (1 hour) and writes use signed upload URLs (2 hours), both issued by Edge Functions as
-- service_role. The migration role does not own storage.objects, so RLS is not altered here.
--
-- Object keys: <museum_id>/<photo_id>/full.jpg and <museum_id>/<photo_id>/wall.jpg.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
