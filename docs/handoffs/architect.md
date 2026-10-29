# Handoff: architect

## Summary
Change request CR-1 (requirements v0.3, approved 29/10/2026): I settled the schema for the per-character gender option and for Visitor facial hair in ADR 0020. I also landed the shared types in the contract, so every build agent works from one definition, and updated `docs/architecture.md` (v1.3) and `docs/api.md` (v1.1). The change is additive. `gender` is optional on each `AvatarConfig` and a missing value means `neutral`, so there is no version bump and no database migration. I re-measured the character triangle budget: the real worst case is 5,878 of 6,000. Distinct Woman and Man bodies and faces fit only if they reshape the existing meshes and add no triangles.

Earlier rounds (scaffold, integration round 1, QA phase 6) are unchanged; see ADRs 0001 to 0019 and architecture section 17.

## Files changed
- `supabase/functions/_shared/contract.ts`: added `AVATAR_GENDERS` (`feminine`, `masculine`, `neutral`, in display order), `AvatarGender`, `DEFAULT_AVATAR_GENDER`, `isAvatarGender()` and `avatarGender()`. Added optional `gender?: AvatarGender` to `AvatarConfig`. Updated the `facialHair` comment (both characters) and the version-bump rule in the header. No behaviour change: the helpers are not called yet.
- `src/lib/avatars.ts`: one-line compile fix. `AvatarOptionKey` now also excludes `'gender'` (with a comment), so the generic builder helpers still type-check. The frontend-developer removes this when adding the control.
- `docs/decisions/0020-avatar-gender-field.md`: new ADR covering ids, placement, versioning, read and write rules, validation, compatibility matrix, deploy order and kit budget rules.
- `docs/architecture.md`: v1.3. Updated sections 1 (summary row), 6.7 (options, new Gender row, budget 5,878), 7.1 (avatar columns), 7.3 (publish rules), 12 (triangles per character), 15 (two new risks), 16 (ADR 0020) and 17 (change log).
- `docs/api.md`: v1.1, written at the caller's request although the file belongs to the backend-developer. Header note that implementation is pending, examples with `gender`, a note that responses always include `gender`, a new "Avatar settings" table under `publish`, the Visitor facial hair rule removed, and a change log row.

## Decisions
- **Ids `feminine`, `masculine`, `neutral` (PM proposal confirmed).** They describe the shape, not the person (A-20), and are decoupled from the labels Woman, Man and Neutral. `woman`/`man`, `female`/`male` and single letters were rejected (ADR 0020, section 1).
- **Optional `gender` on each `AvatarConfig`, kept out of `AVATAR_OPTIONS`.** `AVATAR_OPTIONS` keys are all required in a v1 avatar and the validator loops over them. An optional type matches stored data, which has no `gender` before v0.3.
- **One read rule: `avatarGender(config)`.** A missing or unknown value gives `neutral`, so nothing ever renders an unknown value and rendering never throws.
- **No version bump.** Avatar `v` stays `1`. `CONTRACT_VERSION` and `museums.content_version` stay `1`. The draft key stays `surprise-museum:draft:v1` with version `1`. Bumping the draft version would make `parsePersistedDraft` discard every draft. A `v: 2` with a migrator was rejected because old rows are never rewritten, so `v: 1` must be accepted forever anyway.
- **Write rules.** The builder always writes an explicit `gender`. `publish` stores `neutral` when it is absent. `get-museum` and `manage-museum get` always return `gender`, filling `neutral` for old rows without rewriting them.
- **Validation.** Absent `gender` is valid. Any value present but not in the list (including `null`) gives 400 `bad_request` with `field` `document.<visitorAvatar|guideAvatar>.gender` and the message "Choose one of the available options." The Visitor `facialHair` must-be-`none` rule and its error message are removed.
- **No database migration.** The avatar columns are `jsonb` with an object-type check only.
- **Deploy order.** In live mode, the Edge Functions go first. A new app bundle against the old functions cannot publish, because `gender` is rejected as an unknown key and a Visitor beard is rejected as Guide only.
- **Budget recommendation: ship full FR-73 (body and face), no fallback needed, under strict rules.** Gender variants must keep the same topology for all three genders. They change ring radii, joint positions, a jaw and cheek displacement of the existing head ellipsoid, and the brow, eye and mouth parameters. They add 0 triangles and 0 draw calls, at most 8 kB to the three.js chunk, and no new three.js classes. Neutral stays bit-identical. The requirements fallback applies only if same-topology faces cannot read clearly.

### Budget check (measured 29/10/2026)
I built 960 rigs: every body type, hair style, outfit and facial hair option, with skin tones `skin-01` and `skin-10`.

| Measure | Result |
|---|---|
| Worst character | **5,878 triangles** (`slim`, `curly-short`, `suit`, `full-beard`, `skin-10`, Guide) |
| Why it differs from the documented 5,750 | The existing budget test checks only `skin-04` with `broad`. Deep skin tones add eye whites (sclera), which the test never covers |
| Lightest character | 4,274 triangles |
| Headroom | **122 triangles**. One extra 8 x 5 ellipsoid pair (about 160 triangles) would break the budget |
| Draw calls | 3 of 10, unchanged by gender |
| three.js chunk (`NameLabel-*.js`, which contains the kit) | 968.83 of 1000 kB minified, unchanged after this change. The chunk budget plugin warns above 1000 kB; it does not fail the build |

## Verification (29/10/2026)
| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | 44 files, 563 of 563 passed |
| `npm run build` | Pass. three.js chunk 968.83 kB, the same hash as before |
| Prettier on the changed files | Pass |
| `deno check` / `deno test` | Not run: Deno is not installed on this machine. `contract.ts` uses only erasable syntax and has no imports, as its rules require |

## Assumptions
- The caller's instruction let me change `contract.ts` (backend-developer) and `docs/api.md` (backend-developer) so the build agents share one definition. I limited code edits to additive types and helpers plus a one-line compile fix in `src/lib/avatars.ts` (frontend-developer). I made no validator, UI, scene or kit changes.
- The design spec's gender shape table and the 250 ms preview morph (ux-ui-designer, in progress) are the target look. I read them but did not edit them.
- No live Supabase museums depend on a stricter `gender` behaviour. A museum published before the functions deploy simply has no `gender` and reads as Neutral.

## Open questions
- None that need the user. Deploy timing for live mode (functions before Pages) is a release step for the devops-engineer.
- Still open from earlier rounds: entrance hall length (user), the `heic-to` LGPL review (legal), the Supabase plan (user).

## Requests for other agents
Order: backend-developer first. Then the scene-developer's defaults change, then technical-artist, frontend-developer and qa-engineer in parallel. **Do not add `gender: 'neutral'` to the default configs until the validator accepts `gender`.** If you do, every publish in mock mode fails with "Unknown avatar setting."

- **backend-developer** (`supabase/functions/_shared/validate.ts`, `present.ts`, mock, tests):
  1. In `validateAvatar`, allow the key `gender`. If it is `undefined`, output `'neutral'`. Otherwise require `isAvatarGender(value)`, else fail with `field` `${field}.gender` and the message "Choose one of the available options." (`null` fails too.) Keep rejecting other unknown keys.
  2. Delete the Visitor facial hair rule (`role === 'visitor' && out.facialHair !== 'none'`). Keep or drop the now-unused `role` parameter, as you prefer.
  3. In `toMuseumContent` (which `toMuseumDocument` also uses), return each avatar with `gender: avatarGender(avatar)`. Do the same wherever the mock (`src/api/mockClient.ts`) builds `MuseumContent` or `ManageGetResponse` from stored demo state, so old demo data reads as Neutral. Do not rewrite stored rows.
  4. Tests: invert the "Guide only" cases in `src/api/__tests__/validate.test.ts` and `mockClient.test.ts`. Add these cases: absent, `null`, `''`, `'Woman'`, `1` and each valid id; an old record without `gender` comes back as `neutral` from `get-museum` and `manage-museum get`; a round trip keeps every other field. Update `supabase/functions/tests/*` and `supabase/scripts/smoke-test.mjs` to send a `gender` and a Visitor beard. Run `deno check`, `deno lint` and `deno test`.
  5. Review my v1.1 edits in `docs/api.md`. When the implementation lands, remove the "not implemented yet" note in its header.
- **scene-developer** (`src/domain/characters/avatarOptions.ts`, `CharacterView.tsx`, `AvatarPreview.tsx`):
  1. Once the backend change is in, add `GENDER_LABELS: Record<AvatarGender, string>` = Woman, Man, Neutral. Add `gender: 'neutral'` to `DEFAULT_GUIDE_APPEARANCE` and `DEFAULT_VISITOR_APPEARANCE`.
  2. Update `describeAvatar` to the design spec 9.4 template: prefix "woman, " or "man, " only when not Neutral (read through `avatarGender`), and use the new body type phrases "wider hips" and "wider shoulders" (ids unchanged).
  3. Both views rebuild the whole rig when `JSON.stringify(config)` changes. The 250 ms gender morph (design spec 9.5) must not rebuild the rig through that key on every frame. Drive it through a rig-level API agreed with the technical-artist, for example `setAppearance` plus a morph progress value. Keep it preview-only; the visit builds the final shape once.
  4. Confirm that name labels still sit above heads for every gender, body type and height combination (head size and height do not change with gender), and that the preview updates within 1 s (FR-15) with no added per-frame cost.
- **technical-artist** (`src/scene/characters/kit/`):
  1. Add the gender shape from design spec 9.1 to `proportions.ts`, applied first, with body type multiplied on top. Use `avatarGender(config)` from `@contract`, never `config.gender`. Neutral must be exactly 1.00, so today's output is unchanged.
  2. Face: change jaw and cheeks by displacing the existing head ellipsoid vertices, and change brows, eye size and mouth by parameters on the existing parts. **No new mesh, part or segment** (ADR 0020, section 7: 122 triangles of headroom).
  3. In `rig.ts` `setAppearance`, a gender change must rebuild the bind pose (`refreshBones`), the body mesh and the hair mesh (the brows are in the hair mesh).
  4. Extend `kit.test.ts`: run the budget loop over every gender x body type x hair style x outfit x facial hair, with `skin-01` and `skin-10`, for both roles. Assert at most 6,000 triangles and at most 10 draw calls, and identical triangle counts across the three genders for the same other options. Add a Neutral equality test (vertex positions equal to the current output) and the 12 gender x body type width limits from design spec 9.1. Check for clipping across all hair styles, outfits (dress, suit), facial hair and heights.
  5. Keep the kit's growth in the three.js chunk under 8 kB minified, and import no new three.js classes. Report the chunk size after `npm run build`.
- **frontend-developer** (`src/ui/builder/CharactersStep.tsx`, `src/state/`, `src/lib/avatars.ts`):
  1. Remove `'gender'` from the `AvatarOptionKey` exclusion in `src/lib/avatars.ts`. Teach `optionIds` and `AVATAR_LABELS` about gender: `AVATAR_GENDERS` and `GENDER_LABELS`, since gender is not in `AVATAR_OPTIONS`.
  2. Add the Gender radiogroup (design spec 9.4 and 9.5: first group on the Body tab; Woman, Man, Neutral; helper text; Neutral shown selected), keyboard operable, for both characters.
  3. Show Facial hair for the Visitor: drop `guideOnly` in `CharactersStep.tsx`, the Visitor guard in `builderStore.ts` (line 128), and the forced `facialHair: 'none'` in `draft.ts` (`buildDocument` and `buildPreviewContent`).
  4. `draftPersistence.ts`: restore `gender` only if `isAvatarGender` passes, otherwise keep the default. Do **not** change `DRAFT_STORAGE_KEY` or `DRAFT_STORAGE_VERSION`. Old drafts without `gender` must restore as Neutral with every other choice kept.
  5. `avatarsEqual` compares `Object.keys(a)` only, so an avatar with no `gender` equals one with `'feminine'`. Compare `avatarGender(a) === avatarGender(b)` plus the other keys.
  6. FR-76: audit app-written strings for gendered pronouns and nouns, and add a guard unit test.
  7. Update `stores.test.ts` and `draft.test.ts`, which currently assert Guide-only facial hair.
- **qa-engineer** (`tests/`, `docs/qa-report.md`): derive tests from US-46 to US-48 and ADR 0020:
  - Preview within 1 s; keyboard radiogroup; reload persistence.
  - A legacy `surprise-museum:draft:v1` draft with no `gender` restores as Neutral.
  - A legacy published museum or demo record with no `gender` loads and looks identical. Use visual regression against the current baselines, which must not change for Neutral.
  - Unknown gender values are rejected with `field` `document.*Avatar.gender`.
  - A Visitor beard publishes and renders.
  - Gender is independent of every other option.
  - Pronoun scan, and identical app text for every gender.
  - Preview equals published for every gender combination.
- **devops-engineer** (not in the original list): for live mode, run the manual functions deploy (`supabase functions deploy`, then the smoke test) with the new validator **before** the frontend change reaches `main`. No `supabase db push` is needed. CI also needs `deno check`, `deno lint` and `deno test` on the contract change, which I could not run locally.
