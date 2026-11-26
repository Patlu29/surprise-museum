# 0010: Retention with pg_cron, pg_net and a purge function

## Status
Accepted (27/10/2026). Amended 18/11/2026 for NFR-16 v0.7 (published museums last 7 days, purge within 24 hours, no backups); see the amendment below. The mechanism is unchanged. Amended 26/11/2026 (Proposed, awaiting A2): the purge records its own success for the keep-alive's purge-health flag (ADR 0023); see the second amendment at the end.

## Context
NFR-16: museums stay available for at least 90 days from publishing, and deleted or expired content leaves live storage within 7 days. Deleting a museum must break the share link immediately (FR-52). Storage objects must be deleted through the Storage API, not by deleting rows from `storage.objects`.

## Decision
- `expires_at` on every museum: drafts 7 days after creation, published museums 90 days after first publish.
- A `pg_cron` job runs hourly and calls the `purge-expired` Edge Function with `pg_net`, sending a secret header read from Supabase Vault.
- The function deletes expired museums through `delete_museum_rows` (which also queues the storage prefix) and drains `storage_purge_queue` by removing objects with the Storage API.
- The Creator's delete removes rows at once and objects in the same request, with the queue as a fallback.
- A second hourly job prunes old rate-limit rows.

## Consequences
- Purge is well within the 7-day window, and failures retry automatically.
- Setup needs two Vault secrets and one function secret, created by hand once (documented in `supabase/README.md`).
- Purge depends on the project being active; a paused free-tier project also pauses the job.

## Amendment (18/11/2026): 7-day retention, 24-hour purge, no backups

### What changed in the requirement
NFR-16 v0.7 (user decision 18/11/2026, "one week promise"; Q-5):

| Clause | Before | Now |
|---|---|---|
| Published museum lasts | At least 90 days from publishing | **7 days (168 hours) from its first publish**. Re-publishing or editing does not extend it |
| Draft lasts | 7 days from creation | Unchanged |
| Deleted or expired content leaves live storage | Within 7 days | **Within 24 hours** of the delete or of the end of the 7 days |
| Backups | Follow the Supabase plan, at most 30 days | **None.** The Supabase Free plan has no backups (NFR-16(f), NFR-32) |
| After the end | (not stated) | The link shows no content and the uniform not-found screen (Q-33 (a), the user's decision at the A2 design approval, 19/11/2026) |

### Decision
The mechanism stays exactly as decided above. Only the published retention value changes, from 90 to 7 days. It is one constant, `LIMITS.retentionDays` in `supabase/functions/_shared/contract.ts`, which `manage-museum` passes to `publish_museum(p_retention_days)` and which the browser (`LegalScreen`, the demo mock) also reads.

| Rule | How the existing design meets it | Evidence |
|---|---|---|
| 7 days from **first** publish | `publish_museum` sets `published_at = coalesce(published_at, now())` and sets `expires_at = now() + p_retention_days` only when `published_at` was null | `supabase/migrations/20261027000110_functions.sql`, the `update public.museums` statement |
| Re-publishing never extends it | The same `case` keeps `m.expires_at` when the museum was already published | Same statement; `flow_test.ts` "does not extend retention"; `mockClient.test.ts` "does not extend retention when re-publishing" |
| Drafts last 7 days from creation | Column default `now() + interval '7 days'` and `LIMITS.draftRetentionDays = 7` in `create-museum` | `20261027000100_initial_schema.sql`; `create-museum/handler.ts` |
| No content from the end of the 7 days | Every lookup filters `expires_at > now()` at request time, so an expired museum returns the uniform 404 at once, before the purge runs | `supabaseBackend.ts` (`.gt('expires_at', now)` in both finders); `docs/api.md` "Who sees what" |
| Out of live storage within 24 hours | The hourly job (minute 17) deletes the rows and the objects in the same run, so normally within 60 minutes of the end. A failed storage delete stays on `storage_purge_queue` and is retried every hour, which leaves 23 further attempts inside the 24 hours. Each run handles up to 100 expiries and 100 queue entries (2,400 a day), far above the about 60 full museums that fit in the free storage (NFR-32 (e)) | `20261027000200_retention_schedule.sql`; `purge-expired/handler.ts` (`BATCH_SIZE = 100`) |
| Creator delete | Rows gone at once (link 404), objects removed in the same request, queue as fallback. Unchanged | `delete_museum_rows` |
| No backups | Nothing in the design copies content outside the live database and bucket. The Free plan offers no backups, so no backup purge window exists. If backups are ever enabled, NFR-16 must be revised first | NFR-16(f). Not verified on the Supabase dashboard (Q-34) |
| Purge needs an active project | A paused project stops pg_cron. The scheduled keep-alive in ADR 0022 keeps the project active | ADR 0022 |

**No SQL default or migration hard-codes 90.** `publish_museum` takes `p_retention_days` and the draft default is 7 days. Two migration **comments** still mention the old figures (90 days, and the 7-day purge window) and must be corrected; they change no behaviour. Nothing is deployed, so the comments are edited in place, no new migration is needed for retention, and **no data migration is needed for existing rows** (there are none: no Supabase project exists yet).

### Every place that must change

| # | File and line (18/11/2026) | Today | Change to | Owner |
|---|---|---|---|---|
| 1 | `supabase/functions/_shared/contract.ts:51-52` | `retentionDays: 90` with comment "Days a published museum stays available (NFR-16)." | `retentionDays: 7`, comment "Days a published museum stays available from its first publish (NFR-16 v0.7). Re-publishing never extends it." `CONTRACT_VERSION` stays 1 (no field changes shape or meaning) | backend-developer |
| 2 | `supabase/migrations/20261027000100_initial_schema.sql:59` | Comment "Published: first publish + 90 days (NFR-16)." | "Published: first publish + LIMITS.retentionDays (7 days, NFR-16 v0.7), passed to publish_museum." | backend-developer |
| 3 | `supabase/migrations/20261027000200_retention_schedule.sql`, comment above `surprise-museum-purge` | "Hourly (not daily) so a failed storage delete is retried well inside the 7-day window." | "...well inside the 24-hour window (NFR-16 v0.7: 23 retries after the first attempt)." | backend-developer |
| 4 | `supabase/functions/purge-expired/handler.ts:3` | Comment "(drafts after 7 days, published after 90)" | "(drafts 7 days after creation, published museums 7 days after first publish)" | backend-developer |
| 5 | `supabase/functions/tests/purge_test.ts:36-90` | Publishes at day 0, expects the draft purged and the published museum still live at day 8, then gone at day 91 | **Fails with 7 days**: both expire by day 8. Publish the live museum on day 3 (expires day 10): at day 8 expect `purged: 1` and the share link 200; at day 10 plus 1 second expect 404 before purge, then `purged: 1` and no rows or objects. Rename to "...published museums 7 days after first publish" | backend-developer |
| 6 | `supabase/functions/tests/flow_test.ts:99` | `90 * 86_400_000` | `LIMITS.retentionDays * 86_400_000` | backend-developer |
| 7 | `supabase/functions/tests/flow_test.ts:261` | `app.advance(91 * 86_400_000)` | Still passes. Change to `8 * 86_400_000` so the comment "an expired museum behaves the same" reflects the new life | backend-developer |
| 8 | `src/api/__tests__/mockClient.test.ts:251` | `.toBe(90 * 86_400_000)` | `.toBe(LIMITS.retentionDays * 86_400_000)` | backend-developer (owns `src/api/`) |
| 9 | `src/api/__tests__/mockClient.test.ts:298-311` | Publishes at day 0, expects the museum live at day 8 | **Fails with 7 days.** Publish on day 3 (or advance 6 days instead of 8 for the live check), then expect 404 after day 10. Rename "...after 7 days from first publish" | backend-developer |
| 10 | `src/api/__tests__/mockClient.test.ts:314-323` | Re-publishes 10 days after the first publish | **Fails with 7 days**: the museum has expired, so publish returns `not_found`. Re-publish on day 3 | backend-developer |
| 11 | `docs/api.md` lines 117, 377-378 (example `expiresAt`), 389, 437, 448 | 90 days | 7 days (full list in the handoff and `docs/architecture.md` section 8.1) | backend-developer |
| 12 | `supabase/README.md:45` | "Choose the plan. Free-plan projects pause..." | The Free plan is the decision (NFR-32); the keep-alive (ADR 0022) prevents the pause; no backups | backend-developer |
| — | `src/ui/screens/LegalScreen.tsx:55, 91` | Reads `LIMITS.retentionDays` | No edit: shows "7 days" once item 1 lands | frontend-developer (check only) |
| — | `src/api/mockClient.ts:519`, `supabase/functions/manage-museum/handler.ts:275`, `_shared/testing/memoryBackend.ts:172`, `_shared/supabaseBackend.ts:200`, `_shared/ports.ts:47` | Read the constant or the parameter | No edit | — |
| — | `supabase/migrations/20261027000110_functions.sql` | `p_retention_days` parameter, no literal | No edit | — |

Found with `grep -rnE "retentionDays|retention_days|90 days|90-day|90 day|days => 90|interval '90"` and a search for `86_400_000` in the test folders, 18/11/2026.

### FR-54 (Should, not built)
A Creator-set expiry is not built in this iteration. When it is, it may only lower `expires_at`: accept a time `t` with `now + 1 hour <= t <= published_at + LIMITS.retentionDays`, store `least(expires_at, t)`, and never raise it. The purge needs no change.

### Consequences of the amendment
- Purge is within the 24-hour window with 23 retries; a storage failure that lasts more than 23 hours breaks NFR-16(e). Nothing alerts on it today; the deployment guide tells the user how to read the job history (`cron.job_run_details`) and the function results (`net._http_response`, kept for about 6 hours) (devops-engineer).
- Signed photo URLs issued just before the end stay valid for up to 1 hour (`LIMITS.signedUrlTtlSeconds`), and objects are deleted at the next purge run (at most about 60 minutes after the end). A Visitor who already had the museum open can therefore still load a photo for up to an hour after the end. Opening the link after the end shows nothing (US-68 AC-2 is met). Capping the URL lifetime at `expires_at` is an open question in the architect's handoff.
- A paused project stops purge, so expired photos would stay in storage until it is restored. ADR 0022 is the control.
- Nothing is deployed, so no existing museum keeps a 90-day `expires_at`.

## Amendment (26/11/2026): the purge records its own success (ADR 0023)

Status: Proposed, awaiting the user's design approval (A2) for iteration 5.

**Why.** NFR-33 (Should, user decision 26/11/2026) asks the keep-alive to report whether the purge is keeping up. A pg_cron "succeeded" row only shows that `invoke_purge_expired()` queued the HTTP call (A-41), so the purge must leave its own signal.

**What changes in this ADR's mechanism.** Only the last step of a run. The schedule (minute 17, hourly), the pg_net call, the secret, the batch size, the queue and the response `{ purged, retried, failed }` are unchanged.

| Item | Before | Now |
|---|---|---|
| End of a `purge-expired` run | Answers 200 | Calls `public.record_purge_success()` (upserts the one row of `public.purge_heartbeat` with Postgres `now()`), then answers 200 |
| What counts as a successful run | (not defined) | The run passed the secret check, expired its batch, went through the queue and reached the heartbeat call. A run with `failed > 0` still counts: failed deletes show up in the keep-alive's queue-age condition instead |
| A run that throws | 500 | 500, and no heartbeat is written |
| Who writes the heartbeat | (none) | Only the purge. The keep-alive reads it and never writes |

**Consequence replaced.** The 18/11/2026 consequence "Nothing alerts on it today" no longer holds once ADR 0023 ships. A storage delete stuck for more than 3 hours, an expiry more than 3 hours overdue, or no successful run in 3 hours makes the next daily keep-alive answer `purgeHealthy: false` and turns its run red (NFR-34). Detection is daily (A-42).

