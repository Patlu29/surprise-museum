# 0003: Supabase backend with Edge Functions as the only data gateway

## Status
Accepted (27/10/2026)

## Context
The user chose Supabase (Sydney) with no custom server. The anon key is public in the static bundle. Requirements: the share token grants read-only access to one museum; the edit token grants update and delete; nobody can list museums or photos; tokens of at least 128 bits; rate-limited lookups; no accounts. Options:
1. RLS policies that read the token from a request header (`current_setting('request.headers')`). This works for tables, but Storage reads and uploads need separate, harder-to-test policies, and the logic spreads over SQL, PostgREST and Storage.
2. Edge Functions as the single gateway, running as `service_role`, with RLS enabled and no policies as a deny-all backstop.

## Decision
- Option 2. Four functions: `create-museum`, `get-museum`, `manage-museum` (action-based) and `purge-expired`.
- Tables in `public` with RLS enabled, **no policies**, and all privileges revoked from `anon` and `authenticated`. Default privileges for future objects are revoked too. Supabase Auth sign-ups are disabled.
- Private `photos` bucket with no Storage policies. Reads use signed URLs (1 h); writes use signed upload URLs (2 h). Both are issued by functions.
- Edit token: 256 random bits. Share token: the first 24 base64url characters of `SHA-256("surprise-museum/share/v1:" + editToken)` (144 bits). Only SHA-256 hashes of tokens are stored.
- Tokens travel in POST bodies, never in URLs. Functions never log bodies.
- Rate limiting uses a Postgres fixed-window counter keyed by a salted IP hash.
- `verify_jwt = false` for all functions, because each authenticates the caller itself and the new publishable keys are not JWTs.

## Consequences
- One place to review and test access control. The public key cannot read or write anything directly.
- Every read pays an Edge Function call (cold start risk on 4G); mitigated by preconnect and region pinning.
- The edit screen can show the share link without the database storing it.
- A leaked share link cannot be rotated independently in the MVP; a future `share_version` in the derivation would allow it.
