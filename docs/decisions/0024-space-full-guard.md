# 0024: Space-full guard: measured in the database, refused with `space_full`

## Status
Accepted (27/11/2026, the user's A2 design approval for iteration 5, which also chose fail open for section 5). Proposed 26/11/2026 (iteration 5 phase 2). Supersedes the "no in-app handling (FR-104 deferred)" parts of ADR 0022 (context and consequences). ADR 0022 section 3 (usage is reported nowhere public; the owner checks it in the dashboard) still holds.

## Context
Requirements v0.8.1: FR-104 (rewritten, Should), FR-106, FR-107, US-74 to US-77, backlog CR-9. User decisions 26/11/2026:

| Question | Answer |
|---|---|
| Q-36 threshold | **80%**: refuse while file storage in use is **800 MB or more** (of 1,000 MB) **or** database size is **400 MB or more** (of 500 MB). Exactly 800 MB or 400 MB refuses; 799 MB and 399 MB accept. MB is 1,000,000 bytes (US-74). If Q-34 confirms different limits, 80% of the confirmed figures applies |
| Q-38 (a) | One message with Try again and Back to my museum; the open page keeps everything; photos are not saved on the device |
| Q-39 (a) | Refuse new drafts, new photos (reserve and upload) and a publish that includes a photo not yet stored. Allow a re-publish that adds no new file, Visitors (`get-museum`), the edit page, delete, the keep-alive and the purge |
| Q-37 | Egress is handled the same way only if the app can read it without a secret in the browser or in GitHub. Otherwise it is "a limit the app cannot detect" |

Other constraints: FR-104 (a) figures read from inside the database and no more than 5 minutes old when a request is judged; (c) a photo reserved before the threshold may finish uploading; (d) the app resumes by itself; (g) a refusal is its own outcome, carries no figures and does not say which limit. Free plan, no paid add-on (NFR-32). Edge Function limits on the Free plan, from the Supabase docs page "Edge Functions limits" read 26/11/2026: 2 s of CPU per request (async I/O not counted), 256 MB of memory, 150 s wall clock.

## Q-37: can the app read monthly egress? No.
Evidence, gathered 26/11/2026:

| Place | Finding |
|---|---|
| Postgres inside the project | No table, view or function reports egress. Egress is metered by the platform across services (database, Auth, Storage, the Smart CDN, Edge Functions); Postgres only sees its own connections. ADR 0022 section 3 already recorded this |
| Supabase docs, "Manage your usage: Egress" | "You can view Egress usage on the organization's usage page." It is a "Unified Egress Quota" counted per organisation and billing cycle. The page names no API or SQL source |
| Supabase Management API, public OpenAPI document (`https://api.supabase.com/api/v1-json`, version 1.0.0, 368,601 bytes) | The words "egress" and "bandwidth" appear **0** times. The nearest endpoints are `GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts`, `usage.api-requests-count`, `functions.combined-stats`, `logs.all` and `metrics`. **All** require `bearer` security, that is a personal access token or OAuth token: a secret. Even with one, none returns billed egress |
| The project's metrics endpoint (reached with the service-role key, which an Edge Function already holds) | From memory, not checked here: it exposes Prometheus counters for the **database host**, such as network bytes sent. That is not the billed, organisation-wide egress, which also covers Storage and CDN downloads, the bulk of this app's egress (photos). It cannot stand in for the quota. Not verified |

**Decision: egress is a limit the app cannot detect.** FR-104 (e), NFR-32 (f), US-74 AC-6 and the deployment guide say so plainly. The owner's dashboard usage check stays its only control (devops-engineer, `docs/deployment.md`). At that limit the Creator and the Visitor get the existing generic errors (upload or publish failure, photo retry). Edge Function invocations are likewise not covered (FR-104 (f), backlog CR-16).

## Options considered

| Option | Verdict |
|---|---|
| **A. A SQL function read through the service role on each gated request: sum of `metadata->>'size'` over `storage.objects` in bucket `photos`, and `pg_database_size(current_database())`** | **Chosen.** The same two figures as the owner's dashboard queries (ADR 0022 section 3, A-38). One round trip, no new secret, figures 0 minutes old |
| B. List the bucket through the Storage API and add up sizes | **Rejected.** One call per folder level and per 100 objects (as `removePrefix` does today); slow and costly at hundreds of objects |
| C. A pg_cron job writes a usage snapshot every 5 minutes; requests read it | **Rejected.** It adds a job, a table, 288 writes a day and up to 5 minutes of staleness, to save a query that costs milliseconds |
| D. Cache the figures in the Edge Function's memory | **Rejected.** Workers are recycled, so the hit rate is unknown, and it adds staleness. Nothing measured needs it |
| E. Check inside `reserve_photo()` and the other SQL functions | **Rejected.** It spreads the rule and its thresholds across SQL and TypeScript, and `create-museum` has no SQL function to put it in. It also cannot be tested in Deno |
| F. Management API usage endpoints | **Rejected.** They need a secret, and they do not give storage bytes or egress in any case (Q-37 above) |

## Decision

### 1. Measurement
New SQL function (new migration, for example `supabase/migrations/20261126000200_space_usage.sql`; idempotent):

```sql
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
```

- `security definer` with an empty `search_path` and no parameters, executable by `service_role` only. It runs with the privileges of the migration role, the same role that runs the owner's documented dashboard query on `storage.objects`. The Edge Function's role then needs no grant on the `storage` schema. It returns two numbers and nothing else.
- Cost: the index on `storage.objects (bucket_id, name)` serves the sum. At the threshold that is about 2,000 objects (800 MB at about 400 KB each). `pg_database_size` reads file sizes. It is one PostgREST round trip inside the region: wall time rises by roughly tens of milliseconds, CPU by well under 1 ms of the 2 s limit, and invocations by none (it runs inside a call that already happens). Figures are estimates, not measured.
- New store method `spaceUsage(): Promise<{ storageBytes: number; databaseBytes: number }>` on `MuseumStore`, implemented in `supabaseBackend.ts` (`client.rpc('space_usage')`) and in both in-memory backends (settable figures, so tests can set 799,999,999 or 800,000,000 bytes, US-74).
- **Not verified:** that `storage.objects.metadata->>'size'` and `pg_database_size` match what the Supabase usage page shows for this project. The guard is conservative either way: 800,000,000 bytes is 74.5% of a binary GiB.

### 2. Threshold configuration
Two optional Edge Function environment variables, read by `loadConfig` (`supabase/functions/_shared/config.ts`) into `RuntimeConfig.spaceLimits`:

| Variable | Default | Meaning |
|---|---|---|
| `SPACE_FULL_STORAGE_BYTES` | `800000000` | Refuse when storage in use is at or above this |
| `SPACE_FULL_DATABASE_BYTES` | `400000000` | Refuse when database size is at or above this |

Unset means the default. A set value must be a whole number from 1 to 1,000,000,000,000. Anything else is a `ConfigError` naming the variable, which gives the existing loud 500 "The service is not configured." The smoke test and the next keep-alive run expose it. Changing a figure after Q-34 is then `supabase secrets set` and no code change. A pure function decides: `isSpaceFull(usage, limits): boolean` returns `usage.storageBytes >= limits.storageBytes || usage.databaseBytes >= limits.databaseBytes`, in `supabase/functions/_shared/space.ts`.

### 3. Where the guard sits
On every request it gates, with no cache. FR-104 (a)'s "no more than 5 minutes old" is met with figures 0 minutes old, and FR-104 (d) resumes on the next attempt.

| Function and action | Checked? | Where in the flow |
|---|---|---|
| `create-museum` | **Yes** | After the body check and the rate-limit hit (so refusals still count toward 10 an hour), before the insert |
| `manage-museum` `reserve-photo` | **Yes** | After the token lookup and the per-museum rate limit, before `reserve_photo()`. A refusal reserves nothing and counts no reservation |
| `manage-museum` `publish` | **Only when the document lists a photo that is not `ready`** (pending, or not a photo of this museum) | In the existing readiness pre-check. If any listed photo is not ready: space full gives `space_full`, otherwise the existing `conflict` with its `field`. If every listed photo is ready, nothing is measured and the publish runs as today. That covers a re-publish with no new file and a first publish of photos already stored (Q-39 (a), US-77 AC-5) |
| `manage-museum` `renew-upload`, `confirm-photo` | No | They finish a photo reserved earlier (FR-104 (c), US-74 AC-4). The most this can add is bounded: 20 live photos x 2 objects x 2 MiB per museum |
| `manage-museum` `get`, `remove-photo`, `delete`; `get-museum`; `keep-alive`; `purge-expired` | No | Read or remove only (FR-107) |
| Uploads to Storage through signed URLs | No | They are not ours to intercept, and are already bounded by the reservations above |

### 4. Error contract
New `ApiErrorCode` `space_full`, **HTTP 409**, the same status as the other "valid request, not possible now" refusals (`photo_limit`, `upload_quota`). Rejected: 503 (the Supabase gateway uses it for its own faults, and clients treat it as retryable) and 507 (unfamiliar to clients and proxies).

```json
{ "error": "space_full", "message": "Surprise Museum is full for now. Please try again later." }
```

No `field`, no `Retry-After`, no figure, and nothing that says which limit was reached (FR-104 (g)). The live client maps the code by its `error` value, so the status matters only as a fallback. `STATUS_BY_CODE` in `http.ts` and `STATUS` in `mockClient.ts` gain `space_full: 409`. `CONTRACT_VERSION` stays 1: a new code is an addition, and an older client maps an unknown code to `server_error`, which is the generic message it showed before this change.

### 5. When the measurement fails
**Fail open** (decided by the user at A2, 27/11/2026). If `space_usage()` errors, the request goes ahead as if space were free, and the function logs `space check unavailable (<error name>)`, never a figure. Reasons: the guard is a Should-level safety net with 20% headroom in front of the platform's own limit, while creating a museum (FR-1 to FR-4) is Must. A permissions change on `storage.objects` must not stop every Creator. Refusing with `space_full` on a fault would tell Creators "full" when it is not. The cost is that the guard can be off without anyone noticing until the logs are read. That risk is in `docs/architecture.md` section 15.

### 6. Client handling
See `docs/architecture.md` section 8.2 for the store and test-hook contract. In short:
- `src/api/liveClient.ts` adds `space_full` to `KNOWN_CODES`. Without this a 409 `space_full` reads as `server_error`.
- `src/lib/apiPort.ts` handles `space_full` in `describeApiError` and adds `isSpaceFull(error)`.
- `builderStore.spaceFull` (`{ action: 'photo' | 'publish' } | null`) drives the FR-106 message. Refused photos are `failed` with `errorKind: 'space-full'`. `retrySpaceFull()` in `src/state/uploadQueue.ts` sends only those again, or repeats the publish.

### 7. Mock mode
The mock follows the same rules behind a switch that is off by default: `setSpaceFull(full: boolean)` on `MockMuseumApi`, exposed through `setDemoSpaceFull()` in `src/api/index.ts`. In development and test builds, `window.__APP_TEST__.setMockSpaceFull` points at it. The switch lives in memory and is per page, so a new page starts with space free and a test sets it again on each page. While on, `createMuseum` and `reservePhoto` reject with `space_full` (409), and `publish` does so when a listed photo is not ready. Everything else behaves as when space is free. The mock's own 413 "demo storage on this device is full" stays separate: it is about the device, and its fix is Clear demo data.

### 8. Deploy order
Any order is safe for this part. An old frontend shows its generic upload error on a 409 `space_full`. A new frontend never receives the code from an old backend. The keep-alive part of the release has an order (ADR 0023 section 5); run the Supabase deploy first for both.

## Consequences
- The app stops new drafts, photos and unstored publishes at 80%, with a kind message, and Visitors, the edit page, delete, the keep-alive and the purge are untouched (FR-107). About 50 full museums fit before refusals start (800 MB / 16 MB), against about 60 before the platform limit.
- A deliberate fill through the app now stops at 80% plus photos already reserved. Signed upload URLs issued before the threshold stay valid for 2 hours, so several addresses can still overshoot by what they reserved. Overshoot is bounded per museum (see section 3) and per address by the existing rate limits.
- The refusal tells anyone who calls `create-museum` one bit: the service is above or below 80%. It gives no figure. That is inherent in FR-104 and far less than ADR 0022 section 3 refused to publish (sizes on a public endpoint).
- `create-museum` and `reserve-photo` make one more database round trip each. A publish makes one only in the rare case of an unready photo.
- Egress and invocations remain undetected by the app. The dashboard check stays.
- If the guard's measurement breaks, the guard silently switches off (section 5).
- Tests: Deno tests for `isSpaceFull` at 799,999,999 and 800,000,000 storage bytes and 399,999,999 and 400,000,000 database bytes; for each gated action refusing (nothing stored, no reservation counted); for each ungated action succeeding while full; for publish with all photos ready (accepted) and with an unready photo (`space_full` when full, `conflict` when not); for fail-open; and for config parsing. pgTAP: `space_usage()` cannot be executed by `anon` or `authenticated`. Mock tests mirror the Deno cases. The e2e tests (US-74 to US-77) use `setMockSpaceFull`.
