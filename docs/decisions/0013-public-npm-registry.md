# 0013: Resolve packages from the public npm registry

## Status
Accepted (27/10/2026)

## Context
The machine that scaffolded the project has a user-level npm configuration pointing to a private corporate registry, which rejected the request (HTTP 401). The project is public on GitHub and is built by GitHub Actions, which cannot reach that private registry. A lockfile that records private-registry URLs would break CI.

## Decision
Add a project-level `.npmrc` with `registry=https://registry.npmjs.org/`, `save-exact=true` and `engine-strict=true`.

## Consequences
- Installs and the lockfile behave the same on every machine and in CI.
- This overrides the machine-wide registry for this folder only. If the organisation requires all packages to come through its proxy, replace this with a proxy that GitHub Actions can reach, and regenerate the lockfile.

## Amendment (18/11/2026): Deno needs its own `.npmrc`
The first real CI run failed because the three `supabase/functions` `deno.lock` files recorded `tarball` URLs on a private corporate mirror. Deno does not read the repository-root `.npmrc`: it reads only the `.npmrc` beside the `deno.json` it is given, and otherwise the user's `~/.npmrc`. It does not walk up parent folders. This was reproduced on 18/11/2026 with Deno 2.9.6 (`npx --yes deno@2.9.6`, fresh `DENO_DIR`): with only the root file, both `--config supabase/functions/deno.json` and `--config supabase/functions/create-museum/deno.json` downloaded from the mirror and wrote 9 `tarball` lines. With an `.npmrc` beside the config, every download came from `registry.npmjs.org` and no `tarball` line was written.

Decision: the root `.npmrc` keeps `registry`, `save-exact` and `engine-strict`, each now with a one-line comment. **Every folder under `supabase/functions/` that has a `deno.json` also gets an `.npmrc` with `registry=https://registry.npmjs.org/`**: `supabase/functions/` itself, `create-museum/`, `get-museum/`, `manage-museum/` and `purge-expired/`. A new function folder with its own `deno.json` (for example `keep-alive/`, ADR 0022) needs one too. No file may hold a token, `_auth` or any credential line. If a `deno.lock` ever contains a `"tarball"` key, it was resolved from a non-default registry and must be regenerated.
