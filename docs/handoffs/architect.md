# Handoff: architect

## Summary
I designed the architecture for Surprise Museum and scaffolded the project. The frontend uses the default stack (Vite, React, TypeScript, R3F, drei, Zustand) as a static site on GitHub Pages with hash routing. The backend is Supabase in Sydney: Edge Functions are the only data gateway, and RLS denies everything else. `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run format:check` all pass, and a headless smoke test rendered the canvas under the production CSP with no errors.

## Files changed
- `docs/architecture.md`: full architecture (stack and versions, diagrams, boundaries, scene design, data model, RLS, API contract, stores, routes, security, testing, budgets, environment variables, ownership, risks)
- `docs/decisions/0001` to `0013`: ADRs (stack, Pages and hash routing, Supabase gateway, client-side photo processing, renditions and loading, character-state abstraction, waypoint navigation, procedural avatars, linear layout, retention, DOM name labels, thin API client, public npm registry)
- `package.json`, `package-lock.json`, `.npmrc`: dependencies pinned exactly; scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `format`, `format:check`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: strict, `@/` and `@contract` aliases
- `vite.config.ts`: `base: '/surprise-museum/'`, aliases, Vitest config, build-only CSP meta and Supabase preconnect
- `eslint.config.js`: flat config with module-boundary import rules
- `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore`, `.env.example`, `index.html` (noindex, no-referrer, generic Open Graph tags)
- `playwright.config.ts`: starter config (three device projects, runs against `vite preview` under the base path)
- `public/.nojekyll`, `public/favicon.svg`, empty `public/models|textures|env/`
- `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/config/env.ts`: app shell with hash routes
- `src/ui/screens/*`: placeholder screens (Home, Create, Preview, Visit, Edit, NotFound, Loading)
- `src/scene/Experience.tsx`: placeholder canvas (floor and stand-in character)
- `src/domain/characters/characterState.ts`: NFR-25 interfaces (`CharacterState`, `CharacterStateSource`, `WorldContext`, `CharacterRegistry`, `MoveIntent`)
- `src/styles/tokens.css`, `src/styles/base.css`: placeholders for the designer
- Empty folders (with `.gitkeep`) for `src/api`, `src/media`, `src/state`, `src/hooks`, `src/lib`, `src/domain/*`, `src/scene/*` (including `characters/kit`), `src/ui/*`, `tests/unit`, `tests/e2e`
- `supabase/config.toml`, `supabase/README.md`, `supabase/functions/.env.example`
- `supabase/migrations/20261027000100_initial_schema.sql`: tables, constraints, RLS (no policies), revoked privileges, `rate_limit_hit`, `reserve_photo`, `delete_museum_rows`, private `photos` bucket
- `supabase/migrations/20261027000200_retention_schedule.sql`: hourly pg_cron purge through pg_net, and rate-limit cleanup
- `supabase/functions/_shared/contract.ts`: shared API types, limits, avatar option ids, token formats, routes
- `supabase/functions/{create-museum,get-museum,manage-museum,purge-expired}/index.ts`: stubs returning 501

## Decisions
- Default stack, no deviation; TypeScript pinned to 6.0.3 because `typescript-eslint` does not support TypeScript 7 yet; React held at 19.3 for R3F's peer range (ADR 0001)
- Hash routing with `wouter`, not the `404.html` fallback: tokens never reach GitHub's servers or referrers, and there is no 404 round trip (ADR 0002)
- Edge Functions are the only gateway; RLS on with no policies; tokens stored only as SHA-256 hashes; the share token is derived from the edit token (ADR 0003)
- Photos are processed in the browser (resize, re-encode JPEG, which strips metadata; lazy HEIC decoder), and the server verifies the bytes (ADR 0004)
- Two stored renditions (2048 and 1024 px) plus an inline 24 px placeholder; nearest-first texture queue (ADR 0005)
- `CharacterStateSource` abstraction and a pure `src/domain` layer, enforced by lint (ADR 0006)
- Waypoint graph and 2D collision, with no physics engine or navmesh (ADR 0007)
- Procedural primitive avatars with procedural animation; swappable for a glTF kit later (ADR 0008)
- Linear layout: entrance, then `ceil(n / 4)` rooms, then finale (ADR 0009)
- Hourly pg_cron purge through an Edge Function (ADR 0010)
- DOM name labels for emoji and accent support, hidden by line of sight (ADR 0011)
- No `supabase-js` in the browser; `fetch` and XHR for upload progress (ADR 0012)
- Project `.npmrc` uses the public registry, because the machine's corporate registry returned 401 and CI cannot reach it (ADR 0013)
- Photos upload as they are added, not at publish, so publishing is one small request (NFR-18)
- Code identifiers use US spelling (`color`) to match three.js; copy uses Australian English

## Assumptions
- `supabase/` replaces `server/` and is owned by the backend-developer. `docs/api.md` is the backend-developer's to create from section 7 of the architecture doc
- I wrote the initial migrations and the shared contract because the data model, RLS and API contract were explicitly part of this task; the backend-developer owns them from here
- `playwright.config.ts` was requested in the scaffold; the qa-engineer owns it from here
- Retention is 90 days from first publish; re-publishing after an edit (Release 2) does not extend it
- The edit screen in the MVP offers view, copy share link and delete only; full editing is Release 2 (FR-51 is Should)
- Drafts that are never published are purged after 7 days
- Avatar option ids in `contract.ts` are placeholders for the designer's labels; the counts meet or exceed FR-13 and FR-14
- The entire site is `noindex` (GitHub Pages project sites cannot use `robots.txt`)

## Open questions
- Supabase plan: free projects pause after a period of inactivity and have no backups, which could break a gift link opened weeks later. Which plan should production use? (user; cost and plan selection is a user decision, and anything about our own pricing or contracts goes to the Sales team)
- `heic-to` is LGPL-3.0 (it bundles libheif). Is a lazily loaded, separately served LGPL chunk acceptable? (organisation's legal team, alongside the NFR-14 review)
- Are hash-style links (`.../surprise-museum/#/m/...`) acceptable to the user? (user)
- The project `.npmrc` overrides the machine's corporate npm registry for this folder. Is a public-registry project allowed under the organisation's policy? (user)
- Q-21 (finale podium as the closing-message trigger) is still a default; the architecture supports either answer (user)

## Requests for other agents
- backend-developer: implement the four Edge Functions to section 7 of the architecture doc and `contract.ts`; add validators to `contract.ts`; write `docs/api.md`; add pgTAP tests proving `anon` cannot read, write or list anything; add `deno test` coverage for the uniform 404 and the signed-upload `PUT` format; build `src/api` (fetch and XHR client)
- scene-developer: implement `src/domain` (layout, navigation, presentation director, Guide, sources, registry) with unit tests including the NFR-26 soak, then the scene (museum geometry, `Avatar` rig and animation, `PhotoLoader`, camera, `NameLabel`). Replace the placeholder `Experience.tsx`
- technical-artist: avatar part kit and palette in `src/scene/characters/kit/`, museum materials and lighting look in `src/scene/materials/`. Keep to the budgets in section 12 (6,000 triangles and 10 draw calls per character)
- frontend-developer: stores in `src/state` (section 8), the image pipeline in `src/media` (section 10.3, including the 4096 px canvas cap), the builder, overlays, joystick and keyboard input, WebGL and in-app browser checks, and a frame-busting check on the edit route. Replace the placeholder screens
- ux-ui-designer: replace `tokens.css` and `base.css`; supply labels and colours for the avatar option ids in `contract.ts`; style name labels (4.5:1, solid backing) and place the caption panel so it covers neither the Visitor nor the picture
- qa-engineer: take over `playwright.config.ts` (run `npx playwright install` first); add `@react-three/test-renderer` for the NFR-25 scripted-source test; mock `/functions/v1/*` in end-to-end tests
- devops-engineer: Pages workflow (build with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables, upload `dist/`, deploy); manual Supabase deploy workflow with `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` secrets; `docs/deployment.md` covering the one-time steps in `supabase/README.md`
- performance-optimiser: confirm the budgets in section 12 on the reference phone; consider texture eviction if NFR-6 shows memory pressure
