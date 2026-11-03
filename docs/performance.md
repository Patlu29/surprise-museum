# Performance report

Version 2.0 | 03/11/2026 (2.0: CR-4 audit added as part A; parts 1 to 8 are the original v1.1 audit of 30/10/2026, kept for reference, with the chunk figures superseded by A.3) | Owner: performance-optimiser | Build measured: working tree on top of `19a1dcb` (CR-4 complete), `VITE_API_MODE=mock` production build for the browser runs, live build for the bundle figures

# Part A. CR-4 audit (03/11/2026)

## A.1 Verdicts

| Requirement | Budget | Result | Status |
|---|---|---|---|
| NFR-27 three.js chunk | under 1,000 kB minified; team guard 985 kB for the chunk | The chunk was 988.70 kB (`finale-*.js`, gzip 269.41). It is now two named chunks: `three-*.js` **921.40 kB** (gzip 244.79, three.js, react-three-fiber and drei only) and `scene-shared-*.js` 66.17 kB (gzip 24.53, our avatar kit, look materials and shaders). **The split moves code, it does not remove it**: the two together are 987.57 kB, the same bytes as before (+0.3 kB of chunk wrapper) | Per-chunk guard **met** (63.6 kB under 985). Combined 3D code 987.6 of 1,000 kB: **12.4 kB of headroom, not 63**. See A.3 |
| NFR-27 triangles | at most 6,000 per character (hard stop 5,950) | Worst character **5,862** (curly-short hair, full beard, suit, Guide, skin-10), 138 under 6,000 and 88 under the hard stop. Identical on Low and High (the kit has no tier input). 18,720 geometry builds plus 1,500 random full configurations, none over 5,862 | **Signed off.** No raise is needed, so ADR 0021 7.3a's provisional 6,500 lapses |
| NFR-27 draw calls per character | at most 10 | **3** (body, hair, blob shadow) in every one of the 1,500 random configurations and every per-style worst case | Met |
| Scene draw calls and triangles | under 50 draw calls on mobile (skill), 120 (architecture); 150,000 triangles on mobile | Entrance pose, 20 photos: Low **46** calls, High **49** (pre-CR-4: 45 and 47). 60 s walk, median: Low 32 to 33, High 40; samples up to 43 to 53 (Low) and 46 to 57 (High) while a photo cross-fades (the same peaks as the original audit). Triangles 15,500 to 15,900 (worst-case characters 18,100 to 18,400) | Met. The steady figure is under 50; the cross-fade peaks touch 53 on Low for a few frames, as before |
| NFR-28 frame rate | 60 FPS laptop, 30 FPS phone, Low tier holds 30 | M4 GPU, 20 photos, 60 s walk, CPU throttled 4x and 6x: **30 FPS** phone Low (p99 35.5 and 36.5 ms), **60 FPS** laptop High (p99 18.4 and 18.9 ms), **30 FPS** phone High and laptop Low. Same as the pre-CR-4 build on the same machine | Met **on proxy**. **Not verified on the reference phone or laptop** (A.6) |
| NFR-28 load | NFR-2 5 s, NFR-3 8 s, 4G | Phone, 4G, 4x CPU, M4: welcome **1.14 s**, scene ready **2.34 s** (before the chunk split: 1.14 s and 2.34 s) | Met on proxy |

## A.2 Test setup

| Item | Value |
|---|---|
| Machine and browser | Apple M4, 10 cores, macOS, Playwright Chromium 156. **M4 GPU** (ANGLE Metal) for frame rate; **SwiftShader** (software GL) for relative fill cost. Both as in part 2 |
| Machine load | Other agents were running builds and tests on the same machine during this audit (load average 10 to 19 on 10 cores). Software-GL figures therefore carry about 10% run-to-run noise (the same configuration measured 82 and 95 ms per frame minutes apart). Comparisons below use interleaved runs and medians where it matters |
| Builds | Mock-API production builds served by `scripts/perf/server.mjs` (base path, gzip, like Pages) on ports 4195 to 4204. Port 4173 and the other agents' servers were not touched. The live build (`npm run build`) was used for the chunk and route byte figures |
| Pre-CR-4 baseline | `90204a8` (the commit before the CR-4 kit work), built in a throw-away worktree, same harness, same session |
| Museums | The 20-photo museum from the original audit, seeded through the real builder (it still works with the CR-4 builder). Two worst-case variants made by editing the stored museum document: both characters curly-short platinum hair, full beard, slim Woman, skin-10, suit in cream, heart face, with the **checks** pattern (museum 21) or **plain** (museum 22) |
| Walk, viewport, throttle, tier forcing | Unchanged from part 2 (390 x 844 at pixel ratio 3 for the phone, 1280 x 720 for the laptop, CDP CPU throttle, tier forced with `__SURPRISE_QUALITY__`) |
| Triangles | A Vitest run through the real kit (`createAvatarRig`, `buildBodyGeometry`, `buildHairGeometry`) in Node, not a browser. See A.4 |
| Shader A/B | Four builds of the same tree with the edge call and/or the pattern call removed from `AvatarSurfaceMaterial.ts` (in a throw-away worktree; nothing in the repository was changed) |

## A.3 Bundle

### Cause and fix

`finale-*.js` was the shared chunk Rolldown makes for everything that both lazy entry points (`scene/Experience` and `scene/preview/AvatarPreview`) import: three.js, react-three-fiber and drei (about 920 kB) plus our avatar kit, look materials and shaders (about 67 kB). Its name is only the name of one module in it (`NameLabel-*`, then `finale-*`), and it grew past 985 kB when CR-4 put the finish and the kit work into it (commit `0cf9877` moved 8.4 kB of code out of the Experience chunk into it).

`vite.config.ts` now names two groups (`build.rolldownOptions.output.codeSplitting.groups`):

| Chunk | Contents | Why |
|---|---|---|
| `three-*.js` | `node_modules` only: three, `@react-three/fiber`, `@react-three/drei`, `its-fine`, `react-use-measure`, `suspend-react` | The three.js chunk the NFR means. Its hash changes only on a dependency upgrade, so returning visitors keep it cached across deploys. Both routes that use it fetch it in parallel with `scene-shared` |
| `scene-shared-*.js` | Our `src/scene/` modules imported by both entry points (`minShareCount: 2`) | Code only the visit scene uses stays in the Experience chunk, as before |

A new tiny `extends-*.js` (1.4 kB, a Babel helper) appears as a result. Nothing else moved: every other chunk is unchanged within 0.1 kB.

### Chunks over 100 kB (live build, minified kB, gzip as Vite reports it)

| Chunk | Before | After |
|---|---|---|
| `heic-to-*.js` (lazy, accepted, unchanged) | 3,150.90 (gzip 791.62) | 3,150.90 (791.62) |
| `finale-*.js` (three.js plus kit, materials, shaders) | **988.70** (269.41) | gone |
| `three-*.js` | | **921.40** (244.79) |
| `scene-shared-*.js` (66.17 kB, under 100 kB, listed for the sum) | | 66.17 (24.53) |
| **three.js plus shared scene code** | **988.70** (269.41) | **987.57** (269.32), plus 1.4 kB `extends` |
| `index-*.js` (first view) | 238.24 (76.11) | 238.24 (76.10) |
| `Experience-*.js` | 110.95 (38.57) | 110.96 (38.57) |

### What this does and does not do

- It meets the request: the largest regular chunk is 921.4 kB, and the three.js chunk name is now fixed, so a guard keyed on it no longer moves.
- It does **not** reduce the JavaScript the visit route downloads (next table). **The real NFR-27 headroom is the combined 987.6 kB against 1,000 kB (12.4 kB).** The vendor chunk's 63.6 kB of apparent headroom is not available to our code without the combined figure rising. To stop the split hiding growth, both guards now exist (below), and the combined one fails the CI check.
- Cuts that would give real headroom, none taken (no feature is to be cut): the builder preview calls `createLookMaterials`, which builds the finale cone and dust motes, the procedural floor textures and the glow-decal shader that the preview never shows (`scene-shared`, roughly 8 to 12 kB minified); a slimmer factory for the preview would remove them from the builder's download (not from the visit's). Owner: scene-developer and technical-artist.

### Guards (files changed)

- `vite.config.ts`: `THREE_CHUNK_GROUPS`, plus warnings when `three-*` is over 985 kB, when `three-*` plus `scene-shared-*` is over 1,000 kB, and when no `three-*` chunk exists.
- `.github/scripts/check-bundle-size.mjs` (devops-owned; edited at the coordinator's request to keep it consistent): `three-*` has a 985 kB limit, `three-*` plus `scene-shared-*` must be at most 1,000 kB, and the script exits 2 if either chunk is missing, so a rename cannot turn the guard off silently. Every other chunk is still checked at 1,000 kB (heic-to 3,500). Run on the live build: all pass.

### Initial-load totals (kB gzipped; static closure of the live build, level 9, so Vite's own figures read about 1 to 2% higher)

| Route | What loads | Before | After |
|---|---|---|---|
| Home (`#/`) | `index` and its eight preloaded chunks | JS 89.8; CSS 14.5; one font 18.1 (Fraunces 400) | JS 89.8; CSS 14.5; font 18.1. About 123 kB with the HTML |
| Visit, welcome screen interactive | Home chunks plus `VisitScreen` | JS **97.8** | JS **97.9** (welcome budget 120 kB: met) |
| Visit, scene ready (after the lazy `Experience`, `VisitExperience` and the three chunks) | | JS **402.4** | JS **403.1** (+0.7: chunk wrappers and one more request) |
| Visit, after Start (adds the HUD chunk `RoamingLayer`) | | JS 415.0 | JS 415.7 |
| Builder with the character preview (adds `CreateScreen`, `AvatarPreview` and the 3D chunks; not `heic-to`) | | JS 439.7 | JS 440.5 |
| Measured on the wire, mock build, phone, 4G, 4x CPU, median of 3 | JS before welcome / JS total / all bytes except photos | 105.9 / 423.9 / 474.8 kB; welcome 1,144 ms; ready 2,337 ms | 106.7 / 424.7 / 475.5 kB; welcome 1,143 ms; ready 2,343 ms |

The visit route's 3D download is about 269 kB gzipped; it is fetched after the welcome screen starts to render and in parallel with the museum request, as in part 4.

## A.4 Triangles (NFR-27 sign-off)

### Method

A Vitest run in Node against the real kit (the same code the browser runs; the kit has no graphics-tier input, so Low and High build identical meshes).

1. **Body**: 12 styles x 4 body types x 3 genders x 2 roles (Guide has a badge, Visitor does not) x 2 skins (`skin-01`, and `skin-10`, which adds the deep-skin blush) x 5 face shapes x 4 patterns = **11,520 builds**.
2. **Hair**: 12 hair styles x 5 facial hairs x 3 genders x 2 skins x 4 body types x 5 face shapes = **7,200 builds**.
3. **Invariance**: for each of the 576 body and 1,440 hair groups, the triangle count is the same across every face shape and pattern (0 exceptions), and across the three genders (counts are identical, as the topology is shared). Height scales the root only.
4. **Whole characters**: the worst combination for each style built through `createAvatarRig`, and **1,500 random full configurations** (every field, both roles, all heights and colours): `rig.stats.triangles` equals body + hair + 2 (shadow) from the tables in every case (0 mismatches), the maximum was 5,670 in the random sample, and every one had 3 draw calls.
5. **Browser corroboration** (scene totals from `renderer.info`, 20-photo museum, 60 s walk): replacing both default characters by the worst-case pair adds **2,546** triangles on Low and **2,546 to 2,548** on High. The Node tables predict 2,548 (Guide 5,862 against 4,602; Visitor 5,724 against 4,436). So the Low and High tiers draw the same character meshes.

### Per style (worst body over body types, genders, roles, skins, face shapes and patterns; worst hair 1,660; shadow 2)

| Style | Body, worst | Body, least | Worst character | Under 6,000 | Under 5,950 |
|---|---|---|---|---|---|
| tee-jeans | 3,896 | 3,630 | 5,558 | 442 | 392 |
| hoodie | 3,996 | 3,730 | 5,658 | 342 | 292 |
| shirt-trousers | 4,040 | 3,774 | 5,702 | 298 | 248 |
| dress | 3,940 | 3,674 | 5,602 | 398 | 348 |
| **suit** | **4,200** | 3,934 | **5,862** | **138** | **88** |
| jumpsuit | 3,968 | 3,702 | 5,630 | 370 | 320 |
| sweater | 4,008 | 3,742 | 5,670 | 330 | 280 |
| overalls | 4,056 | 3,790 | 5,718 | 282 | 232 |
| coat | 3,920 | 3,654 | 5,582 | 418 | 368 |
| tracksuit | 4,088 | 3,822 | 5,750 | 250 | 200 |
| cardigan | 3,976 | 3,710 | 5,638 | 362 | 312 |
| tunic | 3,952 | 3,686 | 5,614 | 386 | 336 |

Body worst case is the Guide with `skin-10`; the Visitor is 138 fewer (no badge), and skin-01 to skin-09 are 128 fewer (no deep blush). Body type, gender, face shape and pattern change no count. These figures match the technical-artist's handoff exactly. The default Guide is 4,602 and the default Visitor 4,436.

### Per hair style (hair mesh, with and without the worst facial hair, full beard)

| Hair | None | Full beard | | Hair | None | Full beard |
|---|---|---|---|---|---|---|
| shaved | 488 | 796 | | long-straight | 812 | 1,120 |
| buzz | 488 | 796 | | long-wavy | 838 | 1,146 |
| short-crop | 688 | 996 | | ponytail | 868 | 1,176 |
| side-part | 688 | 996 | | bun | 732 | 1,040 |
| **curly-short** | 1,352 | **1,660** | | afro | 548 | 856 |
| bob | 732 | 1,040 | | braids | 1,260 | 1,568 |

Facial hair adds 112 (stubble), 128 (moustache), 208 (goatee) or 308 (full beard).

### Sign-off

NFR-27's 6,000 triangles per character **holds for every option combination: 5,862 worst, on Low and High**. It is 138 under the requirement and 88 under the technical-artist's 5,950 hard stop, so any further character change has to fit in 88 triangles. The condition in Q-28 (verify a raised figure on the reference phone) does not arise because the figure was not raised. The cost of a triangle on a real phone GPU is not measured (A.6).

## A.5 Draw calls

| Check | Low | High |
|---|---|---|
| Per character | 3 | 3 |
| Scene, entrance pose, 20 photos, 1280 x 720 (Visitor at 0, -3.5 facing the route) | **46** (pre-CR-4 `90204a8`: 45) | **49** (pre-CR-4: 47) |
| Scene, camera above the ceiling (dressing hidden) | 33 | 29 |
| Scene, 60 s walk, 20 photos, phone profile, median / highest sample | 33 / 43 (4x CPU); 32 / 53 (6x CPU) | 36 / 46 (phone); 40 / 57 (laptop) |
| Worst-case characters, same walk | 33 / 43 to 51 | 40 / 50 to 51 |
| Triangles, 60 s walk, median | 15,550 | 15,650 to 15,700 |
| CR-4 added (entrance pose) | +1 call, +1,824 triangles | +2 calls, +1,866 triangles |

- The CR-4 increase is the ceiling dressing (roses, oculus and strips, one mesh, plus one call on High for the contact shadows). Wall caps and the dado rail are merged into the existing `decor` mesh and add nothing. This matches the scene-developer's handoff (+1 Low, +2 High; their default-pose figures of 26 and 29 are for a museum without photos).
- The worst-case-character museum draws the same number of calls as the default one, so option choice does not change draw calls.
- Peaks over 50 (53 on Low, 57 on High) happen only during the 400 ms cross-fade when a photo arrives (placeholder and photo both drawn). They are sampled once a second, so they are lower bounds on the peak. Same finding as part 5, nothing new from CR-4.

## A.6 Frame time and shader cost

### Walk (60 s, 20 photos, 11 Guide presentations, M4 GPU unless stated)

| Case | Pre-CR-4 (`90204a8`) | CR-4, default characters | CR-4, worst-case characters (checks / plain) |
|---|---|---|---|
| Phone, Low, 4x CPU: FPS, p99 | 30, 35.1 ms | 30, 35.6 ms | 30, 35.5 / 30, 35.2 |
| Phone, Low, 6x CPU | n/a | 30, 36.5 ms | n/a |
| Phone, High, 4x CPU | n/a | 30, 35.2 ms | n/a |
| Laptop, High, 4x CPU | 60, 18.3 ms | 59.9, 18.4 ms | 60, 18.3 / 60, 18.3 |
| Laptop, High, 6x CPU | n/a | 60, 18.9 ms | n/a |
| Laptop, Low, 4x CPU | n/a | 30, 35.0 ms | n/a |
| Main-thread script per frame, phone Low, 4x | 0.86 ms | 1.75 ms in the first run, 0.99 ms (phone High) and 1.1 ms in later runs; 2.14 ms at 6x | 0.94 to 1.1 ms |
| Software GL, phone Low, 4x: FPS, p99 | 29.9, 35.4 ms | 29.9, 35.6 ms | 29.5, 50.1 / 28.6, 63.8 |
| Software GL, phone High, 4x | 28.1, 51.7 ms | 27.6, 55.3 ms | 25.1, 92.1 / 23.8, 98.6 |
| Software GL, laptop High | 14.2 FPS | 13.6 FPS | n/a |
| Software GL, laptop Low | 22.5 FPS | 23.7 FPS | n/a |

On the M4 GPU the frame rate is the cap in every case, p99 is within 0.5 ms of the pre-CR-4 build, and the main thread is 1 to 2 ms of a 33 or 16.7 ms frame, so CPU headroom is roughly 15 to 30 times, as in part 2. On software GL the default characters cost the same as before (inside noise), while the worst-case pair costs 5 to 15% more frames per second: those characters have 2,550 more triangles, double-sided curly hair and a full beard, and a software rasteriser pays for vertices. Plain was no faster than checks (28.6 against 29.5 FPS), so the pattern is not the cause. A real GPU is expected to be insensitive to 2,500 triangles; this is the reason for A.8 item 1, not evidence of a problem.

### Shader and ceiling cost (software GL, 1280 x 720, High, Visitor standing still; mean ms per frame)

| Test | Result | Reading |
|---|---|---|
| Edge shader (silhouette band: one `fwidth`, a few ALU operations), both characters filling a large part of the view (camera at the 2.5 m minimum zoom), worst-case outfit with checks | with 84.0 ms (median of 3), without 81.3 (-2.8) | Under 3.5%, inside the run-to-run spread (82 to 95 ms for the same build) |
| Pattern shader, same scene | with 84.0, without 81.8 (-2.3). On plain: 83.0 with, 83.0 without (0) | Under 3%. The plain path returns at the first branch and costs nothing measurable |
| Edge and pattern both removed | 81.7 (-2.3) with checks; 83.3 (+0.3) plain | Same |
| CR-4 against pre-CR-4 at the entrance pose, interleaved, median of 4 | High 73.7 against 70.9 ms (+4%); Low 40.6 against 38.8 ms (+4.6%) | The whole CR-4 look (finish, dressing, edge, pattern) on a fill-bound software rasteriser. Draw calls +2 and +1 |
| Ceiling fade, High: default view, fading (opacity 0.2 to 0.4), camera above | 76.7, 79.5 (+2.8, +3.7%), 74.6 | One alpha-blended quad per room over the view for a short time. Visible in the median, small |
| Ceiling fade, Low | 37.8, 38.1 (+0.3), 36.1 | No measurable cost |
| Main-thread script per frame | 0.4 to 0.6 ms in every state | `CeilingFade` does a few comparisons per frame |

Programs: 14 on Low and 16 on High after the walk (11 to 21 in the original audit). The body and hair patches have constant cache keys, so changing pattern, face shape or style never compiles a new program.

### Not verified

- **No real phone or laptop.** Everything above is desktop Chromium on an Apple M4 (CPU-throttled) or SwiftShader. Throttling does not slow the GPU. The reference phone's fill rate and tile-based GPU behaviour with `fwidth` (derivatives are 2 x 2 quad-based and can cost more on some mobile GPUs), the first-use shader compile of the two patched programs, upload hitches, thermals and the 15-minute soak with CR-4 are **not measured**. The edge and pattern costs above are bounds from a software rasteriser, not predictions for a phone.
- The 15-minute soak (NFR-6) and the leave-and-re-enter checks were **not re-run** for CR-4. Memory per character rose by about 10 kB (the `outfitMask` attribute) and the scene geometry count is 74 to 90, as before.
- Safari, Firefox and WebKit performance. The e2e run on this build (65 desktop-chromium tests: `gender`, `visit-welcome-roam`, `presentation-camera`, `ceiling`) passed apart from three `ceiling` tests that report "expected to fail, but passed" (QA's draft markers).
- The builder preview with both characters on the High tier on a phone (the preview runs its own canvas), and the 250 ms face-shape morph cost (about 1 to 2 ms a frame in Node on the heaviest character, per the technical-artist) on a phone.

## A.7 Changes made

1. **Three.js chunk split into two named chunks** (`vite.config.ts`): see A.3. Bundle guards added to the Vite plugin.
2. **Bundle check updated** (`.github/scripts/check-bundle-size.mjs`): guards for the two chunks, fails if either is missing.
3. **Micro-benchmark harness** (new `scripts/perf/micro.mjs`): steady-state frame cost with the Visitor standing still, in three modes (`default`, `zoom` for shader A/B builds, `ceiling` for the fade).

No change to scene code, shaders, materials, models or textures: nothing needed optimising on the budgets in A.1, and the look is unchanged.

## A.8 Remaining issues

| Issue | Suggested fix | Owner |
|---|---|---|
| Combined 3D code is 987.6 of 1,000 kB, so NFR-27 has 12.4 kB of real headroom; the 985 guard on `three-*` no longer says anything about our code | Keep the combined guard. A slimmer look-materials factory for the builder preview would drop the cone, motes, procedural floors and glow decals from the builder's download (not the visit's) | scene-developer, technical-artist |
| Worst character is 5,862, 88 under the 5,950 hard stop, and the Low tier on a phone GPU is unmeasured | If the reference phone shows a problem, the cheapest cut is hair: curly-short is 1,660 triangles, 664 more than short-crop. Do not add geometry to any character without checking the hard stop | technical-artist, qa-engineer |
| Real-device frame rate, shader cost, soak, upload hitches and thermals for CR-4 | Part 7 (the real-device plan) still applies. Add: the worst-case pair (suit, curly-short, full beard) with checks on the Low tier, and the builder preview morph | qa-engineer |
| `docs/deployment.md` and `docs/architecture.md` (section 12) describe the check script and the chunk by the old rules and names | Update to the two guards and the `three-*` and `scene-shared-*` names | devops-engineer, architect |
| `docs/design-spec.md` row "three.js chunk ... Guard 985 kB" and the technical-artist's handoff cite the old chunk | Point at `three-*` plus `scene-shared-*` | ux-ui-designer, technical-artist |
| Fill cost on software GL is about 4 to 5% higher at the entrance pose than before CR-4 | None needed on the budgets; re-check on a real phone | performance-optimiser |

## A.9 Repeating the CR-4 measurements

```bash
export PERF_DIR=/tmp/surprise-perf   # as in part 8
# Bundle: live build, then the guard
npm run build -- --outDir $PERF_DIR/live --emptyOutDir
node .github/scripts/check-bundle-size.mjs $PERF_DIR/live
# Browser runs: as part 8 (seed, frames.mjs, load.mjs), then the CR-4 micro-benchmarks
node scripts/perf/micro.mjs --port 4180 --museum 20 --mode default --quality high --secs 12
node scripts/perf/micro.mjs --port 4180 --museum 20 --mode ceiling --quality high --secs 15
node scripts/perf/micro.mjs --port 4180 --museum 21 --mode zoom --quality high --secs 15   # worst-case characters
```

Triangle tables: the kit's own budget tests (`gender.test.ts`, `cr4.test.ts`, `kit.test.ts`) assert 6,000 and 3 draw calls over every combination; the per-style tables above came from a throw-away Vitest file with the same builders (`buildBodyGeometry`, `buildHairGeometry`, `createAvatarRig`) and the loops listed in A.4.

---

# Part B. Original audit (v1.1, 30/10/2026)

The parts below are the first audit of the pre-CR-4 build. Where they quote the three.js chunk (968.8 kB) or draw-call and triangle figures, part A replaces them.

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
| Three.js chunk | 1,000 kB minified | 968.8 kB at the time. **Superseded by A.3**: after CR-4 it is `three-*.js` 921.4 kB plus `scene-shared-*.js` 66.2 kB | See A.1 |

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
- **Accepted upstream warning**: `THREE.Clock` deprecation warning from react-three-fiber 9.8.2, which creates a `THREE.Clock` internally. It appears in production builds as well as development (three.js logs it in all builds). Not ours, no user impact; accepted in `docs/decisions/0018-accept-three-clock-deprecation-warning.md`.

## 6. Remaining issues

| Issue | Suggested fix | Owner |
|---|---|---|
| Re-entering the museum leaks about 49 DOM nodes and 0.4 MB JS heap each time (both builds) | Heap-snapshot a leave and re-enter; likely drei `Html` label roots, `registerCanvasElement`, or a store subscription. Low priority | frontend-developer, scene-developer |
| Three.js chunk 969 of 1000 kB minified (CR-4 and this audit: see A.3 and A.8) | Superseded: combined 3D code is 987.6 of 1,000 kB. Review again on any three.js or drei upgrade | architect |
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
