# 0023: Purge health: a heartbeat written by the purge, one flag in the keep-alive

## Status
Proposed (26/11/2026, iteration 5 phase 2), awaiting the user's design approval (A2). Amends ADR 0022 (the keep-alive now reveals one boolean, and the workflow turns red on it) and ADR 0010 (the purge records its own success). Both carry a dated amendment that points here.

## Context
Requirements v0.8.1: NFR-33 and NFR-34 (Should), US-72 and US-73, backlog OPS-1 and CR-13. User decision 26/11/2026, Q-40 (a): the purge is **unhealthy** when any one of these is true at the moment the keep-alive runs:

1. no purge run has completed successfully in the last 3 hours, or none has ever been recorded;
2. the oldest entry in the storage-delete queue (`storage_purge_queue`) is older than 3 hours;
3. a museum or draft whose end (`expires_at`) passed more than 3 hours ago is still in the database.

Constraints:

| Source | Constraint |
|---|---|
| A-41 | A pg_cron "succeeded" status only means the SQL that starts the HTTP call ran (`invoke_purge_expired()` queues a pg_net request). It says nothing about whether `purge-expired` worked. The signal must come from the purge function itself |
| NFR-33 (c) | The 200 body has exactly three keys, `ok`, `checkedAt`, `purgeHealthy`. No count, age, last-run time, id or reason |
| NFR-33 (d) | If the health check fails, the answer is still 200, `ok: true`, a fresh `checkedAt`, `purgeHealthy: false`. Reaching Postgres must not depend on the health check |
| NFR-33 (e), US-69 AC-4 | Working out the flag writes nothing, calls no purge and needs no secret from the caller |
| NFR-34 | The scheduled run is red when the flag is `false`, missing or not a boolean; the log says only "purge: healthy" or "purge: unhealthy"; a run red only for the purge still counts as keep-alive activity when its summary shows "keep-alive: ok" |
| Q-41 (a) | The keep-alive stays daily (20:37 UTC). Detection is at best daily (A-42) |

## Options considered

### Where "a successful purge run" comes from

| Option | Verdict |
|---|---|
| A. `cron.job_run_details.status` for job `surprise-museum-purge` | **Rejected.** "succeeded" means `select public.invoke_purge_expired()` ran, which only queues the HTTP call (A-41) |
| B. `net._http_response` (the status code pg_net received) | **Rejected.** Rows are kept for about 6 hours, so "none ever recorded" and "pg_net cleaned up" look the same. The table belongs to the `net` extension and holds every pg_net response, not just ours. A 200 from the gateway is not proof that our function finished |
| C. **A one-row heartbeat that `purge-expired` writes as its last step, only when the run reached the end without an error** | **Chosen.** The purge itself leaves the signal (A-41's own suggestion). The write comes from the purge, which already writes (it deletes rows and dequeues), never from the keep-alive |
| D. An append-only table of purge runs | **Rejected.** It grows by 24 rows a day and needs its own pruning job. Only the last success is needed |
| E. The keep-alive calls the purge, or asks it for its state | **Rejected.** NFR-32 (b) and US-69 AC-4 forbid it |

### Where the flag is computed

| Option | Verdict |
|---|---|
| SQL returns the boolean | Workable, but the 3-hour boundaries can then only be tested against a real Postgres (pgTAP needs Docker, which CI does not run) |
| **SQL returns four timestamps, a pure TypeScript function decides** | **Chosen.** US-72 asks for tests with a fake clock and a test backend at 2 h 59 min and 3 h 1 min. A pure function is tested in Deno with the in-memory backend, like every other handler rule. The timestamps stay inside the function: only the boolean leaves |

## Decision

### 1. The purge records its own success
New table and SQL function (new migration, for example `supabase/migrations/20261126000100_purge_heartbeat.sql`; idempotent):

```sql
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
```

`purge-expired/handler.ts` calls a new store method `recordPurgeSuccess(): Promise<void>` after the queue loop and before it answers. **A successful run** is one that passed the secret check, expired its batch, went through the queue and reached that call. A run in which some storage deletes failed (`failed > 0`) still counts as a successful run: condition 2 (queue age) watches failed deletes, so each condition reports one thing. Any exception before or during the call gives the existing 500 from `createEndpoint`, and no heartbeat is written. The response body (`{ purged, retried, failed }`) does not change.

The migration does **not** seed the row. A seed would claim a run that never happened; the flag is `false` ("none ever recorded") until the first purge after the deploy, at most about 60 minutes later (the job runs at minute 17).

### 2. The keep-alive reads four timestamps and returns one boolean
New read-only SQL function (same migration):

```sql
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
```

`museums_expires_at_idx` serves the last sub-query; the queue holds a handful of rows at most. The function is `stable` and contains only `select`, so the keep-alive still writes nothing.

New pure module `supabase/functions/_shared/purgeHealth.ts` (no imports beyond types, so Vitest can also load it):

```ts
export const PURGE_HEALTH_MAX_AGE_MS = 3 * 60 * 60 * 1000; // Q-40 (a)
export interface PurgeHealthInputs {
  checkedAt: string;              // ISO 8601
  lastSuccessAt: string | null;
  oldestQueuedAt: string | null;
  oldestExpiredAt: string | null;
}
export function isPurgeHealthy(inputs: PurgeHealthInputs, maxAgeMs?: number): boolean;
```

Rules (each age is `checkedAt - t`):

| Input | Healthy when | Unhealthy when |
|---|---|---|
| `lastSuccessAt` | age is 3 hours or less | `null` (none ever), or older than 3 hours |
| `oldestQueuedAt` | `null`, or age 3 hours or less | older than 3 hours |
| `oldestExpiredAt` | `null`, or age 3 hours or less | older than 3 hours |
| Any timestamp that does not parse, including `checkedAt` | never | always (unknown means unhealthy) |

So 2 h 59 min is healthy and 3 h 1 min is unhealthy (US-72 AC-1 to AC-4). Exactly 3 h 0 min 0 ms is healthy.

New store method `purgeHealthInputs(): Promise<PurgeHealthInputs>` on `MuseumStore` (`ports.ts`), implemented in `supabaseBackend.ts` (`client.rpc('purge_health_inputs')`, with `.abortSignal()` and a **5-second** timeout) and in both in-memory test backends (from their clock, museums, queue and a heartbeat field that their `recordPurgeSuccess()` sets).

`keep-alive/handler.ts`, in this order:
1. Body check, as today.
2. `checkedAt = await store.keepAlive()`. A failure here is the existing 500: the keep-alive itself failed.
3. `purgeHealthy = isPurgeHealthy(await store.purgeHealthInputs())`, inside a `try`. Any error or the timeout gives `false`, and logs only `keep-alive: purge health check failed (<error name>)`. Never a value.
4. Answer 200 with exactly `{ ok: true, checkedAt, purgeHealthy }`.

### 3. Contract
```ts
export interface KeepAliveResponse {
  ok: true;
  /** ISO 8601 UTC. Postgres's own now(), so a fresh value proves the database answered. */
  checkedAt: string;
  /** NFR-33. False when the purge is behind, has never run, or the check itself failed. */
  purgeHealthy: boolean;
}
```
`CONTRACT_VERSION` stays 1. This is an added field, and the only reader is the workflow; the app never calls `keep-alive`. Errors are unchanged (400, 405, 413, 415, 500).

```json
{ "ok": true, "checkedAt": "2026-11-27T20:37:04.512Z", "purgeHealthy": true }
```

### 4. The workflow (devops-engineer, `.github/workflows/keep-alive.yml`)
Triggers, job condition, `permissions: {}`, runner, timeout, concurrency, masking and the `curl` call stay as built. The one step becomes two:

| Step | Does | Ends |
|---|---|---|
| 1. "Keep-alive call" (as today) | `curl` into `keep-alive-response.json`; `jq -e '.ok == true and (.checkedAt \| type == "string")'`; then writes `keep-alive: ok` and the database time to the log and to `$GITHUB_STEP_SUMMARY` | Red as today on any keep-alive failure, with `keep-alive: failed` in the summary |
| 2. "Purge health" (new) | Reads the same file. `jq -e '.purgeHealthy == true'`: if it matches, writes `purge: healthy` and ends green. Otherwise writes `purge: unhealthy`, adds one `::error` annotation and exits 1 | Red when the flag is `false`, missing, `null`, a string or any other value (US-73 AC-1, AC-2) |

- The annotation says "The purge has not kept up. See docs/deployment.md, keep-alive section." when `jq -e '.purgeHealthy | type == "boolean"'` matches, and "The keep-alive answer has no purgeHealthy flag. Deploy the keep-alive function before this workflow (ADR 0023)." when it does not. Neither holds a count, an age or the key. The summary line is still exactly `purge: unhealthy` (NFR-34 (b)).
- Neither step prints the response body.
- A run that is red only at step 2 shows step 1 green and `keep-alive: ok` in the summary, so it counts for US-69 AC-3 (NFR-34 (c)).
- QA checks step 2 on saved responses, as `keep-alive-static.spec.ts` does today, so the `jq` expressions above are part of the contract.

### 5. Deploy order
A workflow that expects `purgeHealthy` turns red at once against the old function (NFR-34 (d)). The old workflow ignores the extra key, so the function can go first safely.

1. Run `deploy-supabase.yml` with migrations on. Migrations run first (heartbeat table and functions), then all five functions. If the functions went first, `record_purge_success()` would not exist yet and each purge would answer 500 after doing its work.
2. Wait until after the next minute-17 purge. Check the flag: run `supabase/scripts/smoke-test.mjs`, which prints `purge: healthy` or `purge: unhealthy` (backend-developer adds this). Expect `purge: healthy`.
3. Only then commit and push the `keep-alive.yml` change, and run it once by hand (`workflow_dispatch`). Expect green with `keep-alive: ok` and `purge: healthy`.

The tech lead holds the workflow change back from `main` until steps 1 and 2 are done, because scheduled runs use the workflow file on `main`. A red run from a mistaken order is noisy but harmless: one e-mail. The fix is to finish step 1.

## Consequences
- The purge writes one more row update per successful run (24 a day). The keep-alive still writes nothing, makes no HTTP call and needs only the public key.
- The keep-alive now makes two read-only queries instead of one. It remains public and unthrottled. Anyone who calls it learns one bit: whether the purge has kept up. That reveals no museum, count, size or time. Expired content is already unreachable (lookups filter `expires_at > now()`, and the bucket is private), so a stale object cannot be fetched by knowing the purge is behind.
- The flag is `false` for up to about 60 minutes after the first deploy (no heartbeat yet). A manual workflow run in that window would be red.
- A storage hiccup that lasts just over 3 hours turns a run red after it has already cleared. That is the price of Q-40 (a), accepted by the user.
- Detection is daily: a failure that starts just after 20:37 UTC is seen up to about 24 hours later (A-42). Raising the frequency is Q-41, answered (a), keep daily.
- The flag detects; it does not repair. The guide (devops-engineer) says what a red "purge: unhealthy" run means and which checks to make (NFR-34 (f)).
- Tests: Deno handler tests for `isPurgeHealthy` boundaries (2 h 59 min, 3 h 1 min, none ever, each condition alone, unparseable input), for the keep-alive (exactly three keys; `false` when `purgeHealthInputs` throws or times out; still nothing created, no rate-limit row), and for the purge (heartbeat set after a clean run and after a run with `failed > 0`; not set when the secret is wrong or a step throws). pgTAP checks that `anon` and `authenticated` cannot execute the two new functions or read `purge_heartbeat`, and that `purge_health_inputs()` is `stable`.
