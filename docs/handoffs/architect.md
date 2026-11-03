# Handoff: architect

## Summary
Follow-up to ADR 0021 for the frontend developer's two requests (03/11/2026). The builder's `AvatarOptionKey` now covers `faceShape` and `outfitPattern`. Their labels live in the domain, are re-exported from `@/lib/avatars` and are in `AVATAR_LABELS`, using exactly the wording in `src/ui/builder/extraOptions.ts`, so nothing visible changes. `describeAvatar` now says "{shape} face" and "striped" / "checked" / "spotted" (design spec 9.4 v2.0). Defaults add no words, so the descriptions of existing characters are unchanged. `src/ui/**` and `tests/e2e` were not touched.

## Files changed
- `src/domain/characters/avatarOptions.ts`:
  - New `FACE_SHAPE_LABELS` (Oval, Round, Square, Heart, Long) and `OUTFIT_PATTERN_LABELS` (Plain, Stripes, Checks, Dots).
  - `describeAvatar` adds `{shape} face` after the build when the shape is not Oval, and puts the pattern word between the colour and the garment when the pattern is not Plain ("navy striped shirt and trousers"). Both values are read through `avatarFaceShape` and `avatarOutfitPattern`.
- `src/lib/avatars.ts`:
  - `AvatarOptionKey` = `Exclude<keyof AvatarConfig, 'v' | 'glasses' | 'hat'>`, which now includes `faceShape` and `outfitPattern`.
  - `AVATAR_LABELS.faceShape` and `AVATAR_LABELS.outfitPattern` added.
  - `FACE_SHAPE_LABELS` and `OUTFIT_PATTERN_LABELS` re-exported.
  - `optionIds` takes all three optional keys from `AVATAR_OPTIONAL_OPTIONS` and returns `NonNullable` ids.
  - `avatarOptionLabel` takes a `NonNullable` id.
  - New `selectedOptionValue(config, key)`: missing or unknown optional values read as Neutral, Oval or Plain.
- `src/domain/characters/avatarOptions.test.ts`: new block covering labels, unchanged default and legacy descriptions, unknown values, every face-shape phrase, every pattern word, and the spec 9.4 example.
- `src/lib/lib.test.ts`: labels for the optional ids, `optionIds` and `avatarOptionLabel` for face shape and pattern, single source of truth, `selectedOptionValue`, `avatarsEqual` with missing keys.

## Decisions
- **Labels live in the domain** (`src/domain/characters/avatarOptions.ts`), beside every other avatar label, and `@/lib/avatars` re-exports them. That keeps one source of truth for the kit, the builder and `describeAvatar`. The pattern table is called `OUTFIT_PATTERN_LABELS`, matching the contract's `AVATAR_OUTFIT_PATTERNS` and the `OUTFIT_*_LABELS` naming.
- **Widening `AvatarOptionKey` makes `AvatarConfig[K]` include `undefined` for the optional keys.** `optionIds` and `avatarOptionLabel` use `NonNullable<AvatarConfig[K]>`, so the ids they return and accept are never `undefined`. `selectedOptionValue` is the safe read for a control's selected value, so callers do not read `config[key]` directly (ADR 0021, section 4).
- **Pattern words come from the spec, not from the labels**: Stripes is "striped", Checks is "checked" and Dots is "spotted". The face word is the lower-case label plus "face".

## Assumptions
- `src/domain/characters/` and `src/lib/avatars.ts` are not in the ownership table. I edited them because the tech lead delegated this task, as in the ADR 0021 round.
- "heart face" is acceptable wording (spec 9.4 only gives "round face" and "square face" as examples).

## Open questions
- None new. The triangle budget question from the earlier round still stands (below).

## Requests for other agents
- **frontend-developer** (`src/ui/builder/`), all optional and with no visible change:
  - In `extraOptions.ts`, replace the local `FACE_SHAPE_LABELS` and `PATTERN_LABELS` with `FACE_SHAPE_LABELS` and `OUTFIT_PATTERN_LABELS` from `@/lib/avatars` (or use `AVATAR_LABELS.faceShape` and `AVATAR_LABELS.outfitPattern`). `faceShapeIds()` and `patternIds()` can become `optionIds('faceShape')` and `optionIds('outfitPattern')`. `stepCopy.test.ts` imports the two local names, so update it at the same time.
  - In `CharactersStep.tsx`, drop the `setOptional` cast and call `setAvatarOption(role, 'faceShape' | 'outfitPattern', value)` directly: the store's `<K extends AvatarOptionKey>` signature now accepts both keys.
  - In `groupValue`, `selectedOptionValue(config, key)` replaces the `gender` special case and `config[key] as string`. It is needed if the frontend moves face shape or pattern into `GROUPS`.
- **ux-ui-designer:** spec 9.4 could add a "heart face" or "long face" example. No change is required.

---

## Earlier round: ADR 0021 data model (02/11/2026)

### Summary
User feedback on CR-4 (02/11/2026, requirements v0.5, FR-96 to FR-102, Q-30 and Q-31 answered). I settled the data model for face shape, outfit pattern and the extra outfit styles in ADR 0021, and landed the type and contract scaffolding with unit tests. The changes are:
- optional flat `faceShape` (5 options) and `outfitPattern` (4 options), read through accessors
- six outfit style ids appended to the existing `outfitStyle` (12 in total)
- no pattern colour field

There is no version bump, no draft key change and no database migration, and legacy data reads as today's look. There is no UI and no kit visual work. The builder hides the six new styles until the kit builds them.

Earlier rounds (ADRs 0001 to 0020) are unchanged; see architecture section 17.

### Files changed
- `supabase/functions/_shared/contract.ts`:
  - New `AVATAR_FACE_SHAPES`, `AvatarFaceShape`, `DEFAULT_AVATAR_FACE_SHAPE`, `isAvatarFaceShape`, `avatarFaceShape`.
  - New `AVATAR_OUTFIT_PATTERNS`, `AvatarOutfitPattern`, `DEFAULT_AVATAR_OUTFIT_PATTERN`, `isAvatarOutfitPattern`, `avatarOutfitPattern`.
  - New table helpers: `AVATAR_OPTIONAL_OPTIONS`, `AvatarOptionalKey`, `AVATAR_OPTIONAL_DEFAULTS`, `isAvatarOptionalValue`, `withAvatarDefaults`.
  - Optional `faceShape?` and `outfitPattern?` on `AvatarConfig`.
  - Six ids appended to `AVATAR_OPTIONS.outfitStyle`: `sweater`, `overalls`, `coat`, `tracksuit`, `cardigan`, `tunic` (design spec v2.0, 12.8.2 G; `tunic` chosen over `skirt` by the tech lead).
- `supabase/functions/_shared/validate.ts`: `validateAvatar` loops over `AVATAR_OPTIONAL_OPTIONS`. An absent key gets its default. An unknown id or `null` is rejected with `field` `<path>.<key>` and the message "Choose one of the available options." Other unknown keys are still rejected.
- `supabase/functions/_shared/present.ts`: responses fill all three optional keys through `withAvatarDefaults`, replacing the local `withGender`. Stored rows are not rewritten.
- `src/api/mockClient.ts`: same fill-in for the mock's `getMuseum` and `manageGet`. Publish already runs the shared validator, so the new fields pass through.
- `src/state/draftPersistence.ts`: `restoreAvatar` keeps each optional key only when valid, otherwise the default. Key `surprise-museum:draft:v1` and version 1 are unchanged.
- `src/domain/characters/avatarOptions.ts`: both default appearances carry `faceShape: 'oval'` and `outfitPattern: 'plain'`. Labels (Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic) and description phrases for the six new styles, taken from design spec v2.0 12.8.2 G.
- `src/lib/avatars.ts`:
  - `AvatarOptionKey` excludes `faceShape` and `outfitPattern` until the controls exist.
  - `optionIds('outfitStyle')` hides the six new styles (`OUTFIT_STYLES_PENDING_KIT`).
  - `avatarsEqual` treats a missing optional key as its default.
- `src/scene/characters/kit/neutralSnapshot.testutil.ts`: the v1.0 golden is now pinned to the six v1.0 styles instead of reading `AVATAR_OPTIONS`. Otherwise appending ids would break the v1.0 fingerprint.
- Tests:
  - New file: `src/api/__tests__/avatarOptionalFields.test.ts`.
  - New blocks in `src/api/__tests__/mockClient.test.ts` and `src/state/draftPersistence.test.ts`.
  - Fixture additions in `src/api/__tests__/validate.test.ts` and `mockClient.test.ts`: writers now send explicit `faceShape` and `outfitPattern`.
- `docs/decisions/0021-avatar-face-shape-and-outfit-fields.md`: new ADR.
- `docs/architecture.md`: v1.4. Updated sections 1, 6.7, 7.1, 7.3, 12, 15, 16 and 17.

### Decisions
- **Flat keys `faceShape` and `outfitPattern`, and reuse `outfitStyle`.** Nested `outfit: { style, pattern }` would rename the required `outfitStyle`. That would force `v: 2` with migrators in three places, and break the flat-record helpers (validator loop, draft restore, `avatarsEqual`, `setAvatarOption`).
- **Ids:**
  - `oval`, `round`, `square`, `heart`, `long` (default `oval`).
  - `plain`, `stripes`, `checks`, `dots` (default `plain`).
  - New style ids are the design spec's garment nouns, appended in the spec's display order so no v1.0 id moves or changes.
- **One optional-key table.** It drives the validator, draft restore, response fill-in and equality, so a future optional key is a one-place change.
- **No bump.** Avatar `v`, `CONTRACT_VERSION`, `content_version`, the draft key and the draft version all stay.
- **Reject on write, map on read.** The validator rejects unknown ids (FR-101). The accessors map unknown or missing values to the default, so rendering never fails.
- **Kit approach:**
  - Face shape: extend `PartBuilder.warp` below the eye line and compose with the gender jaw. Adds 0 triangles.
  - Pattern: an `onBeforeCompile` patch of the body Lambert material, with an `outfitMask` vertex attribute, a uniform per rig and a constant cache key. Adds 0 draw calls and 0 textures. The ink is a tint of the outfit colour.
  - Styles: each style replaces the garment, so the budget is set by the worst style.
- **Budget (measured 02/11/2026):**
  - Worst body per style: suit 4,396. Worst hair: 1,480. Worst character: 5,878.
  - Ceiling for any new style: **4,518 body triangles**.
  - With the design spec's catchlights (up to 60 triangles), the ceiling for any style is 4,458.
  - Estimates: sweater, tracksuit and cardigan fit easily; overalls and tunic are tight; `coat` is at risk (about 4,450 to 4,600).
  - **6,500 per character accepted by the tech lead as a provisional ceiling** (ADR 0021, 7.3a). The technical artist measures the real garments, the performance optimiser signs off, and only then does the product manager change NFR-27. Draw calls stay at 3. Scene triangles rise by at most about 1,000 (+7%, against a 150,000 budget). There is no expected frame-rate effect.
- **Chunk:** the three.js chunk is 961.85 kB today. The target is at most +10 kB in total: face shape 2 kB, pattern 4 kB, garments 4 kB.

### Assumptions
- The new style ids and labels follow design spec v2.0 12.8.2 G as directed. The spec lists the display order as Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic in 12.5.3 but puts Cardigan before Tracksuit in 9.2; I used the 12.5.3 order (designer to align 9.2).
- `oval` is today's head (A-30).
- The pattern applies only to the outfit-colour regions. The fixed contrasting garment stays plain (FR-90 top and bottom regions).
- The new style ids render as the jumpsuit until the technical artist builds their garments. The builder gate keeps them out of the UI meanwhile.

### Open questions
- Final triangle budget: 6,500 is provisional. Keep 6,000 if the real garments fit (target 5,950 with catchlights), otherwise the measured worst plus margin, at most 6,500. (Technical artist measures, performance optimiser signs off, product manager updates NFR-27.)

### Requests for other agents
- **technical-artist** (kit and `src/scene/shaders/`):
  - Build the six new garments (design spec 12.8.2 G) in `parts/outfits.ts`. Aim for the suit's count or less (4,396; at most 4,458 with catchlights within 6,000). The hard ceiling is the provisional 6,500 per character (ADR 0021, 7.3a). Report each style's worst count; `coat` is the most at risk.
  - Implement face shape in `PartBuilder.warp` (7.1). `oval` must stay bit-identical, and the neutral snapshot must still pass. `rig.setAppearance` must rebuild the body and hair when `avatarFaceShape` changes.
  - Implement the pattern shader in `src/scene/shaders/avatarPattern/` with an `outfitMask` attribute and `patterned` band flags (7.2). Report FR-89 3:1 results per outfit colour and pattern.
  - Read the new values only through `avatarFaceShape`, `avatarOutfitPattern` or `withAvatarDefaults`.
  - Extend the budget tests: every face shape and pattern gives the same index count as `oval`/`plain`.
  - The heavy budget tests now loop over 12 styles and took more than 5 s when the machine was busy (load average about 22). Give them an explicit timeout (for example 20 s).
  - When each garment lands, ask the frontend developer to remove it from `OUTFIT_STYLES_PENDING_KIT`.
- **frontend-developer** (`src/ui`, `src/state`, `src/lib`):
  - Add the face shape and pattern controls under a "More options" group (FR-102). Remove `faceShape` and `outfitPattern` from the `AvatarOptionKey` exclusion, add their labels to `AVATAR_LABELS` and handle them in `optionIds`.
  - Empty `OUTFIT_STYLES_PENDING_KIT` as the garments land.
  - Extend `describeAvatar` per design spec 9.4.
  - Persistence, equality and defaults already work. Keep writing explicit values.
- **backend-developer** (`supabase/`, `docs/api.md`):
  - Run the Deno tests. Deno is not installed here, so `validate.ts`, `present.ts` and `contract.ts` compiled and ran only through tsc and Vitest.
  - In `supabase/functions/tests/flow_test.ts`, add cases for absent, valid and unknown `faceShape` and `outfitPattern`, the new style ids, and old rows without the keys.
  - Update `docs/api.md`: the avatar settings table, examples, the rule that responses always include all optional keys, and the 12 styles.
  - Smoke test (`supabase/scripts/smoke-test.mjs`) needs no change.
- **devops-engineer:** release order. Run the manual functions deploy before the frontend change reaches `main`. The old validator rejects the new keys and style ids.
- **ux-ui-designer:** the contract now matches spec v2.0 (ids, labels and description words). Please align the order in 9.2 (Cardigan before Tracksuit) with 12.5.3, and mark the ids as final rather than provisional.
- **performance-optimiser:** sign off (or lower) the provisional 6,500 ceiling with a Low and High tier walk using the worst character pair, and record the per-style counts in `docs/performance.md`.
- **qa-engineer:** legacy museum and draft load (no new keys), reject paths, the builder gate, and the budget across 12 styles, 5 face shapes and 4 patterns. Note that `src/scene/materials/palette.test.ts` currently fails because of the designer's uncommitted `tokens.css` edit; it is not related to this change.
- **product-manager:** change NFR-27 only after the measurement and sign-off (ADR 0021, 7.3a). Update A-29's trimming order to name `coat` as the first style to simplify or drop.
