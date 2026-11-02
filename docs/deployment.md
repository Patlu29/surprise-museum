# Deployment

Owner: devops-engineer. Version 1.0, 02/11/2026. Hosting decision: ADR 0002 (GitHub Pages, hash routing). Backend: ADR 0003 (Supabase Edge Functions). API mode rules: ADR 0015.

Nothing in this document has been run on GitHub yet. The workflows were written and checked locally only (YAML parse, Prettier, and the scripts and commands they call, run on a Mac). The first real run will happen after the tech lead pushes them. Nothing deploys when they are pushed.

## Summary

| Item | Value |
|---|---|
| Frontend host | GitHub Pages, project site `https://patlu29.github.io/surprise-museum/` (repo `Patlu29/surprise-museum`, public) |
| Backend | Supabase (Sydney, `ap-southeast-2`): four Edge Functions, Postgres, private Storage bucket, hourly pg_cron purge |
| Routing | Hash routes (`#/m/<token>`); the server only ever sees `/surprise-museum/` |
| Vite `base` | `/surprise-museum/` (constant `BASE_PATH` in `vite.config.ts`) |
| Deploy trigger | Manual only (`workflow_dispatch`). No automatic deploy of any kind |
| Production build | Always live (`VITE_API_MODE=live`); fails fast without the Supabase variables. No mock option on Pages |

## How the pipeline works

Four workflows in `.github/workflows/`:

| Workflow | Triggers | What it does |
|---|---|---|
| `ci.yml` (CI) | Pull request, push to `main`, and called by the deploy workflow | `checks`, `deno`, `e2e` (3 projects), `e2e-firefox` (non-blocking) |
| `deploy-pages.yml` (Deploy to GitHub Pages) | **Manual only** | Re-runs `ci.yml`, then checks the live config, builds, verifies, and publishes with the official Pages actions |
| `deploy-supabase.yml` (Deploy Supabase) | **Manual only** | Deno verify, then optionally `supabase db push`, then `supabase functions deploy` |
| `visual-baselines-linux.yml` (Record visual baselines) | **Manual only** | Records the Linux visual baselines and uploads them as an artefact |

Supporting files: `.github/scripts/check-bundle-size.mjs` (the size budget) and `.github/pages/404.html` (copied into the Pages artefact at deploy time).

### CI jobs (`ci.yml`)

| Job | Steps | Blocking |
|---|---|---|
| `checks` | `npm ci` (npm cache), `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, bundle-size check | Yes |
| `deno` | `deno check`, `deno lint`, `deno test` over `supabase/functions` | Yes. **Unverified locally** (see Known gaps). The job name says so |
| `e2e` | Matrix: `desktop-chromium`, `mobile-chromium`, `mobile-webkit`. Needs `checks` | Yes |
| `e2e-firefox` | `desktop-firefox`. Needs `checks` | **No** (`continue-on-error`, nothing depends on it) |

Details that matter:

- **Node 26** on `ubuntu-24.04`, matching development (v26.7.0). The version lives in one place, `.nvmrc` at the repo root, and every workflow that uses Node reads it through `actions/setup-node` with `node-version-file: .nvmrc`. To change the CI Node version, edit `.nvmrc`. `package.json` `engines` stays at `>=22.12.0` (the minimum the dependencies support), so it is a floor, not the CI version.
- **`npm run format:check` is not run.** On 02/11/2026 it fails on 30 files (21 in `tests/e2e`, 5 in `src/ui`, one each in `src/domain`, `src/scene`, `src/styles`, and `playwright.config.ts`). Adding it would fail every run. To enable it, run `npm run format` as its own commit, then add the step to `ci.yml` (a comment marks the place).
- **The build in `checks`** is a plain `npm run build` (live, no Supabase variables needed, because the live guard only fires when `VITE_API_MODE=live` is set). It proves the production build compiles. The Pages build is separate.
- **Bundle size.** `check-bundle-size.mjs` fails if any file in `dist/assets/*.js` is over 1000 kB (1 kB = 1000 bytes), except the lazy HEIC decoder (`heic-to-*.js`), which has its own 3500 kB ceiling. These are the same budgets as `chunkSizeBudgets()` in `vite.config.ts`, which only warns. On 02/11/2026: three.js chunk 961.8 kB of 1000 kB, HEIC decoder 3150.9 kB of 3500 kB. Vite names the three.js chunk after one of its modules (currently `NameLabel-<hash>.js`), so the script checks every chunk rather than a name. The top chunks are written to the job summary.
- **E2E setup.** `playwright.config.ts` builds with `VITE_API_MODE=mock npm run build -- --mode test` and serves it with `vite preview` on port 4173 by itself (its `webServer`), so the workflow has no separate build or preview step. With `CI=true` the config gives 2 retries and traces on the first retry. The workflow passes `--workers=2` (the suite is timing-sensitive under load; the QA handoff saw load timeouts at 3 workers on a laptop). Browsers are installed with `npx playwright install --with-deps <browser>` and cached by Playwright version.
- **Artefacts** (14 days): `playwright-report-<project>` (HTML report), `playwright-traces-<project>` (the `test-results` folder: traces from retries, failure screenshots).
- **Visual spec on Linux.** The committed baselines are for darwin only (`tests/e2e/__screenshots__/desktop-chromium-darwin`). While no `*-linux` folder exists under `tests/e2e/__screenshots__`, the `e2e` job runs every spec file except `visual.spec.ts` (14 tests on desktop-chromium; 230 run instead of 244) and prints a warning annotation. The moment a `*-linux` folder is committed, the job runs everything again with no workflow edit. The test code is not changed.

### Deploy to Pages (`deploy-pages.yml`)

1. `ci`: calls `ci.yml`. If a required job fails, nothing below runs.
2. `build` (only when the ref is `main`): `npm ci`, then `npm run check:live` (stops with a list of what is missing, never prints a key), then `npm run build` with `VITE_API_MODE=live`, the Supabase variables, the size check, and a check that `dist/index.html` has the `/surprise-museum/` base path, a Content-Security-Policy and the Supabase origin. It then adds `404.html` and uploads the artefact (`configure-pages`, `upload-pages-artifact`).
3. `deploy` (needs `build`, environment `github-pages`): `deploy-pages`, which prints the site URL.

Decision on mock versus live: the Pages build is **live only** and fails fast. A mock build on a public URL would let someone build a museum whose share link works only in their own browser (IndexedDB), which breaks the product's purpose. If you want a throw-away public demo anyway, that is a product decision, not a CI switch: say so and it can be added as a separate workflow.

### Deploy Supabase (`deploy-supabase.yml`)

Inputs: `functions` (default on), `migrations` (default off). Runs the Deno checks, then (main only, environment `supabase-production`) links the project, optionally dry-runs and applies `supabase db push`, and deploys all four functions with `--no-verify-jwt` (as in `supabase/config.toml`). The Supabase CLI is pinned to 2.122.0.

It does **not** do the one-time setup: creating the project, turning sign-ups off, the Vault secrets, or the function secrets. Those stay manual (below).

## Environment variables and secrets (names only)

Repository **variables** (Settings, Secrets and variables, Actions, Variables). Public values, compiled into the website:

| Name | Used by | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | `deploy-pages.yml` | `https://<ref>.supabase.co` (no path) |
| `VITE_SUPABASE_ANON_KEY` | `deploy-pages.yml` | The anon or publishable (`sb_publishable_...`) key. Never the service-role or `sb_secret_` key; `check:live` rejects both |
| `VITE_SUPABASE_FUNCTIONS_REGION` | `deploy-pages.yml` | Optional. Blank means `ap-southeast-2` |

Repository **secrets** (only for `deploy-supabase.yml`):

| Name | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard, Account, Access Tokens, Generate new token |
| `SUPABASE_PROJECT_REF` | The `<ref>` in `https://<ref>.supabase.co` |
| `SUPABASE_DB_PASSWORD` | The database password chosen at project creation. Needed only when `migrations` is ticked |

Not GitHub settings, set in Supabase (`supabase/README.md` steps 5 and 6): Edge Function secrets `ALLOWED_ORIGINS`, `CRON_SECRET`, `RATE_LIMIT_SALT`; Vault secrets `project_url`, `cron_secret`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase. The service-role key must not appear in GitHub at all.

The e2e jobs and the `checks` job need no variables or secrets. No workflow uses a personal access token: Pages uses the built-in `GITHUB_TOKEN` with OIDC, and each job asks for the narrowest `permissions` it needs.

## Manual steps for the user

Do these in order. Steps 1 to 3 can happen before any deploy; 4 to 7 are the go-live sequence.

1. **Push the workflows** (tech lead). The first CI run starts on push. Look at it before anything else: the `deno` job and the Linux `e2e` jobs have never run (see Known gaps). Nothing deploys.
2. **Enable Pages.** Repository Settings, Pages, **Build and deployment, Source: GitHub Actions**. (This workflow never changes repository settings itself. It is needed before `deploy-pages.yml` can publish, and the first deploy fails with a clear error if it is missing.)
3. **Linux visual baselines** (optional, but until done the visual spec does not run in CI):
   1. Actions, "Record visual baselines (Linux)", Run workflow (any branch).
   2. When it is green (it records, then re-runs to prove the images are stable), download the artefact `visual-baselines-linux` and unzip it so that the folder `desktop-chromium-linux` sits in `tests/e2e/__screenshots__/`.
   3. Open the PNGs and look at them. Do not commit images you would not accept as correct.
   4. Commit `tests/e2e/__screenshots__/desktop-chromium-linux/` (qa-engineer or tech lead). CI then runs `visual.spec.ts` on Linux automatically.
   5. If the verify step fails, the run is not stable on Linux; do not commit those images. Tell the qa-engineer.
4. **Create the Supabase project** in Sydney and do the one-time setup: `supabase/README.md` steps 1 to 6 (project, sign-ups off, link, migrations, Vault secrets, function secrets). In `ALLOWED_ORIGINS` the value must contain exactly `https://patlu29.github.io` (origin only, no path, no trailing slash), or every browser call from the live site is refused. Choosing a plan (the free tier pauses idle projects, which would stop the purge job and break old gift links) is yours; for pricing, ask Supabase sales.
5. **Add the GitHub variables and secrets** listed above (Settings, Secrets and variables, Actions).
   - **Required reviewers (recommended for `supabase-production`, optional for `github-pages`).** A required reviewer makes a deploy job pause until someone approves it. To add one: Settings, Environments, `supabase-production`, tick "Required reviewers", pick at least one person (you can be your own reviewer on a personal repo), then "Save protection rules". If the environment is not listed yet, choose "New environment" and name it exactly `supabase-production`. Recommended here because that workflow applies migrations and replaces live functions. For `github-pages` the same path applies (Settings, Environments, `github-pages`, Required reviewers), but it is optional: that deploy only replaces static files and can be rolled back by re-running an earlier deploy.
6. **Deploy the functions before the site.** Either follow `supabase/README.md` steps 6 to 7 from your machine, or run Actions, "Deploy Supabase (functions and migrations)" on `main` (tick `migrations` only if you have not pushed them yet). Then run `node supabase/scripts/smoke-test.mjs https://<ref>.supabase.co <anon key>` and the lockdown `curl` checks from `supabase/README.md` step 8. Every line must say PASS.
7. **First site deploy.** Actions, "Deploy to GitHub Pages", Run workflow, branch `main`. It re-runs all checks (about 15 to 25 minutes), then builds and publishes. Open the URL it prints, then create a throw-away museum and open its share link in a second browser.

Not approved yet in this conversation, so not done by the devops-engineer: pushing, enabling Pages, setting variables or secrets, creating the Supabase project, and any deploy.

## Hosting notes (GitHub Pages limits)

| Topic | Position |
|---|---|
| SPA fallback | Not needed. Hash routing (ADR 0002) means deep links are `/surprise-museum/#/...`; the browser never sends the fragment, so tokens never reach GitHub and every link loads `index.html` |
| `404.html` | Added at deploy time from `.github/pages/404.html` (a short page that points back to the home page). It appears only for a path that does not exist, for example a mistyped `/surprise-museum/foo`. It is not a router fallback. Pages serves it with HTTP 404, which is correct |
| `.nojekyll` | `public/.nojekyll` is in the build. The Actions-based deploy does not run Jekyll, so it is harmless |
| Response headers | Pages cannot set custom headers. The Content-Security-Policy and `referrer` and `robots` metas are in `index.html` (injected by `vite.config.ts`). `frame-ancestors` and HSTS tuning are not possible; `X-Content-Type-Options` and a real `Cache-Control` policy are not available |
| Caching | Pages sends a fixed short `Cache-Control` (about 10 minutes) with validators, and it cannot be changed. This is safe because every file under `dist/assets/` has a content hash in its name, and `index.html` is revalidated quickly. Repeat visits cost conditional requests (304) rather than full downloads. The long-lived `immutable` policy in the static-hosting guidance is not achievable here |
| Compression | Pages compresses text types (HTML, JS, CSS, JSON, SVG) in transit. The 3 MB HEIC decoder loads lazily and only for HEIC photos. Brotli was not verified |
| 3D asset MIME types | There are none to serve. `public/models`, `public/textures` and `public/env` are empty: the scene is procedural, and photos come from Supabase Storage as signed URLs. If `.glb`, `.ktx2` or `.hdr` files are added later, check the `Content-Type` that Pages returns for them on the first deploy (`curl -I`), because it cannot be overridden. `.wasm` should be served as `application/wasm`; the HEIC decoder is bundled into a JS chunk and has not shown a problem under the QA preview server, which is not Pages |
| Supabase CORS | Handled by the functions via `ALLOWED_ORIGINS`; Storage has its own CORS policy for signed URLs (`docs/api.md` section 3) |
| Custom domain | Would change `BASE_PATH` in `vite.config.ts` to `/` and the origin in `ALLOWED_ORIGINS`. Nothing else (ADR 0002) |
| Preview deployments | GitHub Pages has no per-pull-request previews. PRs get the e2e report artefacts instead. Netlify, Vercel or Cloudflare Pages would be needed for previews; not proposed, because ADR 0002 and the approved hosting choice are GitHub Pages |

## Rollback

| What | How |
|---|---|
| Frontend, quick | Actions, open the last good "Deploy to GitHub Pages" run, **Re-run all jobs**. A re-run uses the commit of that run, so it republishes the old build. (It uses the current repository variables and re-runs the checks.) |
| Frontend, normal | `git revert` the bad commit on `main` (tech lead pushes), then run "Deploy to GitHub Pages" again |
| Frontend, emergency | Settings, Pages, **Unpublish site**. The site disappears; the backend is untouched. Deploy again to restore |
| Edge Functions | Revert the commit on `main`, then run "Deploy Supabase" with `functions` ticked. The workflow only deploys `main` |
| Database migrations | There are no down migrations. Roll forward with a new idempotent migration. Take a backup first if the plan has them; the free plan does not |
| Secrets and keys | Rotate in the Supabase dashboard (anon key, access token, database password) and update the matching GitHub variable or secret. If the service-role key is ever exposed, rotate it immediately |

Order matters when a release changes the API: roll the frontend back first, then the functions, so the site never calls a function that has gone.

## Known gaps

| Gap | Detail |
|---|---|
| Deno never run | `deno check`, `lint` and `test` for `supabase/functions` are untested by the team (Deno is not installed on the development machine). The `deno` job runs them for the first time in CI, using the commands in `supabase/README.md`. A failure may be a flag or lockfile issue (`deno test` may need `--allow-*` flags, and the per-function `deno.lock` files may need refreshing) rather than a code fault. The job is blocking, so fix it or, as a last resort, remove it from the `needs` of the deploy workflow temporarily and record why |
| Linux e2e never run | The suite passed on macOS (691 passed, 0 failed, 41 skipped, QA round 5). It has not run on Ubuntu. SwiftShader WebGL timing there is unknown; expect to tune workers or retries after the first runs. The e2e jobs are blocking |
| Linux visual baselines | Missing until step 3 above is done and committed. The visual spec is skipped in CI meanwhile |
| Firefox | Never verified anywhere. `e2e-firefox` runs it as non-blocking. Treat its first results as information |
| Real devices | No real phone or tablet was tested (QA and performance reports). CI uses emulated iPhone 13 and Pixel 7 profiles, which do not measure GPU memory or frame rate |
| Screen readers | Not tested with a real screen reader (axe-core checks run in e2e, but those are not a substitute) |
| `format:check` | Not enforced; 30 files fail Prettier today |
| Action versions | Pinned by major tag (`@v7`, `@v6`, and so on, current on 02/11/2026), not by commit SHA. Pinning by SHA is the stricter choice if supply-chain risk matters |
| No PR previews | See Hosting notes |
| No scheduled checks | No Dependabot, no scheduled run. Not requested |
| Legal | Photo-consent and Privacy Act wording, and the LGPL-3.0 licence of `heic-to`, still need review before a public launch (`docs/project-status.md`). Deploying publishes the site to the world |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Deploy fails at "Check the live backend is configured" | The repository **variables** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, a placeholder, or the wrong kind of key. The log lists what to fix. Variables, not only secrets, are read |
| Deploy fails at "Verify the base path..." | `BASE_PATH` in `vite.config.ts` was changed, or the Supabase URL is not an origin (no path) |
| `deploy-pages` fails with "Pages not enabled" or a 404 from the API | Step 2 not done (Source must be GitHub Actions) |
| Site loads but says it is "not connected to its server" | The build had no Supabase variables (the guard should have stopped this), or `ALLOWED_ORIGINS` lacks `https://patlu29.github.io` (browser console shows a CORS error) |
| Deploy workflow shows "Skipped" for build | The run was started from a branch other than `main` |
| `e2e` fails only on `mobile-webkit` or under load | Timing. Check the trace artefact, then consider `--workers=1` for that project |
| Bundle-size job fails | A chunk passed 1000 kB (HEIC decoder 3500 kB). See `docs/performance.md` sections 3 and 6 and the job summary table before raising any limit; a limit change needs the architect |
