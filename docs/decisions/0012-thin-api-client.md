# 0012: A thin fetch and XHR API client instead of supabase-js

## Status
Accepted (27/10/2026)

## Context
The browser only calls four Edge Functions and uploads to signed URLs. It never queries tables. `supabase-js` would add about 45 kB gzipped to the first view and does not report upload progress, which FR-4 needs.

## Decision
- `src/api` is a small typed client: `fetch` for JSON calls to `/functions/v1/<name>` (with `apikey` and `x-region` headers), and `XMLHttpRequest` `PUT` to signed upload URLs for progress events.
- Request and response types come from `@contract`.
- Edge Functions use `supabase-js` server-side with the service role.

## Consequences
- Smaller first view and upload progress for free.
- The client depends on the Storage signed-upload URL format (`PUT` with `Content-Type` and `x-upsert`); the backend developer must cover it with a test.
- If the browser ever needs Realtime (live mode), add `supabase-js` then, in the lazy 3D chunk only.
