# 0019: End-to-end tests are a separate TypeScript project, outside the production build

## Status
Accepted (29/10/2026, QA phase 6)

## Context
`tsconfig.node.json` included `vite.config.ts`, `playwright.config.ts` and `tests/e2e`, and `npm run build` ran `tsc -b` over every project. A type error in a Playwright spec therefore failed the deploy build, although no test code ships. The node project also had no DOM library, so QA had to avoid DOM types even inside `page.evaluate` callbacks, which run in the browser.

## Decision
- New `tsconfig.e2e.json` with `playwright.config.ts` and `tests/e2e`. Libraries `ES2023`, `DOM` and `DOM.Iterable`, types `node`, the same strictness flags as the node project.
- `tsconfig.node.json` now holds `vite.config.ts` only.
- The root `tsconfig.json` references all three projects, so `npm run typecheck` (`tsc -b`) still checks the e2e tests, and CI still fails on a test type error at the typecheck step.
- `npm run build` is `tsc -b tsconfig.app.json tsconfig.node.json && vite build`: it checks the app and the Vite config only.
- `tests/unit` stays in `tsconfig.app.json`. Unit tests share the app's path aliases and are checked in the build. Moving them out is a possible follow-up, not needed now.

## Consequences
- A broken e2e spec no longer blocks a deploy build; it still fails `npm run typecheck` (verified with a deliberate type error in a temporary file in `tests/e2e`: build passed, typecheck failed).
- Specs may use DOM types in browser callbacks.
- Anyone adding a new TypeScript project must add it to the root references, and to the build script only if it is part of the shipped app.
