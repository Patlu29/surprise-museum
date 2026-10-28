# Project status — Surprise Museum

**Current phase:** 4. Build — in progress
**Last updated:** 27/10/2026

## Phases

| Phase | Status | Approval |
|---|---|---|
| 1. Requirements | Complete (v0.2) | Approved 27/10/2026 |
| 2. Architecture | Complete, scaffold builds | Approved 27/10/2026 |
| 3. Design | Complete (design-spec v1.0) | Approved 27/10/2026 |
| 4. Build | In progress | — |
| 5. Performance | Not started | — |
| 6. QA | Not started | — |
| 7. Delivery | Not started | — |

## Approvals given

- MVP scope approved as drafted, with the Q-1 change below (27/10/2026)
- Q-1: free roaming; Guide is an autonomous NPC that approaches the Visitor and presents a photo when she nears it. Live two-player guiding is a future phase; the architecture must not preclude it.
- Q-2: stylised avatar customiser
- Q-4/Q-5: backend + cloud storage, unlisted link, 90-day retention, delete via edit link
- Q-7: edit link only, no accounts
- Remaining questions: PM's recommended defaults
- Hosting: frontend on GitHub Pages; backend on Supabase (storage + database, Sydney region). User creates the Supabase project and adds keys as repo secrets.
- Repo: public `Patlu29/surprise-museum` (https://github.com/Patlu29/surprise-museum), created 27/10/2026, local remote `origin` set. Nothing pushed yet. The user has approved hosting there; the devops engineer may push and enable Pages at delivery.

## Open questions (awaiting user)

- Q-21: the finale podium triggers the closing message (default; can change later)

Resolved at design checkpoint (27/10/2026): design approved; on-screen arrow buttons (non-drag joystick alternative, WCAG 2.5.7) and the Pictures list with jump-to-photo (FR-36) promoted to MVP Must; home footer "Report a problem" links to https://github.com/Patlu29/surprise-museum/issues.

Resolved at architecture checkpoint (27/10/2026): architecture approved; keep project `.npmrc` on the public registry; Supabase free tier for now; hash-routed share links accepted.

Needing legal review before public launch: photo-consent and Privacy Act wording (Q-15), LGPL-3.0 licence of the `heic-to` decoder.

## Bug count

Not applicable yet.
