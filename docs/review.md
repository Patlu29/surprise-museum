# Release review: Surprise Museum

Owner: architect. One section per iteration, newest first. Each finding has an ID, a severity, a location, the evidence, an owner and the change needed.

Severity: **Critical** must be fixed before release (a broken contract, a secret, the test hook in production, a security-rule breach). **Major** should be fixed in this iteration. **Minor** can go to the backlog. **Note** needs no fix before release; it records a risk, a judgement or a small tidy-up.

---

## Iteration 4: free-tier hosting, 7-day retention (review of 20/11/2026)

### Scope
Everything that changed from the commit before 4918550 up to HEAD 5b307f5: `git log --oneline 2260e88~3..HEAD` and `git diff 2260e88~1 HEAD -- src supabase .github tests docs .npmrc`. Code commits: 4918550 (`.npmrc` files, ADRs 0010, 0013 and 0022), 5220a8f (deno.lock tarball URLs removed), eb57dff (7-day retention, `keep-alive` function and migration, `AvailabilityNotice`), and the QA commits fc8b034, b947f7c, d00f4d5 and 4a3c552. I read the code itself, not the handoff notes. Unchanged code is out of scope unless the iteration 4 change depends on it (for example `publish_museum`, the finders and `createEndpoint`).

### Verdict
**No critical finding open. No major finding.** 0 Critical, 0 Major, 5 Minor, 9 Note. From the architecture side the iteration 4 build can be released once the phase 6 work already routed to the devops-engineer is done (the keep-alive workflow and the deployment guide free-tier section). Until the workflow exists, nothing keeps a live Free project awake.

### Checks I ran

| Check | Result | Label |
|---|---|---|
| `npx tsc -b --noEmit` | exit 0 | Verified |
| `npx tsc -p tsconfig.e2e.json --noEmit` | exit 0 | Verified |
| `npx eslint .` | exit 0, no warnings | Verified |
| `npx vitest run` | 72 files, 1,084 tests passed | Verified |
| Deno 2.9.6 (`npx --yes deno@2.9.6`, scratch `DENO_DIR`, public registry set per command): `check --frozen` on the 5 entry points, and on `keep-alive/index.ts` with its own `deno.json`; `lint`; `test --frozen` | check pass; lint 27 files pass; 35 tests passed, 0 failed (8 keep-alive); `git status` unchanged afterwards (no lockfile written) | Verified (macOS; CI's Linux `v2.x` not run by me) |
| Production build without the test hook: `VITE_API_MODE=mock npx vite build --outDir <scratchpad>` (not `npm run build`, so the test-mode `dist/` QA uses was left alone), then `grep -rl __APP_TEST__` | 0 files | Verified |
| `npm audit --omit=dev` (public registry set per command) | 0 vulnerabilities. `package.json` and `package-lock.json` did not change in iteration 4 | Verified |
| Old mirror hostname in the current tree (tracked and untracked files, excluding `.git` and `node_modules`) | 0 hits. Git history was not checked, by the user's decision | Verified |
| Credential patterns (private keys, JWTs, `sb_secret_`, GitHub and AWS tokens, `_auth`, `_authToken`) in tracked files | 0 hits | Verified |
| The 7 tracked `.npmrc` files | Only `registry=https://registry.npmjs.org/` (root also `save-exact`, `engine-strict`) plus comments; no credential line | Verified |
| `"tarball"` in the 4 `deno.lock` files | 0 in each | Verified |
| `package-lock.json` `resolved` URLs | 266 of 266 on `registry.npmjs.org` | Verified |
| Code-rules grep on every changed `.ts`, `.tsx`, `.mjs` and `.css` file | No new `any`, `@ts-ignore`, `eslint-disable`, `innerHTML`, `eval`, `.only` or `console.log` in app code. The hits are earlier test code, the dev server and the smoke-test CLI, where console output is the interface | Verified |
| `npx prettier --check` on the changed non-Deno code files | 3 files fail: `tests/e2e/builder.spec.ts`, `ceiling.spec.ts`, `cr4-visit.spec.ts` (changed in fc8b034, not in the six files the tech lead formatted). Covered by the format commit already routed to phase 6 | Verified |

### Retention, end to end

| Rule | Where | Result |
|---|---|---|
| `retentionDays: 7`, `draftRetentionDays: 7`, `CONTRACT_VERSION` 1 | `supabase/functions/_shared/contract.ts:52-54` | Correct |
| `expires_at` set at first publish only, never extended | `20261027000110_functions.sql:164-167`: `published_at = coalesce(m.published_at, now())` and `case when m.published_at is null then now() + make_interval(days => p_retention_days) else m.expires_at end`. `SET` reads the old row, so this is right. Mirrored in `memoryBackend.ts:172-175` and `src/api/mockClient.ts:517-520` | Correct. Deno `flow_test.ts`, `purge_test.ts` and `mockClient.test.ts` cover it |
| Drafts end at creation + 7 days | `create-museum/handler.ts:40-46` (`LIMITS.draftRetentionDays`); column default `now() + interval '7 days'` | Correct. A draft published on day 6 gets 7 days from that publish, as architecture 7.4 says |
| Expired content invisible before purge | `supabaseBackend.ts:118, 130` (`.gt('expires_at', now)` in both finders); publish needs `findLiveByEditHash` first, so an expired museum cannot be re-published | Correct |
| Purge and storage removal | `expire_museums` (`expires_at <= now()`, 100 a run, `for update skip locked`, queues the prefix in the same statement); `purge-expired` drains the queue; hourly at minute 17 | Correct. A concurrent first publish and purge cannot both win: whichever holds the row lock first decides |
| Expired and wrong token look the same | `get-museum/handler.ts:47-58`: an unknown token of valid shape and an expired museum take the same path (one query, then `miss()`), with the same body and the same miss count. Only malformed tokens skip the query, and their shape is public anyway | No oracle. `flow_test.ts:240-270` asserts one body. The client shows `NotFoundScreen` for both (`VisitScreen.tsx:39`, `EditScreen.tsx:86`) |
| `formatEndDateTime` and fallback | `src/lib/format.ts:26-34`: rejects non-strings, empty and unparseable values; local getters, zero-padded, 24-hour. `AvailabilityNotice.tsx:27-34` shows "Available for 7 days." without a `<time>` when it returns null | Correct. Unit tests cover padding, rollover, both Sydney DST edges and invalid input |
| The browser never computes now + 7 days | Only the mock does (`mockClient.ts:519`), which stands in for the server | Correct |

### Keep-alive security

| Question | Finding |
|---|---|
| What an anonymous caller can do with `verify_jwt = false` (`supabase/config.toml:57-58`) | `POST {}` returns `{ ok, checkedAt }`. The handler calls only `deps.store.keepAlive()` (`keep-alive/handler.ts:15-20`), which runs `rpc('keep_alive')` as the service role. No read of any table, no write, no IP hash, no storage call, no HTTP call. Any other body gets 400, 405, 413 or 415 before the database |
| Cost abuse on the Free plan | Unthrottled by design (a rate limit needs a write). Each call costs one function invocation and one trivial PostgREST call. Every other function costs at least one invocation per call too, rate-limited or not, so this adds no new kind of risk. See REV-11 for the one follow-up |
| No write | `keep_alive()` is `language sql stable` returning `now()` (`20261118000100_keep_alive.sql:6-11`). Postgres refuses data-modifying statements in a non-volatile SQL function, and pgTAP checks `provolatile = 's'`. The Deno test checks 30 calls leave museums, photos, objects, queue and rate-limit rows unchanged |
| Grants | `revoke all ... from public, anon, authenticated` and `grant execute ... to service_role` (lines 13-14). The explicit revoke from `anon` and `authenticated` is needed, because Supabase's default privileges grant execute on new `public` functions to both. `set search_path = ''` is set; `now()` resolves from `pg_catalog` |
| `lockdown.test.sql` | Plan 21 to 25 matches the 4 new assertions (anon, authenticated, service_role, stable). Not run: no Docker |
| Secrets in responses or logs | The response holds only `ok` and the database time. On failure `createEndpoint` logs `keep-alive: unexpected <ErrorName> (<code>)`, and `boot.ts` logs only names of missing variables. No body, token or key is logged |
| Contract strings in the browser bundle | `FUNCTION_NAMES.keepAlive` ships in `contract-*.js`. Harmless: the name is in the public repository |

### Findings

| ID | Severity | File and line | Evidence | Owner | Change needed |
|---|---|---|---|---|---|
| REV-1 | Minor | `src/api/mockClient.ts:10-11` | The module comment still says "drafts expire after 7 days and published museums after 90". The behaviour is right (line 519 uses `LIMITS.retentionDays`). ADR 0010's search pattern (`90 days`, `90-day`) and QA's static check (REV-8) both missed "after 90" | backend-developer (owns `src/api/`) | Change to "drafts expire 7 days after creation and published museums 7 days after first publish (`LIMITS`)" |
| REV-2 | Minor | `docs/requirements/requirements.md:450, 452` (Q-33, Q-35); `:336` NFR-16 (d); `:173` FR-54; `docs/requirements/user-stories.md:326` (US-27) | Q-33 and Q-35 still say **Open**, but the user answered both at A2 on 19/11/2026: (a) and (a), as `docs/project-status.md` records. NFR-16 (d), FR-54 and US-27 still say the link shows "the existing 'expired' screen". No such screen exists: Q-33 (a) is the shared not-found screen, and that is what the code and tests do | product-manager | Mark Q-33 and Q-35 answered (19/11/2026, (a) each). Change "the existing 'expired' screen" to "the not-found screen (Q-33 (a))" in NFR-16 (d), FR-54 and US-27. Do it together with the US-68 AC-3 and US-71 AC-3 "edit" wording already routed to you |
| REV-3 | Minor | `docs/architecture.md:846` (ADR index), `:606` (route table), `:576` (8.1), `:553` (7.6), `:516` (7.4); `docs/decisions/0010-retention-with-pg-cron.md:32` | ADR 0022 is listed as "Proposed, pending the design approval". The edit-page end date is "recommended, pending the tech lead", but it is built (`EditScreen.tsx:176`). The FR-105 coverage row names only `PublishedScreen`. Q-33 (a) is called "provisional" in 7.4 and ADR 0010. All were settled at A2 on 19/11/2026. My task only lets me edit `architecture.md` when a contract is wrong, and none of these is a contract | architect | In the next architecture sync (phase 6 or 7): ADR 0022 Accepted in section 16; the edit-page notice as built in 8.1, 7.6 and section 9; drop "provisional" in 7.4 and ADR 0010 line 32; add a v1.6.1 change-log row |
| REV-4 | Note | `docs/design-spec.md:5` (change note), `:1087` (7.5) | 7.5 says the single not-found screen is "provisional until the user decides at design approval". The user decided (Q-33 (a), A2, 19/11/2026) | ux-ui-designer | Drop "provisional" in both places on the next spec edit |
| REV-5 | Minor | `docs/api.md:483` (section 11) | Says the hourly job removes the rows and files "always within 24 hours". ADR 0010's amendment says a storage failure lasting more than 23 hours breaks NFR-16 (e), and nothing alerts on it. "Always" overstates what the user can rely on | backend-developer | "...normally within the hour, and within 24 hours unless storage deletes keep failing for 23 hourly retries (see the purge checks in `docs/deployment.md`)" |
| REV-6 | Minor | `.github/workflows/ci.yml:73-75, 92`; `.github/workflows/deploy-supabase.yml:25`; `docs/deployment.md:12, 60` | "The four handlers" (CI step name), "Deploy the four Edge Functions" (input description) and "four Edge Functions" and "all four functions" (guide). There are five. The CI comment at 73-75 says "Deno was never installed on the development machine, so none of these three commands has been run". That is no longer true: they were run on Deno 2.9.6 locally and pass on Linux CI (run 44686612364, as recorded in `docs/project-status.md`) | devops-engineer | Fold into the phase 6 items already routed (the "UNVERIFIED locally" label, the deployment guide): say "five" (or drop the count), and replace the 73-75 comment with the current state. The deploy needs no function list: `supabase functions deploy` with no names deploys every function folder, so `keep-alive` is included. The real requirement is that the first deploy runs with `migrations: true`, because `keep-alive` 500s until `keep_alive()` exists |
| REV-7 | Note | `supabase/functions/_shared/boot.ts:2` | "Process start-up shared by the four functions" | backend-developer | "...shared by the Edge Functions" |
| REV-8 | Note | `tests/e2e/keep-alive-static.spec.ts:116`, `:121-126` | (a) The NFR-16 regex `\b90[- ]?days?\b` missed "after 90" in `mockClient.ts:11` (REV-1). (b) The workflow checks skip while `keep-alive.yml` is missing. That is right before phase 6. After phase 6, a deleted or renamed workflow would skip quietly instead of failing | qa-engineer | (a) Also match a bare `\b90\b` near "retention", "expire" or "publish", or list `mockClient.ts` hits. (b) After phase 6, when you re-run this spec (already routed), make a missing `keep-alive.yml` a failure |
| REV-9 | Note | `tests/e2e/support/app.ts:121-123` | `WEBKIT_ONLY_WARNINGS` matches the unused-preload notice for any resource (`\S+`), while the comment says it is for `assets/three-<hash>.js`. In practice it filters only resources whose name contains webgl, three, shader or glsl, because only those reach the bucket. It hides no app defect: an unused modulepreload of a lazy chunk is expected when a test leaves a page early | qa-engineer | Anchor to the chunk names: `/^The resource \S+\/assets\/(three\|scene-shared)-[\w-]+\.js was preloaded .../` |
| REV-10 | Note | `tests/e2e/support/app.ts:199` (`FR15_BUDGET_MS` 1,000 / 4,000 ms on CI), `:207` (`CARD_UPGRADE_MAX_MS` 1,100 / 1,500 ms on CI) | Both allowances are CI-only and approved by the tech lead (19/11 and 20/11/2026), and the local limits are unchanged. I judge them sound: the CI figures (1104.9 ms, 1.1 to 2.7 s) are software-GL runner noise, and QA's macOS round 8 kept the strict limits. Every other QA change in the four commits tightens or keeps its assertion: the 2 px inset diff still fails a real 0.034 difference, the file-chooser test now hard-asserts that Enter clicks the input, and US-67 AC-1 gained a platform-independent "adds no height" check. But no automated gate now holds the strict 1,000 ms and 1,100 ms windows. CI is the only routine run | qa-engineer | No code change. In the release readiness report, state that the strict FR-15 and U1 windows were last met locally in QA round 8 (macOS), and re-run them locally in each Verify phase |
| REV-11 | Note | `supabase/functions/keep-alive/handler.ts:10`; ADR 0022 section 2 "Abuse" | Public, unthrottled endpoint, accepted by design. The control for invocation-quota abuse (third-party figure about 500,000 a month, unconfirmed) is the owner's usage check. ADR 0022 section 3 lists storage, database and egress for that check, but not Edge Function invocations | devops-engineer | In the phase 6 free-tier section of `docs/deployment.md`, add Edge Function invocations (dashboard Usage page) to the usage check, with "confirm the figure on supabase.com/pricing" |
| REV-12 | Note | `src/api/__tests__/mockClient.test.ts` (eb57dff); `src/ui/styles/components.css:391-393, 402-403` | Files edited outside the owner's paths: `src/api/` belongs to the backend-developer (ADR 0010 amendment items 8 to 10 named them), but the frontend-developer made the change. It is correct and both handoffs show it was agreed. In `components.css`, two unrelated rules were reflowed by Prettier along with the new `.availability` block | frontend-developer | No code change. Record the `src/api/` exception under Decisions in your handoff. In future, ask the owner or keep Prettier to the lines you change |
| REV-13 | Note | `supabase/functions/keep-alive/deno.lock`; `get-museum/` and `purge-expired/` have none | Per-function lockfiles are inconsistent (3 of 5 functions have one). CI uses only the root `deno.json` and lock (backend handoff request to the architect). Whether `supabase functions deploy` uses a per-function lock depends on the CLI version (not checked). Not an iteration 4 regression: keep-alive follows create-museum and manage-museum | backend-developer | Backlog: choose one rule (every function folder has a lock regenerated against the public registry, or none does), write it in `supabase/README.md`, and apply it |
| REV-14 | Note (resolved here) | `docs/decisions/0022-free-tier-hosting-and-keep-alive.md` section 2 "No secret"; `supabase/functions/_shared/config.ts:33-35` | The ADR said the function needs no secret. The built function starts through the shared `loadConfig`, so it needs the project's existing `RATE_LIMIT_SALT` and `ALLOWED_ORIGINS` as well as the injected service-role values, and answers 500 without them. That is acceptable (the run goes red), but the ADR was imprecise. Its "browser can send it" line was also loose | architect | Done in this review: ADR 0022 "Clarifications from the release review" items 1 and 2. No code change |

### Consistency across the documents

| Pair | Result |
|---|---|
| Code and `contract.ts`, `docs/api.md` v1.2 sections 5, 9, 10a and 11 | Match (`retentionDays`, `KeepAliveRequest`, `KeepAliveResponse`, status codes, no rate limit, no CORS). Wording issue REV-5 |
| Code and architecture v1.6 contracts (8.1) | Match: no new store field; `builderStore.publish.expiresAt` is written by `publishDraft` (`src/state/publish.ts:36`); the test hook is unchanged and flat (`src/main.tsx:25`); no asset change; the formatter follows the 8.1 rules (`new Date` instead of `Date.parse`, which parses the same). Stale status text REV-3 |
| ADR 0010 (amended) and code | All 12 listed changes are made. Item 11 (api.md) was done. One place it did not list (REV-1) |
| ADR 0022 and code | Endpoint, SQL, grants, config, store port, tests and smoke-test line as specified. Clarified (REV-14). Section 5 (workflow) is phase 6 |
| ADR 0013 (amended) and the repository | A `.npmrc` beside every `deno.json`, including `keep-alive/`; no credentials; no `tarball` lines |
| Requirements v0.7 (NFR-16, NFR-32, FR-104, FR-105, US-68 to US-71) | Every Must is traced to architecture 7.6 and to code or phase 6 work. FR-104 (Could) is deferred, and no in-app handling was built, which is correct. Status wording REV-2 |
| Design spec v2.1 5.18, 7.5 and section 10 | Code matches: placement after the share `LinkField` and before "Open my museum"; edit page only when `link && document`; line 1, line 2, fallback, no role or live region, hidden icon; not-found body; privacy sentence as its own paragraph. Wording REV-4 |

### Test adequacy (QA round 8)
- The retention, notice, not-found and privacy criteria that can be checked before deploy have e2e or unit coverage with a fixed clock and fixed time zones. I agree with QA's labels: US-71 AC-3 and US-68 AC-3 are Partly verified, because re-publish is the only path until Release 2 (wording routed to the product-manager).
- The four QA commits loosen no limit that hides a defect (REV-10 gives the reasoning). The `waitForTimeout(150)` in `support/app.ts:351` is the poll interval of a deadline loop, and it predates iteration 4. The counts of `waitForTimeout` in `caption-card`, `more-options` and `gender` are unchanged (8, 4 and 12).
- QA's Not verified list is complete for iteration 4. I add only what is in "Not checked" below.

### Already routed: comments only
| Item | Comment |
|---|---|
| devops-engineer: add `keep-alive` to deploy-supabase "if it lists functions" | It does not list them, so no change is needed beyond REV-6. The important part is the order: migrations (with `keep_alive()`) before the first functions deploy, then the repository variables |
| devops-engineer: one `npm run format` commit plus `format:check` in CI | Correct. It must include `tests/e2e/builder.spec.ts`, `ceiling.spec.ts` and `cr4-visit.spec.ts` (still unformatted) |
| Backlog: cap signed URLs at `expires_at`; `purgeHealthy` flag; draft end date on the edit page | Agree, backlog. NFR-16 is met without them |
| product-manager: US-71 AC-3 and US-68 AC-3 "edit" | Agree. Do it together with REV-2 |

### Not checked
- pgTAP `lockdown.test.sql` and the migration against a real Postgres: no Docker or Supabase project. The SQL and grants were checked by reading only.
- The real `supabase-js` `rpc('keep_alive')` return shape for a `timestamptz` (a string is expected; the code rejects anything else with a 500). Only the in-memory backend was exercised.
- Whether Supabase counts the keep-alive as project activity, whether the gateway requires `apikey` when `verify_jwt` is off, and the Free-plan quotas (Q-34). These need the live project and vendor pages.
- The keep-alive workflow and the deployment guide free-tier section: they do not exist yet (phase 6).
- The e2e suites: not re-run by me. I relied on QA round 8 and the tech lead's record of CI run 44686612364. I did not open the CI logs or view the four new baseline PNGs.
- Deno on Linux CI's `v2.x`: I ran 2.9.6 on macOS only.
- Screen readers, real devices, Firefox and Safari on a Mac (carried from earlier iterations).
- Git history for the old mirror hostname, by the user's decision. `docs/lifecycle/` (untracked, the tech lead's) was not reviewed.
- Code that iteration 4 did not change, beyond the paths named under "Retention, end to end".
