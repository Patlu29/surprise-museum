# Project status

Application: Surprise Museum. A creator builds a small 3D museum of up to 20 photos with captions and a closing message, picks two stylised characters (the Visitor and the Guide), and shares an unlisted link. The recipient walks the Visitor through the museum while the Guide presents each photo. React Three Fiber on GitHub Pages, Supabase backend.
Approval mode: Key gates
Current iteration: 5 (Feature and fixes: OPS-1 + CR-13 purge health, CR-9 space full, DEBT-2 test stability, BUG-15, N-12, N-13)
Current phase: 4 Verify
Last updated: 26/11/2026
Deployed: 24/11/2026, live at https://patlu29.github.io/surprise-museum/ (GitHub Pages) with Supabase Free project `lklbpilfkxlegdrrohst` (see the Deploy row under Approvals and "Deploy record" below)

## Iterations
| # | Type | Scope | Started | Closed | Outcome |
|---|---|---|---|---|---|
| 1 | New application | MVP (requirements v0.2) | 27/10/2026 | 29/10/2026 | Built and QA'd; not deployed |
| 2 | Feature | CR-1 to CR-3 (gender, presentation camera, photo notice, caption card) | 29/10/2026 | 02/11/2026 | QA round 5 Go; pipeline written; not deployed |
| 3 | Feature | CR-4 Improved UI | 02/11/2026 | 11/11/2026 | QA round 7 Go; FR-89 linen exceptions X-1 to X-5 accepted by the user; not deployed |
| 5 | Feature and fixes | OPS-1 + CR-13 (purge health in the keep-alive), CR-9 (in-app space-full handling), DEBT-2 (test stability, includes N-11), BUG-15, N-12, N-13 | 26/11/2026 | | |
| 4 | Feature and hosting | Free-tier hosting on GitHub Pages and Supabase Free with keep-alive; retention 90 to 7 days | 18/11/2026 | 23/11/2026 | Released (prepared) with known issues; not deployed (user decision). Carried forward: V-6, V-7, V-8, DEBT-2, OPS-1, CR-12 to CR-14, DEBT-3, DEBT-4 (see docs/lifecycle/retrospective.md) |

Iterations 1 to 3 ran under the earlier builder process; their record is under "History before ADLC" below. No retrospective was written for them.

## Phase log (current iteration)
Iteration 4's phase log is in docs/lifecycle/retrospective.md.

| Phase | Status | Evidence | Date |
|---|---|---|---|
| 1 Plan | Done (A1 approved with changes 26/11/2026; 80% threshold applied, requirements v0.8.1, 14 places) | requirements, user stories and backlog v0.8: FR-104 rewritten (Could to Should), FR-106 to FR-111, NFR-33 to NFR-35, US-72 to US-81, 8 backlog rows In progress; prettier passes; IDs cross-checked; Must count unchanged at 90; Q-36 to Q-45 raised | 26/11/2026 |
| 2 Design | Done, A2 approved 27/11/2026 (architect done 26/11/2026: architecture v1.7, ADR 0023 purge health, ADR 0024 space-full guard, amendments to ADR 0010 and 0022, Q-37 answered: egress cannot be read by the app, contradictions C-1 to C-11; ux-ui-designer done 26/11/2026: design spec v2.2 section 13) | 26/11/2026 | Expected: architect (keep-alive contract, how limits are measured), ux-ui-designer (space-full states, N-11 dock, N-12, N-13) | |
| 3 Build | Done | Backend, frontend and scene built; scene fix round 1 (FR-111 widen step discarded by push-apart; 360x640 picture 1 accepted by the user). Tech lead checks 27/11/2026: lint, format, typecheck pass; vitest 75 files 1,131 tests; Deno check 31 files, lint, test 77 passed; scratch production build; bundle 3D total 992.9 of 1,000 kB (7.1 kB headroom); no test-hook names in the production build. keep-alive-static.spec.ts updated by QA (14 passed). Smoke: journey + builder specs on desktop-chromium and mobile-webkit, 67 passed, 1 skipped, 0 failed (tech lead, outside the sandbox: the sandbox blocks local port binding). Mobile-webkit consent checkbox failure not reproduced (frontend 35/35 and 43/43; smoke 0 failures). Requests: architect contracts update in progress; devops two-step keep-alive.yml in phase 6 | 27/11/2026 |
| 4 Verify | In progress | CI on the build commit; then performance-optimiser and qa-engineer full suite | 27/11/2026 |
| 5 Review | Not started | | |
| 6 Release | Not started | Deploying the change to the live site needs the user's separate approval | |
| 7 Operate and learn | Not started | | |

## Approvals
| Gate | Iteration | Decision | Given by | Date | Covers |
|---|---|---|---|---|---|
| A2 design | 5 | Approved | User | 27/11/2026 | Architecture v1.7, ADR 0023 (purge health), ADR 0024 (space-full guard), amendments to ADR 0010 and 0022, design spec v2.2 section 13 (including the 320 px two-row HUD). Answers: space measurement error fails open (requests go ahead, error logged); C-11 test-hook gate fixed in iteration 5 (scene-developer) |
| A1 scope | 5 | Approved with changes | User | 26/11/2026 | Requirements, stories and backlog v0.8 (OPS-1 + CR-13, CR-9, DEBT-2, BUG-15, N-11, N-12, N-13). Change: Q-36 space-full threshold 80% (800 MB storage, 400 MB database), not the 90% default. Q-38/Q-39 default (stop new drafts, photos and publishes with an unstored photo; keep work; viewers, edit, delete unaffected). Q-40 default (3 hours on each of three conditions). Q-37, Q-41 to Q-45 take their recommended defaults |
| A2 design | 4 | Approved | User | 19/11/2026 | ADR 0010 amendment, ADR 0022 (keep-alive), architecture v1.6, design spec v2.1; Q-33 (a) shared not-found screen; Q-35 (a) FR-105 stays Must |
| A3 release | 4 | Approved (release with known issues) | User | 23/11/2026 | docs/lifecycle/release-readiness.md of 20/11/2026: known issues X-1 to X-5 (accepted earlier), BUG-15, N-11 to N-13, and the Not verified items that need a deploy. Separately: no deploy in this iteration ("No deploy yet") |
| Deploy (GitHub side) | after 4 | Approved ("okay do") | User | 24/11/2026 | The tech lead may enable Pages, set the public variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and run the deploy and keep-alive workflows, once the user has created the Supabase project. Not covered: creating the Supabase project, the secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` (the user sets these). Done 24/11/2026: Pages enabled (Source: GitHub Actions, https://patlu29.github.io/surprise-museum/). Then done 24/11/2026: variables set, Deploy Supabase run 45385362605 green, Deploy to GitHub Pages run 45385807054 green (attempt 2), keep-alive manual run 45385818352 green |
| A1 scope | 4 | Approved (the user's own answers set the scope) | User | 18/11/2026 | Supabase Free plus a scheduled keep-alive; GitHub Pages with the existing Actions pipeline; museums promised for 7 days, then the whole museum and photos are deleted; free-limit guardrail is docs plus a usage check, no new in-app handling |

## Decisions and answers
- 27/11/2026 (user, "switch to whole library", then "After iteration 5"): rewrite the 3D scene in plain three.js and remove React Three Fiber and drei, as iteration 6 after iteration 5 is released, starting with a spike (canvas and render loop first, measure the saving). Needs a new ADR (architect). Tech lead's analysis 27/11/2026: R3F is 182 kB minified / 57 kB gzip (rolldown, same versions); 15 files use R3F hooks, 7 use R3F JSX, drei is used only for `<Html>`; 64 scene files already import three directly. To go into the backlog in phase 7.
- 27/11/2026 (user): FR-111 known issue accepted: at 360x640, picture 1, 24-character names, the lower label still covers 56% of the Guide's head and 41% of the Visitor's after fix round 1 (all other measured cases 0 to 7%); the picture and caption strip leave no room to rise, so FR-111's order reaches the 4 px drop. Tallest Visitor and 320x568 not measured.
- 26/11/2026 (user, "okay do them"): iteration 5 takes OPS-1 + CR-13, CR-9, DEBT-2, BUG-15, N-12 and N-13. CR-9 reverses the 18/11/2026 decision "guardrail is docs plus a usage check, no new in-app handling": in-app space-full handling is now wanted (scope and priority confirmed at A1).
- 18/11/2026 (user): the internal npm-mirror hostname found in three deno.lock files (no credentials) is removed from current files; git history is left as it is (user chose "Leave history").
- 18/11/2026 (user): add a project .npmrc.
- 18/11/2026 (user): host on free tiers only. Backend: Supabase Free with a keep-alive workflow so the project never reaches the 7-day idle pause.
- 18/11/2026 (user): GitHub billing lock is fixed. Not yet confirmed by a CI run (last refused run 11/11/2026).
- 18/11/2026 (user): first asked to auto-clear photos every 2 days; on being told this breaks the 90-day promise (NFR-16, Must), chose "change that as one week promise". The tech lead reads this as: the whole museum and its photos are deleted 7 days after first publish, and the link shows the existing expired message. Drafts already expire 7 days after creation.
- 20/11/2026 (tech lead, QA request): `caption-card.spec.ts` U1 may use a CI-only upper bound of 1,500 ms (the run measured 1104.9 ms against 1,100 ms on a shared Linux runner), the same as the FR-15 CI allowance. The local limit stays 500 to 1,100 ms. Shared CI runners are not timing evidence.
- 23/11/2026 (tech lead): `npm run format` over the repo (38 files, formatting only; three e2e files needed a second pass). `src/styles/tokens.css` is left unformatted: Prettier splits token values over lines and two unit tests (look.test.ts, palette.test.ts) read them line by line. Decision: add `src/styles/tokens.css` to `.prettierignore` (devops-engineer, phase 6), because the file is a contract read by tests and by the designer as one token per line.
- 20/11/2026 (tech lead): formatted the six e2e files QA touched (they were already unformatted at HEAD); the rest of the format debt stays with devops-engineer in phase 6.
- 18/11/2026 (tech lead): this is a Feature iteration, because a Must requirement and user-facing wording change, combined with hosting work. Route: 1, 2 (architect only), 3, 4, 5, 6, 7.

## Open questions (owner)
- A2 questions answered 27/11/2026 (fail open; C-11 fixed in iteration 5). Annotation wording ("flag missing" or "purge behind"): product-manager, with the wording alignment.
- Q-36 to Q-45: answered at A1 on 26/11/2026 (see Approvals). Q-37 (egress) still needs the architect's confirmation in phase 2; Q-45 (N-13 target) the scene-developer's measurement.
- Q-34 (user, before launch; backlog V-7): confirm on supabase.com/pricing the 1 GB storage, 500 MB database, about 5 GB egress and about 500,000 Edge Function invocations a month, whether a Sydney region is offered on Free, what happens at each limit, and how long a paused project can be restored.

## Open requests (owner)
- product-manager (before or with phase 3, from ux-ui-designer and architect 26/11/2026): align FR-108's second sentence to "does not change while the card is open, unless the viewport changes layout kind" (C-9); optionally US-75's proposed wording line to the spec 13.5 copy; optionally NFR-33 (e) wording "calls no other function and no purge" (C-8); answer spec 13.13 Q1 (Try again after a Publish press does not publish by itself, recommended).
- architect (phase 3): confirm `finaleDockFor` through `detectLayout`; add "Photos are waiting for space" to the shared issue list for `photos-space-full`; confirm whether the step-1 Next gate reports `photos-space-full`.
- devops-engineer (phase 6, from product-manager 26/11/2026): docs/deployment.md "act now" usage line and the app's new refusal line are both 80%, so the owner could be told to act only after uploads stop; set the guide's warning line below 80% and remove "no in-app handling (FR-104 deferred)" (line 114 and the "When a limit is reached" table).
- qa-engineer, fix applied 25/11/2026 (user: "do the fix"; qa-report round 9b, mutation check failed as expected on both projects); CI run 45585670566 (2e5f396) green, mobile-webkit 337 passed, 0 flaky; one green run does not prove the flake is cured, so keep watching: mobile-webkit failure of `tests/e2e/ceiling.spec.ts:178` (FR-95 AC-1) in deploy run 45385807054 attempt 1. Diagnosed 25/11/2026 (docs/qa-report.md round 9): test-environment fault (Partly verified). The CI trace shows no context loss and the scene drawn in the frames before and after; only the `page.screenshot` capture was blank (non-preserved drawing buffer on CI software GL). Locally 12 of 12 pass; 0 context-loss events; one WebGL context, none created per room switch. Proposed fix (test only): `flatShare` re-captures up to 3 times, two animation frames apart, and fails only if every capture is flat; check it still fails against a build with the ceiling forced opaque. Reopen as a scene-developer product fault if it recurs with a context-loss event in the trace.
- user: turn on failed-workflow e-mails (GitHub, Settings, Notifications, Actions) and set a 50-day reminder for the scheduled keep-alive (docs/deployment.md step 8). Watch 7 days of keep-alive runs (step 10).
- user (optional): run the purge check SQL in supabase/README.md step 8.

Every iteration 4 request was done or moved to the backlog (V-6, V-7, V-8, DEBT-2, OPS-1, CR-12 to CR-14, DEBT-3, DEBT-4); review routing is recorded in docs/review.md and docs/lifecycle/retrospective.md.

## Environment notes
- 27/11/2026: the sandbox blocks local port binding and hides the long-running vite preview on 4173 (it is running, PID from 18/11/2026). Browser test runs need the tech lead to run outside the sandbox with `PW_REUSE_SERVER=1`, or the user to set `sandbox.network.allowLocalBinding: true`.
- Node v26.7.0, npm 11.19.0, public npm registry reachable (18/11/2026).
- Vite preview on port 4173 serves dist/ for Playwright; never kill it. Use 2 workers on desktop-chromium.
- Firefox cannot launch in this sandbox.
- Isolated verification: the tech lead's verify.sh runs tsc, eslint, vitest, build and the bundle check in a clean worktree.
- Agents do not commit. The tech lead commits and pushes to main. No deploy, no Pages enablement, no secrets and no cloud resources without the user's explicit approval for that action.
- Free-tier facts used (third-party sources, checked 18/11/2026; confirm on supabase.com/pricing): Supabase Free has 500 MB database, 1 GB file storage, about 5 GB egress a month, 2 active projects, and pauses after 7 days idle. GitHub Actions is free for public repos on standard runners. Scheduled workflows in public repos are switched off after 60 days with no repo activity.

## Deploy record (24/11/2026)
- Done by the user: Supabase Free project created (repo not connected in Supabase; deploys go through deploy-supabase.yml), sign-ups and anonymous sign-ins off (confirmed `disable_signup: true` via /auth/v1/settings), function secrets ALLOWED_ORIGINS, CRON_SECRET, RATE_LIMIT_SALT, Vault secrets project_url and cron_secret, GitHub secrets SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF.
- Done by the tech lead (approved): Pages enabled; variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable key) set; Deploy Supabase run 45385362605 (migrations and five functions) green; Deploy to GitHub Pages run 45385807054 green on attempt 2 (attempt 1: mobile-webkit ceiling failure, see Open requests); keep-alive manual run 45385818352 green (checkedAt 2026-11-24T11:37:10Z).
- Verified: smoke-test.mjs 16 of 16 PASS; anon key refused on the museums table (42501) and gets an empty photos listing; CORS preflight allows https://patlu29.github.io (204) and refuses another origin (403); live bundle points at the project and holds no service-role or sb_secret_ key; live site loads in Chromium and WebKit (iPhone 13 emulation) with no console errors (one WebKit unused-preload warning, as in CI); a bad share link shows the not-found screen from a live 404 (7.8 s cold, first call).
- User check 25/11/2026: the user reports the live site "working fine" in Safari on their Mac (no blank 3D view seen). Not a real iPhone.
- Not done: creating a museum through the live UI and opening it in a second browser (docs/deployment.md step 6); Linux visual baselines (step 9).

## Not verified
- CI on GitHub: green on Linux since run 44686612364 (20/11/2026); run 45156570793 (23/11/2026) concluded success overall, with format:check enforced. desktop-firefox (non-blocking) fails: 4 accessibility tests time out at Start/focus, then the 25-minute step limit (V-8). visual.spec.ts is left out on Linux until Linux baselines are recorded (V-4/V-8). Keep-alive workflow has not run with a real project (skipped until VITE_SUPABASE_URL is set).
- Iteration 4, needs the deployed project: hourly purge, removal within 24 h, 23 runs in 24 h (US-68 AC-5, AC-6, US-24 AC-3, NFR-16 e/f), keep-alive counting as Supabase activity (NFR-32), US-69 AC-1 dashboard check, US-69 AC-5 red run.
- Real devices, Safari and Firefox frame rate, screen readers, Linux visual baselines (carried from iteration 3).

---

# History before ADLC

**Status before ADLC (to 11/11/2026):** CR-4 (improved UI, polish) QA round 6 done (Go with conditions, 0 failing tests, BUG-13 to BUG-18 open), fix rounds 1 and 2 done (spec v2.0.3, requirements v0.6.2), QA round 7 done (Go, 979 passed / 0 failed / 74 skipped); BUG-18 linen residuals accepted by the user as final FR-89 class X-1 to X-5 (requirements v0.6.3); CR-4 complete; Release with CR-1 to CR-3: CR-1 to CR-3 built (gender, presentation camera, photo notice, readable caption card); QA complete (round 5: Go, 691 passed / 0 failed / 41 skipped); Phase 7 pipeline written (CI on push/PR; Pages, Supabase and Linux-baseline workflows manual only); nothing deployed


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
- CR-4 performance (tech lead, 03/11/2026):
  - NFR-27 is signed off: worst character 5,862 of 6,000, 3 draw calls per character; scene at the entrance with 20 photos is Low 46 / High 49 calls; frame rate is the same as before CR-4 on the M4 setup.
  - The three.js chunk is split into `three-*` (921.4 kB, 985 kB guard) and `scene-shared-*` (66.2 kB). The CI check also guards the two together at 1,000 kB (987.6 kB today, 12.4 kB spare). Decision: the combined figure is the reading of NFR-27's "three.js chunk", and 12.4 kB spare is accepted for this release. Slimming the builder preview's unused materials (about 8 to 12 kB) is a follow-up, not a release blocker.
  - Not verified: real phones and laptops, Safari and Firefox frame rate, the 15-minute soak for CR-4. These go on the user's manual pre-release checks.
- CR-4 QA round 6 (tech lead, 10/11/2026): 977 passed / 0 failed / 76 skipped across desktop-chromium, mobile-chromium and mobile-webkit (944 real passes plus 33 `test.fail` markers for open bugs). Team switched to the `application-builder` plugin (same roles) after the old plugin became unavailable. Decisions on QA's open questions:
  - BUG-14 (finale footer clipped at 320 px and at 200% text; "Keep exploring" wraps at 1280x720): fix. The footer must never clip; on narrow or large-text layouts the strip may grow or the card may scroll. The designer records it afterwards.
  - BUG-13 (Escape does not close More options): fix. Escape closes it and returns focus to the control; no requirement change needed.
  - BUG-16, BUG-17 (200% text at 320 px): fix with BUG-14 in the same frontend round.
  - BUG-15 (two 24-character names overlap on pictures 1 to 3 on phones): one fix attempt by the scene developer; the 360x640 picture 1 residual stays accepted.
  - BUG-18 (lit-museum edge contrast under 3:1 well beyond X-1 to X-8): QA's lit-museum figures disagree with the technical-artist's earlier 7 of 240. Technical-artist to reconcile the two methods first, then fix real failures without new geometry where possible (default trousers on oak at 1.9 is a priority). If the remaining cases need geometry or a budget change, they come back to the tech lead.
- CR-4 fix round 1 (tech lead, 11/11/2026): BUG-13, 14, 15, 16, 17 fixed (70c6b54, 50e6f86; spec v2.0.2 9b9df9f). BUG-18 part-fixed with shader constants only (no triangles or draw calls). The two contrast methods differed because of pixel ratio: phones in Auto render at 1.5, stepping down to 1.0 when slow. Decisions:
  - FR-89 is measured at pixel ratio 1.5 (phone Low tier), not supersampled. 1.0 is a stretch case.
  - The governor floor stays as it is (frame rate wins over edge contrast at 1.0).
  - QA's audit pins the ratio and drops the polluted first case.
  - Round 2: the technical artist undoes the curly-short regression on the finale wall, and the designer brings the `--look-*` rim and contour tokens into line with the shader.
  - Remaining cases under 3:1 at 1.5 (torso and head on linen at 2.0 to 2.8; afro, braids and curly-short hair on linen) are accepted as recorded minor issues if round 2 cannot clear them. Characters read clearly in QA's screenshots. Lightening the linen wall and dado (the outline needs a lighter backdrop; darkening would make it worse) is offered to the user as an option, not done by default.
- CR-4 fix round 2 (tech lead, 11/11/2026, 9f576e2): `--look-rim-max` 0.85 and `--look-contour-max` 1 in tokens and code (the shader reads them from LOOK); hair rim widens on coarse shells, so curly-short on the finale wall is back above 3:1 (black 3.23, pink 3.5) and no hair case on the finale wall is under 3:1. Afro and braids pass on the finale wall (3.28 to 4.24). Outline checked by eye at 360x640: reads as ink, not a sticker; EDGE_W2 stays 2. Still under 3:1 at 1.5: torso and arms on the linen dado (2.64 to 2.77), head on linen (about 2.0), hair on linen (curly-short 1.85 to 1.99, braids 1.97 to 2.10, afro 2.35 to 2.63, long-wavy blonde 2.9 and platinum 2.8, short-crop platinum and white about 2.95). Lighter-linen option measured in a scratch build: wall and dado x1.25 in linear colour clears all 13 linen cells in the 4x4 subset, but the cream mount no longer separates from the wall by tone and the room looks flatter and sandier. Not shipped.
- CR-4 close (user, 11/11/2026): the user accepted the remaining linen-wall outline cases as known exceptions and kept the current look (no lighter linen). Requirements v0.6.3 (48e3efb) makes X-1 to X-5 (linen wall only) the final class; the audit encodes it with 0 results outside at pixel ratio 1.5. BUG-15 1 px residual and N-11 to N-13 stay as recorded minor issues.
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

Round 7: 2 open bugs after the two allowed fix rounds: BUG-18 (major under FR-89; 13 cells under 3:1 at pixel ratio 1.5, all on the linen wall, rows 6 to 13 not yet in the exception class) and BUG-15 (minor, Guide label up to 1 px inside the 8 px margin). Observations N-11 (finale dock flips on loaded hosts), N-12 (HUD pills touch at 200% text on 320 px), N-13 (stacked label covers the Guide at the 24-character name limit). BUG-13, 14, 16, 17 fixed. FR-89 sampling method: screen scale 3 with the canvas pinned at 1.5 (the stricter of the two; tech lead, 11/11/2026). Round 6: 6 open bugs, 0 failing tests. Round 5: 0 open bugs. BUG-1 to 4 and BUG-6 to 11 fixed; one minor known issue (N-10). Suite 691 passed / 0 failed / 41 skipped across 3 projects, no test.fail markers; desktop suite can flake under machine load. BUG-1 to 4 fixed, BUG-5 accepted upstream. See docs/qa-report.md. BUG-1 scope (tech lead, 29/10/2026): persist character choices and text fields per US-6 AC-3 (Must); photo restore stays with US-29 (Should, Release 2).

Open design question: in the presenting view the Visitor and her name label partly cover the picture (camera sits behind her). Intended?
