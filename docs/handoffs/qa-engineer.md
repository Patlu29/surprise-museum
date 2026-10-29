# Handoff: qa-engineer

## Summary
Phase 6 QA on the mock backend. I wrote end-to-end tests for every Must story and the MVP additions, ran them on desktop Chromium, iPhone 13 WebKit and Pixel 7 Chromium (410 passed, 0 failed, 15 expected failures documenting 5 bugs, 25 skipped), added 6 stable visual baselines, axe checks and an Android-keyboard emulation. Firefox is configured but cannot launch inside the agent sandbox, so it is not verified. Real-device items are all listed as not verified. Results and bugs are in `docs/qa-report.md`.

## Files changed
- `playwright.config.ts`: webServer builds with `VITE_API_MODE=mock npm run build -- --mode test`; adds `desktop-firefox`; SwiftShader args; baselines under `__screenshots__/<project>-<platform>/`; `PW_REUSE_SERVER=1` to reuse a server (off by default so a stale live build is never reused)
- `tests/README.md`: how to run, conventions, baseline rules
- `tests/e2e/*.spec.ts` (12 files): builder, visit welcome and roaming, Guide presentations, visit UI, share/edit/delete, home and demo, CSP blob, accessibility, mobile, Android keyboard, visual, journey
- `tests/e2e/support/`: `app.ts` (builder and visit helpers, console collector), `fixtures.ts`, `images.ts` (PNG generator, EXIF splice)
- `tests/e2e/__screenshots__/desktop-chromium-darwin/visual.spec.ts/`: 6 new baselines (first creation, none updated)
- `docs/qa-report.md`, this note

## Decisions
- `--mode test` build: exposes `window.__APP_TEST__` as the frontend handoff describes, without changing the CSP, base path or chunking. Production builds do not expose the stores.
- Known bugs are tests with `test.fail(true, 'BUG-n ...')`: the suite stays green and flags the fix. Remove the line when fixed.
- Time-based checks use the scene's simulation clock, not wall time, because software WebGL is slow.
- `openVisit` always does a fresh page load (via `about:blank`), as the recipient would; hash-only navigation had hidden init-script and state effects.
- Failure states the mock cannot produce are injected into the stores (upload failure, publish failure, open failure).
- `npm install --no-save @axe-core/playwright` was used locally; `package.json` is untouched. The axe spec skips cleanly without it.

## Assumptions
- US-6 AC-3 (Must) outranks FR-12 (Should) when judging BUG-1; product-manager should confirm.
- Playwright `tests/e2e` being type-checked by `tsc -b` (tsconfig.node.json, no DOM lib) is intended, so tests avoid DOM types.
- No sound exists in the MVP, so "no audio before Start" is checked as "no audio or video element".

## Open questions
- BUG-1: restore the whole draft (needs IndexedDB for photos) or only text and avatar choices? (product-manager, frontend-developer)
- N-2: is the Visitor covering part of the picture while presented intended? (ux-ui-designer)

## Requests for other agents
- frontend-developer: fix BUG-1 (draft and avatar persistence), BUG-2 (viewer Try again closes on pointer), BUG-3 (`aria-controls` to a missing id on the Guide and Visitor tabs), BUG-4 (HUD top row overflows at 412 px; Help cut off). Then delete the matching `test.fail` lines.
- ux-ui-designer: advise on the HUD breakpoint for BUG-4 and confirm N-2.
- architect: add `@axe-core/playwright` as a devDependency (root config is yours), so the accessibility spec runs in CI. Note BUG-5 (`THREE.Clock` warning in production, library) for the next three or r3f upgrade. Note tests are type-checked in `npm run build`, so a broken test breaks the deploy build; consider a separate `tsconfig` for `tests/e2e` if that is not wanted.
- devops-engineer: CI must run `npx playwright install --with-deps chromium firefox webkit`, and the visual baselines need a Linux set made in the same container image (current ones are macOS). Run `desktop-firefox` there, since it could not run here.
- scene-developer: confirm that the app never calls `readPixels` itself (note N-1), and the label-behind-wall behaviour (US-10 AC-3) is only unit-level today.
- performance-optimiser, devops-engineer: the performance.md section 7 real-device plan, HEIC and 24 or 48 MP photos, VoiceOver and TalkBack, and a real Android keyboard check are still to be done on devices.
