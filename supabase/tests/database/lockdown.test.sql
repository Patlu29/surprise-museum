-- pgTAP: the public keys can reach nothing. Run with `npx supabase test db` (needs Docker).
-- Mirrors docs/architecture.md section 7.2 and supabase/README.md "Security checks to keep green".
begin;
select plan(21);

-- Row-level security is on for every table, and there are no policies at all.
select ok((select relrowsecurity from pg_class where oid = 'public.museums'::regclass), 'museums has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.photos'::regclass), 'photos has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.storage_purge_queue'::regclass), 'storage_purge_queue has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass), 'rate_limits has RLS');
select is((select count(*)::int from pg_policies where schemaname = 'public'), 0, 'no policies on public tables');

-- No privileges for anon or authenticated on any table, in any direction.
select ok(not has_table_privilege('anon', 'public.museums', 'select'), 'anon cannot select museums');
select ok(not has_table_privilege('anon', 'public.museums', 'insert'), 'anon cannot insert museums');
select ok(not has_table_privilege('anon', 'public.museums', 'update'), 'anon cannot update museums');
select ok(not has_table_privilege('anon', 'public.museums', 'delete'), 'anon cannot delete museums');
select ok(not has_table_privilege('anon', 'public.photos', 'select'), 'anon cannot select photos');
select ok(not has_table_privilege('anon', 'public.rate_limits', 'select'), 'anon cannot select rate_limits');
select ok(not has_table_privilege('authenticated', 'public.museums', 'select'), 'authenticated cannot select museums');
select ok(not has_table_privilege('authenticated', 'public.photos', 'delete'), 'authenticated cannot delete photos');
select ok(has_table_privilege('service_role', 'public.museums', 'select'), 'service_role can read museums');

-- The helper functions are not callable by the public roles.
select ok(not has_function_privilege('anon', 'public.reserve_photo(uuid)', 'execute'), 'anon cannot reserve photos');
select ok(not has_function_privilege('anon', 'public.delete_museum_rows(uuid)', 'execute'), 'anon cannot delete museums');
select ok(not has_function_privilege('authenticated', 'public.expire_museums(integer)', 'execute'), 'authenticated cannot expire museums');
select ok(has_function_privilege('service_role', 'public.reserve_photo(uuid)', 'execute'), 'service_role can reserve photos');

-- Behaviour, not just catalog entries: a real query as anon is refused.
set local role anon;
select throws_ok('select * from public.museums', '42501', null, 'anon select on museums is denied');
reset role;

-- Storage: the bucket is private, JPEG only, 2 MiB, and no policy grants access to it.
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'photos'),
  row(false, 2097152::bigint, array['image/jpeg'])::text,
  'photos bucket is private, 2 MiB, JPEG only'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  0,
  'no policies on storage.objects, so anon cannot list, read, write or delete'
);

select * from finish();
rollback;
