/**
 * World-space texture mapping and baked-looking shading for flat meshes.
 *
 * The scene can build walls, floors and the runner from plain boxes and planes with default UVs.
 * This patch makes those meshes look right anyway: textures tile in metres whatever the mesh
 * size, walls darken towards the ceiling and get a painted skirting, and the runner gets its
 * brass edge lines. All of it is a few instructions in the fragment shader, and it patches the
 * built-in Lambert and Standard materials, so lights, fog and tone mapping keep working.
 *
 * Assumes the route runs along Z with the runner centred on x = 0 (docs/architecture.md, 6.1).
 */
import {
  Color,
  Vector2,
  Vector3,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { LAYOUT } from '@/domain/layout/constants';
import { LOOK } from './look';
import { SCENE_PALETTE } from './palette';

export type WorldMappingKind = 'wall' | 'floor' | 'runner';

export interface WorldMappingOptions {
  kind: WorldMappingKind;
  /** Metres covered by one texture tile (x across, y along or up). */
  tile: readonly [number, number];
  /** Wall only: linear multiplier reached at the ceiling, per channel (shade / wall). */
  ceilingShade?: Vector3;
  /** Wall only: skirting colour and height. Omit for none. */
  skirting?: { colour: Color; height: number };
  /**
   * Wall only (design spec 12.8.3): the dado (lower wall colour up to `height`), the painted rail
   * on top of it, and the wall cap colour on flat tops. Omit for none.
   */
  dado?: { colour: Color; height: number; railColour: Color; railHeight: number };
  /** Wall only: wall height in metres, for the ceiling contact darkening and the cap (default the layout's). */
  wallHeight?: number;
  /** Runner only: runner width in metres (default 1.6). */
  runnerWidth?: number;
}

/** Strips GLSL comments and indentation from an inline snippet, to keep the shipped string small. */
const glsl = (source: string): string =>
  source
    .replace(/\/\/.*$/gm, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{2,}/g, '\n');

export function shadeRatio(wall: string, shade: string): Vector3 {
  const a = new Color(wall);
  const b = new Color(shade);
  return new Vector3(b.r / a.r, b.g / a.g, b.b / a.b);
}

/** Default wall options for the gallery (design spec 1.4). */
export function galleryWallMapping(): WorldMappingOptions {
  return {
    kind: 'wall',
    tile: [1.2, 1.2],
    ceilingShade: shadeRatio(SCENE_PALETTE.wall, SCENE_PALETTE.wallShade),
    skirting: { colour: new Color(SCENE_PALETTE.skirting), height: 0.12 },
    dado: {
      colour: new Color(LOOK.dado),
      height: DADO.height,
      railColour: new Color(LOOK.dadoRail),
      railHeight: DADO.railHeight,
    },
  };
}

/** Dado and rail dimensions (design spec 12.8.3): the lower wall to 0.95 m and a 0.05 m rail on top. */
export const DADO = { height: 0.95, railHeight: 0.05, railDepth: 0.04 } as const;
/** Wall contact darkening: the base fades out over 0.5 m, the ceiling line over 0.4 m. */
export const WALL_AO = { baseRange: 0.5, ceilingRange: 0.4 } as const;
/** The floor's edge shadow along each wall (spec 12.8.3: 0.45 m wide, 18% alpha). */
export const FLOOR_EDGE = { width: 0.45, alpha: 0.18 } as const;
/** The runner's darker inner band, inside the brass line. */
export const RUNNER_BORDER = { width: 0.12 } as const;

/** Wall options for the claret finale room: same gradient, a dimmed skirting. */
export function finaleWallMapping(): WorldMappingOptions {
  return {
    kind: 'wall',
    tile: [1.2, 1.2],
    ceilingShade: new Vector3(0.78, 0.78, 0.78),
    skirting: { colour: new Color(SCENE_PALETTE.skirting).multiplyScalar(0.62), height: 0.12 },
    // A deeper claret lower wall and a dimmed rail, like the skirting.
    dado: {
      colour: new Color(SCENE_PALETTE.finaleWall).multiplyScalar(0.82),
      height: DADO.height,
      railColour: new Color(LOOK.dadoRail).multiplyScalar(0.62),
      railHeight: DADO.railHeight,
    },
  };
}

export function applyWorldMapping<T extends Material>(material: T, o: WorldMappingOptions): T {
  const uniforms = {
    uTile: { value: new Vector2(o.tile[0], o.tile[1]) },
    uShadeStart: { value: 1.0 },
    uShadeEnd: { value: 3.2 },
    uShadeMul: { value: o.ceilingShade ?? new Vector3(1, 1, 1) },
    uSkirtColour: { value: o.skirting?.colour ?? new Color(1, 1, 1) },
    uSkirtHeight: { value: o.skirting?.height ?? 0 },
    uBrass: { value: new Color(SCENE_PALETTE.runnerEdge) },
    uHalfWidth: { value: (o.runnerWidth ?? 1.6) / 2 },
    uDadoColour: { value: o.dado?.colour ?? new Color(1, 1, 1) },
    uDadoHeight: { value: o.dado?.height ?? 0 },
    uRailColour: { value: o.dado?.railColour ?? new Color(1, 1, 1) },
    uRailHeight: { value: o.dado?.railHeight ?? 0 },
    uWallHeight: { value: o.wallHeight ?? LAYOUT.wallHeight },
    uAoColour: { value: new Color(LOOK.ao) },
    uAoBase: { value: LOOK.aoWallBase },
    uAoTop: { value: LOOK.aoCeiling },
    uRoomHalf: { value: LAYOUT.halfWidth },
    uFloorAo: { value: FLOOR_EDGE.alpha },
    uBorderColour: { value: new Color(LOOK.runnerBorder) },
  };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldN;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wpos = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
        wpos = instanceMatrix * wpos;
        #endif
        wpos = modelMatrix * wpos;
        vWorldPos = wpos.xyz;
        vWorldN = normalize( mat3( modelMatrix ) * objectNormal );`,
      );

    const mapping =
      o.kind === 'floor'
        ? 'vec2 wUv = vec2( vWorldPos.x, vWorldPos.z ) / uTile;'
        : o.kind === 'runner'
          ? 'vec2 wUv = vec2( vWorldPos.x, vWorldPos.z ) / uTile;'
          : `vec3 an = abs( vWorldN );
             vec2 wUv = ( an.x > an.z ? vec2( vWorldPos.z, vWorldPos.y ) : vec2( vWorldPos.x, vWorldPos.y ) ) / uTile;`;

    const extra = glsl(
      o.kind === 'wall'
        ? `
          float vertical = 1.0 - smoothstep( 0.35, 0.9, abs( vWorldN.y ) );
          float shadeT = smoothstep( uShadeStart, uShadeEnd, vWorldPos.y ) * vertical;
          diffuseColor.rgb *= mix( vec3( 1.0 ), uShadeMul, shadeT );
          float skirt = ( 1.0 - smoothstep( uSkirtHeight - 0.004, uSkirtHeight, vWorldPos.y ) ) * vertical;
          skirt *= step( 0.001, uSkirtHeight );
          diffuseColor.rgb = mix( diffuseColor.rgb, uSkirtColour * weave, skirt );
          // Dado, then its painted rail (the real rail is a geometry request), then the skirting on top.
          float hasDado = step( 0.001, uDadoHeight ) * vertical;
          float dado = ( 1.0 - smoothstep( uDadoHeight - 0.004, uDadoHeight, vWorldPos.y ) ) * hasDado;
          vec3 wallBase = diffuseColor.rgb;
          diffuseColor.rgb = mix( wallBase, uDadoColour * weave, dado );
          float rail = smoothstep( uDadoHeight - 0.004, uDadoHeight, vWorldPos.y )
            * ( 1.0 - smoothstep( uDadoHeight + uRailHeight - 0.004, uDadoHeight + uRailHeight, vWorldPos.y ) ) * hasDado;
          diffuseColor.rgb = mix( diffuseColor.rgb, uRailColour * weave, rail );
          diffuseColor.rgb = mix( diffuseColor.rgb, uSkirtColour * weave, skirt );
          // Contact darkening: the base 12% over 0.5 m, the ceiling line 18% over 0.4 m, tinted --look-ao.
          float aoBase = uAoBase * ( 1.0 - smoothstep( 0.0, ${WALL_AO.baseRange.toFixed(2)}, vWorldPos.y ) );
          float aoTop = uAoTop * smoothstep( uWallHeight - ${WALL_AO.ceilingRange.toFixed(2)}, uWallHeight, vWorldPos.y );
          diffuseColor.rgb = mix( diffuseColor.rgb, uAoColour, ( aoBase + aoTop ) * vertical );
          // The flat top of a wall (seen in the ceiling cutaway) is capped in the rail colour.
          float capTop = smoothstep( 0.9, 0.99, vWorldN.y ) * step( uWallHeight - 0.02, vWorldPos.y ) * step( 0.001, uRailHeight );
          diffuseColor.rgb = mix( diffuseColor.rgb, uRailColour * weave, capTop );`
        : o.kind === 'runner'
          ? `
          float ax = abs( vWorldPos.x );
          float outer = uHalfWidth - 0.07;
          float inner = outer - 0.028;
          float line = smoothstep( inner - 0.003, inner + 0.003, ax ) * ( 1.0 - smoothstep( outer - 0.003, outer + 0.003, ax ) );
          line *= smoothstep( 0.5, 0.9, vWorldN.y );
          // A darker inner band, ${RUNNER_BORDER.width.toFixed(2)} m wide, just inside the brass line.
          float band = ( 1.0 - smoothstep( inner - 0.004, inner, ax ) )
            * smoothstep( inner - ${RUNNER_BORDER.width.toFixed(2)} - 0.004, inner - ${RUNNER_BORDER.width.toFixed(2)}, ax );
          band *= smoothstep( 0.5, 0.9, vWorldN.y );
          diffuseColor.rgb = mix( diffuseColor.rgb, uBorderColour * weave, band );
          diffuseColor.rgb = mix( diffuseColor.rgb, uBrass * weave, line );`
          : o.kind === 'floor'
            ? `
          // Edge shadow along each side wall, 18% over 0.45 m, baked into the floor (no decal, any quality tier).
          float toWall = uRoomHalf - abs( vWorldPos.x );
          float edgeAo = uFloorAo * ( 1.0 - smoothstep( 0.0, ${FLOOR_EDGE.width.toFixed(2)}, toWall ) ) * smoothstep( 0.5, 0.9, vWorldN.y );
          diffuseColor.rgb = mix( diffuseColor.rgb, uAoColour, edgeAo );`
            : '',
    );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldN;
        uniform vec2 uTile;
        uniform float uShadeStart;
        uniform float uShadeEnd;
        uniform vec3 uShadeMul;
        uniform vec3 uSkirtColour;
        uniform float uSkirtHeight;
        uniform vec3 uBrass;
        uniform float uHalfWidth;
        uniform vec3 uDadoColour;
        uniform float uDadoHeight;
        uniform vec3 uRailColour;
        uniform float uRailHeight;
        uniform float uWallHeight;
        uniform vec3 uAoColour;
        uniform float uAoBase;
        uniform float uAoTop;
        uniform float uRoomHalf;
        uniform float uFloorAo;
        uniform vec3 uBorderColour;`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 weave = vec3( 1.0 );
        #ifdef USE_MAP
          ${mapping}
          vec4 sampledDiffuseColor = texture2D( map, wUv );
          weave = sampledDiffuseColor.rgb;
          diffuseColor *= sampledDiffuseColor;
        #else
          ${mapping}
        #endif
        ${extra}`,
      );
  };
  material.customProgramCacheKey = () =>
    `museum-world-${o.kind}-${o.skirting ? 's' : 'n'}${o.dado ? 'd' : 'n'}-v2`;
  return material;
}
