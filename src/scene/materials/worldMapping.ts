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
  /** Runner only: runner width in metres (default 1.6). */
  runnerWidth?: number;
}

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
  };
}

/** Wall options for the claret finale room: same gradient, a dimmed skirting. */
export function finaleWallMapping(): WorldMappingOptions {
  return {
    kind: 'wall',
    tile: [1.2, 1.2],
    ceilingShade: new Vector3(0.78, 0.78, 0.78),
    skirting: { colour: new Color(SCENE_PALETTE.skirting).multiplyScalar(0.62), height: 0.12 },
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

    const extra =
      o.kind === 'wall'
        ? `
          float vertical = 1.0 - smoothstep( 0.35, 0.9, abs( vWorldN.y ) );
          float shadeT = smoothstep( uShadeStart, uShadeEnd, vWorldPos.y ) * vertical;
          diffuseColor.rgb *= mix( vec3( 1.0 ), uShadeMul, shadeT );
          float skirt = ( 1.0 - smoothstep( uSkirtHeight - 0.004, uSkirtHeight, vWorldPos.y ) ) * vertical;
          skirt *= step( 0.001, uSkirtHeight );
          diffuseColor.rgb = mix( diffuseColor.rgb, uSkirtColour * weave, skirt );`
        : o.kind === 'runner'
          ? `
          float ax = abs( vWorldPos.x );
          float outer = uHalfWidth - 0.07;
          float inner = outer - 0.028;
          float line = smoothstep( inner - 0.003, inner + 0.003, ax ) * ( 1.0 - smoothstep( outer - 0.003, outer + 0.003, ax ) );
          line *= smoothstep( 0.5, 0.9, vWorldN.y );
          diffuseColor.rgb = mix( diffuseColor.rgb, uBrass * weave, line );`
          : '';

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
        uniform float uHalfWidth;`,
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
  material.customProgramCacheKey = () => `museum-world-${o.kind}-${o.skirting ? 's' : 'n'}`;
  return material;
}
