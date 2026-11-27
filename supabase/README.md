# Supabase backend

Owner: backend-developer. Design: `docs/architecture.md` (sections 7 and 10) and ADRs 0003, 0004, 0005 and 0010. API reference: `docs/api.md`.

The backend is a Supabase project in Sydney (ap-southeast-2): Postgres, one private Storage bucket, five Edge Functions (one of them the daily keep-alive) and an hourly pg_cron job. The browser never talks to the database. It calls the Edge Functions, and it reads and writes photos only through short-lived signed URLs that the functions issue.

| Path | Contents |
|---|---|
| `config.toml` | Local CLI settings. JWT verification is off for every function, because each function authenticates the caller itself |
| `migrations/` | Schema, row-level security, database functions, storage bucket, pg_cron schedule. All idempotent |
| `functions/_shared/` | Code shared by the functions: `contract.ts` (types, also used by the browser), token and JPEG checks, validation, HTTP and CORS plumbing, the Supabase adapters |
| `functions/<name>/` | One folder per function: `index.ts` (entry point), `handler.ts` (logic), `deno.json` (import map) |
| `functions/tests/` | Deno tests, plus `devServer.ts`, a local in-memory stand-in for the deployed functions |
| `functions/.env.example` | Function secrets template |
| `tests/database/` | pgTAP tests proving the public keys can reach nothing |
| `scripts/smoke-test.mjs` | End-to-end check of a deployed or local backend |

## Do you need this to run the app?

Not for local development or QA. Without a Supabase project, `npm run dev` uses a mock of the same API (`src/api`), so the app works end to end with no setup. The mock keeps its data in the browser (IndexedDB, falling back to `localStorage`), so you can publish a museum and open its share link in a **new tab** or after a **reload**. It follows the server's rules, including the JPEG metadata check. Photo storage is capped (200 MiB in IndexedDB, 3 MiB in `localStorage`), and "clear demo data" (`clearDemoData()` from `@/api`) wipes it.

Which implementation runs is decided by `VITE_API_MODE`, the Supabase variables and the build type:

| `VITE_API_MODE` | Development server | Production build |
|---|---|---|
| `mock` | Mock | Mock (local QA only) |
| `live` | Real backend | Real backend |
| blank | Real backend if both Supabase variables are set, otherwise the mock | **Real backend, always** |

**Production builds for GitHub Pages must be live.** A production build never falls back to the mock by accident, and the deploy build is stopped before publishing if the variables are missing (step 9). A QA build that needs the mock must ask for it: `VITE_API_MODE=mock npm run build`.

Follow the steps below when you are ready to go live.

## One-time setup of the hosted project

You need: a Supabase account, this repository on your machine, and Node 22.12 or later. The Supabase CLI runs through `npx supabase` (no install). Docker is not needed for these steps.

Placeholders: `<ref>` is your project reference (the part of `https://<ref>.supabase.co`), and `<url>` is the whole project URL.

### 1. Create the project in Sydney

1. In the Supabase dashboard choose **New project**.
2. Name it `surprise-museum`. For **Region** choose **Oceania (Sydney)**, which is `ap-southeast-2`. This keeps Creator content in Australia (NFR-17).
3. Set a strong database password and save it in your password manager. You need it in step 4 and for the CI secret `SUPABASE_DB_PASSWORD`.
4. Choose the **Free** plan. This is decided (NFR-32): the app runs on free tiers only. A Free project pauses after about 7 days without activity, which would take the app offline and stop the hourly purge, so the scheduled keep-alive (step 10, ADR 0022) is required. The Free plan has no backups, which is what NFR-16 expects: nothing of a museum survives outside the live database and bucket. Museums last 7 days from first publish, so a gift link opened later shows the not-found screen.
5. When the project is ready, note the project URL and `<ref>` (Project Settings, General).

### 2. Turn off sign-ups

There are no accounts, so nobody should be able to obtain the `authenticated` role.

1. Authentication, **Sign In / Providers**: turn off **Allow new users to sign up**.
2. Turn off **Allow anonymous sign-ins**.

Leave the Data API enabled and leave `public` in its exposed schemas. The Edge Functions use it internally. The migrations revoke every privilege from `anon` and `authenticated`, enable row-level security with no policies, and revoke `usage` on the schema, so exposing it publicly gives callers nothing. Optionally, switch off the `pg_graphql` extension (Database, Extensions), which nothing uses.

### 3. Link the CLI to the project

```bash
npx supabase login
npx supabase link --project-ref <ref>
```

`link` asks for the database password from step 1.

### 4. Push the migrations

```bash
npx supabase db push --dry-run   # lists what will run
npx supabase db push
```

This creates the tables, locks them down, adds the database functions, creates the private `photos` bucket, and schedules the hourly jobs.

If it stops with an error about `pg_cron` or `pg_net`, open Database, Extensions, enable **pg_cron** and **pg_net**, and run `npx supabase db push` again. The migrations are idempotent, so running them twice is safe.

### 5. Create the Vault secrets for the purge job

The hourly job reads two secrets from Supabase Vault. They cannot be in a migration, because they are secrets. Generate the cron secret first and keep it for step 6:

```bash
openssl rand -base64 32
```

Then open the SQL editor and run (replace both values):

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<the cron secret you generated>', 'cron_secret');
```

To change the cron secret later:

```sql
select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new secret>');
```

Until both secrets exist, the job logs a warning and does nothing, then tries again the next hour.

### 6. Set the function secrets

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Edit `supabase/functions/.env` (it is git-ignored) and fill in:

| Name | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://patlu29.github.io,http://localhost:5173,http://localhost:4173` (no trailing slashes; drop the localhost entries if you do not want local development to reach production) |
| `CRON_SECRET` | The same value you stored as the Vault secret `cron_secret` |
| `RATE_LIMIT_SALT` | A different random value: `openssl rand -base64 32` |
| `SPACE_FULL_STORAGE_BYTES` (optional) | Refuse new drafts, photos and unstored publishes at or above this many bytes of file storage. Default `800000000`. Leave it out unless Q-34 confirms different plan limits (then 80% of the confirmed figure). A whole number from 1 to 1000000000000; anything else makes every function answer 500 "not configured" |
| `SPACE_FULL_DATABASE_BYTES` (optional) | The same for database size. Default `400000000` |

Then upload them:

```bash
npx supabase secrets set --env-file supabase/functions/.env
npx supabase secrets list
```

Do not add `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`. Supabase injects both into every function, and the CLI refuses secrets with the `SUPABASE_` prefix. Never copy the service-role key anywhere else.

### 7. Deploy the functions

```bash
npx supabase functions deploy --no-verify-jwt
```

`--no-verify-jwt` matches `config.toml`: the functions check the share token, edit token or cron secret themselves, and the newer publishable keys are not JWTs. Confirm all five appear as active in the dashboard under Edge Functions: `create-museum`, `get-museum`, `manage-museum`, `purge-expired`, `keep-alive`. `keep-alive` needs no secret: only the public anon key.

### 8. Check it works

Find the public key in Project Settings, API Keys (the anon key, or the publishable key that starts `sb_publishable_`). It is public by design.

```bash
node supabase/scripts/smoke-test.mjs https://<ref>.supabase.co <anon-or-publishable-key>
```

Every line should say `PASS`. The first line checks `keep-alive`, which writes nothing, and the script then prints `purge: healthy` or `purge: unhealthy` from its answer. That line is a report, not a check: it never fails the run. Right after the first deploy it says `purge: unhealthy` until the first purge has run, which is at most about 60 minutes (the job runs at minute 17), because nothing has recorded a run yet. Run the smoke test again after that and expect `purge: healthy`. If `create-museum` answers 409, the service is above its space-full threshold (see step 6 and "Space full" below). The script then creates a throw-away museum, uploads two tiny test images through signed URLs, publishes, reads it back, checks that a photo with EXIF is refused and that bad links return identical 404s, then deletes everything.

Check the hourly job (SQL editor):

```sql
select public.invoke_purge_expired();                              -- returns a request id, not null
select status_code, content from net._http_response order by created desc limit 1;   -- 200 and {"purged":0,...}
select jobname, schedule, active from cron.job;                    -- two jobs, both active
```

Check the lockdown. With the public key, both of these must be refused (permission denied or empty, never data):

```bash
curl -s "https://<ref>.supabase.co/rest/v1/museums?select=*" -H "apikey: <anon key>"
curl -s "https://<ref>.supabase.co/storage/v1/object/list/photos" -H "apikey: <anon key>" -H "Content-Type: application/json" -d '{"prefix":""}'
```

### 9. Connect the website (GitHub Actions)

In the GitHub repository open Settings, **Secrets and variables**, **Actions**.

**Variables** tab (public values, compiled into the website):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The anon or publishable key from step 8 |
| `VITE_SUPABASE_FUNCTIONS_REGION` | `ap-southeast-2` (optional; this is the default) |

**Secrets** tab (only for the deploy workflow that pushes migrations and functions, owned by the devops-engineer):

| Name | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard, Account, Access Tokens, **Generate new token** |
| `SUPABASE_PROJECT_REF` | `<ref>` |
| `SUPABASE_DB_PASSWORD` | The database password from step 1 |

Never put the service-role key in a GitHub variable, in a secret used by the website build, or in any name starting `VITE_`. Everything starting `VITE_` is published to the world.

**Fail the deploy if the variables are missing.** The Pages deploy build must run in live mode and must not publish a site without a working backend. Add this step to the workflow before `npm run build`, and set the same three variables on the build step (the devops-engineer owns the workflow):

```yaml
- name: Check the live backend is configured
  run: node supabase/scripts/check-live-config.mjs
  env:
    VITE_API_MODE: live
    VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
```

It exits 1, with a plain-language list of what to fix, when:

- `VITE_API_MODE` is `mock`;
- `VITE_SUPABASE_URL` is missing, is not an `https://` project URL, or is a placeholder;
- `VITE_SUPABASE_ANON_KEY` is missing or a placeholder;
- the key is a service-role or `sb_secret_` key, which would publish your database to the world. If this ever fires for a real key, rotate that key in the dashboard.

You can run the same check on your own machine before pushing: `VITE_API_MODE=live VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<key> node supabase/scripts/check-live-config.mjs`, or `node supabase/scripts/check-live-config.mjs --file .env.production`. It never prints a key. As a second line of defence the same file exports a Vite plugin, `requireLiveBackend()`, that fails `vite build` when `VITE_API_MODE=live` and the variables are wrong (see `docs/api.md` section 12).

### 10. Keep the Free project awake (keep-alive)

A Free project pauses after about 7 days without activity (confirm on supabase.com/pricing). The `keep-alive` function runs one read-only query, so a scheduled call counts as activity on every layer it can reach. It writes nothing, never calls purge and needs only the public anon key.

1. Check it by hand (use the same public key as step 8). Expect HTTP 200 and exactly three keys, `{"ok":true,"checkedAt":"<now, UTC>","purgeHealthy":true}`:

   ```bash
   curl -sS -X POST "https://<ref>.supabase.co/functions/v1/keep-alive" \
     -H "Content-Type: application/json" -H "apikey: <anon-or-publishable-key>" -d '{}'
   ```

2. The scheduled workflow (`.github/workflows/keep-alive.yml`, owned by the devops-engineer) calls it daily with the two repository variables from step 9. A red run in GitHub Actions means the keep-alive failed.
3. GitHub switches off scheduled workflows in a public repository after 60 days with no repository activity. Every 50 days, open Actions and check that the latest keep-alive run is green and recent. If it was disabled, choose **Enable workflow**, then **Run workflow** once.
4. If Supabase pauses the project anyway, restore it in the dashboard first, then re-run the workflow. Expired museums are purged within a few hours of the restore.
5. Usage (database, storage, egress) is checked in the dashboard only (Usage page). The keep-alive reports no figure. Read-only SQL for the SQL editor is in ADR 0022, section 3.
6. **`purgeHealthy` (ADR 0023).** The one flag the keep-alive adds. It is `false` when any of these is true at the moment of the call: no purge run has finished in the last 3 hours (or none has ever been recorded); the oldest entry in the storage-delete queue is older than 3 hours; a museum or draft that ended more than 3 hours ago is still in the database. Exactly 3 hours is healthy. A failed health check also answers 200 with `false`. It writes nothing. The purge writes the heartbeat itself, as its last step: a run that reached the end counts, even if some file deletes failed (those show in the queue check). A wrong secret or an error part-way records nothing.

   When the workflow shows `purge: unhealthy`, check in this order (SQL editor, read-only):

   ```sql
   select last_success_at, now() - last_success_at as age from public.purge_heartbeat;   -- no row: no run recorded yet
   select museum_id, enqueued_at, attempts, last_error from public.storage_purge_queue order by enqueued_at;
   select count(*), min(expires_at) from public.museums where expires_at <= now() - interval '3 hours';
   select status, return_message, start_time from cron.job_run_details
     where jobid = (select jobid from cron.job where jobname = 'surprise-museum-purge')
     order by start_time desc limit 5;
   ```

   - No heartbeat row or an old one, with the queue and expired counts empty: the purge function is not finishing. Read the `purge-expired` logs (Edge Functions, Logs). A wrong `CRON_SECRET` (Vault secret differs from the function secret) answers 404 and records nothing; a missing `CRON_SECRET` answers 500. Note that a "succeeded" cron status only means the SQL that starts the HTTP call ran.
   - Queue rows with a high `attempts` and a `last_error`: Storage deletes keep failing. Check the Storage status page, then wait for the next hourly run.
   - A fresh deploy: `false` for up to about 60 minutes until the first purge. Run the smoke test after the next minute-17 run.
   - The workflow is also red if the deployed function is older than ADR 0023 (no `purgeHealthy` key). Deploy the functions first (release order below).

### Space full (ADR 0024)

`create-museum`, `manage-museum` `reserve-photo`, and a `publish` that lists a photo not yet stored are refused with 409 `space_full` while file storage in use is at or above `SPACE_FULL_STORAGE_BYTES` (default 800,000,000) or database size is at or above `SPACE_FULL_DATABASE_BYTES` (default 400,000,000). Everything else works: Visitors, the edit page, delete, `renew-upload`, `confirm-photo`, the keep-alive and the purge. The two figures are read by `public.space_usage()` on each such request (no cache), so the service resumes by itself once the purge frees space. If that read fails, the request goes ahead and the function logs `space check unavailable (<error name>)`: the guard is a safety net and fails open, so watch the logs for that line. The app cannot see egress or Edge Function invocations; check those in the dashboard.

### Release order for iteration 5

1. `npx supabase db push` (the new migrations `20261126000100_purge_heartbeat.sql` and `20261126000200_space_usage.sql`), then deploy all five functions. Migrations first: if the functions went first, `record_purge_success()` would not exist and each purge would answer 500 after doing its work.
2. Wait past the next minute-17 purge, then run the smoke test. Expect `purge: healthy`.
3. Only then merge the two-step `keep-alive.yml` (it turns red on anything but `purgeHealthy: true`).

## Local development

Without Docker, use the mock (`npm run dev`) and the in-memory dev server below. With Docker you can run the real stack.

### The in-memory dev server (needs Deno, not Docker)

Runs the real function handlers over real HTTP with an in-memory store, so you can try the exact request flow, including the signed upload `PUT`:

```bash
deno run --allow-net --config supabase/functions/deno.json supabase/functions/tests/devServer.ts
node supabase/scripts/smoke-test.mjs http://localhost:8787 any-key
```

To point the website at it, set `VITE_SUPABASE_URL=http://localhost:8787` and `VITE_SUPABASE_ANON_KEY=any` in `.env.local`, and add `http://localhost:5173` to its allowed origins (it already is).

### The full local Supabase stack (needs Docker)

```bash
npx supabase start                                                    # Postgres, Storage, Auth
cp supabase/functions/.env.example supabase/functions/.env            # then set the values; add PUBLIC_API_URL=http://127.0.0.1:54321
npx supabase functions serve --env-file supabase/functions/.env
node supabase/scripts/smoke-test.mjs http://127.0.0.1:54321 <local anon key from `supabase status`>
```

`PUBLIC_API_URL` tells the functions which address the browser uses for Storage, because inside the local runtime `SUPABASE_URL` is an internal address.

## Tests

| Command | What it covers |
|---|---|
| `npm test` | Vitest: token derivation and hashing, the JPEG metadata checker (including Safari-shaped fixtures checked against the browser's stripper), validation, the live client, the mock API and its IndexedDB and `localStorage` persistence, the production guard (`src/api/__tests__`) |
| `node supabase/scripts/check-live-config.mjs` | The production-build guard (also covered by Vitest `liveConfigGuard.test.ts`) |
| `deno test --config supabase/functions/deno.json supabase/functions` | The five handlers end to end against an in-memory store: lifecycle, uniform 404, CORS, rate limits, `confirm-photo` checks, retention (7 days), purge (heartbeat), keep-alive (writes nothing, the 3-hour purge-health rule, fail-soft), the space-full guard and its configuration |
| `deno lint --config supabase/functions/deno.json supabase/functions` | Lint for the function code (the root ESLint config skips this folder) |
| `deno check --config supabase/functions/deno.json supabase/functions/*/index.ts` | Type-checks the entry points against the real `supabase-js` types |
| `npx supabase test db` | pgTAP: `tests/database/lockdown.test.sql` and `purge_health_space.test.sql` (needs Docker) |
| `node supabase/scripts/smoke-test.mjs <url> <key>` | A live or local backend, end to end |

## Operations

| Task | How |
|---|---|
| Rotate the cron secret | Generate a new value, run `vault.update_secret` (step 5), then `npx supabase secrets set CRON_SECRET=<new>` |
| Rotate the IP salt | `npx supabase secrets set RATE_LIMIT_SALT=<new>`. Rate-limit counters restart, which is harmless |
| Change allowed origins | Edit `ALLOWED_ORIGINS` and run `npx supabase secrets set --env-file supabase/functions/.env` |
| Redeploy after a code change | `npx supabase functions deploy --no-verify-jwt` |
| Add a migration | `npx supabase migration new <name>`, write idempotent SQL, then `npx supabase db push` |
| See purge runs | `select * from net._http_response order by created desc limit 20;` and the function logs |
| See stuck storage clean-ups | `select * from public.storage_purge_queue;` (rows are retried hourly; `last_error` holds the kind of failure only) |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every call returns 500 "The service is not configured." | A function secret is missing. The function logs name the missing variables (`ALLOWED_ORIGINS`, `RATE_LIMIT_SALT`, ...). Set them (step 6) |
| Browser console shows a CORS error, or the response is 403 "Origin not allowed." | The site's origin is not in `ALLOWED_ORIGINS`. It must match exactly, with no path or trailing slash |
| Uploads fail with 400 or 403 from Storage | The signed URL expired (2 hours). Call `renew-upload`. Also check the browser sends `Content-Type: image/jpeg` and `x-upsert: true` |
| `confirm-photo` returns 422 for photos that look fine | The file still contains a metadata segment or has an unusual encoding. `field` says which file. Check the browser's re-encode step. If a particular device always fails, capture the file and report it to the backend-developer |
| Share links return 404 for a museum that was just published | The link was built from the wrong token, or the museum was deleted or has expired. Draft museums are never readable by share link |
| The deployed site says it is "not connected to its server" | It was built without the two `VITE_` variables. The deploy guard should have stopped this; check the workflow runs `check-live-config.mjs` with `VITE_API_MODE=live` and that the variables are set under **Variables**, not only **Secrets** |
| A QA or preview build shows `unconfigured` errors | Production builds no longer fall back to the mock. Build with `VITE_API_MODE=mock` |
| Demo mode says the demo storage is full | The mock caps photo storage (3 MiB in `localStorage`, 200 MiB in IndexedDB). Call `clearDemoData()` or clear the site's data in the browser |
| `confirm-photo` returns 422 for an iPhone photo | Safari writes APP1 and APP13 segments; the browser must strip them before upload (`src/media/jpeg.ts`). A raw Safari file is refused by design |
| Every call returns 500 "not configured" after setting a space threshold | `SPACE_FULL_STORAGE_BYTES` or `SPACE_FULL_DATABASE_BYTES` is not a whole number from 1 to 1000000000000 (the log names the variable). Fix it with `npx supabase secrets set`, or unset it for the default |
| Creators see "Surprise Museum is full for now" | Storage or database use passed its threshold. Check the Usage page, free space (delete test data, wait for the purge) or raise the threshold if Q-34 confirms more room |
| Purge job does nothing | Vault secrets missing (step 5), `CRON_SECRET` differs from the Vault value, or the project is paused (see step 10) |
| `db push` fails on `cron` or `net` | Enable **pg_cron** and **pg_net** in Database, Extensions, then push again |

## Security checks to keep green

- `anon` and `authenticated` cannot select, insert, update or delete any table in `public`, and cannot call any function there (pgTAP: `tests/database/lockdown.test.sql`).
- `anon` and `authenticated` cannot read `purge_heartbeat` or run `record_purge_success()`, `purge_health_inputs()` or `space_usage()` (pgTAP: `tests/database/purge_health_space.test.sql`).
- `anon` cannot list, read or upload objects in the `photos` bucket, and no policy exists on `storage.objects` (same test, and the lockdown `curl` checks in step 8).
- `get-museum` and `manage-museum` return the same 404 body for a malformed, unknown, draft, expired and deleted token (Deno test "every bad link returns the identical 404 body").
- The database holds only SHA-256 hashes of tokens (Deno test "stores only hashes").
- No function logs a request body, token, name, caption or file name. Errors log a kind and a code only.
- `confirm-photo` refuses EXIF, XMP, IPTC, comments and appended data, and deletes the files (Vitest `jpeg.test.ts`, Deno test "confirm-photo rejects EXIF").
