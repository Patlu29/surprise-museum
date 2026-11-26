# Backlog: Surprise Museum

Version 0.8 | 26/11/2026 | Owner: product-manager | Created in iteration 4, phase 1 Plan; updated in iteration 4 phase 7 (v0.7.1); updated in iteration 5 phase 1 Plan (v0.8)

Change log: v0.8 (26/11/2026, iteration 5, phase 1 Plan): CR-9, BUG-15, N-11, N-12, N-13, DEBT-2, OPS-1 and CR-13 move to In progress (iteration 5) and link to the new requirements and stories (see the iteration 5 table below). CR-9 rises from Could to Should, because the user asked for it on 26/11/2026, which reverses their 18/11/2026 decision. New rows CR-15 and CR-16 record two ideas deferred from the space-full work. No other row changed.

Everything known and not yet done. Rows are never deleted. Types: Feature, Bug, Performance, Verification, Debt, Operations. Status: Open, In progress (iteration), Done (iteration) or Declined (reason). A row links to the requirements or stories; the detail lives there. Sources are `docs/project-status.md` and `docs/qa-report.md` (round 7, HEAD 44a8a77, 11/11/2026).

## Iteration 5 (in progress, started 26/11/2026): where each item is specified

The user chose this scope on 26/11/2026 ("okay do them"). The rows themselves stay in the tables further down, with their status changed in place; this table shows where each item is specified. "Takes on" means the item is in this iteration; "completes" is filled in when QA and the user close it.

| ID | Takes on | Requirements | Stories | Open questions that change it |
|---|---|---|---|---|
| OPS-1 | Yes | NFR-33, NFR-34 | US-72, US-73 | Q-40, Q-41 |
| CR-13 | Yes | NFR-33 (the flag), NFR-34 | US-72, US-73 | Q-40 |
| CR-9 | Yes | FR-104, FR-106, FR-107, NFR-32 (f) | US-74, US-75, US-76, US-77, US-70 AC-5 | Q-36, Q-37, Q-38, Q-39, Q-44 |
| DEBT-2 | Yes | NFR-35 | US-78 | Q-42 |
| N-11 | Yes (through DEBT-2) | FR-108, NFR-35 | US-79, US-78 | Q-43 |
| BUG-15 | Yes | FR-109 | US-80 | none |
| N-12 | Yes | FR-110 | US-81 | none |
| N-13 | Yes | FR-111 | US-80 | Q-45 |

## Iteration 4 (done; released with known issues, not deployed)

| ID | Type | Summary | Source | Priority | Status | Links |
|---|---|---|---|---|---|---|
| CR-5 | Feature | Retention changes from 90 to 7 days from first publish; purge within 24 hours; no backups on the Free plan; Creator-set expiry can only shorten the 7 days. Built and checked locally; the checks that need the deployed project are V-6 | User, 18/11/2026: first "make auto clear photos for each 2 days", then "okay then change that as one week promise" | Must | Done (iteration 4; not deployed, see V-6) | NFR-16, FR-54, Q-5, US-24, US-27, US-68; ADR 0010 amendment (architect) |
| CR-6 | Operations | Free-tier hosting: GitHub Pages on a public repository and Supabase Free; free limits and capacity stated; limit-hit behaviour documented, not handled in the app. Configured and documented; nothing deployed (user, 23/11/2026: "No deploy yet"); live checks are V-6 and V-7 | User, 18/11/2026: free tiers only; guardrail is docs plus a usage check | Must | Done (iteration 4; not deployed, see V-6, V-7) | NFR-32, US-69, US-70, A-35 to A-37, Q-34 |
| CR-7 | Operations | Keep-alive: a scheduled request at least every 3 days so Supabase Free never reaches its 7-day idle pause. Workflow written and statically checked; it has never run, so whether it prevents a pause is unproven (V-6) | User, 18/11/2026: Supabase Free with keep-alive | Must | Done (iteration 4; not deployed, see V-6) | NFR-32 (b), US-69 |
| CR-8 | Operations | Deployment guide gets a free-tier section: limits, usage check, last keep-alive check, 60-day GitHub schedule rule, what to do at a limit, no backups | User, 18/11/2026 (docs plus a usage check) | Must | Done (iteration 4) | NFR-32 (c) to (f), US-70; `docs/deployment.md` (devops-engineer) |
| CR-10 | Feature | Publish screen states the 7-day promise and the end date and time | Product-manager assumption from the user's "one week promise" (Q-35 answered (a) by the user at A2, 19/11/2026: stays Must) | Must | Done (iteration 4) | FR-105, US-71, Q-35 |

## Carried forward from iteration 3 and earlier

| ID | Type | Summary | Source | Priority | Status | Links |
|---|---|---|---|---|---|---|
| CR-9 | Feature | In-app "space full" handling: a clear message to the Creator when a free storage, database or egress limit is reached, and no new publishes until space is free | User, 18/11/2026: guardrail is docs plus a usage check, with no new in-app handling. **Reversed by the user on 26/11/2026** ("okay do them"): in-app handling is now wanted | Should (was Could) | In progress (iteration 5) | FR-104, FR-106, FR-107, NFR-32 (f); US-74 to US-77; Q-36 to Q-39, Q-44 |
| BUG-15 | Bug | Name label up to 1 px inside the 8 px viewport margin (390x844 picture 2, 320x568 picture 3). Cosmetic residual; the test has a 1 px tolerance | QA round 7, 11/11/2026 | Could (minor) | In progress (iteration 5) | FR-17, US-10; FR-109, US-80 |
| N-11 | Bug | The finale card dock flips to the left on about 1 run in 10 on a loaded host (1280x720). Both placements are valid; QA's test retries up to 4 times. Needs a decision on whether the dock should be sticky | QA round 7 observation N-11; owner frontend-developer, ux-ui-designer | Could (minor) | In progress (iteration 5, through DEBT-2) | FR-29, US-14; FR-108, US-79; Q-43 |
| N-12 | Bug | HUD pills touch (about 4 px overlap) at 200% text on 320 px | QA round 7 observation N-12; owner frontend-developer | Could (minor) | In progress (iteration 5) | FR-83, FR-81, US-52; FR-110, US-81 |
| N-13 | Bug | Stacked name label covers most of the Guide's head with 24-character names | QA round 7 observation N-13; owner scene-developer | Could (minor) | In progress (iteration 5) | FR-17, FR-7, US-10; FR-111, US-80; Q-45 |
| V-1 | Verification | Real phones and laptops: frame rate, memory and tier thresholds, touch and safe areas were never measured on a real device | Project status, Not verified; `docs/performance.md` section 7 | Must | Open | NFR-1, NFR-6, NFR-10, NFR-28 |
| V-2 | Verification | Frame rate on Safari and Firefox was not measured; Firefox cannot launch in the build sandbox | Project status, Not verified | Must | Open | NFR-1, NFR-8 |
| V-3 | Verification | Screen readers (VoiceOver, TalkBack, NVDA) were not tried; checks so far are automated | Project status, Not verified | Should | Open | NFR-12, FR-63 |
| V-4 | Verification | Visual baselines were made on macOS; Linux baselines for CI were never generated | Project status, Not verified | Should | Open | NFR-8 |
| V-5 | Verification | CI on GitHub had never run (billing lock). Tech lead, 23/11/2026: CI has run since 18/11/2026 and every required job has been green since run 44686612364 (20/11/2026): typecheck, lint, unit, build, bundle, Deno, and e2e on desktop-chromium, mobile-chromium and mobile-webkit; the billing lock is confirmed cleared. What it did not cover: the Firefox job never finished and Linux visual baselines are not recorded (see V-8 and V-4); the keep-alive workflow's first real run is V-6 (f) | Project status, Not verified; tech lead correction, 23/11/2026 | Must | Done (iteration 4) | NFR-32, US-69, V-4, V-6, V-8 |
| LEG-1 | Operations | Legal review before public launch: photo-consent and Privacy Act wording (Q-15), and the LGPL-3.0 licence of the `heic-to` decoder. Owner: the organisation's legal team | Project status, "Needing legal review before public launch" | Must (before launch) | Open | NFR-14, FR-56, Q-15 |
| DEBT-1 | Debt | Slim the builder preview's unused materials (about 8 to 12 kB) to widen the 12.4 kB headroom under the 1,000 kB limit | Project status, 03/11/2026 (follow-up, not a release blocker) | Could | Open | NFR-27 |
| PERF-1 | Performance | Re-entering the museum retains about 49 DOM nodes and 0.4 MB of heap per visit | Project status, known issues (low priority) | Could | Open | NFR-6 |
| CR-11 | Feature | Time hints on the builder step list (FR-88), deferred until there is usability data | Tech lead, 02/11/2026 | Won't this release | Open | FR-88, US-56 |

## Added in iteration 4, phase 7 (23/11/2026, from the tech lead, review and QA round 8b)

Existing items V-1 to V-5 stay open. V-8 below narrows what is still unchecked; where V-8 overlaps V-1 to V-4, close them together.

| ID | Type | Summary | Source | Priority | Status | Links |
|---|---|---|---|---|---|---|
| V-6 | Verification | **Post-deploy verification** (needs the deployed project; all Not verified today). (a) US-68 AC-5: 0 rows and 0 objects 24 h after the end. (b) US-68 AC-6: 23 hourly purge runs in 24 h. (c) US-24 AC-3: 0 rows 24 h after a delete. (d) NFR-16 (e) and (f). (e) US-69 AC-1: repo public, Free plan, no paid add-on. (f) US-69 AC-3: a keep-alive run in every 72 h. (g) US-69 AC-5: a real failed run shows red. (h) NFR-32 (b): whether Supabase counts the keep-alive as activity (watch 7 or more days). (i) Whether the Supabase gateway needs `apikey` when verify_jwt is off. (j) The real `rpc('keep_alive')` reply shape. (k) The pgTAP lockdown tests and the migration against real Postgres | Tech lead, 23/11/2026 (project status, Not verified; QA round 8b; review) | Must (before launch) | Open | US-68, US-24, US-69, NFR-16, NFR-32 |
| V-7 | Verification | **Q-34 user checks on supabase.com:** 1 GB storage, 500 MB database, about 5 GB egress, about 500,000 Edge Function invocations a month; whether an Australian (Sydney) region is offered on Free; what happens at each limit; how long a paused project can be restored | Tech lead, 23/11/2026; Q-34 (open) | Must (before launch) | Open | Q-34, NFR-32, US-70, A-13, A-35 |
| V-8 | Verification | **Browsers and devices still unchecked:** the Firefox CI job has never finished (now has a 30-minute limit and keeps its report); real phones; screen readers; the browser's own 200% text setting; Linux visual baselines not recorded (`visual.spec.ts` is left out on Linux until they are; use `visual-baselines-linux.yml`). Overlaps V-1 to V-4 | Tech lead, 23/11/2026 | Should (Firefox job and Linux baselines Must before CI is trusted) | Open | NFR-8, NFR-12, V-1 to V-4 |
| DEBT-2 | Debt | **Test stability.** Flaky on Linux CI: gender US-46 AC-2 (mobile-chromium); presentation-camera CR-2 veil at 1280x720 (mobile-chromium); ceiling FR-95 AC-1 (mobile-webkit). Flaky on macOS under load: builder US-8, label-strip; finale-card visual (observation N-11). CI-only timing allowances (FR-15 4,000 ms; caption-card U1 1,500 ms) mean the strict local limits are not checked in CI (review REV-10) | Tech lead, 23/11/2026; review REV-10; QA round 8b | Should | In progress (iteration 5) | US-46, FR-95, FR-15, N-11; NFR-35, US-78; Q-42 |
| OPS-1 | Operations | Nothing alerts if the purge's storage deletes keep failing for more than 23 hours, so the 24-hour promise could break unseen | ADR 0010 amendment; review REV-5 | Should | In progress (iteration 5) | NFR-16 (e), US-68 AC-5; NFR-33, NFR-34, US-72, US-73; Q-40, Q-41 |
| CR-12 | Feature | Cap signed photo URLs at the museum's `expires_at`, so a URL cannot outlive the museum | Architect's backlog candidate, 23/11/2026 | Could | Open | NFR-16, NFR-15 |
| CR-13 | Feature | A `purgeHealthy` flag in the keep-alive response, so the keep-alive run can show red when the purge is unhealthy | Architect's backlog candidate, 23/11/2026 | Could | In progress (iteration 5, with OPS-1) | NFR-32 (b), US-69, OPS-1; NFR-33, NFR-34, US-72, US-73 |
| CR-14 | Feature | Show a draft's end date on the edit page | Architect's backlog candidate, 23/11/2026 | Could | Open | NFR-16 (c), FR-105 |
| DEBT-3 | Debt | Per-function `deno.lock` files are inconsistent: 3 of 5 functions have one; CI uses the root lock | Review REV-13 (Note) | Could | Open | ADR 0022 |
| DEBT-4 | Debt | Traceability for iterations 1 to 3 was never compiled (they ran before the ADLC); `docs/lifecycle/traceability.md` covers iteration 4 only | Tech lead, 23/11/2026 | Could | Open | `docs/lifecycle/traceability.md` |

## Added in iteration 5, phase 1 Plan (26/11/2026, by the product-manager)

Ideas set aside while writing the space-full handling (CR-9). Neither is in iteration 5. Saving photos on the device (so that closing the page loses nothing) already exists as US-29 (Should, Release 2); see Q-38 option (b).

| ID | Type | Summary | Source | Priority | Status | Links |
|---|---|---|---|---|---|---|
| CR-15 | Feature | A notice when the Creator opens the builder, before any photo is added, saying the service is full for now, so that nobody builds a museum first. Needs a public true or false flag the page can read, with the same privacy care as NFR-33 (c) | Product-manager, from Q-38 option (c), 26/11/2026 | Could | Open | FR-104, FR-106, Q-38 |
| CR-16 | Feature | Handle the Edge Function invocation limit (about 500,000 a month, third-party figure, Q-34) in the app. Not covered by FR-104 because the user named storage, database and egress only; the app probably cannot read it either | Product-manager, 26/11/2026 (FR-104 (f)) | Could | Open | FR-104 (f), NFR-32 (d), Q-34 |
