# Performance report

Version 1.0 | 28/10/2026 | Owner: performance-optimiser | Build measured: `VITE_API_MODE=mock` production build of the working tree (before = HEAD `5c44153` plus read-only test-hook counters)

## 1. Summary

- The scene was already cheap: about 35 to 45 draw calls and 15,000 triangles for 20 pictures, and a main-thread cost of 1 to 2 ms per frame on the test machine. No frame-rate problem was found on the hardware available.
- The real risks were memory on phones, startup cost and unverified GPU behaviour. Fixes target those: wall-photo GPU memory on the Low tier fell from 79.1 MB to 19.8 MB, welcome-screen JS fell from 111.3 kB to 95.5 kB gzipped in the live build, and time to scene-ready improved by 5 to 10%.
- **No real phone or laptop was available.** Every figure below comes from desktop Chromium on an Apple M4 with CPU and network throttling. The frame-rate, load-time and 15-minute stability targets are therefore **met on proxies and unverified on the reference devices**. Section 7 lists what to test on real hardware.

## 2. Test setup

| Item | Value |
|---|---|
| Machine | Apple M4, 10 cores, 24 GB, macOS (Darwin 27) |
| Browsers | Playwright Chromium 156. **M4 GPU**: new headless mode, ANGLE Metal. **Software GL**: headless shell, SwiftShader (worst case for fill rate, reported separately) |
| Viewports | Phone 390 x 844, device pixel ratio 3 (the scene caps it at 1.5), touch, mobile emulation. Laptop 1280 x 720, ratio 1 |
| CPU throttle | Chrome DevTools `Emulation.setCPUThrottlingRate` 4x and 6x (stress: 12x and 20x). It slows the main thread only, not the GPU |
| Network | 9 Mbps down, 1.5 Mbps up, 170 ms round trip (the 4G profile in the requirements), cache disabled, gzip like GitHub Pages |
| Graphics tier | Forced per run with `window.__SURPRISE_QUALITY__`, because automatic selection picks Low on phones and on SwiftShader |
| Museums | 5 and 20 photos, built through the real builder UI on the mock backend, so the renditions come from the real media pipeline. Source photos were 2000 to 3000 px synthetic images; wall renditions averaged 110 kB (2.2 MB for 20) |
| Photo path | Wall URLs were rewritten to same-origin HTTP so the production `fetch` then `createImageBitmap` path ran (the mock otherwise hands out `blob:` URLs, which take the `<img>` path). Photo transfer was delayed with a 9 Mbps, 170 ms model |
| Walk | Scripted: the Visitor walks to each picture's standing spot in order and lingers 1.7 s, so the Guide presents (11 presentations in 60 s with 20 photos; the requirement is at least 5). Frames counted from `gl.clear` calls, so the 30 FPS cap is measured as rendered frames |
| Counters | `renderer.info` through the test hook (`snapshot().render`: calls, triangles, textures, geometries, programs, plus photo texture bytes added in this audit) |
| Repeatability | Harness is in `scripts/perf/` (see section 8) |

**How to read the frame figures.** Throttling does not slow the GPU, and the M4 is far faster than a phone GPU, so M4 runs show whether the CPU side has headroom, and SwiftShader runs show relative fill-rate cost (the tier and pixel-ratio effects). Neither gives a real phone's frame rate. At 20x CPU throttle on the M4 the Low tier still renders 30 FPS (15% of frames over 36 ms), so the main-thread cost has roughly 20 times headroom on this machine.

## 3. Results

### 3.1 Targets

| Requirement | Target | Result | Status |
|---|---|---|---|
| NFR-1 frame rate, laptop | 60 FPS | 60 FPS steady, p99 18 ms, M4 GPU at 4x and 6x CPU throttle, High tier, 20 photos | Met on proxy. **Unverified on a 2022 laptop** |
| NFR-1 frame rate, phone | 30 FPS | 30 FPS steady, p99 35 ms, M4 GPU at 4x and 6x throttle (also 12x). SwiftShader, Low tier: 29.9 FPS. SwiftShader, High tier: 27 FPS | Met on proxy. **Unverified on iPhone 12 or Galaxy A54** |
| NFR-2 welcome interactive | 5 s or less on 4G | 1.1 s (phone, 6x CPU: 1.2 s) | Met on proxy |
| NFR-3 scene ready | 8 s or less on 4G | 2.0 s (6x CPU: 2.6 s; SwiftShader at 6x: 3.9 s) | Met on proxy |
| NFR-4 first view | Under 10 MB | About 0.45 MB gzipped (JS, CSS, fonts) | Met |
| NFR-5 photo size | 2048 px or less, 600 kB target | Unchanged (renditions are produced by the media pipeline; not in scope) | Not re-audited |
| NFR-6 stability | 15 minutes, 20 pictures, no crash | 15-minute scripted soak (9 route loops, 20 photos, replays): no crash, JS heap 10.7 to 11.2 MB, process memory slope under 1 MB per minute, texture and geometry counts flat. Desktop Chromium only | Met on proxy. **Unverified on iOS Safari and Android** |
| NFR-7 rendering capped, paused when hidden | 30 FPS on mobile | Cap held (30 FPS); desktop now capped at 60 FPS; `requestAnimationFrame` stops in a hidden tab | Met |
| Welcome JS budget | 120 kB gzipped | 111.3 kB before, **95.5 kB after** (live build) | Met, with 25 kB headroom |
| Three.js chunk | 1,000 kB minified | 968.8 kB, unchanged (three.js core and react-three-fiber account for 95%) | Met, still close |

### 3.2 Before and after

Frame figures: M4 GPU unless stated, 20 photos, 60 s walk. "Before / after".

| Metric | Budget | Before | After |
|---|---|---|---|
| Wall-photo GPU memory, Low tier (phones, weak GPUs) | 100 MB (architecture), 128 MB mobile | 79.1 MB | **19.8 MB** |
| Wall-photo GPU memory, High tier | 100 MB | 79.1 MB | 79.1 MB (unchanged) |
| Welcome-screen JS, live build, gzipped | 120 kB | 111.3 kB | **95.5 kB** |
| Index chunk, live build, gzipped | | 80.8 kB | 74.3 kB (demo backend removed from the live bundle) |
| Welcome-screen JS, mock build, gzipped | | 111.4 kB | 103.4 kB |
| First view total, gzipped (JS, CSS, fonts) | 10 MB (NFR-4); 1.5 MB (architecture) | 445 kB | 448 kB (one more, lazy, chunk; live build about 440 kB) |
| Time to welcome, phone, 4G, 6x CPU | 5 s | 1.21 s | 1.25 s (within noise) |
| Time to scene ready, phone, 4G, 1x / 4x / 6x CPU | 8 s | 2.17 / 2.51 / 2.79 s | **2.04 / 2.38 / 2.58 s** |
| Time to scene ready, phone, 4G, 6x CPU, SwiftShader | 8 s | 4.27 s | **3.88 s** |
| Time to scene ready, 5 photos, phone, 6x CPU | 8 s | 2.72 s | 2.50 s |
| Draw calls per frame, 20 photos (median / peak) | 120 (architecture); under 50 mobile (skill) | 35 to 40 / 43 to 48 | 35 to 40 / 43 to 59 (peaks come from the 400 ms cross-fade when a photo arrives; see 5) |
| Triangles, 20 photos | 150,000 | 15,000 | 15,000 |
| Phone Low tier, 4x / 6x CPU: FPS, p99 frame | 30 FPS | 30, 34.9 ms / 30, 35.3 ms | 30, 34.7 ms / 30, 35.3 ms |
| Laptop High tier, 4x / 6x CPU: FPS, p99 frame | 60 FPS | 60, 18.2 ms / 60, 18.8 ms | 60, 18.0 ms / 60, 18.4 ms |
| Phone High tier on SwiftShader, 4x / 6x CPU: FPS | 30 FPS | 21.7 / 19.7 | **27.6 / 26.9** (adaptive pixel ratio stepped 1.5 to 1.25) |
| Phone Low tier on SwiftShader, 4x / 6x: FPS | 30 FPS | 29.9 / 29.9 | 29.9 / 29.9 |
| Laptop High tier on SwiftShader: FPS | 60 FPS | 13.9 | 12.9 (software rasteriser, pixel ratio already 1; not a real-GPU result) |
| Scene frame rate behind the welcome screen | | 30 or 60 FPS (invisible) | 10 FPS |
| Main-thread time per frame, phone Low, 4x CPU | 33 ms | 1.0 to 1.8 ms | 1.0 to 1.7 ms (run-to-run spread is as large as the difference) |
| JS heap, 15-minute soak (early / late) | stable | 10.7 / 11.2 MB | 10.7 / 11.2 MB |
| Process memory slope, 15-minute soak | about 0 | -0.7 MB per minute | +1.0 MB per minute (total 917 to 861 MB; noise, no trend) |

Triangles, draw calls and tier cost were not changed deliberately: they sit well inside the budgets, and merging further would cost the partition fade (ADR 0014) or the per-photo textures.

### 3.3 Memory and disposal

| Check | Result |
|---|---|
| Photo textures (20 photos) | All 20 wall textures are resident within about 4 s of arriving, so memory plateaus at once: 79.1 MB at 1024 px, 19.8 MB at 512 px. There is no growth over time, so eviction was **not** added (it would trade a flat 20 MB for re-downloads and flicker) |
| Texture, geometry and program counts over 15 minutes | Flat: 44 to 46 textures, 70 to 79 geometries, 11 to 21 programs |
| Leave and re-enter the museum 6 times without reloading | Textures and geometries per visit identical every time; process memory stable after the first cycle (970 to 980 MB) before and after |
| `ImageBitmap` release | Fixed: a bitmap whose texture was aborted or disposed before upload is now closed (it was left to garbage collection) |
| Finding, not fixed | Each leave and re-enter adds about 49 retained DOM nodes and 0.4 MB of JS heap (both builds). Harmless at any realistic re-entry count; see section 6 |

Process memory (resident set of the browser tree, about 0.8 to 1.0 GB at rest including about 270 MB for the idle browser) is **not** a useful proxy for GPU texture memory on a unified-memory Mac, so the texture figures above are computed from decoded sizes (width x height x 4 x 4/3 for mipmaps).

## 4. Changes made

Ordered by effect. Files are all under `src/` unless noted.

1. **Photo textures sized to what can show** (`scene/photos/PhotoTextures.ts`, `scene/runtime/graphicsQuality.ts`, `scene/runtime/SceneRuntime.ts`, `scene/SceneRoot.tsx`). On the Low tier each wall rendition is resampled to 512 px on the long edge with `createImageBitmap(..., { resizeQuality: 'high' })` (off the main thread) before upload; High keeps 1024. At the closest the follow camera allows on a phone, a picture is 250 to 350 device pixels on its long edge, so 512 px keeps every mip level it would sample. Compared side by side in the 390 x 844 profile at three pictures, the frames are visually identical. Effect: 79.1 to 19.8 MB GPU memory, and about a quarter of the decode and upload work per photo. The full-screen viewer still loads `full.jpg`. A browser that ignores the resize options just uses the full rendition. The tier is read when each photo decodes, so the late GPU-name refinement does not restart downloads. The preview and mock `<img>` path is resized the same way.
2. **Demo backend removed from live builds** (`api/index.ts`). A production build with `VITE_API_MODE` blank or exactly `live` can never reach the mock (ADR 0015), but its code (mock client, IndexedDB storage, server-rule validators) shipped in the first view. It is now dropped at build time; development and `VITE_API_MODE=mock` builds keep it, and any other flag value keeps it too. Effect: 7.8 kB gzipped off the index chunk, which every route loads.
3. **Post-Start UI in its own chunk** (`ui/visit/VisitExperience.tsx`, new `ui/visit/RoamingLayer.tsx`). The HUD, picture list, help and settings sheets and the full-screen viewer (about 30 kB minified) load once the 3D scene has mounted, so they arrive while she reads the welcome screen. Effect: VisitExperience chunk 14.3 to 6.2 kB gzipped. With change 2 the welcome screen's JS is 111.3 to 95.5 kB.
4. **Scene chunk requested in parallel with the museum** (`ui/screens/VisitScreen.tsx`). The 3D chunk (about 290 kB gzipped) now starts downloading when the Visit route mounts, not after the museum request returns (the lazy import in `VisitExperience` resolves to the same module). Effect: scene-ready 5 to 10% sooner here (the mock adds 150 ms of latency; a real Supabase call is likely longer, so the saving there should be larger but is not measured).
5. **Idle behind the welcome screen** (`scene/Experience.tsx`, `scene/FrameCap.tsx`). The scene renders at 10 FPS until Start (nothing is visible behind the opaque welcome screen, and the main thread is busy decoding and compiling), then at 30 or 60. It still renders, so shaders compile and the nearest photos upload before she taps. Measured 10 FPS at the welcome screen on the SwiftShader run.
6. **Frame cap on every device** (`scene/FrameCap.tsx`, new `scene/runtime/frameGate.ts` with tests). Desktop High used R3F's uncapped loop, which renders 120 or 144 times a second on high-refresh displays. All tiers now run through the cap: 60 on desktop High, 30 on touch devices and Low. The scheduler learns the display's refresh period; an earlier fixed-grid version produced a 50 ms frame every few seconds at a 30 FPS cap on a display a little off 60 Hz, which the 60-second runs caught and the final one fixes (test added). On a 144 Hz display a 60 FPS cap gives about 72 FPS.
7. **Adaptive pixel ratio** (new `scene/AdaptiveDpr.tsx`, `scene/runtime/dprGovernor.ts` with tests, `scene/Experience.tsx`). If a device sits below about 87% of its target frame rate for two consecutive 3-second windows while roaming (after a 6 s warm-up; welcome screen, viewer, hidden tabs and long frames ignored), the pixel-ratio cap drops 0.25, to a floor of 1. It never rises again, so it cannot oscillate. Effect on the software-GL phone High case: 21.7 to 27.6 FPS. Cost: a slow device gets a slightly softer image instead of a low frame rate. The current cap is published as `<html data-render-dpr-cap>`.
8. **Test-hook counters** (`scene/controllers/testHooks.ts`, `scene/photos/PhotoTextures.ts`): `snapshot().render` now also reports geometries, programs, resident photo textures and their estimated bytes. Read-only; used for this report.
9. **Tooling** (new `scripts/perf/`): the harness that produced these numbers.

Not done, with reasons: texture eviction (memory is flat at 20 MB on Low and 79 MB on High, below both budgets); instancing or merging more geometry (draw calls are 35 to 45 against a budget of 120, and further merging would break the partition fade or per-photo textures); `frameloop="demand"` (the scene is never idle: characters breathe and the Guide moves); level of detail (15,000 triangles); lighting or shadow changes (there are no shadow maps); KTX2 or GLB compression (there are no model or texture files; photo renditions are JPEG from the media pipeline); lazy `HomeScreen`/`LegalScreen` (about 2 kB gzipped saving, costs the home route a round trip).

## 5. Findings and tier thresholds

- **High tier costs about 1.8 times the fill cost of Low** in software GL (13.9 against 25.6 FPS at 1280 x 720). It comes from standard (physically based) floor materials, the generated environment map, the finale cone and the dust motes. On a real GPU this is small, but it supports keeping every phone on Low (ADR 0016). The software-GL numbers also confirm that the weak-renderer match (`swiftshader` and others) is doing its job: that case lands on Low, which holds 30 FPS.
- **Thresholds in `graphicsQuality.ts` (phone short side under 700 px, 2 GB or 2 cores, the weak-GPU name list) are unchanged and still unverified on real devices.** In this audit: the emulated phone resolved to Low, SwiftShader to Low, and the M4 to High, as designed. Safari hides the GPU name, so on iPhone the decision rests on the coarse-pointer and short-side rule. The adaptive pixel ratio is the safety net if a threshold is wrong in the other direction.
- **Draw-call peaks of 50 to 59** appear for a few frames when a photo arrives, because the placeholder and the photo are both drawn during the 400 ms cross-fade. The steady figure is 35 to 40. This is above the skill's 50 mobile guide for a moment but far inside the project's 120.
- **Peak frame time**: single frames of 100 to 230 ms appear on software GL (shader compilation and texture upload); on the M4 the worst frame at 4x throttle is 52 ms. Real phones will show upload hitches as photos arrive; 512 px textures make them a quarter the size, but the first-visit hitch has not been measured on a phone.
- **Dev-only noise**: `THREE.Clock` deprecation warning from react-three-fiber (it uses `THREE.Clock` internally). Not ours.

## 6. Remaining issues

| Issue | Suggested fix | Owner |
|---|---|---|
| Re-entering the museum leaks about 49 DOM nodes and 0.4 MB JS heap each time (both builds) | Heap-snapshot a leave and re-enter; likely drei `Html` label roots, `registerCanvasElement`, or a store subscription. Low priority | frontend-developer, scene-developer |
| Three.js chunk 969 of 1000 kB minified | Nothing cheap: three core and react-three-fiber make up 95%. Review again on any three.js or drei upgrade | architect |
| Welcome JS is now 95.5 kB of 120, but `index` (74 kB gzipped) still carries Home, Legal and builder state | Lazy-load the Home and Legal screens if Release 2 adds to the first view | frontend-developer |
| Real-device frame rate, upload hitches, memory and thermal behaviour | Section 7 | qa-engineer |
| Tier thresholds and the weak-GPU name list | Section 7; add a manual "High" toggle if flagship phones should opt in | qa-engineer, frontend-developer |
| `full.jpg` in the viewer is an `<img>` decoded at up to 2048 px, plus pinch-zoom; not measured | Include in the real-device soak (open and close the viewer repeatedly) | qa-engineer |
| Live backend: the parallel scene download is only measured against the mock's 150 ms | Re-measure `time to scene-ready` against Supabase on 4G | devops-engineer |

## 7. Real-device test plan

Devices: iPhone 12 (Safari), Galaxy A54 or similar (Chrome), a 2022 mid-range laptop with integrated graphics (Chrome and Safari or Edge). Use the deployed GitHub Pages build and a 20-photo museum made from real photos.

1. **Frame rate (NFR-1).** 60 seconds of free roaming with at least 5 presentations. Android: Chrome DevTools remote debugging, Performance panel, 4x CPU throttle off. iOS: Safari Web Inspector timelines. Record the High and Low tiers on the laptop (force Low with the settings sheet) and read `document.documentElement.dataset.graphicsQuality` and `.renderDprCap` afterwards: if the cap has dropped, the device was struggling.
2. **Tier decision.** On each device note the graphics tier chosen automatically and the GPU name (`chrome://gpu`; Safari hides it). Confirm phones pick Low and the laptop picks High. On any device that picks High and drops its pixel-ratio cap, add its GPU name to the weak list.
3. **Load (NFR-2, NFR-3).** Cold cache, real or throttled 4G, from tapping the link: time to Start button, and to a rendered entrance with the first picture. Use `?e2e=1` before the `#` to enable `window.__surpriseMuseum.snapshot()` for photo status.
4. **Memory (NFR-6).** 15-minute session: walk the full route four or five times, open and close the full-screen viewer about 20 times, use Replay. iOS: Xcode Instruments (Memory) or watch for tab reload; Android: `chrome://inspect` memory, or `adb shell dumpsys meminfo`. Pass is no reload and a flat trend. Watch the first visit especially for texture-upload hitches as photos arrive.
5. **Thermal and battery.** 10 minutes on the phone; note frame-rate decay and device warmth. Confirm the 30 FPS cap.
6. **High-refresh displays.** On a 120 Hz phone or laptop, confirm the scene runs near 30 or 60 FPS, not 120.
7. **Safari image resize.** On iOS 15 to 17, confirm a Low-tier photo displays correctly and GPU memory is down (the resize options may be ignored, which is safe but loses the saving).

## 8. Repeating these measurements

The harness lives in `scripts/perf/` (Node 22 or later and the Playwright Chromium that `npx playwright install` provides; a working folder defaults to the system temp directory, or set `PERF_DIR`).

```bash
# Build the mock bundle and serve it like GitHub Pages (base path, gzip)
VITE_API_MODE=mock npx vite build --outDir $PERF_DIR/dist --emptyOutDir
node scripts/perf/server.mjs $PERF_DIR/dist 4180 &

# Seed 5 and 20 photo museums through the real builder (writes state5.json, state20.json)
node scripts/perf/genphotos.mjs $PERF_DIR/photos
node scripts/perf/seed.mjs http://localhost:4180/surprise-museum/ $PERF_DIR/photos 20 $PERF_DIR/state20.json $PERF_DIR/seed-fail.png

# Frame time, draw calls and memory on a 60 s walk (--gpu m4 or sw, --quality low or high)
node scripts/perf/frames.mjs --port 4180 --museum 20 --profile phone --cpu 4 --gpu m4 --quality low --live --seconds 60
# Cold load on 4G (welcome, scene ready, bytes before welcome)
node scripts/perf/load.mjs --port 4180 --museum 20 --profile phone --cpu 6 --net 4g --gpu m4 --live --runs 3
# 15-minute soak and leave and re-enter
node scripts/perf/soak.mjs --port 4180 --museum 20 --profile phone --cpu 4 --gpu m4 --quality low --minutes 15 --out $PERF_DIR/soak.json
node scripts/perf/reenter.mjs --port 4180 --cycles 6
# Welcome-screen JS from a build
node scripts/perf/welcomejs.mjs dist
```

`grid.sh` and `loadgrid.sh` run the full matrices used above. The harness measures only what a desktop Chromium can: it is a regression guard, not a substitute for section 7.
