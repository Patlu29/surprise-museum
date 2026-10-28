# 0006: Character-state abstraction and a pure domain layer

## Status
Accepted (27/10/2026)

## Context
NFR-25 (Must) requires that character state (position, facing, animation, presentation) flows through an abstraction that separates where the state comes from from how it is rendered, so that a network source can later drive either character without changing rendering, name labels or the caption panel. It must be proven by a test that drives a character from a scripted source. NFR-26 needs a 30-minute Guide soak test.

## Decision
- Define `CharacterState`, `CharacterStateSource`, `WorldContext` and `CharacterRegistry` in `src/domain/characters/characterState.ts`.
- MVP sources: `LocalVisitorController` (input and collision) and `AutonomousGuideSource` (Guide AI). Tests use `ScriptedCharacterSource`. Future: `NetworkCharacterSource`.
- Renderers (`Avatar`, `NameLabel`) read only `CharacterState`. The UI reads only `sessionStore`, which the registry updates on presentation changes.
- Per-frame state lives in sources, not in Zustand.
- `src/domain` is pure TypeScript with no React, three.js or stores, enforced by ESLint. Layout, navigation, the presentation director and the Guide live there.

## Consequences
- Live mode becomes "add a source and a transport", not a rewrite.
- The NFR-26 soak test runs as a fast Vitest unit test, with no browser.
- The domain logic could later run in a worker or on a server (for example to make the Guide authoritative in live mode).
- Small duplication: the domain has its own tiny vector helpers instead of three.js `Vector3`.
