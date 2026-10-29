# 0018: Accept the `THREE.Clock` deprecation warning from react-three-fiber

## Status
Accepted (29/10/2026, QA phase 6, BUG-5). Revisit at the next react-three-fiber release.

## Context
QA found that every museum visit logs `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` in the production console (BUG-5). `docs/performance.md` section 5 had described it as development-only, which is wrong: three.js logs it from the `Clock` constructor through `warn()` in all builds (`three/src/core/Clock.js`, deprecated in r183).

The caller is react-three-fiber. `@react-three/fiber` 9.8.2 creates the root store with `clock: new THREE.Clock()`. drei 10.7.9 does not construct a `Clock`.

Checked on the public npm registry on 29/10/2026:

| Package | Installed | Latest stable | Newer releases |
|---|---|---|---|
| `@react-three/fiber` | 9.8.2 | 9.8.2 (`latest`, 14/10/2026) | 10.0.0 alpha and canary only (major, not stable) |
| `@react-three/drei` | 10.7.9 | 10.7.9 (`latest`) | 10.0.0 rc and 11.0.0 alpha (not stable); drei is not the source anyway |

So no patch or minor release removes the warning. The remaining options were:
- move to R3F 10 alpha: a major, pre-release upgrade of the renderer the whole scene depends on;
- downgrade three.js below r183: loses fixes, and `@types/three` and drei expect 0.186;
- silence it, for example by wrapping `console.warn`, patching the package with `patch-package`, or replacing `THREE.Clock` before R3F loads. Each hides other three.js warnings or patches third-party code for a cosmetic gain.

## Decision
- Keep `@react-three/fiber` 9.8.2 and `@react-three/drei` 10.7.9. Do not hack around the warning.
- Treat the message as an accepted third-party warning. The e2e console collector (`tests/e2e/support/app.ts`, `KNOWN_WARNINGS`) allowlists exactly that one message, with a reference to this ADR, and still fails on any other WebGL, three.js, shader or GLSL warning.
- Upgrade when a stable R3F release replaces `Clock` with `Timer` and is compatible with three 0.186 or later. The upgrade must pass `typecheck`, `lint`, `test`, `build` and the e2e suite, and keep the shared three.js chunk under its 1000 kB minified budget (969 kB on 29/10/2026). Then remove the allowlist entry.

## Consequences
- One warning stays in the production console. It has no user impact: the clock still works, and three.js logs it once per `Clock` created (one per canvas).
- No pre-release or patched dependency in production.
- `docs/performance.md` section 5 should say the warning appears in production builds too (performance-optimiser).
