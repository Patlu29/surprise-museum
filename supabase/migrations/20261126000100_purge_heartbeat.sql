-- Purge health (ADR 0023, NFR-33): the purge records its own success, and the keep-alive reads it.
-- purge-expired calls record_purge_success() as its last step on a run that reached the end.
-- The keep-alive calls purge_health_inputs() (read-only) and a pure function decides the flag.
-- The heartbeat is deliberately NOT seeded: until the first purge after the deploy the flag is
-- false ("none ever recorded"), which is the truth.
-- Idempotent: safe to run twice.

create table if not exists public.purge_heartbeat (
  id              smallint primary key default 1 check (id = 1),
  last_success_at timestamptz not null
);
alter table public.purge_heartbeat enable row level security;
revoke all on table public.purge_heartbeat from anon, authenticated;
grant select, insert, update on table public.purge_heartbeat to service_role;

-- Called by purge-expired as its last step. Returns the time it recorded (Postgres now()).
create or replace function public.record_purge_success()
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  insert into public.purge_heartbeat as h (id, last_success_at) values (1, now())
  on conflict (id) do update set last_success_at = excluded.last_success_at
  returning h.last_success_at;
$$;
revoke all on function public.record_purge_success() from public, anon, authenticated;
grant execute on function public.record_purge_success() to service_role;

-- Read-only: four timestamps for the keep-alive. Only a boolean ever leaves the Edge Function.
create or replace function public.purge_health_inputs()
returns table (
  checked_at        timestamptz,  -- now()
  last_success_at   timestamptz,  -- null if the purge has never recorded a success
  oldest_queued_at  timestamptz,  -- min(storage_purge_queue.enqueued_at), null if the queue is empty
  oldest_expired_at timestamptz   -- min(museums.expires_at) among rows with expires_at <= now(), null if none
)
language sql
stable
set search_path = ''
as $$
  select now(),
         (select h.last_success_at from public.purge_heartbeat h where h.id = 1),
         (select min(q.enqueued_at) from public.storage_purge_queue q),
         (select min(m.expires_at) from public.museums m where m.expires_at <= now());
$$;
revoke all on function public.purge_health_inputs() from public, anon, authenticated;
grant execute on function public.purge_health_inputs() to service_role;
