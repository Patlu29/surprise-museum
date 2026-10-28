# 0001: Use the default 3D web stack, with TypeScript pinned to 6.0

## Status
Accepted (27/10/2026)

## Context
The app is an interactive 3D scene with a substantial 2D builder and overlays, delivered as a static site to phones. The team's default stack (3d-tech-stack skill) is Vite, React, TypeScript, React Three Fiber, drei and Zustand. No requirement points to a deviation: there is no heavy physics (Babylon.js), no SEO need (server rendering), and WebGPU is not supported widely enough on the reference phones. At scaffold time TypeScript 7.0 is current, but `typescript-eslint` 8.72 supports only TypeScript below 6.1, and `@react-three/fiber` 9.8 supports React below 19.4.

## Decision
- Use the default stack: Vite 8, React 19.3, TypeScript (strict), three.js 0.186 with `@react-three/fiber` 9.8 and `@react-three/drei` 10.7, Zustand 5, Vitest 5, Playwright 1.64, ESLint 10 and Prettier 3.
- Pin TypeScript to 6.0.3 until `typescript-eslint` supports TypeScript 7.
- Pin exact versions. Do not upgrade React past R3F's supported range.
- Do not add physics, post-processing, `leva` or `r3f-perf` in the MVP.

## Consequences
- The team works in a familiar, well-documented stack; UI and scene share stores easily.
- React and R3F upgrades must be done together and checked against R3F's peer range.
- Moving to TypeScript 7 later is a small config change once lint tooling supports it.
