# Handoff: product-manager

## Summary
Updated the requirements (v0.2) and user stories with the user's answers. The main experience is now free roaming: the Visitor walks anywhere in the museum, and an autonomous Guide follows her and, when she comes near a picture, walks over and presents it with the Creator's caption. The scripted tour (Next button, forced sequence) is removed. Live real-time guiding with both characters controlled live is a future phase, and the architecture must not preclude it (NFR-25). All open questions are now resolved.

## Files changed
- docs/requirements/requirements.md: v0.2 with change log; rewritten core experience and MVP scope; rewritten FR-5, FR-8, FR-9, FR-11, FR-24 to FR-29, FR-39, FR-62, FR-63, FR-66; new FR-30, FR-31, FR-32, FR-69, FR-70, FR-71; FR-37 withdrawn; epics E3 (free roaming) and E4 (autonomous Guide) restructured; NFR-1 and NFR-3 adjusted; new NFR-25 (live-readiness) and NFR-26 (Guide robustness); assumptions A-15 to A-19; questions Q-1 to Q-21 all marked resolved or assumed
- docs/requirements/user-stories.md: v0.2; rewrote E3 and E4 (US-11 to US-16); added US-42 (Guide follows and stays out of the way), US-43 (finale prompt), US-44 (jump to a picture), US-45 (live-readiness); adjusted US-3, US-5, US-8, US-10, US-17, US-21, US-30, US-32, US-33, US-35; story map and traceability updated
- docs/handoffs/product-manager.md: this note

## Decisions
- Free roaming is the main experience; no forced order or Next button (Q-1, user decision)
- Proximity trigger (FR-26 to FR-28): present when the Visitor stays within 3 m of a picture, same side of the wall, for 1 second; the presentation closes beyond 4.5 m (hysteresis stops flicker); passing through a zone in under 1 second triggers nothing; only one presentation is active and none are queued; the nearest picture wins
- The Guide never blocks the Visitor's view, path or camera, and has no collision with the Visitor (FR-30, A-18)
- The Guide follows at 2 to 5 m, walks around obstacles, and relocates if more than 8 m away or stuck for 3 seconds (FR-31)
- Closing message trigger (A-15, FR-29): a finale podium at the end of the museum route; entering it presents the closing message, with Replay and Keep exploring. In Release 2 the Guide hints when everything is viewed and asks for confirmation if not (FR-70)
- Live-readiness is a Must design constraint (NFR-25): character state flows through an abstraction a network source can replace later; the MVP contains no networking
- Approved by the user: stylised customiser (Q-2); backend with cloud storage, unlisted link, metadata stripped, 90-day retention, deletion through the edit link (Q-4, Q-5); edit link only, no accounts (Q-7). Other questions took the recommended defaults
- Functional Musts rose from 39 to 42 because the Guide behaviours are more specific; A-14 still gives the order in which to cut

## Assumptions
- Proximity numbers are starting values to tune on a phone in playtesting (A-16)
- A picture counts as viewed once its presentation starts, or once opened full-screen (A-17)
- Re-approaching a picture presents it again; the Guide does not walk if already beside the Visitor (A-19)
- The Visitor controls the camera at all times; the Guide never moves the Visitor or the camera (A-5)
- Museum layout is automatic: an entrance, a route that hangs pictures in the Creator's order, and a finale area (FR-39, A-6)
- Third-person follow camera; 20 photos at 15 MB; reference devices as in requirements section 7

## Open questions
- Q-21: Please confirm that the finale podium (not "after all pictures are viewed") triggers the closing message. A default is recorded, so this can be deferred (user)
- Legal review of the privacy policy, terms and photo-consent wording is still required before launch (NFR-14, Q-15) (organisation's legal team)
- Pricing and contracts are not defined here; please refer to the Sales team (Q-18)

## Requests for other agents
- architect: decide whether a backend and object storage are needed (FR-47 to FR-56 require it); confirm stack, hosting and region, and photo processing (resize, metadata stripping, HEIC conversion). Design the character-state abstraction required by NFR-25, plus the Guide behaviour (follow, proximity presentation, path-finding or navigation, yield to the Visitor) and the proximity and viewed-state logic in FR-26 to FR-31. Plan nearest-first photo loading (NFR-3)
- ux-ui-designer: design the builder flow (mobile first), customiser, welcome screen, joystick and controls, caption panel (must not cover the Visitor or the picture), finale panel, name-label style (contrast of at least 4.5:1), and loading, error and WebGL-fallback states. Release 2: hint, progress and picture list
- technical-artist: modular stylised character kit covering FR-13 and FR-14 options with idle and walk animations (Should: presenting gesture), the default museum theme and lighting, and a finale podium
- scene-developer: implement the museum layout generation (entrance, route, finale), free roaming with collisions, and Guide behaviour per FR-26 to FR-31
- qa-engineer: derive test plans from the Given/When/Then criteria; include the proximity edge cases in US-12, US-13 and US-42, the NFR-26 soak test, and the NFR-25 scripted-source test; set up the reference device and 4G profile for NFR-1 to NFR-6
- devops-engineer: allow for Australian region hosting, HTTPS only and retention or purge jobs (NFR-16)
