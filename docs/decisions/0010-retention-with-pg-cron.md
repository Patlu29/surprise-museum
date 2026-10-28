# 0010: Retention with pg_cron, pg_net and a purge function

## Status
Accepted (27/10/2026)

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
