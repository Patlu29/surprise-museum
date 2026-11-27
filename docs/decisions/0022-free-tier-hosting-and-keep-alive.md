# 0022: Free-tier hosting and a daily keep-alive

## Status
Accepted (19/11/2026, the user's A2 design approval for iteration 4). Proposed 18/11/2026. Amends ADR 0003 (a fifth Edge Function) and builds on ADR 0002 (GitHub Pages) and ADR 0010 (retention). Two clarifications from the release review (20/11/2026) are at the end; they change no decision. Built in eb57dff (function, migration, tests). The section 5 workflow, `.github/workflows/keep-alive.yml`, was built in phase 6 (cbbd7e4) as specified, with two added guards: once `VITE_SUPABASE_URL` is set, a missing anon key or a URL that does not start with `https://` fails the run, and the key is masked in the log. It has not yet run on GitHub; nothing is deployed (23/11/2026). Deployed and first run on 24/11/2026 (manual run 45385818352, green). **Amended 26/11/2026, accepted 27/11/2026 (the user's A2 design approval for iteration 5)**: the response gains `purgeHealthy` and the workflow turns red on it (ADR 0023), and in-app space-full handling replaces "FR-104 deferred" (ADR 0024). See the amendment at the end.

## Context
The user decided on 18/11/2026 to host on free tiers only: GitHub Pages from the public repository, and the Supabase Free plan with a scheduled keep-alive (NFR-32, US-69, US-70). The free-limit guardrail is documentation plus a usage check, with no in-app "space full" handling (FR-104 is deferred).

Facts this decision relies on (third-party sources checked by the tech lead 18/11/2026; **confirm on supabase.com/pricing and docs.github.com**, Q-34):

| Fact | Consequence |
|---|---|
| Supabase pauses a Free project after 7 days without activity | The app goes offline and the hourly purge stops (NFR-16(g)) |
| Supabase does not document here exactly what counts as activity | The keep-alive must reach as many layers as it can: the API gateway, an Edge Function and Postgres |
| Free plan: 500 MB database, 1 GB file storage, about 5 GB egress a month, no backups | Capacity in NFR-32 (d) and (e); NFR-16(f) |
| GitHub Actions is free for public repositories on standard runners | The keep-alive costs nothing |
| GitHub switches off scheduled workflows in a public repository after 60 days with no repository activity | The keep-alive can stop silently; the guide must cover it |
| GitHub e-mails the user who last changed a workflow's `cron` line when a scheduled run fails, if that user has Actions notifications turned on | The failure signal (Not verified for this account) |

Constraints from the task and NFR-32 (b): the call must create nothing, never call purge, need no secret beyond the public anon key, and must not trip or pollute the rate limits. `get-museum` counts misses (20 per 10 minutes per IP hash) and writes a `rate_limits` row on every lookup, so calling it with a dummy token would both write rows and add misses.

## Options considered

| Option | Reaches | Writes | Secret | Verdict |
|---|---|---|---|---|
| A. `get-museum` with a fixed dummy token | Gateway, function, Postgres | A `rate_limits` row per call, plus a miss | None | **Rejected**: pollutes the rate limits, and a shared runner IP could block real Visitors on that IP for 10 minutes |
| B. `purge-expired` | Gateway, function, Postgres | Deletes | `CRON_SECRET` in GitHub | **Rejected**: NFR-32 (b) forbids calling purge, and it needs a secret |
| C. PostgREST directly (`/rest/v1/rpc/...`) with the anon key | Gateway, Postgres | None | None | **Rejected for now**: needs `anon` to execute a function, which breaks ADR 0003's rule that the public key can reach nothing. Kept as the fallback below |
| D. Supabase-internal pg_cron | Postgres only | None | None | **Not relied on**: it already runs hourly, so if it counted as activity no keep-alive would be needed; that is not documented, and it stops when the project pauses |
| E. **A new read-only `keep-alive` Edge Function** that runs one trivial query through the service role | Gateway (with the anon key), function, PostgREST, Postgres | **None** | None (public anon key only) | **Chosen** |

## Decision

### 1. What the keep-alive calls
A new Edge Function, `keep-alive`, called by a scheduled GitHub Actions workflow with the public anon key. The function calls one new SQL function, `public.keep_alive()`, through the service role. The request therefore passes through the Supabase API gateway (an API request with the project's key), runs an Edge Function, and makes a REST call to PostgREST that runs a query in Postgres. If any of those layers counts as project activity, this call does.

Why this reaches the database: `public.keep_alive()` returns Postgres's own `now()`, and the function puts that value in the response as `checkedAt`. A 200 with a fresh `checkedAt` proves Postgres answered; a cached or gateway-only reply cannot produce it.

### 2. What the call must not do
| Rule | How |
|---|---|
| Creates nothing | `keep_alive()` is a `stable` SQL function that only selects `now()`. The handler calls nothing else: no `rate_limit_hit`, no IP hash, no storage call. Deno test: museum, photo, queue, rate-limit and object counts are unchanged after a call |
| Never calls purge | The handler imports nothing from `purge-expired` and makes no HTTP call. The workflow calls only `/functions/v1/keep-alive` |
| No secret | The workflow sends the anon key, which is already a public repository **variable** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), not a secret. The function needs no `CRON_SECRET` |
| Does not trip or pollute rate limits | No rate limiting on this function, so it writes no `rate_limits` row and never counts a miss. It reads no museum, so it cannot be used to probe tokens |
| Reveals nothing | The response holds only `ok` and the database time. No counts, sizes, ids or versions |
| Logs nothing sensitive | It has no body to log. The workflow prints only the HTTP status and `checkedAt`; it never prints the key or runs with `set -x` |

**Abuse.** The endpoint is public and unthrottled. Each call costs one function invocation and one trivial query, the same as a rate-limited call to any other function (a throttled `get-museum` call is still an invocation, and it also writes a row). It opens no new kind of risk; the free invocation quota (third-party figure about 500,000 a month, not confirmed) is the limit in both cases. Not adding a rate limit is deliberate: a rate limit needs a write.

### 3. The usage check: dashboard only
Recommended and decided: **storage, database and egress use are checked in the Supabase dashboard only.** The keep-alive reports none of them.

Reasons:
- Egress cannot be read from SQL at all, so the dashboard is needed anyway.
- Bucket size and database size on a public, unthrottled endpoint tell anyone how busy the service is and give someone trying to fill the free storage live feedback. Nothing gains from it that the dashboard does not already give the owner.
- Reporting usage safely would need a secret in GitHub, which NFR-32 (b) and the task ask to avoid.

The deployment guide (devops-engineer) gives the steps: the dashboard's Usage page for all three figures, and two read-only queries for the SQL editor, which runs only for the signed-in owner:

```sql
select pg_size_pretty(pg_database_size(current_database())) as database_size;
select count(*) as objects, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as photos_size
  from storage.objects where bucket_id = 'photos';
```

### 4. Endpoint contract
Follows `docs/api.md` conventions (POST, JSON, `ApiError` bodies, `Cache-Control: no-store`, camelCase, ISO 8601 UTC). The backend-developer adds it to `docs/api.md` and `contract.ts`.

```http
POST {SUPABASE_URL}/functions/v1/keep-alive
Content-Type: application/json
apikey: <public anon or publishable key>

{}
```

| Item | Value |
|---|---|
| Caller | The scheduled GitHub Actions workflow (no `Origin` header). Not called by the app |
| CORS | None (`cors: false`, like `purge-expired`). A browser can send it but cannot read the answer |
| JWT | `verify_jwt = false` (add `[functions.keep-alive]` to `supabase/config.toml`; the deploy already passes `--no-verify-jwt`) |
| Body | Exactly `{}` (an empty body is read as `{}`, as elsewhere) |
| Rate limit | None (section 2) |
| Contract additions | `FUNCTION_NAMES.keepAlive = 'keep-alive'`, `type KeepAliveRequest = Record<string, never>`, `interface KeepAliveResponse { ok: true; checkedAt: string }`. `CONTRACT_VERSION` stays 1 (an addition, no existing reader affected) |

**200** (`KeepAliveResponse`)
```json
{ "ok": true, "checkedAt": "2026-11-20T09:37:02.114Z" }
```
`checkedAt` is the value of `public.keep_alive()` (Postgres `now()`), as ISO 8601 UTC.

| Status | `error` | When |
|---|---|---|
| 400 | `bad_request` | The body is not an empty object ("The request body must be an empty object.", as in `create-museum`) or not valid JSON |
| 405 | `bad_request` | Not `POST` |
| 413 | `bad_request` | Body over 64 KiB |
| 415 | `bad_request` | Not `application/json` |
| 500 | `server_error` | The database call failed or returned something that is not a timestamp. The workflow treats this as a failed keep-alive |

A paused or unreachable project returns an error from the Supabase platform before the function runs; the workflow treats any non-200 as a failure.

**SQL** (new migration `supabase/migrations/20261118000100_keep_alive.sql`, idempotent):

```sql
create or replace function public.keep_alive()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

revoke all on function public.keep_alive() from public, anon, authenticated;
grant execute on function public.keep_alive() to service_role;
```

**Code** (backend-developer): `supabase/functions/keep-alive/` with `index.ts`, `handler.ts` (`createEndpoint` with `{ name: 'keep-alive', cors: false, requireJson: true }`) and `deno.json`; a `keepAlive(): Promise<string>` method on the store port (`ports.ts`), implemented in `supabaseBackend.ts` (`client.rpc('keep_alive')`) and in the in-memory test backend (returns its clock). Tests: Deno handler tests (200 shape, nothing created, no rate-limit row, 400, 405, 415, 500 on a store failure), a pgTAP check that `anon` and `authenticated` cannot execute `keep_alive()`, and a `keep-alive` line in `supabase/scripts/smoke-test.mjs`.

### 5. Schedule
A new workflow, `.github/workflows/keep-alive.yml` (devops-engineer):

| Item | Value | Why |
|---|---|---|
| Triggers | `schedule: cron: '37 20 * * *'` (daily 20:37 UTC, which is 07:37 in Sydney during daylight saving and 06:37 otherwise) and `workflow_dispatch` | **Daily, not every 3 days.** NFR-32 needs at least one run every 3 days. GitHub can delay or drop scheduled runs under load; daily runs mean 3 runs in a row must fail before a 72-hour window is empty (US-69 AC-3), and 7 before the project pauses. Off the hour, because GitHub's scheduler is busiest at minute 0. Morning in Sydney, so a failure e-mail arrives in the user's day |
| Job condition | `if: vars.VITE_SUPABASE_URL != ''` | Until the Supabase project exists the job is **skipped** (grey), not failed, so the user gets no daily failure e-mails before launch. After launch the same variable is needed by the Pages deploy, so a missing value is noticed there too |
| Permissions | `permissions: {}` | It needs no repository access: no checkout, no token |
| Runner and time | `ubuntu-24.04`, `timeout-minutes: 5`, `concurrency: keep-alive` | Short and single |
| Step | `curl --fail-with-body --silent --show-error --max-time 30 --retry 3 --retry-delay 20 --retry-all-errors -X POST "$URL/functions/v1/keep-alive" -H "Content-Type: application/json" -H "apikey: $KEY" -d '{}'`, with `URL` and `KEY` passed through `env:` from the two repository variables (never interpolated into the script with `${{ }}`); then `jq -e '.ok == true and (.checkedAt | type == "string")'` on the body; then print `checkedAt` to the job summary | Retries cover an Edge Function cold start or a brief outage within one run. Any non-200, a wrong body or a timeout fails the step |

**GitHub's 60-day rule.** In a public repository, scheduled workflows are switched off after 60 days with no repository activity (a workflow run is not activity). Then no keep-alive runs, and the project pauses about 7 days after the last success.

Decided: **document it and tell the user what to do; do not automate around it.** Rejected: workflows or third-party actions that make empty commits or call the API to re-enable themselves. They need `contents: write`, add a third-party action with write access to the repository, and fill the history with noise.

The deployment guide tells the user to:
1. Put a repeating reminder in their calendar every 50 days: open Actions, "Keep Supabase awake", and check that the latest run is green and recent.
2. If GitHub shows that the workflow was disabled for inactivity: choose **Enable workflow**, then **Run workflow** once and check it turns green. Any push to the repository also resets the 60 days.
3. If the project has already paused: restore it from the Supabase dashboard first (Free projects can be restored for a limited time after pausing; confirm the period on supabase.com), then re-enable and run the workflow. Expired museums are purged within a few hours of the restore.

### 6. Failure signal
| Failure | What the user sees |
|---|---|
| The call fails (non-200, bad body, timeout, project paused or unreachable) | The run is **red** in Actions (US-69 AC-5), and GitHub sends a "Run failed" e-mail to the user who last changed the `cron` line, provided their GitHub notification settings send Actions failures by e-mail. The guide tells the user to check that setting once (GitHub, Settings, Notifications, Actions) |
| The workflow is disabled after 60 days | No runs at all; no failure e-mail. GitHub shows a notice in the Actions tab and may e-mail a warning first (not verified). The 50-day calendar reminder is the control |
| The job is skipped because the variable is missing | A grey "skipped" run. The guide says a skipped run means `VITE_SUPABASE_URL` is not set |
| Supabase says the project is about to pause | Supabase may e-mail a warning before pausing a Free project (not verified). If that e-mail ever arrives while the keep-alive is green, the call is not being counted as activity: switch to the fallback below |

Because the tech lead commits with the user's own GitHub account, the user is the person who last changed the `cron` line, so the e-mails reach the user. If another account edits the workflow, it receives them instead.

### Fallback, not built
If Supabase pauses the project while the keep-alive is green, change the workflow to call PostgREST directly: `POST /rest/v1/rpc/keep_alive` with the anon key, after granting `anon` `execute` on `keep_alive()` only and `usage` on a dedicated schema that holds nothing else. That is a deliberate, narrow exception to ADR 0003 and needs its own amendment and the user's approval first.

## Consequences
- The app runs at zero hosting cost, and the project stays active as long as the workflow runs and Supabase counts the call (to be confirmed by watching the first 7 or more days after launch).
- One more public Edge Function, read-only and stateless; ADR 0003's "the public key can reach no table or function" still holds, because `keep_alive()` is executable only by the service role.
- No new secret anywhere. The workflow uses two existing public repository variables.
- The user has one recurring manual task (the 50-day check), and must keep Actions failure e-mails switched on.
- Usage is checked by hand in the dashboard. A free limit can be reached between checks; the app then shows its existing upload or publish error messages, and the guide says what to do (FR-104 deferred).
- Daily runs use about 30 short jobs a month on free public-repository minutes.

## Clarifications from the release review (20/11/2026)
Checked against the built code (eb57dff). Neither changes the decision, the contract or the tests.

1. **"No secret" means the caller needs none.** The function itself starts through the shared `lazyHandler` and `loadConfig` (`supabase/functions/_shared/boot.ts`, `config.ts`), like the other four. So it needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (injected by Supabase) and the project's existing function secrets `RATE_LIMIT_SALT` and `ALLOWED_ORIGINS` (`supabase/README.md` step 6), even though it uses neither of the last two. If any is missing, it answers 500 "The service is not configured." and the scheduled run turns red. That is the wanted outcome, because the same gap would break the app. No new secret is added anywhere, and the workflow still sends only the public anon key.
2. **What a browser can do.** `cors: false` means no CORS headers on any answer. `OPTIONS` gets 204 with no CORS headers (shared `createEndpoint`, as for `purge-expired`). So a cross-site JSON `POST` from a page fails its preflight and is never sent. A "simple" cross-site `POST` (for example `text/plain`) gets 415 before any database call. Either way, one function invocation is the most a third-party page can cost, which is the same as for every other function (section 2, "Abuse").

## Amendment (26/11/2026): one boolean for purge health; the space guard

Status: Accepted 27/11/2026 (the user's A2 design approval for iteration 5). Proposed 26/11/2026. Requirements v0.8.1: NFR-33, NFR-34, FR-104, FR-106, FR-107; user decisions of 26/11/2026.

| Section | Before | Now |
|---|---|---|
| Context, "no in-app space full handling (FR-104 deferred)" | Guardrail is documentation plus a usage check | Superseded by ADR 0024: the app refuses new drafts, new photos and publishes with an unstored photo at 80% of storage or database size. The dashboard check stays, and is still the only control for egress and invocations |
| 1. What the keep-alive calls | One query, `public.keep_alive()` | Two read-only queries: `public.keep_alive()` (unchanged, gives `checkedAt`), then `public.purge_health_inputs()` (ADR 0023, `stable`, `select` only). The first does not depend on the second |
| 2. "Creates nothing" | `keep_alive()` only | Unchanged in substance: both functions are `stable` selects. Still no `rate_limit_hit`, no IP hash, no storage call, no purge call. The heartbeat the check reads is written by the purge (ADR 0010 amendment), never by the keep-alive |
| 2. "Reveals nothing" | Only `ok` and the database time | **`ok`, the database time and one boolean, `purgeHealthy`.** No count, age, last-run time, id, size or reason (NFR-33 (c)). Knowing that the purge is behind reveals no museum and opens no content: expired museums already return 404 and the bucket is private |
| 2. "Logs nothing sensitive" | The workflow prints the status and `checkedAt` | Also `keep-alive: ok` and `purge: healthy` or `purge: unhealthy` (NFR-34 (b)). The function logs only the error name if the health check fails |
| 3. Usage check, dashboard only | Unchanged | Unchanged for what is reported: no size, count or usage figure goes in any public response. The space guard (ADR 0024) reads storage and database size **inside** `create-museum` and `manage-museum` and returns only a refusal code. Egress cannot be read by the app at all (ADR 0024, Q-37) |
| 4. Contract | `KeepAliveResponse { ok: true; checkedAt: string }` | `KeepAliveResponse { ok: true; checkedAt: string; purgeHealthy: boolean }`. A failed health check still answers 200 with `purgeHealthy: false` (NFR-33 (d)). Errors unchanged. `CONTRACT_VERSION` stays 1 |
| 5. Workflow step | One step: `curl`, then `jq -e '.ok == true and (.checkedAt \| type == "string")'` | Step 1 unchanged, plus `keep-alive: ok` in the summary. New step 2, "Purge health": green only when `jq -e '.purgeHealthy == true'` matches; red when the flag is `false`, missing or not a boolean (ADR 0023 section 4) |
| 6. Failure signal | Red on any keep-alive failure | Also red, at step 2, when the purge is unhealthy or the flag is missing. A run red only at step 2 still counts as keep-alive activity (US-69 AC-3) because step 1 passed and the summary says `keep-alive: ok` |
| Consequences, "A free limit can be reached between checks; the app then shows its existing upload or publish error messages (FR-104 deferred)" | | Replaced: storage and database are guarded at 80% (ADR 0024). Egress and invocations can still be reached between dashboard checks, with the existing generic messages |

**Deploy order** (ADR 0023 section 5): migrations and functions first, then a purge run, then the workflow change.

