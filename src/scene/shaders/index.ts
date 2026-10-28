/**
 * Custom shader materials (owner: technical-artist).
 *
 * All three are plain `ShaderMaterial` subclasses, so they work in any three.js code and in R3F
 * through `<primitive object={material} attach="material" />`. They are mobile-safe: mediump,
 * no loops, no texture reads. See docs/handoffs/technical-artist.md for uniforms and ranges.
 */
export { DustMotesMaterial, type DustMotesOptions } from './dustMotes/DustMotesMaterial';
export { GlowDecalMaterial, type GlowDecalOptions } from './glowDecal/GlowDecalMaterial';
export { LightConeMaterial, type LightConeOptions } from './lightCone/LightConeMaterial';
