# Handoff: product-manager

## Summary
Requirements are now v0.4. CR-4 "Improved UI" (user request 02/11/2026) is added as Epic E10: a small, testable set of requirements to polish the current look across the landing page, builder, visit HUD and overlays, and 3D scene, with clearer and more defined characters. Identity, layout, flows, the four builder steps and the data model are unchanged. The user chose spec-and-build straight away, so there is no design approval checkpoint. Q-25 (the user's specific feedback) is an open placeholder that does not block the build. Earlier v0.3 content (gender, FR-72 to FR-76) is unchanged.

## Files changed
- docs/requirements/requirements.md: v0.4 and change log entry; Epic E10 with FR-77 to FR-94; NFR-27 to NFR-31; out-of-scope line; A-23 to A-28; Q-25 to Q-29; section 5 Must count note
- docs/requirements/user-stories.md: v0.4; new Epic E10 with US-49 to US-61; story map and traceability updated
- docs/handoffs/product-manager.md: this note

## New IDs and priorities
| Area | IDs | Priority |
|---|---|---|
| Visual polish | FR-77 scales and one component style set; FR-78 one primary action per screen, clear hierarchy | Must |
| | FR-79 control states, transitions of 250 ms or less, designed empty and error states | Should |
| | FR-80 landing page: name, one sentence and Create button above the fold at 360x640 and 1280x720 | Should |
| Mobile ergonomics | FR-81 targets 44x44 with 8 px gaps; FR-82 thumb reach (lower 60%); FR-83 text 16 / 14 / 12 px minimums and 200% text; FR-84 safe areas, browser bars, keyboard | Must |
| Builder clarity | FR-85 visible progress and outstanding list; FR-86 Required and Optional marking, grouping, defaults, three-Next path to Publish | Must |
| | FR-87 step purpose line and inline validation | Should |
| | FR-88 time hint per step | Could |
| Character definition | FR-89 silhouette separation (3:1 edge contrast); FR-90 face, hair, hands and outfit regions readable | Must |
| | FR-91 clearer walk and idle | Should |
| Scene look | FR-92 interior finish pass, pictures and wayfinding as legible as before | Must |
| | FR-93 depth and atmosphere cues on Auto, simplified on Low | Should |
| Excluded | FR-94 new direction, palette, logo, dark mode, themes, new options, new steps, data model changes | Won't |
| Guard rails | NFR-27 budgets (three.js chunk under 1,000 kB, 6,000 triangles, 10 draw calls, first view under 10 MB, landing page grows by no more than 100 KB); NFR-28 frame rate and load re-measured, CLS 0.1 or less; NFR-29 no data or flow change, old museums and drafts load; NFR-30 accessibility holds; NFR-31 copy follows FR-76 and Australian English | Must |

Stories: US-49 (FR-77, FR-78), US-50 (FR-79), US-51 (FR-80), US-52 (FR-81, FR-83), US-53 (FR-82, FR-84), US-54 (FR-85), US-55 (FR-86), US-56 (FR-87, FR-88), US-57 (FR-89, FR-90), US-58 (FR-91), US-59 (FR-92), US-60 (FR-93), US-61 (NFR-27 to NFR-31). Musts: US-49, 52, 53, 54, 55, 57, 59, 61. Shoulds: US-50, 51, 56, 58, 60.

## Decisions
- 11 functional Musts is above the usual limit of about 10, which I challenged: each is polish of something that exists and maps to one of the user's drivers or scoped areas. FR-80 (landing) was demoted to Should because only Creators see it; Visitors arrive from the share link. Trimming order if CR-4 must shrink is A-28
- Builder "feels shorter" is done through clarity only: FR-85 (progress, outstanding list) and FR-86 (grouping, Required and Optional, defaults, and a testable three-Next path to Publish). No step is removed, merged or reordered (A-25, NFR-29)
- Budgets are tight and drive the approach: the three.js chunk has about 30 kB spare (about 969 to 971 of 1,000 kB) and characters have about 122 triangles spare (5,878 of 6,000). NFR-27 therefore says the scene and character improvements should come mainly from materials, parameters, lighting and textures, not new libraries or geometry. The budgets are not raised by default (Q-28)
- "Characters more defined" is read as silhouette separation, facial, hair, hand and outfit detail, and clearer animation (A-26). FR-89 sets a measurable 3:1 edge contrast against the backdrop; the technical-artist must record any option combination that cannot reach it (for example a white outfit on a pale wall), so we get a decision rather than a silent miss
- Thumb reach (FR-82) allows either a control in the lower 60% or an equivalent action there (for example, tap outside to dismiss), so the designer keeps flexibility over the caption card's docking

## Assumptions
- Reference viewports: 360x640 floor, 390x844 typical, landscape 640x360 and 844x390, tablet 768x1024, desktop 1280x720, plus 320 px reflow (A-23, default for Q-26)
- "Polish" keeps colours, logo, tone, layouts and flows recognisable (A-24)
- Current typeface family is kept (A-27, default for Q-29); a new font must fit within 100 KB growth on the landing page
- The 100 KB landing growth limit and the 250 ms transition limit are my proposed numbers; the architect and designer may propose different ones with a reason

## Open questions
- Q-25 (placeholder, does not block the build): the user's specific UI feedback. Which screens, which devices and browsers, and what felt wrong. It will be triaged into CR-4a (user)
- Q-26: which phone, orientation and browser the user finds hard to use. Default A-23 is in use (user)
- Q-27: what "more defined" means most for the characters (too small, blends into background, blank faces, too alike). Default: address all (user)
- Q-28: may the character and size budgets be raised if needed? Default: no (user, only if the technical-artist shows FR-89 or FR-90 cannot fit)
- Q-29: keep the current typeface? Default: yes (user)
- Standing: Q-21 (finale trigger, can defer); legal review of privacy and terms before launch (legal team); pricing and contracts are not defined here, so please refer to the Sales team

## Requests for other agents
- ux-ui-designer (design spec, `src/styles/`): update the spec for CR-4 using the clarifying decisions above, with no checkpoint. Define the spacing, type, radius and elevation scales and the component style set (FR-77); the primary, secondary and destructive hierarchy for each screen (FR-78); the states and 250 ms transitions (FR-79); the landing first screen (FR-80); a type scale that meets 16 / 14 / 12 px minimums and 8 px target gaps at 360 px (FR-81, FR-83); the safe-area and keyboard behaviour (FR-84); the builder progress area and outstanding list, section grouping, Required and Optional markers and the three-Next path (FR-85 to FR-87). Watch two tensions with the current spec: the caption card docks at the top on phones and the Preview button sits at the top, but FR-82 wants repeated actions in the lower 60% (offer tap-outside dismiss or a reachable control). Also specify the character silhouette and feature treatment (FR-89, FR-90) and the scene finish list (FR-92, FR-93) with a Low-quality fallback
- architect: confirm the CR-4 approach fits NFR-27 (about 30 kB chunk headroom). Note that no ADR is needed unless a font, an outline or post-processing technique, or a new dependency is proposed. Confirm that the 100 KB landing limit is measurable in CI (the bundle-size job exists)
- technical-artist: deliver FR-89 to FR-93 through materials, colour, shading and texture within 5,878 of 6,000 triangles and 3 of 10 draw calls; an outline or rim technique is the likely route but must not add a post-processing dependency over budget. Report the edge-contrast result per skin tone, hair colour and outfit colour (FR-89) and any failing combination. Keep gender differences at least as distinguishable (FR-90)
- scene-developer: apply the scene finish and the Auto and Low quality split (FR-92, FR-93) and keep standing pools, podium and wayfinding cues at least as visible. Do not change camera, controls or Guide behaviour
- frontend-developer: implement the 2D polish for FR-77 to FR-88 on the landing page, builder, HUD and overlays. Keep the four steps, their order and the draft and document formats unchanged (NFR-29). Mark fields Required or Optional in text, build the progress and outstanding list from the same source as the Preview missing-items dialog, and write all new copy to FR-76 and Australian English. Use `dvh`-style viewport handling and safe-area padding for FR-84
- qa-engineer: derive tests from US-49 to US-61. Suggested checks: target-size and gap measurement at 360 px in both orientations; font-size audit; 200% text and 320 px reflow; lower-60% position checks; safe-area and on-screen keyboard behaviour under emulation; the three-Next path to Publish; edge-contrast measurement per skin, hair and outfit colour; before and after screenshots for identity; bundle, triangle and draw-call budgets; NFR-1 to NFR-3 and NFR-6 re-run including Low tier; CLS 0.1 or less; legacy museum and draft load; pronoun and spelling scan. All 691 existing tests must still pass, with selectors updated only where visuals changed
- devops-engineer: no change expected. The bundle-size job should also record the landing page transfer size so the 100 KB limit can be checked (architect to confirm)
