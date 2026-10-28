/**
 * Where the scene meets the technical-artist's look-and-feel layer. Everything the scene needs
 * comes through this file, so a future swap (a glTF avatar kit, another theme) is a change here.
 *
 *   createMuseumMaterials  role-based materials for the museum shell (walls, floors, ceiling,
 *                          runner, floor pools): linen, oak and pile textures tile in metres and
 *                          the shading is done in the shader, so plain boxes look right.
 *   createLookMaterials    the dressing: vertex-coloured frames, picture lights, ceiling roses,
 *                          lectern, podium, wall washes, finale cone and dust motes.
 *   SceneLights            warm hemisphere and key light, Neutral tone mapping, environment map.
 *   buildAvatar            the skinned "designer toy" rig, in the scene's AvatarRig shape.
 *
 * Final kit as of integration round 1. The shapes (MuseumMaterials, AvatarRig, AvatarBuilder) are
 * defined by the scene, not by the kit, so each can still be replaced independently.
 */
export {
  createSceneMaterials as createMuseumMaterials,
  type SceneMuseumMaterials as MuseumMaterials,
} from './materials/sceneMaterials';
export {
  createMuseumMaterials as createLookMaterials,
  type MuseumMaterials as LookMaterials,
} from './materials/museumMaterials';
export { SceneLights } from './materials/MuseumLighting';
export { buildAvatar } from './characters/kit/sceneAvatar';
export type { GraphicsQuality } from './materials/quality';
