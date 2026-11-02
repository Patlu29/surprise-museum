/**
 * Lighting and renderer values for the museum look (design spec 1.1, 1.4).
 *
 * Warm light, about 3000 K, with no shadow maps (architecture 6.11): the mood comes from vertex
 * gradients, additive decals and the dark ceiling. Intensities are in three.js physical units,
 * where an ambient or hemisphere light of intensity PI shows a Lambert surface at its albedo.
 *
 * Tone mapping is Khronos PBR Neutral rather than ACES. ACES shifts hue and desaturates warm
 * creams and skin tones; Neutral keeps mid-tones close to the token colours, which matters for
 * the ten skin tones and the cream mounts. Photos opt out of tone mapping entirely.
 */
import { NeutralToneMapping, type ToneMapping, type WebGLRenderer } from 'three';
import { LOOK } from './look';
import { SCENE_PALETTE } from './palette';

export const COLOUR_TEMPERATURE_KELVIN = 3000;

export interface LightingConfig {
  toneMapping: ToneMapping;
  exposure: number;
  hemisphere: { sky: string; ground: string; intensity: number };
  key: {
    colour: string;
    intensity: number;
    /** Position of the directional light; it aims at the origin. */
    position: readonly [number, number, number];
  };
  /** Scales `scene.environment` (high quality only). */
  environmentIntensity: number;
}

export const MUSEUM_LIGHTING: LightingConfig = {
  toneMapping: NeutralToneMapping,
  exposure: 1,
  hemisphere: {
    sky: SCENE_PALETTE.lightSky,
    ground: SCENE_PALETTE.lightGround,
    // CR-4 (design spec 12.8.3): 2.7 to 2.5, so the washes and the darker ceiling carry the contrast.
    intensity: 2.5,
  },
  key: {
    colour: SCENE_PALETTE.lightWarm,
    intensity: 1.15,
    position: [3, 4.5, 4],
  },
  environmentIntensity: 0.3,
};

/**
 * The builder's avatar preview: neutral, slightly cool white on a soft cream backdrop, so skin
 * and hair colours read true while they are chosen (design spec 9.4).
 */
export const PREVIEW_LIGHTING: LightingConfig = {
  toneMapping: NeutralToneMapping,
  exposure: 1,
  hemisphere: { sky: '#fbfbfd', ground: '#d8cfc6', intensity: 2.0 },
  key: { colour: '#fffaf2', intensity: 1.7, position: [2, 4, 4] },
  environmentIntensity: 0,
};

/** Preview backdrop: the paper token `--color-surface-sunken`, a soft cream. The flat fallback. */
export const PREVIEW_BACKGROUND = '#efe5d6';

/**
 * Builder preview stage (design spec 12.8.4): a CSS radial gradient behind a transparent canvas.
 * Put `PREVIEW_STAGE_CSS` on the canvas wrapper and render with `alpha: true`. If a transparent
 * canvas is not practical, keep the flat `PREVIEW_BACKGROUND`. The edge band is lighting
 * independent, so the preview shows what the visit shows.
 */
export const PREVIEW_STAGE_CSS = `radial-gradient(70% 70% at 50% 40%, ${LOOK.stageCentre}, ${LOOK.stageEdge})`;

/** Applies tone mapping and exposure. Call once from the Canvas `onCreated`. */
export function applyRendererSettings(
  gl: WebGLRenderer,
  lighting: LightingConfig = MUSEUM_LIGHTING,
): void {
  gl.toneMapping = lighting.toneMapping;
  gl.toneMappingExposure = lighting.exposure;
}

/**
 * The Canvas `gl` props that matter for the look. Antialiasing stays on; phones can drop it via
 * the performance tier.
 */
export const CANVAS_GL_DEFAULTS = {
  toneMapping: NeutralToneMapping,
  powerPreference: 'high-performance',
} as const;
