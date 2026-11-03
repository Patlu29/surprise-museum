/**
 * Avatar body and hair materials (design spec 12.8.2 A and E, ADR 0021 7.2).
 *
 * Both are the vertex-colour Lambert they always were, patched once with `onBeforeCompile`:
 *   - the dual-band silhouette edge (body and hair), a few ALU operations on `fwidth`;
 *   - the outfit pattern (body only), driven by the `outfitMask` vertex attribute.
 * No extra pass, mesh, texture or draw call. Each patch has a constant program cache key, so
 * every rig and every pattern shares one program per material kind and changing the pattern
 * never recompiles. A future change to either material must keep the patch and the key.
 *
 * The GLSL files carry no comments, so the shipped strings stay small (the three.js chunk has a
 * 985 kB guard). What they do:
 *   avatarEdge.glsl            `ndv = dot(normal, viewDir)`; `d = 0.7 * ndv / fwidth(ndv)` is about the pixel
 *                              distance from the silhouette. 0.5 would be exact on a smooth round part and 1.0
 *                              on a flat facet; 0.7 was chosen by measuring both limbs and head (see
 *                              docs/handoffs/technical-artist.md). A light rim on the outer 0.6 px and a dark
 *                              contour to 1.5 px, strengths from LOOK. Applied to the lit colour, before tone mapping.
 *   avatarPattern.vert/frag    `outfitMask` is, per vertex: more than 0 the (even) number of 40 mm cells round the
 *                              part, 0 plain, -1 a small face feature or badge that gets no edge (a flat
 *                              varying, so a triangle takes its last vertex's value). The pattern is drawn from
 *                              the bind-pose position and normal, so it sticks to the cloth. Stripes run on
 *                              height, checks and dots on height and the angle round the part, antialiased with
 *                              `fwidth`, fading to flat when a cell is under about 2 px.
 *
 * Uniforms (all via shared or per-rig `{ value }` objects, so nothing is cloned per material):
 *   uEdgeContour, uEdgeRim   linear colours from LOOK.contour and LOOK.rim
 *   uEdgeParams              x rim px, y contour px (both times the pixel ratio), z rim max, w contour max
 *   uOutfitPattern           0 plain, 1 stripes, 2 checks, 3 dots; `plain` returns today's colour exactly
 *   uPatternMix              0 to 1, scales the ink (the scene may cross-fade it)
 *   uInkTarget, uInkAmount   the ink is `mix(vertexColour, uInkTarget, uInkAmount)`, a tint of the outfit colour
 */
import {
  Color,
  DoubleSide,
  MeshLambertMaterial,
  Vector4,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import type { AvatarOutfitPattern } from '@contract';
import { LOOK } from '../../materials/look';
import edgeGlsl from './avatarEdge.glsl?raw';
import patternFragGlsl from './avatarPattern.frag.glsl?raw';
import patternVertGlsl from './avatarPattern.vert.glsl?raw';

/** Edge uniforms are shared by every avatar material. */
const EDGE_UNIFORMS: Record<'uEdgeContour' | 'uEdgeRim' | 'uEdgeParams', IUniform> = {
  uEdgeContour: { value: new Color(LOOK.contour) },
  uEdgeRim: { value: new Color(LOOK.rim) },
  uEdgeParams: { value: new Vector4(LOOK.rimPx, LOOK.contourPx, LOOK.rimMax, LOOK.contourMax) },
};

let lastPixelRatio = 1;

/** Keeps the band a constant number of CSS pixels wide on any pixel ratio. */
function syncPixelRatio(renderer: WebGLRenderer): void {
  const ratio = renderer.getPixelRatio();
  if (ratio === lastPixelRatio) return;
  lastPixelRatio = ratio;
  (EDGE_UNIFORMS.uEdgeParams.value as Vector4).set(
    LOOK.rimPx * ratio,
    LOOK.contourPx * ratio,
    LOOK.rimMax,
    LOOK.contourMax,
  );
}

/**
 * Edge tuning per material (`EDGE_K`, `EDGE_W1`, `EDGE_W2` in avatarEdge.glsl). `k` scales the
 * `ndv / fwidth(ndv)` distance (a flat facet reads as the pixel distance, a smooth part as twice
 * it, and a coarse facet adds half its width). `w1` and `w2` scale the rim and the contour width.
 * Body 0.7, 1, 1: chosen on the limbs and head. Hair 0.7, 1.2, 2: hair shells have coarse facets, so
 * a plain contour was too thin to show on mid and light backdrops; measured over 12 styles,
 * 4 colours and 5 backdrops, hair failures fell from 51 to 7 (docs/handoffs/technical-artist.md).
 */
const BODY_EDGE = { k: 0.7, w1: 1, w2: 1 };
const HAIR_EDGE = { k: 0.7, w1: 1.2, w2: 2 };

/** Pattern index for the `uOutfitPattern` uniform. */
export const PATTERN_INDEX: Readonly<Record<AvatarOutfitPattern, number>> = {
  plain: 0,
  stripes: 1,
  checks: 2,
  dots: 3,
};

/** Per-rig pattern uniforms. Mutate `.value`; the renderer uploads them on the next draw. */
export interface PatternUniforms {
  uOutfitPattern: IUniform<number>;
  uPatternMix: IUniform<number>;
  uInkTarget: IUniform<Color>;
  uInkAmount: IUniform<number>;
}

export function createPatternUniforms(): PatternUniforms {
  return {
    uOutfitPattern: { value: 0 },
    uPatternMix: { value: 1 },
    uInkTarget: { value: new Color(0, 0, 0) },
    uInkAmount: { value: 0 },
  };
}

/** The edge band (both materials) and the per-vertex mask it shares with the pattern. */
function patchEdge(shader: WebGLProgramParametersWithUniforms, pattern: boolean): void {
  const e = pattern ? BODY_EDGE : HAIR_EDGE;
  Object.assign(shader.uniforms, EDGE_UNIFORMS);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${patternVertGlsl}`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\nvOutfitCells = outfitMask;${
        pattern ? '\nvPatternPos = position;\nvPatternNormal = normal;' : ''
      }`,
    );
  // The hair has no pattern: it declares only the mask, so it keeps its single varying.
  const fragmentPars = pattern
    ? patternFragGlsl
    : 'flat varying float vOutfitCells;\nfloat edgeWeight() { return vOutfitCells < -0.5 ? 0.0 : 1.0; }';
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>\n#define EDGE_K ${e.k.toFixed(2)}\n#define EDGE_W1 ${e.w1.toFixed(2)}\n#define EDGE_W2 ${e.w2.toFixed(2)}\n${fragmentPars}\n${edgeGlsl}`,
    )
    .replace(
      '#include <opaque_fragment>',
      'outgoingLight = avatarEdge( outgoingLight, normal, vViewPosition, edgeWeight() );\n#include <opaque_fragment>',
    );
  if (pattern) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb = avatarPattern( diffuseColor.rgb );',
    );
  }
}

/** The body material: vertex colours, edge band and outfit pattern. */
export function createAvatarBodyMaterial(pattern: PatternUniforms): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: true });
  material.name = 'avatar-body';
  material.onBeforeCompile = (shader, renderer) => {
    syncPixelRatio(renderer);
    Object.assign(shader.uniforms, pattern);
    patchEdge(shader, true);
  };
  material.onBeforeRender = (renderer) => syncPixelRatio(renderer);
  material.customProgramCacheKey = () => 'avatar-body-v1';
  return material;
}

/** The hair material: vertex colours (both faces) and the edge band. */
export function createAvatarHairMaterial(): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
  material.name = 'avatar-hair';
  material.onBeforeCompile = (shader, renderer) => {
    syncPixelRatio(renderer);
    patchEdge(shader, false);
  };
  material.onBeforeRender = (renderer) => syncPixelRatio(renderer);
  material.customProgramCacheKey = () => 'avatar-hair-v1';
  return material;
}
