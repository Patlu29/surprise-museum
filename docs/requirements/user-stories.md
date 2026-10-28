# User stories: Virtual 3D Photo Museum

Version 0.2 | 27/10/2026 | Owner: product-manager | Source: `docs/requirements/requirements.md` (v0.2)

Roles: **Creator** (builds the museum and appears as the Guide) and **Visitor** (opens the link). The Guide is an autonomous character in the MVP. Priorities use MoSCoW. Stories needing a backend or storage are grouped in Epic E6 so the architect can decide on the backend.

Change in v0.2: the scripted tour (Next button, forced sequence) is replaced by free roaming with a proximity-triggered Guide. Epics E3 and E4 and stories US-11 to US-16, US-35 and US-42 to US-44 were rewritten or added; US-13 and US-14 changed meaning; US-5, US-8, US-17, US-21, US-30 and US-32 were adjusted. The initial proximity values used below (3 m, 4.5 m, 1 second) are starting points that may be tuned (assumption A-16).

---

## Epic E1: Creator builds the museum

### US-1: Start without an account (FR-1, Must)
As a Creator, I want to start building straight away, so that I can finish the gift without signing up.

**Acceptance criteria**
- Given I open the builder for the first time, when the page loads, then I can begin adding photos without any sign-in or account prompt
- Given I am on a phone in portrait, when I use the builder, then every step is reachable with one thumb and no horizontal scrolling
- Given the builder is loading, when assets are still downloading, then I see a loading indicator rather than a blank screen

### US-2: Upload photos (FR-2, FR-3, FR-4, FR-10, Must)
As a Creator, I want to upload my photos, so that they hang on the museum walls.

**Acceptance criteria**
- Given I select 1 to 20 valid JPEG, PNG, WebP or HEIC files of up to 15 MB each, when the upload runs, then I see progress for each photo and each photo appears as a thumbnail when complete
- Given I select a 25 MB file, a PDF, or a 21st photo, when validation runs, then I see the file name and the reason it was rejected, and the valid files still upload
- Given one upload fails because the connection drops, when I tap Retry on that photo, then only that photo is re-sent and the others are unaffected
- Given I upload a photo containing GPS location metadata, when the museum is published and the photo is served, then the stored and served file contains no location or camera metadata
- Given I use only the keyboard, when I focus the Add photos control and press Enter, then the file chooser opens

### US-3: Arrange photos and write captions (FR-5, FR-6, Must)
As a Creator, I want to put photos in order and add captions, so that the museum shows my story in the order I intend.

**Acceptance criteria**
- Given I have several photos, when I drag a thumbnail (or use the Move up and Move down controls) to a new position, then the order updates and the preview hangs the pictures along the route from the entrance to the finale in that order
- Given I select a photo, when I type a caption, then it accepts up to 280 characters and shows a remaining-character count
- Given I type a 281st character, when the limit is reached, then the extra character is not accepted and a message explains the limit
- Given I remove or replace a photo, when I confirm, then the photo is removed or swapped and its caption is kept on replace and discarded on remove
- Given I am on a touch device, when I long-press and drag a thumbnail, then it reorders as it does with a mouse

### US-4: Name the museum, the Guide and the Visitor (FR-7, Must)
As a Creator, I want to set the names, so that the right names appear over the characters.

**Acceptance criteria**
- Given I leave the Visitor name or Guide name empty, when I try to continue to publishing, then I am told which field is required
- Given I enter a name of 25 or more characters, when I type, then input stops at 24 characters with a visible message
- Given I leave the museum title blank, when I preview, then the title reads "A museum for <Visitor name>"
- Given I type names with accents or emoji, when I preview, then the names display exactly as typed above the characters

### US-5: Write the closing message (FR-8, Must)
As a Creator, I want to write a closing message, so that the visit ends with a personal surprise.

**Acceptance criteria**
- Given I type a closing message, when I reach 1,000 characters, then no further characters are accepted and a message explains the limit
- Given I leave the closing message blank, when the Visitor enters the finale area, then the Guide shows a simple "The end" panel with replay and keep-exploring options
- Given I preview the museum, when I step into the finale area, then my closing message appears exactly as written, with line breaks preserved

### US-6: Customise the Visitor character (FR-13, FR-15, Must)
As a Creator, I want to style the Visitor character to look like the recipient, so that she recognises herself.

**Acceptance criteria**
- Given I open the Visitor customiser, when I view the options, then I can choose skin tone (8 or more), hair style (8 or more), hair colour (8 or more), outfit style (5 or more) with colour, body type (3 or more) and height (3 or more steps)
- Given I change any option, when I make the change, then the 3D preview updates within 1 second
- Given I leave the customiser and return, when the page reloads, then my choices are still selected
- Given I use only the keyboard, when I tab through the options, then I can select every option and see the preview update
- Given the 3D preview is loading or fails, when that happens, then I see a loading indicator or an error with a Retry control, and the option lists remain usable

### US-7: Customise the Guide character (FR-14, FR-15, Must)
As a Creator, I want the Guide to look like me, so that the Visitor sees me walking with her through the museum.

**Acceptance criteria**
- Given I open the Guide customiser, when I view the options, then I see the same options as the Visitor plus facial hair (none and 3 or more styles)
- Given I change any option, when I make the change, then the 3D preview updates within 1 second
- Given I have styled both characters, when I view the two previews side by side, then each shows its own name above its head

### US-8: Preview the museum before publishing (FR-11, Must)
As a Creator, I want to see exactly what she will see, so that I am confident before I send it.

**Acceptance criteria**
- Given I have at least 1 photo and both names set, when I choose Preview, then the full Visitor experience runs, including the welcome screen, free roaming with a Visitor character I control, the Guide's presentations and the finale
- Given I am previewing, when I choose Exit preview, then I return to the builder with all my settings intact
- Given the preview runs on my device, when I compare it with the published version, then the content, order and layout are identical
- Given I have not set the minimum details, when I choose Preview, then I see what is missing instead of an empty museum

---

## Epic E2: Characters in the museum

### US-9: Visitor character is generated automatically (FR-16, Must)
As a Visitor, I want my character to be ready when I open the link, so that I do not have to set anything up.

**Acceptance criteria**
- Given the Creator has styled the Visitor character, when I open the link, then my character appears in the museum matching those settings with no setup step
- Given the museum is loading, when my character is not yet ready, then I see the loading screen and not a half-built character
- Given I open the same link on a second device, when it loads, then the character looks identical

### US-10: Names float above both characters (FR-17, FR-18, Must)
As a Visitor, I want to see who is who, so that the experience feels personal.

**Acceptance criteria**
- Given I am roaming or the Guide is presenting, when the Guide or my character is on screen, then each has its name displayed above its head
- Given I rotate the camera, when the characters turn or move, then the names always face the camera and stay above the heads
- Given a character is behind a wall, when it is hidden from the camera, then the name is hidden too and returns when the character is visible
- Given the viewport is 360 pixels wide, when the names are shown, then they are legible with a contrast ratio of at least 4.5:1
- Given a character is walking, when it moves, then the walk animation plays, and when it stops, then the idle animation plays

---

## Epic E3: Welcome and free roaming (the main experience)

### US-11: Open the link and start (FR-24, FR-25, Must)
As a Visitor, I want a warm welcome and to be free to wander straight away, so that I know the link is for me and can explore at my own pace.

**Acceptance criteria**
- Given I open a valid link, when the welcome screen appears, then it shows the museum title, "For <Visitor name>" and a Start button
- Given I use only the keyboard, when the welcome screen loads, then the Start button has focus and Enter starts the experience
- Given I tap Start, when the museum appears, then my character is at the entrance with the Guide beside it, and I can move and rotate the camera immediately
- Given I am in the museum, when I look for a Next button or a required order, then none exists and I can enter any area or approach any picture first
- Given I tap Start, when sound is available, then audio is permitted from that point (and nothing played before it)
- Given the link opens on a 4G connection, when I wait, then the welcome screen is interactive within 5 seconds

### US-15: Move around the museum (FR-33, FR-34, Must)
As a Visitor, I want to walk around freely like a real visit, so that I can explore at my own pace.

**Acceptance criteria**
- Given I am on a touch device, when I use the on-screen joystick or drag, then my character moves and the camera follows
- Given I use a keyboard, when I press W A S D or the arrow keys, then my character moves in that direction
- Given I walk into a wall or a frame, when I continue pressing the direction, then my character stops and does not pass through it
- Given I walk toward the museum boundary, when I reach it, then I cannot leave the museum
- Given I drag the mouse or swipe with a second finger, when I do so, then the camera rotates around my character

### US-16: View a picture full-screen (FR-35, Must)
As a Visitor, I want to look at a picture up close, so that I can see the details.

**Acceptance criteria**
- Given I am in the museum, when I tap or click a picture, then it opens full-screen with its caption
- Given a picture is open on a touch device, when I pinch, then it zooms in and out, and with a mouse the scroll wheel does the same
- Given a picture is open, when I choose Close (or press Escape), then I return to where I was
- Given the picture is still loading, when I open it, then I see a placeholder and the loaded image replaces it when ready
- Given a picture fails to load, when I open it, then I see an error and a Retry control

---

## Epic E4: Autonomous Guide and picture presentations

### US-12: The Guide presents a picture when I come near (FR-26, FR-27, FR-71, Must)
As a Visitor, I want the Guide to come and tell me about a picture when I walk up to it, so that I learn the story without being forced along a route.

**Acceptance criteria**
- Given I am within 3 m of a picture on the same side of its wall, when I stay there for 1 second, then the Guide walks to a spot beside me facing the picture and the caption appears in a panel labelled with the Guide's name
- Given a presentation is showing, when I move more than 4.5 m from the picture or dismiss the panel, then the panel closes and the Guide starts following me again
- Given I stand at the edge of the zone, when I move back and forth between 3 m and 4.5 m, then the presentation does not repeatedly open and close
- Given a picture has no caption, when I stay near it for 1 second, then the Guide walks beside me and faces the picture, and no caption panel appears
- Given I am on a phone, when the caption panel is displayed, then it does not cover my character or the picture, and the dismiss control is at least 44 by 44 CSS pixels
- Given I am on the other side of a wall from a picture, when I am within 3 m in a straight line, then no presentation starts

### US-13: Moving between pictures quickly (FR-28, Must)
As a Visitor, I want the Guide to keep up without interrupting me, so that wandering feels natural.

**Acceptance criteria**
- Given I walk past a picture's zone and leave in under 1 second, when I leave, then no presentation starts and the Guide does not walk toward the picture
- Given the Guide is presenting picture A, when I walk into the zone of picture B and stay 1 second, then A's presentation closes and the Guide presents B
- Given I am within the zones of two pictures at once, when the pause elapses, then only the nearest picture is presented and no second panel or queue appears
- Given I leave a zone and return later, when I stay 1 second, then the picture is presented again, and if the Guide is already beside me it does not walk

### US-14: The finale and closing message (FR-29, Must)
As a Visitor, I want the visit to end with a message from the Creator, so that it feels like a gift.

**Acceptance criteria**
- Given I walk into the finale area (the exit podium), when I step inside, then the Guide stands beside me and presents the Creator's closing message
- Given the closing message is showing, when I choose Replay, then the Guide and I return to the entrance and the viewed count is cleared
- Given the closing message is showing, when I choose Keep exploring, then the panel closes and I can move freely
- Given I have left the finale, when I step into it again, then the closing message is presented again
- Given the Creator wrote no closing message, when I enter the finale, then a simple "The end" panel appears with the same options
- Given the reduced motion preference is on, when the closing message appears, then no celebratory motion plays

### US-42: The Guide follows and stays out of my way (FR-30, FR-31, Must)
As a Visitor, I want the Guide to stay close but never block me, so that I can see the pictures and walk where I like.

**Acceptance criteria**
- Given I am roaming, when I walk, then the Guide follows within 2 to 5 m, and when I stop, then the Guide stands idle nearby
- Given the Guide is presenting a picture, when I look at the picture, then the Guide is not between me and the picture and does not hide me from the camera
- Given the Guide is standing in my path, when I walk toward it, then I am not stopped and the Guide moves aside
- Given the Guide is more than 8 m away or stuck for more than 3 seconds, when this happens, then it reappears beside me out of the camera's view or with a short fade
- Given walls and corners, when the Guide follows me through the museum, then it walks around them and never passes through them
- Given reduced motion is on, when the Guide reaches me to present, then it fades in beside me instead of walking across the room

---

## Epic E5: Museum look and atmosphere

### US-17: A well-laid-out museum (FR-39, FR-40, Must)
As a Creator, I want my photos displayed well whatever their shape, and a museum that has a clear start and end, so that nothing is cropped and the visit feels complete.

**Acceptance criteria**
- Given I have between 1 and 20 photos, when the museum is generated, then it has an entrance, a walkable route with every photo hung in my order without overlaps, and a finale area at the end
- Given a portrait photo and a landscape photo, when they are displayed, then each keeps its original aspect ratio with no cropping or distortion
- Given the default theme, when I stand in front of any picture, then it is evenly lit with no glare or shadow hiding the photo

### US-18: Choose a theme (FR-41, Should)
As a Creator, I want to choose the look of the museum, so that it suits the person.

**Acceptance criteria**
- Given I open the theme chooser, when I view it, then I can pick one of at least 3 themes with a preview
- Given I choose a theme, when I preview or publish, then the museum uses that theme

### US-19: Background music (FR-42, NFR-24, Should)
As a Creator, I want to choose background music, so that the visit has atmosphere.

**Acceptance criteria**
- Given I open the music chooser, when I view it, then I can pick one of at least 3 tracks, or none, and hear a sample
- Given the Visitor opens the link, when the welcome screen shows, then no sound plays until Start is tapped
- Given music is playing, when the Visitor chooses Mute, then it stops and stays muted for the rest of the session
- Given the tab is hidden or the app is in the background, when that happens, then music pauses

### US-20: Celebration at the end (FR-43, Should)
As a Creator, I want a visual flourish at the closing message, so that it feels special.

**Acceptance criteria**
- Given the closing message appears, when reduced motion is not requested, then a celebratory effect plays for no longer than 5 seconds
- Given reduced motion is requested, when the closing message appears, then no effect plays
- Given a low-end phone, when the effect plays, then the frame rate stays at or above 30 FPS

### US-21: Opening greeting (FR-9, Should)
As a Creator, I want the Guide to say hello first, so that the visit starts with my words.

**Acceptance criteria**
- Given I wrote an opening greeting, when the Visitor taps Start, then the Guide presents it beside the Visitor at the entrance
- Given the greeting is showing, when the Visitor starts walking or dismisses it, then the panel closes and the Visitor keeps full control throughout
- Given the greeting is longer than the panel, when it is displayed, then it scrolls or paginates and the dismiss control remains reachable

---

## Epic E6: Share, access and privacy (needs backend and storage)

### US-22: Publish and get the link (FR-47, FR-50, FR-56, Must)
As a Creator, I want a link to send, so that she can open the museum on her phone.

**Acceptance criteria**
- Given I have photos and names, when I choose Publish, then I must tick a confirmation that I have the right to share the photos and that those pictured are comfortable with it, with a link to the terms
- Given I confirm, when publishing completes, then I see the share link with a Copy button and a separate edit link with a warning to save it
- Given I choose Copy, when copying succeeds, then I see a confirmation, and I can paste the link into a message
- Given publishing is in progress, when photos are uploading, then I see progress and I cannot publish twice
- Given publishing fails, when an error occurs, then I see a clear message and a Retry control without losing my work

### US-23: Link is private (FR-49, FR-55, Must)
As a Creator, I want only the person I send the link to to see the museum, so that my photos stay private.

**Acceptance criteria**
- Given a museum is published, when I search for it on a search engine, then it is not listed, and its pages tell search engines not to index it
- Given someone changes one character of a share link, when they open it, then they see the friendly "museum not found" screen
- Given an unknown or deleted link, when it is opened, then the screen reveals nothing about any content and offers no list of other museums
- Given I try many random links quickly, when the rate limit is reached, then further attempts are slowed or blocked

### US-24: Delete my museum (FR-52, Must)
As a Creator, I want to delete the museum, so that my photos are removed when I choose.

**Acceptance criteria**
- Given I open my edit link, when I choose Delete, then I must confirm in a second step that the deletion is permanent
- Given I confirm, when deletion completes, then the share link immediately shows the "museum not found" screen
- Given I delete the museum, when the operation finishes, then the photos and text are removed from live storage within 7 days

### US-25: Edit after publishing (FR-51, Should)
As a Creator, I want to fix a typo or swap a photo after sending the link, so that I don't need to resend it.

**Acceptance criteria**
- Given I open my edit link, when the page loads, then I see the museum's photos, captions, names, characters and messages ready to edit
- Given I save changes, when the Visitor next opens the share link, then they see the updated museum
- Given someone opens the share link, when they try to edit, then no editing controls are available

### US-26: Passcode (FR-53, Should)
As a Creator, I want to add a passcode, so that the link alone is not enough.

**Acceptance criteria**
- Given I set a passcode, when a Visitor opens the link, then they see a passcode prompt before any photo or name is loaded
- Given a wrong passcode, when entered 5 times in a row, then further attempts are delayed
- Given the correct passcode, when entered, then the welcome screen appears

### US-27: Expiry (FR-54, Should)
As a Creator, I want to set when the link stops working, so that the museum does not stay online forever.

**Acceptance criteria**
- Given I set an expiry date, when the date passes, then the share link shows an "expired" message
- Given the expiry has passed, when the retention window ends, then the content is removed from storage

### US-28: Send via my phone's share options (FR-48, Should)
As a Creator on a phone, I want to share the link in my messaging app directly, so that I don't have to copy and paste.

**Acceptance criteria**
- Given I am on a device that supports sharing, when I choose Share, then the device's share options open with the link
- Given the device does not support it, when I view the publish screen, then only Copy is offered

### US-29: Draft is not lost (FR-12, Should)
As a Creator, I want my work kept if I get interrupted, so that I don't start again.

**Acceptance criteria**
- Given I have unpublished work, when I refresh the page, then my photos, captions, names and character choices are restored
- Given I choose Start again, when I confirm, then the saved draft is cleared

---

## Epic E7: Loading, resilience, accessibility and live-readiness

### US-30: Loading screen and failed photos (FR-57, FR-58, NFR-2, NFR-3, Must)
As a Visitor, I want to know the museum is loading and see what to do if something fails, so that I'm not left on a blank screen.

**Acceptance criteria**
- Given I open a link, when assets are loading, then I see a loading screen with progress and the museum title or a friendly message
- Given a photo has not loaded when I approach it, when I am near its frame, then the frame shows a placeholder, and the photo replaces it when ready
- Given a photo fails to load, when I approach it, then its frame shows a placeholder with a Retry control, and the Guide still presents the caption and I can keep roaming
- Given the network drops during loading, when the connection returns, then I can retry without reloading the page
- Given a 4G connection, when I open the link, then the characters and entrance area are rendered within 8 seconds and the remaining pictures load nearest-first

### US-31: WebGL is unavailable (FR-59, FR-60, NFR-11, Must for message, Should for slideshow)
As a Visitor on an unsupported browser or device, I want a clear explanation and a fallback, so that I can still see the photos.

**Acceptance criteria**
- Given WebGL is unavailable, when I open the link, then I see a plain-language message and a suggestion to try another browser
- Given WebGL is unavailable, when the fallback slideshow is supported, then I can step through the photos and captions in the Creator's order and see the closing message
- Given the graphics context is lost mid-session, when it happens, then I see a message and a Reload control

### US-32: Keyboard and reduced motion (FR-61, FR-62, NFR-12, Must)
As a Visitor with accessibility needs, I want to use the museum without a mouse or touch screen and without disruptive motion, so that I can enjoy it comfortably.

**Acceptance criteria**
- Given I use only a keyboard, when I use the welcome screen, movement, caption panel dismissal, picture view, finale and replay, then every action can be completed and focus is always visible
- Given my device requests reduced motion, when the Guide comes to present a picture, then it fades in beside me instead of walking across the room, and the camera never moves on its own
- Given reduced motion is on, when the closing message appears, then no celebratory effect plays
- Given the 2D overlays and builder are tested with an automated and a manual WCAG 2.2 AA check, when the checks run, then no AA failures remain

### US-33: Works in portrait and landscape (FR-64, NFR-10, Must)
As a Visitor on a phone, I want the museum to work whichever way I hold it, so that I can open it comfortably.

**Acceptance criteria**
- Given I open the link in portrait, when the museum loads, then the joystick, controls and caption panel fit the screen and do not cover my character or the active picture
- Given I rotate the phone, when the orientation changes, then the view adjusts without restarting and my position and viewed pictures are kept
- Given the screen is 360 pixels wide, when I use any control, then each target is at least 44 by 44 CSS pixels
- Given a tablet or desktop browser, when I open the link, then the experience uses the larger screen without stretching the 2D overlays

### US-34: Screen reader captions and settings (FR-63, FR-65, Should)
As a Visitor using assistive technology or needing larger text, I want captions announced and settings I can change, so that I can follow the visit.

**Acceptance criteria**
- Given I use a screen reader, when the Guide begins presenting a picture, then the caption is announced and the picture's alternative text is its caption (or "Photo n of N" if blank)
- Given I open Settings, when I choose Low quality or larger caption text, then the change applies immediately
- Given I choose Mute in Settings, when sound is playing, then it stops

### US-45: Characters can later be driven live (NFR-25, NFR-26, Must for NFR-25, Should for NFR-26)
As the product owner, I want the characters' state to come from a replaceable source, so that live two-person mode can be added later without rebuilding the museum.

**Acceptance criteria**
- Given the architecture review, when it examines how a character's position, facing, animation and presentation state reach the renderer, then a single abstraction separates the source of that state from its rendering
- Given a test drives a character from a scripted, non-local source in place of the local controller, when it runs, then the character, its name label and its animations render correctly with no change to rendering code
- Given the MVP build, when it is inspected, then it contains no networking for characters and makes no real-time connection
- Given an automated 30-minute run with a simulated Visitor roaming randomly, when it completes, then the Guide was never stuck for more than 10 seconds, never passed through a wall and never blocked the Visitor (NFR-26, Should)

---

## Epic E8: Guidance helpers and polish (Should)

### US-35: Hint toward the next picture and see my progress (FR-32, FR-69, Should)
As a Visitor, I want a gentle hint of what I haven't seen yet, so that I don't miss anything, while still wandering freely.

**Acceptance criteria**
- Given I choose the hint control, when it activates, then the nearest picture I have not yet viewed is highlighted (a direction arrow and a glowing frame) and my character and camera do not move
- Given I ignore the hint, when I walk elsewhere, then nothing blocks me and the highlight fades
- Given the interface is showing progress, when a presentation starts for a new picture, then the count increases (for example, "5 of 12")
- Given I use only the keyboard, when I focus the hint control and press Enter, then the hint appears

### US-43: Finale prompt (FR-70, Should)
As a Visitor, I want to be told when I have seen everything, so that I know to head to the finale.

**Acceptance criteria**
- Given I have viewed all pictures, when the last presentation closes, then the Guide says so and the finale area is highlighted
- Given I enter the finale with pictures not yet viewed, when I step inside, then the Guide asks whether to show the closing message now or keep exploring
- Given I choose Keep exploring, when the prompt closes, then I can move freely and the closing message is not shown until I choose it or re-enter

### US-44: Jump to a picture (FR-36, Should)
As a Visitor, I want a list of pictures, so that I can go straight to one I remember or reach pictures more easily with limited mobility.

**Acceptance criteria**
- Given I open the picture list, when I select a picture, then my character moves to stand in front of it and the Guide presents it as usual
- Given the list is open, when I use only the keyboard, then I can move through it and select a picture with Enter
- Given pictures have been viewed, when I look at the list, then viewed pictures are marked

### US-36: Guide gestures and accessories (FR-19, FR-20, Should)
As a Creator, I want the Guide to point to the pictures and my characters to wear glasses or a hat, so that they feel more like us.

**Acceptance criteria**
- Given the Guide begins presenting a picture, when it arrives beside the Visitor, then it plays a presenting gesture once
- Given I choose glasses or a hat for a character, when I view the preview, then they appear on that character
- Given reduced motion is on, when the Guide begins presenting, then the gesture is replaced by a still pose

---

## Epic E9: Could-have ideas (backlog, not committed)

### US-37: Face photo on a badge (FR-21, Could)
As a Creator, I want to add a small face photo to a character's badge, so that the Visitor recognises us more easily.

**Acceptance criteria**
- Given I add a face photo, when I preview, then it appears on the character's badge or a framed portrait
- Given I remove the face photo, when I save, then it is deleted from storage like any other photo

### US-38: Voice note per picture (FR-44, Could)
As a Creator, I want to record a short voice note for a picture, so that she hears my voice.

**Acceptance criteria**
- Given I record a voice note for a picture, when the Guide presents it, then the note plays after the Visitor has tapped Start
- Given a Visitor is deaf or has sound off, when the note would play, then the caption text is still displayed

### US-39: Reveal date and time (FR-45, Could)
As a Creator, I want the link to open only at a chosen date and time, so that it lands on her birthday.

**Acceptance criteria**
- Given I set a reveal time, when the Visitor opens the link before it, then they see a "not yet" message with no content loaded
- Given the reveal time has passed, when the Visitor opens the link, then the welcome screen appears

### US-40: React to a picture (FR-38, Could)
As a Visitor, I want to send a heart on a picture, so that the Creator knows what I loved.

**Acceptance criteria**
- Given I am viewing a picture, when I tap the heart, then it is recorded against that picture
- Given the Creator opens the edit link, when they view reactions, then they see which pictures were hearted

### US-41: Visitor tweaks their character (FR-22, Could) and wall colours (FR-46, Could)
As a Creator, I want options for flexibility, so that the Visitor can adjust her character or I can colour the walls.

**Acceptance criteria**
- Given I allowed it, when the Visitor opens the link, then she can adjust her character before starting
- Given I choose wall and frame colours, when I preview, then the museum uses them

---

## Story map

| Release | Stories |
|---|---|
| MVP (all Must) | US-1, US-2, US-3, US-4, US-5, US-6, US-7, US-8, US-9, US-10, US-11, US-12, US-13, US-14, US-15, US-16, US-17, US-22, US-23, US-24, US-30, US-31 (message only), US-32, US-33, US-42, US-45 (NFR-25 part) |
| Release 2 (Should) | US-18, US-19, US-20, US-21, US-25, US-26, US-27, US-28, US-29, US-31 (slideshow), US-34, US-35, US-36, US-43, US-44, US-45 (NFR-26 part) |
| Later (Could) | US-37, US-38, US-39, US-40, US-41 |
| Future (Won't this release) | Live mode with both characters controlled live (FR-66), Creator accounts (FR-67), multiple Visitors, VR and AR, native apps (FR-68) |

## Traceability: requirement to story

| Requirement | Story | Requirement | Story |
|---|---|---|---|
| FR-1 | US-1 | FR-39, FR-40 | US-17 |
| FR-2, FR-3, FR-4, FR-10 | US-2 | FR-41 | US-18 |
| FR-5, FR-6 | US-3 | FR-42 | US-19 |
| FR-7 | US-4 | FR-43 | US-20 |
| FR-8 | US-5 | FR-44 | US-38 |
| FR-9 | US-21 | FR-45 | US-39 |
| FR-11 | US-8 | FR-46 | US-41 |
| FR-12 | US-29 | FR-47, FR-50, FR-56 | US-22 |
| FR-13, FR-15 | US-6 | FR-48 | US-28 |
| FR-14, FR-15 | US-7 | FR-49, FR-55 | US-23 |
| FR-16 | US-9 | FR-51 | US-25 |
| FR-17, FR-18 | US-10 | FR-52 | US-24 |
| FR-19, FR-20 | US-36 | FR-53 | US-26 |
| FR-21 | US-37 | FR-54 | US-27 |
| FR-22 | US-41 | FR-57, FR-58 | US-30 |
| FR-24, FR-25 | US-11 | FR-59, FR-60 | US-31 |
| FR-26, FR-27, FR-71 | US-12 | FR-61, FR-62 | US-32 |
| FR-28 | US-13 | FR-63, FR-65 | US-34 |
| FR-29 | US-14 | FR-64 | US-33 |
| FR-30, FR-31 | US-42 | FR-69 | US-35 |
| FR-32 | US-35 | FR-70 | US-43 |
| FR-33, FR-34 | US-15 | NFR-25, NFR-26 | US-45 |
| FR-35 | US-16 | FR-37 | Withdrawn (merged into FR-31, US-42) |
| FR-36 | US-44 | FR-66, FR-67, FR-68 | None (Won't this release) |
| FR-38 | US-40 | | |
