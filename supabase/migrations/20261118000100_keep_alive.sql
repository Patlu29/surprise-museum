-- Keep-alive (ADR 0022, NFR-32): one read-only query that proves Postgres answered.
-- Called by the keep-alive Edge Function through the service role. It writes nothing and returns
-- only the database clock, so the public endpoint reveals nothing else.
-- Idempotent: safe to run twice.

create or replace function public.keep_alive()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke all on function public.keep_alive() from public, anon, authenticated;
grant execute on function public.keep_alive() to service_role;
