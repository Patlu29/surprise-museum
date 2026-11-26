# Handoff: architect

Iteration: 5 (Feature and fixes: OPS-1 + CR-13 purge health, CR-9 space full, DEBT-2, BUG-15, N-12, N-13). Phase: 2 Design, architecture step (26/11/2026). Iteration 4's notes (phase 7 sync, phase 5 review, phase 2 design) and earlier rounds follow below, unchanged.

## Iteration 5, phase 2 Design (26/11/2026)

### Summary
I designed purge health and the space-full guard, and wrote the contracts the frontend, the scene, QA and the designer build against. ADR 0023 has the purge write a one-row heartbeat at the end of each successful run. The keep-alive turns that, the purge queue's oldest entry and the oldest overdue expiry into one `purgeHealthy` boolean, and the workflow turns red on it. ADR 0024 measures storage and database size in SQL on each gated call and refuses with 409 `space_full` at 800 MB or 400 MB. ADR 0010 and ADR 0022 carry dated amendments. **Q-37: the app cannot read egress** (evidence below). `docs/architecture.md` is v1.7. All of it is Proposed until A2. No code, migration, function or workflow was written, and nothing is committed or deployed.

### Files changed
- `docs/decisions/0023-purge-health-in-the-keep-alive.md`: new (Proposed). Options for the success signal and for where the flag is computed; heartbeat table and SQL; `purge_health_inputs()`; `isPurgeHealthy` rules and boundaries; keep-alive order; contract; two-step workflow; deploy order; tests.
- `docs/decisions/0024-space-full-guard.md`: new (Proposed). Q-37 evidence; options; `space_usage()` SQL; threshold variables; gated and ungated actions; 409 `space_full`; fail open; client handling; mock switch; deploy order; tests.
- `docs/decisions/0010-retention-with-pg-cron.md`: status line and a 26/11/2026 amendment. The purge records its own success; the "nothing alerts" consequence is replaced.
- `docs/decisions/0022-free-tier-hosting-and-keep-alive.md`: status line (deployed 24/11/2026, amended 26/11/2026) and an amendment table covering sections 1 to 6, the context and the consequences.
- `docs/architecture.md` v1.6.1 to v1.7: header; 1 (keep-alive, purge health, space full, retention rows); 2 (no dependency change, checked); 3 (diagram and text); 5.2 (space checks in the flow); 7.1 (`purge_heartbeat`, three new SQL functions); 7.3 (`create-museum`, `keep-alive`, `reserve-photo`, `publish` rows; `space_full` error row); 7.4 (hourly job row; deploy-state sentence); 7.5 (reaches, never does, response, failure signal, usage check; first run 24/11/2026); new 7.7 purge health, 7.8 space full, 7.9 iteration 5 coverage; 8 (`builderStore` row); new 8.2 iteration 5 contracts; 10.2 (two rows changed, one added); 11 (Deno, pgTAP, live, e2e rows); 13 (threshold variables; release order; deploy-state sentence); 13.1 ("when a limit is reached" table, usage check, variables); 15 (two rows rewritten, four added); 16 (ADR 0022 note, 0023, 0024, amendment note); 17 (v1.7 row).
- `docs/handoffs/architect.md`: this section.

### Verification
| Check | Result | Label |
|---|---|---|
| Q-37, Management API | Fetched the public OpenAPI document `https://api.supabase.com/api/v1-json` (version 1.0.0, 368,601 bytes, sha256 `9dea9aa2…c080`) into the scratch folder. "egress" and "bandwidth" occur 0 times. The usage, analytics and metrics endpoints (`usage.api-counts`, `usage.api-requests-count`, `functions.combined-stats`, `logs.all`, `metrics`) all declare `bearer` security, meaning a personal access token or OAuth | Verified |
| Q-37, Supabase docs | "Manage your usage: Egress" (fetched 26/11/2026): "You can view Egress usage on the organization's usage page"; a Unified Egress Quota across services, per billing cycle | Verified |
| Q-37, project metrics endpoint (service-role key) gives host network counters, not billed egress | From memory | Not verified |
| Free-plan Edge Function limits used for the cost estimate | Supabase docs "Edge Functions limits" (fetched 26/11/2026): CPU 2 s per request excluding async I/O, memory 256 MB, wall clock 150 s on Free | Verified |
| Design matches today's code | Read `purge-expired`, `keep-alive`, `create-museum` and `manage-museum` handlers; `_shared/http.ts` (`STATUS_BY_CODE`), `ports.ts`, `config.ts`, `boot.ts`, `supabaseBackend.ts`, `contract.ts`; all five migrations; `keep-alive.yml`; `src/lib/apiPort.ts`; `src/api/liveClient.ts` (`KNOWN_CODES`), `mockClient.ts`, `index.ts`; `src/state/uploadQueue.ts`, `publish.ts`, `draft.ts` (`validateDraft`), `builderStore.ts`; `src/main.tsx` (hook block); `playwright.config.ts` (`--mode test`, mock) | Verified (read) |
| Client never sends a publish with an unstored photo | `validateDraft(…, 'publish')` returns `photos-failed` or `photos-uploading` when any photo is not `ready` (`src/state/draft.ts:140-155`) | Verified (read) |
| `?e2e=1` turns on the scene hook in any build | `src/scene/controllers/testHooks.ts:104-110` | Verified (read) |
| Installed versions equal the architecture table | `npm ls --depth=0` | Verified |
| `.abortSignal()` exists for the health query's 5 s timeout | `@supabase/postgrest-js` 2.118.0 (the version `supabase/functions/deno.lock` pins) has `abortSignal` in its type definitions in the local Deno cache | Verified |
| `npm run format:check` | "All matched files use Prettier code style!" Note: `.prettierignore` lists `*.md`, so Prettier does not actually check the Markdown files I changed | Verified (with that caveat) |
| SQL in ADR 0023 and ADR 0024 runs, grants hold, `storage.objects` is readable from `space_usage()`, `metadata->>'size'` and `pg_database_size` match the dashboard | No Postgres, Docker or Supabase CLI here, and the live project was not touched | Not verified (backend-developer: pgTAP and a local `supabase start`) |
| Cost of `space_usage()` per call | Reasoned from the index and object count | Not verified (estimate) |
| Lint, typecheck, unit tests, build | Not run: no code changed | Not verified (not applicable) |

### Decisions
- **The success signal is a heartbeat written by the purge as its last step** (ADR 0023). pg_cron status was rejected (A-41), as were `net._http_response` (kept about 6 hours, not ours) and a run log (grows). A run with `failed > 0` still counts as successful, because the queue-age condition watches failed deletes.
- **SQL returns timestamps and a pure TypeScript function decides**, so US-72's boundaries are tested in Deno with a fake clock. Only the boolean leaves the function.
- **The keep-alive calls `keep_alive()` first, then the health query** with a 5 s timeout. A failing check gives `false`, never a 500 (NFR-33 (d)).
- **The workflow has two steps**, so a purge-only red run shows the keep-alive step green and `keep-alive: ok` (US-69 AC-3). The summary line is exactly `purge: unhealthy`. The `::error` annotation names the cause (flag missing, or purge behind) without a count, age or key.
- **No seed row for the heartbeat**: a seed would claim a run that never happened. The flag is `false` for up to about 60 minutes after the first deploy.
- **Space is measured on every gated call with no cache** (0 minutes old). A snapshot job, an in-memory cache, Storage API listing and SQL-embedded checks were rejected (ADR 0024).
- **409 `space_full`**, consistent with `photo_limit` and `upload_quota`. 503 and 507 were rejected.
- **Gated actions: `create-museum`, `reserve-photo`, and `publish` only when a listed photo is not ready.** `renew-upload` and `confirm-photo` are not gated (FR-104 (c)).
- **Fail open** when the measurement errors (ADR 0024 section 5). Recorded as a risk.
- **Thresholds are optional function variables with defaults**, so a Q-34 change needs no code.
- **Mock switch through `__APP_TEST__.setMockSpaceFull`**, in memory and per page; no URL parameter (code-rules section 5).
- **Stale deploy statements in `architecture.md` updated** (7.4, 7.5, 13): the app has been live since 24/11/2026. The build legitimately moved on.

### Assumptions
- `space_usage()` as `security definer` (migration role) can read `storage.objects`, as the owner's dashboard query does (ADR 0022 section 3). If Supabase has restricted that, the guard fails open and the backend-developer reports it.
- Supabase counts storage close to `sum(metadata->>'size')` and database size as `pg_database_size`. The 80% line in decimal bytes is conservative if Supabase uses binary units.
- The designer's FR-106 copy stays within FR-106 (b). The server's `message` is never shown in place of it.

### Not done
- Code, migrations, functions, tests, `docs/api.md`, the workflow and the guide: owned by others, listed below.
- Live checks of the SQL: not possible here without touching the live project, which the task forbids.

### Contradictions found (requirements v0.8.1, ADRs, architecture, code)
| # | Where | Conflict | Winner (precedence) | Who changes what |
|---|---|---|---|---|
| C-1 | ADR 0022 section 2 "Reveals nothing… only `ok` and the database time"; architecture 7.3, 7.5, 8.1, 10.2 | NFR-33 (c) adds `purgeHealthy` | Requirements | **Done** (me): ADR 0022 amendment, architecture v1.7. 8.1 is left as the iteration 4 record; 8.2 supersedes it |
| C-2 | ADR 0022 context and consequences, architecture 10.2, 13.1 and 15: "no in-app handling (FR-104 deferred)" | FR-104, FR-106, FR-107 v0.8 | User decision 26/11/2026 | **Done** (me): ADR 0022 amendment, ADR 0024, architecture v1.7 |
| C-3 | ADR 0010 consequence "Nothing alerts on it today" | NFR-33, NFR-34 | Requirements | **Done** (me): ADR 0010 amendment |
| C-4 | Architecture 7.4, 7.5, 13: "nothing is deployed", "not yet run on GitHub" | Deployed 24/11/2026 (`docs/project-status.md`) | Project status | **Done** (me) |
| C-5 | `docs/api.md` 10a ("reveals nothing but the database clock", 200 body), section 4 errors (no `space_full`), section 12 mock (no switch); `keep-alive/handler.ts` header comment | ADR 0023, ADR 0024 | Requirements, then architecture | backend-developer (phase 3) |
| C-6 | `tests/e2e/keep-alive-static.spec.ts` asserts the old exact `KeepAliveResponse` and the one-step workflow | NFR-33 (c), NFR-34 | Requirements | qa-engineer: update with the backend and workflow changes |
| C-7 | `docs/deployment.md` "act now" at 80% and "no in-app handling" | FR-104 at 80% | User decision | devops-engineer (already requested by the product-manager, `docs/project-status.md`) |
| C-8 | NFR-33 (e) "calls nothing" | The keep-alive makes two read-only database calls (`keep_alive()`, `purge_health_inputs()`). I read "calls nothing" as no HTTP call, no purge, no write | Requirements (intent) | product-manager: optional wording, "calls no other function and no purge" |
| C-9 | FR-108 says the dock "depends only on the viewport's size and orientation" and also "does not change while the card is open" | Unclear when the phone rotates while the card is open | Requirements; detail is the designer's | ux-ui-designer to decide; product-manager to align FR-108 if needed. My contract: it changes only on a viewport change |
| C-10 | US-74 AC-5 and FR-106 expect a refused publish to show the space-full outcome | In the built client, `validateDraft` stops a publish with an unstored photo before any request, so the server's publish refusal is reached only at the API (Deno and mock tests) | Requirements | ux-ui-designer: the new `photos-space-full` issue should open the FR-106 message (recommended). product-manager: optionally note that AC-5 is checked at the API |
| C-11 | Code-rules section 5 ("never enable [the test hook] from a URL parameter alone") and architecture 11 ("scene hooks with `__SURPRISE_E2E__`") | `testHooksEnabled()` also accepts `?e2e=1` in production builds (`src/scene/controllers/testHooks.ts:107`), so anyone can install `window.__surpriseMuseum` on the live site. Effect is limited to the user's own tab (teleport, snapshot, fail a photo); no data or secret | Code rules (security) | scene-developer: gate it on `import.meta.env.DEV \|\| import.meta.env.MODE === 'test'` and keep the opt-ins inside that. QA's `?e2e=1` uses run on the test build and keep working. Tech lead: decide whether it joins iteration 5. Earlier releases did not catch it |

### Open questions
1. **Fail open or fail closed when the space measurement errors?** (a) Fail open: Creators carry on and the guard is off until someone reads the logs. (b) Fail closed with the generic 500: every new photo fails while the fault lasts. **Recommend (a)**, because creating a museum is Must and the guard is Should (ADR 0024 section 5). Owner: user at A2, or the tech lead.
2. **C-11 `?e2e=1` in production**: fix it in this iteration? **Recommend yes.** It is a one-line gate and a code-rules security breach, even though the impact is small. Owner: tech lead.
3. **NFR-34 (b) annotation text**: the `::error` annotation names the cause ("flag missing" or "purge behind") and holds no count, age or key; the summary line stays exactly `purge: unhealthy`. Acceptable, or must the annotation also be only "purge: unhealthy"? **Recommend acceptable.** Owner: product-manager.

### Requests for other agents
- [open] **backend-developer** (phase 3; ADR 0023, ADR 0024, architecture 7.7, 7.8, 8.2):
  1. Migrations: `purge_heartbeat` with `record_purge_success()` and `purge_health_inputs()`; `space_usage()`. Use the grants, RLS and `revoke … from public, anon, authenticated` exactly as in the ADRs. Do not seed the heartbeat.
  2. `_shared/purgeHealth.ts` (`PURGE_HEALTH_MAX_AGE_MS`, `PurgeHealthInputs`, `isPurgeHealthy`) and `_shared/space.ts` (`isSpaceFull`), both pure.
  3. `ports.ts`: `recordPurgeSuccess`, `purgeHealthInputs`, `spaceUsage`. Implement them in `supabaseBackend.ts` (health query with `.abortSignal()` and a 5 s timeout) and in both in-memory backends.
  4. Handlers: `purge-expired` (heartbeat as the last step); `keep-alive` (order and exact three keys; `false` on error or timeout; log the error name only; update the header comment); `create-museum` and `manage-museum` (`reserve-photo`; `publish` only when a listed photo is not ready; fail open with `space check unavailable (<name>)`).
  5. `config.ts`: optional `SPACE_FULL_STORAGE_BYTES` and `SPACE_FULL_DATABASE_BYTES` (whole numbers, 1 to 10^12; invalid is a `ConfigError`).
  6. `contract.ts`: `KeepAliveResponse.purgeHealthy: boolean`; `ApiErrorCode` `'space_full'` (409). `http.ts` `STATUS_BY_CODE`. `CONTRACT_VERSION` stays 1.
  7. `src/api/liveClient.ts`: `KNOWN_CODES` adds `space_full`. `src/api/mockClient.ts`: `STATUS`, `MockApiOptions.spaceFull`, `setSpaceFull`, and the same three checks as the server. `src/api/index.ts`: `setDemoSpaceFull`.
  8. Tests as listed in ADR 0023 and ADR 0024 (Deno, pgTAP, mock unit tests). Run `space_usage()` once against a local `supabase start` and report whether `storage.objects` was readable.
  9. `supabase/scripts/smoke-test.mjs`: assert the keep-alive body has exactly three keys and a boolean `purgeHealthy`, and print only `purge: healthy` or `purge: unhealthy`.
  10. `docs/api.md`: sections 1, 4 (`space_full` row), 5, 7, 9 (`reserve-photo`, `publish`), 10 (heartbeat), 10a (new body, what it reveals), 12 (mock switch), change log. `supabase/README.md`: the optional variables and what a "purge unhealthy" run means for the checks.
- [open] **frontend-developer** (phase 3; architecture 8.2):
  1. `builderStore`: `spaceFull`, `setSpaceFull`, cleared by `reset()`, never persisted.
  2. `draft.ts`: `PhotoErrorKind` `'space-full'`; `validateDraft` issue `photos-space-full`.
  3. `uploadQueue.ts`: first-refusal behaviour (mark the waiting photos too) and `retrySpaceFull()`. `publish.ts`: the `space_full` path (phase back to `'idle'`, no generic error).
  4. `src/lib/apiPort.ts`: `isSpaceFull` and the `describeApiError` case.
  5. `src/main.tsx`: `setMockSpaceFull` in the existing hook block only.
  6. The FR-106 message per the design spec; the finale dock from a pure viewport function (`data-dock` kept); FR-110 per the design spec. Unit tests for the store, the queue and the dock function.
- [open] **scene-developer** (phase 3): `headBoxes()` on `window.__surpriseMuseum` (architecture 8.2); FR-109 and FR-111 in the label solver; C-11 gate if the tech lead agrees.
- [open] **devops-engineer** (phase 3 or 6):
  1. `keep-alive.yml` exactly as ADR 0023 section 4: two steps, `jq -e '.purgeHealthy == true'`, the exact summary lines, no body printed, `permissions: {}` unchanged. **Do not let it reach `main` before the function deploy and one purge run** (architecture 13, release order).
  2. `docs/deployment.md`: what a red "purge: unhealthy" run means and the checks to make (NFR-34 (f)); the in-app refusal at 80%; egress is a limit the app cannot detect; the optional threshold variables; the iteration 5 release order; the "act now" line below 80% (C-7). `CHANGELOG.md`.
- [open] **ux-ui-designer** (this phase, after me):
  1. The FR-106 message (copy within FR-106 (b), states, focus, reduced motion).
  2. Row wording for a photo with `errorKind: 'space-full'`.
  3. Whether choosing Publish with such a photo opens the message (recommended, C-10).
  4. The heading text that `describeApiError` falls back to.
  5. The finale dock for each A-23 viewport, and what happens on rotation while the card is open (C-9).
  6. N-12 pills and N-13 labels.
- [open] **qa-engineer** (phase 3 smoke, phase 4):
  1. Update `keep-alive-static.spec.ts` (C-6) and test the workflow's step 2 on saved responses (US-73 AC-1 to AC-3: `false`, missing, `null`, `"true"`, `true`).
  2. Add `setMockSpaceFull?: (full: boolean) => void` to the shared hook type. Use it for US-74 to US-77, setting it after every navigation that reloads the page.
  3. Release check: search `dist/` for `__APP_TEST__` and `setMockSpaceFull`.
  4. Use `headBoxes()` for US-80 AC-5.
- [open] **product-manager**: C-8 (optional wording), C-9, C-10 (optional AC-5 note), open question 3. Record Q-37 as answered: egress is a limit the app cannot detect (FR-104 (e), NFR-32 (f), US-70 AC-5, US-74 AC-6).
- [open] **tech lead**: hold the `keep-alive.yml` change out of `main` until the release order allows it; decide open questions 1 and 2.

### Requests received
- [done] from tech lead (iteration 5, phase 2): purge health design, space-full design, client contracts, Q-37 with evidence, contract notes for the visual fixes, contradictions list. See above.

---


## Phase 7 documentation sync (23/11/2026)

### Summary
Fixed my own review finding REV-3 and brought the architecture in line with phase 6. `docs/architecture.md` is v1.6.1: ADR 0022 Accepted, Q-33 (a) and Q-35 (a) recorded as the user's A2 decisions, the edit-page end date recorded as built, and the keep-alive workflow, the migrations-first Supabase deploy, `format:check` in CI and the `tokens.css` Prettier exception described. No contract changed. No code touched; nothing committed.

### Files changed
- `docs/architecture.md` v1.6 to v1.6.1: header and version note; 7.4 (Q-33 (a) no longer "provisional"); 7.5 (workflow built in cbbd7e4, not yet run; failure signal includes missing key and non-https URL, key masked); 7.6 (FR-105 row: Must per Q-35 (a), `AvailabilityNotice` on `PublishedScreen` and `EditScreen`); 8.1 (edit page as built; formatter signature and `new Date` parsing as built; wording from design spec v2.1 5.18); 9 (edit route "built"); 13 (scripts row notes `format:check` in CI; new Formatting row for `.prettierignore` and `tokens.css`; deployment paragraph: migrations first, then all five functions, smoke test is a reminder run by hand, nothing deployed); 14 (`.prettierignore` listed as architect root config); 15 (signed-URL cap is a backlog candidate, no longer an open question); 16 (ADR 0022 Accepted); 17 (v1.6.1 row).
- `docs/decisions/0010-retention-with-pg-cron.md` line 32: Q-33 (a) is the user's A2 decision (19/11/2026), not "provisionally accepted by the tech lead".
- `docs/decisions/0022-free-tier-hosting-and-keep-alive.md` status: the section 5 workflow is built (cbbd7e4) with two extra guards (missing key, non-https URL; key masked), not yet run on GitHub.
- `docs/handoffs/architect.md`: this section; REV-3 marked done.

### Verification
| Check | Result | Label |
|---|---|---|
| Edit page shows the end date | `src/ui/screens/EditScreen.tsx:176` renders `AvailabilityNotice` with `data.expiresAt`, `context="edit"`, inside `link && document`; `PublishedScreen.tsx:79` uses the same component | Verified (read) |
| Formatter as described | `src/lib/format.ts:26-34` | Verified (read) |
| Keep-alive facts in 7.5 | Read `.github/workflows/keep-alive.yml`: cron `37 20 * * *`, `workflow_dispatch`, `permissions: {}`, job `if: vars.VITE_SUPABASE_URL != ''`, key check, https check, `add-mask`, curl `--retry 3`, `jq` body check | Verified (read) |
| Deploy facts in 13 | Read `.github/workflows/deploy-supabase.yml`: `migrations` input default true, dry run then `db push`, then `functions deploy --no-verify-jwt` with no names; smoke test only in the summary reminder | Verified (read) |
| `format:check` in CI, `tokens.css` ignored | `ci.yml:54`; `.prettierignore` last line | Verified (read) |
| No "Proposed", "pending the" or stale "provisional" left for iteration 4 | `grep -nE "provisional\|Proposed\|pending the\|recommended" docs/architecture.md`: remaining hits are the lapsed ADR 0021 6,500 ceiling and historical change-log rows | Verified |
| Prettier | `*.md` is in `.prettierignore`; `npx prettier --check docs/architecture.md` reports clean | Verified |
| Workflows run on GitHub | not run; nothing deployed | Not verified |

### Decisions
- **Historical change-log rows left as written** (v1.6 says "Edit-page end date recommended"): they record what was true on that date. The v1.6.1 row supersedes them.
- **`.prettierignore` listed as architect-owned root config** (team-conventions: Prettier config is the architect's). The devops-engineer's `tokens.css` line, made at the tech lead's direction, is accepted as is.

### Not done
- Nothing in scope. Other owners' REV items are unchanged by this task.

### Requests for other agents
- None new.

---

## Phase 5 Review (20/11/2026)

## Summary
I reviewed iteration 4 for release by reading the code from `2260e88~3` to HEAD 5b307f5. The review is `docs/review.md`: **no critical or major finding open**, 5 Minor, 9 Note. Retention is correct end to end. The keep-alive writes nothing, is granted to `service_role` only, and leaks nothing. No secret, credential or mirror hostname is in the current files. The test hook is absent from a production build. The four QA commits loosen no limit that hides a defect. ADR 0022 is now Accepted (user A2, 19/11/2026), with two clarifications that change no decision. Nothing is committed.

## Files changed
- `docs/review.md`: new; header and the iteration 4 section (REV-1 to REV-14, checks, consistency, test adequacy, not checked, verdict).
- `docs/decisions/0022-free-tier-hosting-and-keep-alive.md`: status Accepted (19/11/2026, A2); new "Clarifications from the release review". (1) "No secret" is the caller's view: the function boots through the shared `loadConfig`, so it needs `RATE_LIMIT_SALT` and `ALLOWED_ORIGINS` and answers 500 without them. (2) What a cross-site browser can and cannot send.
- `docs/handoffs/architect.md`: this section; earlier requests marked.

## Verification
| Check | Result | Label |
|---|---|---|
| `npx tsc -b --noEmit`, `npx tsc -p tsconfig.e2e.json --noEmit`, `npx eslint .` | exit 0 each | Verified |
| `npx vitest run` | 72 files, 1,084 passed | Verified |
| Deno 2.9.6 via `npx` (scratch `DENO_DIR`, public registry set per command): check, lint, `test --frozen` | pass; 35 tests; no lockfile change | Verified (macOS) |
| Production build into the scratchpad (`vite build`, not `npm run build`), search for `__APP_TEST__` | 0 files; `dist/` untouched | Verified |
| `npm audit --omit=dev` | 0 vulnerabilities; no dependency change this iteration | Verified |
| Mirror hostname and credential patterns in the current tree; `.npmrc` contents; `tarball` in `deno.lock` | none; registry lines only; 0 | Verified |
| pgTAP, real Postgres, real `supabase-js` rpc shape, Supabase activity rule, e2e suites, CI logs, baseline PNGs | not run or opened (see review "Not checked") | Not verified |

## Decisions
- **ADR 0022 needed clarification, not correction.** The design matches the code. The ADR now says what the function needs to start and what a browser can do.
- **Stale status text in `architecture.md` (REV-3) is left for a later sync.** The task allowed edits to `architecture.md` only for a wrong contract. No contract is wrong: store, test hook, assets and API all match the code.
- **CI-only timing allowances are sound** (REV-10). Shared runners are not timing evidence, and the local strict windows are unchanged. The gap is that no automated gate holds the strict windows now.

## Assumptions
- QA round 8 counts and the tech lead's record of CI run 44686612364 are accurate. I did not open the run.

## Not done
- REV-3 (my own `architecture.md` and ADR 0010 status text): out of this task's edit scope then; done in the phase 7 sync (see above).

## Open questions
- None for the user. Q-34 (confirm free-plan figures) still stands. REV-11 adds Edge Function invocations to the figures the user should confirm.

## Requests for other agents
- [open] backend-developer: REV-1 (`src/api/mockClient.ts:10-11` comment), REV-5 (`docs/api.md:483` "always"), REV-7 (`boot.ts:2`), REV-13 (one rule for per-function `deno.lock`, backlog).
- [open] product-manager: REV-2 (Q-33 and Q-35 answered; "expired screen" wording in NFR-16 (d), FR-54 and US-27), with the routed US-68 and US-71 AC-3 wording.
- [open] devops-engineer (phase 6): REV-6 ("four" wording and the stale Deno comment; first deploy with `migrations: true`), REV-11 (invocations in the usage check).
- [open] qa-engineer: REV-8 (regex gap; fail on a missing `keep-alive.yml` after phase 6), REV-9 (anchor the WebKit preload filter), REV-10 (state in release readiness where the strict timing windows were last met).
- [open] ux-ui-designer: REV-4 (drop "provisional" in spec 7.5 and the change note).
- [open] frontend-developer: REV-12 (record the `src/api/` test edit as an ownership exception).
- [done] architect (me): REV-3, in the phase 7 sync (23/11/2026, v1.6.1).

## Requests received
- [done] from tech lead (phase 5): release review in `docs/review.md`; ADR 0022 set to Accepted.
- [done] from backend-developer: "Deno does not use `keep-alive/deno.lock` in CI". Correct: CI passes the root `deno.json`. Whether the Supabase CLI uses a per-function lock when it deploys was not checked. Make the lockfile rule consistent (REV-13, backlog). Keep the per-function `.npmrc` files either way (ADR 0013).

---

## Phase 2 Design (18/11/2026)

### Summary
ADR 0010 is amended for NFR-16 v0.7. Published museums last 7 days from first publish, purge completes within 24 hours, and there are no backups. The mechanism is unchanged, and the amendment lists every file to change. ADR 0022 (Proposed) decides free-tier hosting and a daily keep-alive: a new read-only `keep-alive` Edge Function, called by a scheduled workflow with the public anon key, with usage checked in the dashboard only. `docs/architecture.md` is v1.6, with no 90-day figure left except as the old value in change notes. Separately, the first CI failure was traced to Deno reading `~/.npmrc` (a corporate mirror) instead of the root `.npmrc`. I added an `.npmrc` beside each Deno config and amended ADR 0013. Nothing is committed.

### Files changed
- `docs/decisions/0010-retention-with-pg-cron.md`: status note; amendment covering the requirement change, how the design meets each rule (with evidence), the 12-row change list, FR-54 rule and consequences.
- `docs/decisions/0022-free-tier-hosting-and-keep-alive.md`: new ADR (Proposed).
- `docs/decisions/0003-supabase-edge-function-gateway.md`: status line notes the fifth function (ADR 0022).
- `docs/decisions/0013-public-npm-registry.md`: amendment on the Deno `.npmrc` files.
- `docs/architecture.md` v1.5 to v1.6: header; 1 (hosting, backend, keep-alive, retention rows); 3 (diagram); 5.2 (publish returns first publish + 7 days, FR-105 note); 7.1 (`expires_at`, SQL function list); 7.3 (`keep-alive` row); 7.4 (retention rewritten); new 7.5 (keep-alive), 7.6 (iteration 4 coverage), 8.1 (contract changes); 9 (edit page end date, recommended); 10.2; 11; 13 (deployment paragraph, registry row) and new 13.1 (free tiers); 15 (risks); 16 (ADR index); 17 (v1.6).
- `.npmrc` (root): same three settings, each now with a one-line comment.
- New `.npmrc` (one comment line plus `registry=https://registry.npmjs.org/`) in `supabase/functions/`, `create-museum/`, `get-museum/`, `manage-museum/`, `purge-expired/`. **Ownership exception:** `supabase/**` is the backend-developer's; added at the tech lead's direction for this task.
- `docs/handoffs/architect.md`: this note.

### Verification
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

### Decisions
- **Retention: change the value, not the mechanism** (ADR 0010 amendment). One constant (`LIMITS.retentionDays`), migration comments edited in place, no new retention migration, no data migration (nothing deployed).
- **Keep-alive calls a new read-only `keep-alive` Edge Function** that runs `select public.keep_alive()` (`now()`) through the service role. It reaches the gateway, a function, PostgREST and Postgres, writes nothing, needs only the public anon key, and has no rate limit, because a rate limit needs a write. Rejected: `get-museum` with a dummy token (writes rows and adds misses), `purge-expired` (forbidden, needs a secret), direct PostgREST (breaks ADR 0003; kept as fallback).
- **Usage check: dashboard only.** Egress is not readable from SQL; sizes on a public endpoint help someone fill the storage.
- **Daily schedule (20:37 UTC)**, not every 3 days: 3 consecutive failures before a 72-hour window is empty. The job is **skipped while `VITE_SUPABASE_URL` is empty**, so there are no failure e-mails before launch.
- **60-day rule: document it, do not automate.** Self-committing or self-enabling workflows were rejected (write permissions, third-party actions, noisy history).
- **No store or test-hook change for FR-105**: `builderStore.publish.expiresAt` already holds the server value. The end date is always the server's, formatted by one pure function without `toLocaleString`.
- **`.npmrc` beside every Deno config**, not a Deno workspace restructure: it is the smallest fix and was proven by test. CI-only env vars would not protect local regeneration.

### Assumptions
- Supabase counts a request through the API gateway with the project key that reaches Postgres as activity (not documented; ADR 0022 risk and fallback).
- GitHub e-mails scheduled-run failures to the user who last changed the `cron` line, when Actions notifications are on.
- `net._http_response` keeps rows about 6 hours (pg_net default), for the purge health check.

### Not done
- `docs/api.md`, `supabase/**` code, `src/`, `tests/`, `.github/`, `docs/deployment.md`: owned by others; listed below.
- Requirement-coverage table for the whole app: the architecture has never had one. 7.6 covers the iteration 4 Musts only.

### Open questions
1. **Copy changes need the designer**, who is not scheduled: the FR-105 notice (publish screen, and the edit page if Q2 is accepted) and the not-found body for Q-33 (a) (design spec 7.5, which has the exact current text). Options: (a) a short design-spec patch before the build; (b) the frontend uses the requirements wording and the designer records it as built. **Recommend (a)**, and keep the heading "We can't find that museum" so the 6 e2e assertions on it hold. Owner: tech lead.
2. **US-71 AC-3 ("open the publish screen again")**: the builder's publish screen cannot be reopened (the edit token is memory-only; editing is Release 2). Options: (a) show the same end date on the edit page from `ManageGetResponse.expiresAt`; (b) treat AC-3 as API-level only. **Recommend (a)**: small, and it is the only place the Creator can see the date again. Owner: tech lead, product-manager.
3. **Cap signed-URL lifetime at `expires_at`** (`get-museum`: TTL = min(3600 s, time left), `urlsExpireAt` likewise), so an open session cannot load photos after the end. **Recommend yes if the backend has room this iteration, otherwise backlog**; NFR-16 is met without it. Owner: tech lead.
4. **Purge health in the keep-alive** (a single `purgeHealthy` boolean, so a stuck purge turns the daily run red). **Recommend backlog**, not now: it keeps the keep-alive minimal, and the dashboard checks are documented. Owner: tech lead.
5. **Privacy page**: add one sentence saying there are no backups and content is removed within 24 hours? **Recommend yes**, worded by the designer, and reviewed under LEG-1. Owner: tech lead.
6. Q-33 (b), if the user chooses it at approval, needs a distinct `expired` API response: a contract change, an ADR 0003 and ADR 0010 amendment, and new tests. The design assumes (a). Q-35 (c) would drop FR-105 and the formatter work. Owner: user.
7. Confirm Supabase's idle-pause rule and the free figures (extends Q-34), and watch the first 7 or more days after launch. Owner: user.

### Requests for other agents
- [done] **backend-developer** (eb57dff, checked in the phase 5 review; item 5 went to the backlog):
  1. Retention, items 1 to 12 of the ADR 0010 amendment table: `contract.ts` `retentionDays: 7` and comment; migration comments in `20261027000100_initial_schema.sql:59` and `20261027000200_retention_schedule.sql` (the "7-day window" comment); `purge-expired/handler.ts:3` comment; tests `purge_test.ts:36-90` (restructure: publish on day 3), `flow_test.ts:99` (use `LIMITS.retentionDays`), `flow_test.ts:261` (8 days), `src/api/__tests__/mockClient.test.ts:251` (use `LIMITS.retentionDays`), `:298-311` (restructure), `:314-323` (re-publish on day 3); `supabase/README.md:45`.
  2. Keep-alive per ADR 0022 section 4: migration `20261118000100_keep_alive.sql`; `supabase/functions/keep-alive/` (`index.ts`, `handler.ts`, `deno.json`, **and an `.npmrc` like the other function folders**); `FUNCTION_NAMES.keepAlive`, `KeepAliveRequest`, `KeepAliveResponse`; `keepAlive()` on the store port, the Supabase backend and the memory backend; `[functions.keep-alive] verify_jwt = false` in `config.toml`; Deno tests (200 shape, nothing created, no rate-limit row, 400, 405, 415, 500); pgTAP (`anon` and `authenticated` cannot execute `keep_alive()`); a smoke-test line; README function list ("four" to five).
  3. `docs/api.md`: version and change-log row; section 1 table and "four" to five functions; section 5 published lifetime "7 days from the first publish" and a `keep-alive` row with no rate limit; section 9 publish example `expiresAt` to `2026-11-04T01:00:00.000Z` and the rule text "(7 days from the first publish)", plus a note that the browser shows `expiresAt` as the end date (FR-105); section 10 `purged` meaning; a new `keep-alive` section (ADR 0022 section 4); section 11 first publish + 7 days, out of live storage within 24 hours, no backups.
  4. Never let a `deno.lock` contain `"tarball"`. Regenerate it if it does (ADR 0013 amendment).
  5. Optional, by the tech lead's call: open question 3 (URL TTL cap).
- [done] **frontend-developer** (eb57dff, checked in the phase 5 review; the edit-page notice was built after A2):
  1. FR-105 notice on `PublishedScreen` from `useBuilderStore((s) => s.publish.expiresAt)`; days from `LIMITS.retentionDays`; date in `<time dateTime={expiresAt}>`; must say deleting with the edit link ends it sooner; fits 360 px at 200% text; copy from the designer (open question 1).
  2. `formatEndDateTime(iso: string): string | null` in `src/lib/format.ts` (architecture 8.1): `Date.parse`, `null` if not finite, `DD/MM/YYYY HH:mm` from local getters, zero-padded, 24-hour. Unit tests in `src/lib/format.test.ts` built from local-time `Date`s (zone-independent): padding, midnight `00:00`, invalid input.
  3. If open question 2 is accepted: the same notice on `EditScreen` for a published museum, from `data.expiresAt`.
  4. `NotFoundScreen` body for Q-33 (a), wording from the designer, heading unchanged if the designer agrees.
  5. Check only: `LegalScreen` shows "7 days" once the backend changes the constant (no edit). No hard-coded 90 in `src/ui` (verified by search).
- [open] **devops-engineer** (phase 6, still open; see also REV-6 and REV-11):
  1. `.github/workflows/keep-alive.yml` per ADR 0022 section 5: daily `37 20 * * *` plus `workflow_dispatch`; job `if: vars.VITE_SUPABASE_URL != ''`; `permissions: {}`; `ubuntu-24.04`; `timeout-minutes: 5`; `concurrency: keep-alive`; `curl --fail-with-body --retry 3 --retry-delay 20 --retry-all-errors --max-time 30` with the URL and key through `env:` (no `${{ }}` inside `run:`); `jq -e '.ok == true and (.checkedAt | type == "string")'`; `checkedAt` to the job summary; no checkout and no secrets.
  2. `docs/deployment.md` free-tier section (NFR-32 (c) to (f), US-70): the three limits marked "confirm on supabase.com/pricing"; the capacity arithmetic; dashboard usage steps and the two SQL queries in ADR 0022 section 3; how to confirm the last keep-alive run; the 60-day rule with the 50-day reminder and re-enable steps; restoring a paused project; the GitHub notification setting; what happens at each limit and what to do, no in-app handling; no backups; no prices (contact Supabase sales). Purge health: `cron.job_run_details` for `surprise-museum-purge`, `net._http_response` status and `failed`, and `select count(*) from public.storage_purge_queue` (US-68 AC-5, AC-6). Update manual step 4 ("choosing a plan is yours" now conflicts with the user's Free-plan decision), the workflow table, and the "No scheduled checks" gap.
  3. Go-live order: migrations and functions (including `keep-alive`) before setting the repository variables, or the first keep-alive runs fail.
  4. `CHANGELOG.md` entry. The CI Deno failure is routed separately by the tech lead; locally the Deno steps now pass (see Verification).
- [done] **qa-engineer** (QA round 8; US-69 workflow checks and US-70 wait for phase 6):
  1. US-68: in the mock build with `page.clock`, publish at T; at T + 168 h − 1 min the share link loads; at T + 168 h + 1 s it shows the not-found screen with the new wording. Draft: D + 168 h makes the edit link not found. AC-3 (re-publish) has no UI until Release 2, so review the backend's Deno and mock tests instead. AC-5 and AC-6 are live-only: run them post-deploy with the guide's steps; Not verified until then.
  2. US-71: the notice says 7 days; the `<time>` `datetime` equals `window.__APP_TEST__.useBuilderStore.getState().publish.expiresAt`; the text equals its `DD/MM/YYYY HH:mm` under a fixed `timezoneId` (Australia/Sydney and one other zone); the date equals the publish moment + 168 h within 1 minute; 360 px at 200% text has no horizontal scroll; the deleting-sooner sentence is present; the edit page shows the same date if open question 2 is accepted.
  3. US-69: a static review of `keep-alive.yml` (daily, `permissions: {}`, no secrets, only the `keep-alive` URL), plus the backend's "nothing created" Deno test. Run history is post-deploy.
  4. US-70: manual review of `docs/deployment.md` against its acceptance criteria.
  5. Full regression. The not-found heading assertions change only if the designer changes the heading.
- [done] **tech lead**: Q1 went to the designer (spec v2.1); Q2 accepted (edit-page notice built); Q3 and Q4 went to the backlog; Q5 done (privacy sentence); Q6 settled by the user at A2 (Q-33 (a), Q-35 (a)).

### Requests received
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
