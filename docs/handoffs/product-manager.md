# Handoff: product-manager

Iteration: 4 (Feature and hosting). Phase: 7 Operate and learn. Nothing deployed (user, 23/11/2026: "No deploy yet"); A3 approved as "release with known issues".

## Summary
Requirements and stories are v0.7.1 and the backlog is v0.7.1. Iteration 4 items are Done, review REV-2 is fixed, and QA's "edit" question is settled by changing the wording to "re-publish". The Must count is unchanged at 90.

## Files changed
- docs/requirements/requirements.md: v0.7.1 and change-log row. Q-33 and Q-35 marked answered (a) and (a), 19/11/2026. NFR-16 (d), FR-54 now name the shared not-found screen. FR-105 gets a note: the MVP can only re-publish; editing is Release 2
- docs/requirements/user-stories.md: v0.7.1 and change note. US-27 AC-1 and US-68 AC-2 name the shared not-found screen. US-27 AC-5, US-68 AC-3, US-71 AC-3 say "re-publish" (note that editing is Release 2 and must then behave the same). No ID or AC number changed
- docs/requirements/backlog.md: v0.7.1. CR-5, CR-6, CR-7 Done (iteration 4; not deployed, see V-6 and V-7). CR-8 and CR-10 Done (iteration 4). New rows below
- docs/handoffs/product-manager.md: this note

## New backlog IDs (by the tech lead's item number)
| Item | ID | Priority |
|---|---|---|
| 1 Post-deploy verification (sub-points a to k) | V-6 | Must before launch |
| 2 Q-34 user checks on supabase.com | V-7 | Must before launch |
| 3 Browsers and devices | V-8 (overlaps V-1 to V-4) | Should (Firefox job, Linux baselines Must before CI is trusted) |
| 4 Test stability and CI-only allowances | DEBT-2 | Should |
| 5 Purge-failure alerting | OPS-1 | Should |
| 6 Signed URLs capped at expires_at / purgeHealthy flag / draft end date on edit page | CR-12 / CR-13 / CR-14 | Could |
| 7 REV-13 deno.lock | DEBT-3 | Could |
| 8 Traceability iterations 1 to 3 | DEBT-4 | Could |

Existing open items (BUG-15, N-11 to N-13, LEG-1, CR-9, CR-11, V-1 to V-5, DEBT-1, PERF-1) are unchanged. FR-54 / US-27 stay Should and are not Open backlog items beyond the wording fix.

## Verification
| Check | Result | Label |
|---|---|---|
| Edited text re-read against the quoted REV-2 locations (requirements 173, 336, 450, 452; stories 326) | all five changed | Partly verified (no formatter run; I have no command-line tool, so `npm run format:check` on the three requirements files is for the tech lead) |
| Every item 1 to 8 has a backlog ID | yes | Verified (by reading the file) |
| Iteration 4 rows not left "In progress" | CR-5 to CR-8, CR-10 are Done | Verified |
| Whether CR-5 to CR-7 work in production | not deployed | Not verified (V-6) |

## Correction from tech lead (23/11/2026)
- [done] V-5 marked Done (iteration 4) with the evidence of CI run 44686612364 (20/11/2026) and green required jobs since. Remaining parts point to V-8 (Firefox job), V-4 (Linux baselines) and V-6 (f) (first keep-alive run).

## Decisions
- QA wording: I changed "edit" to "re-publish" in the criteria (US-68 AC-3, US-71 AC-3, and also US-27 AC-5 for consistency) because a tester can then check them as written. The note records that editing is Release 2 and the same rule applies then. FR-105 and NFR-16 (b) keep "editing" as the standing rule.
- CR-5 to CR-7 are Done in the sense "built and checked locally"; the live checks are V-6 and V-7.

## Assumptions
- Priorities on the new items are my suggestions, not user decisions.
- The expired-link screen text is the Q-33 (a) wording in the requirements; I did not check it against `src/` copy.

## Not done
- Q-34 is still open until the user does V-7.

## Open questions
- Q-34 (user, before launch): confirm the free-plan figures; recommendation, do the V-7 checks on supabase.com once.

## Requests for other agents
- [open] qa-engineer: US-68 AC-3 and US-71 AC-3 now say "re-publish"; the re-publish test you ran matches as written. US-68 AC-2 and US-27 AC-1 now expect the shared not-found screen.
- [open] tech lead: run the format check on `docs/requirements/`; update `docs/project-status.md` to show REV-2 done and the new IDs.

## Requests received
- [done] from tech lead: backlog update, REV-2, QA wording question
