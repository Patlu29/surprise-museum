import {
  AdditiveBlending,
  Color,
  NormalBlending,
  ShaderMaterial,
  type Blending,
  type ColorRepresentation,
} from 'three';
import fragmentShader from './glowDecal.frag.glsl?raw';
import vertexShader from './glowDecal.vert.glsl?raw';

export interface GlowDecalOptions {
  /** sRGB colour (hex string or Color). */
  color?: ColorRepresentation;
  /** Peak alpha, 0 to 1. */
  opacity?: number;
  /** Falloff sharpness. 1 is linear, 2 is soft, 4 is tight. */
  power?: number;
  /** 0 is an ellipse, 1 is a rounded rectangle. */
  square?: number;
  /** 0 is even, 1 is brightest at the top edge. */
  topBias?: number;
  /** `additive` for light, `normal` for shadows. */
  blend?: 'additive' | 'normal';
  /** Polygon offset so a decal never z-fights the surface it sits on. */
  polygonOffsetFactor?: number;
  /**
   * Read the `aIntensity` vertex attribute. Required for geometry from `DecalBatch`; leave off
   * for plain planes that have no such attribute (a missing attribute would read as zero).
   */
  vertexIntensity?: boolean;
  /**
   * When drawn as an InstancedMesh with instance colours, intensity is `instanceColor.r` times
   * this gain. The default of 2.2 maps the scene's pool levels (0 to 0.45) to 0 to 1.
   */
  instanceGain?: number;
}

/**
 * A soft-edged decal drawn entirely in the fragment shader (no texture).
 *
 * Geometry needs `position` and `uv` (0 to 1 across the quad). With `vertexIntensity: true` it
 * also needs a float attribute `aIntensity` (0 to 1 per vertex); the geometry helpers in
 * `src/scene/materials/geometry/decals.ts` supply all three. Instanced meshes work too. Drawn transparent, depth-tested, not depth-written and not tone mapped.
 *
 * Uniforms (all live-editable through `.uniforms.<name>.value`):
 *   uColor    sRGB-to-linear colour handled by three.js (`Color`)
 *   uOpacity  0 to 1, peak alpha
 *   uPower    0.5 to 6, falloff sharpness
 *   uSquare   0 to 1, ellipse to rounded rectangle
 *   uTopBias  0 to 1, vertical fade for wall washes
 *   uInstanceGain  0.5 to 4, instance-colour gain (instanced use only)
 */
export class GlowDecalMaterial extends ShaderMaterial {
  constructor(options: GlowDecalOptions = {}) {
    const blending: Blending = options.blend === 'normal' ? NormalBlending : AdditiveBlending;
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Color(options.color ?? '#ffd9a0') },
        uOpacity: { value: options.opacity ?? 0.3 },
        uPower: { value: options.power ?? 2 },
        uSquare: { value: options.square ?? 0 },
        uTopBias: { value: options.topBias ?? 0 },
        uInstanceGain: { value: options.instanceGain ?? 2.2 },
      },
      defines: options.vertexIntensity ? { USE_VERTEX_INTENSITY: '' } : {},
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending,
      polygonOffset: true,
      polygonOffsetFactor: options.polygonOffsetFactor ?? -2,
      polygonOffsetUnits: -2,
    });
  }

  get opacityScale(): number {
    return this.uniforms.uOpacity?.value as number;
  }

  set opacityScale(value: number) {
    const u = this.uniforms.uOpacity;
    if (u) u.value = value;
  }
}
