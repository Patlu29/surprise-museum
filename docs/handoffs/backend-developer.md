# Handoff: backend-developer

## Summary
I built the whole Supabase backend: idempotent migrations, four Edge Functions (including `confirm-photo` with byte-level JPEG checks), the typed `src/api` client with an in-memory mock that is selected automatically when no Supabase project is configured, the contract in `docs/api.md`, and a step-by-step setup guide in `supabase/README.md`. Nothing is deployed and no cloud resource exists; the user still has to create the project. Everything that can run without a project was run: 102 Vitest tests, 25 Deno tests, the SQL against real Postgres (PGlite), and a smoke test over real HTTP.

## Files changed
- `supabase/migrations/20261027000100_initial_schema.sql`: rewritten idempotent; tables, constraints, RLS with no policies, grants revoked, `usage` on the schema revoked from `anon` and `authenticated`
- `supabase/migrations/20261027000110_functions.sql`: new; `rate_limit_hit`, `rate_limit_blocked`, `reserve_photo`, `publish_museum` (atomic publish), `delete_museum_rows`, `expire_museums`; all `service_role` only
- `supabase/migrations/20261027000120_storage_bucket.sql`: new; private `photos` bucket (JPEG, 2 MiB), no storage policies
- `supabase/migrations/20261027000200_retention_schedule.sql`: rewritten; `invoke_purge_expired()` reads the Vault secrets, hourly pg_cron jobs, safe when secrets are missing
- `supabase/functions/_shared/`: `contract.ts` (added `PurgeExpiredResponse`), `tokens.ts`, `jpeg.ts`, `validate.ts` (pure, shared with the mock), `http.ts`, `config.ts`, `ports.ts`, `present.ts`, `supabaseBackend.ts`, `boot.ts`, `testing/` (in-memory backend and JPEG fixtures, test-only)
- `supabase/functions/{create-museum,get-museum,manage-museum,purge-expired}/`: `index.ts`, `handler.ts`, `deno.json`; plus `supabase/functions/deno.json` (import map, tasks)
- `supabase/functions/tests/`: `flow_test.ts`, `purge_test.ts`, `helpers.ts`, `devServer.ts`
- `supabase/functions/.env.example`: added optional `PUBLIC_API_URL` and a note not to set `SUPABASE_*`
- `supabase/tests/database/lockdown.test.sql`: pgTAP, 21 assertions
- `supabase/scripts/smoke-test.mjs`: end-to-end check of a deployed or local backend
- `supabase/README.md`: full setup guide, local development, tests, operations, troubleshooting
- `src/api/`: `index.ts`, `liveClient.ts`, `mockClient.ts`, `mode.ts`, `shared.ts`, `__tests__/` (6 files)
- `docs/api.md`: full contract with examples

## Decisions
- **Error shape follows `contract.ts`, not the api-conventions skill.** Responses are `{ error: <code>, message, field? }`, not `{ error: { code, message, details } }`. The frontend and stores already code against `ApiError`, and changing it would break them. All deviations from the skill (no `/api/v1`, no 401 or 403 for access problems, 200 for delete, no list endpoints) are tabled in `docs/api.md` section 1.
- **`src/api` implements the frontend's existing `MuseumApi` port** (`src/lib/apiPort.ts`) and reuses its `ApiRequestError`, so `instanceof` checks in the stores keep working. This means `src/api` imports from `@/lib`, a small step outside the import table in architecture section 4 (the ESLint config allows it).
- **Mock mode is faithful, not a stub.** It runs the same validators, the same JPEG checker on the uploaded bytes, the same limits, expiry and uniform `not_found`. It is in-memory only: a reload or a second tab starts empty.
- **Shared server modules import only `@contract`** (no sibling imports). That lets the same files resolve in Deno (import map), Vite and `tsc` without file extensions, which is how the mock and Vitest reuse the server rules without editing root config.
- **JPEG allow-list, not deny-list.** Only JFIF (no thumbnail), ICC profile and Adobe marker application segments are accepted; every other APPn and every COM segment is rejected, as is anything after EOI. Documented in `docs/api.md` section 9.
- **`facialHair` must be `none` for the Visitor avatar**, as `contract.ts` says ("always none for the Visitor in v1"), and is enforced on publish.
- **Rate-limit key:** `cf-connecting-ip` (not forgeable), then `x-real-ip`, then the first `x-forwarded-for` entry; IPv6 counts by /64. After 20 not-found lookups in 10 minutes a client gets 429 on every lookup, including valid ones, until the window ends.
- **Cross-origin refusal:** an `Origin` not in `ALLOWED_ORIGINS` gets 403 and no work is done; requests with no `Origin` (cron, curl) pass.
- **Status codes:** 201 for `create-museum` and `reserve-photo`; 200 for other actions; 405, 413, 415 and the 403 above use the `bad_request` code. Contract additions are listed in `docs/api.md` section 13.
- **`remove-photo`** is idempotent, and refuses (409) to remove a photo that is part of the published museum.
- **`confirm-photo` on failure** deletes both objects but keeps the photo reserved and `pending`, so `renew-upload` works for a retry.
- **Publish is one database function** (`publish_museum`), so photo order, captions and avatars change atomically; retention comes from the first publish only.

## Assumptions
- A request body that is not `{}` is rejected by `create-museum`.
- Signed upload URLs from supabase-js accept `PUT` with `Content-Type: image/jpeg` and `x-upsert: true` (the contract already says so). The Storage upload path has **not** been exercised against real Storage; the dev server and smoke test model it.
- Canvas-encoded JPEGs from Chrome, Firefox and Safari contain only JFIF (and possibly an ICC profile or Adobe marker). If a browser writes some other segment, `confirm-photo` will reject its photos.
- PostgREST returns `setof uuid` as an array of strings (the adapter also accepts objects).
- The Data API stays enabled with `public` exposed, because the functions use it; safety comes from the revoked privileges and RLS.

## Open questions
- Supabase plan (the free plan pauses inactive projects and has no backups, which could break a gift link and stop the purge job). Plan, pricing and contract questions go to the Sales team. (user)
- Should the mock persist across reloads (IndexedDB)? I kept it in-memory as asked; persistence would help manual demos of share links across tabs. (frontend-developer, user)

## Requests for other agents
- **frontend-developer:**
  - Call `registerApi()` from `@/api` once in `src/main.tsx` before rendering. Until then `getApi()` throws `unconfigured`, because no factory is registered.
  - Delete `src/lib/httpApi.ts`; `src/api/liveClient.ts` replaces it (same behaviour, plus retries on reads and a fix so a pre-aborted upload rejects with `aborted`).
  - Use `getApiMode()` from `@/api` to show a "Demo mode, nothing is saved online" notice when it returns `"mock"`. Do not gate features on `isBackendConfigured`; the mock covers everything except cross-tab links.
  - `confirmPhoto` can return `invalid_image` with `field` `full`, `wall` or `width`, and `bad_request` with `field: "lqip"`. The 24 px placeholder must be a clean JPEG (no metadata) of at most 32 px on its long edge.
  - Visitor `facialHair` must be `"none"` in the document you publish.
  - Show the edit token once; the server cannot recover it.
- **architect:**
  - Add `VITE_API_MODE` (`mock`, `live` or blank for automatic) to `.env.example` and `vite-env.d.ts`.
  - Update `docs/architecture.md` section 7.3 to match `docs/api.md` (201 on create and reserve, `purge-expired` returns `{ purged, retried, failed }`, 403 for a disallowed origin).
  - Optionally make `supabase/functions/_shared/**/*.ts` linted: the current ESLint ignore list skips it, so those files rely on `tsc` (via `src/api`) and `deno lint`.
- **devops-engineer:**
  - Add a CI job for the Deno checks (`deno test`, `deno lint`, `deno check` with `--config supabase/functions/deno.json`). The root `npm test` does not run them.
  - The deploy workflow needs `npx supabase db push` then `npx supabase functions deploy --no-verify-jwt`, and can run `node supabase/scripts/smoke-test.mjs` afterwards against the live project.
  - `npx supabase test db` runs the pgTAP file but needs Docker.
- **qa-engineer:**
  - Mock mode is the default when no env vars exist, so end-to-end tests run without Supabase. A reload loses mock data, so keep a flow in one page load.
  - Test real devices: a photo from iOS Safari and from Chrome must pass `confirm-photo` (see the JPEG assumption above).
  - Add a post-deployment run of `supabase/scripts/smoke-test.mjs`.

## Verification
| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm test` (whole repo) | Pass, 274 tests across 20 files, 102 of them in `src/api` |
| `npm run lint` | Fails, 11 errors, **none in my files**: 9 in `src/scene/...` (type-only imports, owner: scene-developer and technical-artist) and 2 in `src/ui/...` (owner: frontend-developer). `src/api` is clean. `supabase/functions` is excluded from ESLint by the root config |
| Deno: `test`, `lint`, `check` | Pass, 25 tests, 24 files, 4 entry points |
| Migrations | Applied twice (idempotent) to real Postgres via PGlite with stubbed Supabase schemas; atomic reserve, publish, expire, delete, rate-limit and the Vault job function all tested; anon and authenticated denied on every table and function |
| pgTAP file | All 21 assertions pass against PGlite using a stand-in for pgTAP's functions; **not** run under real pgTAP |
| Server starts | Each `index.ts` boots under Deno: JSON 500 when unconfigured, then preflight, origin refusal and safe failure with config set. `supabase functions serve` was not run (no Docker) |
| Smoke test | 15 of 15 steps pass over real HTTP against the real handlers with the in-memory store |

## Risks
- **Not yet run against a live Supabase project.** The Supabase adapter (`_shared/supabaseBackend.ts`) is type-checked against the real `supabase-js` 2.118.0 types but has no live test. Run `supabase/scripts/smoke-test.mjs` straight after the first deploy; that is the first real proof of the Storage upload, signed URLs and RPC calls.
- **`confirm-photo` strictness** may reject photos from a browser that writes an unexpected JPEG segment. The failure is safe (clear message, retry possible), but it would block publishing on that device until the allow-list is widened.
- **Storage signed-upload semantics** (`x-upsert`, 2 MiB limit, MIME check) rely on Supabase's behaviour and are untested live.
- **Rate limiting by IP** depends on `cf-connecting-ip`; behind a shared NAT many people share one limit.
- **Free-plan pause** would also pause the purge job (ADR 0010).
- **Mock data is lost on reload**, so a share link cannot be tested across tabs in mock mode.
