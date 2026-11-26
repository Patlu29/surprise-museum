# Handoff: product-manager

Iteration: 5 (Feature and fixes: OPS-1 + CR-13, CR-9, DEBT-2 including N-11, BUG-15, N-12, N-13). Phase: 1 Plan. Awaiting the user's approval of scope (A1) and answers to Q-36 to Q-45. Nothing deployed by this phase.

## Summary
Requirements are v0.8, user stories v0.8 and the backlog v0.8, each with a change-log line. Every in-scope item has a requirement and at least one story with numbered Given/When/Then criteria and figures. The Must count is unchanged at 90, because everything new is Should or Could. Where the user gave no figure, I chose a default, marked it as mine and put it in an open question with a recommendation.

## New and changed IDs
| Kind | IDs |
|---|---|
| New functional requirements | FR-106 (Creator's message and what they keep, Should), FR-107 (Visitors, delete, edit unaffected, Should), FR-108 (finale dock, N-11, Could), FR-109 (label margin, BUG-15, Could), FR-110 (HUD pills, N-12, Could), FR-111 (stacked label and head, N-13, Could). New Epic E11 holds FR-108 to FR-111 |
| Changed functional requirement | FR-104 (Could, deferred, now Should and rewritten; backlog CR-9) |
| New non-functional requirements | NFR-33 (purge health flag, Should), NFR-34 (red keep-alive run, Should), NFR-35 (test stability, Should) |
| Changed non-functional requirement | NFR-32 (f) (no longer "not handled in the app") |
| New stories | US-72, US-73 (purge health), US-74, US-75, US-76, US-77 (space full), US-78 (test stability), US-79 (dock), US-80 (labels), US-81 (HUD pills). New Epic E11 for US-78 to US-81; US-72 to US-77 sit in E6 |
| Changed stories (no number changed) | US-69 AC-3 (a run red only for purge health still counts if its summary shows "keep-alive: ok"), US-70 AC-5 (app now handles full storage and database; egress may not be detectable) |
| New assumptions | A-38 to A-43 |
| New open questions | Q-36 to Q-45 |
| Changed out of scope | The "in-app handling of a full free plan" line |
| Backlog | CR-9 (priority Could to Should), BUG-15, N-11, N-12, N-13, DEBT-2, OPS-1, CR-13 all now In progress (iteration 5). New rows CR-15 (notice at builder start) and CR-16 (invocation-limit handling), both Could, Open. New "Iteration 5" map table at the top of the backlog |

## Files changed
- `docs/requirements/requirements.md`: v0.8, change-log row, Must-count note, FR-104 rewritten, FR-106 and FR-107, Epic E11 (FR-108 to FR-111), NFR-32 (f), NFR-33 to NFR-35, out-of-scope line, A-38 to A-43, Q-36 to Q-45
- `docs/requirements/user-stories.md`: v0.8 and change note, US-69 AC-3, US-70 AC-5, US-72 to US-77 (Epic E6), Epic E11 with US-78 to US-81, story map and traceability rows
- `docs/requirements/backlog.md`: v0.8, change log, iteration 5 map, eight rows moved to In progress, CR-15 and CR-16
- `docs/handoffs/product-manager.md`: this note

## Key decisions in the requirements (mine, not the user's)
- **Purge "unhealthy" (NFR-33):** no successful purge run in 3 hours (or none ever), oldest storage-delete queue entry older than 3 hours, or an expired museum or draft still stored 3 hours after its end. I did not use the user's example of 23 hours as the default, because the keep-alive runs once a day: a 23-hour threshold would be seen in time for only about 1 failure in 24, while 3 hours is seen in time for about 21 in 24 (A-42). The alert detects trouble; it cannot prevent it.
- **The flag is the only new thing the public learns:** exactly three keys (`ok`, `checkedAt`, `purgeHealthy`). If the health check itself fails, the answer is still 200 with `purgeHealthy: false`, so the keep-alive's job of touching the database never depends on the health check.
- **Red run:** red when the flag is false, missing or not a boolean. A run red only for purge health still counts as keep-alive activity (US-69 AC-3 clarified), otherwise a failing purge would also make the "successful run in 72 hours" check fail even though the project stayed awake.
- **Space full:** stop at 90% of file storage (900 MB of 1,000 MB) or 90% of database size (450 MB of 500 MB), about 6 museums of headroom. Refuse new drafts, new photos and publishes with a photo not yet stored. Allow Visitors, edit page, delete, re-publish with no new file, keep-alive and purge. Resumes by itself. No figures and no limit name are shown to the Creator.
- **Early refusal:** `src/lib/apiPort.ts` says `createMuseum` "starts a draft when the first photo is added", so the Creator normally meets the refusal at the first photo, not after building everything (FR-104 (h)). This is why I recommend stopping uploads as well as publishes (Q-39).
- **What the Creator keeps:** the open page keeps everything. Text and characters are saved on the device; photos are not (CR-3 notice, BUG-1 scope), so the message tells the Creator to keep the page open (A-39, Q-38).
- **Label rules (FR-111):** two label rules conflict at 360 by 640 picture 1 (the accepted N-10 residual). I set an order (picture, caption strip, 8 px margin, head cover) so that no two criteria contradict each other, and carried the N-10 exception into FR-109 and US-80 AC-4.
- **Test stability (NFR-35):** 30 local repeats at `--workers=1` and `--workers=2`, and 10 consecutive CI runs on first attempt. 30 repeats catch a 1-in-10 flake about 96% of the time; 10 repeats would miss it 35% of the time (A-43). A mutation check is required so no fix hides a defect.

## Verification
| Check | Result | Label |
|---|---|---|
| Every in-scope item (OPS-1, CR-13, CR-9, DEBT-2, N-11, BUG-15, N-12, N-13) has a requirement, a story and a backlog row marked In progress (iteration 5) | Yes, read through the three files | Verified (by reading) |
| Every story links to a requirement and has 2 to 6 numbered criteria | US-72 6, US-73 6, US-74 6, US-75 6, US-76 6, US-77 5, US-78 5, US-79 4, US-80 6, US-81 4 | Verified (by reading) |
| Cross-references: every `US-72` to `US-81` cited in the requirements exists in the stories, and the requirements' "Verified by" lines point at the right stories | Searched both files after editing; one round of fixes made | Verified |
| Existing IDs untouched | No ID renumbered or removed; FR-104, NFR-32 (f), US-69 AC-3, US-70 AC-5 edited in place with a "changed in v0.8" mark | Verified (by reading) |
| No contradiction with existing criteria | Checked US-22 AC-5, US-24, US-69 AC-3 and AC-4, US-70 AC-5, FR-17, N-10, BUG-10 and the 8 px margin. Two contradictions found and fixed: US-69 AC-3 versus a red-for-purge run, and FR-109 versus the accepted N-10 residual | Partly verified (by reading; no tool checks prose) |
| Must count | Unchanged at 90 | Verified (nothing added at Must) |
| Facts about the code used: `createMuseum` starts a draft at the first photo (`src/lib/apiPort.ts:58`); photos are not restored after reload (CR-3, BUG-1 scope in `docs/project-status.md`) | Read the comment and the status notes; I did not run the app | Partly verified (A-39 needs the frontend-developer's check) |
| Free-plan figures (1 GB, 500 MB, about 5 GB, about 500,000 invocations) | Third-party, unconfirmed | Not verified (Q-34, backlog V-7) |
| `npm run format:check` on `docs/requirements/` | I have no command-line tool | Not verified (tech lead to run) |
| Whether GitHub's failed-run e-mail fires | Needs a real red run and the user's notification setting | Not verified (A-40, US-73 AC-6) |
| Whether the app can read egress, and how storage and database size are read and cached | Architect's phase 2 decision | Not verified (Q-37, A-38) |

## Decisions
- FR-104 is Should, not Must, and CR-9 rises from Could to Should: the app works without it and the docs-plus-check guardrail still stands (Q-44 lets the user raise it).
- Visual fixes are Could, as in the backlog.
- New stories use US-72 onward; new requirements continue FR-106 and NFR-33.

## Assumptions
A-38 to A-43 in the requirements. In short: usage can be read from inside the database and 5-minute-old figures are fresh enough; photos live only in the open page; GitHub's e-mail depends on the owner's settings; a pg_cron "succeeded" does not prove the purge worked, so the purge function needs its own success signal; detection is no better than once a day; the stability counts. Priorities are my suggestions.

## Not done
- Q-34 (confirm free-plan figures on supabase.com) is still open (backlog V-7).
- I did not change `docs/project-status.md` (tech lead owns it), `docs/deployment.md`, `docs/api.md`, ADRs or any code.
- No numbers for N-13 were measured: the 25% head-cover figure is mine (Q-45).

## Open questions
Each has a default that design and build can start on. Q-36 to Q-40 and Q-43 change what is built, so answer them before design if you can. Full options are in the requirements, section 10.
- Q-36 (user): space-full threshold. Options: (a) 90% (900 MB of 1,000 MB storage, 450 MB of 500 MB database), (b) 80%, (c) 95%. Recommendation: (a). Default: (a).
- Q-37 (user, architect confirms in phase 2): egress detectability. Options: (a) if the app cannot read it, document it as "a limit the app cannot detect" and keep the dashboard check, (b) read it with a management-API secret in the Edge Function, (c) cap it indirectly. Recommendation: (a). Default: (a).
- Q-38 (user): what the Creator sees and keeps. Options: (a) one plain message, work kept in the open page, text and characters saved on the device, "keep this page open" for photos, (b) also save photos on the device (US-29), (c) also warn at builder start (CR-15). Recommendation: (a) now. Default: (a).
- Q-39 (user): do uploads stop as well as publishes. Options: (a) refuse new drafts, photos and publishes with an unstored photo, allow re-publish with no new file, edit and delete, (b) publishes only. Recommendation: (a). Default: (a).
- Q-40 (user): purge-unhealthy definition. Options: (a) 3 hours (no successful run, oldest queue entry, expired item still stored), (b) your example of 23 hours. Recommendation: (a), because a daily check makes 23 hours too late (A-42). Default: (a).
- Q-41 (user): how often to check. Options: (a) daily as built, (b) every 6 hours. Recommendation: (a). Default: (a).
- Q-42 (user): REV-10 CI-only allowances (FR-15 4,000 ms, caption-card U1 1,500 ms). Options: (a) keep them, never raise them, QA runs the strict limits locally every Verify phase, (b) remove them, (c) keep them plus a non-blocking report job. Recommendation: (a). Default: (a).
- Q-43 (user, designer confirms the side per viewport): sticky finale dock. Options: (a) dock depends only on viewport (right at 1280 by 720), (b) leave as is and keep the test's retry. Recommendation: (a). Default: (a).
- Q-44 (user): FR-104 priority. Options: (a) Should, (b) Must. Recommendation: (a). Default: (a).
- Q-45 (scene-developer, then user): N-13 target. Options: (a) 25% head cover, (b) 10%, (c) scene-developer proposes after measuring. Recommendation: (c) with (a) as the working target. Default: (a).

## Requests for other agents
- [open] architect: ADR 0022 section 2 says the keep-alive "reveals nothing"; NFR-33 (c) changes that to exactly one boolean. Update ADR 0022, the `KeepAliveResponse` contract and the success signal for "a purge run completed" (A-41). Decide in phase 2 how storage and database size are read and cached (A-38) and whether egress can be read (Q-37). Confirm where the "space full" refusal is enforced (`create-museum`, `reserve-photo`, `publish`) and its error outcome.
- [open] backend-developer: after the architect's decision, `docs/api.md` section 10a (response gains `purgeHealthy`), section 4 (a distinct "space full" error) and section 11 (REV-5 wording).
- [open] devops-engineer: `docs/deployment.md` line 114 and the "When a limit is reached" table still say "no in-app handling (FR-104 deferred)"; update them with FR-104, and add what a red "purge: unhealthy" run means (US-73 AC-5). The workflow's check must fail on a missing or non-boolean `purgeHealthy`, and the release deploys the function before the workflow.
- [open] ux-ui-designer: space-full message screen (final copy that meets US-75 AC-1 and AC-2, layout for US-76), the finale dock for each reference viewport (Q-43), HUD pill layout at 200% on 320 px (FR-110), stacked label placement (FR-111).
- [open] frontend-developer: check A-39 (photos held in the open page only) and the exact "photos were not kept" notice.
- [open] qa-engineer: map the named DEBT-2 tests to files and projects (US-78); remove the 1 px tolerance and the expected-failure markers for BUG-15 once fixed (US-80); record the strict FR-15 and caption-card U1 timings locally in each Verify phase.
- [open] tech lead: update `docs/project-status.md` (iteration 5 scope and the new IDs); run `npm run format:check` over `docs/requirements/`.

## Requests received
- [done] from tech lead: update requirements, stories and backlog for iteration 5, keeping every ID; bump versions to v0.8 with a change-log line each; move the eight items to In progress; handoff note with Verification, Not done and Open questions.
