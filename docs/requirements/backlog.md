# Backlog: Surprise Museum

Version 0.7 | 18/11/2026 | Owner: product-manager | Created in iteration 4, phase 1 Plan

Everything known and not yet done. Rows are never deleted. Types: Feature, Bug, Performance, Verification, Debt, Operations. Status: Open, In progress (iteration), Done (iteration) or Declined (reason). A row links to the requirements or stories; the detail lives there. Sources are `docs/project-status.md` and `docs/qa-report.md` (round 7, HEAD 44a8a77, 11/11/2026).

## Iteration 4 (in progress)

| ID | Type | Summary | Source | Priority | Status | Links |
|---|---|---|---|---|---|---|
| CR-5 | Feature | Retention changes from 90 to 7 days from first publish; purge within 24 hours; no backups on the Free plan; Creator-set expiry can only shorten the 7 days | User, 18/11/2026: first "make auto clear photos for each 2 days", then "okay then change that as one week promise" | Must | In progress (iteration 4) | NFR-16, FR-54, Q-5, US-24, US-27, US-68; ADR 0010 amendment (architect) |
| CR-6 | Operations | Free-tier hosting: GitHub Pages on a public repository and Supabase Free; free limits and capacity stated; limit-hit behaviour documented, not handled in the app | User, 18/11/2026: free tiers only; guardrail is docs plus a usage check | Must | In progress (iteration 4) | NFR-32, US-69, US-70, A-35 to A-37, Q-34 |
| CR-7 | Operations | Keep-alive: a scheduled request at least every 3 days so Supabase Free never reaches its 7-day idle pause | User, 18/11/2026: Supabase Free with keep-alive | Must | In progress (iteration 4) | NFR-32 (b), US-69 |
| CR-8 | Operations | Deployment guide gets a free-tier section: limits, usage check, last keep-alive check, 60-day GitHub schedule rule, what to do at a limit, no backups | User, 18/11/2026 (docs plus a usage check) | Must | In progress (iteration 4) | NFR-32 (c) to (f), US-70; `docs/deployment.md` (devops-engineer) |
| CR-10 | Feature | Publish screen states the 7-day promise and the end date and time | Product-manager assumption from the user's "one week promise" (awaiting the user, Q-35) | Must | In progress (iteration 4) | FR-105, US-71, Q-35 |

## Carried forward from iteration 3 and earlier

| ID | Type | Summary | Source | Priority | Status | Links |
|---|---|---|---|---|---|---|
| CR-9 | Feature | In-app "space full" handling: a clear message to the Creator when a free storage, database or egress limit is reached, and no new publishes until space is free | User, 18/11/2026: guardrail is docs plus a usage check, with no new in-app handling | Could | Open | FR-104, NFR-32 (f) |
| BUG-15 | Bug | Name label up to 1 px inside the 8 px viewport margin (390x844 picture 2, 320x568 picture 3). Cosmetic residual; the test has a 1 px tolerance | QA round 7, 11/11/2026 | Could (minor) | Open | FR-17, US-10 |
| N-11 | Bug | The finale card dock flips to the left on about 1 run in 10 on a loaded host (1280x720). Both placements are valid; QA's test retries up to 4 times. Needs a decision on whether the dock should be sticky | QA round 7 observation N-11; owner frontend-developer, ux-ui-designer | Could (minor) | Open | FR-29, US-14 |
| N-12 | Bug | HUD pills touch (about 4 px overlap) at 200% text on 320 px | QA round 7 observation N-12; owner frontend-developer | Could (minor) | Open | FR-83, FR-81, US-52 |
| N-13 | Bug | Stacked name label covers most of the Guide's head with 24-character names | QA round 7 observation N-13; owner scene-developer | Could (minor) | Open | FR-17, FR-7, US-10 |
| V-1 | Verification | Real phones and laptops: frame rate, memory and tier thresholds, touch and safe areas were never measured on a real device | Project status, Not verified; `docs/performance.md` section 7 | Must | Open | NFR-1, NFR-6, NFR-10, NFR-28 |
| V-2 | Verification | Frame rate on Safari and Firefox was not measured; Firefox cannot launch in the build sandbox | Project status, Not verified | Must | Open | NFR-1, NFR-8 |
| V-3 | Verification | Screen readers (VoiceOver, TalkBack, NVDA) were not tried; checks so far are automated | Project status, Not verified | Should | Open | NFR-12, FR-63 |
| V-4 | Verification | Visual baselines were made on macOS; Linux baselines for CI were never generated | Project status, Not verified | Should | Open | NFR-8 |
| V-5 | Verification | CI on GitHub has never run (billing lock; the user says it is fixed on 18/11/2026 but no run has confirmed it). Includes the first run of the keep-alive workflow | Project status, Not verified | Must | Open | NFR-32, US-69 |
| LEG-1 | Operations | Legal review before public launch: photo-consent and Privacy Act wording (Q-15), and the LGPL-3.0 licence of the `heic-to` decoder. Owner: the organisation's legal team | Project status, "Needing legal review before public launch" | Must (before launch) | Open | NFR-14, FR-56, Q-15 |
| DEBT-1 | Debt | Slim the builder preview's unused materials (about 8 to 12 kB) to widen the 12.4 kB headroom under the 1,000 kB limit | Project status, 03/11/2026 (follow-up, not a release blocker) | Could | Open | NFR-27 |
| PERF-1 | Performance | Re-entering the museum retains about 49 DOM nodes and 0.4 MB of heap per visit | Project status, known issues (low priority) | Could | Open | NFR-6 |
| CR-11 | Feature | Time hints on the builder step list (FR-88), deferred until there is usability data | Tech lead, 02/11/2026 | Won't this release | Open | FR-88, US-56 |
