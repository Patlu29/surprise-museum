# 0020: Avatar gender is an optional field with a read-time default, and facial hair is open to both characters

## Status
Accepted (29/10/2026, change request CR-1, requirements v0.3). Amends ADR 0008 (the kit gains gender parameters) and the facial hair rule in `docs/api.md` (the Visitor is no longer limited to `none`).

## Context
CR-1 (FR-72 to FR-76, A-3, A-20 to A-22, US-46 to US-48) gives each character a gender option: Woman, Man or Neutral. It changes only the base body shape, proportions and face. Neutral is the default and must be exactly today's shape. Facial hair is now offered to both characters (Q-23).

Forces:
- **Data already exists without the field.** Published museums (`museums.visitor_avatar`, `museums.guide_avatar`, jsonb), the builder draft in localStorage (`surprise-museum:draft:v1`) and the persistent demo mock (ADR 0015) all hold `AvatarConfig` objects with no `gender`. All of them must load as Neutral, with no error and no Creator action (FR-75, US-47).
- **The validator rejects unknown keys** and requires every `AVATAR_OPTIONS` key (`supabase/functions/_shared/validate.ts`). The mock runs the same validator, so a change there reaches mock and live together.
- **`parsePersistedDraft` drops a draft whose `version` differs**, so bumping the draft version would silently discard every Creator's draft.
- **The frontend and the Edge Functions deploy separately.** Pages deploys on every push to `main`; the functions deploy is a manual workflow.
- **Triangle headroom is small.** The worst character today is 5,878 of 6,000 triangles (see "Kit constraints").

## Decision

### 1. Stored ids: `feminine`, `masculine`, `neutral` (PM proposal confirmed)
| Option considered | Verdict |
|---|---|
| `feminine`, `masculine`, `neutral` | **Chosen.** The ids describe the shape, which matches A-20 (a styling choice for a cartoon, not a record about a person). They are decoupled from the labels, so the copy (Woman, Man, Neutral) can change without a data migration. Adjective ids match the style of `slim`, `regular`, `tall` |
| `woman`, `man`, `neutral` | Rejected. Uses display copy as a storage key, and reads as a statement about the person |
| `female`, `male`, `neutral` | Rejected. Sex terms, not styling terms |
| `f`, `m`, `n` | Rejected. Opaque in stored JSON and logs |

Display labels and order (design spec 9.2): `feminine` **Woman**, `masculine` **Man**, `neutral` **Neutral**. The array order is the display order.

### 2. Where it sits: an optional key on each `AvatarConfig`
```ts
// supabase/functions/_shared/contract.ts (landed with this ADR)
export const AVATAR_GENDERS = ['feminine', 'masculine', 'neutral'] as const;
export type AvatarGender = (typeof AVATAR_GENDERS)[number];
export const DEFAULT_AVATAR_GENDER: AvatarGender = 'neutral';
export function isAvatarGender(value: unknown): value is AvatarGender;
export function avatarGender(config: { readonly gender?: unknown }): AvatarGender; // missing or unknown -> 'neutral'

export interface AvatarConfig {
  v: 1;
  gender?: AvatarGender; // absent means 'neutral'
  // ...skinTone, hairStyle, ... unchanged
}
```
- Per character: it lives inside `visitorAvatar` and `guideAvatar`, not on `MuseumDocument`.
- **Not in `AVATAR_OPTIONS`.** Every `AVATAR_OPTIONS` key is required in a v1 avatar and the validator loops over them; `gender` is optional, so it has its own list. This keeps the existing validator loop correct and makes the contract change additive.
- **Optional in the type, on purpose.** The type tells the truth about stored data: old rows, old drafts and old demo data have no `gender`. The compiler therefore forces every reader to handle absence, and the one rule for that is `avatarGender(config)`.

### 3. Versioning: no bump, read-time default
| Version marker | Value | Why |
|---|---|---|
| Avatar `v` | stays `1` | A missing `gender` means exactly the pre-v0.3 shape, so no old reader misreads new data and no new reader misreads old data |
| `CONTRACT_VERSION`, `museums.content_version` | stay `1` | Same reason. The contract header now states the bump rule: bump only for a renamed or removed id, a changed meaning or a new required field |
| Draft key `surprise-museum:draft:v1`, `DRAFT_STORAGE_VERSION` | stay `v1` and `1` | A bump makes `parsePersistedDraft` return `null` and discards the Creator's draft |

A `v: 2` with a migrator was rejected. Old published rows are never rewritten, so the server would have to accept `v: 1` forever anyway; it would add a migrator in three places (Edge Functions, mock, draft restore) and buy nothing over "absent means Neutral". `v: 2` stays reserved for a change that is not backward compatible.

No database migration is needed: the avatar columns are `jsonb` with an object-type check only.

### 4. Reading and writing rules
| Who | Rule |
|---|---|
| Every reader (kit, scene, `describeAvatar`, builder controls, comparisons) | Use `avatarGender(config)`. Never compare `config.gender` directly. Missing or unrecognised values give `neutral`, so a stored document is never rendered with an unknown value |
| Builder (writer) | Always writes an explicit `gender`. Both default configs carry `gender: 'neutral'` |
| `publish` validator | Absent gives `'neutral'` in the validated output, so every museum published from now on stores an explicit value |
| `get-museum` and `manage-museum get` responses | Always include `gender`. Rows without it are returned with `'neutral'`, filled in when the record is presented (`present.ts` and the mock's equivalent). The stored row is not rewritten |

### 5. Validation
**Server (Edge Functions and the mock, one shared `validateAvatar`):**
- Allowed keys become `v`, the `AVATAR_OPTIONS` keys and `gender`. Any other key is still rejected.
- `gender` absent (`undefined`): valid, output `'neutral'`.
- `gender` present: must pass `isAvatarGender`. Anything else, including `null`, a number, `''`, `'Woman'` or `'female'`, is `400 bad_request` with `field` `document.visitorAvatar.gender` or `document.guideAvatar.gender` and the message "Choose one of the available options." The message never echoes the value.
- **Visitor facial hair:** the rule "`visitorAvatar.facialHair` must be `none`" is removed. Both avatars accept every `AVATAR_OPTIONS.facialHair` id. The error "Facial hair is available for the Guide only." no longer exists.

**Client:**
- Draft restore (`src/state/draftPersistence.ts`): keep `gender` only when `isAvatarGender` passes; otherwise use the default (`neutral`). Old drafts have no `gender` and restore as Neutral. `facialHair` is restored for the Visitor too.
- The builder sends what the Creator chose; it no longer forces the Visitor's `facialHair` to `none` in the published document or in the preview content.
- Rendering never throws on a bad value: `avatarGender` maps it to `neutral`. Validation errors only happen on write.

### 6. Backward and forward compatibility
| Case | Result |
|---|---|
| Museum published before v0.3, opened by the new app | Loads; responses fill `gender: 'neutral'`; renders exactly as before (FR-75) |
| Old museum opened for editing (Release 2, `manage-museum get`) | Customiser shows Neutral for both; saving writes `neutral` and changes nothing else (US-47) |
| Old `surprise-museum:draft:v1` draft | Restores as Neutral with every other choice kept |
| Old demo-mock data in IndexedDB or localStorage | Mock fills `neutral` on read, like the server |
| Old cached app bundle, new functions | Sends no `gender`; accepted as Neutral. Ignores `gender` in responses and renders Neutral (as before) |
| New app bundle, **old** functions | Publish fails: the old validator rejects `gender` as an unknown key, and a Visitor beard as Guide only. **Deploy the functions first** |

**Deploy order (live mode):** run the manual functions deploy workflow with the new `validate.ts` and `present.ts` before the frontend change reaches `main`. Mock mode is in one bundle, so it needs no ordering.

### 7. Kit constraints (budget check)
Measured on 29/10/2026 by building every body type x hair style x outfit x facial hair combination with the lightest and the deepest skin tone (960 rigs) using the current kit:

| Measure | Value |
|---|---|
| Worst character | **5,878 triangles** (`slim`, `curly-short`, `suit`, `full-beard`, `skin-10`, Guide). The existing budget test reports about 5,750 because it only checks `skin-04` and `broad`; deep skin tones add the eye whites (sclera) |
| Lightest character | 4,274 triangles |
| Headroom | **122 triangles** |
| Draw calls | 3 (body, hair, blob shadow) of 10 |
| three.js chunk (`NameLabel-*.js`, which contains the kit) | 968.83 of 1000 kB minified; above 1000 kB the build warns (`chunkSizeBudgets` in `vite.config.ts`), which the team treats as a budget breach |

Rules for the kit:
1. **Same topology for every gender.** Gender changes ring radii, joint positions, a vertex displacement of the existing head ellipsoid (jaw, cheeks), and the parameters of the existing brows, eyes and mouth. It adds no mesh, no face part and no segment. Triangle and draw-call counts are identical across the three genders for the same other options.
2. **Neutral is the current code path, bit for bit.** All gender multipliers are 1.00 for Neutral.
3. **Size:** the gender tables and code add at most 8 kB minified to the three.js chunk. Do not import new three.js classes for this change.
4. **Fallback** (requirements note under FR-76) only if rule 1 cannot give a recognisable face: first drop face changes, then defer them to Release 2. FR-72, FR-74, FR-75 and FR-76 ship in every case.

Same topology also makes the design spec's 250 ms preview morph cheap: either interpolate the shape parameters and rebuild the active character's geometry per frame (preview only, one character, about 15 rebuilds), or build the start and end geometries and blend them as a morph target. The visit never morphs; it builds the final shape once.

## Consequences
- Old museums, drafts and demo data keep working with no migration, no version bump and no Creator action.
- Readers must remember `avatarGender(config)`; the optional type makes forgetting it a type error when the value is used as a key, and `avatarGender` is the only sanctioned default.
- New published rows always carry an explicit `gender`; old rows never do. Anything that reads the database directly (not through the functions) must apply the same default.
- A new app bundle against old functions cannot publish. The deploy order above is a release step, not a code guarantee.
- The kit has no triangle room for new face parts. Any future face feature must be paid for elsewhere (for example fewer head segments) or raise the budget through an ADR.
- The Visitor's beard removes a validation rule and an error message; tests that asserted "Guide only" must be inverted.
