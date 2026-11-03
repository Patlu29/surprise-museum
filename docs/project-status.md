# Project status — Surprise Museum

**Current phase:** CR-4 (improved UI, polish) in build (spec v2.0, requirements v0.5); Release with CR-1 to CR-3: CR-1 to CR-3 built (gender, presentation camera, photo notice, readable caption card); QA complete (round 5: Go, 691 passed / 0 failed / 41 skipped); Phase 7 pipeline written (CI on push/PR; Pages, Supabase and Linux-baseline workflows manual only); nothing deployed
**Last updated:** 30/10/2026

## Phases

| Phase | Status | Approval |
|---|---|---|
| 1. Requirements | Complete (v0.2) | Approved 27/10/2026 |
| 2. Architecture | Complete, scaffold builds | Approved 27/10/2026 |
| 3. Design | Complete (design-spec v1.0) | Approved 27/10/2026 |
| 4. Build | Complete: build, typecheck, lint clean; 543 tests pass | — |
| 5. Performance | Complete (docs/performance.md v1.0); 556 tests pass. Real-device figures unverified (no devices available) | — |
| 6. QA | Complete for v0.2 scope: round 2 440 e2e pass, 0 failing; BUG-1 to 4 fixed, BUG-5 accepted upstream (ADR 0018). Firefox and real devices not verified. Re-run after CR-1 | — |
| 7. Delivery | Pipeline and Pages config done (02/11/2026); not deployed, deploy awaits user approval | — |

## Approvals given

- MVP scope approved as drafted, with the Q-1 change below (27/10/2026)
- Q-1: free roaming; Guide is an autonomous NPC that approaches the Visitor and presents a photo when she nears it. Live two-player guiding is a future phase; the architecture must not preclude it.
- Q-2: stylised avatar customiser
- Q-4/Q-5: backend + cloud storage, unlisted link, 90-day retention, delete via edit link
- Q-7: edit link only, no accounts
- Remaining questions: PM's recommended defaults
- Hosting: frontend on GitHub Pages; backend on Supabase (storage + database, Sydney region). User creates the Supabase project and adds keys as repo secrets.
- Repo: public `Patlu29/surprise-museum` (https://github.com/Patlu29/surprise-museum), created 27/10/2026. Remote `origin` uses HTTPS with the `gh` credential helper (repo-local config; no SSH key on this machine). The user has approved hosting there; the devops engineer may enable Pages at delivery.
- Git tracking (user request 28/10/2026): the tech lead commits and pushes to `main` after each phase or integration round. Agents do not commit.

## Change requests

- CR-1 (user, 29/10/2026): gender option for the Guide and Visitor characters. Requirements v0.3 approved 29/10/2026: Must, current MVP; Q-22 Woman/Man/Neutral (Neutral default); Q-23 facial hair for both; Q-24 no pronoun setting, neutral app wording. Architecture (ADR 0020) and design spec v1.1 approved 30/10/2026; build in progress (backend validator first).
- CR-2 (user, 30/10/2026): during a presentation the camera moves so the picture is fully visible (resolves QA N-2). Design then scene-developer.
- CR-2 tolerances (tech lead, 30/10/2026): accept worst pictureVisibleFraction 0.986 at 390x844 (target 0.99) and peak move-out yaw 100.5 deg/s at 38 degrees (limit 100) as rounding edges; QA tests at >= 0.98 and <= 101 deg/s.
- QA round 3 decisions (tech lead, 30/10/2026): N-6 caption cap is measured from the later of dwell completion and Guide arrival (card appears within 1.5 s of that); subtle gender face difference accepted for the stylised kit (brows fixed separately); card minimum width stays 16 rem, header layout must fit it.
- QA round 4 decisions (tech lead, 30/10/2026): Woman brow scale stays 0.90 (QA found 0.95 indistinguishable); deep-skin brow thickness left as a polish item, not a bug. Phone pixel-ratio tolerance of 3% for the BUG-6 plinth check accepted.
- BUG-10 extra fix attempt beyond the two-round limit approved by the user (02/11/2026); fixed by sliding portrait labels below the caption strip (spec v1.5).
- CR-4 Improved UI (user, 02/11/2026): polish the current look (not a new direction, not a flow rethink) across builder, visit HUD and overlays, landing page and 3D scene look, plus clearer character definition. Drivers: plain or dated look, hard to use on phones, builder feels long or confusing, user feedback to follow. Delivery: spec and build straight away, no design checkpoint. Budgets unchanged.
- CR-4 user feedback (02/11/2026): ceiling blocks the view from high angles (FR-95); more choice of face shape (5) and clothing (12 styles: today's 6 plus about 6 new; patterns plain/stripes/checks/dots in tints of the outfit colour); phones are not hard to use (thumb-reach items demoted). Triangle budget raise accepted if needed, figure to be proposed by technical-artist and verified by performance-optimiser.
- CR-4 tech-lead decisions (02/11/2026): keep the two-sentence landing description; keep today's 6 style tiles visible with the 6 new ones under More options (FR-102); provisional option ids accepted, `tunic` rather than `skirt`; FR-88 time hints deferred until there is usability data.
- CR-4 technical-artist decisions (tech lead, 03/11/2026): worst character 5,862 triangles after the hair fix (NFR-27 stays 6,000; the provisional 6,500 lapses, pending performance sign-off). Edge contrast: hair failures 51 of 240 down to 7 (curly-short on the runner and finale wall, black bob on the runner); cream outfit on oak 2.29. All accepted as recorded minor issues (FR-89 'record failures'); a fix needs geometry. three.js chunk +14.7 kB accepted; the chunk is now 988.7 kB (over the 985 kB guard, under the 1,000 kB budget) after code moved into it at 0cf9877. The performance-optimiser is to bring it under 985 kB through chunk splitting, not feature cuts.
- N-10 fixed in CR-4 (02/11/2026): labels clamp 8 px inside the viewport, de-overlap sideways, hide when the head is off screen; solver uses a capped label width. Known residual (tech lead accepted as minor): at 360x640 with two long names on picture 1, the Guide's label overhangs the right edge by about 63 px, because the picture-first and never-above-the-strip rules leave no room. A full fix needs the solver to keep the Guide in the fit set there.
- CR-4 frontend built (03/11/2026): landing, builder shell (purpose lines, short-label stepper, "Still to do" chips, action bar), step polish, More options (face shape, More styles with the 6 new ids, pattern) keeping the closed step height, visit HUD, welcome, finale footer, caption-card finish (CSS only). Tech-lead calls on its risks: one Preview visible at a time wins over 12.4.1's header placement; turn buttons top-right (bottom-right covered a name label); finale footer stays one row. Not done: overlay exit motion, compact joystick (Could), face-shape and pattern words in the live description (architect), Face-tab head framing (scene, deferred). Routed: `AvatarOptionKey` and `AVATAR_LABELS` widening and `describeAvatar` words to the architect; `'Fraunces Fallback'` in `--font-display` to the designer.
- CR-3 (user, 30/10/2026): builder shows a "photos were not kept" notice when a reloaded draft has no photos. Design then frontend-developer.

## Open questions (awaiting user)

- Q-21: the finale podium triggers the closing message (default; can change later)

Resolved at design checkpoint (27/10/2026): design approved; on-screen arrow buttons (non-drag joystick alternative, WCAG 2.5.7) and the Pictures list with jump-to-photo (FR-36) promoted to MVP Must; home footer "Report a problem" links to https://github.com/Patlu29/surprise-museum/issues.

Resolved at architecture checkpoint (27/10/2026): architecture approved; keep project `.npmrc` on the public registry; Supabase free tier for now; hash-routed share links accepted.

Needing legal review before public launch: photo-consent and Privacy Act wording (Q-15), LGPL-3.0 licence of the `heic-to` decoder.

## Known issues carried into QA

- Re-entering the museum retains about 49 DOM nodes and 0.4 MB heap per visit (low priority; performance report section 6)
- Real-device frame rate, memory and tier thresholds unverified (performance report section 7)

## Bug count

Round 5: 0 open bugs. BUG-1 to 4 and BUG-6 to 11 fixed; one minor known issue (N-10). Suite 691 passed / 0 failed / 41 skipped across 3 projects, no test.fail markers; desktop suite can flake under machine load. BUG-1 to 4 fixed, BUG-5 accepted upstream. See docs/qa-report.md. BUG-1 scope (tech lead, 29/10/2026): persist character choices and text fields per US-6 AC-3 (Must); photo restore stays with US-29 (Should, Release 2).

Open design question: in the presenting view the Visitor and her name label partly cover the picture (camera sits behind her). Intended?
