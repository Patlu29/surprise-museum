/**
 * Drop-in museum materials for the scene's role-based `MuseumMaterials` shape
 * (src/scene/placeholders/materials.ts, wired through src/scene/seams.ts).
 *
 * The scene builds walls, floors and the runner from plain boxes and planes, so these materials
 * do the dressing in the shader instead of in geometry: linen, oak and pile textures tile in
 * metres, walls shade towards the ceiling and get a skirting, and the runner gets its brass edge
 * lines (see worldMapping.ts). Swap in with one line in seams.ts:
 *
 *   export { createSceneMaterials as createMuseumMaterials } from './materials/sceneMaterials';
 *
 * For the full look (vertex-gradient walls, doorway architraves, frames with mounts, picture
 * lights, wall washes, cone and motes) use `createMuseumMaterials` and the geometry builders in
 * ./geometry instead, which need no shader tricks.
 */
import { MeshLambertMaterial, MeshStandardMaterial, type DataTexture, type Material } from 'three';
import { GlowDecalMaterial } from '../shaders/glowDecal/GlowDecalMaterial';
import { SCENE_PALETTE } from './palette';
import {
  createFinaleFloorTexture,
  createLinenTexture,
  createOakFloorTexture,
  createRunnerPileTexture,
} from './proceduralTextures';
import { QUALITY_FEATURES, type GraphicsQuality } from './quality';
import {
  applyWorldMapping,
  finaleWallMapping,
  galleryWallMapping,
  type WorldMappingOptions,
} from './worldMapping';

/** The shape the scene consumes. `pool` is an instanced-friendly additive decal material. */
export interface SceneMuseumMaterials {
  wall: Material;
  wallFinale: Material;
  floor: Material;
  floorFinale: Material;
  ceiling: Material;
  runner: Material;
  frameWood: Material;
  frameMat: Material;
  brass: MeshStandardMaterial;
  podium: Material;
  lectern: Material;
  book: Material;
  /**
   * Additive soft pool for an InstancedMesh of 1 by 1 planes. Intensity is the instance colour's
   * red channel (the scene's 0 to 0.45 maps to 0 to 1).
   */
  pool: GlowDecalMaterial;
  dispose(): void;
}

export function createSceneMaterials(quality: GraphicsQuality = 'high'): SceneMuseumMaterials {
  const features = QUALITY_FEATURES[quality];
  const owned: Array<{ dispose(): void }> = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };

  const linen: DataTexture = own(createLinenTexture(quality));
  const oak: DataTexture = own(createOakFloorTexture(quality));
  const finaleOak: DataTexture = own(createFinaleFloorTexture(quality));
  const pile: DataTexture = own(createRunnerPileTexture(quality));

  const lambert = (color: string, map?: DataTexture, mapping?: WorldMappingOptions) => {
    const m = own(new MeshLambertMaterial({ color, map: map ?? null }));
    return mapping ? applyWorldMapping(m, mapping) : m;
  };
  const standard = (
    color: string,
    roughness: number,
    metalness = 0,
    map?: DataTexture,
    mapping?: WorldMappingOptions,
  ) => {
    const m = own(new MeshStandardMaterial({ color, roughness, metalness, map: map ?? null }));
    return mapping ? applyWorldMapping(m, mapping) : m;
  };
  // Soft sheen on the floors at high quality; matte Lambert on phones that struggle.
  const lit = (
    color: string,
    roughness: number,
    map?: DataTexture,
    mapping?: WorldMappingOptions,
  ) =>
    features.standardMaterials
      ? standard(color, roughness, 0, map, mapping)
      : lambert(color, map, mapping);

  const brass = own(
    new MeshStandardMaterial({
      color: SCENE_PALETTE.brass,
      roughness: 0.38,
      metalness: features.environmentMap ? 0.7 : 0.25,
      emissive: SCENE_PALETTE.brass,
      emissiveIntensity: 0.15,
    }),
  );

  const pool = own(
    new GlowDecalMaterial({
      color: SCENE_PALETTE.pool,
      opacity: 0.55,
      power: 1.8,
      instanceGain: 2.2,
    }),
  );

  const materials: SceneMuseumMaterials = {
    wall: lambert('#ffffff', linen, {
      ...galleryWallMapping(),
    }),
    wallFinale: lambert('#ffffff', linen, finaleWallMapping()),
    floor: lit('#ffffff', 0.62, oak, { kind: 'floor', tile: [0.8, 1.6] }),
    floorFinale: lit('#ffffff', 0.32, finaleOak, { kind: 'floor', tile: [0.8, 1.6] }),
    ceiling: lambert(SCENE_PALETTE.ceiling),
    runner: applyWorldMapping(
      own(new MeshLambertMaterial({ color: SCENE_PALETTE.runner, map: pile })),
      { kind: 'runner', tile: [0.8, 0.8] },
    ),
    frameWood: lit(SCENE_PALETTE.frame, 0.55),
    frameMat: lambert(SCENE_PALETTE.mat),
    brass,
    podium: lit(SCENE_PALETTE.podium, 0.7),
    lectern: lit(SCENE_PALETTE.frame, 0.6),
    book: lambert(SCENE_PALETTE.plaque),
    pool,
    dispose() {
      for (const item of owned) item.dispose();
    },
  };

  // The wall colour comes from the vertex-free base colour, so tint it here.
  (materials.wall as MeshLambertMaterial).color.set(SCENE_PALETTE.wall);
  (materials.wallFinale as MeshLambertMaterial).color.set(SCENE_PALETTE.finaleWall);
  (materials.floor as MeshLambertMaterial).color.set('#ffffff');
  (materials.runner as MeshLambertMaterial).polygonOffset = true;
  (materials.runner as MeshLambertMaterial).polygonOffsetFactor = -2;
  (materials.runner as MeshLambertMaterial).polygonOffsetUnits = -2;

  return materials;
}
