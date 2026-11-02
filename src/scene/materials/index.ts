/**
 * Museum materials, lighting and geometry (owner: technical-artist).
 * Documentation and usage examples: docs/handoffs/technical-artist.md.
 */
export { BLOB_SHADOW, SCENE_PALETTE, scene, type SceneColourKey } from './palette';
export { LOOK, type LookKey } from './look';
export { QUALITY_FEATURES, type GraphicsQuality, type QualityFeatures } from './quality';
export {
  CANVAS_GL_DEFAULTS,
  COLOUR_TEMPERATURE_KELVIN,
  MUSEUM_LIGHTING,
  PREVIEW_BACKGROUND,
  PREVIEW_STAGE_CSS,
  PREVIEW_LIGHTING,
  applyRendererSettings,
  type LightingConfig,
} from './lighting';
export { createWarmEnvironment, type WarmEnvironment } from './environment';
export { createMuseumMaterials, type MuseumMaterials } from './museumMaterials';
export { applyVertexGlow, type GlowHandle } from './glowMaterial';
export { MuseumMaterialsContext, useMuseumMaterials } from './MuseumMaterialsContext';
export {
  MuseumMaterialsProvider,
  type MuseumMaterialsProviderProps,
} from './MuseumMaterialsProvider';
export { MuseumLighting, PreviewLighting, type MuseumLightingProps } from './MuseumLighting';
export {
  createFinaleFloorTexture,
  createLinenTexture,
  createOakFloorTexture,
  createRunnerPileTexture,
  createWoodTexture,
} from './proceduralTextures';
export {
  createNumberPlaqueTexture,
  createTitlePlaqueTexture,
  wrapLines,
  type TitlePlaqueText,
} from './plaqueTexture';

export {
  applyMetreUv,
  boxPart,
  mergeParts,
  mergePlaced,
  normaliseAttributes,
  triangleCount,
  type Placement,
} from './geometry/builders';
export {
  CEILING_STRIP,
  WALL,
  WALL_CAP,
  createCeilingGeometry,
  createCeilingRoseGeometry,
  createCeilingStripGeometry,
  createWallCapGeometry,
  createWallRunGeometry,
  type Doorway,
  type WallRunOptions,
  type WallVariant,
} from './geometry/walls';
export {
  FLOOR,
  RUNNER,
  createFinaleFloorGeometry,
  createFloorGeometry,
  createRunnerGeometry,
  type RunnerOptions,
} from './geometry/floor';
export {
  FILLET,
  FRAME,
  MOUNT_BEVEL,
  createFrameGeometry,
  createPhotoGeometry,
  createPictureLightGeometry,
  createPlaqueGeometry,
} from './geometry/frames';
export {
  PODIUM,
  createDustMoteGeometry,
  createLecternGeometry,
  createLightConeGeometry,
  createPodiumGeometry,
} from './geometry/finale';
export {
  CONTACT_SHADOW,
  POOL,
  WASH,
  DecalBatch,
  createFrameContactShadowGeometry,
  createPlinthContactShadowGeometry,
  createBlobShadowGeometry,
  createFloorPoolGeometry,
  createFloorRingGeometry,
  createWallWashGeometry,
  type DecalPlacement,
} from './geometry/decals';
export { DADO, FLOOR_EDGE, RUNNER_BORDER, WALL_AO } from './worldMapping';
