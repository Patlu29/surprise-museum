# Handoff: architect

## Summary
QA phase 6 requests (29/10/2026). BUG-5 (`THREE.Clock` warning) is accepted as a third-party warning: no stable `@react-three/fiber` or `@react-three/drei` release removes it, so nothing was upgraded or patched (ADR 0018). `@axe-core/playwright` 4.14.0 is now a pinned devDependency from the public registry. End-to-end tests have their own `tsconfig.e2e.json`: `npm run typecheck` still checks them, `npm run build` no longer does (ADR 0019). Architecture is now v1.2.

Earlier rounds (scaffold on 27/10, integration round 1 on 28/10) are unchanged; their decisions are in ADRs 0001 to 0017 and architecture section 17.

## Files changed
- `package.json`: `build` is now `tsc -b tsconfig.app.json tsconfig.node.json && vite build`; added devDependency `@axe-core/playwright` 4.14.0 (exact)
- `package-lock.json`: `@axe-core/playwright` 4.14.0 and `axe-core` 4.14.0, both resolved from `https://registry.npmjs.org/`
- `tsconfig.e2e.json`: new; `playwright.config.ts` and `tests/e2e`, libs `ES2023`, `DOM`, `DOM.Iterable`, types `node`, same strict flags as the node project
- `tsconfig.node.json`: now `vite.config.ts` only
- `tsconfig.json`: references app, node and e2e
- `docs/decisions/0018-accept-three-clock-deprecation-warning.md`: new
- `docs/decisions/0019-separate-e2e-typescript-project.md`: new
- `docs/architecture.md`: v1.2; sections 2, 11, 13, 15, 16 and 17

## Decisions
- **BUG-5: no upgrade, no workaround (ADR 0018).** Registry check on 29/10/2026:

  | Package | Installed | Latest stable | Newer |
  |---|---|---|---|
  | `@react-three/fiber` | 9.8.2 | 9.8.2 | 10.0.0 alpha and canary only |
  | `@react-three/drei` | 10.7.9 | 10.7.9 | rc and alpha only |

  R3F 9.8.2 creates the store with `new THREE.Clock()`; drei does not use `Clock`. three.js logs the warning from the `Clock` constructor in every build, not only in development. Wrapping `console.warn`, `patch-package` or swapping `THREE.Clock` were rejected: they hide other warnings or patch third-party code for a cosmetic gain. Revisit when a stable R3F uses `THREE.Timer`, with the same gates (all checks pass, three.js chunk under 1000 kB minified).
- **There is no BUG-5 `test.fail` to remove.** The suite already handles it as an allowlist entry (`KNOWN_WARNINGS` in `tests/e2e/support/app.ts`), which is the intended end state. I did not edit tests.
- **`@axe-core/playwright` pinned at 4.14.0**, the `latest` tag; peer `playwright-core >= 1.0.0` is met by 1.64.1. Dev only, not bundled.
- **Separate e2e TypeScript project (ADR 0019).** The build passes an explicit project list instead of a second root config, so `tsc -b` with no arguments (typecheck, editors) still sees everything. `tests/unit` stays in the app project (it shares the `@/` aliases); moving it out is optional later.

## Verification (29/10/2026)
| Check | Result |
|---|---|
| `npm run typecheck` | Pass (app, node and e2e projects) |
| `npm run lint` | Pass, 0 problems |
| `npm test` | 43 files, 556 of 556 passed |
| `npm run build` | Pass. three.js chunk (`NameLabel-*.js`) 968.83 kB minified, unchanged; only `heic-to` is over 1000 kB, as budgeted |
| Deliberate type error in a temporary `tests/e2e` file | `npm run build` passed, `npm run typecheck` failed; file removed |
| `npx playwright test --list tests/e2e/accessibility.spec.ts` | 32 tests listed; `@axe-core/playwright` imports and exports `AxeBuilder` |

The e2e suite itself was not run in this round (QA owns it; the change to the app is nil).

## Assumptions
- QA's "accepted third-party warning" outcome is enough for BUG-5; the bug can be closed as "won't fix, upstream".
- A deploy build should not depend on test code compiling, but CI should still fail on it at the typecheck step, which runs before the build in the deploy workflow.

## Open questions
- None new. Still open from earlier: entrance hall length (user), `heic-to` LGPL review (legal), Supabase plan (user).

## Requests for other agents
- **qa-engineer:** BUG-5 is an accepted third-party warning (ADR 0018). Your `KNOWN_WARNINGS` entry for `/THREE\.Clock/` is the agreed allowlist; please point its comment at ADR 0018 and mark BUG-5 "accepted, upstream" in `docs/qa-report.md`. `@axe-core/playwright` is now in `package.json`, so the header comment in `accessibility.spec.ts` about installing it with `--no-save` is out of date, and the `test.skip` will no longer trigger after `npm ci`. `tests/e2e` now compiles under `tsconfig.e2e.json` with DOM types, so `page.evaluate` callbacks may use them.
- **performance-optimiser:** `docs/performance.md` section 5 calls the `THREE.Clock` warning dev-only; it appears in production builds too. Please correct it and cite ADR 0018.
- **devops-engineer:** keep `npm run typecheck` as a CI step before `npm run build`; it is now the only step that type-checks the e2e tests.
- **scene-developer:** no action. Do not work around the `Clock` warning in `src/scene`.
