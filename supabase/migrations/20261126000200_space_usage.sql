-- Space-full guard (ADR 0024, FR-104): the two figures the Edge Functions compare with their
-- thresholds. File storage in use is the sum of object sizes in the private `photos` bucket;
-- database size is pg_database_size. Both are the same figures as the owner's dashboard queries.
-- security definer with an empty search_path and no parameters, executable by service_role only,
-- so the Edge Function needs no grant on the storage schema. It returns two numbers and nothing else.
-- Idempotent: safe to run twice.

create or replace function public.space_usage()
returns table (storage_bytes bigint, database_bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(coalesce((o.metadata ->> 'size')::bigint, 0))
                     from storage.objects o
                    where o.bucket_id = 'photos'), 0)::bigint,
         pg_database_size(current_database());
$$;
revoke all on function public.space_usage() from public, anon, authenticated;
grant execute on function public.space_usage() to service_role;
