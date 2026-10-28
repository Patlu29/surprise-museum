import {
  AdditiveBlending,
  Color,
  ShaderMaterial,
  Vector2,
  type BufferGeometry,
  type ColorRepresentation,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import fragmentShader from './dustMotes.frag.glsl?raw';
import vertexShader from './dustMotes.vert.glsl?raw';

export interface DustMotesOptions {
  color?: ColorRepresentation;
  opacity?: number;
  /** Cone height in metres (must match the cone geometry). */
  height: number;
  radiusTop: number;
  radiusBottom: number;
  /** Mote diameter in metres. */
  size?: number;
}

const scratch = new Vector2();

/**
 * Soft round points that drift slowly upwards inside the finale cone. Use with
 * `createDustMoteGeometry` (40 points or fewer, design spec 1.5) drawn as `Points`.
 *
 * Uniforms: uTime (seconds, drive from the frame clock), uMotion (1 or 0), uHeight, uRadiusTop,
 * uRadiusBottom, uSize (m), uOpacity (0 to 0.6), uColor. `uViewportHeight` is set automatically.
 * Reduced motion: call `setMotion(0)` and hide the mesh (design spec 6.9: no dust motes).
 */
export class DustMotesMaterial extends ShaderMaterial {
  constructor(options: DustMotesOptions) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Color(options.color ?? '#ffe2b0') },
        uOpacity: { value: options.opacity ?? 0.35 },
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uHeight: { value: options.height },
        uRadiusTop: { value: options.radiusTop },
        uRadiusBottom: { value: options.radiusBottom },
        uSize: { value: options.size ?? 0.03 },
        uViewportHeight: { value: 720 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: AdditiveBlending,
    });
  }

  setTime(seconds: number): void {
    const u = this.uniforms.uTime;
    if (u) u.value = seconds;
  }

  setMotion(amount: 0 | 1): void {
    const u = this.uniforms.uMotion;
    if (u) u.value = amount;
  }

  override onBeforeRender(
    renderer: WebGLRenderer,
    _scene: Scene,
    _camera: Camera,
    _geometry: BufferGeometry,
    _object: Object3D,
  ): void {
    const u = this.uniforms.uViewportHeight;
    if (u) u.value = renderer.getDrawingBufferSize(scratch).y;
  }
}
