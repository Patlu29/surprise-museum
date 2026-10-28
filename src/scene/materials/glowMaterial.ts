/**
 * Vertex glow: lets one lit material show "lit" parts (picture-light strips, lamp discs, the
 * podium's brass ring) without a second material or draw call.
 *
 * Geometry carries a float attribute `aGlow` (0 to 1). The fragment shader adds
 * `surfaceColour * aGlow * uGlow` to the emitted light, so a pale strip reads as a lamp. The
 * shared `uGlow` uniform scales every glowing vertex on the material, which is how the podium
 * ring brightens on enter. It is a small patch of the built-in Lambert and Standard shaders, so
 * lighting, fog and tone mapping all still work.
 */
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

export interface GlowHandle {
  /** Shared uniform: set `.value` to brighten or dim every glowing vertex (default 1). */
  readonly uGlow: { value: number };
}

/** Patches `material` in place and returns a handle for the glow multiplier. */
export function applyVertexGlow<T extends Material>(material: T, initial = 1): T & GlowHandle {
  const uGlow = { value: initial };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uGlow = uGlow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aGlow;\nvarying float vGlow;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlow;',
      );
  };
  material.customProgramCacheKey = () => 'museum-vertex-glow';

  return Object.assign(material, { uGlow }) as T & GlowHandle;
}
