# 0017: The builder's avatar preview is the second lazy scene entry point

## Status
Accepted (28/10/2026, integration round 1). Implemented 28/10/2026: the builder now uses the direct lazy import, and the rule is an error everywhere.

## Context
Architecture v1.0 allowed the UI to reach `src/scene` only through `lazy(() => import('@/scene/Experience'))`, so three.js stays out of the first-view chunk (NFR-2, NFR-4). The builder also needs a live 3D avatar preview (FR-15, design spec 9.4), which is a second, separate canvas.

While the scene file did not exist yet, the frontend-developer found it with `import.meta.glob('../../scene/preview/AvatarPreview.tsx')`. That let the builder compile either way, but:
- it bypasses the lint rule (a relative path inside a glob is not an import the rule sees), so it is an undeclared second entry point;
- the module is cast to `ComponentType<AvatarPreviewProps>`, so a props mismatch is not a type error;
- if the file is moved or renamed, the glob matches nothing, the build still passes and production quietly shows "The 3D preview is not available in this version".

The file now exists (`src/scene/preview/AvatarPreview.tsx`, default export), so the reason for the glob has gone.

## Decision
- The UI may load the scene through exactly **two** entry points, both lazily:
  - `lazy(() => import('@/scene/Experience'))`: the museum canvas (Visit and Preview screens);
  - `lazy(() => import('@/scene/preview/AvatarPreview'))`: the builder's preview canvas.
- `src/ui/builder/AvatarPreviewSlot.tsx` uses the direct lazy import above in place of the `import.meta.glob` (done by the frontend-developer, 28/10/2026). The existing fallbacks stay: no WebGL, a render error or a context loss still show the text description and "Try again".
- The props contract stays in `src/state/avatarPreview.ts` (`AvatarPreviewProps`), a layer both sides may import. The scene must not import UI code.
- `eslint.config.js` enforces this in `src/ui`, `src/hooks`, `src/App.tsx` and `src/main.tsx`: any other dynamic import of `@/scene/...`, any relative dynamic import into `src/scene`, and any `import.meta.glob` over scene files are errors. There are no exemptions: the temporary warning-level block for `AvatarPreviewSlot.tsx` was removed on 28/10/2026, once that file switched to the direct import.
- The two canvases are never mounted together (iOS WebGL context limits). The preview lives only on the builder's Characters step; the museum canvas only on the Visit and Preview routes.

## Consequences
- A missing or renamed preview fails the build instead of degrading silently in production, and its props are type-checked.
- Both entry points share one lazily loaded three.js chunk (about 263 kB gzipped), so opening the preview in the builder also warms the cache for the Preview screen. Neither is in the first-view chunk.
- Adding a third entry point needs an update to this ADR and to the lint allow-list, which is deliberate.
