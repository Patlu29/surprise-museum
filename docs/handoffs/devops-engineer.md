# Handoff: devops-engineer

## Summary
Phase 7 (Delivery): wrote the CI workflow, a manual-only GitHub Pages deploy, a manual-only Supabase deploy, and a manual Linux visual-baseline recorder, plus `docs/deployment.md`. Nothing was pushed, deployed, enabled or created, and no secret or variable was set. Pushing these files triggers CI only; no workflow deploys automatically.

## Files changed
- `.github/workflows/ci.yml`: PR and push-to-main CI (also `workflow_call`). Jobs `checks` (typecheck, lint, unit tests, build, bundle size), `deno` (check, lint, test; unverified), `e2e` (desktop-chromium, mobile-chromium, mobile-webkit; 2 workers; report and traces uploaded), `e2e-firefox` (non-blocking)
- `.github/workflows/deploy-pages.yml`: `workflow_dispatch` only. Calls ci.yml, then check:live, live build, base-path and CSP verification, 404.html, configure-pages, upload-pages-artifact, deploy-pages. main only
- `.github/workflows/deploy-supabase.yml`: `workflow_dispatch` only. Deno verify, optional `db push`, `functions deploy --no-verify-jwt`. Needs three secrets
- `.github/workflows/visual-baselines-linux.yml`: `workflow_dispatch` only. Records and re-verifies Linux baselines, uploads `visual-baselines-linux`
- `.github/scripts/check-bundle-size.mjs`: fails if any chunk is over 1000 kB (HEIC decoder 3500 kB)
- `.github/pages/404.html`: copied into the Pages artefact at deploy time
- `docs/deployment.md`: pipeline, variables and secrets (names only), manual steps, hosting limits, rollback, known gaps
- `docs/handoffs/devops-engineer.md`: this note

## Decisions
- Deploy is `workflow_dispatch` only, in a separate workflow that calls `ci.yml`, so every check re-runs first. No repo-variable gate was added: the manual trigger plus the main-only guard is enough, and a variable would be one more step for the user.
- Pages build is live only and fails fast through `npm run check:live` (ADR 0015, supabase/README.md step 9). No mock option, because a public mock site would produce share links that work only in the creator's browser.
- `format:check` left out: it fails on 30 files today (21 in tests/e2e, 5 in src/ui, 1 each in src/domain, src/scene, src/styles, plus playwright.config.ts). A comment in ci.yml marks where to add it.
- Visual spec on Linux: `ci.yml` runs every spec file except `visual.spec.ts` while no `tests/e2e/__screenshots__/*-linux` folder exists, with a warning annotation, and runs everything again automatically once the folder is committed. This needs no change to tests or the Playwright config (230 of 244 desktop-chromium tests run in the meantime, checked with `--list`).
- Playwright browsers are installed with `npx playwright install --with-deps` and cached by version, not a Docker image, because the image tag could not be verified offline. Both CI and the baseline recorder use `ubuntu-24.04`, so baselines and runs share one environment.
- Bundle check inspects every chunk, not a named one, because Vite names the three.js chunk after a module (`NameLabel-<hash>.js` today). Measured 961.8 kB of 1000 kB, HEIC decoder 3150.9 kB of 3500 kB.
- The Deno job is blocking (the unverified status is in its name and in comments). If its first run fails on flags or lockfiles, fix it rather than ignore it.
- Action majors checked against the GitHub releases API on 02/11/2026 (read only): checkout v7, setup-node v7, upload-artifact v7, cache v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5, setup-deno v2, supabase/setup-cli v3 with CLI 2.122.0. Pinned by major tag, not SHA.
- 404.html is generated into the artefact at deploy time from `.github/pages/404.html`, so no file outside my folders was touched. Hash routing means it only appears for mistyped paths.

## Assumptions
- Node 24 is acceptable in CI (package.json says >=22.12.0; local development used Node 26 and all tests ran there).
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
- Is Node 24 the right CI version, or should CI follow the Node 26 used in development? (architect)

## Requests for other agents
- User (manual steps, details in `docs/deployment.md`): enable Pages with Source "GitHub Actions"; create the Supabase project and finish supabase/README.md steps 1 to 6; add variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (optional `VITE_SUPABASE_FUNCTIONS_REGION`) and secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`; make sure `ALLOWED_ORIGINS` includes `https://patlu29.github.io`; deploy functions before the site; run the Linux baseline workflow and commit the result; trigger the first deploy by hand.
- Tech lead: commit and push `.github/` and the docs. After the push, watch the first CI run (Deno and Linux e2e have never run). Do not run the deploy workflows without the user's approval.
- qa-engineer: after the Linux baselines are downloaded, review the images and commit `tests/e2e/__screenshots__/desktop-chromium-linux/`. Review the first Linux e2e run for timing flakes. Run `npm run format` on `tests/e2e` and `playwright.config.ts` if `format:check` is to be enforced.
- architect: add `.nvmrc` so the workflows can use `node-version-file`; decide on `format:check` enforcement.
- frontend-developer, scene-developer: the remaining Prettier failures in `src/ui` (5 files), `src/domain`, `src/scene`, `src/styles` need `npm run format` if `format:check` is to be enforced.
- backend-developer: look at the first `deno` job log; fix any flag or lockfile problems (`supabase/functions/deno.lock` and per-function lock files).
