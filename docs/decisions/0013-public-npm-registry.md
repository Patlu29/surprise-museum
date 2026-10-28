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
