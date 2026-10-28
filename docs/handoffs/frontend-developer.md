# Handoff: frontend-developer

## Summary
I built the DOM interface and the shared state for Surprise Museum: the four-step builder with the client-side photo pipeline, publish and edit/delete, the Visitor flow (loading, welcome, HUD with joystick and arrow buttons, Pictures list, caption card placed by a unit-tested `chooseCaptionDock`, full-screen viewer, finale card), every error state, the home screen and legal pages, settings and accessibility plumbing, and self-hosted Fraunces (36 kB). The stores are documented below for the scene-developer; the scene already reads them. `npm run typecheck`, `lint`, `test` (543 tests) and `build` passed on my last full run. All four also pass after integration round 1 (`finaleReached`, Exit preview to Review, shared avatar options, Sales line removed) and round 2 (demo-data controls, demo storage full message, JPEG stripper by identifier). Round 2 re-run: typecheck, lint, build clean; 543 tests in 41 files.

I also ran real-browser checks (Playwright Chromium and WebKit against a production build with a mocked backend, and a mock-mode run through `src/api`). Over 120 checks passed, covering builder, publish, preview, edit/delete, visit, viewer, finale, keyboard, arrow buttons, error screens, and caption placement at 360x640, 390x844, 844x390 and 1280x720.

## Files changed
- `src/App.tsx`, `src/main.tsx`: routes (adds `#/privacy`, `#/terms`), settings effect, announcer, `registerApi()` from `src/api`, test hook `window.__APP_TEST__` (DEV and test builds only)
- `src/state/`: `settingsStore`, `sessionStore`, `museumStore`, `builderStore`, `draft` (pure model and validation), `uploadQueue`, `publish`, `inputState`, `screenRects`, `announcer`, `avatarPreview` (props contract), `safeStorage`; tests alongside
- `src/media/`: `core` (pipeline), `plan`, `encode`, `sniff`, `validate`, `jpeg` (metadata stripper), `canvasEnv`, `processor.worker`, `index`; tests alongside
- `src/hooks/`: keyboard, look controls, caption dock, coaching, announcements, reduced motion, settings-to-`<html>`, builder step in history state, beforeunload, online status, layout, and others
- `src/lib/`: `apiPort` (the `MuseumApi` interface and `ApiRequestError`), text (code points), links, avatars (defaults, labels, descriptions), announcements, contrast, css, layout, in-app browser detection, WebGL detection
- `src/ui/components/`, `overlays/`, `builder/`, `visit/`, `screens/`, `styles/` (components, screens, builder, visit, fonts), `fonts/` (two woff2 files and the OFL licence)
- `src/config/env.ts`: unchanged
- Round 2: `src/ui/components/DemoNotice.tsx` (storage use, Clear demo data, confirmation), `src/ui/builder/PhotosStep.tsx`, `ReviewStep.tsx`, `PublishedScreen.tsx` (notice placement), `src/state/uploadQueue.ts` (413 message, `reuploadAfterDemoReset`, `demoMode`), `src/media/jpeg.ts` and `jpeg.test.ts` (identifier rules), `src/lib/avatars.ts` (pure re-exports), `src/lib/format.ts` and test (`formatBytes`)
- `docs/handoffs/frontend-developer.md`: this note

## Store API (for the scene-developer and QA)

### `useSessionStore` (`src/state/sessionStore.ts`), created with `subscribeWithSelector`
| Field or action | Type | Direction and meaning |
|---|---|---|
| `phase` | `'welcome' \| 'roaming'` | UI sets on Start. Scene: pause input and the Guide while `'welcome'` |
| `sceneReady`, `setSceneReady(b)` | boolean | Scene sets `true` once the entrance and the nearest photos have rendered. UI waits for it after Start. Fallback: if the scene chunk has mounted and 2.5 s pass with no `true`, Start proceeds anyway |
| `sceneProgress`, `setSceneProgress(p)` | `number \| null`, 0 to 1 | Scene publishes asset progress (the UI cannot use drei's `useProgress`) |
| `presentation`, `setPresentation(p)` | `Presentation` | Scene calls from the registry callback. A `'photo'` presentation also marks that photo viewed (A-17). Repeats are ignored |
| `viewed` | `ReadonlySet<string>` | Photo ids viewed. Read only. Cleared by `replay()` |
| `viewerPhotoId`, `openViewer(id)`, `closeViewer()` | `string \| null` | Scene calls `openViewer` on a picture tap (marks viewed). Scene: pause rendering and ignore input while not null |
| `contextLost`, `setContextLost(b)` | boolean | Scene sets on `webglcontextlost`. UI shows the blocking dialog |
| `area`, `setArea({kind, index, count})` | `AreaInfo \| null` | Scene sets on room change. UI announces it, throttled to one per 4 s |
| `cameraOffDefault`, `setCameraOffDefault(b)` | boolean | Scene sets when the camera is more than 20 degrees (or boom) from default. UI shows Reset view |
| `hint`, `setHint(h)` | `HintInfo \| null` | Scene's answer to `hintSeq`: target, `bearingDeg` (0 up, 90 right), `distanceM`, `onScreen`. UI shows the edge arrow and announces it. Clears itself after 6 s |
| `nearFailedPhotoId`, `setNearFailedPhotoId(id)` | `string \| null` | Scene sets when a failed photo is within 6 m. UI shows the Retry chip |
| `finaleReached`, `setFinaleReached(b)` | boolean | Scene sets `true` when the Visitor steps onto the podium (FR-29) and `false` when she leaves it (past r + 1 m). The finale card shows while it is true (a `'finale'` presentation also shows it, so either path works). Keep exploring, Replay and jump set it to `false` in the store; the scene should suppress re-triggering until she leaves the zone. The finale announcement fires once from either path |
| `dismissSeq` | number | UI to scene: end the presentation (Close, Keep exploring, Escape, Enter or Space on canvas) and suppress it until past 4.5 m (finale: r + 1 m) |
| `replaySeq` | number | UI to scene: teleport Visitor and Guide to the entrance and reset the camera. The UI has already cleared `viewed` and runs the fade veil |
| `jump` | `{target, seq} \| null` | UI to scene: stand the Visitor in front of that picture (`{kind:'photo', photoId}`) or on the finale, Guide beside her, camera behind her facing it; then present as usual. Behind a veil |
| `resetViewSeq` | number | UI to scene: camera back to default |
| `hintSeq` | number | UI to scene: compute the nearest unviewed picture (finale when all viewed), glow its frame, call `setHint` |
| `reset()` | action | Fresh session. The UI calls it when a museum screen opens and closes |

Scene reads commands with `useSessionStore.subscribe((s) => s.dismissSeq, listener)` or `getState()` in `useFrame`.

### `useMuseumStore` (`src/state/museumStore.ts`)
`status` (`idle`, `loading`, `ready`, `not-found`, `error`), `source` (`published`, `preview`), `content: MuseumContent`, `urlsExpireAt`, `errorCode`, `photoStatus: Record<id, 'placeholder'|'loading'|'loaded'|'failed'>`, `retryRequest: {photoId, seq} | null`. Scene calls `setPhotoStatus(id, status)` from the photo loader and `refreshUrls()` when signed URLs near expiry (it keeps ids and order and replaces only the URLs). Scene retries a photo from scratch when `retryRequest.seq` changes. `content.title` may be `''`: show `effectiveTitle(title, visitorName)` from `@/state/draft` ("A museum for {name}") on the plaque.

### `useSettingsStore` (`src/state/settingsStore.ts`, persisted in `localStorage`)
`motion` (`system`, `reduce`, `full`), `quality` (`auto`, `low`), `muted`, `captionSize` (`normal`, `large`, `xlarge`), `controls` (`auto`, `joystick`, `arrows`), `joystickSide`. Scene: use `getEffectiveReducedMotion()` (never `motion` alone) and `quality`. `<html data-motion="reduce|full">` and `<html data-caption-size>` are set from it by `useApplySettings`.

### `inputState` (`src/state/inputState.ts`, plain object, not a store)
`move` (camera-relative, length 1 or less, already merged from keyboard, joystick and arrow buttons; y +1 is forward), `orbitRate` (degrees per second from keys and turn buttons; yaw > 0 turns the view right, pitch > 0 raises the camera), `orbitDelta` (degrees from drags, take with `consumeOrbitDelta()` each frame; drag right gives yaw > 0, drag down gives pitch > 0), `zoomDelta` (metres, `consumeZoomDelta()`; positive is further away; 0.4 m per notch). The scene already does this; `Experience` must keep `canvasInput` off or orbit input is applied twice.

### `screenRects` (`src/state/screenRects.ts`, plain object)
Scene calls `publishScreenRects({picture, visitor, guide})` about every 100 ms while a presentation is active (CSS px, viewport coordinates, characters including name labels, `null` when off-screen). The UI ignores rectangles older than 1 s.

### Others
- `useBuilderStore`: draft text, avatars, photos (status, progress, error, object URLs), consent, `editToken` (memory only, never persisted), publish state. Not read by the scene; preview reaches it through `museumStore.setPreview()`.
- `announce(text)` (`src/state/announcer.ts`): anyone may speak through the one polite live region.
- `AvatarPreviewProps` (`src/state/avatarPreview.ts`): the contract for the builder's preview canvas (see requests).

## Decisions
- **Server and client share one `MuseumApi` port** (`src/lib/apiPort.ts`). The backend-developer's `src/api` plugs in through `registerApi()`; with no Supabase variables it uses their in-memory mock, so the whole builder works offline. A "Demo copy" notice shows on the Review and Published screens in mock mode.
- **JPEG metadata is stripped by the client after canvas encoding** (`src/media/jpeg.ts`). See Requests: Safari's own encoder writes APP1 and APP13, which the server rejects.
- **Scene mounts behind the welcome screen** so it loads while she reads; Start is usually instant. The scene wrapper is `inert` until Start.
- **Look and keyboard input are attached to the scene wrapper** (`useLookControls`, `useCanvasKeyboard`) without pointer capture, so R3F picture picking keeps working. The joystick and HUD sit outside the wrapper, so they never orbit.
- **Arrow buttons** (walk four ways, plus turn left and right) are a Settings option ("Controls") and the WCAG 2.5.7 alternative. Default `auto` shows the joystick on touch and nothing on desktop (keyboard).
- **Pictures list** is MVP: bottom sheet in portrait, right drawer otherwise, jump behind a fade veil (token-driven, so a hard cut under reduced motion).
- **"Where next?"** is built on the UI side. If the scene does not answer `hintSeq` within 700 ms, the button opens the Pictures list instead, so it is never a dead button.
- **Caption card placement** uses the maximum size of each dock for the overlap test, which is conservative; the finale card has a taller full size and strip (`tall` input) so its two buttons always show.
- **Reorder** works by dragging the grip (immediately, for mouse and touch, not after a 300 ms long press), by keyboard on the grip, and with Earlier and Later buttons.
- **Exit preview** returns to the Review step, as the design spec says (US-8).
- **Text limits** use code points everywhere (`src/lib/text.ts`); no native `maxlength`.
- **Demo mode UI (round 2).** `DemoNotice` (builder Photos step, Review step, Published screen) renders only when `getApiMode()` is `"mock"`. It shows the storage used from `getDemoDataInfo()` ("43.3 KB of 200 MB used (1 museum, 2 photos), kept in this browser"), refreshed as photos finish, and a **Clear demo data** button that opens an `alertdialog` whose default focus is Cancel. In the builder, clearing keeps the draft and uploads every processed photo again into a new demo draft (`reuploadAfterDemoReset()` forgets the old edit token and photo ids; a draft created before the wipe is never adopted). On the Published screen the dialog warns that the museum just made will be removed too. The same notice also appears on the Photos step so it is next to where a full-storage error happens.
- **Demo storage full (round 2).** The mock's 413 on an upload shows "The demo storage on this device is full. Choose Clear demo data in the demo notice, then your photos will upload again." (`MSG_DEMO_FULL`). A 413 from a live backend instead says the photo is too large (`MSG_TOO_LARGE`), chosen by a `demoMode` dependency in `uploadQueue`.
- **JPEG stripper matches the server by identifier (round 2).** `src/media/jpeg.ts` keeps APP0 only if it is `JFIF\0`, at most 14 bytes, with no thumbnail when 14 bytes; APP2 only if `ICC_PROFILE\0`; APP14 only if `Adobe` and at most 12 bytes. Any other APP0, APP2 or APP14 (JFXX, MPF, a long Adobe block) is dropped, as are APP1, APP3 to APP13, APP15 and COM. `src/api/__tests__/clientCompat.test.ts` passes unchanged, and new unit tests cover each identifier case.
- **Graphics toggle: deferred (round 2).** No manual graphics toggle is built. The Settings "Graphics" control (Auto, Low) stays as it was; adding `'high'` later only means a new option in `settingsStore.quality`.
- **Avatar options have one source of truth**: `src/lib/avatars.ts` now re-exports the defaults (`DEFAULT_GUIDE_APPEARANCE` as `DEFAULT_GUIDE_AVATAR`, likewise for the Visitor) and `describeAvatar` straight from `src/domain/characters/avatarOptions.ts` (the scene-developer's file), builds `AVATAR_LABELS` from the domain label tables, and only adds builder helpers (`optionIds`, `avatarOptionLabel`, `avatarsEqual`, the role and option-key types). The customiser, the review summary and the draft defaults all read from it; a unit test asserts the shared identity. `describeAvatar(config, name)` no longer mentions skin tone (the domain wording is used as is).
- **Home footer**: Privacy, Terms and Report a problem only. The "Sales team" line was removed from the home footer and from the legal pages, because this is a personal gift app (per the coordinator).
- **Fraunces**: `@fontsource/fraunces` 5.3.0, Latin subset, weights 400 and 600 (17.97 kB and 18.10 kB, 36 kB total), in `src/ui/fonts/` with the OFL licence; `font-display: swap`. I did not add the npm package: the two files are copied in, so `package.json` is untouched.
- **Privacy and Terms** pages are short plain-language drafts marked "Draft for review".

## Assumptions
- Closing-message blank means "The end / Thanks for visiting, {name}." (as designed).
- The edit link is never stored; the leave-site prompt stays on the Published screen until the Creator ticks "I've saved my edit link".
- The 20-photo limit counts every row in the list, including failed ones, because the Creator can remove them.
- `rooms = ceil(n / 4)` (1 to 5), copied from ADR 0009, for the hidden scene description only.

## Open questions
- Privacy and Terms wording, and the consent sentence, still need the legal review (legal team).
- None new. (Mock mode only runs in development or when `VITE_API_MODE=mock`; production builds are live, per the backend-developer's round 1 rule, so the "Demo copy" notice never ships in a real deploy.)

## Requests for other agents
- **backend-developer (important)**: Safari and every WebKit browser (all iPhones) write an APP1 "Exif" segment and an APP13 "Photoshop 3.0" segment into canvas-encoded JPEGs, even from a clean canvas. `confirm-photo` rejects any APP1 or APP13, so uploads from iPhones would all fail. I strip them in the browser (`stripJpegMetadata`, verified in Playwright WebKit and against your mock's verifier). Please keep the server rule, and make sure the Deno validator accepts APP0, APP2 (ICC) and APP14, which the client keeps. Please also re-check the live path with real Safari output.
- **scene-developer**:
  - Add `src/scene/preview/AvatarPreview.tsx` (default export, props in `@/state/avatarPreview`). The builder finds it with `import.meta.glob` and shows a text fallback until it exists. It is the second, separate canvas; never mount it with the museum canvas.
  - Make sure `sceneReady`, `sceneProgress`, `area`, `cameraOffDefault`, `nearFailedPhotoId`, `hintSeq` and `contextLost` and `finaleReached` are wired as in the table. `hintSeq` is the only one with no scene code seen yet.
  - Show titles with `effectiveTitle()` (the content title can be `''`).
- **architect**: (1) `index.html`: consider `interactive-widget=resizes-content` on the viewport meta so the on-screen keyboard resizes the builder. (2) `eslint.config.js` forbids `@/ui` imports in the scene, and the UI may only lazy-import `@/scene/Experience`. The builder preview uses `import.meta.glob('../../scene/preview/AvatarPreview.tsx')` with a relative path, which passes lint but is a second scene entry point; please confirm or give another seam. (3) CSP: preview photos from `blob:` URLs loaded under the production CSP in Chromium (no change needed); I could not run Firefox, so please have it checked there.
- **ux-ui-designer**: `base.css` sets `border-radius: inherit` on focused buttons and fields, which takes the parent's radius and squares off a pill button when it gains focus. I override this per control in `src/ui/styles/components.css`; fixing it in `base.css` would let me delete the override. Also the design spec's Release 2 items I built early because they were cheap: settings sheet, hint arrow, progress pill.
- **qa-engineer**: `window.__APP_TEST__` (dev and test builds) exposes `useBuilderStore`, `useMuseumStore`, `useSessionStore`, `useSettingsStore`, `inputState`, `screenRects`, `publishScreenRects`. Not done by me, so please cover: real HEIC files (the lazy `heic-to` chunk is 3 MB, untested on a device), a real 24 or 48 MP iPhone photo, Firefox, VoiceOver and TalkBack, axe on every step and overlay, 200% zoom and 320 px reflow, forced colours, and the unit-test count in `src/state`, `src/media`, `src/ui`, `src/hooks`, `src/lib`.
- **devops-engineer**: the deploy build needs `VITE_API_MODE=live`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see the backend-developer's handoff); without them the app reports `unconfigured`.
- **technical-artist**: the home and not-found illustrations at `public/textures/illustrations/` are picked up automatically (with a built-in frame mark as the fallback if a file is missing).

## Notes and risks
- Running `prettier --write src` once reformatted files in other agents' folders. It only changed formatting (their files already used the same config), but they may see small diffs.
- WebGL is detected up front; a scene that throws on start (or a chunk that fails to load) shows the "This device can't show the 3D museum" screen, with a console message for support.
- The 2D slideshow (FR-60) is Release 2 and is not built.
- Untested: HEIC decoding on a device, Firefox, real iOS Safari (only Playwright WebKit on macOS), screen readers.
