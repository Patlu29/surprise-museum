# End-to-end tests (Playwright)

Owner: qa-engineer. Results and bugs: `docs/qa-report.md`. Handoff: `docs/handoffs/qa-engineer.md`.

## Run

```bash
npx playwright install chromium firefox webkit        # once
npx playwright test                                   # all projects
npx playwright test --project=desktop-chromium        # one project
npx playwright test visit-guide -g "US-12"            # one file or story
PW_REUSE_SERVER=1 npx playwright test                 # reuse a server already on :4173
npx playwright show-report                            # HTML report
```

`playwright.config.ts` builds with `VITE_API_MODE=mock npm run build -- --mode test` and serves the
build with `vite preview` under `/surprise-museum/`. Everything runs against the in-browser demo
backend (IndexedDB). Nothing calls Supabase. `--mode test` only adds `window.__APP_TEST__` (the
stores); the production CSP, minification and base path are unchanged.

Projects: `desktop-chromium`, `desktop-firefox`, `mobile-webkit` (iPhone 13), `mobile-chromium`
(Pixel 7). Chromium runs with SwiftShader (software WebGL), so frame rates are never measured here.

## Layout

| File | Covers |
|---|---|
| `builder.spec.ts` | US-1 to US-8, US-22, US-29 |
| `visit-welcome-roam.spec.ts` | US-9, US-10, US-11, US-15, US-17 |
| `visit-guide-presentations.spec.ts` | US-12, US-13, US-14, US-42, US-32 (reduced motion) |
| `visit-ui.spec.ts` | US-16, US-30, US-31, US-33, US-34, US-35, US-43, US-44, arrow buttons (WCAG 2.5.7) |
| `share-edit-delete.spec.ts` | US-23, US-24, US-25, US-30 AC-4 |
| `home-and-demo.spec.ts` | Home, footer, demo-storage notice |
| `csp-blob.spec.ts` | `blob:` photos under the production CSP (every browser project) |
| `accessibility.spec.ts` | axe (WCAG 2.2 AA), keyboard-only visit, focus visibility, reflow |
| `mobile.spec.ts` | Touch controls, phone layout, pinch zoom |
| `android-keyboard.spec.ts` | `interactive-widget` and the builder with an emulated keyboard |
| `visual.spec.ts` | Six stable screenshots (desktop Chromium only) |
| `support/` | Image generator, builder and visit helpers, fixtures |

## Conventions

- Test titles start with the story and criterion, for example `US-12 AC-1: ...`, so the QA report can
  map results back.
- The scene is tested through `window.__surpriseMuseum` (opted in with `?e2e=1` before the `#`), in
  simulation time (`snapshot().time`), not wall-clock time.
- `openVisit` always does a fresh page load, as the recipient would.
- `test.fail(true, 'BUG-n ...')` marks a known product bug. The suite stays green, and goes red
  ("expected to fail but passed") when the bug is fixed. Remove the `test.fail` line then.
- `tests/e2e` is type-checked by `tsc -b` (tsconfig.node.json, no DOM lib). Browser-side code reaches
  the page through `globalThis as unknown as PageGlobals`.

## Visual baselines

Stored in `tests/e2e/__screenshots__/<project>-<platform>/`. They were created on macOS with
desktop Chromium and software WebGL, so compare only on the same platform (CI needs its own set,
made in the same container image that CI uses). Never run `--update-snapshots` to make a failing run
pass. A failure is a visual change: look at the diff in the HTML report, decide whether it is
intended, and record the reason in `docs/qa-report.md` before updating.
