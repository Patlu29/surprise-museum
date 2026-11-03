# Handoff: performance-optimiser

## Summary
CR-4 Phase 5 audit (03/11/2026). The three.js chunk (`finale-*.js`, 988.70 kB) is now two named chunks, `three-*.js` 921.4 kB and `scene-shared-*.js` 66.2 kB, and the bundle guards were updated to match. NFR-27 triangles are signed off (worst character 5,862 of 6,000, identical on Low and High), draw calls are 3 per character and 46 (Low) or 49 (High) for the scene at the entrance, and frame rate is unchanged against the pre-CR-4 build on the M4 GPU. Nothing is verified on a real phone or laptop. Full figures are in `docs/performance.md`, part A.

## Files changed
- `vite.config.ts`: `build.rolldownOptions.output.codeSplitting.groups` names `three` (node_modules: three, react-three-fiber, drei and helpers) and `scene-shared` (our `src/scene/` modules both lazy entry points import, `minShareCount: 2`). The `chunkSizeBudgets` plugin now also warns when `three-*` is over 985 kB, when `three-*` plus `scene-shared-*` is over 1,000 kB, and when no `three-*` chunk exists. Prettier-formatted.
- `.github/scripts/check-bundle-size.mjs` (devops-owned; edited at the coordinator's request to keep it consistent with the new chunk names): limit 985 kB for `three-*`, a combined `three-*` plus `scene-shared-*` limit of 1,000 kB, exit 2 if either chunk is missing. All other limits unchanged. The old header comment about `NameLabel-<hash>.js` is replaced.
- `scripts/perf/micro.mjs` (new): steady-state frame-cost harness (modes `default`, `zoom`, `ceiling`).
- `docs/performance.md`: version 2.0, new part A (CR-4 audit); the original audit is part B with two stale chunk lines pointing at A.3.
- `docs/handoffs/performance-optimiser.md`: this note.

No file in `src/` (scene, shaders, materials, kit, UI, domain), `public/` or `tokens.css` was changed. Nothing was committed, pushed or deployed. `dist/` and port 4173 were not touched: every build went to a scratch folder (`npm run build -- --outDir ...`) and my servers used ports 4195 to 4204 and 4210.

## Decisions
- **Split by module origin, not by feature**: `three-*` holds only node_modules, so its hash changes only on a dependency upgrade (a cache benefit for returning visitors) and its name no longer depends on whichever module Rolldown picks. Alternatives rejected: moving the kit into the Experience chunk (the builder preview also needs it, so it would load the whole visit scene) and cutting features (ruled out).
- **Combined guard at 1,000 kB** (NFR-27's figure for the three.js chunk as it was): without it the split would hide growth, because the vendor chunk alone now has 63.6 kB of apparent headroom. The real headroom is 12.4 kB (987.6 of 1,000).
- **No code optimisation** of the scene, shaders or assets: nothing is over a budget and every change would risk the look.
- **NFR-27 triangle sign-off is on the existing 6,000, with no raise**, so the provisional 6,500 in ADR 0021 7.3a lapses (as the technical-artist already assumed).

## Assumptions
- The coordinator's request to "update the check script" covers editing `.github/scripts/check-bundle-size.mjs`, although `.github/` is devops-owned. The script did not key on a chunk name, but its comment named the old chunk and the new guards need the new names.
- The `three-*` guard of 985 kB is the team's guard (technical-artist handoff, design spec); it is not a requirement. The combined figure is the one that tracks NFR-27.
- Software-GL (SwiftShader) figures are relative fill-cost indicators only. The machine was shared with other agents (load average 10 to 19), so they carry about 10% noise.

## Open questions
- Is the combined 987.6 kB (12.4 kB under 1,000 kB) acceptable as the NFR-27 reading of "the three.js chunk", or does the team want the 985 kB guard to apply to the combined figure (which would need about 3 kB of real code removed, for example the preview-only slimming in "Requests")? (product-manager, architect)
- Does the team want the reference-phone check for the worst-case pair (suit, curly-short, full beard, checks) on Low before release? It is the only open item behind the NFR-27 sign-off. (qa-engineer, product-manager)

## Requests for other agents
- devops-engineer: update `docs/deployment.md` (the Bundle size bullet) and review the script edit above. The CI step `node .github/scripts/check-bundle-size.mjs dist` needs no change.
- architect: `docs/architecture.md` section 12 and the risk table still describe one three.js chunk (`NameLabel-*`); update to `three-*` plus `scene-shared-*`. Amend ADR 0021 7.3a: the 6,500 ceiling lapsed, worst character 5,862.
- scene-developer and technical-artist: optional, for real headroom: a slimmer look-materials factory for the builder preview, which currently builds the finale cone, dust motes, procedural floors and glow-decal shader it never draws (roughly 8 to 12 kB minified in `scene-shared`, builder download only).
- technical-artist: your handoff and `docs/design-spec.md` cite the old chunk name and "guard 985 kB"; point them at `three-*` plus `scene-shared-*`.
- qa-engineer: add the real-device items to the CR-4 run (part 7 of `docs/performance.md`, plus the worst-case pair on Low and the builder preview morph). Three `ceiling.spec.ts` tests still report "expected to fail, but passed" (remove the `test.fail` markers).
- product-manager: NFR-27's text ("about 969 to 971 kB today") is out of date; the figures are 921.4 kB (vendor) and 987.6 kB (with shared scene code).
