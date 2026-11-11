# Handoff: product-manager

**v0.6.3 (11/11/2026):** FR-89 accepted-exception class is final. The user accepted, on 11/11/2026, the character outline cases under 3:1 against the linen walls, to keep the dim candle-lit art direction (linen is not lightened; no more fixes proposed). Final class X-1 to X-5, all linen wall, from QA round 7 rows 1 to 13: X-1 torso and arms (2.64 to 2.77); X-2 head, hair sweep (1.77 to 2.46); X-3 afro, braids, curly-short (1.83 to 2.63); X-4 side-part, bun, buzz, ponytail (9 colours), shaved (7 colours) (1.91 to 2.94); X-5 pale long-wavy, long-straight, short-crop (2.75 to 2.97). Former X-6 and X-7 (finale wall) removed; X-6 to X-8 released, not to be reused. FR-89 test conditions now: screen scale 3, canvas pinned at 1.5, first case discarded, 1.0 reported only. Anything outside X-1 to X-5 on any backdrop fails FR-89 (oak, runner, finale wall and floor, trousers everywhere). Changed: FR-89, test conditions, exceptions table, A-34, change log, US-57 (user-stories.md v0.6.3). No Must added or removed (still 64).

## Files changed
- docs/requirements/requirements.md: v0.6.3
- docs/requirements/user-stories.md: v0.6.3 (US-57)
- docs/handoffs/product-manager.md: this note

## Assumptions
- X-2 (head) is accepted for the hair sweep only; the outfit sweep passes (3.13)
- The shaved and ponytail colour lists follow QA's passing exceptions (ponytail black and dark-brown pass; shaved ginger, blonde, grey and blue pass)

## Open questions
- None blocking.

## Requests for other agents
- qa-engineer: encode X-1 to X-5 (linen only) as the only allowed failures in `tests/audit/edge-contrast.mjs`; drop the old X-1 to X-7 encoding; report them as known issues; any other cell under 3:1 fails. Keep the pinned 1.5 method; 1.0 reported only
- technical-artist: no further edge-contrast work for the linen cases; keep the other backdrops at or above the QA round 7 figures
