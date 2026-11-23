# Handoff: devops-engineer

Iteration: 4 (free-tier hosting, 7-day retention). Phase: 6 Release. Updated 23/11/2026.

## Summary (iteration 4, phase 6)
Prepared the release; deployed nothing. Nothing was pushed, committed, run on GitHub, enabled or created, and no secret or variable was set (user: "No deploy yet", 23/11/2026). Added the format check to CI, the daily `keep-alive.yml`, migrations-first `deploy-supabase.yml`, the Firefox job limits, the free-tier section and full manual steps in `docs/deployment.md` (US-70 AC-1 to AC-6), REV-6 and REV-11 fixes, and `CHANGELOG.md`.

## Files changed (iteration 4)
- `.prettierignore`: `src/styles/tokens.css` with a one-line reason
- `.github/workflows/ci.yml`: `Format check` step in `checks`; Deno job label and comment no longer say UNVERIFIED or "four"; Firefox job: `timeout-minutes: 30`, Playwright step limit 25, uploads `if: always()`
- `.github/workflows/keep-alive.yml`: new (daily `37 20 * * *`, `workflow_dispatch`, `permissions: {}`, no checkout, reads `vars.VITE_SUPABASE_URL` and `vars.VITE_SUPABASE_ANON_KEY`, `apikey` header only, `jq -e` body check, key masked, step summary shows `checkedAt`)
- `.github/workflows/deploy-supabase.yml`: `migrations` default on and run before functions; "five" wording; migrations input read through `env` instead of `${{ }}` in the script (matches the ADR rule; tech lead accepted); no `UNVERIFIED` label; reminder to run the keep-alive once
- `docs/deployment.md` v1.2: five functions, five workflows, format check, free-tier section, rewritten manual steps (1 to 10), known gaps, troubleshooting rows for keep-alive
- `CHANGELOG.md`: new
- `docs/handoffs/devops-engineer.md`: this note

## Verification (iteration 4)
| Check | Result | Label |
|---|---|---|
| `npm run format:check` | passed (tokens.css ignored) | Verified |
| `npm run lint`, `npm run typecheck` | passed | Verified |
| `npx vitest run` | 72 files, 1084 tests passed | Verified |
| `PW_REUSE_SERVER=1 npx playwright test keep-alive-static --project=desktop-chromium` (preview already on 4173) | 8 passed, 0 skipped | Verified |
| All 5 workflow files parse as YAML (system Ruby Psych) and pass Prettier | passed | Verified |
| keep-alive script: extracted and run with a local stand-in server | success exits 0 and writes the summary; wrong body exits 1; HTTP 500 retries 3 times then fails; unset variables and a non-https URL fail with a clear error | Verified (locally, not on GitHub) |
| `actionlint`, `deno` | not installed here, so not run | Not verified |
| Secret grep over `.github`, `docs/deployment.md`, `CHANGELOG.md`, `.prettierignore`, this note (JWT, `sb_*`, `ghp_`, `github_pat_`, `sbp_` patterns) | no hits | Verified |
| Any workflow on GitHub (keep-alive, deploy-supabase, Firefox job change, format step) | never run | **Not verified** |
| Whether the Supabase gateway needs `apikey` with `verify_jwt = false`; whether Supabase counts the call as activity; GitHub failure e-mails | needs a deployed project and 7+ days | Not verified |

First run to check after pushing: CI `checks` shows the "Format check" step green; the Firefox job ends as pass, fail or timeout (not cancelled) and its two artefacts exist; "Keep Supabase awake" is skipped (grey) until `VITE_SUPABASE_URL` is set (expected).

## QA doc fix (DOC-1, 23/11/2026)
- `docs/deployment.md`: the keep-alive section now says the workflow prints curl's HTTP error and the response body on failure (not only the status). No other place said the same.

## Decisions (iteration 4)
- keep-alive follows ADR 0022 section 5 (tech lead ruling, 23/11/2026): `if: vars.VITE_SUPABASE_URL != ''`, so it is skipped (grey) until the URL is set. After that a missing anon key, non-https URL, non-200, wrong body or timeout fails red. The first draft failed on a missing URL (task wording); changed.
- `apikey` header only, no `Authorization: Bearer`: neither ADR 0022 nor `docs/api.md` 10a asks for it, `supabase/scripts/smoke-test.mjs` sends `apikey` only, and a publishable key is not a JWT.
- No checkout in keep-alive: it uses no repository file.
- Firefox: cause of the cancellations is unknown (no log kept). Gave it limits and an always-upload; did not investigate further (as instructed). Step limit 25 minutes is under the job limit so uploads still run.

## Not done
- Deploy, push, enabling Pages, secrets and variables, creating the Supabase project, running any workflow (all the user's, by instruction).
- `actionlint` and Deno not available locally.

## Open questions
- Resolved: follows ADR 0022 (tech lead). The Sydney and limit-behaviour questions go to the user as Q-34 checks.
- Is Sydney offered on the Supabase Free plan, and what exactly happens at each free limit and how long a paused project can be restored? Third-party figures, all marked "confirm" in the guide (user, on supabase.com).

## Requests for other agents
- [done] architect ADR amendment: no longer needed, the workflow matches the ADR.
- [open] tech lead: commit these files.

## Earlier history (iterations 1 to 3, phase 7 Delivery, kept for context)

## Update 02/11/2026: Node 26 from .nvmrc
- `.nvmrc` (value `26`) added at the repo root; tech lead authorised it on the architect's behalf. ci.yml (3 jobs), deploy-pages.yml and visual-baselines-linux.yml now use `node-version-file: .nvmrc`. The `NODE_VERSION` envs are removed. deploy-supabase.yml does not use Node.
- `package.json` `engines` left at `>=22.12.0`: no concrete reason to raise it; it is the floor, CI uses Node 26.
- `docs/deployment.md`: Node mention updated; required-reviewer steps made explicit (Settings, Environments, `supabase-production`, Required reviewers: recommended; `github-pages`: optional). The two "no .nvmrc / Node 24" known gaps are removed.
- Not run: the workflows on GitHub. Node 26 availability on `actions/setup-node` v7 is unverified here (needs the first CI run).

## Update 03/11/2026: bundle guard review (three-* and scene-shared-* split)
- Reviewed the performance-optimiser's edit to `.github/scripts/check-bundle-size.mjs` (commit 1659eb8). The limits and the exit-2-if-missing rule were right. Fixed five weaknesses in my own file:
  - The combined breach exited first, so a `three-*` breach alongside it was never annotated. Every breach is now reported, then one exit 1.
  - The missing-chunk check ran before the table was printed, so a failing run showed no numbers. The table (and the job summary) is now written first; a missing chunk still exits 2.
  - Only the first `three-*` or `scene-shared-*` match was used. All matches are now summed, so an extra three-* chunk cannot slip out of the total.
  - The table showed only the top six chunks, so `scene-shared-*` could drop out of view. The 3D chunks are always listed.
  - The success line said "Largest regular chunk" and skipped `three-*` (it has the 985 limit), so it named `index-*`. It now names the largest chunk other than the HEIC decoder and prints the combined headroom.
- Linux paths and hashed names were already fine (`path.join`, prefix regexes with `.*`, no hash length assumed). File size is measured in bytes on disk; `vite.config.ts` uses `code.length` (characters). They agree for ASCII output and the script is the stricter one.
- Verified: `npm run build -- --outDir <scratch>` (not `dist/`), then the script on it: exit 0, `three` 921.4, `scene-shared` 66.2, combined 987.6 of 1000, HEIC 3150.9. Synthetic copies in the scratch folder: combined over (exit 1), three over 985 plus combined over (both annotated, exit 1), regular chunk over (exit 1), `scene-shared` missing (exit 2), no dist (exit 2), step summary file written. Prettier and ESLint pass on the script.
- `docs/deployment.md` (version 1.1): bundle-size bullet and the troubleshooting row rewritten; no chunk is named after `NameLabel` any more. `ci.yml` needs no change.
- Decision: the 985 kB `three-*` guard fails CI (as the performance-optimiser set it) although `vite.config.ts` only warns for it.
- Not run: the script on GitHub (Linux). Nothing committed, pushed or deployed.

## Files changed
- `.github/workflows/ci.yml`: PR and push-to-main CI (also `workflow_call`). Jobs `checks` (typecheck, lint, unit tests, build, bundle size), `deno` (check, lint, test; unverified), `e2e` (desktop-chromium, mobile-chromium, mobile-webkit; 2 workers; report and traces uploaded), `e2e-firefox` (non-blocking)
- `.github/workflows/deploy-pages.yml`: `workflow_dispatch` only. Calls ci.yml, then check:live, live build, base-path and CSP verification, 404.html, configure-pages, upload-pages-artifact, deploy-pages. main only
- `.github/workflows/deploy-supabase.yml`: `workflow_dispatch` only. Deno verify, optional `db push`, `functions deploy --no-verify-jwt`. Needs three secrets
- `.github/workflows/visual-baselines-linux.yml`: `workflow_dispatch` only. Records and re-verifies Linux baselines, uploads `visual-baselines-linux`
- `.github/scripts/check-bundle-size.mjs`: fails if any chunk is over 1000 kB (HEIC decoder 3500 kB), `three-*` over 985 kB, or `three-*` plus `scene-shared-*` over 1000 kB (see the 03/11/2026 update)
- `.github/pages/404.html`: copied into the Pages artefact at deploy time
- `docs/deployment.md`: pipeline, variables and secrets (names only), manual steps, hosting limits, rollback, known gaps
- `docs/handoffs/devops-engineer.md`: this note

## Decisions
- Deploy is `workflow_dispatch` only, in a separate workflow that calls `ci.yml`, so every check re-runs first. No repo-variable gate was added: the manual trigger plus the main-only guard is enough, and a variable would be one more step for the user.
- Pages build is live only and fails fast through `npm run check:live` (ADR 0015, supabase/README.md step 9). No mock option, because a public mock site would produce share links that work only in the creator's browser.
- `format:check` left out: it fails on 30 files today (21 in tests/e2e, 5 in src/ui, 1 each in src/domain, src/scene, src/styles, plus playwright.config.ts). A comment in ci.yml marks where to add it.
- Visual spec on Linux: `ci.yml` runs every spec file except `visual.spec.ts` while no `tests/e2e/__screenshots__/*-linux` folder exists, with a warning annotation, and runs everything again automatically once the folder is committed. This needs no change to tests or the Playwright config (230 of 244 desktop-chromium tests run in the meantime, checked with `--list`).
- Playwright browsers are installed with `npx playwright install --with-deps` and cached by version, not a Docker image, because the image tag could not be verified offline. Both CI and the baseline recorder use `ubuntu-24.04`, so baselines and runs share one environment.
- Bundle check inspects every chunk by prefix. Originally Vite named the three.js chunk after a module (`NameLabel-<hash>.js`); since commit 1659eb8 the chunks are named `three-*` and `scene-shared-*` by `vite.config.ts`, and the script checks them by those names (03/11/2026 update).
- The Deno job is blocking (the unverified status is in its name and in comments). If its first run fails on flags or lockfiles, fix it rather than ignore it.
- Action majors checked against the GitHub releases API on 02/11/2026 (read only): checkout v7, setup-node v7, upload-artifact v7, cache v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5, setup-deno v2, supabase/setup-cli v3 with CLI 2.122.0. Pinned by major tag, not SHA.
- 404.html is generated into the artefact at deploy time from `.github/pages/404.html`, so no file outside my folders was touched. Hash routing means it only appears for mistyped paths.

## Assumptions
- Node 26 in CI (from `.nvmrc`) matches development.
- `deno test` works without `--allow-*` flags, as the backend developer's README documents. Unverified.
- Playwright `--workers=2` on a standard 2-vCPU GitHub runner is slow but stable enough. Unverified on Linux.
- GitHub environments `github-pages` and `supabase-production` are created on first use; required reviewers are optional and the user's choice.
- Frontend variables are read from repository Variables (not Secrets), as `.env.example` and supabase/README.md step 9 say.

## Validation done locally
- All four workflow files parse as YAML (system Ruby Psych). The parse caught one real error (a colon in a step name), now fixed. `actionlint` was not available: the download was blocked by the permission system, so the workflows have not been linted beyond YAML syntax and Prettier.
- Prettier passes on `.github`; ESLint on `.github` is clean.
- `npm run typecheck`, `npm run lint`, `npm test` (870 tests) pass. `npm run build` passes (built to a scratch folder so the running preview on port 4173 and `dist/` were not touched).
- `check-bundle-size.mjs` passes on the real build, fails (exit 1) on a synthetic 1001 kB chunk, and exits 2 on a missing directory.
- `npm run check:live` fails with a clear list when the variables are missing and passes with fake well-formed values. A live build with fake values produced `index.html` with the `/surprise-museum/` base, the CSP and the Supabase origin (the three things the deploy workflow verifies).
- The spec selection used by CI was checked with `playwright test --list` (244 tests, 230 without the visual spec).
- Not run: any workflow on GitHub, Deno, Playwright on Linux, the Pages and Supabase actions.

## Open questions
- Should the Pages site ever be allowed to run in mock (demo) mode for a first, public smoke test? Default: no. (user)
- Do you want required reviewers on the `github-pages` and `supabase-production` environments? (user)

## Requests for other agents
- User (manual steps, details in `docs/deployment.md`): enable Pages with Source "GitHub Actions"; create the Supabase project and finish supabase/README.md steps 1 to 6; add variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (optional `VITE_SUPABASE_FUNCTIONS_REGION`) and secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`; make sure `ALLOWED_ORIGINS` includes `https://patlu29.github.io`; deploy functions before the site; run the Linux baseline workflow and commit the result; trigger the first deploy by hand.
- Tech lead: commit and push `.github/` and the docs. After the push, watch the first CI run (Deno and Linux e2e have never run). Do not run the deploy workflows without the user's approval.
- qa-engineer: after the Linux baselines are downloaded, review the images and commit `tests/e2e/__screenshots__/desktop-chromium-linux/`. Review the first Linux e2e run for timing flakes. Run `npm run format` on `tests/e2e` and `playwright.config.ts` if `format:check` is to be enforced.
- architect: decide on `format:check` enforcement (`.nvmrc` now exists).
- frontend-developer, scene-developer: the remaining Prettier failures in `src/ui` (5 files), `src/domain`, `src/scene`, `src/styles` need `npm run format` if `format:check` is to be enforced.
- backend-developer: look at the first `deno` job log; fix any flag or lockfile problems (`supabase/functions/deno.lock` and per-function lock files).
