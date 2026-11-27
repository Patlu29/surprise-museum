# Handoff: backend-developer

## Iteration 5 Build step 1 (27/11/2026): API contract only

Phase 3 Build. Only `docs/api.md` (v1.2 to v1.3) and this note changed. No migration, handler, test, deploy or commit.

### Summary
`docs/api.md` now matches ADR 0023, ADR 0024 and architecture 7.7, 7.8, 8.2. Changed: header and change log (section 13); section 1 table; section 4 (`space_full` row, new "Space full" subsection); section 5 (limit row, create-museum rate note); sections 7, 9 (`reserve-photo`, `publish`); section 10 (heartbeat); section 10a (200 body, purge-health rules, 5 s timeout, still-200 rule); section 12 (mock switch, no keep-alive in the mock). `CONTRACT_VERSION` stays 1.

### Exact shapes
- keep-alive 200: `{ "ok": true, "checkedAt": "<ISO>", "purgeHealthy": <boolean> }`, exactly three keys. Health-check error or timeout: still 200, `purgeHealthy: false`. `keep_alive()` failure: 500 as before.
- space_full: 409 `{ "error": "space_full", "message": "Surprise Museum is full for now. Please try again later." }`, no `field`, no figures. Gated: `create-museum`, `reserve-photo`, `publish` only with a listed non-ready photo. Fail open. Defaults 800,000,000 and 400,000,000 bytes; optional secrets `SPACE_FULL_STORAGE_BYTES`, `SPACE_FULL_DATABASE_BYTES` (whole number 1 to 1e12, else ConfigError and 500).
- purge-expired: unchanged body; `record_purge_success()` at the end of a run that reaches it (also with `failed > 0`); nothing on 404, 500 or a throw.
- Mock: `setSpaceFull`, `MockApiOptions.spaceFull`, `setDemoSpaceFull`, `__APP_TEST__.setMockSpaceFull` (mock mode, dev and test builds). The mock has no keep-alive or purge-health value: keep-alive is not on the `MuseumApi` interface (checked with grep in `src/api` and `src/lib/apiPort.ts`).

### Verification
| Check | Result | Label |
|---|---|---|
| `prettier --check docs/api.md` | passed | Verified |
| Read-through against ADR 0023, ADR 0024, architecture 7.7, 7.8, 8.2 for each shape above | matches | Verified |
| `STATUS_BY_CODE` in `http.ts` has no `space_full` yet; `mockClient.ts`, `liveClient.ts` have none of the new names | Expected: code is the next task | Verified (grep) |
| Behaviour of any endpoint | Nothing implemented yet | Not verified |

### Contradictions found (none inside api.md now)
| # | Where | Issue | Who |
|---|---|---|---|
| 1 | ADR 0023, ADR 0024, ADR 0010 and ADR 0022 amendments, architecture header and 7.x | Status still "Proposed, awaiting A2"; the user approved at A2 on 27/11/2026 | architect |
| 2 | `supabase/functions/keep-alive/handler.ts` header comment | Still says the endpoint reveals nothing but the clock | backend-developer (next task) |
| 3 | `supabase/README.md` | Not yet checked for the keep-alive body, five-function steps and new secrets; will update with the build | backend-developer (next task) |
| 4 | ADR 0024 section 3 says publish measures "in the existing readiness pre-check" | The pre-check is in the publish handler; the exact code position is for the build task to confirm | backend-developer |

### Decisions
- `space_full` rate-limit wording: a `create-museum` refusal still counts toward 10 drafts an hour (ADR 0024 section 3 order: rate limit, then space check).
- Added a "Space full" subsection to section 4 rather than a new top-level section, so section numbers other documents cite do not move.

### Not done
- Migrations (`purge_heartbeat`, `purge_health_inputs`, `space_usage`), handlers, `contract.ts`, `http.ts`, ports and backends, mock and client changes, config parsing, `.env.example`, smoke test, tests, keep-alive handler comment: the next task.

### Open questions
- None for the user. Q-34 (confirmed Free plan limits) could change the default thresholds; they are overridable by secret, with no code change.

### Requests for other agents
- [open] architect: mark ADR 0023, ADR 0024 and the amendments Accepted (A2, 27/11/2026); update the architecture header.
- [open] frontend-developer: build against `docs/api.md` v1.3: `space_full` in `KNOWN_CODES`, `isSpaceFull`, `setDemoSpaceFull`. I (backend-developer) will add the mock's `setSpaceFull` and `setDemoSpaceFull` in `src/api` in the build task; confirm that is wanted there, since `src/api` was built by me in iteration 1.

## Iteration 4 Build (19/11/2026): 7-day retention and keep-alive

Phase 3 Build. Nothing deployed, committed or linked to a Supabase project.

### Summary
`LIMITS.retentionDays` is 7. A fifth Edge Function, `keep-alive`, is added exactly as ADR 0022 section 4 describes: `POST /functions/v1/keep-alive`, body `{}`, 200 `{ ok: true, checkedAt }` with `checkedAt` from `public.keep_alive()` (Postgres `now()`). It has no rate limit, writes nothing, never calls purge and needs only the anon key. `docs/api.md` is v1.2.

### Files changed
- `supabase/functions/_shared/contract.ts`: `retentionDays: 7`; `FUNCTION_NAMES.keepAlive`, `KeepAliveRequest`, `KeepAliveResponse`. `CONTRACT_VERSION` stays 1.
- `supabase/functions/_shared/ports.ts`, `supabaseBackend.ts` (`client.rpc('keep_alive')`, rejects a non-timestamp), `testing/memoryBackend.ts` (returns its clock; `failKeepAlive` flag): the `keepAlive()` store method.
- `supabase/functions/keep-alive/` (`index.ts`, `handler.ts`, `deno.json`, `.npmrc` with the public registry, `deno.lock` with no `tarball` lines).
- `supabase/migrations/20261118000100_keep_alive.sql`: `keep_alive()`, stable, `search_path=''`, executable by `service_role` only.
- `supabase/config.toml`: `[functions.keep-alive] verify_jwt = false`.
- Comments fixed: `20261027000100_initial_schema.sql`, `20261027000200_retention_schedule.sql`, `purge-expired/handler.ts`.
- Tests: new `tests/keep_alive_test.ts` (8 tests); `purge_test.ts` publishes on day 3, expires on day 10; `flow_test.ts` uses `LIMITS.retentionDays` and 8 days; `helpers.ts` and `devServer.ts` wire the new handler.
- `supabase/tests/database/lockdown.test.sql`: 4 keep_alive checks (anon, authenticated, service_role, stable); plan 21 to 25.
- `supabase/scripts/smoke-test.mjs`: a keep-alive check first.
- `supabase/README.md`: Free plan decided (step 1), five functions, smoke-test note, new step 10 (keep-alive, 50-day check, restore).
- `docs/api.md` v1.2: sections 1, 5, 9, 10, 11, new 10a `keep-alive` (numbered 10a so no existing section reference shifts), change-log row. No 90-day text remains.

### Verification
| Check | Result | Label |
|---|---|---|
| `deno check` (CI command, Deno 2.9.6, fresh `DENO_DIR`, public registry) | 5 entry points checked, pass | Verified |
| `deno lint` | 27 files, pass | Verified |
| `deno test` | 35 passed, 0 failed (27 before plus 8 keep-alive) | Verified |
| Keep-alive writes nothing | Test: 30 calls leave museums, photos, objects, queue and `rateHits` unchanged; expired museum not purged | Verified |
| Error cases 400, 405, 413, 415, 500 | One test each (keep_alive_test.ts) | Verified |
| `npm run typecheck`, `npm test` from root | pass; 72 files, 1084 tests | Verified |
| Dev server (in-memory handlers over HTTP) and `smoke-test.mjs` | 16 PASS, exit 0; keep-alive 200 and 400 compared with api.md; server stopped, port 4173 untouched | Verified |
| Search for the private mirror hostname (tracked and untracked files) | none | Verified |
| `keep_alive()` SQL, grants, pgTAP file, `config.toml` entry, the real Supabase client call | No Docker or Supabase project here | Not verified |
| Whether Supabase counts the call as activity | Needs 7 or more days on a real project (ADR 0022) | Not verified |

### Decisions
- Section number 10a for keep-alive in `docs/api.md`, to keep sections 11 to 13 stable for other documents.
- `docs/api.md` states that a publish on an expired museum returns the uniform 404 (existing behaviour: lookups filter `expires_at`).
- `deno fmt` is not the project formatter (Prettier is); it was run once by mistake, the unrelated reformatting was reverted, and the changed files pass `prettier --check`.

### Requests for other agents
- [open] devops-engineer: `.github/workflows/keep-alive.yml` per ADR 0022 section 5. Add `keep-alive` to the deploy-supabase workflow's function list if it names functions (deploy uses `--no-verify-jwt`; push the migration first). Check ci.yml still matches: its `deno check` glob already includes the new `index.ts`.
- [open] architect: Deno does not use `keep-alive/deno.lock` in CI (CI passes the root `deno.json`), as for the other per-function locks.
- [open] frontend-developer: none. The 7-day constant changed and the root `npm test` still passes with your current `mockClient.test.ts`.

## Iteration 4 CI fix (18/11/2026): Deno lockfiles

The first real run of the `deno` CI job failed because the three committed lockfiles (`supabase/functions/deno.lock`, `create-museum/deno.lock`, `manage-museum/deno.lock`) held `"tarball"` URLs on a private corporate npm mirror (9 per file). Deno rejects them against the public registry, and the repo is public. I regenerated all three with Deno 2.9.6 (run through `npx`, with `NPM_CONFIG_REGISTRY=https://registry.npmjs.org` and a scratch `DENO_DIR`, per command only) in a scratch copy, then copied the lockfiles back. Only the `tarball` lines are gone; every `integrity` value is unchanged. A search for the private mirror hostname now finds nothing. With the fresh lockfile, `deno check`, `deno lint` and `deno test` (the exact CI commands) passed: 4 entry points checked, 24 files linted, 27 tests passed. Deno 2.9.8 (the CI version) is not on npm (latest 2.9.6), so that exact version was not run. The Deno commands are now Verified on 2.9.6, which supersedes the "Deno not run" statements below. Reminder: regenerate lockfiles with the public registry only (ADR 0013). The per-function lockfiles are not used by the CI commands, which use the root `deno.json`.

## Summary
**CR-1 update (30/10/2026):** the shared validator accepts and normalises the optional avatar `gender`, the Visitor facial hair rule is gone, the presenters and the mock always return `gender` (old rows read as `neutral`, nothing rewritten), tests are added or inverted, and the "not implemented yet" note is removed from `docs/api.md`. Deno is not installed on this machine, so `deno check`, `deno lint` and `deno test` were NOT run; the Deno test and smoke-test edits are unverified. The earlier summary follows.

I built the whole Supabase backend: idempotent migrations, four Edge Functions (including `confirm-photo` with byte-level JPEG checks), the typed `src/api` client, the contract in `docs/api.md`, and a step-by-step setup guide in `supabase/README.md`. Nothing is deployed and no cloud resource exists; the user still has to create the project. Integration round 1 (28/10/2026) added three things: the server and mock now accept every JPEG segment the browser keeps (with a Safari regression fixture), the mock persists in IndexedDB with a localStorage fallback, a size cap and "clear demo data", and production builds are always live with a deploy guard that fails when the Supabase variables are missing.

## Files changed
**CR-1 (gender and Visitor facial hair)**
- `supabase/functions/_shared/validate.ts`: `gender` allowed key; absent gives `neutral`, any other non-listed value (including `null`) fails with `field.gender` and "Choose one of the available options."; Visitor facial hair rule deleted; `validateAvatar` lost its `role` parameter
- `supabase/functions/_shared/present.ts`: `toMuseumContent` (and so `toMuseumDocument`) returns `gender: avatarGender(avatar)` for both avatars
- `src/api/mockClient.ts`: `get-museum` and `manage-museum get` fill `gender` the same way from stored demo state; stored state is not rewritten
- `src/api/__tests__/validate.test.ts`, `mockClient.test.ts`: Guide-only cases inverted; added absent, `null`, `''`, `'Woman'`, `1` (plus others), each valid id, absent stored as neutral, legacy record reads neutral and is unchanged in storage, round trip keeps other fields
- `supabase/functions/tests/helpers.ts`, `flow_test.ts`: default document sends genders and a Visitor beard; new Deno test for validation, absent gender, and legacy rows (unrun)
- `supabase/scripts/smoke-test.mjs`: sends `gender` and a Visitor beard and checks them on read
- `docs/api.md`: removed the v1.1 header note; change log row updated; reviewed the architect's v1.1 edits (no corrections needed)

**Original build**
- `supabase/migrations/20261027000100_initial_schema.sql`, `...000110_functions.sql`, `...000120_storage_bucket.sql`, `...000200_retention_schedule.sql`: idempotent schema, RLS with no policies, revoked grants, atomic DB functions (`reserve_photo`, `publish_museum`, `delete_museum_rows`, `expire_museums`, rate limits), private bucket, hourly pg_cron jobs
- `supabase/functions/_shared/`: `contract.ts` (added `PurgeExpiredResponse`), `tokens.ts`, `jpeg.ts`, `validate.ts`, `http.ts`, `config.ts`, `ports.ts`, `present.ts`, `supabaseBackend.ts`, `boot.ts`, `testing/`
- `supabase/functions/{create-museum,get-museum,manage-museum,purge-expired}/` (`index.ts`, `handler.ts`, `deno.json`), `supabase/functions/deno.json`, `supabase/functions/.env.example`
- `supabase/functions/tests/` (`flow_test.ts`, `purge_test.ts`, `helpers.ts`, `devServer.ts`), `supabase/tests/database/lockdown.test.sql`, `supabase/scripts/smoke-test.mjs`
- `src/api/` (`index.ts`, `liveClient.ts`, `mockClient.ts`, `mode.ts`, `shared.ts`, `__tests__/`), `docs/api.md`, `supabase/README.md`

**Integration round 1**
- `supabase/functions/_shared/jpeg.ts`: APP0, APP2 and APP14 rules widened to match what the browser keeps (see Decisions); APP1, APP13 and every other APPn are still rejected
- `supabase/functions/_shared/testing/jpegFixtures.ts`: added `safariCanvasJpeg({ width, height, stripped })`
- `supabase/functions/tests/flow_test.ts`: new Deno test, raw Safari output refused and stripped output confirmed
- `src/api/__tests__/clientCompat.test.ts`: new; runs the browser's real `stripJpegMetadata` over the Safari fixture and checks the server checker and the mock both accept the result
- `src/api/demoStorage.ts`: new; IndexedDB, localStorage and memory backends behind one interface, automatic choice, cross-tab lock, size capacity
- `src/api/mockClient.ts`: rebuilt around load, apply, save transactions against `DemoStorage`; new `reset()` (async) and `info()`
- `src/api/mode.ts`, `src/api/index.ts`: production builds always live unless `VITE_API_MODE=mock`; new exports `clearDemoData()`, `getDemoDataInfo()`, storage types
- `src/api/__tests__/`: `demoStorage.test.ts`, `mockPersistence.test.ts`, `fakes.ts` (fake IndexedDB and localStorage), `liveConfigGuard.test.ts`, updated `mode.test.ts` and `mockClient.test.ts`
- `supabase/scripts/check-live-config.mjs` and `.d.mts`: new; deploy guard as a command and an optional Vite plugin
- `docs/api.md` (sections 9 and 12, change log), `supabase/README.md` (mock and production rules, step 9, tests, troubleshooting)

## Decisions
- **Error shape follows `contract.ts`, not the api-conventions skill** (`{ error: <code>, message, field? }`). Deviations from the skill are tabled in `docs/api.md` section 1.
- **`src/api` implements the frontend's `MuseumApi` port** (`src/lib/apiPort.ts`) and reuses its `ApiRequestError`, so `instanceof` checks in the stores keep working.
- **Shared server modules import only `@contract`**, so the same files resolve in Deno, Vite and `tsc`, and the mock reuses the server's validators and JPEG checker.
- **JPEG allow-list (round 1 wording).** Accepted: APP0 `JFIF\0` up to 14 bytes (a thumbnail size, if present, must be 0 by 0); APP2 `ICC_PROFILE\0` with any body; APP14 `Adobe` up to 12 bytes. Rejected: APP1 (Exif, XMP), APP13 (Photoshop, IPTC), every other APPn, COM, anything after EOI. I widened the lower bounds (a short JFIF header or a header-only ICC chunk now pass) because the frontend's own fixtures use them and they leave no room for personal data. The browser keeps APP0, APP2 and APP14 by marker only, so `clientCompat.test.ts` fails if the two sides ever drift.
- **Production builds are always live** unless `VITE_API_MODE=mock` is set explicitly. Blank means live in a production build, so a missing variable produces loud `unconfigured` errors instead of a silent demo. In development, blank still means "mock when the Supabase variables are absent".
- **The guard is opt-in for the Vite plugin** (only when `VITE_API_MODE=live`), so ordinary local builds and QA builds with `VITE_API_MODE=mock` still work. The CLI is what the deploy workflow runs. The flag to read a file is `--file`, because Node itself intercepts `--env-file`.
- **The guard also rejects a service-role JWT or an `sb_secret_` key in `VITE_SUPABASE_ANON_KEY`**, because that value is published to the world.
- **Mock persistence design.** Each call loads the latest state from storage, applies the change and saves only if something changed, under the Web Locks API where available plus an in-tab queue. That is what makes a second tab see new data without any messaging. Photo bytes are kept as raw bytes in IndexedDB (not Blobs, which older Safari mishandles). Cap: 200 MiB in IndexedDB, 3 MiB in localStorage (base64 inflates by a third, and the browser limit is about 5 MB). An upload past the cap is refused with status 413 and the existing data stays intact. Expired museums are deleted on the next call, which frees their bytes.
- **No tokens are stored in demo data.** Museums are keyed by SHA-256 hashes, as on the server.
- **Other earlier decisions stand:** cross-origin refusal returns 403, rate-limit key is `cf-connecting-ip` then `x-real-ip` then `x-forwarded-for` (IPv6 by /64), `confirm-photo` failures delete the objects but keep the photo reserved, publish is one database function, Visitor `facialHair` must be `none`.

## Assumptions
- Safari's canvas output is JFIF plus Exif and Photoshop segments of its own, then an ICC profile. After the browser strips APP1 and APP13 the file passes. This is based on the frontend's description and fixtures; it has not been tested with a file from a real iPhone.
- Canvas JPEGs from Chrome and Firefox contain only JFIF (and possibly ICC or Adobe).
- Signed upload URLs from supabase-js accept `PUT` with `Content-Type: image/jpeg` and `x-upsert: true`. Not exercised against real Storage; the dev server and smoke test model it.
- Web Locks API may be missing (older browsers); then only the in-tab queue protects against two tabs writing at the same instant, which is acceptable for a demo store.
- The Data API stays enabled with `public` exposed, because the functions use it; safety comes from revoked privileges and RLS.

## Open questions
- Supabase plan: the free plan pauses inactive projects and has no backups, which could break a gift link and stop the purge job. Plan, pricing and contract questions go to the Sales team. (user)
- Should the demo banner offer "Clear demo data" and show `getDemoDataInfo()` (storage used)? The functions exist; whether and where to show them is a design decision. (ux-ui-designer, frontend-developer)

## Requests for other agents
- **frontend-developer:**
  - Call `registerApi()` from `@/api` once in `src/main.tsx` before rendering. Until then `getApi()` throws `unconfigured`.
  - Delete `src/lib/httpApi.ts`; `src/api/liveClient.ts` replaces it.
  - When `getApiMode()` is `"mock"`, show a "Demo mode, nothing is saved online" notice. A "Clear demo data" control can call `clearDemoData()`; `getDemoDataInfo()` returns `{ storage, museums, photos, usedBytes, capacityBytes }`. Both are exported from `@/api`.
  - Handle the demo-storage-full case: `server_error` with `status === 413` and a message that already tells the user to clear demo data.
  - Tighten `src/media/jpeg.ts` if you wish: it keeps any APP0, APP2 and APP14 whatever their content, while the server only accepts JFIF, `ICC_PROFILE` and `Adobe`. The canvas encoders only write those, so this is not a problem today, but keeping by identifier as well as marker would make the two sides match exactly.
  - Visitor `facialHair` must be `"none"` in the published document. `confirmPhoto` can return `invalid_image` with `field` `full`, `wall` or `width`, and `bad_request` with `field: "lqip"`; the 24 px placeholder must be a metadata-free JPEG of at most 32 px.
- **devops-engineer (workflow changes):**
  - In the Pages deploy workflow, before `npm run build`, add a step running `node supabase/scripts/check-live-config.mjs` with `VITE_API_MODE=live`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` taken from repository variables (ready-to-paste YAML in `docs/api.md` section 12 and `supabase/README.md` step 9). Set the same three variables on the build step itself.
  - Add Deno checks to CI: `deno test`, `deno lint` and `deno check` with `--config supabase/functions/deno.json` (the root `npm test` does not run them).
  - The Supabase deploy workflow needs `npx supabase db push` then `npx supabase functions deploy --no-verify-jwt`, and can run `node supabase/scripts/smoke-test.mjs` afterwards.
- **architect:**
  - Add `VITE_API_MODE` (`mock`, `live` or blank) to `.env.example` and `vite-env.d.ts`, with the rule that production builds are live unless `mock` is explicit.
  - Optionally add a `check:live` script (`node supabase/scripts/check-live-config.mjs`) to `package.json`, and wire `requireLiveBackend()` from `supabase/scripts/check-live-config.mjs` into `vite.config.ts` as a second line of defence (the `.d.mts` file types the import).
  - Update `docs/architecture.md` section 7.3 to match `docs/api.md`.
- **qa-engineer:**
  - `playwright.config.ts` runs `npm run build`, which is a production build, so it now needs `VITE_API_MODE=mock` set on that command or the app will report `unconfigured`. Demo data now persists across reloads and tabs within a test browser profile, so tests that want a clean start should call `clearDemoData()` or use a fresh context.
  - Test a photo from a real iPhone (Safari) end to end against the real backend after the first deploy.
  - Add `node supabase/scripts/smoke-test.mjs` to the post-deploy checks.

## Verification
| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (exit 0) for the whole repo |
| `npm test` | Pass: 532 tests in 40 files; 188 of them in `src/api` |
| `npm run build` | Pass |
| Deno `test`, `lint`, `check` | Pass: 26 tests, 24 files, four entry points type-check against supabase-js 2.118.0 |
| Safari regression | Raw fixture refused (`exif_or_xmp`, then `metadata_segment`), stripped fixture accepted by the checker, the mock and the Deno `confirm-photo` handler. The Vitest test uses the real `stripJpegMetadata` from `src/media/jpeg.ts` and proves its output equals the stripped fixture byte for byte |
| Mock persistence | Tested on all three backends (memory, localStorage fake, IndexedDB fake): publish in tab A and read in tab B, survive a reload, delete in one tab seen by the other, 24 concurrent reserves across two tabs give exactly 20 successes, clear demo data, expiry frees bytes, cap refusal with 413, replacement not double counted, corrupt or old-version state ignored, IndexedDB-to-localStorage-to-memory fallback |
| Production guard | Unit tests plus the command run as a child process; the Vite plugin run in a real `vite build`: an ordinary build passes, `VITE_API_MODE=live` with missing variables fails with a clear list, a configured live build and a `mock` QA build pass |
| Migrations and pgTAP file | Applied twice to real Postgres (PGlite) with stubbed Supabase schemas (unchanged this round); 21 lockdown assertions pass against a pgTAP stand-in |
| Smoke test | 15 of 15 steps pass over real HTTP against the real handlers with the in-memory store (re-run after the JPEG change) |
| Server starts | Each `index.ts` boots under Deno (earlier this build). `supabase functions serve` was not run (no Docker) |

## Risks
- **Not yet run against a live Supabase project.** The Supabase adapter is type-checked but has no live test. Run `supabase/scripts/smoke-test.mjs` straight after the first deploy; that is the first real proof of Storage uploads, signed URLs and RPC calls.
- **The IndexedDB backend is tested against a hand-written fake**, because the repo has no IndexedDB test library and root `package.json` is not mine. It exercises the same calls the real database sees, but it should be checked once in a real browser (Chrome, Safari, Firefox): publish, open the share link in a new tab, reload, clear demo data.
- **`confirm-photo` strictness.** A browser that writes an unexpected JPEG segment would have its photos refused until the allow-list is widened. The failure is safe and retryable. Test a real iPhone photo.
- **Production builds changed behaviour.** Any build that previously relied on "no variables means mock" (QA preview builds, `playwright.config.ts`) must now set `VITE_API_MODE=mock`, or the app shows `unconfigured`. This is intended, but the QA and devops changes above are needed.
- **localStorage fallback is small** (3 MiB of photo bytes, a handful of photos). A tester in a browser that blocks IndexedDB will hit the cap quickly; the error message says what to do.
- **Demo data is per browser profile and origin**, so `localhost:5173` and `localhost:4173` do not share it.
- **IP rate limiting** depends on `cf-connecting-ip`; people behind a shared NAT share one limit. A free-plan pause also pauses the purge job (ADR 0010).


## CR-1 notes
- **Decision:** `role` removed from `validateAvatar` because nothing uses it now; both call sites updated.
- **Verification:** `npm run typecheck`, `lint`, `build` pass; `npm test` 44 files, 577 of 577 pass. Deno checks not run (not installed).
- **Assumption:** the mock's stored demo state holds documents in `museum.document`; the legacy test strips `gender` there.
- **Requests for other agents:** scene-developer may now add `gender: 'neutral'` to the default configs. devops-engineer: CI must run `deno check`, `deno lint`, `deno test`; deploy functions before the frontend.

## Review fixes (20/11/2026): REV-1, REV-5, REV-7 (comments and docs only)

- REV-1: `src/api/mockClient.ts` module comment now says drafts expire 7 days after creation and published museums 7 days after first publish (`LIMITS.retentionDays`). `grep -rnE "\b90\b" src/api supabase docs/api.md` found no other 90 except the api.md changelog row for v1.2 ("was 90"), which is correct history.
- REV-5: `docs/api.md` section 11 now says the purge is "normally within the hour, and within 24 hours unless storage deletes keep failing for more than 23 hours" (matches the ADR 0010 amendment). Version line date bumped to 20/11/2026 (still v1.2, no contract change).
- REV-7: `supabase/functions/_shared/boot.ts` comment says "shared by the Edge Functions".
