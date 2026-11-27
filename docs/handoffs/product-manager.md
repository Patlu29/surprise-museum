# Handoff: product-manager

Iteration: 5 (Feature and fixes: OPS-1 + CR-13, CR-9, DEBT-2 including N-11, BUG-15, N-12, N-13, C-11). Phase: 3 Build, start (v0.8.2 below); phase 1 Plan notes follow. The user approved the scope at A1 on 26/11/2026 with one change (Q-36 = 80%) and answered Q-36 to Q-45; approved the design at A2 on 27/11/2026.

## v0.8.2 update (27/11/2026, after A2)
Requirements, stories and backlog are v0.8.2, each with a change-log line. Wording only; no ID changed; Must count still 90.

| Item | Done |
|---|---|
| 1 FR-108 (C-9) | Second sentence now "does not change while the card is open, unless the viewport changes layout kind" (design 13.7) |
| 2 US-75 | Proposal line replaced by the approved copy (design 13.5). Checked by reading: 4 sentences of 8, 13, 15, 17 words (I recounted), no digit, none of the six words, no gendered pronoun, two controls, so AC-1 and AC-2 pass. FR-106 now points to 13.5 |
| 3 NFR-33 (e) (C-8) | "calls no other function and no purge, and writes nothing" |
| 4 Design 13.13 Q1 | Q-46: no; decided by the tech lead on the designer's recommendation, 27/11/2026. No requirement contradicted: FR-106 (d) and US-75 AC-4 say "refused action", which for a Publish press with a waiting photo is sending the photos. I added that sentence to FR-106 (d) and US-75 AC-4 so two readers cannot disagree |
| 5 Annotation | Q-47: yes. NFR-34 (b) and US-73 AC-4 allow `::error` to name "flag missing" or "purge behind"; no count, age, time or key; summary exactly "purge: unhealthy". NFR-34 (b) did not clearly allow it before |
| 6 US-74 AC-5 | Note: checked at the API (Deno and mock tests); client stops the publish first (C-10) |
| 7 Fail open, C-11 | FR-104 (i), A-44, Q-48 (user, A2). Backlog row C-11 added: In progress (iteration 5), Should, owner scene-developer |

Also: FR-104 (e) and Q-37 record the architect's finding that egress cannot be read (his handoff asked for it).

Verification: read-back of every edit; searched the three files for "calls nothing" and old proposal text. Label: Verified by reading. `npm run format:check` not run (no tool): Not verified, tech lead to run.

Open questions: none for the user. C-8 to C-10 and architect questions 1 to 3 are closed.

Request for other agents: [open] devops-engineer and backend-developer: Q-47 means the workflow annotation may name the cause; keep it to those two phrases. [open] qa-engineer: add a check that the scene hook is absent in a production build with `?e2e=1` (C-11).

## A1 update (v0.8.1, 26/11/2026)
Requirements, user stories and backlog are now v0.8.1, each with a change-log line. No ID changed, no Must added or removed (still 90).

User answers recorded at A1:
| Question | Answer |
|---|---|
| Q-36 | (b) "80%" (user; I had recommended 90%) |
| Q-38, Q-39 | (a) "Stop uploads, keep work" |
| Q-40 | (a) 3 hours |
| Q-37, Q-41 to Q-45 | The recommended defaults. Q-37 still needs the architect's confirmation in phase 2; Q-45 the scene-developer's measurement |

Recomputed figures at 80%:
| Figure | Was (90%) | Now (80%) |
|---|---|---|
| Refuse at, file storage (of 1,000 MB) | 900 MB | 800 MB |
| Refuse at, database size (of 500 MB) | 450 MB | 400 MB |
| Headroom | about 100 MB, about 6 museums | about 200 MB, about 12 museums (200 / 16 = 12.5, rounded down) |
| Full museums that fit before refusing | about 56 | about 50 (800 / 16) |
| Egress line, only if the app can read it | 4.5 GB | 4 GB |
| Test boundaries, just below / at | 899 MB and 449 MB / 900 MB and 450 MB | 799 MB and 399 MB / 800 MB and 400 MB |

Places changed (counting each separate edit; pure change-log, handoff and Q-row status text counted separately):
- Figures that depend on the threshold, 14 places. requirements.md: FR-104 (b), FR-104 (c), FR-104 (e), NFR-32 (f), A-13, A-38 (6). user-stories.md: US-70 AC-5, US-74 AC-1, AC-2, AC-4, AC-6 (5). Q-36 and Q-37 answer cells in requirements.md section 10 (2). Backlog CR-9 row (1).
- Status and answer text (Q-36 to Q-45 now answered, defaults replaced by answers): requirements.md 10 Q rows, the section 10 intro, the Must-count note (Q-44), NFR-33 (a) lead-in; user-stories.md intros of US-72 and US-74, US-75 AC-6, US-78 AC-4 note, US-79 note, story map row, and the v0.8 change note; backlog iteration 5 table (heading, intro, CR-9 row).
- Version and change-log lines: requirements.md header and change-log row 0.8.1; user-stories.md version line and v0.8.1 note; backlog version line and change-log text.
- Left alone on purpose, as history: the v0.8 change-log row ("thresholds at 90%"), the Q-36 and Q-37 option text (the options the user chose between), "was 90%" notes, and the v0.8.1 change-log rows. US-77 uses 95% storage as its test figure, which is still above the 80% line, so it did not change. US-70 AC-2 and A-35 keep "about 60 museums in 1 GB" because that is plan capacity, not the refusal line.

Search result after editing: the strings "900 MB", "450 MB", "899", "449", "4.5 GB", "about 6 museums" and "90%" now appear only in change-log rows, "was" notes and the Q-36 and Q-37 option text.

## Summary (v0.8, still true except where the A1 update above changes it)
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
- **Space full (changed at A1 to the user's 80%):** stop at 80% of file storage (800 MB of 1,000 MB) or 80% of database size (400 MB of 500 MB), about 12 museums of headroom. (v0.8 draft had 90%, 900 MB and 450 MB, about 6 museums.) Refuse new drafts, new photos and publishes with a photo not yet stored. Allow Visitors, edit page, delete, re-publish with no new file, keep-alive and purge. Resumes by itself. No figures and no limit name are shown to the Creator.
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
None need the user's answer before design. Q-36 to Q-45 are all answered (table in the A1 update above). Two confirmations remain with other agents, neither blocking:
- Q-37 (architect, phase 2): confirm the app cannot read egress without a secret in the browser or GitHub. If it can, FR-104 (e) applies at 80% (4 GB of 5 GB) and US-74 AC-6 repeats AC-1 to AC-5 at that figure.
- Q-45 (scene-developer): measure what head-cover figure is possible for the stacked label; 25% is the working target. If the figure should differ, tell the product-manager to update FR-111 and US-80 AC-5.
- Q-34 (user, from iteration 4) is still open: confirm the 1 GB, 500 MB and 5 GB figures on supabase.com/pricing. The 80% line is applied to whatever is confirmed.

## Requests for other agents
- [open] architect: ADR 0022 section 2 says the keep-alive "reveals nothing"; NFR-33 (c) changes that to exactly one boolean. Update ADR 0022, the `KeepAliveResponse` contract and the success signal for "a purge run completed" (A-41). Decide in phase 2 how storage and database size are read and cached (A-38) and whether egress can be read (Q-37). Confirm where the "space full" refusal is enforced (`create-museum`, `reserve-photo`, `publish`) and its error outcome.
- [open] backend-developer: after the architect's decision, `docs/api.md` section 10a (response gains `purgeHealthy`), section 4 (a distinct "space full" error) and section 11 (REV-5 wording).
- [open] devops-engineer: the guide's "act now" line is 80%, the same as the app's new refusal line (Q-36). Reword it so the owner is not told to act only after the app has already stopped uploads, for example act at 70% or explain that at 80% the app refuses. Also: `docs/deployment.md` line 114 and the "When a limit is reached" table still say "no in-app handling (FR-104 deferred)"; update them with FR-104, and add what a red "purge: unhealthy" run means (US-73 AC-5). The workflow's check must fail on a missing or non-boolean `purgeHealthy`, and the release deploys the function before the workflow.
- [open] ux-ui-designer: space-full message screen (final copy that meets US-75 AC-1 and AC-2, layout for US-76), the finale dock for each reference viewport (Q-43), HUD pill layout at 200% on 320 px (FR-110), stacked label placement (FR-111).
- [open] frontend-developer: check A-39 (photos held in the open page only) and the exact "photos were not kept" notice.
- [open] qa-engineer: map the named DEBT-2 tests to files and projects (US-78); remove the 1 px tolerance and the expected-failure markers for BUG-15 once fixed (US-80); record the strict FR-15 and caption-card U1 timings locally in each Verify phase.
- [open] tech lead: update `docs/project-status.md` (iteration 5 scope and the new IDs); run `npm run format:check` over `docs/requirements/`.

## Verification of the A1 update
| Check | Result | Label |
|---|---|---|
| Searched all three files for "900", "450", "90%", "about 6", "899", "449", "4.5 GB", "100 MB" after editing | Remaining hits are only change-log rows, "was" notes and the Q-36 and Q-37 option text (history) | Verified |
| Every threshold-dependent figure uses 80% (800 MB, 400 MB, 799 and 399 below, about 12 museums, 4 GB) | Read each edited line back through the search | Verified (by reading) |
| Q-36 to Q-45 all marked answered, with who and the date | Edited all ten rows | Verified (by reading) |
| No ID changed or removed | Only text inside existing rows edited | Verified (by reading) |
| Test boundaries consistent: US-74 AC-1 (800 or more, exactly counts) against AC-2 (799 and 399) and AC-4 (799 to 800) | No overlap or gap | Verified (by reading) |
| The "deployment guide's act now line is 80%" claim comes from my own Q-36 text of 26/11/2026; I did not open `docs/deployment.md` | Not checked in the guide | Not verified (devops-engineer to confirm) |
| `npm run format:check` on `docs/requirements/` | No command-line tool | Not verified (tech lead to run) |

## Not done (A1 update)
- `docs/project-status.md` not touched (tech lead owns it); `docs/deployment.md`, `docs/api.md` and ADRs not touched.
- Q-37 and Q-45 confirmations and Q-34 are still with the architect, scene-developer and user.

## Requests received
- [done] from tech lead (26/11/2026, A1): apply Q-36 = 80% across requirements, stories and backlog; record Q-37 to Q-45 answers; bump to v0.8.1 with a change-log line; keep IDs.
- [done] from tech lead: update requirements, stories and backlog for iteration 5, keeping every ID; bump versions to v0.8 with a change-log line each; move the eight items to In progress; handoff note with Verification, Not done and Open questions.
