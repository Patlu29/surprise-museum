# Project status — Surprise Museum

**Current phase:** CR-1 to CR-3 built (gender, presentation camera, photo notice, readable caption card); QA round 4 done (fix round 1 verified); fix round 2 (final) in progress
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
| 7. Delivery | Not started | — |

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

Round 4: 2 open, both minor (BUG-10 strip overlaps Guide label by ~8 px at 360x640 caption 1.5; BUG-11 WebKit preview Try again needs reload). BUG-6, 7, 9 and brows fixed; BUG-8 fixed on Chromium (WebKit part is BUG-11). Suite 670 passed / 0 failed / 41 skipped across 3 projects; finale visual can flake under load. BUG-1 to 4 fixed, BUG-5 accepted upstream. See docs/qa-report.md. BUG-1 scope (tech lead, 29/10/2026): persist character choices and text fields per US-6 AC-3 (Must); photo restore stays with US-29 (Should, Release 2).

Open design question: in the presenting view the Visitor and her name label partly cover the picture (camera sits behind her). Intended?
