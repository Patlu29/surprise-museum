# Requirements: Virtual 3D Photo Museum (working title "Surprise Museum")

Version 0.6.3 | 11/11/2026 | Owner: product-manager | Status: v0.6.3 makes the FR-89 accepted-exception class final (accepted by the user, 11/11/2026). v0.6.2 records the tech-lead decisions on FR-89 measurement (BUG-18). v0.6.1 records the tech-lead reading of NFR-27's chunk budget (see the change log). v0.3 approved 29/10/2026. v0.6 records five tech-lead decisions of 02/11/2026 and 03/11/2026 during the CR-4 build (see the change log). v0.4 (CR-4, Improved UI) requested by the user 02/11/2026 with "spec and build straight away", so there is no separate design approval checkpoint. v0.5 records the user's specific CR-4 feedback of 02/11/2026 (Q-25 to Q-27 answered, then Q-28 and Q-30 to Q-32 answered the same day). Q-29 carries a marked default

## Change log

| Version | Change |
|---|---|
| 0.1 | First draft. MVP assumed a scripted, picture-to-picture tour |
| 0.2 | **Q-1 changed by the user:** free roaming is the main experience and the Guide is an autonomous character that presents a picture when the Visitor comes near it. The scripted tour (Next button, forced sequence) is removed. Live real-time guiding with both characters controlled live is a future phase, and the architecture must not preclude it (NFR-25). Rewritten: FR-5, FR-8, FR-9, FR-11, FR-24 to FR-29, FR-39, FR-62, FR-63, FR-66, NFR-1, NFR-3. New: FR-30, FR-31, FR-32, FR-69 to FR-71, NFR-25, NFR-26, A-15 to A-19. Withdrawn: old FR-37 (merged into FR-31). Q-2, Q-4, Q-5, Q-7 approved; all other questions resolved with the recommended defaults (section 10) |
| 0.3 | **Change request from the user (29/10/2026, local testing): "we need gender changing for the Guide and the Visitor."** Each character gets a per-character gender option (Woman, Man, Neutral) that changes the body shape, proportions and face. **A-3 revised:** gender is now an explicit, optional choice, replacing "no gender label". Changed: FR-13 and FR-14 (facial hair now offered to both characters, so a male Visitor is not boxed in; gender added to both lists), FR-15 (covers gender), A-3, section 5 Must count. New: FR-72 to FR-76, A-20 to A-22, Q-22 to Q-24. Stories: US-6 and US-7 changed; new US-46 to US-48. Recommended priority: Must, into the current MVP (see note under Epic E2). No other requirement changes |
| 0.4 | **Change request CR-4 from the user (02/11/2026): "Improved UI".** Scope: the builder screens, the visit HUD and overlays, the landing (home) page, and the 3D scene look, plus clearer, more defined characters. Direction: **polish the current look** (keep the identity and layout; improve spacing, typography, hierarchy, mobile ergonomics and visual finish). It is not a new visual direction and not a rethink of the flows. Drivers: the app looks plain or dated; the builder feels long or confusing; and specific feedback still to come (Q-25; received in v0.5). ("It is hard to use on phones" was removed as a driver in v0.5.) New epic E10 with FR-77 to FR-94, new NFR-27 to NFR-31, new A-23 to A-28, new Q-25 to Q-29. Stories: new US-49 to US-61. No existing requirement is changed or removed. CR-2 (presentation camera) and CR-3 (photos-not-kept notice) were handled through the design spec and `docs/project-status.md` and are not restated here |
| 0.5 | **User feedback on CR-4 (02/11/2026) answers Q-25, Q-26 and Q-27 and changes scope.** (1) *"If I move to top angle the view is blocked by the ceiling"*: new Must **FR-95** (a camera and scene bug; the scene-developer is already fixing it). (2) *"Character definition needs more freedom to choose face shape and cloth designs"*: this is the real meaning of "more defined" (Q-27), so **new character options are now in scope for face shape and clothing design only**. New Musts **FR-96** (face shape), **FR-97** (clothing style), **FR-98** (clothing pattern), **FR-99** (every gender, neutral labels), **FR-100** (defaults and old data unchanged), **FR-101** (saved, validated and rendered the same everywhere), **FR-102** (grouped under "More options" so the Characters step does not get longer). FR-89 and FR-90 stay as quality guard rails. (3) *"Phones are not hard to use"*: **FR-82 demoted Must to Could, FR-84 demoted Must to Should**; FR-81 and FR-83 stay Must as accessibility guard rails. Changed: FR-13 (lists the new options), FR-89 and FR-90 (cover patterns), **FR-94** (Won't list now excludes everything except face shape and clothing, and the ceiling fix), NFR-27 (budget applies to every option combination), NFR-29 (document gains optional fields only), A-23, A-26, A-28 (trimming order rewritten), section 5 Must count (64), section 8. New: A-29 to A-33, Q-30 to Q-32. Q-25 to Q-27 marked answered. Stories: new US-62 to US-67; US-53, US-57 and US-61 changed |
| 0.6 | **Tech-lead decisions during the CR-4 build (03/11/2026).** (1) **NFR-27 stays at 6,000 triangles per character.** The worst measured character is 5,862 (technical-artist, after the hair fix; art hard stop 5,950), so the provisional 6,500 ceiling in ADR 0021 section 7.3a has lapsed (7.3a step 5) and no budget raise is needed. The performance-optimiser still verifies it (NFR-1, NFR-28). Q-28 and A-29 updated. (2) **FR-80 reworded:** the landing description may be up to two sentences (tech lead decision, 02/11/2026); US-51 changed to match. (3) **FR-88 (time hints) deferred** until there is usability data (Won't this release, was Could); US-56, A-25 and the story map updated. (4) **New FR-103 (Should):** the live character description names face shape and pattern; criteria added to US-63 and US-64. (5) **Known minor issues accepted under FR-89:** 7 of 240 hair edge-contrast cases and the cream outfit on oak (2.29), recorded in a new table under FR-89's group; US-57 and new A-34 updated. Changed: FR-80, FR-88, FR-89 (reference to the accepted-exceptions table), NFR-27, A-25, A-29, Q-28. New: FR-103, A-34. No Must is added or removed (still 64). Stories: US-51, US-56, US-57, US-63, US-64 changed; story map and traceability updated |
| 0.6.1 | **Tech-lead decision (03/11/2026) on NFR-27's chunk budget, after the performance-optimiser split the three.js chunk (commit 1659eb8, `docs/performance.md` part A).** "The three.js chunk" now means the **combined** size of `three-*.js` (vendor, 921.4 kB) and `scene-shared-*.js` (our shared scene code, 66.2 kB): **987.6 kB against the 1,000 kB limit, 12.4 kB spare, accepted for this release**. The out-of-date "about 969 to 971 kB today" text and the v0.6 988.70 kB note are replaced. Slimming the builder preview's unused materials (about 8 to 12 kB) is a follow-up, not a release blocker. Changed: NFR-27 (wording and figures only; the 1,000 kB limit is unchanged), US-61 (one criterion clarifies the combined reading). No Must added or removed (still 64) |
| 0.6.2 | **Tech-lead decisions (11/11/2026) on FR-89 edge contrast, after BUG-18 fix round 1.** (1) FR-89 is measured at **pixel ratio 1.5** (the phone Low tier); 1.0 is a stretch case, reported and not a pass condition; FR-89 now defines a cell and its pass rule. (2) New "Test conditions for FR-89": the audit pins the pixel ratio and drops the polluted first case. (3) **X-1 to X-8 redefined** for the 1.5 method as a **provisional** accepted class (torso and arms and head against linen; afro, braids and curly-short hair against linen and the finale wall), **pending fix round 2; the final list will come from QA's re-test.** The v0.6 rows are kept as superseded. Changed: FR-89, X-1 to X-8, A-34, US-57. No Must added or removed (still 64) |
| 0.6.3 | **User decision (11/11/2026) after QA round 7: the character outline cases still under 3:1 against the pale linen walls are accepted as known exceptions; the linen walls are not lightened.** (1) The provisional class is replaced by a **final** class **X-1 to X-5**, exactly the cells QA measured under 3:1 at pixel ratio 1.5, all against linen: torso and arms; head (hair sweep); afro, braids and curly-short; side-part, bun, buzz, ponytail and shaved (listed colours); pale long-wavy, long-straight and short-crop. (2) Former X-6 and X-7 (finale wall) removed, because no hair case on the finale wall is under 3:1; X-6 to X-8 released and not to be reused. (3) "Test conditions for FR-89" now state the method of the tech lead: screen scale 3, canvas pinned at pixel ratio 1.5, first audit case discarded; pixel ratio 1.0 reported only. (4) Anything outside X-1 to X-5, on any backdrop, still fails FR-89 (oak, runner, finale wall, finale floor, trousers on every backdrop named). Changed: FR-89, test conditions, accepted exceptions, A-34, US-57. No Must added or removed (still 64) |

## 1. Overview

Surprise Museum is a web application that turns a set of personal photos into a personalised virtual 3D museum, designed to be given as a surprise gift. A **Creator** (for example, a boyfriend) uploads photos, writes captions and a closing message, customises the museum, and designs two characters: a **Guide** who resembles the Creator, and a **Visitor** who resembles the recipient. The app produces a shareable link. When the **Visitor** (for example, the girlfriend) opens the link, her character is generated automatically from the Creator's settings. She then walks anywhere in the museum, as in a real visit. The Guide is an autonomous companion: when she comes near a photo, the Guide walks over, stands beside her and presents that photo with the Creator's caption. The Guide and Visitor names are displayed above their characters at all times. The link is most likely opened on a phone from a messaging app. A later phase will let both characters be controlled live by two people online together.

## 2. Goals

| ID | Goal | Measure |
|---|---|---|
| G-1 | A first-time Creator can publish a museum quickly | At least 4 of 5 usability-test participants publish a 10-photo museum and obtain a link in 15 minutes or less, unaided |
| G-2 | A Visitor reaches the experience quickly on a phone | Welcome screen interactive in 5 seconds or less, and scene ready in 8 seconds or less, on a throttled 4G profile on the reference phone |
| G-3 | The experience feels smooth on ordinary phones | Sustained 30 FPS or better on the reference phone during a 20-picture session of free roaming |
| G-4 | A Visitor can explore, trigger the Guide's presentations and reach the closing message without instructions | 5 of 5 usability-test Visitors view at least 80% of the pictures and reach the closing message unaided |
| G-5 | Creator photos stay private | No museum content is discoverable except through its unguessable link; deletion makes content inaccessible immediately |

## 3. Target users

| User | Who they are | Devices and context | Needs |
|---|---|---|---|
| **Creator / Guide** | A gift giver (partner, family member, friend). Non-technical. Builds the museum in one sitting of 10 to 20 minutes. | Phone or laptop. Photos are usually already on their phone. | Simple guided setup, confidence the gift looks right (preview), a link that is easy to send, control over privacy |
| **Visitor** | The recipient. Receives a link by message. Has no account and no prior knowledge. | Mostly a phone (portrait first), often via a messaging app's built-in browser. Sometimes a laptop. | Zero setup, instant start, freedom to wander, a Guide who helps without getting in the way, an emotional payoff |

Secondary users: any occasion where someone gifts a photo exhibition (birthdays, anniversaries, family milestones).

## 4. Core 3D experience

1. **Welcome.** The Visitor opens the link and sees a greeting addressed to them by name with a Start button. Tapping Start also enables sound.
2. **Arrival.** The Visitor's character appears at the museum entrance, styled as the Creator described. The Guide, styled like the Creator, stands beside them. Each has a name label above their head that stays visible throughout. The Visitor is in control immediately.
3. **Free roaming.** The Visitor walks anywhere in the museum (touch joystick, keyboard or mouse), looking at the pictures in any order and lingering as long as they like. There is no fixed route and no Next button.
4. **The Guide presents.** The Guide follows the Visitor at a comfortable distance. When the Visitor comes near a picture and pauses there for a moment, the Guide walks over, stands beside the Visitor and presents the picture with the Creator's caption in a speech panel. When the Visitor walks away, the presentation closes and the Guide follows again. The Guide never blocks the Visitor's path or view.
5. **Looking closer.** The Visitor can tap any picture to view it full-screen and zoom.
6. **Finale.** At the far end of the museum is a finale area (an exit podium). When the Visitor steps into it, the Guide presents the Creator's closing message. The Visitor can replay from the entrance or keep exploring.

The Creator side is a 2D builder (upload, order, caption, name, customise characters, preview, publish) with live 3D previews of the characters and the museum.

## 5. MVP scope summary

The MVP is an **asynchronous, free-roaming visit with an autonomous Guide**: the Creator prepares everything in advance, and the Visitor experiences it in their own time, at their own pace. Nobody needs to be online together. A **live mode**, where both characters are controlled live by two people online together, is a future phase and is not in the MVP; the MVP architecture must not preclude it (NFR-25).

| In MVP (v1) | Deferred |
|---|---|
| Creator builder without an account (private edit link) | Creator accounts and sign-in (Release 3) |
| 1 to 20 photos, captions, ordering, closing message | Live mode, both characters controlled live (future phase, FR-66) |
| Stylised avatar customiser for Guide and Visitor (preset options) | Photo-to-avatar likeness generation (Won't; revisit later) |
| Name labels above both characters | Face photo on name badge (Could, Release 2) |
| One default museum theme with automatic layout (entrance, route, finale) | Multiple themes, wall and frame colours (Release 2) |
| Free roaming with touch, keyboard and mouse controls | "Where next?" hint, viewed progress, picture list (Release 2, Should) |
| Autonomous Guide: follows, presents a picture when the Visitor comes near, never blocks | Guide gestures, accessories (Release 2, Should) |
| Finale area with the closing message, replay and keep exploring | Background music, closing celebration effect (Release 2, Should) |
| Shareable unguessable link; delete; preview | Passcode, expiry, edit-after-publish (Release 2, Should) |
| Mobile-first, keyboard and reduced-motion support, WebGL fallback message | Per-picture voice notes, reveal date, reactions (Could) |

Note on the number of Must requirements: the MVP has 47 functional Musts (42 in v0.2, plus the five gender requirements FR-72 to FR-76 added in v0.3) because each requirement covers one behaviour. They group into ten capabilities: builder, photos, characters, name labels, free roaming, autonomous Guide, museum layout, share and privacy, resilience and accessibility, and live-readiness. CR-4 (v0.4) added 11 more functional Musts, all polish of what already exists. In v0.5 two of those are demoted (FR-82 to Could and FR-84 to Should, because the user says phones are not hard to use), leaving 9 (FR-77, FR-78, FR-81, FR-83, FR-85, FR-86, FR-89, FR-90, FR-92), and the user's feedback adds 8 Musts (FR-95 ceiling fix; FR-96 to FR-102 face shape and clothing design), giving **64 functional Musts** in total (47 + 9 + 8). That is well above the usual limit of about 10, and each was challenged: FR-95 is a bug that blocks the view; FR-96 to FR-102 are one user-requested capability (character options), split into one behaviour per requirement, three of which (FR-99 to FR-101) are inclusion and data-safety guard rails that cost little; the other CR-4 Musts are guard rails or polish already agreed. The trimming orders are in A-28 (CR-4 polish) and A-29 (character options). Items already demoted to Should to keep the MVP lean: music, themes, passcode, expiry, edit after publish, opening greeting, draft recovery, jump-to-picture, hint, viewed progress, finale prompt, accessories and gestures. If the MVP must shrink further, candidates are listed in section 9 (Assumptions, A-14).

## 6. Functional requirements

Priority key: **M** Must, **S** Should, **C** Could, **W** Won't (this release).

### Epic E1: Creator builds the museum

| ID | Pri | Requirement |
|---|---|---|
| FR-1 | M | A Creator can start building a museum without creating an account or signing in |
| FR-2 | M | A Creator can upload 1 to 20 photos in JPEG, PNG, WebP or HEIC format, up to 15 MB per file |
| FR-3 | M | When a file is rejected (wrong type, too large, over the 20-photo limit), the Creator sees the file name and the reason, and all valid files continue to upload |
| FR-4 | M | The Creator sees upload progress for each photo, and can retry a failed upload without re-selecting other photos |
| FR-5 | M | The Creator can reorder, remove and replace photos; the photo order sets the sequence in which pictures are hung along the museum route from the entrance to the finale |
| FR-6 | M | The Creator can add an optional caption of up to 280 characters to each photo |
| FR-7 | M | The Creator must enter a Visitor name and a Guide name (1 to 24 characters each) and can enter a museum title (up to 60 characters); if the title is blank, the museum is titled "A museum for <Visitor name>" |
| FR-8 | M | The Creator can write an optional closing message of up to 1,000 characters that the Guide presents when the Visitor enters the finale area |
| FR-9 | S | The Creator can write an optional opening greeting of up to 500 characters that the Guide presents beside the Visitor after Start, without taking control away from the Visitor |
| FR-10 | M | The system removes embedded metadata (including GPS location) from every uploaded photo before it is stored or served |
| FR-11 | M | The Creator can preview the complete Visitor experience, including free roaming, the Guide's presentations and the finale, before publishing |
| FR-12 | S | If the Creator refreshes or closes the builder before publishing, their work in progress is restored when they return on the same device |

### Epic E2: Characters

| ID | Pri | Requirement |
|---|---|---|
| FR-13 | M | The Creator can customise the Visitor character using: gender (FR-72), skin tone (at least 8 options), hair style (at least 8), hair colour (at least 8), outfit style (at least 5) with primary colour, body type (at least 3), height (at least 3 steps) and facial hair (none and at least 3 styles); from v0.5 also face shape (FR-96), clothing style (FR-97) and clothing pattern (FR-98) |
| FR-14 | M | The Creator can customise the Guide character using exactly the same options as FR-13 (changed in v0.3: facial hair was Guide only) |
| FR-15 | M | Each customisation change, including a change of gender, appears on a live 3D preview of the character within 1 second |
| FR-16 | M | When the Visitor opens the link, the Visitor character is generated automatically from the Creator's saved settings, with no setup step for the Visitor |
| FR-17 | M | The Guide's name and the Visitor's name are displayed above their respective characters' heads at all times while the character is on screen, face the camera, and are not covered by character geometry |
| FR-18 | M | Both characters have an idle animation and a walking animation; the walking animation plays only while the character is moving |
| FR-19 | S | The Guide plays a presenting gesture when beginning a presentation |
| FR-20 | S | The Creator can add accessories to either character (at least glasses and one hat option) |
| FR-21 | C | The Creator can attach a small face photo to a name badge or framed portrait for either character |
| FR-22 | C | The Visitor can adjust their own character's appearance before starting, if the Creator allows it |
| FR-23 | W | Generating a character likeness automatically from uploaded photos (photo-to-avatar) is not supported in this release |
| FR-72 | M | **(New in v0.3)** The Creator can set a gender for each character separately (the Guide and the Visitor) from three options: **Woman**, **Man** and **Neutral**. The option is optional: a new draft starts on **Neutral** for both characters, so the Creator is never forced to pick, and any character can be changed at any time |
| FR-73 | M | **(New)** The gender option changes the character's base body shape and proportions (for example shoulder-to-hip ratio and torso, limb and neck shape) and face (for example jaw, brow, cheek and lip shape), and nothing else. It does not change or reset the Creator's other selections (skin tone, hair, outfit, body type, height, facial hair), and every other option stays available with every gender, so no combination is blocked. Body type and height still apply on top of the gender shape. Gender-neutral is the shape the app uses today |
| FR-74 | M | **(New)** A published museum renders each character with the gender chosen by the Creator, identically on every device, in the builder preview, the Visitor preview and the Visitor's visit. The Creator's choice is saved in the draft (FR-12) and in the published museum, and the published-museum document validates it |
| FR-75 | M | **(New)** A museum saved or published before v0.3, which has no gender value, still loads and renders as Neutral, exactly as it did before, with no error, no migration step for the Creator and no change to its look |
| FR-76 | M | **(New)** Text that the app itself writes into the Visitor experience, the builder and screen-reader descriptions does not use gendered pronouns or gendered nouns (she, her, he, him, girlfriend, boyfriend) for the Guide, the Visitor or the Creator; it uses the character's name, "you" and "your", or neutral wording. The Creator's own captions and messages are shown exactly as typed |

Note on v0.3 priority (FR-72 to FR-76): the gender option is a Must and is recommended for the current MVP rather than Release 2. Reasons: it comes from the user's own testing of the product, so it is a gap in what was agreed rather than a nice-to-have; the characters are the emotional centre of the gift, and an avatar that cannot match the real person undermines FR-13 and FR-14; the schema is cheapest to extend now, before museums are published in volume; and the change is small if it reuses the existing parametric body kit (shape scaling, a few face variants) within the 6,000-triangle character budget. If the technical-artist finds that distinct Woman and Man face models cannot fit the budget, fall back in this order: (1) ship shape and proportion changes only with the current face (FR-73 reduces to body shape), (2) keep Neutral plus Woman and Man shape variants and defer face differences to Release 2. FR-72, FR-74, FR-75 and FR-76 must still ship in every case.

### Epic E3: Welcome and free roaming (the main experience)

| ID | Pri | Requirement |
|---|---|---|
| FR-24 | M | The Visitor first sees a welcome screen showing the museum title, the text "For <Visitor name>" and a Start button |
| FR-25 | M | After Start, the Visitor character appears at the museum entrance with the Guide beside it; the Visitor controls their character and the camera immediately, and no fixed order or sequence is required to see any picture or enter any area |
| FR-33 | M | The Visitor can move their character using a virtual joystick or drag (touch), W A S D or arrow keys (keyboard), and can rotate the camera by dragging (mouse or touch) |
| FR-34 | M | Characters cannot pass through walls, frames or other solid objects, and cannot leave the museum |
| FR-35 | M | The Visitor can select a picture to view it full-screen with its caption, zoom it by pinch or scroll wheel, and close it to return to the same place |
| FR-36 | S | The Visitor can open a list of pictures and move their character to stand in front of any one |
| FR-38 | C | The Visitor can send a simple reaction (for example, a heart) on a picture that the Creator can later see |

### Epic E4: Autonomous Guide and picture presentations

The values in FR-26 to FR-28 are initial settings, to be tuned in playtesting (see A-16). Distances are in metres, in a scene where a typical character is 1.7 m tall.

| ID | Pri | Requirement |
|---|---|---|
| FR-26 | M | When the Visitor character has stayed inside a picture's presentation zone (within 3 m of the picture's front-centre, on the same side of the wall as the picture) for at least 1 second, the Guide walks to a spot beside the Visitor facing the picture, and the caption is shown in a panel labelled with the Guide's name |
| FR-27 | M | A presentation closes when the Visitor moves beyond 4.5 m from the picture (a larger exit distance than the 3 m entry distance, so that it does not flicker at the boundary) or dismisses the panel; the panel then closes and the Guide resumes following the Visitor |
| FR-28 | M | If the Visitor leaves a zone before the 1-second pause, no presentation starts. If the Visitor enters another picture's zone during a presentation, the current presentation closes and the nearest picture's presentation starts after the 1-second pause. At most one presentation is active at a time and presentations are never queued |
| FR-71 | M | For a picture with no caption, the Guide still walks beside the Visitor and faces the picture, but no caption panel is shown; the picture still counts as viewed |
| FR-29 | M | The museum has a finale area at the end of the route (an exit podium). When the Visitor enters it, the Guide stands beside the Visitor and presents the closing message (or a simple "The end" panel if there is none), followed by options to replay from the entrance or keep exploring |
| FR-30 | M | The Guide never stands between the Visitor and the picture being presented, never blocks the Visitor's path (the Visitor can always walk past or through the Guide's position without being stopped), and never hides the Visitor from the camera |
| FR-31 | M | When not presenting, the Guide follows the Visitor at 2 to 5 m, stands idle when the Visitor stops, walks around walls and obstacles without getting stuck, and if more than 8 m away or stuck for more than 3 seconds, reappears beside the Visitor out of the camera's view or with a short fade |
| FR-32 | S | On request, a hint control highlights the nearest picture not yet viewed (for example, a direction arrow and a glowing frame); it does not move the Visitor or the camera |
| FR-37 | - | Withdrawn in v0.2; merged into FR-31 |
| FR-69 | S | The interface shows how many pictures have been viewed (for example, "5 of 12"); a picture counts as viewed once its presentation has started |
| FR-70 | S | When all pictures have been viewed, the Guide says so and the finale area is highlighted; if the Visitor enters the finale with pictures not yet viewed, the Guide asks whether to show the closing message now or keep exploring |

### Epic E5: Museum look and atmosphere

| ID | Pri | Requirement |
|---|---|---|
| FR-39 | M | The museum layout is generated automatically for 1 to 20 photos, with an entrance, a walkable route that hangs the pictures in the Creator's order, and a finale area at the end; each photo is displayed at its original aspect ratio (portrait or landscape) without cropping or distortion |
| FR-40 | M | The default theme lights each picture so that it is clearly legible, with no glare or shadow obscuring the photo |
| FR-41 | S | The Creator can choose one of at least 3 museum themes |
| FR-42 | S | The Creator can choose one of at least 3 background music tracks, or none; music starts only after the Visitor taps Start, and the Visitor can mute and unmute it |
| FR-43 | S | At the closing message, a celebratory visual effect plays (for example, confetti), and does not play when reduced motion is requested |
| FR-44 | C | The Creator can record a short voice note for any picture, played when the Guide presents it |
| FR-45 | C | The Creator can set a reveal date and time before which the link shows a "not yet" message |
| FR-46 | C | The Creator can choose wall and frame colours |

### Epic E6: Sharing, access and privacy (needs backend and storage)

| ID | Pri | Requirement |
|---|---|---|
| FR-47 | M | On publishing, the system generates a unique share link that the Creator can copy |
| FR-48 | S | On a mobile device, the Creator can send the link using the device's native share options |
| FR-49 | M | A published museum is reachable only through its share link, is not listed anywhere, and instructs search engines not to index it |
| FR-50 | M | On publishing, the Creator also receives a separate private edit link, with a warning to save it because it cannot be recovered |
| FR-51 | S | The Creator can edit a published museum (photos, captions, names, characters, messages) using the edit link, and the changes show the next time the share link is opened |
| FR-52 | M | The Creator can permanently delete a museum through the edit link after confirming; the share link stops working immediately |
| FR-53 | S | The Creator can protect the museum with an optional passcode; the Visitor must enter it before any museum content loads |
| FR-54 | S | The Creator can set an expiry date; after it, the link shows an "expired" message and the content is removed |
| FR-55 | M | An invalid, deleted or unknown link shows a friendly "museum not found" screen that reveals nothing about any content |
| FR-56 | M | Before publishing, the Creator must confirm that they have the right to share the photos and that people in them are aware of and comfortable with it, with a link to the terms |

### Epic E7: Loading, resilience and accessibility

| ID | Pri | Requirement |
|---|---|---|
| FR-57 | M | While the museum loads, a loading screen shows progress; it never shows a blank screen |
| FR-58 | M | If a photo fails to load, its frame shows a placeholder with a retry control, and the rest of the museum remains usable |
| FR-59 | M | If WebGL is unavailable, the app shows a clear message explaining the problem and suggesting a supported browser |
| FR-60 | S | If WebGL is unavailable, the app offers a 2D slideshow of the photos and captions in the Creator's order, with the closing message |
| FR-61 | M | Every Visitor action (start, move, dismiss a presentation, open and close a picture, enter the finale, replay) can be completed using only the keyboard |
| FR-62 | M | When the operating system requests reduced motion, the Guide's walk to the Visitor is replaced by a short fade-in beside them, the camera never moves on its own, and the celebratory effect is disabled |
| FR-63 | S | Captions are exposed to screen readers, announced when a presentation starts, and the picture's alternative text is its caption (or "Photo n of N" if there is no caption) |
| FR-64 | M | The Visitor experience and the builder work in portrait and landscape on phones, tablets and desktops, with controls and the caption panel that do not cover the Visitor or the active picture |
| FR-65 | S | The Visitor can open a settings panel to mute sound, choose Auto or Low graphics quality, and increase caption text size |

### Epic E10: Interface polish (CR-4, v0.4)

Intent: polish what exists, plus the three changes the user's feedback added in v0.5 (the ceiling fix FR-95, and face shape and clothing design FR-96 to FR-102). The identity (palette, logo, tone), the layout and the flows stay as they are; the four builder steps and their order are unchanged, and the only new data is the optional character fields in FR-96 to FR-98 (NFR-29). "Surfaces" below means the four areas in scope: the **landing page**, the **builder** (all four steps and its dialogs), the **visit HUD and overlays** (welcome, loading, caption card, picture viewer, picture list, settings, finale card, error screens) and the **3D scene** (museum interior and characters). Reference viewports for checks are in A-23. All new or changed copy follows FR-76 and NFR-23 (NFR-31). Budgets in NFR-27 and NFR-28 apply to every requirement here.

**Visual polish**

| ID | Pri | Requirement |
|---|---|---|
| FR-77 | M | All surfaces use one documented set of spacing, type-size, line-height, corner-radius and elevation scales, and one set of component styles for buttons, fields, cards, dialogs and sheets; a design review of every screen at the reference viewports finds no off-scale values and no two different styles for the same kind of control |
| FR-78 | M | Every screen, dialog and overlay has exactly one visually primary action; secondary actions are visibly lower in emphasis and destructive actions (delete, start again, replace) are visibly distinct from both; headings follow a clear order so that a first-time user can say what the screen is for and what to do next |
| FR-79 | S | Every interactive control shows distinct default, hover (pointer only), keyboard focus, pressed, disabled and loading states; dialogs, sheets and cards open and close with a transition of 250 ms or less; empty and error states (no photos yet, upload failed, museum not found, WebGL unavailable) are designed rather than bare text; all motion is removed or replaced by an instant change when reduced motion is requested (FR-62) |
| FR-80 | S | **(Reworded in v0.6)** On the landing page, the product name, a short description of **no more than two sentences** (the two-sentence description is the tech lead's decision of 02/11/2026) and the **Create a museum** button are all visible without scrolling at 360 by 640 and at 1280 by 720, and the three-step "how it works" content is scannable (short headings, one idea per step); the page adds no 3D content and stays within NFR-2 |

**Mobile ergonomics** (v0.5: the user says phones are not hard to use, so FR-81 and FR-83 stay Must only as accessibility guard rails that protect what already works, FR-84 is Should and FR-82 is Could. Do not restructure a layout that already works for a phone in order to meet FR-82 or FR-84)

| ID | Pri | Requirement |
|---|---|---|
| FR-81 | M | On every surface at 360 px wide, in portrait and landscape, every interactive control (including stepper segments, photo reorder handles, Move up and Move down, remove and replace, dialog buttons, close and dismiss controls, HUD buttons and the arrow buttons) has a touch target of at least 44 by 44 CSS pixels, with at least 8 CSS pixels between adjacent targets, so that a neighbouring control is not tapped by mistake |
| FR-82 | C | **(Demoted from Must in v0.5)** On a phone in portrait, the controls used repeatedly during a task sit within thumb reach: the builder's Back, Next, Preview and Publish actions and the visit's joystick, arrow buttons and the dismiss control for any panel that opens during roaming are in the lower 60% of the viewport, or the same action is also available there (for example, by tapping outside the panel); controls used once or rarely (for example, Settings) may be elsewhere |
| FR-83 | M | At 360 px wide, body text, input text and caption text are at least 16 CSS pixels; helper, label and secondary text are at least 14 CSS pixels; no text anywhere is smaller than 12 CSS pixels; text does not overflow or get cut off so that its meaning is lost; and when the browser text size is set to 200% the builder and the overlays remain usable with no horizontal scrolling |
| FR-84 | S | **(Demoted from Must in v0.5; existing behaviour must not regress)** On phones, bars and HUD controls respect the device safe areas (notch, rounded corners, home indicator); the sticky builder action bar and bottom HUD controls are never hidden behind the browser's address bar or toolbar; and when the on-screen keyboard is open, the focused field stays visible and the builder can still reach its Next action by scrolling or tapping, without the page zooming on focus |

**Builder clarity** (the builder feels shorter through clarity, not by removing steps)

| ID | Pri | Requirement |
|---|---|---|
| FR-85 | M | On every builder step the Creator can see, without opening anything, which step they are on, which steps are complete, and what is still required before publishing (for example, "Add a Guide name"), with each outstanding item leading to the field that fixes it. The existing Preview "what is missing" dialog (US-8) remains and shares the same list |
| FR-86 | M | Each builder step groups its fields into short labelled sections; every field is marked **Required** or **Optional** in text (not colour alone); optional content is visually secondary to required content; and every field that has a sensible default starts filled in. A Creator who supplies only the required inputs (at least 1 photo, a Visitor name, a Guide name and the consent confirmation) can reach Publish by pressing Next three times and then Publish, with no step skipped or removed |
| FR-87 | S | Each builder step opens with a one-line statement of what it is for; field help is shown beside the field (not in a separate page); and a validation message appears next to the field it concerns, in plain language that says how to fix it, when the Creator leaves the field or presses Next, never before they have had a chance to type |
| FR-88 | W | **(Deferred in v0.6; was Could. Tech lead, 02/11/2026: revisit when there is usability data. Not built, not tested and not a release blocker.)** The step list shows a rough time for each step (for example, "about 2 minutes"), based on observed usability-test times |

**Character definition**

| ID | Pri | Requirement |
|---|---|---|
| FR-89 | M | **(v0.6.3: measured at pixel ratio 1.5, the phone Low tier: coarse pointer, no multisampling, lit museum, screen scale 3 with the canvas pinned at 1.5. A cell is an option, body zone and backdrop with at least 25 samples; it passes when its median edge contrast is at least 3:1. Pixel ratio 1.0 is a stretch case: reported only, not a pass condition. The only accepted exceptions are the final class X-1 to X-5 against the linen wall, accepted by the user on 11/11/2026; every other cell on every backdrop must pass. See "Test conditions for FR-89" below.)** At the default visit camera distance on a 360 by 640 phone and in the builder preview, each character's silhouette separates clearly from the floor and walls: head, torso, arms, legs, hands and feet are distinguishable, with an edge or shading contrast of at least 3:1 against the backdrop for every offered skin tone, hair colour and outfit colour. The 3:1 check also covers every outfit pattern from FR-98 (a pattern must not reduce the edge contrast). The technical-artist records any combination that cannot reach 3:1 and the cause (in the technical-artist handoff, `docs/handoffs/technical-artist.md`), and each failure the tech lead accepts is copied to the **Known accepted exceptions** table below this group, which is where FR-89 failures are recorded in these requirements. **(v0.5: quality guard rail, kept at Must; the user's own reading of "more defined" is the option freedom in FR-96 to FR-102)** |
| FR-90 | M | At the default visit camera distance and during a presentation (camera closer), a reviewer can identify, for each character: the eyes, brows, nose and mouth as distinct from the skin; the hair as a shape with volume that is distinct from the head; facial hair when selected; the hands as distinct from the sleeves; and the outfit's top and bottom as separate regions (with or without a pattern from FR-98). The gender differences from FR-73 remain at least as distinguishable as they are today, and the five face shapes from FR-96 are distinguishable from one another within each gender. The improvement applies identically to the Guide and the Visitor, in the customiser preview, the builder preview and the visit (FR-74) |
| FR-91 | S | The idle and walking animations (FR-18) read clearly at the default camera distance: the walk cycle shows a visible stride and arm swing, and the idle shows a subtle movement so that a standing character does not look frozen; reduced motion (FR-62) is still respected |

**Test conditions for FR-89** (v0.6.3, tech-lead decisions of 11/11/2026; this is the sampling method used by both the technical-artist and QA)
- **Screen scale factor 3, renderer canvas pinned at pixel ratio 1.5.** The audit re-applies the ratio before every frame (or records `data-render-dpr-cap`) and rejects any sample taken at another ratio. The 1.5 canvas is scaled up by the browser as on a phone, and the 0.3, 1.0 and 0.5 CSS px edge bands are read in screen pixels. This is the stricter method: reading whole render pixels (screen scale 1.5) gives much higher figures (torso on linen 4.1 against 2.64) and is not valid evidence for FR-89.
- An unpinned run is not valid evidence: the pixel-ratio governor can drop the ratio from 1.5 to 1.0 under load, and QA's unforced figures (53 to 189 cases under 3:1) varied with machine load for that reason.
- **The first audit case of every run is discarded** (it is polluted by extra samples: 647 against about 213), or repeated.
- Wait out the coaching hint toast (8 to 9 s) before sampling, so it does not cover the legs.
- **Pixel ratio 1.0 is reported only.** It is run as a stretch case on a subset and does not fail FR-89 or US-57.
- The earlier supersampled figures (pixel ratio 3) describe no real phone and are not evidence for or against FR-89.

**Accepted exceptions to FR-89** (v0.6.3, **final**). **The user accepted this class on 11/11/2026 to keep the art direction:** the linen walls are not being lightened, so the dim, candle-lit look stays. The class covers exactly the cells QA measured under 3:1 at pixel ratio 1.5 in round 7 (screen scale 3, canvas pinned at 1.5, first case discarded; `docs/qa-report.md`, round 7, BUG-18 residual rows 1 to 13). Every cell is against the **linen wall** only. The v0.6 and v0.6.2 X-labels are replaced by the five below; X-6 to X-8 are released and **not to be reused**. Figures are QA round 7 medians at pixel ratio 1.5.

| Ref | Region and option | Backdrop | Median at 1.5 (QA round 7) | QA rows | Note |
|---|---|---|---|---|---|
| X-1 | Torso and arms, all 12 outfit colours and all 3 patterns | Linen wall | 2.64 to 2.77 | 1 | Cause: the lower wall (dado) and the lit linen, which is pale; the contour cannot get dark enough |
| X-2 | Head (face and neck), in the hair sweep (all hair styles and colours) | Linen wall | 1.77 to 2.46 (3.13 in the outfit sweep, which passes) | 2 | Hair sweep only |
| X-3 | Coiled and curled hair: afro, braids, curly-short, all 11 colours | Linen wall | afro 2.35 to 2.63; braids 1.97 to 2.10; curly-short 1.83 to 2.02 | 3 to 5 | Blob geometry with no triangles left to re-tessellate |
| X-4 | Short and tied hair: side-part, bun, buzz (all 11 colours); ponytail (9 of 11 colours: all except black and dark-brown); shaved (7 of 11 colours: all except ginger, blonde, grey and blue) | Linen wall | side-part 1.91 to 2.10; bun 1.92 to 2.02; buzz 1.94 to 2.11; ponytail 2.30 to 2.94 (blonde 2.30, white 2.32, pink 2.32, ginger 2.37); shaved 2.46 (white) to 2.81 | 6 to 10 | Ponytail black (3.18) and dark-brown (3.14) and shaved ginger, blonde, grey and blue (3.05 to 3.09) pass and are **not** exceptions |
| X-5 | Pale hair on longer and cropped styles: long-wavy blonde, platinum and white; long-straight platinum and white; short-crop platinum and white | Linen wall | long-wavy 2.75 to 2.90 (blonde 2.90, platinum 2.77, white 2.75); long-straight 2.94 (both); short-crop 2.94 to 2.97 (platinum 2.97, white 2.94) | 11 to 13 | Just under 3:1; all other colours of these styles pass (3.0 to 3.28) |

**Anything outside X-1 to X-5 still fails FR-89, on any backdrop.** In particular, these are not exceptions and must pass at pixel ratio 1.5 (QA round 7 shows each passing today, so a regression is a failure):
- **Oak floor:** all zones (trousers 3.15).
- **Claret runner:** all zones (torso 3.72 to 4.11, trousers 3.64 to 3.65).
- **Finale wall:** hair, head, torso and legs. No hair case on the finale wall is under 3:1 (lowest: curly-short black 3.21). The former X-6 and X-7 are withdrawn.
- **Finale floor:** all zones (minimum 3.53).
- **Trousers (legs) on every backdrop**, including the linen wall (3.22 to 3.47).
- On linen, hair not listed above (bob 3.10 to 3.28; long-straight, long-wavy and short-crop in the other colours; ponytail black and dark-brown; shaved ginger, blonde, grey and blue) and the head in the outfit sweep.

At pixel ratio 1.0 (reported only, not accepted and not failed) 505 of 1,058 cells in QA's subset fall under 3:1, including trousers on oak (1.77) and on the runner (1.68); see the QA report. The QA audit encodes X-1 to X-5 as the only allowed failures.

**Superseded (v0.6) rows, kept for the record:**

| Ref (v0.6) | Region and option | Backdrop | Median | Cause (technical-artist) |
|---|---|---|---|---|
| X-1 | Hair, curly-short, blonde | Claret runner | 2.19 | Curls are small 6-sided blobs; the edge band cannot find their facets, and the worst-case hair (1,660 triangles) leaves no triangles to re-tessellate |
| X-2 | Hair, curly-short, blonde | Finale wall | 2.92 | Same |
| X-3 | Hair, curly-short, pink | Claret runner | 2.07 | Same |
| X-4 | Hair, curly-short, pink | Finale wall | 2.42 | Same |
| X-5 | Hair, curly-short, black | Claret runner | 2.22 | Dark hair on a dark backdrop needs the rim, which small blobs do not give |
| X-6 | Hair, curly-short, black | Finale wall | 1.67 | Same |
| X-7 | Hair, bob, black | Claret runner | 2.57 | Black curtain on claret: the rim on the curtain's open edges |
| X-8 | Torso and arms, cream outfit (default Guide) | Oak floor | 2.29 | Cream sleeve against mid-tone oak: rim and sleeve are both light, and the contour covers only part of the samples (10th percentile 1.8; 54% of samples under 3:1). No cheap material fix exists; a real fix is a darker cream sleeve trim or a thicker arm (geometry), left to a later change |

In this superseded table, the old X-1 to X-8 labels are not the final X-1 to X-5 above. Old X-1 to X-7 are the 7 of 240 hair cases (12 hair styles, 4 hair colours, 5 backdrops) that remain after the hair edge fix of 03/11/2026 (51 before it). X-8 is the one failure left on the default character.

**Scene look**

| ID | Pri | Requirement |
|---|---|---|
| FR-92 | M | The museum interior receives a visual finish pass: floor, walls, frames, the finale podium and the lighting are refined (for example, material quality, surface detail, trim, softer light falloff) within the existing identity, without changing the layout; pictures stay clearly legible with no glare or shadow obscuring them (FR-40), and the standing pools, finale podium and other wayfinding cues are at least as visible as before |
| FR-93 | S | The scene adds depth and atmosphere cues (for example, soft contact shadows under characters and frames, a subtle background gradient or ambient detail) on the Auto quality setting; on the Low quality setting (FR-65) they are simplified or removed so that NFR-1 still holds on the reference phone |
| FR-94 | W | **(Changed in v0.5)** Not in CR-4: a new visual direction, a new colour palette or logo, dark mode, new museum themes (still FR-41, Should), accessories (FR-20), new character options **other than face shape and clothing style and pattern (FR-96 to FR-98)**, so no new hair styles, hair colours, skin tones, body types, heights, facial hair styles or genders, new builder features or steps (the "More options" grouping in FR-102 is a layout of existing steps, not a new step), changes to the controls or Guide behaviour, changes to the camera **other than the ceiling fix in FR-95**, or any change to the data model **other than the optional character fields in FR-96 to FR-98 (FR-100, NFR-29)** |

**Camera and scene fix** (v0.5, from the user's feedback: "If I move to top angle the view is blocked by the ceiling")

| ID | Pri | Requirement |
|---|---|---|
| FR-95 | M | **(New in v0.5)** At every camera angle and height the Visitor can reach (by drag, pinch, scroll wheel or any keyboard camera control, in the visit, the preview and the builder's museum preview), the ceiling never blocks the view of the room: the floor, both characters, and the pictures and finale podium near the Visitor are never hidden behind ceiling geometry. A fade or cutaway of the ceiling is preferred to a hard clamp on the camera angle; a clamp may be used only if the user-reachable range still lets the Visitor look down on the room (for example, from a high angle) and the camera never enters a ceiling or wall. From the default camera angle the interior looks as it does today (enclosed, ceiling visible), the change does not flicker as the camera crosses the boundary, it adds no camera motion that the Visitor did not cause (FR-62), and under reduced motion any fade is instant. NFR-1 still holds |

**Character options** (v0.5, from the user's feedback: "Character definition needs more freedom to choose face shape and cloth designs"). The only new options in scope are face shape, clothing style and clothing pattern; everything else in FR-94 stays excluded. Option counts below are working defaults (A-29): the build may offer more, never fewer

| ID | Pri | Requirement |
|---|---|---|
| FR-96 | M | **(New in v0.5)** The Creator can choose a **face shape** for each character from at least 5 options (working set: oval, round, square, heart, long). The default is **oval** and renders exactly the face the character has today (A-30). Each shape changes the face outline and proportions only, and stacks on top of the gender face from FR-73 without replacing it. Within each gender the five shapes are visibly distinct from one another in the customiser preview |
| FR-97 | M | **(New in v0.5)** The Creator can choose a **clothing style** for each character from **12 or more** options (Q-30, answered: "Double the styles"). Today's six outfit styles (T-shirt and jeans, Hoodie, Shirt and trousers, Dress, Suit, Jumpsuit) are kept unchanged, none removed or renamed in a way that changes a saved choice, and about six new styles are added to them. Every style, old and new, meets FR-99 (no gender-locked garment) and the NFR-27 budget on its own (the worst single style is what is checked, not a sum). The default is the character's current default style, so nothing changes unless the Creator chooses. The existing outfit colour (FR-13) still applies to every style |
| FR-98 | M | **(New in v0.5)** The Creator can choose a **clothing pattern** for each character from at least 4 options: **plain**, **stripes**, **checks** and **dots**. The default is plain, which is today's look. The pattern is drawn in tints of the chosen outfit colour (no second colour picker; Q-31), and works with every clothing style and every outfit colour, so no combination is blocked |
| FR-99 | M | **(New in v0.5)** Face shape, clothing style and clothing pattern are offered on both the Guide and the Visitor, with every gender (FR-72), with identical lists. No garment, pattern or face shape is tied to a gender: changing the gender never changes, resets or hides these choices (extends FR-73), and their labels describe the shape or the garment, not the wearer (for example "Dress", "Round", never "Women's" or "for men"), following FR-76 and NFR-31 |
| FR-100 | M | **(New in v0.5)** The new choices are optional in the data. A museum or draft saved or published before this change, which has no value for them, still loads without error and renders exactly as it did before: oval face shape, its existing clothing style and plain pattern. There is no migration step for the Creator, and a new draft starts on the same defaults |
| FR-101 | M | **(New in v0.5)** The Creator's choices are saved in the draft (FR-12) and in the published museum, and the same character renders identically in the customiser preview, the builder preview, the Visitor preview and the Visitor's visit, on every device (extends FR-74). The published-museum document validates the new fields: an absent value is accepted; an unrecognised value or one of the wrong type is rejected with a clear validation error and is never stored or rendered |
| FR-102 | M | **(New in v0.5)** On the builder's Characters step, face shape, clothing style and clothing pattern sit under a clearly labelled **More options** group (or an equivalent short disclosure) so that the step does not feel longer: with the group closed, the step shows no more controls and is no taller than it is today at 360 by 640 and 390 by 844, and the group opens and closes with the keyboard and by touch. Every change inside the group updates the live preview within 1 second (FR-15). FR-86 still applies: the fields are marked Optional in text, start filled in, and the three-Next path to Publish is unchanged |

**Character description** (added in v0.6, from the tech-lead decision that the architect adds face-shape and pattern words to the live description)

| ID | Pri | Requirement |
|---|---|---|
| FR-103 | S | **(New in v0.6)** The live description of each character in the customiser (the text beside the 3D preview that a screen reader announces when a choice changes, FR-15, FR-76) names the chosen **face shape** and the chosen **clothing pattern** whenever either is not its default (oval, plain), in the same debounced update as the other choices. Defaults may be omitted, as gender is omitted when Neutral (US-46). The words describe the shape or the pattern, never the wearer (FR-99, FR-76), and are Australian English (NFR-23). The exact wording and position are for the designer and the architect; the clothing style and the existing choices are still named |

### Epic E8: Future (not in this release)

| ID | Pri | Requirement |
|---|---|---|
| FR-66 | W | Live mode: the Creator and Visitor are online together and each controls their own character live (needs a real-time backend). Future phase; the MVP must not preclude it (NFR-25) |
| FR-67 | W | Creator accounts, sign-in, and a dashboard of museums. Release 3 candidate |
| FR-68 | W | More than one Visitor at a time, VR or AR modes, native mobile apps, payments |

## 7. Non-functional requirements

Reference devices (assumption A-8): **Reference laptop** is a 2022 mid-range laptop with integrated graphics. **Reference phone** is a 2022 mid-range phone, for example an iPhone 12 or a Samsung Galaxy A54 class device. **4G** means a throttled profile of about 9 Mbps down, 1.5 Mbps up and 170 ms round trip.

| ID | Pri | Area | Requirement |
|---|---|---|---|
| NFR-1 | M | Frame rate | The Visitor scene sustains an average of at least 60 FPS on the reference laptop and 30 FPS on the reference phone over a 60-second period of free roaming in a 20-picture museum that includes at least 5 Guide presentations |
| NFR-2 | M | Initial load | The welcome screen is interactive within 5 seconds of opening the link on 4G |
| NFR-3 | M | Scene ready | After Start (or after opening the link, whichever is later), the characters and the entrance area are rendered within 8 seconds on 4G; remaining pictures load nearest-first (by distance from the Visitor) while the Visitor plays, and a picture never appears blank without a placeholder |
| NFR-4 | M | Download size | The first view (welcome screen, characters and museum shell) downloads in under 10 MB, excluding the Creator's photos |
| NFR-5 | M | Photo delivery | Each photo is delivered at a size suited to display (no more than 2048 pixels on the long edge, with a target of 600 KB or less per photo on mobile), so that a 20-picture museum totals roughly 12 MB of photos |
| NFR-6 | M | Memory stability | A 15-minute session with a 20-picture museum on the reference phone completes without the browser tab crashing or reloading |
| NFR-7 | S | Battery and heat | Rendering pauses when the tab is hidden, and mobile rendering is capped at 30 FPS |
| NFR-8 | M | Browsers | Latest two major versions of Chrome, Edge, Safari (macOS and iOS) and Firefox |
| NFR-9 | S | In-app browsers | The Visitor experience works in the built-in browsers of common messaging apps (for example WhatsApp, Messenger, Instagram); where it cannot, it shows a message with an "Open in browser" hint |
| NFR-10 | M | Devices | Phone (360 pixels wide and above), tablet and desktop; portrait and landscape; touch, mouse and keyboard input; touch targets at least 44 by 44 CSS pixels |
| NFR-11 | M | WebGL | Behaviour when WebGL is unavailable is defined by FR-59 and FR-60; if the graphics context is lost, the app shows a message and offers to reload |
| NFR-12 | M | Accessibility | The builder and all 2D overlays meet WCAG 2.2 AA; name labels and captions have a contrast ratio of at least 4.5:1 against their backing; core 3D actions have keyboard alternatives (FR-61); reduced motion is respected (FR-62) |
| NFR-13 | M | Privacy | The Visitor is never asked for personal data; no third-party advertising or tracking; the only personal data held is what the Creator supplies (photos, names, captions, messages), used solely to deliver the museum; a privacy policy is linked from the builder and the welcome screen |
| NFR-14 | M | Legal | The service complies with the Australian Privacy Act 1988 and Australian Privacy Principles as applicable; the privacy policy and terms are reviewed by the organisation's legal team before launch |
| NFR-15 | M | Security | Share and edit links contain random tokens of at least 128 bits; all traffic uses HTTPS; photo URLs are not guessable or listable; uploads are validated by content (not only file name); upload and link-lookup endpoints are rate limited |
| NFR-16 | M | Retention | A museum remains available for at least 90 days from publishing unless deleted; deleted or expired content is purged from live storage within 7 days and from backups within 30 days |
| NFR-17 | S | Data location | Creator content is stored in an Australian region where practicable |
| NFR-18 | M | Builder performance | Publishing a 20-photo museum completes within 90 seconds on 4G, with progress shown |
| NFR-19 | M | Usability | Goals G-1 and G-4 are met in usability testing with at least 5 participants each |
| NFR-20 | S | Availability | The Visitor view is available 99.5% of each month |
| NFR-21 | S | Capacity | At launch, the Visitor view supports 500 concurrent Visitors without breaching NFR-2 and NFR-3 |
| NFR-22 | S | Observability | Errors and load times are recorded without capturing photo content, captions or names |
| NFR-23 | M | Localisation | All copy uses Australian English (colour, customise); dates, when shown, use DD/MM/YYYY; the product is English only in this release |
| NFR-24 | M | Content handling | Audio never plays before a user gesture; the Visitor can mute at any time |
| NFR-25 | M | Live-readiness | The design must not preclude a later live mode (FR-66). Each character's state (position, facing, animation and presentation state) is driven through an abstraction that separates "where the state comes from" from "how it is rendered", so that the local controller (for the Visitor) and the autonomous Guide behaviour can later be replaced or supplemented by a network source without changing the rendering, name labels or caption panel. In the MVP there is no networking; this is verified by architecture review and by a test that drives a character from a scripted, non-local source |
| NFR-26 | S | Guide robustness | In an automated 30-minute run with a simulated Visitor roaming randomly, the Guide is never stuck for more than 10 seconds, never passes through walls, and never blocks the Visitor |
| NFR-27 | M | CR-4 size and geometry budgets | After CR-4: the **three.js chunk** stays under 1,000 kB minified. **(v0.6.1, tech-lead decision of 03/11/2026: "three.js chunk" means the combined size of the vendor chunk `three-*.js` and our shared scene chunk `scene-shared-*.js`, summed as measured by the production build. The figures are 921.4 kB plus 66.2 kB, a combined 987.6 kB, with 12.4 kB of headroom, and that headroom is accepted for this release. Measured by the performance-optimiser, `docs/performance.md` part A, commit 1659eb8.)** Headroom is small, so scene and character improvements must come mainly from materials, parameters, lighting and textures rather than new libraries or code; no character exceeds 6,000 triangles or 10 draw calls (3 today), **for every combination of gender, face shape, clothing style, clothing pattern, hair style, facial hair, body type and height (v0.5; patterns are done with materials or textures at no triangle cost; the limit applies to the worst single style, not to a sum)**. **(v0.6, tech-lead decision: the 6,000 figure stays and no raise is needed.** The worst measured character is **5,862** triangles with 3 draw calls (technical-artist, 03/11/2026, after the hair edge fix), 138 under the limit; the design spec's art hard stop is 5,950. The provisional 6,500 ceiling in ADR 0021 section 7.3a has lapsed under 7.3a step 5. The performance-optimiser verifies the figure on the reference phone, including the Low tier, against NFR-1 and NFR-28, and a build that measures above 6,000 fails this requirement.)** **The v0.6 note of 988.70 kB for the single chunk is superseded: after the chunk split the combined figure is 987.6 kB (see above), and the limit passes if the combined size is under 1,000 kB. Slimming the builder preview's unused materials (about 8 to 12 kB) is a follow-up, not a release blocker, and is not required to pass this requirement.** The first view stays under 10 MB (NFR-4); and the landing page's transferred size, including any fonts, grows by no more than 100 KB (A-27) |
| NFR-28 | M | CR-4 frame rate and load | After CR-4, NFR-1 (60 FPS laptop, 30 FPS reference phone), NFR-2, NFR-3 and NFR-6 are re-measured with the same method and still pass; the Low quality tier still holds 30 FPS on the reference phone; and no layout shift larger than 0.1 (Cumulative Layout Shift) occurs on the landing page or the builder steps during load |
| NFR-29 | M | CR-4 no breaking data or flow change | **(Changed in v0.5)** The published-museum document and the draft storage format change only by gaining the optional character fields in FR-96 to FR-98: no existing field is renamed, removed, made required or given a different meaning, and share and edit links, the four builder steps and their order, and the visit flow are unchanged. Museums published and drafts saved before CR-4 or before v0.5 load and show the improved look with no migration (extends FR-75 and FR-100). Existing acceptance criteria for US-1 to US-48 still pass |
| NFR-30 | M | CR-4 accessibility holds | Polish does not reduce accessibility: text contrast of at least 4.5:1, interface component and focus indicator contrast of at least 3:1, visible keyboard focus on every control, and reduced motion respected (NFR-12, FR-61, FR-62) on all surfaces after restyling |
| NFR-31 | M | CR-4 copy | All new or changed text follows FR-76 (no gendered pronouns or nouns in app-written text) and NFR-23 (Australian English, DD/MM/YYYY where dates appear) |

## 8. Out of scope

- Live, real-time guiding with both characters controlled live, and any multiplayer networking (FR-66). The architecture must not preclude it (NFR-25)
- A forced picture-to-picture tour with a Next button (removed in v0.2)
- Photo-to-avatar or AI likeness generation (FR-23)
- Creator accounts, sign-in and dashboards (FR-67)
- Video upload, user-uploaded music, voice chat
- Visitor-to-Creator messaging
- Payments, plans and pricing. For pricing or contracts, please refer to the Sales team
- Native iOS and Android apps, VR and AR
- Languages other than English (AU)
- Automated content moderation of photos
- CR-4: a new visual direction, new palette or logo, dark mode, new themes, new character options other than face shape and clothing style and pattern (accessories, hair, skin tone, body, facial hair and gender options are unchanged), new builder features, removing or reordering builder steps, changes to the camera other than the ceiling fix, and any change to the data model other than the optional fields for face shape, clothing style and pattern (FR-94)

## 9. Assumptions

| ID | Assumption |
|---|---|
| A-1 | The MVP Guide is an autonomous character, not controlled live; a later phase adds live control of both characters |
| A-2 | The Creator needs no account; a secret edit link controls access, and losing it means the Creator cannot edit or delete (Q-7 approved) |
| A-3 | **Revised in v0.3 (user decision, 29/10/2026).** Characters are stylised (low-poly or cartoon) from a fixed set of options, and each character has an explicit, optional gender choice (Woman, Man, Neutral; FR-72) that sets the base body shape and face. It replaces the earlier approach of expressing gender only through body type and hair with no label. To stay inclusive, the choice is never required (default Neutral), has a Neutral option that does not assume, and does not restrict any other option (FR-73). There is no pronoun field; app-written text avoids gendered pronouns instead (FR-76) |
| A-4 | The camera is third person (follow camera), so both name labels and characters are visible; first-person view is not offered in MVP |
| A-5 | The Visitor controls their own character and the camera at all times; the Guide never moves the Visitor's character or the camera |
| A-6 | The Creator cannot place individual photos on specific walls in MVP; they control only the order along the route, and the layout is automatic |
| A-7 | One Creator publishes one museum at a time per browser; no limit is enforced on the number of museums in total |
| A-8 | Reference devices are as defined in section 7; the performance targets are measured on them |
| A-9 | Anyone with the share link can view the museum, on any number of devices, any number of times, until it is deleted or expires |
| A-10 | The Creator is responsible for having the right and consent to share the photos (FR-56); there is no automated moderation in MVP, but the service provides a contact route for takedown requests |
| A-11 | Music, models and textures used must be licensed for commercial use; no user-uploaded audio |
| A-12 | Aggregate, non-personal usage analytics may be added later; none is required in MVP (Q-14) |
| A-13 | Launch volumes are low (a gift product with spikes around occasions such as Valentine's Day, birthdays and Christmas); NFR-21 reflects that |
| A-14 | If the MVP must shrink, the least damaging Must items to demote are, in order: the facial hair part of FR-14, the retry part of FR-4, the retry control in FR-58, and the tour part of FR-11 (keep a plain roaming preview). Core items such as FR-17 (name labels), FR-25 to FR-31 (roaming and Guide), FR-29 (finale), FR-47 to FR-52 (sharing and privacy) and NFR-25 (live-readiness) must not be demoted |
| A-15 | **Closing message trigger (proposed, please confirm):** the finale area is an exit podium at the end of the museum route. Entering it triggers the closing message regardless of how many pictures have been viewed (FR-29). In Release 2, the Guide hints when all pictures are viewed and asks for confirmation if some are not (FR-70). Replay returns the Visitor and Guide to the entrance and clears the viewed count; the Visitor can step back into the finale at any time to see the message again |
| A-16 | Proximity values (3 m entry, 4.5 m exit, 1 second pause, Guide follow distance 2 to 5 m) are starting points to be tuned in playtesting on a phone; the requirement is that the behaviours in FR-26 to FR-31 hold, whatever the final numbers |
| A-17 | A picture counts as viewed once its presentation has started (FR-69); a Visitor who opens a picture full-screen (FR-35) without being presented also counts it as viewed |
| A-18 | The Guide's body does not collide with the Visitor's character; when they overlap, the Guide yields by moving aside (FR-30) |
| A-19 | Re-approaching a picture presents it again; if the Guide is already beside the Visitor, it does not walk |
| A-20 | **(v0.3)** "Gender" here is a visual styling choice for a cartoon character, not a record about a person. It is stored only as part of the character settings, is not shown to the Visitor as a label, and is not used for anything but rendering (NFR-13 unchanged) |
| A-21 | **(v0.3)** Changing gender never auto-changes hair, outfit or any other option on an existing draft. On a brand-new draft, the starting defaults stay as in the design spec section 9.3 (Neutral). Optional "suggested look" presets per gender are not part of this change |
| A-22 | **(v0.3)** The Visitor character's gender is chosen by the Creator, as with every other option (Q-11); the Visitor cannot change it before starting unless FR-22 (Could) is built later |
| A-23 | **(v0.4; Q-26 answered in v0.5, the user named no device and says phones are not hard to use, so these stay as the regression reference)** Reference viewports for CR-4 checks: phone portrait 360 by 640 (floor) and 390 by 844 (typical); phone landscape 640 by 360 and 844 by 390; tablet 768 by 1024; desktop 1280 by 720. Text reflow is also checked at 320 px wide (WCAG 1.4.10) |
| A-24 | **(v0.4)** "Polish the current look" means the colour identity, logo, tone, screen layouts and flows stay recognisable. Changing spacing, type sizes and weights, corner radii, shadows, icons, illustration, motion timing, material and lighting quality is in scope. A before-and-after comparison of each surface should look like the same product, finished |
| A-25 | **(v0.4)** "The builder feels long" is addressed through clarity (FR-85 to FR-87; FR-88, the time hints, was deferred in v0.6 until there is usability data): progress, grouping, required and optional marking, and defaults. Steps are not removed, merged or reordered and no new data is collected. If usability testing still finds the builder too long, merging steps is a later, separate change request |
| A-26 | **(Revised in v0.5; Q-27 answered by the user.)** "Characters should be more defined" means the Creator wants **more freedom to choose face shape and clothing designs** (FR-96 to FR-102). The earlier reading (clearer silhouette FR-89, clearer face, hair, hand and outfit detail FR-90, clearer walk and idle FR-91) is kept as a quality guard rail so that the new options also read clearly, but it is no longer the main driver. The cartoon, low-poly style is kept. The v0.4 assumption "no new character options" is withdrawn for face shape and clothing only |
| A-27 | **(v0.4, default for Q-29)** The current typeface family is kept. Sizes, weights and line heights may change. If a different or additional web font is wanted, the home page stays within the 100 KB growth limit in NFR-27 and shows no layout shift while it loads |
| A-28 | **(v0.4, rewritten in v0.5)** If CR-4 polish must shrink, trim in this order. First the items already demoted: FR-82 (Could) and FR-84 (Should), then the other Shoulds and Coulds in the order in the story map. Then, among the Musts: FR-86 (keep Required and Optional marking and the defaults, drop the three-presses path; but FR-102 depends on the marking, so keep the marking), FR-92 (keep materials and trim, drop lighting changes), FR-90 (keep the face and hair, drop the hands and outfit regions). **Never demote** FR-81 and FR-83 (accessibility guard rails), FR-85, FR-89, FR-95 (the ceiling bug), FR-99 to FR-101 (inclusion and data safety), or NFR-27 to NFR-30 |
| A-29 | **(v0.5, updated after Q-28 and Q-30)** Option counts are working defaults: 5 face shapes, 12 clothing styles (today's 6 plus about 6 new) and 4 patterns. The build may offer more, never fewer than today's look. **(v0.6: all 5 face shapes, 12 styles and 4 patterns fit the unchanged 6,000-triangle budget, so this trimming order is not needed; it stays as the order to follow if a later change breaks the budget.)** If the technical-artist cannot fit them in the budget (NFR-27, which stays at 6,000), trim character options in this order and tell the product-manager: (1) **drop the new clothing styles, one at a time, down to as few as 3 new styles** (today's 6 are never dropped, so 9 styles minimum); (2) only then reduce face shapes from 5 to 3 (oval, round, long) done by scaling only; (3) then reduce patterns to plain, stripes and dots. Never trim below today's look, and FR-99 to FR-101 must still ship in every case. Patterns should be done with materials or textures, not geometry |
| A-30 | **(v0.5)** Face shape works on top of gender: the gender sets the base face (FR-73) and the face shape modifies the outline and proportions. "Oval" is assumed to be today's face (the technical-artist may call it something else if today's face is closer to another name, but the default must be the unchanged face). Neither choice changes the other (FR-99) |
| A-31 | **(v0.5, updated after Q-30)** The user chose "Double the styles": today's six outfit styles stay unchanged and about six new ones are added, about 12 in total (FR-97). Dress and Suit already appear for every gender, and every new style must too. Which six garments are added is the designer's and technical-artist's proposal, to be agreed with the product-manager for neutral labels (FR-99, FR-76) |
| A-32 | **(v0.5)** The ceiling fix (FR-95) is a bug fix to the scene's camera and ceiling. It is in progress with the scene-developer and does not change the controls, the camera's default position or the Guide's behaviour. Whether it is a fade (ADR 0014 already fades partitions), a cutaway or a clamp is the architect's and scene-developer's choice, with fade or cutaway preferred |
| A-33 | **(v0.5)** The Visitor cannot change their own face shape or clothing before starting (consistent with A-22 and Q-11); the Creator chooses for both characters. No "suggested look" presets are added |
| A-34 | **(v0.6, redefined v0.6.2, final v0.6.3)** The accepted exceptions to FR-89 (X-1 to X-5, table under FR-89's group) are a **final** class measured by QA in round 7 at pixel ratio 1.5 (screen scale 3, canvas pinned) in the lit museum, all against the linen wall, and **accepted by the user on 11/11/2026 to keep the dim, candle-lit art direction (the linen walls are not lightened; no further fixes are proposed for them)**. They replace the v0.6 list measured against flat backdrops with a supersampled canvas. They cover exactly the cases listed. They do not extend to the other 7 hair colours, which the 240-case hair re-run did not cover (the earlier 02/11/2026 run found light grey, white and ginger hair under 3:1 on oak before the hair fix), or to the cases the technical-artist has not yet measured (doorway grazing angles, dark hair against the ceiling at a low pitch, the runner edge, the larger builder preview, WebKit and Firefox, the lit museum). If a re-measurement finds a new failure, it is recorded and the tech lead decides whether to accept it |

## 10. Open questions

Q-1 to Q-28 and Q-30 to Q-32 are resolved; the status column shows how. Only Q-29 (typeface) still carries a default. "Approved" means the user explicitly approved it; "Default" means the user accepted the recommended default; "Answered" means the user replied in their own words. Q-21 is a new assumption for the user to confirm and can be deferred. Q-22 to Q-24 (v0.3) were approved by the user on 29/10/2026 as recommended. **Q-25 to Q-27 were answered by the user on 02/11/2026.** Q-29 (v0.4) carries a marked default. **Q-28 and Q-30 to Q-32 were answered by the user (or confirmed by the tech lead from the user's words) on 02/11/2026.** Nothing blocks design or build.

| ID | Question | Status and decision | Impact |
|---|---|---|---|
| Q-1 | **Guide mode.** Scripted tour, live, or both? | **Resolved (changed by the user).** Free roaming is the main experience; the Guide is an autonomous character that presents a picture when the Visitor comes near it (FR-25 to FR-31). Live mode with both characters controlled live is a future phase (FR-66), and the architecture must not preclude it (NFR-25) | Removes the scripted tour. No real-time backend in MVP. Adds Guide behaviour, proximity logic and path-finding work |
| Q-2 | **Character appearance.** Preset customiser or likeness from photos? | **Approved.** Stylised customiser (FR-13, FR-14). Face badge is Could (FR-21); photo-to-avatar is Won't (FR-23) | None |
| Q-3 | **Photo limits.** | **Default.** 20 photos, 15 MB each, resized to 2048 px on the long edge, HEIC accepted (FR-2, NFR-5) | More photos need more download and memory |
| Q-4 | **Storage and privacy.** | **Approved.** Backend with cloud storage. Unlisted unguessable link, metadata stripped, deletion through the edit link (FR-10, FR-49, FR-52). Content stored in Australia where practicable (NFR-17). Passcode and expiry are Release 2 | Backend needed; architect to choose |
| Q-5 | **Retention.** | **Approved.** 90 days from publishing by default, with the Creator able to delete at any time (NFR-16) | Longer retention affects cost; see Q-18 |
| Q-6 | **Captions and messages.** | **Default.** Caption 280 characters per picture, optional opening greeting 500, closing message 1,000 (FR-6, FR-8, FR-9) | Richer text increases scope |
| Q-7 | **Creator account or edit link.** | **Approved.** Edit link only, no accounts (FR-1, FR-50). Accounts are Release 3 (FR-67) | Losing the edit link means no edit or delete |
| Q-8 | **Atmosphere.** Music, themes, closing moment. | **Default.** MVP has one theme and the finale closing message; music, themes and the celebration effect are Release 2 (FR-41 to FR-43) | Music licensing needs checking |
| Q-9 | **Pace of the tour.** | **Resolved, superseded by Q-1.** There is no Next button; the Visitor sets the pace by roaming | None |
| Q-10 | **Photo placement.** | **Default.** Order only; automatic layout along a route (FR-5, FR-39, A-6) | Drag-and-place would need a 3D editor |
| Q-11 | **Visitor tweaks.** | **Default.** No; the Creator decides. Optional later (FR-22, Could) | Minor |
| Q-12 | **Extra appearance fields.** | **Default.** The option lists in FR-13 and FR-14, plus glasses and a hat (FR-20). No free-text notes in MVP | A wider catalogue needs more art assets |
| Q-13 | **Minimum devices.** | **Default.** Latest two versions of major browsers; reference phone class (A-8, NFR-8) | Older phones would need a lower-detail mode |
| Q-14 | **Analytics and notifications.** | **Default.** None in MVP | A notification needs contact details, which brings privacy obligations |
| Q-15 | **Photo rights and takedown.** | **Default.** Consent checkbox (FR-56) and a takedown contact. Legal review is still required before launch (NFR-14); owner: the organisation's legal team | Legal and brand risk |
| Q-16 | **Name and branding.** | **Default.** Working title "Surprise Museum"; neutral, warm styling | The design spec and copy depend on it |
| Q-17 | **Link behaviour.** | **Default.** The link opens on any device any number of times (A-9) | One-time links break when the recipient changes phone |
| Q-18 | **Commercial model.** | **Default.** Not defined in these requirements. For pricing or contracts, please contact the Sales team | May change retention, limits and the need for payments |
| Q-19 | **Reveal timing.** | **Default.** Could, not in MVP (FR-45) | Minor |
| Q-20 | **Audio narration.** | **Default.** Text captions only in MVP; voice notes are Could (FR-44) | Voice adds recording, storage and transcripts |
| Q-21 | **Closing message trigger** (new in v0.2). | **Assumed, please confirm (can defer).** Finale podium at the end of the route triggers the closing message (A-15) | If the user prefers "after all pictures are viewed", FR-29 and FR-70 change |
| Q-22 | **Gender option set and labels** (new in v0.3). Which options, and what are they called? | **Approved 29/10/2026.** Three options labelled **Woman**, **Man** and **Neutral**, with the helper text "Changes the shape and face. Your other choices stay as they are." Stored ids `feminine`, `masculine`, `neutral` (architect to confirm). Neutral is the default and is today's shape. If you want a fourth, free-choice "Non-binary" label, it can map to the Neutral shape | Labels, art scope and schema values |
| Q-23 | **Facial hair for the Visitor** (new in v0.3). Offer it to both characters? | **Approved 29/10/2026: yes** (FR-13 changed). Without it a male Visitor cannot be matched. The parts already exist for the Guide, so the cost is low | If no, a male Visitor has no beard options |
| Q-24 | **Pronouns in visit text** (new in v0.3). Does the app need a pronoun setting? | **Approved 29/10/2026: no.** App-written text avoids pronouns entirely (FR-76), so no setting is needed. A pronoun field is a possible later addition if the Creator's captions are ever templated | If yes, adds a field, copy variants and tests |
| Q-25 | **Your specific feedback** (v0.4 placeholder). Which screens, devices and browsers, and what felt wrong? | **Answered 02/11/2026.** The user said: *"If I move to top angle the view is blocked by the ceiling."* (a bug: FR-95, Must); *"Character definition needs more freedom to choose face shape and cloth designs."* (FR-96 to FR-102, Must; see Q-27); and *"Phones are not hard to use."* (see Q-26). Any further feedback is triaged into a follow-up (CR-4a) | Drives FR-95 to FR-102 and the demotion of FR-82 and FR-84 |
| Q-26 | **Phones and browsers you test on** (v0.4). Which phone, orientation and browser feels hard to use? | **Answered 02/11/2026.** The user said: *"Phones are not hard to use."* There is no phone problem to fix. "Hard to use on phones" is removed as a driver; **FR-82 is demoted to Could and FR-84 to Should**; FR-81 (44 px targets) and FR-83 (readable sizes) stay Must as accessibility guard rails that protect what already works. A-23 viewports remain the regression reference | Less layout rework; lower regression risk. Please confirm the two demotions (Q-32) |
| Q-27 | **What "more defined" means for the characters** (v0.4). Too small, blending into the background, faces blank, or characters too alike? | **Answered 02/11/2026.** The user said: *"Character definition needs more freedom to choose face shape and cloth designs."* So "more defined" means a wider choice of face shape and clothing design, not a clarity problem. **This overturns part of FR-94: new options are now in scope for face shape and clothing only** (FR-96 to FR-102). FR-89 and FR-90 stay as quality guard rails | New art scope for the technical-artist inside the budget (Q-28); new optional data fields (FR-100, FR-101); a longer Characters step avoided by FR-102 |
| Q-28 | **Can the character and size budgets be raised if needed?** (v0.4). Today only about 122 triangles per character and about 30 kB of the three.js chunk are spare | **Answered 02/11/2026: a raise is accepted if needed.** The user picked the option described as "probably needs the triangle budget raised, which costs some performance on low-end phones". **Closed in v0.6 (tech lead, 03/11/2026): no raise was needed.** The technical-artist measured the worst character at 5,862 triangles (hard stop 5,950), so NFR-27 stays at 6,000 and ADR 0021's provisional 6,500 lapsed. The performance-optimiser still verifies it on the reference phone (NFR-1, NFR-28 must still pass, including the Low tier). Earlier wording: NFR-27 stays as written until the technical-artist proposes an exact triangle figure and the performance-optimiser verifies it on the reference phone (NFR-1, NFR-28 must still pass, including the Low tier). The limit applies to the worst single style, not to a sum. Face shapes should still come mainly from scaling and patterns from materials or textures, so the raise is as small as possible. A-29 gives the trimming order if even a raised budget is not enough | Raises load time and frame-rate risk on low-end phones (NFR-1, NFR-2); the proposal needs the performance-optimiser's sign-off |
| Q-29 | **Typeface** (new in v0.4). Keep the current font family, or is a new typeface wanted? | **Default: keep the current family** and adjust size, weight and line height (A-27). A new font is allowed only within the 100 KB limit in NFR-27 | A new font affects the landing page's load time and the feel of the identity |
| Q-30 | **How many clothing styles do you want?** (new in v0.5). You said "a style (about 6 options)". Today's builder already has six outfit styles (T-shirt and jeans, Hoodie, Shirt and trousers, Dress, Suit, Jumpsuit). Do you want those six kept (the new freedom is then mainly the pattern), or six or so new styles in addition, to about 12? | **Answered 02/11/2026.** The user said: *"Double the styles."* Keep today's six unchanged and add about six new styles, about 12 in total (FR-97 now requires 12 or more). The technical-artist and designer propose the six garments (neutral labels, FR-99); each must fit the budget (NFR-27, Q-28). A-29 gives the trimming order, new styles first, down to 3 new | Doubles the clothing art work; no change to the data fields |
| Q-31 | **Pattern colour** (new in v0.5). Should a pattern use tints of the chosen outfit colour (one colour choice, as proposed), or should the Creator also pick a second colour for the stripes, checks or dots? | **Answered 02/11/2026: tints of the outfit colour, no second colour** (FR-98 is already right). This keeps the Characters step short (FR-102) and the data to one new field per option. A second colour would be a later request | A second colour adds a control, a field, 12 more swatches and more contrast cases (FR-89) |
| Q-32 | **Please confirm the phone demotions** (new in v0.5). FR-82 (thumb reach) is now Could and FR-84 (safe areas, browser bars, on-screen keyboard) is now Should; FR-81 and FR-83 stay Must. | **Confirmed 02/11/2026** by the tech lead from the user's "phones are not hard to use": FR-82 is Could and FR-84 is Should. FR-84 is Should but existing behaviour must not regress (QA keeps the existing tests) | The Must count stays at 64 |
