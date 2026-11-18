# Handoff: architect

Iteration: 4 (Feature and hosting: free-tier hosting, 7-day retention). Phase: 2 Design (architecture step), plus the tech lead's `.npmrc` task (user request 18/11/2026).

## Summary
ADR 0010 is amended for NFR-16 v0.7. Published museums last 7 days from first publish, purge completes within 24 hours, and there are no backups. The mechanism is unchanged, and the amendment lists every file to change. ADR 0022 (Proposed) decides free-tier hosting and a daily keep-alive: a new read-only `keep-alive` Edge Function, called by a scheduled workflow with the public anon key, with usage checked in the dashboard only. `docs/architecture.md` is v1.6, with no 90-day figure left except as the old value in change notes. Separately, the first CI failure was traced to Deno reading `~/.npmrc` (a corporate mirror) instead of the root `.npmrc`. I added an `.npmrc` beside each Deno config and amended ADR 0013. Nothing is committed.

## Files changed
- `docs/decisions/0010-retention-with-pg-cron.md`: status note; amendment covering the requirement change, how the design meets each rule (with evidence), the 12-row change list, FR-54 rule and consequences.
- `docs/decisions/0022-free-tier-hosting-and-keep-alive.md`: new ADR (Proposed).
- `docs/decisions/0003-supabase-edge-function-gateway.md`: status line notes the fifth function (ADR 0022).
- `docs/decisions/0013-public-npm-registry.md`: amendment on the Deno `.npmrc` files.
- `docs/architecture.md` v1.5 to v1.6: header; 1 (hosting, backend, keep-alive, retention rows); 3 (diagram); 5.2 (publish returns first publish + 7 days, FR-105 note); 7.1 (`expires_at`, SQL function list); 7.3 (`keep-alive` row); 7.4 (retention rewritten); new 7.5 (keep-alive), 7.6 (iteration 4 coverage), 8.1 (contract changes); 9 (edit page end date, recommended); 10.2; 11; 13 (deployment paragraph, registry row) and new 13.1 (free tiers); 15 (risks); 16 (ADR index); 17 (v1.6).
- `.npmrc` (root): same three settings, each now with a one-line comment.
- New `.npmrc` (one comment line plus `registry=https://registry.npmjs.org/`) in `supabase/functions/`, `create-museum/`, `get-museum/`, `manage-museum/`, `purge-expired/`. **Ownership exception:** `supabase/**` is the backend-developer's; added at the tech lead's direction for this task.
- `docs/handoffs/architect.md`: this note.

## Verification
| Check | Result | Label |
|---|---|---|
| `npm run build` (after all edits, including `.npmrc`) | exit 0; only warning is npm's "Unknown user config always-auth" from the user's own `~/.npmrc` (left alone) | Verified |
| `__APP_TEST__` in `dist/` | 0 files | Verified (`grep -rl`) |
| Prettier on the five edited docs | clean; `prettier --check .` skips `.npmrc` files | Verified |
| Every place that hard-codes 90 days | `grep -rnE "retentionDays\|retention_days\|90 days\|90-day\|90 day\|days => 90\|interval '90"` plus `86_400_000` in tests; results in ADR 0010 amendment | Verified |
| No SQL default or migration hard-codes 90 | Read all four migrations: only comments (schema line 59; schedule "7-day window") | Verified |
| 7 days from first publish, no extension | Read `publish_museum` (`coalesce(published_at, now())`, `case when published_at is null`) | Verified by reading; not run against Postgres |
| Expired returns 404 before purge | `.gt('expires_at', now)` in both finders in `supabaseBackend.ts` | Verified by reading |
| Three existing tests fail with 7 days | `purge_test.ts` day-8 check, `mockClient.test.ts` lines 298 and 314 | Partly verified (reasoned from the timings; not run with the constant changed) |
| `PublishResponse.expiresAt` exists and reaches the store | `contract.ts`, `src/state/publish.ts` sets `publish.expiresAt` | Verified by reading |
| Test hook exposes `useBuilderStore` | `src/main.tsx` lines 24 to 33 (flat object, not `stores.*`) | Verified |
| Supabase idle-pause rule, 60-day GitHub rule, failure e-mail recipient, free figures | Third-party, not on vendor pages | Not verified (Q-34; confirm after launch) |
| `npm config get registry` in the project | `https://registry.npmjs.org/` | Verified |
| `npm ci --dry-run` | exit 0 | Verified |
| `npm install --package-lock-only` in a scratch copy | lockfile byte-identical; 266 of 266 `resolved` on `registry.npmjs.org` | Verified |
| Deno with only the root `.npmrc` | downloads from the corporate mirror, 9 `tarball` lines (root config and per-function config) | Verified (Deno 2.9.6 via `npx`, fresh `DENO_DIR`, scratch copy) |
| Deno with `.npmrc` beside `deno.json` | all downloads from `registry.npmjs.org`, 0 `tarball` lines; generated `create-museum/deno.lock` matches the backend-developer's regenerated one | Verified (same method) |
| CI Deno steps on a copy of the real `supabase/functions` | `check --frozen` (root, create-museum, manage-museum) exit 0; `lint` exit 0 (24 files); `test --frozen` 27 passed, 0 failed; lockfiles unchanged | Verified locally with 2.9.6; CI uses `v2.x` on Linux, Not verified there |

## Decisions
- **Retention: change the value, not the mechanism** (ADR 0010 amendment). One constant (`LIMITS.retentionDays`), migration comments edited in place, no new retention migration, no data migration (nothing deployed).
- **Keep-alive calls a new read-only `keep-alive` Edge Function** that runs `select public.keep_alive()` (`now()`) through the service role. It reaches the gateway, a function, PostgREST and Postgres, writes nothing, needs only the public anon key, and has no rate limit, because a rate limit needs a write. Rejected: `get-museum` with a dummy token (writes rows and adds misses), `purge-expired` (forbidden, needs a secret), direct PostgREST (breaks ADR 0003; kept as fallback).
- **Usage check: dashboard only.** Egress is not readable from SQL; sizes on a public endpoint help someone fill the storage.
- **Daily schedule (20:37 UTC)**, not every 3 days: 3 consecutive failures before a 72-hour window is empty. The job is **skipped while `VITE_SUPABASE_URL` is empty**, so there are no failure e-mails before launch.
- **60-day rule: document it, do not automate.** Self-committing or self-enabling workflows were rejected (write permissions, third-party actions, noisy history).
- **No store or test-hook change for FR-105**: `builderStore.publish.expiresAt` already holds the server value. The end date is always the server's, formatted by one pure function without `toLocaleString`.
- **`.npmrc` beside every Deno config**, not a Deno workspace restructure: it is the smallest fix and was proven by test. CI-only env vars would not protect local regeneration.

## Assumptions
- Supabase counts a request through the API gateway with the project key that reaches Postgres as activity (not documented; ADR 0022 risk and fallback).
- GitHub e-mails scheduled-run failures to the user who last changed the `cron` line, when Actions notifications are on.
- `net._http_response` keeps rows about 6 hours (pg_net default), for the purge health check.

## Not done
- `docs/api.md`, `supabase/**` code, `src/`, `tests/`, `.github/`, `docs/deployment.md`: owned by others; listed below.
- Requirement-coverage table for the whole app: the architecture has never had one. 7.6 covers the iteration 4 Musts only.

## Open questions
1. **Copy changes need the designer**, who is not scheduled: the FR-105 notice (publish screen, and the edit page if Q2 is accepted) and the not-found body for Q-33 (a) (design spec 7.5, which has the exact current text). Options: (a) a short design-spec patch before the build; (b) the frontend uses the requirements wording and the designer records it as built. **Recommend (a)**, and keep the heading "We can't find that museum" so the 6 e2e assertions on it hold. Owner: tech lead.
2. **US-71 AC-3 ("open the publish screen again")**: the builder's publish screen cannot be reopened (the edit token is memory-only; editing is Release 2). Options: (a) show the same end date on the edit page from `ManageGetResponse.expiresAt`; (b) treat AC-3 as API-level only. **Recommend (a)**: small, and it is the only place the Creator can see the date again. Owner: tech lead, product-manager.
3. **Cap signed-URL lifetime at `expires_at`** (`get-museum`: TTL = min(3600 s, time left), `urlsExpireAt` likewise), so an open session cannot load photos after the end. **Recommend yes if the backend has room this iteration, otherwise backlog**; NFR-16 is met without it. Owner: tech lead.
4. **Purge health in the keep-alive** (a single `purgeHealthy` boolean, so a stuck purge turns the daily run red). **Recommend backlog**, not now: it keeps the keep-alive minimal, and the dashboard checks are documented. Owner: tech lead.
5. **Privacy page**: add one sentence saying there are no backups and content is removed within 24 hours? **Recommend yes**, worded by the designer, and reviewed under LEG-1. Owner: tech lead.
6. Q-33 (b), if the user chooses it at approval, needs a distinct `expired` API response: a contract change, an ADR 0003 and ADR 0010 amendment, and new tests. The design assumes (a). Q-35 (c) would drop FR-105 and the formatter work. Owner: user.
7. Confirm Supabase's idle-pause rule and the free figures (extends Q-34), and watch the first 7 or more days after launch. Owner: user.

## Requests for other agents
- [open] **backend-developer**:
  1. Retention, items 1 to 12 of the ADR 0010 amendment table: `contract.ts` `retentionDays: 7` and comment; migration comments in `20261027000100_initial_schema.sql:59` and `20261027000200_retention_schedule.sql` (the "7-day window" comment); `purge-expired/handler.ts:3` comment; tests `purge_test.ts:36-90` (restructure: publish on day 3), `flow_test.ts:99` (use `LIMITS.retentionDays`), `flow_test.ts:261` (8 days), `src/api/__tests__/mockClient.test.ts:251` (use `LIMITS.retentionDays`), `:298-311` (restructure), `:314-323` (re-publish on day 3); `supabase/README.md:45`.
  2. Keep-alive per ADR 0022 section 4: migration `20261118000100_keep_alive.sql`; `supabase/functions/keep-alive/` (`index.ts`, `handler.ts`, `deno.json`, **and an `.npmrc` like the other function folders**); `FUNCTION_NAMES.keepAlive`, `KeepAliveRequest`, `KeepAliveResponse`; `keepAlive()` on the store port, the Supabase backend and the memory backend; `[functions.keep-alive] verify_jwt = false` in `config.toml`; Deno tests (200 shape, nothing created, no rate-limit row, 400, 405, 415, 500); pgTAP (`anon` and `authenticated` cannot execute `keep_alive()`); a smoke-test line; README function list ("four" to five).
  3. `docs/api.md`: version and change-log row; section 1 table and "four" to five functions; section 5 published lifetime "7 days from the first publish" and a `keep-alive` row with no rate limit; section 9 publish example `expiresAt` to `2026-11-04T01:00:00.000Z` and the rule text "(7 days from the first publish)", plus a note that the browser shows `expiresAt` as the end date (FR-105); section 10 `purged` meaning; a new `keep-alive` section (ADR 0022 section 4); section 11 first publish + 7 days, out of live storage within 24 hours, no backups.
  4. Never let a `deno.lock` contain `"tarball"`. Regenerate it if it does (ADR 0013 amendment).
  5. Optional, by the tech lead's call: open question 3 (URL TTL cap).
- [open] **frontend-developer**:
  1. FR-105 notice on `PublishedScreen` from `useBuilderStore((s) => s.publish.expiresAt)`; days from `LIMITS.retentionDays`; date in `<time dateTime={expiresAt}>`; must say deleting with the edit link ends it sooner; fits 360 px at 200% text; copy from the designer (open question 1).
  2. `formatEndDateTime(iso: string): string | null` in `src/lib/format.ts` (architecture 8.1): `Date.parse`, `null` if not finite, `DD/MM/YYYY HH:mm` from local getters, zero-padded, 24-hour. Unit tests in `src/lib/format.test.ts` built from local-time `Date`s (zone-independent): padding, midnight `00:00`, invalid input.
  3. If open question 2 is accepted: the same notice on `EditScreen` for a published museum, from `data.expiresAt`.
  4. `NotFoundScreen` body for Q-33 (a), wording from the designer, heading unchanged if the designer agrees.
  5. Check only: `LegalScreen` shows "7 days" once the backend changes the constant (no edit). No hard-coded 90 in `src/ui` (verified by search).
- [open] **devops-engineer**:
  1. `.github/workflows/keep-alive.yml` per ADR 0022 section 5: daily `37 20 * * *` plus `workflow_dispatch`; job `if: vars.VITE_SUPABASE_URL != ''`; `permissions: {}`; `ubuntu-24.04`; `timeout-minutes: 5`; `concurrency: keep-alive`; `curl --fail-with-body --retry 3 --retry-delay 20 --retry-all-errors --max-time 30` with the URL and key through `env:` (no `${{ }}` inside `run:`); `jq -e '.ok == true and (.checkedAt | type == "string")'`; `checkedAt` to the job summary; no checkout and no secrets.
  2. `docs/deployment.md` free-tier section (NFR-32 (c) to (f), US-70): the three limits marked "confirm on supabase.com/pricing"; the capacity arithmetic; dashboard usage steps and the two SQL queries in ADR 0022 section 3; how to confirm the last keep-alive run; the 60-day rule with the 50-day reminder and re-enable steps; restoring a paused project; the GitHub notification setting; what happens at each limit and what to do, no in-app handling; no backups; no prices (contact Supabase sales). Purge health: `cron.job_run_details` for `surprise-museum-purge`, `net._http_response` status and `failed`, and `select count(*) from public.storage_purge_queue` (US-68 AC-5, AC-6). Update manual step 4 ("choosing a plan is yours" now conflicts with the user's Free-plan decision), the workflow table, and the "No scheduled checks" gap.
  3. Go-live order: migrations and functions (including `keep-alive`) before setting the repository variables, or the first keep-alive runs fail.
  4. `CHANGELOG.md` entry. The CI Deno failure is routed separately by the tech lead; locally the Deno steps now pass (see Verification).
- [open] **qa-engineer**:
  1. US-68: in the mock build with `page.clock`, publish at T; at T + 168 h − 1 min the share link loads; at T + 168 h + 1 s it shows the not-found screen with the new wording. Draft: D + 168 h makes the edit link not found. AC-3 (re-publish) has no UI until Release 2, so review the backend's Deno and mock tests instead. AC-5 and AC-6 are live-only: run them post-deploy with the guide's steps; Not verified until then.
  2. US-71: the notice says 7 days; the `<time>` `datetime` equals `window.__APP_TEST__.useBuilderStore.getState().publish.expiresAt`; the text equals its `DD/MM/YYYY HH:mm` under a fixed `timezoneId` (Australia/Sydney and one other zone); the date equals the publish moment + 168 h within 1 minute; 360 px at 200% text has no horizontal scroll; the deleting-sooner sentence is present; the edit page shows the same date if open question 2 is accepted.
  3. US-69: a static review of `keep-alive.yml` (daily, `permissions: {}`, no secrets, only the `keep-alive` URL), plus the backend's "nothing created" Deno test. Run history is post-deploy.
  4. US-70: manual review of `docs/deployment.md` against its acceptance criteria.
  5. Full regression. The not-found heading assertions change only if the designer changes the heading.
- [open] **tech lead**: route open question 1 to the ux-ui-designer; decide open questions 2 to 5.

## Requests received
- [done] from tech lead: amend ADR 0010, write ADR 0022, update `docs/architecture.md`, list changes per agent and open questions.
- [done] from tech lead (user request 18/11/2026): add a project `.npmrc`, check Deno's pickup, verify npm, record it in ADR 0013 and the architecture.
- [done] from product-manager: ADR 0010 amendment and keep-alive ADR naming the request; A-35 photo sizes checked against `LIMITS` and section 12 (Partly verified, architecture 13.1).

---

## Earlier round: CR-4 performance sync (03/11/2026)


### Summary
Docs-only sync with the CR-4 performance sign-off (commit 1659eb8, requirements v0.6.1). `docs/architecture.md` (now v1.5) describes the two named 3D chunks, `three-*` and `scene-shared-*`, instead of the single `NameLabel-*` chunk. It also describes the combined NFR-27 reading (987.6 of 1,000 kB), the guards in `vite.config.ts` and the CI script, and the triangle sign-off at 6,000 (worst 5,862). ADR 0021 section 7.3a has a dated amendment recording that the provisional 6,500 ceiling has lapsed. No code was changed and nothing was committed.

### Files changed
- `docs/architecture.md` (v1.4 to v1.5):
  - Header and section 2: dated note on the split chunks and their gzip sizes.
  - 6.7: the face shape, pattern and styles row now says the 6,500 ceiling has lapsed and that the builder offers all 12 styles (the pending-kit gate is empty). The budget row has the 03/11/2026 figures: worst 5,862, defaults 4,602 and 4,436, worst body per style for all 12 styles, worst hair 1,660, and the `TRIANGLE_BUDGET = 6000` note.
  - 12: the 3D gzip row now covers the three chunks (308 kB). A new NFR-27 row gives the combined minified figure (987.6 kB, 12.4 kB headroom, `three-*` guard 985 kB). The triangles row gives 5,862, signed off. The old "Chunk size warnings" paragraph, which named a single 969 kB chunk, is replaced by "Named 3D chunks" (a table of the two groups, why they are named, and the combined reading) and "Chunk size guards" (the four `chunkSizeBudgets()` warnings and the failing CI check, with exit 2 when a chunk is missing). The preview-slimming follow-up is noted.
  - 13: the Vite plugins row mentions `codeSplitting.groups`.
  - 15: the chunk and triangle risk is split into two rows: 987.6 of 1,000 kB combined, and 138 triangles of headroom. The "new outfit styles at risk" row is replaced by a forward-looking body ceiling (4,338 within 6,000, 4,288 under 5,950). "3D chunk" is now plural in the cold-start row.
  - 16: lists ADR 0021's amendments.
  - 17: v1.5 row added.
- `docs/decisions/0021-avatar-face-shape-and-outfit-fields.md`:
  - Status: one sentence pointing to the lapse.
  - 7.3a: a new "Amendment (03/11/2026)" after step 5 records the measured 5,862 and its breakdown, the sign-off and its source, that steps 3 and 4 no longer apply, that `TRIANGLE_BUDGET` stays 6000, and that 7.4's triangle and chunk rows are superseded.
- `docs/handoffs/architect.md`: this note.

### Decisions
- **No new ADR for the chunk split.** It is a build-configuration change. The tech lead's NFR-27 reading is already in requirements v0.6.1 and `docs/performance.md` A.3, and architecture section 12 now carries the design and the guards. ADR 0021 records only the triangle lapse, because 7.3a step 5 asked for that.
- **Triangle figures taken from `docs/performance.md` A.4 (5,862)**, not the technical-artist's earlier 5,682. 5,862 is the figure after the hair edge fix, and it matches requirements v0.6.
- **I kept the previous 7.3a text** and added the amendment after it, so the history stays readable.

### Assumptions
- The 3D gzip row (308 kB) adds Vite's gzip figures for `three-*`, `scene-shared-*` and `Experience` from performance A.3. Earlier rows used a different method, so the 288 to 308 change is partly method and partly CR-4 growth.
- The first-view rows in section 12 (95, 111 and 112 kB, 28/10/2026) are left as they are. Performance A.3 measured them a different way (a static closure at gzip level 9, welcome 97.9 kB), and this task covered only the chunk split and triangles.

### Open questions
- None new. Performance-optimiser's question about applying the 985 kB guard to the combined figure was settled by the tech lead (combined under 1,000 kB, requirements v0.6.1).

### Requests for other agents
- **performance-optimiser:** please re-baseline the section 12 first-view rows (home, Visit welcome, builder) with one consistent method, so the architect can replace the 28/10/2026 figures. Optional.
- **scene-developer and technical-artist:** the preview-only look-material factory (8 to 12 kB out of `scene-shared`) is the first real NFR-27 chunk headroom (architecture section 12, performance A.3). It is a follow-up, not a blocker.

---

## Earlier round: ADR 0021 builder keys and description words (03/11/2026)

### Summary
Follow-up to ADR 0021 for the frontend developer's two requests (03/11/2026). The builder's `AvatarOptionKey` now covers `faceShape` and `outfitPattern`. Their labels live in the domain, are re-exported from `@/lib/avatars` and are in `AVATAR_LABELS`, using exactly the wording in `src/ui/builder/extraOptions.ts`, so nothing visible changes. `describeAvatar` now says "{shape} face" and "striped" / "checked" / "spotted" (design spec 9.4 v2.0). Defaults add no words, so the descriptions of existing characters are unchanged. `src/ui/**` and `tests/e2e` were not touched.

### Files changed
- `src/domain/characters/avatarOptions.ts`:
  - New `FACE_SHAPE_LABELS` (Oval, Round, Square, Heart, Long) and `OUTFIT_PATTERN_LABELS` (Plain, Stripes, Checks, Dots).
  - `describeAvatar` adds `{shape} face` after the build when the shape is not Oval, and puts the pattern word between the colour and the garment when the pattern is not Plain ("navy striped shirt and trousers"). Both values are read through `avatarFaceShape` and `avatarOutfitPattern`.
- `src/lib/avatars.ts`:
  - `AvatarOptionKey` = `Exclude<keyof AvatarConfig, 'v' | 'glasses' | 'hat'>`, which now includes `faceShape` and `outfitPattern`.
  - `AVATAR_LABELS.faceShape` and `AVATAR_LABELS.outfitPattern` added.
  - `FACE_SHAPE_LABELS` and `OUTFIT_PATTERN_LABELS` re-exported.
  - `optionIds` takes all three optional keys from `AVATAR_OPTIONAL_OPTIONS` and returns `NonNullable` ids.
  - `avatarOptionLabel` takes a `NonNullable` id.
  - New `selectedOptionValue(config, key)`: missing or unknown optional values read as Neutral, Oval or Plain.
- `src/domain/characters/avatarOptions.test.ts`: new block covering labels, unchanged default and legacy descriptions, unknown values, every face-shape phrase, every pattern word, and the spec 9.4 example.
- `src/lib/lib.test.ts`: labels for the optional ids, `optionIds` and `avatarOptionLabel` for face shape and pattern, single source of truth, `selectedOptionValue`, `avatarsEqual` with missing keys.

### Decisions
- **Labels live in the domain** (`src/domain/characters/avatarOptions.ts`), beside every other avatar label, and `@/lib/avatars` re-exports them. That keeps one source of truth for the kit, the builder and `describeAvatar`. The pattern table is called `OUTFIT_PATTERN_LABELS`, matching the contract's `AVATAR_OUTFIT_PATTERNS` and the `OUTFIT_*_LABELS` naming.
- **Widening `AvatarOptionKey` makes `AvatarConfig[K]` include `undefined` for the optional keys.** `optionIds` and `avatarOptionLabel` use `NonNullable<AvatarConfig[K]>`, so the ids they return and accept are never `undefined`. `selectedOptionValue` is the safe read for a control's selected value, so callers do not read `config[key]` directly (ADR 0021, section 4).
- **Pattern words come from the spec, not from the labels**: Stripes is "striped", Checks is "checked" and Dots is "spotted". The face word is the lower-case label plus "face".

### Assumptions
- `src/domain/characters/` and `src/lib/avatars.ts` are not in the ownership table. I edited them because the tech lead delegated this task, as in the ADR 0021 round.
- "heart face" is acceptable wording (spec 9.4 only gives "round face" and "square face" as examples).

### Open questions
- None new. The triangle budget question from the earlier round still stands (below).

### Requests for other agents
- **frontend-developer** (`src/ui/builder/`), all optional and with no visible change:
  - In `extraOptions.ts`, replace the local `FACE_SHAPE_LABELS` and `PATTERN_LABELS` with `FACE_SHAPE_LABELS` and `OUTFIT_PATTERN_LABELS` from `@/lib/avatars` (or use `AVATAR_LABELS.faceShape` and `AVATAR_LABELS.outfitPattern`). `faceShapeIds()` and `patternIds()` can become `optionIds('faceShape')` and `optionIds('outfitPattern')`. `stepCopy.test.ts` imports the two local names, so update it at the same time.
  - In `CharactersStep.tsx`, drop the `setOptional` cast and call `setAvatarOption(role, 'faceShape' | 'outfitPattern', value)` directly: the store's `<K extends AvatarOptionKey>` signature now accepts both keys.
  - In `groupValue`, `selectedOptionValue(config, key)` replaces the `gender` special case and `config[key] as string`. It is needed if the frontend moves face shape or pattern into `GROUPS`.
- **ux-ui-designer:** spec 9.4 could add a "heart face" or "long face" example. No change is required.

---

## Earlier round: ADR 0021 data model (02/11/2026)

### Summary
User feedback on CR-4 (02/11/2026, requirements v0.5, FR-96 to FR-102, Q-30 and Q-31 answered). I settled the data model for face shape, outfit pattern and the extra outfit styles in ADR 0021, and landed the type and contract scaffolding with unit tests. The changes are:
- optional flat `faceShape` (5 options) and `outfitPattern` (4 options), read through accessors
- six outfit style ids appended to the existing `outfitStyle` (12 in total)
- no pattern colour field

There is no version bump, no draft key change and no database migration, and legacy data reads as today's look. There is no UI and no kit visual work. The builder hides the six new styles until the kit builds them.

Earlier rounds (ADRs 0001 to 0020) are unchanged; see architecture section 17.

### Files changed
- `supabase/functions/_shared/contract.ts`:
  - New `AVATAR_FACE_SHAPES`, `AvatarFaceShape`, `DEFAULT_AVATAR_FACE_SHAPE`, `isAvatarFaceShape`, `avatarFaceShape`.
  - New `AVATAR_OUTFIT_PATTERNS`, `AvatarOutfitPattern`, `DEFAULT_AVATAR_OUTFIT_PATTERN`, `isAvatarOutfitPattern`, `avatarOutfitPattern`.
  - New table helpers: `AVATAR_OPTIONAL_OPTIONS`, `AvatarOptionalKey`, `AVATAR_OPTIONAL_DEFAULTS`, `isAvatarOptionalValue`, `withAvatarDefaults`.
  - Optional `faceShape?` and `outfitPattern?` on `AvatarConfig`.
  - Six ids appended to `AVATAR_OPTIONS.outfitStyle`: `sweater`, `overalls`, `coat`, `tracksuit`, `cardigan`, `tunic` (design spec v2.0, 12.8.2 G; `tunic` chosen over `skirt` by the tech lead).
- `supabase/functions/_shared/validate.ts`: `validateAvatar` loops over `AVATAR_OPTIONAL_OPTIONS`. An absent key gets its default. An unknown id or `null` is rejected with `field` `<path>.<key>` and the message "Choose one of the available options." Other unknown keys are still rejected.
- `supabase/functions/_shared/present.ts`: responses fill all three optional keys through `withAvatarDefaults`, replacing the local `withGender`. Stored rows are not rewritten.
- `src/api/mockClient.ts`: same fill-in for the mock's `getMuseum` and `manageGet`. Publish already runs the shared validator, so the new fields pass through.
- `src/state/draftPersistence.ts`: `restoreAvatar` keeps each optional key only when valid, otherwise the default. Key `surprise-museum:draft:v1` and version 1 are unchanged.
- `src/domain/characters/avatarOptions.ts`: both default appearances carry `faceShape: 'oval'` and `outfitPattern: 'plain'`. Labels (Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic) and description phrases for the six new styles, taken from design spec v2.0 12.8.2 G.
- `src/lib/avatars.ts`:
  - `AvatarOptionKey` excludes `faceShape` and `outfitPattern` until the controls exist.
  - `optionIds('outfitStyle')` hides the six new styles (`OUTFIT_STYLES_PENDING_KIT`).
  - `avatarsEqual` treats a missing optional key as its default.
- `src/scene/characters/kit/neutralSnapshot.testutil.ts`: the v1.0 golden is now pinned to the six v1.0 styles instead of reading `AVATAR_OPTIONS`. Otherwise appending ids would break the v1.0 fingerprint.
- Tests:
  - New file: `src/api/__tests__/avatarOptionalFields.test.ts`.
  - New blocks in `src/api/__tests__/mockClient.test.ts` and `src/state/draftPersistence.test.ts`.
  - Fixture additions in `src/api/__tests__/validate.test.ts` and `mockClient.test.ts`: writers now send explicit `faceShape` and `outfitPattern`.
- `docs/decisions/0021-avatar-face-shape-and-outfit-fields.md`: new ADR.
- `docs/architecture.md`: v1.4. Updated sections 1, 6.7, 7.1, 7.3, 12, 15, 16 and 17.

### Decisions
- **Flat keys `faceShape` and `outfitPattern`, and reuse `outfitStyle`.** Nested `outfit: { style, pattern }` would rename the required `outfitStyle`. That would force `v: 2` with migrators in three places, and break the flat-record helpers (validator loop, draft restore, `avatarsEqual`, `setAvatarOption`).
- **Ids:**
  - `oval`, `round`, `square`, `heart`, `long` (default `oval`).
  - `plain`, `stripes`, `checks`, `dots` (default `plain`).
  - New style ids are the design spec's garment nouns, appended in the spec's display order so no v1.0 id moves or changes.
- **One optional-key table.** It drives the validator, draft restore, response fill-in and equality, so a future optional key is a one-place change.
- **No bump.** Avatar `v`, `CONTRACT_VERSION`, `content_version`, the draft key and the draft version all stay.
- **Reject on write, map on read.** The validator rejects unknown ids (FR-101). The accessors map unknown or missing values to the default, so rendering never fails.
- **Kit approach:**
  - Face shape: extend `PartBuilder.warp` below the eye line and compose with the gender jaw. Adds 0 triangles.
  - Pattern: an `onBeforeCompile` patch of the body Lambert material, with an `outfitMask` vertex attribute, a uniform per rig and a constant cache key. Adds 0 draw calls and 0 textures. The ink is a tint of the outfit colour.
  - Styles: each style replaces the garment, so the budget is set by the worst style.
- **Budget (measured 02/11/2026):**
  - Worst body per style: suit 4,396. Worst hair: 1,480. Worst character: 5,878.
  - Ceiling for any new style: **4,518 body triangles**.
  - With the design spec's catchlights (up to 60 triangles), the ceiling for any style is 4,458.
  - Estimates: sweater, tracksuit and cardigan fit easily; overalls and tunic are tight; `coat` is at risk (about 4,450 to 4,600).
  - **6,500 per character accepted by the tech lead as a provisional ceiling** (ADR 0021, 7.3a). The technical artist measures the real garments, the performance optimiser signs off, and only then does the product manager change NFR-27. Draw calls stay at 3. Scene triangles rise by at most about 1,000 (+7%, against a 150,000 budget). There is no expected frame-rate effect.
- **Chunk:** the three.js chunk is 961.85 kB today. The target is at most +10 kB in total: face shape 2 kB, pattern 4 kB, garments 4 kB.

### Assumptions
- The new style ids and labels follow design spec v2.0 12.8.2 G as directed. The spec lists the display order as Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic in 12.5.3 but puts Cardigan before Tracksuit in 9.2; I used the 12.5.3 order (designer to align 9.2).
- `oval` is today's head (A-30).
- The pattern applies only to the outfit-colour regions. The fixed contrasting garment stays plain (FR-90 top and bottom regions).
- The new style ids render as the jumpsuit until the technical artist builds their garments. The builder gate keeps them out of the UI meanwhile.

### Open questions
- Final triangle budget: 6,500 is provisional. Keep 6,000 if the real garments fit (target 5,950 with catchlights), otherwise the measured worst plus margin, at most 6,500. (Technical artist measures, performance optimiser signs off, product manager updates NFR-27.)

### Requests for other agents
- **technical-artist** (kit and `src/scene/shaders/`):
  - Build the six new garments (design spec 12.8.2 G) in `parts/outfits.ts`. Aim for the suit's count or less (4,396; at most 4,458 with catchlights within 6,000). The hard ceiling is the provisional 6,500 per character (ADR 0021, 7.3a). Report each style's worst count; `coat` is the most at risk.
  - Implement face shape in `PartBuilder.warp` (7.1). `oval` must stay bit-identical, and the neutral snapshot must still pass. `rig.setAppearance` must rebuild the body and hair when `avatarFaceShape` changes.
  - Implement the pattern shader in `src/scene/shaders/avatarPattern/` with an `outfitMask` attribute and `patterned` band flags (7.2). Report FR-89 3:1 results per outfit colour and pattern.
  - Read the new values only through `avatarFaceShape`, `avatarOutfitPattern` or `withAvatarDefaults`.
  - Extend the budget tests: every face shape and pattern gives the same index count as `oval`/`plain`.
  - The heavy budget tests now loop over 12 styles and took more than 5 s when the machine was busy (load average about 22). Give them an explicit timeout (for example 20 s).
  - When each garment lands, ask the frontend developer to remove it from `OUTFIT_STYLES_PENDING_KIT`.
- **frontend-developer** (`src/ui`, `src/state`, `src/lib`):
  - Add the face shape and pattern controls under a "More options" group (FR-102). Remove `faceShape` and `outfitPattern` from the `AvatarOptionKey` exclusion, add their labels to `AVATAR_LABELS` and handle them in `optionIds`.
  - Empty `OUTFIT_STYLES_PENDING_KIT` as the garments land.
  - Extend `describeAvatar` per design spec 9.4.
  - Persistence, equality and defaults already work. Keep writing explicit values.
- **backend-developer** (`supabase/`, `docs/api.md`):
  - Run the Deno tests. Deno is not installed here, so `validate.ts`, `present.ts` and `contract.ts` compiled and ran only through tsc and Vitest.
  - In `supabase/functions/tests/flow_test.ts`, add cases for absent, valid and unknown `faceShape` and `outfitPattern`, the new style ids, and old rows without the keys.
  - Update `docs/api.md`: the avatar settings table, examples, the rule that responses always include all optional keys, and the 12 styles.
  - Smoke test (`supabase/scripts/smoke-test.mjs`) needs no change.
- **devops-engineer:** release order. Run the manual functions deploy before the frontend change reaches `main`. The old validator rejects the new keys and style ids.
- **ux-ui-designer:** the contract now matches spec v2.0 (ids, labels and description words). Please align the order in 9.2 (Cardigan before Tracksuit) with 12.5.3, and mark the ids as final rather than provisional.
- **performance-optimiser:** sign off (or lower) the provisional 6,500 ceiling with a Low and High tier walk using the worst character pair, and record the per-style counts in `docs/performance.md`.
- **qa-engineer:** legacy museum and draft load (no new keys), reject paths, the builder gate, and the budget across 12 styles, 5 face shapes and 4 patterns. Note that `src/scene/materials/palette.test.ts` currently fails because of the designer's uncommitted `tokens.css` edit; it is not related to this change.
- **product-manager:** change NFR-27 only after the measurement and sign-off (ADR 0021, 7.3a). Update A-29's trimming order to name `coat` as the first style to simplify or drop.
