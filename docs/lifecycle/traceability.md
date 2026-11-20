# Traceability

Compiled by the tech lead in phase 5 Review from `docs/requirements/requirements.md` (v0.7), `docs/requirements/user-stories.md`, `docs/design-spec.md` (v2.1) and `docs/qa-report.md` (round 8). If a row is wrong, correct the source document, not this matrix.

Labels: **Verified** (tested, passed), **Partly verified** (tested with a stated limit), **Not verified** (not testable here, reason given), **Not tested** (no test yet).

## Iteration 4 (Feature and hosting), 20/11/2026

Test environment: macOS, Playwright Chromium (desktop, Pixel 7 emulation) and WebKit (iPhone 13 emulation) against the mock backend, plus Linux CI run 44686612364 (commit 4a3c552) on the same three projects; Deno unit tests for the functions (35 pass, backend handoff; Deno job green in CI). Firefox, real devices and the deployed Supabase project were not available.

| Requirement | Priority | Story and criterion | Design ref | Test | Result | Label |
|---|---|---|---|---|---|---|
| FR-105 | Must | US-71 AC-1: says 7 days | 5.18, 12.5.5 | `tests/e2e/retention.spec.ts`; `src/ui/components/AvailabilityNotice.test.tsx` | Pass, 3 projects, macOS and Linux | Verified |
| FR-105 | Must | US-71 AC-2: end date DD/MM/YYYY HH:mm local = first publish + 168 h | 5.18 | `retention.spec.ts` (pinned clock; Sydney, New York, UTC, Auckland); `src/lib/format` unit tests | Pass | Verified |
| FR-105 | Must | US-71 AC-3: re-publish or edit leaves the date unchanged | 5.18, edit page | `retention.spec.ts` (re-publish on day 3; edit page reads the same instant); `mockClient.test.ts` (edit at unit level) | Pass for re-publish; editing a published museum has no UI in the MVP (Release 2) | Partly verified |
| FR-105 | Must | US-71 AC-4: 360 px, text 200%, no horizontal scroll | 5.18 | `retention.spec.ts` at 320 and 360 px with `html { font-size: 200% }` | Pass; the browser's own text-size setting was not used | Verified (emulated) |
| FR-105 | Must | US-71 AC-5: deleting through the edit link ends it sooner | 5.18 | `retention.spec.ts` (exact line 2 on both screens) | Pass | Verified |
| FR-105 | Must | Spec 5.18: notice only when published; fallback for a bad date | 5.18 | `retention.spec.ts`; `AvailabilityNotice.test.tsx` | Pass; screen-reader output not checked | Verified |
| NFR-16 (a) | Must | US-68 AC-1: link works before T + 168 h | 7.5 | `retention.spec.ts` (T + 1 day, T + 168 h - 1 s) | Pass against the mock backend | Verified (mock) |
| NFR-16 (b) | Must | US-68 AC-2: not-found after T + 168 h | 7.5 | `retention.spec.ts` (T + 168 h + 1 s, share and edit links) | Pass; the 60-second bound belongs to the live system | Verified (mock) |
| NFR-16 (c) | Must | US-68 AC-3: re-publish on day 3 still ends at T + 168 h | 5.18 | `retention.spec.ts`; Deno `flow_test` | Pass for re-publish; edit as US-71 AC-3 | Partly verified |
| NFR-16 (d) | Must | US-68 AC-4: draft ends 7 days after creation | architecture 7.4 | `retention.spec.ts`; Deno `purge_test` | End time and opening pass; the purge of its photos needs the deployed project | Partly verified |
| NFR-16 (e) | Must | US-68 AC-5: 0 rows and 0 objects 24 h after the end | ADR 0010 | Deno `purge_test` (logic only) | Needs the deployed project, purge job, row count and storage listing | Not verified |
| NFR-16 (e) | Must | US-68 AC-6: at least 23 hourly runs in any 24 h | ADR 0010 | none possible before launch | Needs the live `pg_cron` run record | Not verified |
| NFR-16 (f) | Must | No backups on the Free plan; privacy page says so | 10 (Privacy) | `retention.spec.ts` (privacy wording); `privacy.png` baseline | Wording pass; the plan's backup setting needs the Supabase dashboard (Q-34) | Partly verified |
| FR-52 | Must | US-24 AC-3 (changed): 0 rows 24 h after delete | ADR 0010 | existing US-24 AC-2 e2e (links show not-found at once) | Immediate effect pass; the 24-hour removal needs the deployed project | Not verified |
| Q-33 (a) | (decision) | Not-found identical for a wrong token and an expired museum | 7.5 | `retention.spec.ts` (same `#root` HTML, text, title); `not-found.png` baseline | Pass | Verified |
| NFR-32 (a) | Must | US-69 AC-1: repo public, Supabase Free, no paid add-on | ADR 0022 | manual dashboard check | Not done; needs the user or tech lead in the dashboards | Not verified |
| NFR-32 (b) | Must | US-69 AC-2: schedule at least every 72 h | ADR 0022 section 5 | `tests/e2e/keep-alive-static.spec.ts` (skips until the file exists) | `keep-alive.yml` is phase 6 work | Not tested |
| NFR-32 (b) | Must | US-69 AC-3: at least 1 run in any 72 h | ADR 0022 | none possible before launch | Needs the Actions run history | Not verified |
| NFR-32 (b) | Must | US-69 AC-4: 0 rows, 0 objects, no purge call, no secret in the log | ADR 0022, api.md 10a | `keep-alive-static.spec.ts` (6 pass); Deno `keep_alive_test` | Function and SQL pass; the workflow log can't be checked until the workflow exists | Partly verified |
| NFR-32 (b) | Must | US-69 AC-5: a failed run shows red | ADR 0022 | needs the workflow | phase 6 | Not tested |
| NFR-32 (b) | Must | Supabase counts the keep-alive as activity | ADR 0022 | none possible here | Needs 7 or more days on a real project | Not verified |
| NFR-32 (c) to (f) | Must | US-70 AC-1 to AC-6: deployment guide free-tier section | ADR 0022 | QA reads `docs/deployment.md` after phase 6 | Section not written yet (devops-engineer, phase 6) | Not tested |
| FR-54 | Should | US-27 (rewritten): Creator-set expiry can only shorten the 7 days | none | none | Not built; Should, not in the MVP | Not tested |
| FR-104 | Could | none (deferred, backlog CR-9) | none | none | Deferred by the user's guardrail decision | Not tested |
| Test practice (no requirement ID) | n/a | No console errors on the new screens | none | `trackProblems` in every new e2e test | Pass; WebKit unused-preload notice excluded (4a3c552) | Verified |

## Regression for earlier iterations

Iterations 1 to 3 ran before this project used the ADLC, and no traceability matrix was built for them. Their criteria are covered by the existing e2e suite (`tests/e2e/`, mapped by story ID in each test title) and results are in `docs/qa-report.md` rounds 1 to 7. Round 8 re-ran the full suite: on Linux CI 349, 345 and 336 tests passed on desktop-chromium, mobile-chromium and mobile-webkit, with 0 failures and 3 flaky tests that passed on retry. Accepted known issues carried from iteration 3 are the linen-wall outline exceptions X-1 to X-5 (FR-89, requirements v0.6.3), and the open minor items BUG-15, N-11, N-12 and N-13. The backlog has a candidate to rebuild this matrix for the earlier iterations.

## Gaps on Must requirements

Every gap below is listed in `docs/lifecycle/release-readiness.md`.

| Gap | Why | What closes it |
|---|---|---|
| US-69 AC-2, AC-5; US-70 | Phase 6 artefacts (`keep-alive.yml`, deployment guide section) don't exist yet | devops-engineer in phase 6, then QA re-runs `keep-alive-static.spec.ts` and reads the guide |
| US-68 AC-5, AC-6; US-24 AC-3; NFR-16 (e) | Need the deployed Supabase project and its purge job | After an approved deploy: row count, storage listing and `cron.job_run_details` 24 h after an end |
| US-69 AC-1, AC-3; keep-alive as activity; NFR-16 (f) backups | Need the dashboards and 7 or more days of a live project | The user's manual checks (Q-34) after an approved deploy |
| US-71 AC-3, US-68 AC-3 "edit" | Editing a published museum has no UI in the MVP | product-manager confirms the wording (re-publish) in phase 7 |
| US-71 AC-4 real text-size setting, screen readers, real devices, Firefox | Not available in this environment | User's manual checks on real devices |
