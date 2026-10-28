# 0015: API mode selection, a live-only production build, and a persistent demo mock

## Status
Accepted (28/10/2026, integration round 1, accepted by the tech lead). Refines ADR 0012 (thin API client).

## Context
`src/api` has two implementations of the `MuseumApi` port: the live client for the Edge Functions and an in-browser mock. The first build chose the mock whenever `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were absent. That made `npm run dev` work with no setup, but it also meant a GitHub Pages deploy with a missing repository variable would publish a "demo" site that looked like it worked and saved nothing online, which would lose a gift without anyone noticing.

The mock also kept data in memory only, so a Creator testing locally could not publish and then open the share link in a new tab or after a reload.

## Decision
**Mode, from `VITE_API_MODE`** (`src/api/mode.ts`, `getApiMode()` in `@/api`):

| `VITE_API_MODE` | Development (`npm run dev`) | Production (`npm run build`) |
|---|---|---|
| `mock` | Mock | Mock (explicit; QA and demos only) |
| `live` | Live | Live, and the build **fails** unless the Supabase variables are usable |
| blank | Live if both Supabase variables are set, otherwise mock | **Always live**. With no variables, every call fails with `unconfigured` |

**Guard** (`supabase/scripts/check-live-config.mjs`, backend-developer):
- `npm run check:live` runs the check as a command; the deploy workflow runs it before the build with `VITE_API_MODE=live`.
- `requireLiveBackend()` is wired into `vite.config.ts` as a second line of defence. It applies to `vite build` only, and only enforces when `VITE_API_MODE=live`, so dev, ordinary and `mock` builds are unaffected.
- It fails when the URL is missing, a placeholder, not `https` or has a path, or when the key is missing, a placeholder, a service-role JWT or an `sb_secret_` key. It lists problems and never prints a value.

**Mock persistence** (`src/api/demoStorage.ts`): IndexedDB (photo bytes as raw bytes, 200 MiB cap), falling back to `localStorage` (3 MiB of photo bytes) and then memory. Each call loads, applies and saves under the Web Locks API where available, so tabs see each other's changes. Museums are keyed by SHA-256 hashes as on the server; no tokens are stored. `clearDemoData()` and `getDemoDataInfo()` are exported from `@/api`. Over the cap, an upload is refused with `server_error` and status 413.

**Contract:** the mock follows `docs/api.md` exactly (same validators, JPEG checks, limits, expiry and uniform `not_found`), except rate limits and the URL formats in `docs/api.md` section 12.

## Consequences
- A misconfigured deploy fails in CI with a plain message instead of shipping a silent demo.
- **QA and preview builds must opt in**: `VITE_API_MODE=mock npm run build`. `playwright.config.ts` (qa-engineer) runs `npm run build` and needs that variable, or the app reports `unconfigured`.
- The guard depends on the deploy workflow setting `VITE_API_MODE=live`. A production build with the variable blank and no Supabase variables still builds (by design, so ordinary local builds work) but cannot reach a backend; `check:live` in the workflow is the main control (devops-engineer).
- Demo data survives reloads and is shared across tabs of one browser profile and origin, so tests that need a clean start must call `clearDemoData()` or use a fresh browser context.
- The IndexedDB backend is unit-tested against a hand-written fake; it still needs a check in real Chrome, Safari and Firefox.
- The mock adds no dependency and lives in the same lazily shared `src/api` code; its bytes ship in production builds but run only in mock mode.
