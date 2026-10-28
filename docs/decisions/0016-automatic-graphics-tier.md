# 0016: Automatic graphics tier, low on phones and weak GPUs

## Status
Accepted (28/10/2026, integration round 1, accepted by the tech lead).

## Context
The technical-artist's look has two tiers (`src/scene/materials/quality.ts`): `high` (standard materials on floors and brass, a generated environment map, the finale light cone and dust motes, full-size procedural textures) and `low` (Lambert only, half-size textures, none of the extras). NFR-1 asks for 30 FPS on the reference phone. Architecture v1.0 only had a Visitor setting (`settingsStore.quality`: `auto` or `low`) and did not say what `auto` means.

## Decision
`resolveGraphicsQuality(setting, hints)` in `src/scene/runtime/graphicsQuality.ts` (unit-tested):

| Input | Tier |
|---|---|
| Visitor setting `low` | low |
| Visitor setting `high` (not offered in the UI yet; the scene accepts it) | high |
| `auto` on a phone: coarse pointer and a short screen side under 700 px | low |
| `auto` on a weak or software GPU, matched on the unmasked renderer name (SwiftShader, llvmpipe, Mali-4xx and T-series, Adreno 2xx to 5xx, PowerVR SGX, old Intel HD and others) | low |
| `auto` on a device reporting 2 GB of memory or 2 cores or fewer | low |
| `auto` otherwise | high |

- The first render uses device hints, then refines once the GPU name is known.
- Rendering is capped at 30 FPS (`frameloop="never"` with `FrameCap`) on touch devices and in the `low` tier (NFR-7). The pixel ratio is capped at 1.5 on touch devices in both tiers, and at 1 (`low`) or 2 (`high`) otherwise.
- The tier in use is published as `<html data-graphics-quality="low|high">` and in the QA hook `snapshot().quality`. End-to-end tests can force it with `window.__SURPRISE_QUALITY__` (only with `__SURPRISE_E2E__`).

## Consequences
- Every phone gets the cheaper look by default. Recent flagship phones could run `high`, but the gift must hold its frame rate on the Visitor's device, which we do not control. A manual "high" toggle can be added by extending `settingsStore.quality` (frontend-developer) with no scene change.
- Renderer-name matching is a heuristic. Browsers that mask the renderer string fall back to the device hints. The thresholds and the GPU list need checking on real devices (performance-optimiser, qa-engineer).
- Visual QA must cover both tiers.
