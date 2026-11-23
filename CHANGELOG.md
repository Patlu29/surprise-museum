# Changelog

All notable changes to Surprise Museum are recorded here, in the style of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are DD/MM/YYYY. Nothing has been deployed yet, so no entry has a release date.

## [Unreleased] - Iteration 4 (7-day retention and free-tier hosting), prepared 23/11/2026, not deployed

The user approved the release with known issues on 23/11/2026 (A3) and chose "No deploy yet". Known issues: X-1 to X-5 (linen-wall outlines, accepted earlier), BUG-15, N-11 to N-13 (`docs/lifecycle/release-readiness.md`).

### Added
- Keep-alive Edge Function `keep-alive` and migration `20261118000100_keep_alive.sql` (`public.keep_alive()`, executable by `service_role` only). It runs one read-only query, creates nothing and never calls purge (NFR-32, US-69).
- Scheduled workflow `.github/workflows/keep-alive.yml`: daily at 20:37 UTC plus manual run, empty `permissions`, public anon key only, skipped (grey) until `VITE_SUPABASE_URL` is set, then fails (red) on any non-200 answer, wrong body, timeout, non-https URL or missing key; never prints the key.
- Availability notice on the publish screen and edit page: the museum is available for 7 days, the end date and time, and that deleting ends it sooner (FR-105, US-71).
- Format check (`npm run format:check`) in the CI `checks` job.
- Free-tier section in `docs/deployment.md`: limits (each marked "confirm on supabase.com/pricing"), capacity arithmetic, usage check, what happens at each limit, the 60-day rule for scheduled workflows, no backups, and a complete first-deploy manual steps list (US-70).
- This changelog.

### Changed
- Retention is 7 days after first publish, not 90 (NFR-16, US-68). Expired museums and photos are purged within 24 hours.
- Not-found and privacy wording updated for the 7-day life (design spec v2.1).
- `deploy-supabase.yml`: migrations run first and are on by default, so the first deploy creates `keep_alive()` before the functions deploy; all five functions are deployed.
- The repository was formatted with Prettier in one commit (a26a8b8); `src/styles/tokens.css` is left as written (`.prettierignore`) because two unit tests read its values one per line.
- CI wording: the Deno job and step names no longer say "UNVERIFIED" or "four" (five functions). The non-blocking Firefox job has a 30-minute limit and uploads its report with `if: always()`.

### Fixed
- Project `.npmrc` pins the public npm registry, and the lockfiles (including the Deno ones) were regenerated against it, after private-mirror tarball URLs made the Deno CI job fail.
- Linux CI test defects in the e2e suite (QA round 8): four failures were test defects, fixed with no limit loosened.

## Earlier iterations (before ADLC; none deployed)

- Iteration 3, CR-4 improved UI (polish, landing page, character options, scene look): QA round 7 Go.
- Iteration 2, CR-1 to CR-3 (gender for the Guide and Visitor, presentation camera, photo notice, readable caption card): QA round 5 Go.
- Iteration 1, MVP (build and share a 3D photo museum, free roaming, Supabase backend, CI and manual deploy workflows): QA round 2 Go.
