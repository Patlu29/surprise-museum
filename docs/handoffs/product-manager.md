# Handoff: product-manager

Iteration: 4 (Feature and hosting: free-tier hosting, 7-day retention). Phase: 1 Plan.

## Summary
Requirements and stories are now v0.7. Retention is 7 days from first publish (NFR-16, Q-5 recorded), FR-54 can only shorten it, and a new Must NFR-32 covers free-tier hosting with keep-alive, guide, limits and capacity. The backlog file now exists. The Must count is 90 (65 functional, 25 non-functional).

## Files changed
- docs/requirements/requirements.md: v0.7. Changed NFR-16, FR-54, NFR-20, NFR-21, A-9, A-13, Q-5, Q-18, section 5 Must count, out of scope, change log. New NFR-32, FR-104 (Could), FR-105 (Must), A-35 to A-37, Q-33 to Q-35
- docs/requirements/user-stories.md: v0.7. Changed US-24 AC-3 and US-27 (rewritten). New US-68 to US-71. Story map and traceability updated
- docs/requirements/backlog.md: new. CR-5 to CR-11, BUG-15, N-11 to N-13, V-1 to V-5, LEG-1, DEBT-1, PERF-1
- docs/handoffs/product-manager.md: this note

## Verification
| Check | Result | Label |
|---|---|---|
| Search of docs/requirements for "90 day", "90-day", "retention", "backup" after edits | Only superseded-decision mentions remain: Q-5 (old decision, 27/10/2026), the v0.7 change log and NFR-16 text, which name 90 days as the old value | Verified (Grep run after the last edits: the only "90 days" mentions are the v0.7 change log, the Q-5 old decision and the stories change note, all naming 90 days as the superseded value) |
| Every Must has a story | NFR-16 had none before; now US-68. NFR-32 has US-69, US-70. FR-105 has US-71 | Verified by reading the traceability table |
| Must count 65 + 25 = 90 | Counted from the NFR table by hand | Partly verified (manual count) |
| Free-plan figures | Third-party, checked 18/11/2026 by the tech lead; not checked on supabase.com by me | Not verified |
| Existing "expired" screen behaviour | `docs/api.md` returns the uniform not-found body for expired museums; I did not see the screen copy in code | Not verified (Q-33) |

## Decisions
- 24-hour purge figure: the hourly job leaves 23 hours for retries. Creator delete is still immediate for the link (FR-52)
- Keep-alive interval at most 3 days (4 days of margin to the 7-day pause)
- IDs: new NFR is NFR-32; FR-104 is the deferred "space full" Could; FR-105 is my added Must for the publish-screen notice
- NFR-20 and NFR-21 (Should) marked not targeted on free tiers, because they would otherwise contradict NFR-32

## Assumptions
- A-35 photo sizes, A-36 keep-alive margin, A-37 free-plan limits (third-party)
- The 5 GB egress is about 300 full visits a month at about 16 MB per visit (my arithmetic)

## Not done
- Nothing from the task is skipped. FR-104 has no story by design (Could, deferred)

## Open questions
- Q-33: after 7 days, show the uniform not-found screen with wording that covers expiry (a, recommended), or a distinct "expired" screen (b)? The API already returns the uniform body. Owner: user
- Q-34: confirm the 1 GB, 500 MB and 5 GB figures on supabase.com/pricing. Default: figures stand, marked "confirm". Owner: user
- Q-35: keep FR-105 (publish screen states the 7 days) as Must (a, recommended), Should (b) or drop it (c)? Owner: user

## Requests for other agents
- [open] architect: amend ADR 0010 (published museums expire 7 days after first publish, purge within 24 hours, no backups); write the keep-alive ADR naming the request (must not call purge, must create nothing)
- [open] backend-developer: change the retention constant from 90 to 7 days and update `docs/api.md`; enforce FR-54 range (earliest now plus 1 hour, latest first publish plus 7 days) if FR-54 is built
- [open] frontend-developer: FR-105 publish-screen text and any hard-coded "90 days" copy
- [open] devops-engineer: keep-alive workflow and the free-tier section in `docs/deployment.md` (US-70)
- [open] qa-engineer: tests for US-68 to US-71; the 24-hour purge check needs a clock-shift or a seeded row

## Requests received
- [done] from tech lead: items 1 to 7 of the iteration 4 Plan task
