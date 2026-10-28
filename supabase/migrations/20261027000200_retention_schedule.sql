-- Surprise Museum: scheduled retention and housekeeping (NFR-16). ADR 0010. Idempotent.
--
-- Storage objects can only be removed safely through the Storage API, so the hourly job calls
-- the purge-expired Edge Function over HTTP with pg_net. The function:
--   1. deletes museums whose expires_at has passed (expired published museums and stale drafts)
--      through public.expire_museums, which queues their storage prefix;
--   2. removes the storage objects for every queued museum, and dequeues on success.
--
-- PREREQUISITE (once per project, in the SQL editor, never in a migration because these are
-- secrets): create two Vault secrets.
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- Until both exist the job logs a warning and does nothing; it tries again the next hour.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Reads the Vault secrets and calls purge-expired. Returns the pg_net request id, or null when the
-- secrets are missing. Kept in a function so the cron command stays short and the secrets never
-- appear in cron.job.
create or replace function public.invoke_purge_expired()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'project_url' limit 1;
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'cron_secret' limit 1;

  if v_url is null or v_secret is null then
    raise warning 'purge-expired was not called: set the Vault secrets project_url and cron_secret';
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/purge-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.invoke_purge_expired() from public, anon, authenticated, service_role;

-- cron.schedule with a job name replaces any existing job of that name, so this can be re-run.

-- Hourly at minute 17: purge expired museums and retry queued storage deletions. Hourly (not
-- daily) so a failed storage delete is retried well inside the 7-day window.
select cron.schedule(
  'surprise-museum-purge',
  '17 * * * *',
  $job$ select public.invoke_purge_expired(); $job$
);

-- Hourly at minute 43: drop rate-limit windows older than a day.
select cron.schedule(
  'surprise-museum-rate-limit-cleanup',
  '43 * * * *',
  $job$ delete from public.rate_limits where window_start < now() - interval '1 day'; $job$
);
