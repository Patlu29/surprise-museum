# Deployment

Owner: devops-engineer. Version 1.2, 23/11/2026 (iteration 4: free-tier hosting, keep-alive workflow, format check in CI, five Edge Functions). Earlier: 1.1, 03/11/2026 (bundle guards for the `three-*` and `scene-shared-*` split). Hosting decision: ADR 0002 (GitHub Pages, hash routing). Backend: ADR 0003 (Supabase Edge Functions). API mode rules: ADR 0015.

`ci.yml` has run on GitHub many times (Linux CI run 44696065214 on commit 1d74fae passed every required job; see `docs/project-status.md`). **Nothing else has run on GitHub**: `keep-alive.yml`, `deploy-supabase.yml`, `deploy-pages.yml` and `visual-baselines-linux.yml` were written and checked locally only (YAML parse, Prettier, and the commands they call; the keep-alive script was also run against a local stand-in server). **Nothing is deployed**: the user chose "No deploy yet" on 23/11/2026, so no Pages site, no Supabase project and no repository variable or secret exists yet. Pushing these files starts CI only (and, on the schedule, the keep-alive; see the warning under "Free tier").

## Summary

| Item | Value |
|---|---|
| Frontend host | GitHub Pages, project site `https://patlu29.github.io/surprise-museum/` (repo `Patlu29/surprise-museum`, public) |
| Backend | Supabase Free plan (Sydney, `ap-southeast-2`, where practicable): five Edge Functions (`create-museum`, `get-museum`, `manage-museum`, `purge-expired`, `keep-alive`), Postgres, private Storage bucket, hourly pg_cron purge, daily keep-alive from GitHub Actions |
| Routing | Hash routes (`#/m/<token>`); the server only ever sees `/surprise-museum/` |
| Vite `base` | `/surprise-museum/` (constant `BASE_PATH` in `vite.config.ts`) |
| Deploy trigger | Manual only (`workflow_dispatch`). No automatic deploy of any kind |
| Production build | Always live (`VITE_API_MODE=live`); fails fast without the Supabase variables. No mock option on Pages |

## How the pipeline works

Five workflows in `.github/workflows/`:

| Workflow | Triggers | What it does |
|---|---|---|
| `ci.yml` (CI) | Pull request, push to `main`, and called by the deploy workflow | `checks`, `deno`, `e2e` (3 projects), `e2e-firefox` (non-blocking) |
| `deploy-pages.yml` (Deploy to GitHub Pages) | **Manual only** | Re-runs `ci.yml`, then checks the live config, builds, verifies, and publishes with the official Pages actions |
| `deploy-supabase.yml` (Deploy Supabase) | **Manual only** | Deno verify, then `supabase db push` (on by default), then `supabase functions deploy` (all five functions) |
| `keep-alive.yml` (Keep Supabase awake) | Daily at 20:37 UTC, and manual | Calls the `keep-alive` Edge Function so the Free project is never idle for 7 days. See "Free tier" |
| `visual-baselines-linux.yml` (Record visual baselines) | **Manual only** | Records the Linux visual baselines and uploads them as an artefact |

Supporting files: `.github/scripts/check-bundle-size.mjs` (the size budget) and `.github/pages/404.html` (copied into the Pages artefact at deploy time).

### CI jobs (`ci.yml`)

| Job | Steps | Blocking |
|---|---|---|
| `checks` | `npm ci` (npm cache), `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, bundle-size check | Yes |
| `deno` | `deno check`, `deno lint`, `deno test` over `supabase/functions` | Yes. Passes locally (Deno 2.9.6) and on CI |
| `e2e` | Matrix: `desktop-chromium`, `mobile-chromium`, `mobile-webkit`. Needs `checks` | Yes |
| `e2e-firefox` | `desktop-firefox`. Needs `checks` | **No** (`continue-on-error`, nothing depends on it). 30-minute job limit, 25-minute step limit, report uploaded with `if: always()` (see Known gaps) |

Details that matter:

- **Node 26** on `ubuntu-24.04`, matching development (v26.7.0). The version lives in one place, `.nvmrc` at the repo root, and every workflow that uses Node reads it through `actions/setup-node` with `node-version-file: .nvmrc`. To change the CI Node version, edit `.nvmrc`. `package.json` `engines` stays at `>=22.12.0` (the minimum the dependencies support), so it is a floor, not the CI version.
- **`npm run format:check` runs in `checks`** (after lint). The whole repository was formatted in commit a26a8b8. One file is deliberately left alone: `src/styles/tokens.css` is in `.prettierignore`, because Prettier splits its token values over several lines and two unit tests (`src/scene/materials/look.test.ts`, `src/scene/characters/kit/palette.test.ts`) read them one per line. Markdown (`*.md`) is also ignored. To format a file locally, run `npm run format`.
- **The build in `checks`** is a plain `npm run build` (live, no Supabase variables needed, because the live guard only fires when `VITE_API_MODE=live` is set). It proves the production build compiles. The Pages build is separate.
- **Bundle size.** `check-bundle-size.mjs` reads `dist/assets/*.js` (1 kB = 1000 bytes, file size on disk) and fails the job (exit 1) on any of these: a chunk over 1000 kB, except the lazy HEIC decoder (`heic-to-*.js`) at 3500 kB; `three-*.js` (three.js, react-three-fiber and drei) over 985 kB, the team's guard; or `three-*.js` plus `scene-shared-*.js` (our shared avatar kit, look materials and shaders) over 1000 kB combined, which is NFR-27's limit for the three.js code as it was before the split and stops the split hiding growth. It reports every breach in one run as an error annotation. It exits 2 if no `three-*.js` or no `scene-shared-*.js` chunk exists (a configuration fault: the names come from `THREE_CHUNK_GROUPS` in `vite.config.ts`, so change both together). Chunk names are matched by prefix, so the content hashes do not matter. `chunkSizeBudgets()` in `vite.config.ts` applies the same budgets but only warns. On 03/11/2026: `three-*` 921.4 kB of 985, `scene-shared-*` 66.2 kB, combined 987.6 kB of 1000 (12.4 kB headroom), HEIC decoder 3150.9 kB of 3500. The largest chunks and the combined row are written to the job summary, also when the check fails.
- **E2E setup.** `playwright.config.ts` builds with `VITE_API_MODE=mock npm run build -- --mode test` and serves it with `vite preview` on port 4173 by itself (its `webServer`), so the workflow has no separate build or preview step. With `CI=true` the config gives 2 retries and traces on the first retry. The workflow passes `--workers=2` (the suite is timing-sensitive under load; the QA handoff saw load timeouts at 3 workers on a laptop). Browsers are installed with `npx playwright install --with-deps <browser>` and cached by Playwright version.
- **Artefacts** (14 days): `playwright-report-<project>` (HTML report), `playwright-traces-<project>` (the `test-results` folder: traces from retries, failure screenshots).
- **Visual spec on Linux.** The committed baselines are for darwin only (`tests/e2e/__screenshots__/desktop-chromium-darwin`). While no `*-linux` folder exists under `tests/e2e/__screenshots__`, the `e2e` job runs every spec file except `visual.spec.ts` (14 tests on desktop-chromium; 230 run instead of 244) and prints a warning annotation. The moment a `*-linux` folder is committed, the job runs everything again with no workflow edit. The test code is not changed.

### Deploy to Pages (`deploy-pages.yml`)

1. `ci`: calls `ci.yml`. If a required job fails, nothing below runs.
2. `build` (only when the ref is `main`): `npm ci`, then `npm run check:live` (stops with a list of what is missing, never prints a key), then `npm run build` with `VITE_API_MODE=live`, the Supabase variables, the size check, and a check that `dist/index.html` has the `/surprise-museum/` base path, a Content-Security-Policy and the Supabase origin. It then adds `404.html` and uploads the artefact (`configure-pages`, `upload-pages-artifact`).
3. `deploy` (needs `build`, environment `github-pages`): `deploy-pages`, which prints the site URL.

Decision on mock versus live: the Pages build is **live only** and fails fast. A mock build on a public URL would let someone build a museum whose share link works only in their own browser (IndexedDB), which breaks the product's purpose. If you want a throw-away public demo anyway, that is a product decision, not a CI switch: say so and it can be added as a separate workflow.

### Deploy Supabase (`deploy-supabase.yml`)

Inputs: `migrations` (default **on**) and `functions` (default on). Runs the Deno checks, then (main only, environment `supabase-production`) links the project, dry-runs and applies `supabase db push` **first**, then deploys every function folder (all five, `keep-alive` included) with `--no-verify-jwt` (as in `supabase/config.toml`). The order matters: `keep-alive` answers 500 until migration `20261118000100_keep_alive.sql` has created `public.keep_alive()`, so the first deploy must run with `migrations` ticked. The Supabase CLI is pinned to 2.122.0.

It does **not** do the one-time setup: creating the project, turning sign-ups off, the Vault secrets, or the function secrets. Those stay manual (below).

## Environment variables and secrets (names only)

Repository **variables** (Settings, Secrets and variables, Actions, Variables). Public values, compiled into the website. `keep-alive.yml` reads the first two as well (it needs no secret):

| Name | Used by | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | `deploy-pages.yml`, `keep-alive.yml` | `https://<ref>.supabase.co` (no path) |
| `VITE_SUPABASE_ANON_KEY` | `deploy-pages.yml`, `keep-alive.yml` | The anon or publishable (`sb_publishable_...`) key. Never the service-role or `sb_secret_` key; `check:live` rejects both |
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

Nothing below has been done. Do them in order; every step that touches GitHub settings, secrets or the Supabase account is yours.

1. **Push the commits** (tech lead). The push starts CI. Pushing `keep-alive.yml` also schedules the daily keep-alive. Until `VITE_SUPABASE_URL` is set (step 4) its run is **skipped** (grey), not red, so there are no failure e-mails before launch.
2. **Enable Pages.** Repository Settings, Pages, **Build and deployment, Source: GitHub Actions**. The first Pages deploy fails with a clear error if this is missing.
3. **Create the Supabase Free project** (Supabase dashboard, New project). Choose the Free plan and an Australian region where practicable (Sydney, `ap-southeast-2`). If the Free plan does not offer Sydney, choose the nearest region and set the optional variable `VITE_SUPABASE_FUNCTIONS_REGION` to it. Save the database password. Then do the one-time setup in `supabase/README.md` steps 1 to 6 (sign-ups off, link, Vault secrets, function secrets). In `ALLOWED_ORIGINS` the value must contain exactly `https://patlu29.github.io` (origin only, no path, no trailing slash), or every browser call from the live site is refused.
4. **Add the GitHub variables and secrets** (Settings, Secrets and variables, Actions), by name only:
   - Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon or publishable key, never the service-role or `sb_secret_` key), optional `VITE_SUPABASE_FUNCTIONS_REGION`.
   - Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
   - **Required reviewers (recommended for `supabase-production`, optional for `github-pages`).** A required reviewer makes a deploy job pause until someone approves it. To add one: Settings, Environments, `supabase-production`, tick "Required reviewers", pick at least one person (you can be your own reviewer on a personal repo), then "Save protection rules". If the environment is not listed yet, choose "New environment" and name it exactly `supabase-production`. Recommended here because that workflow applies migrations and replaces live functions. For `github-pages` the same path applies, but it is optional: that deploy only replaces static files and can be rolled back by re-running an earlier deploy.
5. **Run "Deploy Supabase (functions and migrations)"** (Actions, Run workflow, branch `main`) with **`migrations` ticked** (the default) and `functions` ticked. It applies every migration, including `20261118000100_keep_alive.sql`, then deploys all five functions. Then run `node supabase/scripts/smoke-test.mjs https://<ref>.supabase.co <anon key>` and the lockdown `curl` checks from `supabase/README.md` step 8. Every line must say PASS.
6. **Run "Deploy to GitHub Pages"** (Actions, Run workflow, branch `main`). It re-runs all checks (about 15 to 25 minutes), then builds and publishes. Open the URL it prints, create a throw-away museum and open its share link in a second browser.
7. **Check the keep-alive with a manual run.** Actions, "Keep Supabase awake", Run workflow. It must turn green, and the run summary shows a `checkedAt` time. A grey "skipped" run means `VITE_SUPABASE_URL` is not set (step 4); a red run saying `VITE_SUPABASE_ANON_KEY` is not set means that variable is missing; a 500 means the migration (step 5) did not run.
8. **Turn on failure e-mails and set a reminder.** GitHub, Settings, Notifications, Actions: send failed-workflow e-mails. Put a repeating calendar reminder every 50 days (see "Free tier", the 60-day rule).
9. **Record the Linux visual baselines** (optional, but until done the visual spec does not run in CI):
   1. Actions, "Record visual baselines (Linux)", Run workflow (any branch).
   2. When it is green (it records, then re-runs to prove the images are stable), download the artefact `visual-baselines-linux` and unzip it so that the folder `desktop-chromium-linux` sits in `tests/e2e/__screenshots__/`.
   3. Open the PNGs and look at them. Do not commit images you would not accept as correct.
   4. Commit `tests/e2e/__screenshots__/desktop-chromium-linux/` (qa-engineer or tech lead). CI then runs `visual.spec.ts` on Linux automatically.
   5. If the verify step fails, the run is not stable on Linux; do not commit those images. Tell the qa-engineer.
10. **Watch the first 7 or more days.** Confirm in Actions that a keep-alive run succeeded in every 72-hour window, and that Supabase never paused the project. This is the only proof that Supabase counts the call as activity (ADR 0022, Fallback).

Not approved in this iteration, so not done by the devops-engineer: pushing, enabling Pages, setting variables or secrets, creating the Supabase project, running any workflow, and any deploy.

## Free tier (Supabase Free plan and GitHub Pages)

Decision: 18/11/2026, hosting on free tiers only (ADR 0022). Museums and photos are deleted 7 days after first publish (NFR-16). The free-limit guardrail is this section and a usage check by hand; the app has **no in-app handling** of a full free tier (FR-104 is deferred, backlog CR-9). The limits below are third-party figures: **confirm each on supabase.com/pricing** before relying on it.

### The limits

| Limit | Figure | Confirm |
|---|---|---|
| File storage | 1 GB | confirm on supabase.com/pricing |
| Database | 500 MB | confirm on supabase.com/pricing |
| Egress (data sent out) | about 5 GB a month | confirm on supabase.com/pricing |
| Edge Function invocations | about 500,000 a month | confirm on supabase.com/pricing |
| Idle pause | A Free project pauses after 7 days without activity | confirm on supabase.com/pricing |
| Backups | **None** on the Free plan. A deleted or purged museum cannot be restored | confirm on supabase.com/pricing |

The invocation figure matters because `keep-alive` and every other function are public and unthrottled by design (ADR 0022 section 2): a stranger who hammers them costs invocations. The usage check below is the control.

### Capacity arithmetic

One full museum has 20 photos. Each photo is stored as about 600 KB (the display image) plus about 200 KB (its thumbnail):

20 photos x (about 600 KB + about 200 KB) = about 16 MB per full museum.

1 GB is about 1,000 MB, so about 1,000 / 16 = about 60 full museums live at once. Museums last 7 days, so about 60 full museums published within any 7-day window fit in 1 GB. The database holds only small rows, so storage runs out long before the 500 MB database. Egress is the next limit: each visit loads the photos, so 5 GB a month is roughly 5,000 MB / 16 MB = about 300 full-museum visits a month if every visit opens every photo.

### Usage check (do it weekly, and before sending a link to many people)

1. Open the Supabase dashboard, your project, **Usage** (under Settings or Reports; menu names change). Read **file storage**, **database size**, **egress** (for the billing month) and **Edge Function invocations**, and compare each with the table above.
2. In the dashboard SQL editor (it runs for the signed-in owner only) run the two read-only queries:

```sql
select pg_size_pretty(pg_database_size(current_database())) as database_size;
select count(*) as objects, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as photos_size
  from storage.objects where bucket_id = 'photos';
```

3. Open GitHub, Actions, **Keep Supabase awake**. Check the date and result of the latest run: it must be green and less than 24 hours old (the run summary shows the database time, `checkedAt`). If the latest run is red, open it; the log says whether the variables are missing, the function answered an error, or the project is paused.
4. If any figure is above about 80 percent of its limit, act as described below before the limit is reached.

### When a limit is reached

| Limit | What happens (confirm the exact behaviour in the Supabase docs) | What to do |
|---|---|---|
| File storage 1 GB | New photo uploads fail, so a Creator cannot publish. The app shows its existing upload or publish error message and nothing more (FR-104 deferred). Existing museums keep working | Check that the hourly purge is running (expired museums free their photos); wait for museums to expire, or delete test museums; ask people to try again later. For more space on a paid plan, contact Supabase sales |
| Database 500 MB | Supabase may make the database read-only, so publishing and edits fail. Visits that only read may still work | Same as above; the purge frees rows. If the project stays read-only, contact Supabase support or sales |
| Egress about 5 GB a month | Supabase may restrict the project until the next billing month, so photos and API calls may stop loading for visitors | Wait for the month to roll over, or contact Supabase sales about a paid plan. Tell recipients that the link works again later |
| Edge Function invocations | Calls may be refused for the rest of the month, so the whole app stops working | Check the Usage page for abuse (a spike with no matching museums); wait for the month to roll over or contact Supabase sales |
| Idle for 7 days | The project pauses; the app goes offline and the hourly purge stops | Restore it in the dashboard (Free projects can be restored for a limited time after pausing; confirm the period on supabase.com), then re-enable and run the keep-alive. Expired museums are purged within a few hours of the restore |

There is no backup: if a museum is lost, it is gone. The Free plan has no backups.

For a paid plan or any price, contact Supabase sales; this guide quotes no price.

### The keep-alive workflow

`keep-alive.yml` sends `POST <VITE_SUPABASE_URL>/functions/v1/keep-alive` once a day (20:37 UTC) with the public anon key in the `apikey` header. The function runs one read-only query. The workflow creates nothing, never calls purge and needs no secret; on failure it prints curl's HTTP error line and the response body (an error body holds no key), and on success the database time; it masks the key either way. It fails (red) on a non-200 answer, a body that is not `{"ok":true,"checkedAt":"..."}`, a timeout (3 retries 20 seconds apart, 30 seconds each), when `VITE_SUPABASE_ANON_KEY` is not set, or when `VITE_SUPABASE_URL` is not an `https://` address. If `VITE_SUPABASE_URL` is not set at all, the job is skipped (grey) instead, as ADR 0022 section 5 says; a skipped run means that variable is missing. The anon key is sent in `apikey` only: ADR 0022 and `docs/api.md` section 10a specify no `Authorization` header, and a publishable key is not a JWT. Not verified: whether the Supabase gateway requires `apikey` when `verify_jwt` is off; sending it is the safe default.

Failure signal: a red run in Actions. GitHub also e-mails the user who last changed the `cron` line when a scheduled run fails, if their Notifications settings send Actions failures by e-mail (check once: GitHub, Settings, Notifications, Actions). Not verified for this account.

### GitHub switches scheduled workflows off after 60 days

In a **public** repository, GitHub disables scheduled workflows after **60 days with no repository activity** (a workflow run does not count). Then the keep-alive stops, with no failure e-mail, and the Supabase project pauses about 7 days after the last success.

- **Prevent it:** put a repeating calendar reminder every 50 days. Open Actions, "Keep Supabase awake", and check that the latest run is green and recent. Any push to the repository resets the 60 days.
- **Switch it back on:** open Actions, click "Keep Supabase awake" in the left list, choose **Enable workflow** (GitHub shows a notice when it was disabled for inactivity), then **Run workflow** once and check that it turns green.
- **If the project has already paused:** restore it from the Supabase dashboard first, then re-enable the workflow and run it.

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
| Edge Functions | Revert the commit on `main`, then run "Deploy Supabase" with `functions` ticked (and `migrations` unticked if no migration changed). The workflow only deploys `main` |
| Database migrations | There are no down migrations. Roll forward with a new idempotent migration. Take a backup first if the plan has them; the free plan does not |
| Secrets and keys | Rotate in the Supabase dashboard (anon key, access token, database password) and update the matching GitHub variable or secret. If the service-role key is ever exposed, rotate it immediately |

Order matters when a release changes the API: roll the frontend back first, then the functions, so the site never calls a function that has gone.

## Known gaps

| Gap | Detail |
|---|---|
| Linux e2e flakes | The Linux e2e jobs pass (run 44696065214: 349, 347 and 336 passed, 0 failed, 1 flaky that passed on retry). A few timing-sensitive tests are flaky under load; the retries (2) absorb them. The e2e jobs are blocking |
| Linux visual baselines | Missing until manual step 9 is done and committed. The visual spec is skipped in CI meanwhile |
| Firefox | Never verified. Every `e2e-firefox` run so far was cancelled, which also marks the whole CI run "cancelled" even when every required job passed. The cause is not known (no log or report exists). The job now has a 30-minute job limit and a 25-minute step limit, and uploads its report and traces with `if: always()`, so the next run ends as pass, fail or timeout with a report to read. If it keeps timing out, look at the uploaded `playwright-report-desktop-firefox` and `playwright-traces-desktop-firefox` artefacts, or remove the job. It stays non-blocking |
| Real devices | No real phone or tablet was tested (QA and performance reports). CI uses emulated iPhone 13 and Pixel 7 profiles, which do not measure GPU memory or frame rate |
| Screen readers | Not tested with a real screen reader (axe-core checks run in e2e, but those are not a substitute) |
| `format:check` | Enforced in `checks`. `src/styles/tokens.css` and `*.md` are ignored on purpose (see `.prettierignore`) |
| Action versions | Pinned by major tag (`@v7`, `@v6`, and so on, current on 02/11/2026), not by commit SHA. Pinning by SHA is the stricter choice if supply-chain risk matters |
| No PR previews | See Hosting notes |
| No scheduled checks | No Dependabot, no scheduled CI. The only scheduled workflow is `keep-alive.yml` |
| Keep-alive never run | `keep-alive.yml` has not run on GitHub, and whether Supabase counts the call as activity is unconfirmed until 7 or more days after launch (ADR 0022) |
| Legal | Photo-consent and Privacy Act wording, and the LGPL-3.0 licence of `heic-to`, still need review before a public launch (`docs/project-status.md`). Deploying publishes the site to the world |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Deploy fails at "Check the live backend is configured" | The repository **variables** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, a placeholder, or the wrong kind of key. The log lists what to fix. Variables, not only secrets, are read |
| Deploy fails at "Verify the base path..." | `BASE_PATH` in `vite.config.ts` was changed, or the Supabase URL is not an origin (no path) |
| `deploy-pages` fails with "Pages not enabled" or a 404 from the API | Step 2 not done (Source must be GitHub Actions) |
| Site loads but says it is "not connected to its server" | The build had no Supabase variables (the guard should have stopped this), or `ALLOWED_ORIGINS` lacks `https://patlu29.github.io` (browser console shows a CORS error) |
| Keep-alive run is grey (skipped) | `VITE_SUPABASE_URL` is not set as a repository variable (manual step 4) |
| Keep-alive run is red with "not configured" | `VITE_SUPABASE_ANON_KEY` is not set as a repository variable (manual step 4) |
| Keep-alive run is red with HTTP 500 | Migration `20261118000100_keep_alive.sql` was not applied (run Deploy Supabase with `migrations` ticked), or a function secret is missing (`supabase/README.md` step 6) |
| Keep-alive run is red with HTTP 401 or 404 | The anon key is wrong, the function is not deployed, or the project is paused or deleted |
| No keep-alive runs at all | GitHub disabled the schedule after 60 days of inactivity. See "GitHub switches scheduled workflows off" |
| Deploy workflow shows "Skipped" for build | The run was started from a branch other than `main` |
| `e2e` fails only on `mobile-webkit` or under load | Timing. Check the trace artefact, then consider `--workers=1` for that project |
| Bundle-size job fails | A chunk passed 1000 kB (HEIC decoder 3500 kB), `three-*` passed 985 kB, or `three-*` plus `scene-shared-*` passed 1000 kB. Exit code 2 instead means one of those two chunks is missing, so the chunk names changed. See `docs/performance.md` part A.3 and section 6 and the job summary table before raising any limit; a limit change needs the architect |
