import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  type ColorRepresentation,
} from 'three';
import fragmentShader from './lightCone.frag.glsl?raw';
import vertexShader from './lightCone.vert.glsl?raw';

export interface LightConeOptions {
  color?: ColorRepresentation;
  /** Peak alpha. Design spec 1.5: 8 to 10%. */
  opacity?: number;
}

/**
 * Additive volumetric-looking cone for the finale. Use with an open-ended cone from
 * `createLightConeGeometry` (UV v runs 0 at the floor to 1 at the oculus).
 *
 * Uniforms: uColor, uOpacity (0 to 0.2, default 0.09), uGlow (1 to 2, default 1; the R2 "all
 * viewed" highlight raises it). Skip this mesh entirely at low graphics quality.
 */
export class LightConeMaterial extends ShaderMaterial {
  constructor(options: LightConeOptions = {}) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Color(options.color ?? '#ffe2b0') },
        uOpacity: { value: options.opacity ?? 0.09 },
        uGlow: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
  }

  setGlow(value: number): void {
    const u = this.uniforms.uGlow;
    if (u) u.value = value;
  }
}
