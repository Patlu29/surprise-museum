# Retrospective

One section per iteration, written by the tech lead from the handoff notes, the QA report and the phase log. Iterations 1 to 3 ran before this project used the ADLC and have no retrospective.

## Iteration 4: Feature and hosting (18/11/2026 to 23/11/2026)

### Delivered against plan

Planned (A1, 18/11/2026): prepare the app for free-tier hosting on GitHub Pages and Supabase Free, with a keep-alive; change retention from 90 to 7 days; state the 7 days on the publish screen; document the free limits and a usage check.

| Planned | Delivered | Status |
|---|---|---|
| NFR-16: 7 days from first publish, purge within 24 h, no backups | Contract `retentionDays: 7`, purge logic and tests, not-found and privacy wording (eb57dff) | Built and tested against the mock; live purge Not verified (V-6) |
| FR-105: publish screen and edit page state the 7 days and the end date | `AvailabilityNotice`, `formatEndDateTime` (eb57dff) | Verified |
| NFR-32 (a), (b): free tiers, keep-alive | Keep-alive Edge Function and migration (eb57dff); `keep-alive.yml` daily, skipped until configured (cbbd7e4) | Built; static checks pass (13); live effect Not verified (V-6) |
| NFR-32 (c) to (f): deployment guide free-tier section | `docs/deployment.md` v1.2 (cbbd7e4, 834cf50) | Verified by a document read (US-70 AC-1 to AC-6) |
| Project `.npmrc` (user request 18/11/2026) | Root and per-function `.npmrc` files pin the public registry; lockfile mirror URLs removed (4918550, 5220a8f) | Done |
| Not planned, done | Linux CI made green for the first time (run 45156570793 concluded success overall, 0 e2e failures); Firefox CI job now ends with a result (4 accessibility timeouts, V-8); `format:check` enforced in CI after a repo-wide format (a26a8b8); CHANGELOG.md | Done |
| Not done (by decision) | No deploy (user, 23/11/2026); FR-54 Creator-set expiry (Should) and FR-104 in-app space full (Could, CR-9) not built | Backlog |

Outcome: released (prepared) with known issues; nothing deployed.

### What went wrong, cause and phase

| Problem | Cause | Phase that caused it |
|---|---|---|
| Deno CI job failed on its first run: lockfiles held private-mirror tarball URLs | The machine-wide npm config points at a corporate mirror and Deno reads `~/.npmrc` unless an `.npmrc` sits beside the `deno.json` | Build (iterations 1 to 3, surfaced in 4) |
| 49 Linux e2e failures on the first real CI run, then 4, then 1 | Tests had only ever run on macOS: WebKit-only console messages, font-dependent heights, software-GL timing, fractional element clips, an over-broad warning filter | Verify (test design in earlier iterations) |
| The tech lead's pushes cancelled CI runs that were needed | CI uses `cancel-in-progress`; commits were pushed while a run was in progress | Tech lead process |
| `dist/` overwritten by plain builds while QA needed the test-mode build | Several agents ran `npm run build` into the shared `dist/` | Tech lead delegation prompts (fixed by adding the constraint) |
| Format debt (39 files) blocked enabling `format:check`; the first full format broke 2 unit tests via `tokens.css` | Format check was never enforced; two tests read `tokens.css` one token per line | Design (iteration 1 scaffold) |
| Devops built the keep-alive to fail when unconfigured, against ADR 0022's "skip" | The tech lead's delegation prompt contradicted the approved ADR | Tech lead delegation (caught at the check after delegation) |
| Stale "90" comment in `mockClient.ts` and stale "Proposed/provisional" wording | The search patterns for 90-day text missed "after 90"; docs not synced after A2 | Build and Design (caught in Review) |

### Gates that caught problems

- **Check after delegation:** the Deno lockfile report was checked by diff rather than trusted; the keep-alive skip-vs-fail contradiction was caught against ADR 0022; the backlog's stale V-5 was caught before close.
- **Verify, Linux CI:** caught every Linux-only test defect before Review.
- **Review:** 5 Minor and 9 Note findings, including the stale 90 comment (REV-1), the over-broad WebKit filter (REV-9) and the missing invocations quota in the usage check (REV-11).
- **QA round 8b:** caught DOC-1 (the guide misdescribed what the workflow prints on failure).

Escaped a gate: none known in shipped behaviour. The format debt and Linux-only test defects escaped earlier iterations' gates because CI had never run (billing lock 02/11 to 18/11/2026).

### Changes for the next iteration

- Hold pushes while a CI run that a gate depends on is in progress; batch commits locally instead.
- Every delegation prompt that may build says: never run `npm run build` into `dist/`; use a scratch `--outDir`.
- Check delegation prompts against the accepted ADRs before sending them.
- With `format:check` and Linux e2e now in CI, treat a red CI run as a failed gate; no more macOS-only sign-off.
- Before launch: run the post-deploy checks (V-6) and the user's Supabase checks (V-7).

### Items moved to the backlog

V-6 (post-deploy verification), V-7 (Q-34 checks on supabase.com), V-8 (browsers and devices, Firefox job, Linux baselines), DEBT-2 (test stability and CI-only timing allowances), OPS-1 (no alert on purge failures), CR-12 (cap signed URLs at expires_at), CR-13 (purgeHealthy flag), CR-14 (draft end date on the edit page), DEBT-3 (per-function deno.lock), DEBT-4 (traceability for iterations 1 to 3). Still open from before: CR-9, CR-11, BUG-15, N-11 to N-13, V-1 to V-4, LEG-1, DEBT-1, PERF-1. Done this iteration: CR-5, CR-6, CR-7, CR-8, CR-10, V-5.

### Phase log

| Phase | Status | Evidence | Date |
|---|---|---|---|
| 1 Plan | Done | Requirements v0.7 (d8be836): NFR-16 7 days, NFR-32 free-tier hosting (Must), FR-105 publish notice (Must), FR-104 space-full (Could); US-68 to US-71; backlog.md created (CR-5 to CR-11, BUG-15, N-11 to N-13, V-1 to V-5, LEG-1, DEBT-1, PERF-1). Must count 90 (hand-counted). No 90-day figure left except superseded notes. Publish screen shows no end date today (checked src/ui), so FR-105 is new work | 18/11/2026 |
| 2 Design | Done | Architect (4918550): ADR 0010 amended (7 days, purge within 24 h, no backups), ADR 0022 Proposed (read-only keep-alive Edge Function, daily workflow, usage in dashboard), architecture v1.6, contracts unchanged (expiresAt already in store; CONTRACT_VERSION 1), project and Deno .npmrc files. Designer: design spec v2.1 (5.18 availability notice on published screen and edit page, not-found body, privacy sentence). Build passes | 19/11/2026 |
| 3 Build | Done | eb57dff: retention 7 days, keep-alive function and migration, api.md v1.2 (backend); AvailabilityNotice, formatEndDateTime, not-found and privacy copy (frontend). Tech lead isolated check: format, typecheck, lint, vitest 1084/1084, build, bundle 988.0/1000 kB all pass. Deno 35 tests pass (backend, Deno 2.9.6 via npx). QA Linux CI test fixes fc8b034 (tech lead accepted the CI-only FR-15 allowance of 4000 ms and the soft filechooser event). Smoke: home-and-demo and journey specs 14/14 pass on desktop-chromium and mobile-webkit, fresh test-mode build, run by the tech lead. Format check: the changed test files were already unformatted at HEAD (pre-existing debt, 25+ files); routed to phase 6 as one formatting commit plus enabling format:check in CI | 19/11/2026 |
| 4 Verify | Done | Performance Skipped: no 3D, render-loop or asset change; bundle 988.0 of 1000 kB. QA round 8 (docs/qa-report.md): Go, no application bug; 24 retention e2e and 8 keep-alive static checks pass on 3 macOS projects; full macOS regression: desktop-chromium 375 passed, mobile-chromium 343, mobile-webkit 337, every failure passed on re-run alone (load flakes, none in iteration 4 code); 4 Linux failures from run 44457523893 fixed as test defects with no limit loosened; 4 new darwin baselines checked by the tech lead. Tech lead: format, tsc, e2e tsc, eslint, 1084 unit tests, build and bundle check pass. Linux CI run 44686612364 (commit 4a3c552): typecheck/lint/unit/build/bundle and Deno pass; e2e desktop-chromium 349 passed 0 failed, mobile-chromium 345 passed 2 flaky, mobile-webkit 336 passed 1 flaky (flaky = passed on retry: gender US-46 AC-2, presentation-camera CR-2 veil, ceiling FR-95 AC-1; none in iteration 4 code); Firefox non-blocking, cancelled. Two follow-up test fixes in Verify: caption-card U1 CI bound (d00f4d5), WebKit unused-preload notice filter (4a3c552). No critical or major bug open | 20/11/2026 |
| 5 Review | Done | docs/review.md: 0 Critical, 0 Major, 5 Minor, 9 Note; REV-1, 5, 7, 8 (a), 9 fixed (1d74fae), the rest routed to phases 6 and 7. ADR 0022 Accepted. docs/lifecycle/traceability.md and release-readiness.md written (recommendation: release with known issues). CI run 44696065214 on 1d74fae, after the last code change: all required jobs pass (e2e 349, 347, 336 passed, 0 failed, 1 flaky). Exit checks met; A3 approved 23/11/2026 | 23/11/2026 |
| 6 Release | Done | a26a8b8 repo-wide format (tokens.css ignored). devops-engineer: format:check in CI; keep-alive.yml (daily 20:37 UTC + manual, skipped until VITE_SUPABASE_URL is set per ADR 0022, red on any failure after that); deploy-supabase runs migrations first (on by default) then all five functions; REV-6, REV-11 fixed; Firefox job 30-min limit and report always uploaded; docs/deployment.md v1.2 free-tier section (US-70 AC-1 to AC-6) and 10 manual steps; CHANGELOG.md. Local: format, tsc, eslint, 1084 unit, build, bundle, keep-alive-static 8 passed 0 skipped. No deploy (user, 23/11/2026). CI run 45156570793 on cbbd7e4: run concluded success for the first time; format check, typecheck, lint, unit, build, bundle and Deno pass; e2e desktop-chromium 351 passed, mobile-chromium 346 passed 1 flaky, mobile-webkit 336 passed 1 flaky, 0 failed; desktop-firefox (non-blocking) now ends with a result: 4 accessibility tests time out at Start/focus, then the 25-minute step limit (traces uploaded; V-8). QA round 8b: keep-alive static 13 pass (REV-8 b), US-70 AC-1 to AC-6 Verified by document read, DOC-1 fixed (834cf50). | 23/11/2026 |
| 7 Operate and learn | Done | Not deployed, so post-release checks are Not verified (backlog V-6). product-manager: backlog v0.7.1 (CR-5 to CR-8, CR-10, V-5 Done; new V-6, V-7, V-8, DEBT-2, OPS-1, CR-12 to CR-14, DEBT-3, DEBT-4), REV-2 and the "re-publish" wording; architect REV-3 (architecture v1.6.1); designer REV-4 (spec v2.1.1) (1a2f993). docs/lifecycle/retrospective.md written | 23/11/2026 |
