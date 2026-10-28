import type { GraphicsQuality } from '../materials/quality';

/**
 * Graphics quality tier (technical-artist's `low` and `high`), chosen from the device and the
 * Visitor's setting. `low` means Lambert materials only, half-size textures, no environment map
 * and no finale cone or motes.
 *
 * Auto picks `low` on phones and on weak or software GPUs, and `high` otherwise. The Visitor's
 * setting wins: `settingsStore.quality` is 'auto' or 'low' today; passing 'high' here is how a
 * future manual toggle would force the full look.
 */
export type QualitySetting = 'auto' | 'low' | 'high';

export interface DeviceHints {
  /** `(pointer: coarse)`: a touch device. */
  coarsePointer: boolean;
  /** The shorter side of the screen in CSS pixels, to tell a phone from a tablet. */
  shortSide: number;
  /** `navigator.deviceMemory` in GB (Chromium only), or null. */
  deviceMemoryGb: number | null;
  /** `navigator.hardwareConcurrency`, or null. */
  cores: number | null;
  /** The unmasked WebGL renderer string, or null before a context exists. */
  renderer: string | null;
}

/** Software rasterisers and GPUs old or small enough that the full look would not hold 30 FPS. */
const WEAK_RENDERER = new RegExp(
  [
    'swiftshader',
    'llvmpipe',
    'softpipe',
    'software',
    'microsoft basic render',
    'mali-(400|450|t[0-8]\\d\\d)',
    'adreno \\(tm\\) ?[2-5]\\d\\d\\b',
    'powervr (sgx|ge|gx6)',
    'intel.*(gma|hd graphics [2-4]\\d{3})\\b',
    'vivante',
    'videocore',
  ].join('|'),
  'i',
);

export function isWeakRenderer(renderer: string | null): boolean {
  return renderer !== null && WEAK_RENDERER.test(renderer);
}

export function isPhone(hints: Pick<DeviceHints, 'coarsePointer' | 'shortSide'>): boolean {
  return hints.coarsePointer && hints.shortSide < 700;
}

export function resolveGraphicsQuality(
  setting: QualitySetting,
  hints: DeviceHints,
): GraphicsQuality {
  if (setting === 'low') return 'low';
  if (setting === 'high') return 'high';
  if (isPhone(hints)) return 'low';
  if (isWeakRenderer(hints.renderer)) return 'low';
  if (hints.deviceMemoryGb !== null && hints.deviceMemoryGb <= 2) return 'low';
  if (hints.cores !== null && hints.cores <= 2) return 'low';
  return 'high';
}

/** Reads what the browser tells us without a GL context. Safe on the server and in tests. */
export function readDeviceHints(renderer: string | null = null): DeviceHints {
  if (typeof window === 'undefined') {
    return { coarsePointer: false, shortSide: 1024, deviceMemoryGb: null, cores: null, renderer };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    shortSide: Math.min(
      window.screen?.width || window.innerWidth,
      window.screen?.height || window.innerHeight,
    ),
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    renderer,
  };
}

/** The unmasked renderer string of a WebGL context, or null if the browser hides it. */
export function readRendererName(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): string | null {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  if (!info) return null;
  const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
  return typeof name === 'string' ? name : null;
}
