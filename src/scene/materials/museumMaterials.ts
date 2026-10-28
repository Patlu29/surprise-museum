/**
 * The museum's materials, built once and shared (design spec 1.4 and 1.5).
 *
 * `createMuseumMaterials(quality)` returns every material the scene needs, already matched to
 * the design tokens. Surfaces get their colour from vertex colours built into the geometry in
 * `./geometry`, so a handful of materials covers the whole museum and each can be merged into a
 * single draw call. Typical draw-call count for a 20-picture museum when merged as recommended:
 * walls 1, floors 2, runner 1, ceilings 1, frames 1, picture lights 1, wall washes 1, pools 1,
 * finale 4, photos 20.
 */
import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type DataTexture,
  type Material,
  type Texture,
} from 'three';
import { DustMotesMaterial } from '../shaders/dustMotes/DustMotesMaterial';
import { GlowDecalMaterial } from '../shaders/glowDecal/GlowDecalMaterial';
import { LightConeMaterial } from '../shaders/lightCone/LightConeMaterial';
import { applyVertexGlow, type GlowHandle } from './glowMaterial';
import { BLOB_SHADOW, SCENE_PALETTE } from './palette';
import {
  createFinaleFloorTexture,
  createLinenTexture,
  createOakFloorTexture,
  createRunnerPileTexture,
} from './proceduralTextures';
import { QUALITY_FEATURES, type GraphicsQuality, type QualityFeatures } from './quality';

type LitMaterial = MeshLambertMaterial | MeshStandardMaterial;

export interface MuseumMaterials {
  readonly quality: GraphicsQuality;
  readonly features: QualityFeatures;

  /** Linen walls, doorway architraves and skirting (vertex colours x linen weave). */
  readonly wall: LitMaterial;
  /** Oak boards with a very soft sheen. */
  readonly floor: LitMaterial;
  /** Dark polished boards for the finale room. */
  readonly finaleFloor: LitMaterial;
  /** Dark warm ceiling. */
  readonly ceiling: LitMaterial;
  /** Claret runner with brass edge lines (vertex colours x pile). */
  readonly runner: LitMaterial;
  /**
   * Vertex-coloured, vertex-glow material for frames, picture lights, ceiling roses and the
   * lectern. Anything built with `boxPart` or the frame builders uses this.
   */
  readonly decor: LitMaterial & GlowHandle;
  /** Own instance of the decor material for the podium, so its ring glow animates alone. */
  readonly podium: LitMaterial & GlowHandle;
  /** Additive soft wall wash around each frame (brightest at the top). */
  readonly wallWash: GlowDecalMaterial;
  /** Additive soft standing-spot floor pool. */
  readonly floorPool: GlowDecalMaterial;
  /** Additive pool under the podium (round). */
  readonly podiumPool: GlowDecalMaterial;
  /** Additive rounded-rectangle glow for the frame hover and the "Where next?" hint. */
  readonly hintGlow: GlowDecalMaterial;
  /** Normal-blended soft blob shadow under characters. */
  readonly blobShadow: GlowDecalMaterial;
  /** Brass ring under a presenting Guide. Fade with `.opacity`. */
  readonly presentationRing: MeshBasicMaterial;
  /** Finale light cone, or null at low quality. */
  readonly cone: LightConeMaterial | null;
  /** Finale dust motes, or null at low quality. */
  readonly motes: DustMotesMaterial | null;

  /** An unlit, never tone-mapped photo material (FR-40). Disposed with `dispose()`. */
  createPhotoMaterial(map?: Texture | null): MeshBasicMaterial;
  /** Advance time-based shader uniforms. Call once per frame with the elapsed seconds. */
  update(elapsedSeconds: number): void;
  /** Reduced motion: stops the dust motes drifting (and callers should hide them). */
  setReducedMotion(reduced: boolean): void;
  /** Shared environment map for the lit materials. Pass null to remove it. */
  setEnvironment(envMap: Texture | null, intensity?: number): void;
  dispose(): void;
}

export function createMuseumMaterials(quality: GraphicsQuality = 'high'): MuseumMaterials {
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

  const lit = (params: {
    map?: Texture;
    vertexColors?: boolean;
    color?: string;
    roughness?: number;
    envMapIntensity?: number;
  }): LitMaterial => {
    if (features.standardMaterials && params.roughness !== undefined) {
      return own(
        new MeshStandardMaterial({
          map: params.map ?? null,
          vertexColors: params.vertexColors ?? false,
          color: params.color ?? '#ffffff',
          roughness: params.roughness,
          metalness: 0,
          envMapIntensity: params.envMapIntensity ?? 1,
        }),
      );
    }
    return own(
      new MeshLambertMaterial({
        map: params.map ?? null,
        vertexColors: params.vertexColors ?? false,
        color: params.color ?? '#ffffff',
      }),
    );
  };

  const wall = lit({ map: linen, vertexColors: true });
  const floor = lit({ map: oak, roughness: 0.62 });
  const finaleFloor = lit({ map: finaleOak, roughness: 0.32 });
  const ceiling = lit({ vertexColors: true });
  const runner = lit({ map: pile, vertexColors: true });
  // The runner lies 4 mm above the floor; the offset stops z-fighting at grazing angles.
  runner.polygonOffset = true;
  runner.polygonOffsetFactor = -2;
  runner.polygonOffsetUnits = -2;

  const decor = own(applyVertexGlow(lit({ vertexColors: true, roughness: 0.55 }), 1));
  const podium = own(applyVertexGlow(lit({ vertexColors: true, roughness: 0.7 }), 1));

  const wallWash = own(
    new GlowDecalMaterial({
      vertexIntensity: true,
      color: SCENE_PALETTE.pool,
      opacity: 0.17,
      power: 1.5,
      square: 0.45,
      topBias: 0.7,
    }),
  );
  const floorPool = own(
    new GlowDecalMaterial({
      vertexIntensity: true,
      color: SCENE_PALETTE.pool,
      opacity: 0.3,
      power: 1.8,
    }),
  );
  const podiumPool = own(
    new GlowDecalMaterial({
      vertexIntensity: true,
      color: SCENE_PALETTE.spot,
      opacity: 0.2,
      power: 1.6,
    }),
  );
  const hintGlow = own(
    new GlowDecalMaterial({
      vertexIntensity: true,
      color: SCENE_PALETTE.hintGlow,
      opacity: 0.45,
      power: 1.2,
      square: 0.8,
    }),
  );
  const blobShadow = own(
    new GlowDecalMaterial({
      vertexIntensity: true,
      color: new Color(BLOB_SHADOW.hex),
      opacity: BLOB_SHADOW.alpha,
      power: 1.3,
      blend: 'normal',
    }),
  );
  const presentationRing = own(
    new MeshBasicMaterial({
      color: SCENE_PALETTE.brass,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: DoubleSide,
    }),
  );

  const cone = features.finaleCone
    ? own(new LightConeMaterial({ color: SCENE_PALETTE.spot, opacity: 0.09 }))
    : null;
  const motes = features.dustMotes
    ? own(
        new DustMotesMaterial({
          color: SCENE_PALETTE.spot,
          height: 3.2,
          radiusTop: 0.4,
          radiusBottom: 1.5,
        }),
      )
    : null;

  const photoMaterials: MeshBasicMaterial[] = [];
  const litMaterials: Material[] = [floor, finaleFloor, decor, podium];

  return {
    quality,
    features,
    wall,
    floor,
    finaleFloor,
    ceiling,
    runner,
    decor,
    podium,
    wallWash,
    floorPool,
    podiumPool,
    hintGlow,
    blobShadow,
    presentationRing,
    cone,
    motes,
    createPhotoMaterial(map) {
      // toneMapped: false keeps the Creator's photo exactly as uploaded.
      const m = new MeshBasicMaterial({ map: map ?? null, color: '#ffffff', toneMapped: false });
      photoMaterials.push(m);
      return m;
    },
    update(elapsedSeconds) {
      motes?.setTime(elapsedSeconds);
    },
    setReducedMotion(reduced) {
      motes?.setMotion(reduced ? 0 : 1);
    },
    setEnvironment(envMap, intensity = 0.3) {
      if (!features.environmentMap) return;
      for (const m of litMaterials) {
        if (m instanceof MeshStandardMaterial) {
          m.envMap = envMap;
          m.envMapIntensity = intensity;
          m.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const item of owned) item.dispose();
      for (const m of photoMaterials) m.dispose();
    },
  };
}
