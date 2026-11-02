# Handoff: product-manager

## Summary
Requirements are now v0.5 (02/11/2026). The user's specific CR-4 feedback is recorded: a ceiling bug (new Must FR-95), more freedom for face shape and clothing design (new Musts FR-96 to FR-102, which overturn part of FR-94 for those two areas only), and "phones are not hard to use" (FR-82 demoted to Could, FR-84 to Should; FR-81 and FR-83 stay Must as guard rails). Q-25 to Q-27 are marked answered with the user's words. New questions Q-30 to Q-32 carry working defaults and do not block design or build. Earlier content (gender, E1 to E9, FR-77 to FR-93) is unchanged except where listed below.

## Files changed
- docs/requirements/requirements.md: v0.5 and change log; FR-13 (lists new options); FR-82 to Could and FR-84 to Should; FR-89 and FR-90 (cover patterns and face shapes); FR-94 (Won't list rewritten); new FR-95 to FR-102; NFR-27 (budget per combination) and NFR-29 (optional fields only); section 5 Must count (64); section 8; A-23, A-26, A-28 revised; new A-29 to A-33; Q-25 to Q-27 answered, Q-28 updated; new Q-30 to Q-32; "hard to use on phones" removed from the drivers
- docs/requirements/user-stories.md: v0.5; new US-62 to US-67; US-53 re-prioritised; US-57 and US-61 changed; story map and traceability updated
- docs/handoffs/product-manager.md: this note

## New and changed IDs
| ID | Pri | What |
|---|---|---|
| FR-95 | Must (new) | Ceiling never blocks the view at any reachable camera angle or height; fade or cutaway preferred to a clamp; default view unchanged; no flicker; instant under reduced motion |
| FR-96 | Must (new) | Face shape, at least 5 (oval, round, square, heart, long), default oval = today's face, stacks on gender face |
| FR-97 | Must (new) | Clothing style, at least 6; today's six kept; default unchanged |
| FR-98 | Must (new) | Pattern: plain, stripes, checks, dots; default plain; tints of the outfit colour; works with every style and colour |
| FR-99 | Must (new) | Both characters, every gender, identical lists, neutral labels, no gender-locked garment, gender change never alters these choices |
| FR-100 | Must (new) | Optional data fields; old museums and drafts load and look unchanged, no migration |
| FR-101 | Must (new) | Saved in draft and published museum, identical rendering everywhere, validated (absent accepted, unknown or wrong type rejected) |
| FR-102 | Must (new) | Face shape, style and pattern under "More options"; closed step has no more controls and is no taller than today; FR-86 still applies |
| FR-82 | Could (was Must) | Thumb reach |
| FR-84 | Should (was Must) | Safe areas, browser bars, on-screen keyboard; no regression |
| FR-81, FR-83 | Must (unchanged) | Accessibility guard rails |
| FR-89, FR-90 | Must (changed text) | Quality guard rails; now cover patterns and face-shape distinctness |
| FR-94 | Won't (changed) | Still excludes everything except face shape and clothing style and pattern, and the ceiling fix |
| NFR-27, NFR-29 | Must (changed) | Budget applies to every option combination; document gains optional fields only |
| US-62 to US-67 | Must (new) | FR-95; FR-96; FR-97 and FR-98; FR-99; FR-100 and FR-101; FR-102 |

Must count: 47 original + 9 CR-4 Musts (11 minus FR-82 and FR-84) + 8 new (FR-95 to FR-102) = 64.

## Decisions
- FR-82 to Could, FR-84 to Should: the user says phones are not hard to use. FR-82 is the riskiest to build (it conflicts with the caption card docking at the top) and has no user need behind it now. FR-84 is only a Should because it also protects against regressions; QA keeps the existing tests. FR-81 and FR-83 stay Must
- Eight new Musts is a lot, challenged and kept: FR-95 is a bug; FR-96 to FR-102 are one user-requested capability split to one behaviour each. FR-99 to FR-101 are cheap guard rails for inclusion and data safety. There is no separate budget FR; NFR-27 now covers every combination instead
- "More options" is a Must (FR-102) because the user asked that the options not lengthen the step; it is testable as "closed state has no more controls and is no taller than today"
- Trimming order rewritten (A-28 for polish, A-29 for character options). Never demote FR-81, FR-83, FR-85, FR-89, FR-95, FR-99 to FR-101, NFR-27 to NFR-30

## Assumptions
- A-29: option counts are working defaults (5, 6, 4); more is fine, fewer is not. Patterns should be materials or textures, not geometry
- A-30: face shape stacks on the gender face; oval is today's face
- A-31: today's six outfit styles already satisfy "about 6 styles" (Dress and Suit already show for every gender); the pattern is the main new freedom
- A-32: the ceiling fix is the scene-developer's bug fix and does not change the default camera, controls or Guide behaviour
- A-33: the Visitor cannot change their own look; no presets

## Answered later on 02/11/2026 (recorded in requirements v0.5 and user stories)
- Q-30: "Double the styles". FR-97 now needs 12 or more styles: today's 6 unchanged plus about 6 new (US-64 updated). Technical-artist and designer propose the six garments with neutral labels; each must fit the budget on its own
- Q-31: patterns use tints of the outfit colour, no second colour (FR-98 unchanged)
- Q-32: FR-82 Could and FR-84 Should confirmed
- Q-28: a triangle budget raise is accepted if needed. NFR-27 stays as written until the technical-artist proposes a figure and the performance-optimiser verifies it on the reference phone (Low tier included). The limit applies to the worst single style, not a sum
- A-29 trimming order is now: drop new styles first (down to 3 new, so 9 minimum), then face shapes 5 to 3, then patterns to three

## Open questions
- Q-29: keep the current typeface? Default: yes (user)
- Standing: Q-21 (finale trigger, can defer); legal review of privacy and terms before launch (legal team); pricing and contracts are not defined here, so please refer to the Sales team

## Requests for other agents
- architect: write the ADR for the new optional fields following ADR 0020 (gender). Working names `faceShape` and `outfitPattern` (clothing style already exists as `outfitStyle`). Defaults: oval, plain, existing style. Fields optional in the contract, the draft format and the document (FR-100, FR-101, NFR-29). Confirm the ceiling approach fits ADR 0014 (fading partitions) and that the three.js chunk stays under 1,000 kB (NFR-27; about 30 kB spare). No other ADR needed unless a new dependency is proposed
- technical-artist: deliver five face shapes (mainly scaling), a pattern per outfit (stripes, checks, dots, from materials or textures at no triangle cost) and any new clothing styles that fit, all within 6,000 triangles and 10 draw calls for every combination of gender, face shape, style, pattern, hair, facial hair, body type and height (5,878 is the worst case today, so about 122 spare). Default options must reproduce today's look. Keep face shapes distinct within each gender and keep gender differences distinguishable (FR-90). Report edge contrast per pattern, colour and skin tone (FR-89). If the budget is a problem, follow A-29 and tell me before cutting
- scene-developer: finish the ceiling fix to FR-95 (fade or cutaway preferred; no flicker; default view unchanged; instant under reduced motion; works in visit, Preview and builder preview; NFR-1 holds). Add the characters' new options to the kit as the technical-artist delivers them
- ux-ui-designer: design the "More options" group on the Characters step (FR-102: closed height no taller than today at 360x640 and 390x844, keyboard and touch, Optional marking, summary when closed). Define the face shape, style and pattern controls, with neutral labels (FR-99, FR-76). Update the spec for FR-82 (Could) and FR-84 (Should): do not restructure the caption card or builder bars for thumb reach
- frontend-developer: add the three controls inside More options in `src/ui/builder/CharactersStep.tsx`; add the optional keys to the draft persistence with defaults filled when absent; keep draft restore and old drafts unchanged (FR-100); update the screen-reader preview description with neutral wording (FR-76); preview updates within 1 second. Do not restructure layouts for FR-82
- backend-developer: validate the new optional fields in the document contract (accept absent; reject unknown values and wrong types with a clear validation error; never store or serve an unknown value) and update `docs/api.md`. Confirm that old stored documents are served unchanged and that an edit that does not touch the new fields leaves every existing field as it was (FR-100, FR-101, US-66)
- qa-engineer: derive tests from US-62 to US-67 and the changed US-53, US-57, US-61. Suggested checks: camera at highest reachable angle and zoom by mouse, touch and keyboard with the ceiling never hiding floor, characters or pictures, no flicker, reduced motion; every face shape x style x pattern x gender renders without error and stays within 6,000 triangles and 10 draw calls; default options pixel-match today's baseline; old museum and draft fixtures load unchanged; contract accepts absent fields and rejects unknown or wrong-typed values; Characters step height with More options closed is no taller than before at 360x640 and 390x844; the three-Next path to Publish without opening More options; keyboard disclosure and radiogroups; neutral-label and pronoun scan; edge contrast per pattern. Keep the existing tests; FR-82 and FR-84 tests are no longer release blockers
- devops-engineer: no change expected
