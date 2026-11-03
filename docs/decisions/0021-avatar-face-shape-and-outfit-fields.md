# 0021: Avatar face shape and outfit fields

## Status
Accepted (02/11/2026, user feedback on CR-4, requirements v0.5: FR-96 to FR-102, A-29 to A-31). On 02/11/2026 the user answered Q-30 ("double the clothing styles": keep today's six and add about six, all for every gender) and Q-31 (tints of the outfit colour, no second colour field). Both answers are reflected below. Follows the pattern of ADR 0020. Amends ADR 0008, because the kit gains a face-shape warp and a pattern shader on the existing body material. The six new style ids follow design spec v2.0, section 12.8.2 G, where the tech lead chose `tunic` over `skirt` as the gender-neutral option. On 02/11/2026 the tech lead also accepted 6,500 triangles per character as a **provisional** ceiling (section 7.3a).

## Context
The user's CR-4 feedback (02/11/2026) asks for "more freedom to choose face shape and cloth designs". Requirements v0.5 turns that into a face shape with 5 options (FR-96), clothing style with at least 6 (FR-97, about 12 after Q-30) and a clothing pattern with 4 (FR-98). All options go to both characters and every gender, with neutral labels (FR-99). The defaults must reproduce today's look exactly, and old data must load unchanged (FR-100). Values are validated and render the same everywhere (FR-101).

Forces:
- **Clothing style already exists.** `AVATAR_OPTIONS.outfitStyle` is a required key with six ids (`tee-jeans`, `hoodie`, `shirt-trousers`, `dress`, `suit`, `jumpsuit`), and every gender can already choose all six (FR-73). The user's Q-30 answer doubles the list to about 12. So the style needs more ids, not a new field.
- **The same forces as ADR 0020 apply.** Published rows, `surprise-museum:draft:v1` drafts and demo-mock data all hold avatars without the new keys. The validator rejects unknown keys. `parsePersistedDraft` discards a draft whose version differs. The functions and the frontend deploy separately.
- **Budgets (NFR-27, Q-28 "no").** The worst character is 5,878 of 6,000 triangles, leaving 122 spare. Each character uses 3 of 10 draw calls. The three.js chunk (`NameLabel-*.js`, which holds the kit) measured 961.85 kB of 1,000 kB in the build on 02/11/2026; the requirements cite 969 to 971 kB.
- **How the kit is built.** Each character has one body `SkinnedMesh` with vertex colours on a `MeshLambertMaterial`, with no UVs and no textures. There is also a hair mesh and a blob shadow. `PartBuilder.warp` already moves the existing vertices of every `head`-bone part to give the gender jaw (`jawScale`).

## Decision

### 1. Fields and ids
| Field | Ids, in display order | Default (what a missing value means) | Labels (design spec v2.0, 9.2) |
|---|---|---|---|
| `faceShape` (new, optional) | `oval`, `round`, `square`, `heart`, `long` | `oval`, today's head bit for bit (A-30) | Oval, Round, Square, Heart, Long |
| `outfitPattern` (new, optional) | `plain`, `stripes`, `checks`, `dots` | `plain`, today's flat colour | Plain, Stripes, Checks, Dots |
| `outfitStyle` (existing, required) | the six v1.0 ids unchanged, then **six appended** (Q-30, design spec v2.0 12.8.2 G): `sweater`, `overalls`, `coat`, `tracksuit`, `cardigan`, `tunic` | n/a (always present). Each character's default style is unchanged | v1.0 labels unchanged. New: Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic (design spec 9.2, 12.8.2 G) |

**Shape: flat keys, `faceShape` and `outfitPattern`, with the existing `outfitStyle` reused.**

| Option considered | Verdict |
|---|---|
| Flat `outfitPattern` beside the existing `outfitStyle` and `outfitColor`, with new style ids appended to `outfitStyle` | **Chosen.** Additive only. The shared `outfit` prefix groups the three clothing keys. It fits every piece of code that treats an avatar as a flat record of option ids: the validator loop, the draft restore, `avatarsEqual` and `setAvatarOption(role, key, value)` |
| Nested `outfit: { style, pattern }` | Rejected. It moves the required `outfitStyle`, which is a rename, so it needs avatar `v: 2` and a migrator in the Edge Functions, the mock and the draft restore. It also breaks every flat-record helper listed above |
| A second style field (for example `clothingStyle`) | Rejected. It duplicates `outfitStyle`, and two fields for one choice would drift apart |
| `headShape` instead of `faceShape` | Rejected. `faceShape` is the user's word and FR-96's, and the change reshapes the face outline, not the crown |

**New style ids** are the single garment nouns from design spec v2.0, 12.8.2 G. The existing "top-bottom" ids (`tee-jeans`, `shirt-trousers`) were not copied, because each new style has a fixed bottom that is not a choice. The ids are appended after the v1.0 ids, in the display order of design spec 12.5.3 ("More styles": Sweater, Overalls, Coat, Tracksuit, Cardigan, Tunic), so no stored id changes position or meaning, and no id is renamed. Each is a different silhouette the `Garment` model can build, so it reads as a real choice and not a recolour (the spec requires every pair to differ at 120 px):
- the sweater has a ribbed hip hem
- the overalls have a bib and straps
- the coat is knee-length and flared
- the tracksuit has tapered joggers
- the cardigan has an open front
- the tunic is knee-length and straight, over trousers

`tunic` was chosen over `skirt` as gender-neutral (tech lead, 02/11/2026). Every style is offered to both characters and every gender, and no label names a wearer (FR-99).

Ids are lower-case shape nouns, independent of the labels, so the copy can change without a migration. `checks` is used rather than `plaid` (US usage, and it suggests a second colour) or `tartan`. `dots` is used rather than `polka-dots`. No id names a wearer (FR-99).

### 2. Contract (landed with this ADR)
```ts
// supabase/functions/_shared/contract.ts
export const AVATAR_FACE_SHAPES = ['oval', 'round', 'square', 'heart', 'long'] as const;
export type AvatarFaceShape = (typeof AVATAR_FACE_SHAPES)[number];
export const DEFAULT_AVATAR_FACE_SHAPE: AvatarFaceShape = 'oval';
export function isAvatarFaceShape(value: unknown): value is AvatarFaceShape;
export function avatarFaceShape(config: { readonly faceShape?: unknown }): AvatarFaceShape;

export const AVATAR_OUTFIT_PATTERNS = ['plain', 'stripes', 'checks', 'dots'] as const;
export type AvatarOutfitPattern = (typeof AVATAR_OUTFIT_PATTERNS)[number];
export const DEFAULT_AVATAR_OUTFIT_PATTERN: AvatarOutfitPattern = 'plain';
export function isAvatarOutfitPattern(value: unknown): value is AvatarOutfitPattern;
export function avatarOutfitPattern(config: { readonly outfitPattern?: unknown }): AvatarOutfitPattern;

// One table for every optional avatar key (gender included), so the next one is added in one place.
export const AVATAR_OPTIONAL_OPTIONS = { gender, faceShape, outfitPattern } as const; // the id arrays
export type AvatarOptionalKey = keyof typeof AVATAR_OPTIONAL_OPTIONS;
export const AVATAR_OPTIONAL_DEFAULTS; // { gender: 'neutral', faceShape: 'oval', outfitPattern: 'plain' }
export function isAvatarOptionalValue(key: AvatarOptionalKey, value: unknown): boolean;
export function withAvatarDefaults<T extends AvatarConfig>(config: T): T & Required<Pick<AvatarConfig, AvatarOptionalKey>>;

export interface AvatarConfig {
  v: 1;
  gender?: AvatarGender;
  faceShape?: AvatarFaceShape;       // absent means 'oval'
  outfitPattern?: AvatarOutfitPattern; // absent means 'plain'
  // ...required AVATAR_OPTIONS keys unchanged
}
```
- The new keys are **not in `AVATAR_OPTIONS`**, for the same reason as `gender`: every `AVATAR_OPTIONS` key is required in a v1 avatar.
- Each character holds its own values, inside `visitorAvatar` and `guideAvatar`.
- **There is no pattern colour field.** The pattern is drawn in tints of `outfitColor` (Q-31, answered by the user on 02/11/2026). A key such as `outfitPatternColor` is rejected as unknown.
- **The new style ids are in `AVATAR_OPTIONS.outfitStyle`** (landed), so they need no other contract change.

### 3. Versioning: no bump
| Marker | Value | Why |
|---|---|---|
| Avatar `v` | stays `1` | A missing value means exactly today's look, so neither old nor new readers misread anything |
| `CONTRACT_VERSION`, `museums.content_version` | stay `1` | The bump rule in the contract header is not triggered: nothing is renamed or removed, and no field is made required |
| Draft key `surprise-museum:draft:v1`, `DRAFT_STORAGE_VERSION` | unchanged | A bump would discard every Creator's draft |
| Database | no migration | The avatar columns are `jsonb` with an object-type check only |

### 4. Reading and writing rules
| Who | Rule |
|---|---|
| Every reader (kit, scene, `describeAvatar`, builder controls, comparisons) | Use `avatarFaceShape(config)` and `avatarOutfitPattern(config)`, or `withAvatarDefaults(config)` for a whole avatar. Never read `config.faceShape` or `config.outfitPattern` directly. A missing or unrecognised value gives the default, so a stored document is never rendered with an unknown value |
| Builder (writer) | Always writes explicit values. Both default appearances carry `faceShape: 'oval'` and `outfitPattern: 'plain'` (landed) |
| `publish` validator | If a key is absent, the default goes into the validated output, so every new row stores explicit values |
| `get-museum`, `manage-museum get`, the mock's reads | Always return all three optional keys, filled in by `withAvatarDefaults` in `present.ts` and `mockClient.ts` (landed). Stored rows are not rewritten |
| `avatarsEqual` | A missing optional key equals its default and nothing else (landed) |

### 5. Validation (unknown ids are rejected, never mapped)
**Server (Edge Functions and the mock, through one shared `validateAvatar`, landed):**
- Allowed keys are `v`, the keys of `AVATAR_OPTIONAL_OPTIONS` and the keys of `AVATAR_OPTIONS`. Any other key, such as `outfit`, `pattern` or `outfitPatternColor`, is still `Unknown avatar setting.`
- If a key is absent (`undefined`), the avatar is valid and the output carries the default.
- If a key is present, its value must be a listed id. Anything else is `400 bad_request`, including `null`, a number, `''`, a capitalised label (`'Oval'`) or another field's id. The `field` is `document.visitorAvatar.faceShape` (or `guideAvatar`, or `outfitPattern`), and the message is "Choose one of the available options." The message never echoes the value (FR-101).

**Rejecting is chosen over mapping on write** because a silently mapped value would publish a look the Creator did not choose. Mapping happens only on read, through the accessors, so stored data can never break rendering.

**Client:** draft restore keeps a value only when `isAvatarOptionalValue` passes; otherwise it uses the default (landed). Rendering never throws.

### 6. Compatibility and deploy order
| Case | Result |
|---|---|
| Museum, draft or demo data saved before v0.5 | Loads as `oval` and `plain` and renders exactly as before (FR-100) |
| Old cached app bundle with new functions | Sends no new keys, which is accepted. Responses carry keys the bundle ignores, so it renders as today |
| New app bundle with **old** functions | Publish fails, because the old validator rejects `faceShape` as an unknown key and the new style ids as unlisted. **Deploy the functions first** (manual workflow), as in ADR 0020 |
| Old cached app bundle opening a museum that uses a new style | The old kit's `garmentFor` falls back to its `default` branch and shows the jumpsuit in the chosen colour. No error. It corrects itself on the next app load |
| Old cached app bundle restoring a draft that uses a new style | The old draft restore drops the unknown id and uses that character's default style |
| Mock mode | One bundle, so no deploy ordering is needed |

### 7. Kit realisation within budget
**7.1 Face shape: reshape the existing head vertices, adding 0 triangles.**
- Extend `PartBuilder.warp` from "jaw width" to one head-warp function built from the gender jaw and a face-shape parameter set, for example `{ cheek, jaw, chin, taper }`. It applies to the same vertices as today: every part on the `head` bone, in both the body and the hair builders. So the eyes, nose, mouth, ears, brows and beards follow the outline.
- **Reshape only below the eye line.** The crown, hairline and hair cap stay where they are, so no hair style clips and hats (Release 2) stay valid. `hairBack` parts are not warped.
- **Compose multiplicatively with gender.** The gender jaw multiplies the face-shape jaw, so FR-73's differences survive inside every face shape (FR-90).
- **`oval` is all 1.00 and takes the current code path.** Today's neutral snapshot test must still pass for every gender.
- **Starting values (the technical artist tunes these):**
  - round: wider cheeks, wider jaw, slightly shorter chin
  - square: wider jaw with a flatter falloff, blunt chin
  - heart: narrower jaw, pointed chin, slightly wider cheeks
  - long: chin up to +8% lower, slightly narrower cheeks
- **Limits:**
  - The chin must stay clear of the collar rings (`shirt-trousers` and `suit` neck rings at y 1.318 to 1.358).
  - The head centre and the joints do not move, so the bones and the label anchor are unchanged.
- **Rig:** `setAppearance` rebuilds the body and hair when `avatarFaceShape` changes. The bind pose is not refreshed. A preview morph is optional; the same parameter blend used for gender would work.

**7.2 Pattern: a procedural shader on the existing body material, adding 0 draw calls and 0 textures.**
- **Shader patch.** Patch the body `MeshLambertMaterial` once with `onBeforeCompile`. Return a constant `customProgramCacheKey`, so every rig and every pattern shares one program: at most one new program, and none if nothing else uses the unpatched body program. Changing the pattern never recompiles.
- **Choosing the pattern.** Each rig's material gets a `uOutfitPattern` uniform (0 to 3). `plain` (0) gives exactly today's colour.
- **Where the pattern goes.** A new per-vertex float attribute `outfitMask` is 1 on the outfit-colour regions (chest shell, outfit-coloured arm and leg bands, skirt, hood and hems) and 0 elsewhere. The 0 regions are skin, face, hair, shoes, badge, and the fixed contrasting garment: denim, trousers, joggers, cream shirt and tie. Garment bands gain a `patterned` flag, and parts without it get 0. Test with `step(0.5, mask)` so edges stay crisp. Keeping the contrasting garment plain keeps the top and bottom readable as separate regions (FR-90).
- **Coordinates.** Use the bind-pose model-space `position` before skinning, passed as a varying, so the pattern moves with the body and does not swim. Stripes run horizontally on y. Checks and dots use y and an around-the-body coordinate.
- **Size and anti-aliasing.** Start with a period of about 4 to 6 cm at scale 1; below about 3 cm it aliases at visit distance on a 360 by 640 screen. Anti-alias with `fwidth` (WebGL2).
- **Ink colour.** Use a tint of the vertex colour: lighter on dark outfit colours, darker on light ones, with a luminance switch like `mouthColour`. The edge contrast of FR-89 must not drop below 3:1, so report any failing outfit colour.
- **What it adds.** No UVs, no texture, no new draw call and no new material. The hair material is untouched. Low tier uses the same shader, because the cost is a few ALU operations on a small screen area.
- **Ownership.** The shader code lives in `src/scene/shaders/avatarPattern/` (technical artist) and is wired into the kit material in `rig.ts`.

**7.3 Outfit styles: twelve garments, and the budget is set by the worst one, not the sum.**
- **Each style replaces the garment.** A style is one `Garment` (`parts/outfits.ts`): the colours, offsets and bands of the shared torso and limb tubes, plus a few extras, all merged into the one body mesh. Choosing a style replaces the previous garment completely. A character therefore costs `body(worst style) + hair(worst style) + shadow`, and adding a style never adds to the others. Draw calls stay at 3 for every style.
- **Measured on 02/11/2026** (worst over every body type, role and facial hair, on `skin-10`):

  | Style | Body triangles | | Style | Body triangles |
  |---|---|---|---|---|
  | tee-jeans | 4,092 | | dress | 4,128 |
  | hoodie | 4,192 | | suit | **4,396** (worst) |
  | shirt-trousers | 4,236 | | jumpsuit | 4,164 |

  The worst hair is 1,480 (`curly-short` with `full-beard`), and the blob shadow is 2. So the worst character is 4,396 + 1,480 + 2 = 5,878.
- **Ceiling for a new style within today's budget:** 6,000 − 1,480 − 2 = **4,518 body triangles**. That is 122 more than the suit and 426 more than `tee-jeans`.
- **Estimate per new style** (technical artist to confirm):

  | New style (design spec 12.8.2 G) | Built from | Estimate | Fits 4,518? |
  |---|---|---|---|
  | `sweater` | shirt-trousers with a ribbed hem band and cuffs (vertex-colour bands), no collar | about 4,150 to 4,240 | Yes |
  | `tracksuit` | joggers (tapered leg rings), stand-collar ring, side stripe as a band | about 4,250 to 4,300 | Yes |
  | `cardigan` | open-front cream panel (one ellipsoid) over trousers, button lines as vertex colour | about 4,200 to 4,300 | Yes |
  | `overalls` | bib and two straps (3 ellipsoids) and a waist ring over trousers, cream tee bands | about 4,400 to 4,480 | Probably, tight |
  | `tunic` | knee-length straight skirt with little flare over trousers (the pelvis is kept), mandarin collar ring | about 4,400 to 4,550 | Tight |
  | `coat` | knee-length flared skirt over trousers (the pelvis is kept), collar, centre line and vent as vertex colour, long sleeves | about 4,450 to 4,600 | **At risk** (the worst new style) |
- **Rules for the technical artist:**
  1. Reuse the existing tubes. A new style may only add extras (ellipsoids, rings) and a skirt.
  2. Prefer colour bands to extras: a band costs no triangles, while an 8 by 5 ellipsoid costs about 60 to 80.
  3. Reach the look by lowering the segment counts of the new extras, or by sharing one extra (for example, collar and lapels as one ring), before asking for a raise.
  4. Every new style is `patterned` on its outfit-colour regions (7.2).
  5. The budget tests already loop over `AVATAR_OPTIONS.outfitStyle`, so they cover the new ids automatically. Until a garment lands, its id renders as the jumpsuit.
- **Builder gate (landed):** `optionIds('outfitStyle')` in `src/lib/avatars.ts` hides the six new ids until their garments exist, so the builder never offers a tile that renders as the jumpsuit. Validation and draft restore already accept them.
- **Kit test ceiling:** until 7.3a step 4, the kit tests keep `TRIANGLE_BUDGET = 6000`. A new garment that measures above it raises the constant to at most 6,500, with a comment pointing at 7.3a. It must not be raised further.

**Design spec target vs ceiling.** Design spec v2.0 (12.8, 12.8.2 G) asks for more than the contract needs: no new style above the suit's count (4,396), and a hard stop of 5,950 per character including the catchlights (up to 60 triangles). That is the **art target**, and the technical artist aims for it first. With the catchlights, the body ceiling for any style within 6,000 is 6,000 − 1,480 − 2 − 60 = **4,458**.

**7.3a Budget raise: 6,500 accepted as a provisional ceiling (tech lead, 02/11/2026).** The user accepted a raise if needed. Status and conditions:
1. **Provisional.** Until steps 2 and 3 are done, 6,500 is the ceiling the kit tests may enforce for the new styles, so the work is not blocked. 6,000 (and the design spec's 5,950 target) stays the goal.
2. **The technical artist measures the real garments.** Report the worst body count per style over every body type, role, facial hair and skin extreme, and the worst character total.
3. **The performance optimiser signs off.** Re-run the 60 s walk on Low and High with the worst character pair (NFR-1, NFR-28), and record the result in `docs/performance.md`.
4. **Only then is NFR-27 formally changed** (product manager), to the measured worst plus a stated margin, at or below 6,500. Record the confirmed number as a dated amendment to this ADR, and update `TRIANGLE_BUDGET` in the kit tests to match.
5. If the measured worst fits 6,000, NFR-27 stays at 6,000 and the provisional ceiling lapses.

| | Today | Proposed |
|---|---|---|
| Triangles per character | 6,000 | **6,500** provisional (+500, +8%) |
| Body ceiling for any style, with today's worst hair | 4,518 (4,458 with catchlights) | 5,018 (4,958 with catchlights) |
| Draw calls per character | 3 of 10 | 3 of 10 (unchanged: styles replace, they never add a mesh) |
| Scene triangles, 2 characters and 20 photos | about 15,000 | at most about 16,000 (+7%) against a 150,000 budget |
| Skinned vertices per character | about 2,570 (suit) | at most about 2,900 (+13%). Rigid single-bone skinning: a few hundred extra vertex-shader runs per frame |
| Frame rate (NFR-1: 30 FPS reference phone on Low, 60 FPS laptop) | met | expected to be unaffected: the GPU and main thread are dominated by photo textures and fill rate, not character vertices. The performance optimiser re-runs the 60 s walk on Low and High to confirm |

6,500 is proposed rather than a larger number because it covers the worst estimate (`coat` at about 4,600, with `tunic` close behind) with about 400 spare for later face or garment detail, while staying under 4% of the scene budget for both characters. If the confirmed number is different, record it as an amendment to this ADR, and update NFR-27 (product manager) and the budget constants in the kit tests (`TRIANGLE_BUDGET`).

**7.4 Budget impact**
| Measure | Before | After (target) |
|---|---|---|
| Triangles, worst character | 5,878 | Face shape and pattern add none. New styles: aim for at most 5,950 including catchlights (design spec). Ceiling 6,500, provisional until measured and signed off (7.3a) |
| Draw calls per character | 3 | 3 |
| Shader programs | n | n + 1 at most |
| Vertex memory | n/a | +4 bytes per body vertex (`outfitMask`), about 12 KB per character |
| Vertex memory, new styles | n/a | at most about +330 vertices for the worst style, about 10 KB |
| three.js chunk | 961.85 kB (02/11/2026) | at most +10 kB in total: face-shape table and warp at most 2 kB, pattern shader strings and wiring at most 4 kB, six garment configs at most 4 kB. No new three.js classes. That leaves at least 28 kB of headroom |
| Contract and domain chunks (not the three.js chunk) | n/a | about +2 kB (landed: ids, accessors, labels) |

The budget test must cover every face shape. Patterns and face shapes must give the same index count as `oval` and `plain` for the same other options. A cheap equality check is enough, so the 960-rig product does not multiply by 20.

**Fallback (A-29, adjusted for Q-30):**
1. Stay within the provisional 6,500 (7.3a). If even that cannot be met, simplify or drop the most expensive new style (`coat`, then `tunic`, then `overalls`).
2. Reduce face shapes to three (`oval`, `round`, `long`, done by scaling only).
3. Reduce patterns to `plain`, `stripes` and `dots`. Ids are never removed from the contract. A trimmed option is hidden in the builder, and the kit renders it as the nearest kept option, so stored data stays valid.

## Consequences
- Old museums, drafts and demo data keep working with no migration, no version bump and no Creator action.
- There are now three optional keys, read through one table. The validator, draft restore, response fill-in and equality loop over `AVATAR_OPTIONAL_OPTIONS`, so a fourth key is a one-line contract change plus its accessor.
- A new app bundle against old functions cannot publish. The deploy order is a release step.
- The builder's `AvatarOptionKey` excludes `faceShape` and `outfitPattern` until the frontend developer adds the controls and labels, and `optionIds('outfitStyle')` hides the six new styles until the kit builds them. This is deliberate, so no half-built control can ship.
- With twelve styles, the per-character triangle budget is set by the single most expensive style. Any future style is checked against the body ceiling (4,458 with catchlights within 6,000, or 4,958 under the provisional 6,500), not added to a running total.
- The neutral-snapshot test helper is pinned to the six v1.0 styles, because its golden hashes are a v1.0 fingerprint.
- The body material becomes a patched Lambert. Any future change to the body material must keep the patch and the constant cache key.
- `describeAvatar` does not yet mention face shape or pattern. The design spec (9.4) decides the wording.

## Amendment (03/11/2026): builder keys and description words
- `AvatarOptionKey` in `src/lib/avatars.ts` now includes `faceShape` and `outfitPattern`. `AVATAR_LABELS` carries their labels (`FACE_SHAPE_LABELS` and `OUTFIT_PATTERN_LABELS`, defined in `src/domain/characters/avatarOptions.ts`). `optionIds` reads every optional key from `AVATAR_OPTIONAL_OPTIONS`. `selectedOptionValue(config, key)` reads a control's value with the defaults applied. This supersedes the Consequences bullet about the exclusion.
- `describeAvatar` follows design spec 9.4 v2.0. It adds `{shape} face` after the build when the shape is not Oval, and a pattern word between the colour and the garment when the pattern is not Plain: Stripes "striped", Checks "checked", Dots "spotted". Defaults add no words, so existing descriptions are unchanged. This supersedes the last Consequences bullet.
