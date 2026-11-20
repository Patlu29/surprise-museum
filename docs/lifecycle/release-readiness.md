# Release readiness: iteration 4 (Feature and hosting)

Written by the tech lead for approval A3, 20/11/2026. Sources: `docs/qa-report.md` round 8, `docs/review.md` (iteration 4), `docs/lifecycle/traceability.md`, `docs/project-status.md`.

## Scope and what changed

Nothing has been deployed yet: iterations 1 to 3 are closed but not deployed. Iteration 4 prepares the app for free-tier hosting (GitHub Pages and Supabase Free), on the user's decisions of 18/11/2026.

- **Retention:** a museum and its photos now last 7 days from first publish (NFR-16, was 90). Drafts still last 7 days from creation, and the hourly purge removes them within 24 hours.
- **Availability notice:** the publish screen and the edit page show "Available for 7 days, until DD/MM/YYYY HH:mm" and how to end it sooner (FR-105).
- **Not-found and privacy wording:** the not-found screen covers an ended museum, and the privacy page states there are no backups.
- **Keep-alive:** a keep-alive Edge Function and database function stop the Free project from pausing (NFR-32). The scheduled workflow that calls it is phase 6 work.
- **Registry pinning:** project `.npmrc` files pin the public npm registry for npm and Deno, and the private-mirror URLs were removed from the lockfiles.
- **Tests:** 24 retention e2e tests, 8 keep-alive static checks, 4 new screenshot baselines, and test fixes that made Linux CI green.

## Results

- **Iteration 4 criteria (traceability, 25 rows):**
  - 9 Verified (3 of them against the mock backend or with emulated text size).
  - 5 Partly verified.
  - 6 Not verified (they need the deployed project or the dashboards).
  - 5 Not tested: US-69 AC-2 and AC-5 (the keep-alive workflow) and US-70 (the deployment guide section) are phase 6 work, FR-54 is a Should and not built, and FR-104 is deferred.
  - 0 failed.
- **Full regression:**
  - Linux CI on the final code: run 44696065214 (commit 1d74fae, after the last code change): typecheck, lint, unit, build, bundle and Deno pass; e2e desktop-chromium 349 passed, mobile-chromium 347 passed, mobile-webkit 336 passed with 1 flaky (ceiling FR-95 AC-1, passed on retry, not touched by iteration 4); 0 failed. Firefox is non-blocking and was cancelled.
  - Earlier run 44686612364: 349, 345 and 336 tests passed on desktop-chromium, mobile-chromium and mobile-webkit, with 0 failures and 3 flaky tests that passed on retry.
  - macOS round 8: every failure passed on a solo re-run. All were load flakes in code that iteration 4 didn't touch.
  - Unit tests: 1,084 pass. Deno: 35 pass.
- **Bugs open:**
  - 0 critical, 0 major.
  - Carried minor items: BUG-15, N-11, N-12 and N-13, all from earlier iterations and none touched here.
- **Accepted known issues:** the linen-wall outline exceptions X-1 to X-5 (FR-89, accepted by the user, requirements v0.6.3).

## Performance

The performance phase was Skipped because no 3D, render-loop or asset change was made. Bundle check by `check-bundle-size.mjs` on a production build: 3D total 988.0 of 1,000 kB (unchanged), and every chunk is within budget.

## Review findings still open

The review found 0 Critical and 0 Major.

- **Fixed in Review:** REV-1, REV-5, REV-7, REV-8 (a) and REV-9 (1d74fae).
- **Phase 6 (devops-engineer):** REV-6 (wording says "four" Edge Functions, there are five) and REV-11 (add Edge Function invocations to the usage check).
- **Phase 7 documentation sync:** REV-2, REV-3 and REV-4 (stale "Open", "Proposed" and "provisional" wording).
- **No action:** REV-10, REV-12 and REV-14 (resolved). REV-13 goes to the backlog.

## Traceability gaps on Must requirements

| Gap | What closes it |
|---|---|
| US-69 AC-2 and AC-5, and US-70: the keep-alive workflow and the deployment guide's free-tier section | devops-engineer in phase 6, then QA re-runs the static spec and reads the guide |
| US-68 AC-5 and AC-6, US-24 AC-3, NFR-16 (e): purge and removal within 24 hours | An approved deploy, then a row count, a storage listing and the cron run record |
| US-69 AC-1 and AC-3, the keep-alive counting as activity, NFR-16 (f) no backups | Your checks in the GitHub and Supabase dashboards after an approved deploy (Q-34) |
| US-71 AC-3 and US-68 AC-3 say "edit", but only re-publish exists | product-manager confirms the wording in phase 7 |

## Not verified, and what you would need to do

- **Free-plan figures (Q-34):** confirm 1 GB storage, 500 MB database, about 5 GB egress and the Edge Function invocation quota on supabase.com/pricing.
- **Live behaviour after a deploy:**
  - the hourly purge
  - removal within 24 hours
  - whether Supabase counts the keep-alive as activity, which needs 7 or more days of a live project
  - the real `rpc('keep_alive')` reply
  - the database tests (pgTAP) against real Postgres
- **Browsers and devices:**
  - Firefox (it cannot launch here, and its CI job has never finished)
  - real phones, screen readers, and the browser's own 200% text-size setting
  - Linux screenshot baselines, recorded with the existing manual workflow
- **Legal review of the privacy and terms wording (LEG-1):** the privacy page is marked "Draft for review".

## Recommendation

**Release with known issues.** Releasing here means phase 6 prepares the release: the keep-alive workflow, the format check in CI, the deployment guide's free-tier section and the changelog. It is not a deploy.

- **Why:**
  - Every check passes.
  - No critical or major bug or review finding is open.
  - Every criterion that can be tested before a deploy passes.
- **The known issues are:**
  - the accepted linen-wall exceptions X-1 to X-5
  - the minor items BUG-15 and N-11 to N-13
  - the Not verified items above, which need a deploy or your manual checks
- **Two requirements stay incomplete until phase 6 lands:** US-69 (keep-alive) and US-70 (deployment guide).
- **Deploying needs your separate approval:** enabling GitHub Pages, creating the Supabase project, setting secrets, and running the deploy workflows.
