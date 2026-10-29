# Handoff: product-manager

## Summary
Requirements are now v0.3. The user's feedback from local testing (29/10/2026, "we need gender changing for the Guide and the Visitor") is recorded as a change: each character gets its own optional gender (Woman, Man, Neutral) that changes body shape, proportions and face, and nothing else. Assumption A-3 is revised, facial hair is now offered to both characters, and app-written text must avoid gendered pronouns. Recommended priority is Must, in the current MVP. Earlier v0.2 content (free roaming, autonomous Guide, live-readiness) is unchanged.

## Files changed
- docs/requirements/requirements.md: v0.3 and history entry; FR-13, FR-14, FR-15 changed; new FR-72 to FR-76 with a priority note; A-3 revised; new A-20 to A-22; new Q-22 to Q-24; Must count updated to 47
- docs/requirements/user-stories.md: v0.3; US-6 and US-7 changed; new US-46 (choose gender), US-47 (published render, older museums, validation), US-48 (pronoun-neutral text); story map and traceability updated
- docs/handoffs/product-manager.md: this note

## Decisions
- Gender is per character (Guide and Visitor set separately), with options **Woman, Man, Neutral**. Neutral is the default and equals today's shape (FR-72). Not a required choice: nobody is forced to pick
- It changes only base body shape, proportions and face (FR-73). It never changes or resets hair, outfit, skin, body type, height or facial hair, and every option works with every gender, so nobody is boxed in. Body type and height apply on top of the gender shape
- Facial hair is offered to both characters (FR-13, FR-14 changed). Otherwise a male Visitor cannot be matched. The contract already holds `facialHair` for the Visitor, so this is mostly UI
- Priority is **Must, current MVP**. Reasons: it comes from the user's own testing; the characters are the emotional core of the gift; the schema is cheapest to extend before museums are published in volume; and the cost is small if it reuses the parametric kit. Fallback if the art budget (6,000 triangles per character) is tight: ship shape and proportions only and defer face differences to Release 2. The selector, persistence, rendering, backward compatibility and pronoun rules ship regardless
- No pronoun field. App-written text avoids he, she and gendered nouns (FR-76). I found no such strings in `src/ui`, only code comments and design-spec prose, so this should be an audit plus a guard test, not a rewrite
- Older museums (no field) load as Neutral with an identical look (FR-75). Unknown values are rejected on save (FR-74, US-47)

## Assumptions
- "Gender" is a styling choice for a cartoon character, not a record about a person. It is never shown to the Visitor as a label (A-20)
- Changing gender does not alter other selections, and new-draft defaults stay as in design spec 9.3 (A-21)
- The Visitor cannot change their own character's gender unless FR-22 (Could) is built later (A-22)
- Stored ids are suggested as `feminine`, `masculine`, `neutral` as an optional field on the avatar config; whether to bump `v` or default at read time is the architect's and backend-developer's call

## Open questions
- Q-22: Confirm the options and labels Woman, Man, Neutral, or add a fourth "Non-binary" label that maps to the Neutral shape. Recommended: the three options (user)
- Q-23: Confirm that facial hair is offered to both characters. Recommended: yes (user)
- Q-24: Does the app need a pronoun setting? Recommended: no, avoid pronouns in app text (user)
- Standing from v0.2: Q-21 (finale trigger, can defer); legal review of privacy and terms before launch (legal team); pricing and contracts are not defined here, so please refer to the Sales team

## Requests for other agents
- architect: record the schema change as a decision (an ADR). Add an optional `gender` to `AvatarConfig` (suggested values `feminine`, `masculine`, `neutral`). Decide between keeping `v: 1` with a read-time default and bumping to `v: 2` with a migrator. The draft in localStorage must also load old drafts without the field. Confirm the character-kit parameterisation fits the 6,000-triangle and 10-draw-call budget
- ux-ui-designer (design spec section 9): add a **Gender** radiogroup (Woman, Man, Neutral, with the helper text "Changes the shape and face. Your other choices stay as they are.") to the customiser, for both characters, probably first on the Body tab or on the Face tab. Show Facial hair on both characters' Face tab. Update 9.1 with the gender proportion table, 9.2 with the labels, 9.3 with the Neutral default, and the live description in 9.4 (for example "Tom: man, medium height, ..." and no gender word when Neutral). Check that "Curvy" and "Broad" body type labels still read sensibly beside Gender. Keep the preview within 1 s, with arrow-key navigation and visible focus. Review the copy deck for pronouns (FR-76)
- technical-artist (character kit): add gender parameters to the kit: shoulder, waist and hip ratios, torso, limb and neck shape, and face shape (jaw, brow, cheeks). Neutral must render exactly as today. Rebuild only affected parts on change. Check all hair styles, outfits (including dress and suit), facial hair and the 10 skin tones against all three shapes and the heights, with no clipping. Keep the triangle and draw-call budget. If the budget is tight, apply the fallback in the requirements note. Hair and outfit must remain freely combinable
- scene-developer: read `gender` from the avatar config wherever characters are built, for the Guide and the Visitor in the visit, the builder preview, the Visitor preview and the customiser. Treat a missing value as Neutral. Keep the preview update at 1 s or less, with no per-frame cost added, and confirm name labels still sit above heads when proportions change
- frontend-developer: add the Gender control and wire it to the builder draft (persisted in localStorage with the avatars), the preview, `describeAvatar` in `src/domain/characters/avatarOptions.ts` (add labels, a default of Neutral in both default configs, and the description) and the keyboard and screen-reader behaviour in US-46. Show facial hair for the Visitor. Load old drafts with no field as Neutral. Audit all app-written strings for he, she, her and gendered nouns and add a guard test (FR-76). Code comments are not in scope
- backend-developer (published document schema and validation): accept an optional `gender` on both avatars. A missing value is valid and means Neutral. Any other value outside the allowed set is rejected with a validation error. Return the stored value to the visitor-facing document unchanged, and return Neutral for older museums. Update `docs/api.md`, and confirm that edit-after-publish (R2) keeps the field
- qa-engineer: derive tests from US-46 to US-48: preview within 1 s, keyboard radiogroup, reload persistence, published render, legacy museum with no field, rejected invalid value, independence from other options (all gender and option combinations, with no clipping), and a pronoun scan of app-written strings. The QA fix round can include this once the architect has settled the schema
