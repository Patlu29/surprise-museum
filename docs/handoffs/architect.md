# Handoff: architect

## Summary
Integration round 1 (28/10/2026): I synced the architecture docs and root config with what was built. `VITE_API_MODE` is now documented and typed, `npm run check:live` exists, and the backend's `requireLiveBackend()` guard is wired into `vite.config.ts`. Every deviation the tech lead accepted is recorded in architecture v1.1, in amended ADRs 0008 and 0009, and in new ADRs 0014 to 0017. The builder preview seam is confirmed as a second lazy entry point, but loaded by a direct import rather than `import.meta.glob`, and lint now enforces that. The viewport meta has `interactive-widget=resizes-content`, and the chunk-size warning now uses per-chunk budgets, with the lazy HEIC decoder handled on its own.

The earlier architecture and scaffold work (round 0, 27/10/2026) is still in place; its decisions are in ADRs 0001 to 0013.

## Files changed
- `.env.example`: added `VITE_API_MODE` (mock, live or blank) with the rules and the QA and check commands
- `src/vite-env.d.ts`: added `VITE_API_MODE?: string`
- `package.json`: added the `check:live` script (`node supabase/scripts/check-live-config.mjs`); no dependency changes
- `vite.config.ts`: imports and registers `requireLiveBackend()` (build only, enforces only when `VITE_API_MODE=live`); new `chunkSizeBudgets()` plugin (1000 kB per chunk, 3,500 kB for the lazy `heic-to` chunk only while it is not statically imported); Vite's global `chunkSizeWarningLimit` is raised to 3,500 as a backstop
- `eslint.config.js`: `no-restricted-syntax` in `src/ui`, `src/hooks`, `src/App.tsx` and `src/main.tsx` allows only `import('@/scene/Experience')` and `import('@/scene/preview/AvatarPreview')`; relative dynamic imports into the scene and `import.meta.glob` over scene files are errors. A temporary block lowers this to a warning for `src/ui/builder/AvatarPreviewSlot.tsx` only
- `index.html`: viewport meta now includes `interactive-widget=resizes-content`, with a comment
- `docs/architecture.md`: v1.1. Updated sections 1, 2, 4, 5.1, 6.1 to 6.11, 7.3 (now a summary of `docs/api.md`, which wins), 8, 10.3, 10.4, 11, 12 (measured sizes and chunk budgets), 13 (scripts, plugins, viewport, build modes, `VITE_API_MODE`, deploy steps), 14, 15, 16; added 17 (change log)
- `docs/decisions/0008-procedural-stylised-avatars.md`: amended (skinned rig with rigid weights, kit-driven `applyPose`, `AvatarRig` interface, one source for option labels)
- `docs/decisions/0009-linear-procedural-layout.md`: amended (7.5 m entrance, spawns (0, -4.9) and (1.0, -4.5), 65.5 m, same-side test from the wall surface with a 0.2 m margin and line of sight)
- `docs/decisions/0014-camera-composition-and-fading-partitions.md`: new
- `docs/decisions/0015-api-mode-and-persistent-demo-mock.md`: new
- `docs/decisions/0016-automatic-graphics-tier.md`: new
- `docs/decisions/0017-builder-preview-scene-entry-point.md`: new

## Decisions
- **Live guard wired as the backend designed it.** It applies to `vite build` only, and enforces only when `VITE_API_MODE=live`, so dev, ordinary and `VITE_API_MODE=mock` builds are unaffected. Verified results:

  | Command | Exit | Result |
  |---|---|---|
  | `VITE_API_MODE=live npm run build`, no variables | 1 | Lists both missing variables |
  | Live build with a service-role key | 1 | Refused |
  | Live build with a valid URL and publishable key | 0 | Pass |
  | `VITE_API_MODE=mock` build | 0 | Pass |
  | Ordinary `npm run build` | 0 | Pass |
  | `npm run check:live`, nothing set | 1 | Fails |
  | `npm run check:live`, configured | 0 | Pass |
  | Dev server with `VITE_API_MODE=live` | n/a | Serves 200 |

- **`VITE_API_MODE` is typed as `string`, not a union**: the value is not validated at build time, and `getApiMode()` normalises it.
- **Builder preview seam (ADR 0017): confirmed as a second entry point, but via `lazy(() => import('@/scene/preview/AvatarPreview'))`, not `import.meta.glob`.** The glob was only needed while the file did not exist. Now it hides a renamed or missing preview: the build passes and production silently shows "not available in this version". It also skips type checking through a cast. The two entry points share one lazy three.js chunk, and neither is in a first view.
- **Viewport `interactive-widget=resizes-content` applied.** It is sound here because the builder layout uses `dvh` (for example, the 42 dvh preview), so on Chromium and Firefox for Android the keyboard shrinks the preview and keeps fields and sticky actions visible. iOS Safari ignores it. The Visit screen rarely opens a keyboard; if it does, the canvas just resizes.
- **Bundle warning:** the only chunk over 1000 kB is `heic-to` (3,151 kB minified, 792 kB gzipped). It is lazy and intentional (ADR 0004). I did not raise the general limit: a per-chunk plugin keeps 1000 kB for everything else, and gives `heic-to` a 3,500 kB ceiling only while it stays lazy. I tested this by tightening both limits: both warnings fired, and then I restored the values.
- **New ADRs, not only edits**, where a decision really changed: camera and fading partitions (0014), API mode and mock persistence (0015), graphics tier (0016) and the preview seam (0017). The layout and avatar changes are dated amendments to 0009 and 0008.
- **`docs/api.md` is the API contract.** Architecture 7.3 is now a summary that points to it.

## Assumptions
- The tech lead's acceptance of the deviations is final, so the ADRs are marked "Accepted" and not "Proposed".
- `App.tsx` and `main.tsx` follow the same scene-import rules as `src/ui`. They passed lint with no change.
- Bundle figures are gzip level 6 from Node and match Vite's report to within about 1%.

## Open questions
- Do we still need a 7.5 m entrance hall, or would the user rather have a shorter walk to the first picture? The tech lead has accepted 7.5 m; this only matters if the user disagrees. (user)
- `heic-to` is LGPL-3.0, and the chunk is 792 kB gzipped and is downloaded only when a HEIC file fails native decoding. Legal review is still pending (organisation's legal team).
- Supabase plan (free projects pause and have no backups): still open. Questions about plans, pricing or contracts go to the Sales team. (user)

## Requests for other agents
- **frontend-developer:** in `src/ui/builder/AvatarPreviewSlot.tsx`, replace the `import.meta.glob(...)` lookup and the cast with `const LazyPreview = lazy(() => import('@/scene/preview/AvatarPreview'));`, and keep the WebGL, error and "Try again" fallbacks. The "not available in this version" message can then go. Tell me when this is done, so I can delete the transitional block in `eslint.config.js` and the lint warning disappears.
- **qa-engineer:** `playwright.config.ts` runs `npm run build`, which now builds in live mode. Set `VITE_API_MODE=mock` on that command (for example `env: { VITE_API_MODE: 'mock' }` in `webServer`, or the command prefix). Please also check `blob:` photos under the production CSP in Firefox and Safari, and check that the builder keeps fields visible above the Android keyboard (`interactive-widget`).
- **devops-engineer:** the Pages workflow must run `npm run check:live` and then `npm run build`, both with `VITE_API_MODE=live`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from repository variables. Without `VITE_API_MODE=live`, a missing variable produces a site that builds but cannot reach a backend (ADR 0015, architecture section 13). Also add the Deno checks from the backend handoff.
- **performance-optimiser:** the Visit welcome screen is at 111 of 120 kB gzipped (the shared `index` chunk is 82 kB), and the shared three.js chunk is 969 of 1000 kB minified. Please review both before Release 2. Real-device frame times and the graphics-tier thresholds are still unmeasured.
- **backend-developer:** `vite.config.ts` now imports `requireLiveBackend` from `supabase/scripts/check-live-config.mjs`. Please keep that export and its `.d.mts` types stable.
- **technical-artist:** no action needed on `node` types for the drift tests; the `/// <reference types="node" />` directive is fine.
- **ux-ui-designer:** confirmed: the camera numbers in architecture 6.9 v1.0 were starting values. The design spec 3.4 targets now replace them (ADR 0014). Partition walls fade, so the design spec 6.3 occlusion rule now applies to outer walls only. Please reflect that in the spec.
