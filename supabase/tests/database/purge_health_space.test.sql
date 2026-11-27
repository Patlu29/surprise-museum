-- pgTAP: purge health (ADR 0023) and space usage (ADR 0024). Run with `npx supabase test db`
-- (needs Docker). The public keys can run none of the three functions or read the heartbeat, and
-- the read-only ones stay read-only. Same pattern as lockdown.test.sql.
begin;
select plan(24);

-- purge_heartbeat: RLS on, no policy, no access for the public roles, one row at most.
select ok((select relrowsecurity from pg_class where oid = 'public.purge_heartbeat'::regclass), 'purge_heartbeat has RLS');
select ok(not has_table_privilege('anon', 'public.purge_heartbeat', 'select'), 'anon cannot select purge_heartbeat');
select ok(not has_table_privilege('anon', 'public.purge_heartbeat', 'insert'), 'anon cannot insert purge_heartbeat');
select ok(not has_table_privilege('anon', 'public.purge_heartbeat', 'update'), 'anon cannot update purge_heartbeat');
select ok(not has_table_privilege('authenticated', 'public.purge_heartbeat', 'select'), 'authenticated cannot select purge_heartbeat');
select ok(not has_table_privilege('authenticated', 'public.purge_heartbeat', 'update'), 'authenticated cannot update purge_heartbeat');
select ok(has_table_privilege('service_role', 'public.purge_heartbeat', 'select'), 'service_role can read purge_heartbeat');
select ok(has_table_privilege('service_role', 'public.purge_heartbeat', 'insert'), 'service_role can insert purge_heartbeat');
select ok(has_table_privilege('service_role', 'public.purge_heartbeat', 'update'), 'service_role can update purge_heartbeat');
select is((select count(*)::int from public.purge_heartbeat), 0, 'the migration does not seed the heartbeat');
select throws_ok('insert into public.purge_heartbeat (id, last_success_at) values (2, now())', '23514', null, 'only the one row (id = 1) is allowed');

-- The three functions are for the service role only.
select ok(not has_function_privilege('anon', 'public.record_purge_success()', 'execute'), 'anon cannot record a purge success');
select ok(not has_function_privilege('authenticated', 'public.record_purge_success()', 'execute'), 'authenticated cannot record a purge success');
select ok(not has_function_privilege('anon', 'public.purge_health_inputs()', 'execute'), 'anon cannot run purge_health_inputs');
select ok(not has_function_privilege('authenticated', 'public.purge_health_inputs()', 'execute'), 'authenticated cannot run purge_health_inputs');
select ok(not has_function_privilege('anon', 'public.space_usage()', 'execute'), 'anon cannot run space_usage');
select ok(not has_function_privilege('authenticated', 'public.space_usage()', 'execute'), 'authenticated cannot run space_usage');
select ok(
  has_function_privilege('service_role', 'public.record_purge_success()', 'execute')
    and has_function_privilege('service_role', 'public.purge_health_inputs()', 'execute')
    and has_function_privilege('service_role', 'public.space_usage()', 'execute'),
  'service_role can run all three'
);

-- The keep-alive's query cannot write (stable), and space_usage is stable too.
select is((select provolatile::text from pg_proc where oid = 'public.purge_health_inputs()'::regprocedure), 's', 'purge_health_inputs is stable, so it cannot write');
select is((select provolatile::text from pg_proc where oid = 'public.space_usage()'::regprocedure), 's', 'space_usage is stable');

-- Behaviour: record_purge_success() upserts the one row, and the inputs read it back.
select lives_ok('select public.record_purge_success()', 'record_purge_success runs');
select lives_ok('select public.record_purge_success()', 'and runs again, as an update of the same row');
select is((select count(*)::int from public.purge_heartbeat), 1, 'still exactly one heartbeat row');
select ok((select last_success_at is not null from public.purge_health_inputs()), 'purge_health_inputs reads the heartbeat back');

select * from finish();
rollback;
