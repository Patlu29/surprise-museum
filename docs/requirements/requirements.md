# Requirements: Virtual 3D Photo Museum (working title "Surprise Museum")

Version 0.2 | 27/10/2026 | Owner: product-manager | Status: Updated with the user's answers to the open questions

## Change log

| Version | Change |
|---|---|
| 0.1 | First draft. MVP assumed a scripted, picture-to-picture tour |
| 0.2 | **Q-1 changed by the user:** free roaming is the main experience and the Guide is an autonomous character that presents a picture when the Visitor comes near it. The scripted tour (Next button, forced sequence) is removed. Live real-time guiding with both characters controlled live is a future phase, and the architecture must not preclude it (NFR-25). Rewritten: FR-5, FR-8, FR-9, FR-11, FR-24 to FR-29, FR-39, FR-62, FR-63, FR-66, NFR-1, NFR-3. New: FR-30, FR-31, FR-32, FR-69 to FR-71, NFR-25, NFR-26, A-15 to A-19. Withdrawn: old FR-37 (merged into FR-31). Q-2, Q-4, Q-5, Q-7 approved; all other questions resolved with the recommended defaults (section 10) |

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

Note on the number of Must requirements: the MVP has 42 functional Musts because each requirement covers one behaviour. They group into ten capabilities: builder, photos, characters, name labels, free roaming, autonomous Guide, museum layout, share and privacy, resilience and accessibility, and live-readiness. Items already demoted to Should to keep the MVP lean: music, themes, passcode, expiry, edit after publish, opening greeting, draft recovery, jump-to-picture, hint, viewed progress, finale prompt, accessories and gestures. If the MVP must shrink further, candidates are listed in section 9 (Assumptions, A-14).

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
| FR-13 | M | The Creator can customise the Visitor character using: skin tone (at least 8 options), hair style (at least 8), hair colour (at least 8), outfit style (at least 5) with primary colour, body type (at least 3) and height (at least 3 steps) |
| FR-14 | M | The Creator can customise the Guide character using the same options as FR-13, plus facial hair (none and at least 3 styles) |
| FR-15 | M | Each customisation change appears on a live 3D preview of the character within 1 second |
| FR-16 | M | When the Visitor opens the link, the Visitor character is generated automatically from the Creator's saved settings, with no setup step for the Visitor |
| FR-17 | M | The Guide's name and the Visitor's name are displayed above their respective characters' heads at all times while the character is on screen, face the camera, and are not covered by character geometry |
| FR-18 | M | Both characters have an idle animation and a walking animation; the walking animation plays only while the character is moving |
| FR-19 | S | The Guide plays a presenting gesture when beginning a presentation |
| FR-20 | S | The Creator can add accessories to either character (at least glasses and one hat option) |
| FR-21 | C | The Creator can attach a small face photo to a name badge or framed portrait for either character |
| FR-22 | C | The Visitor can adjust their own character's appearance before starting, if the Creator allows it |
| FR-23 | W | Generating a character likeness automatically from uploaded photos (photo-to-avatar) is not supported in this release |

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

## 9. Assumptions

| ID | Assumption |
|---|---|
| A-1 | The MVP Guide is an autonomous character, not controlled live; a later phase adds live control of both characters |
| A-2 | The Creator needs no account; a secret edit link controls access, and losing it means the Creator cannot edit or delete (Q-7 approved) |
| A-3 | Characters are stylised (low-poly or cartoon) from a fixed set of options; "gender" is represented by body type and hair options rather than a required gender label, so the Creator can match the real person without a binary choice |
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

## 10. Open questions

All questions are resolved; the status column shows how. "Approved" means the user explicitly approved it; "Default" means the user accepted the recommended default. Q-21 is a new assumption for the user to confirm and can be deferred.

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
