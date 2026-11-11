# Handoff: product-manager

**v0.6.2 (11/11/2026):** BUG-18 decisions recorded. FR-89 is measured at pixel ratio 1.5 (1.0 is a reported stretch case); new "Test conditions for FR-89" (pin the ratio, drop the polluted first case); X-1 to X-8 redefined as a provisional accepted class (torso, arms and head vs linen; afro, braids, curly-short hair vs linen and finale wall), final list to come from QA's re-test after fix round 2. IDs changed: FR-89, X-1 to X-8, A-34, US-57. Open: X-6 (afro and braids on the finale wall) has no separate measurement; X-8 is reserved and unused. Requests: qa-engineer to pin the ratio and re-test; technical-artist to supply per-case figures for X-6.

**v0.6.1 (03/11/2026):** NFR-27 now reads "three.js chunk" as `three-*.js` (921.4 kB) plus `scene-shared-*.js` (66.2 kB) = 987.6 kB against 1,000 kB (12.4 kB spare, accepted by the tech lead); the old 969 to 971 kB and 988.70 kB figures are superseded, so the first open question below on 988.70 kB is closed. Builder-preview material slimming (about 8 to 12 kB) is a follow-up, not a blocker. Changed `requirements.md` (header, change log, NFR-27) and `user-stories.md` (header, US-61 criterion). The performance-optimiser and QA should measure the combined figure.

## Summary
Requirements and user stories are now v0.6 (03/11/2026). The five tech-lead decisions from the CR-4 build are recorded: NFR-27 stays at 6,000 triangles (no raise), FR-80 allows a two-sentence description, FR-88 is deferred, a new Should (FR-103) covers face shape and pattern in the live character description, and eight known minor FR-89 edge-contrast cases are recorded as accepted exceptions. No Must was added or removed (still 64).

## Files changed
- docs/requirements/requirements.md: v0.6 header and change-log line; FR-80 reworded; FR-88 deferred (Won't, was Could); FR-89 points to the accepted-exceptions table; new "Known accepted exceptions to FR-89" table (X-1 to X-8); new FR-103 (Should); NFR-27 (6,000 stays, 5,862 measured, 6,500 lapsed, chunk measured 988.70 kB); A-25, A-29 and Q-28 updated; new A-34
- docs/requirements/user-stories.md: v0.6 header; US-51 (two sentences); US-56 (FR-88 deferred); US-57 (accepted exceptions); US-63 and US-64 (one Should criterion each for FR-103, titles updated); story map and traceability updated
- docs/handoffs/product-manager.md: this note

## IDs changed
| ID | Change |
|---|---|
| NFR-27 | Decision 1. Triangle limit stays 6,000 per character, 10 draw calls. Worst measured 5,862 (art hard stop 5,950). ADR 0021 7.3a provisional 6,500 lapsed (7.3a step 5). Performance-optimiser still verifies. Also records the three.js chunk at 988.70 kB (11 kB headroom, not 30 kB) |
| Q-28 | Marked closed: no raise needed |
| A-29 | Notes that all options fit the 6,000 budget, trimming order kept only as a standby |
| FR-80 | Decision 2. "a one-sentence description" became "a short description of no more than two sentences". Kept as Should and testable (count of sentences, visible without scrolling at 360x640 and 1280x720). US-51 changed to match |
| FR-88 | Decision 3. Deferred: priority Won't (was Could), "not built, not tested, not a release blocker". US-56 criterion, story map, traceability and A-25 updated |
| FR-103 (new, Should) | Decision 4. The live description names face shape and pattern when not default (oval, plain), neutral wording. Nothing covered this before: US-46 covered gender only and US-65 covered only the gendered-word check. Criteria added to US-63 (face shape) and US-64 (style and pattern) |
| FR-89 | Decision 5. Now says where failures are recorded: the technical-artist handoff for the measurement, and the new accepted-exceptions table for tech-lead-accepted ones |
| X-1 to X-8 (new table) | Decision 5. X-1 to X-7: the 7 of 240 hair cases (curly-short blonde on claret runner 2.19 and finale wall 2.92; curly-short pink on runner 2.07 and wall 2.42; curly-short black on runner 2.22 and wall 1.67; bob black on runner 2.57). X-8: cream outfit, torso and arms, on oak 2.29 |
| A-34 (new) | Limits the exceptions to the cases listed (see Risks) |
| US-51, US-56, US-57, US-63, US-64 | Changed as above. US-61 unchanged (its 6,000 criterion still holds) |

## Decisions
- FR-80 reworded rather than annotated: "no more than two sentences" stays testable and matches the shipped copy
- FR-88 set to Won't (deferred) instead of deleting it, so the idea and its story criterion are kept for when usability data exists
- FR-103 is a new requirement rather than an edit to FR-15 or FR-76, because FR-15 is a Must about preview timing and the description is a Should. It sits under US-63 and US-64 (each owns one of the two options); each criterion is tagged Should inside a Must story, as US-56 did for Could
- FR-103 allows omitting the default values (oval, plain), mirroring how gender is omitted when Neutral. If the architect prefers always naming them, that still passes
- Accepted exceptions are recorded in FR-89's own group in requirements.md because FR-89 names no other location; the full measurement stays in the technical-artist handoff
- The three.js chunk figure in NFR-27 is a factual update from the technical-artist's measurement; the 1,000 kB limit is unchanged

## Assumptions
- The accepted hair exceptions cover the 4 hair colours (blonde, platinum, pink, black) and 5 backdrops in the 03/11/2026 re-run only (A-34)
- "Live character description" means the customiser's debounced preview description (design spec 9.4 and the screen-reader text), and the architect and designer own the wording

## Open questions
- Tech lead: the three.js chunk is 988.70 kB, over the technical-artist's 985 kB guard but under the 1,000 kB NFR-27 limit. The technical-artist asked for a decision (cut the finale dado variant, strip builder or garment duplication, or accept it). The requirement is met either way; I have not recorded a decision
- Tech lead: the 03/11/2026 hair re-run covered 4 of 11 hair colours. On 02/11/2026 grey, white and ginger hair failed on oak. Should QA or the technical-artist re-run all 11 colours before sign-off? A-34 leaves them as failures until measured
- No question blocks design or build. Standing: Q-21 (finale trigger, can defer), Q-29 (typeface default), legal review before launch (legal team), pricing refers to the Sales team

## Requests for other agents
- architect and ux-ui-designer: add the face-shape and pattern words to the live description (FR-103, design spec 9.4 and `describeAvatar`). Neutral wording only (FR-76, FR-99). The design spec and ADR are not edited by me
- performance-optimiser: verify the 6,000 limit on the reference phone including Low (NFR-27, NFR-28), the worst character being curly-short, full beard, suit, slim, Guide, skin-10 at 5,862, and record it in `docs/performance.md`. This replaces the lapsed 7.3a step 3 sign-off for a raise
- architect: ADR 0021 7.3a step 5 says the provisional ceiling lapses and NFR-27 stays at 6,000; a note in the ADR that it lapsed is yours to add (the kit tests' `TRIANGLE_BUDGET` should be 6,000, not the interim 6,500)
- qa-engineer: do not fail FR-89 or US-57 for X-1 to X-8, but report them as known minor issues; any other combination under 3:1 still fails. FR-88 has no test. Landing description check allows up to two sentences. Add checks for FR-103 (Should) in the customiser
- frontend-developer: FR-88 time hints are not to be built. Landing copy may stay at two sentences
- technical-artist: record any new FR-89 failure in your handoff and tell the tech lead; consider the doorway grazing, ceiling, runner-edge and lit-museum cases not yet measured (A-34)
