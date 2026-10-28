/**
 * The avatar rig: a skinned toy-figure built from code (ADR 0008), ready for the scene-developer
 * to animate.
 *
 *   const rig = createAvatarRig(config, { role: 'guide' });
 *   scene.add(rig.root);                 // feet at root.position, faces +Z at heading 0
 *   rig.applyPose({ walkPhase, walkAmount, idleTime, present });
 *   rig.setAppearance(nextConfig);       // rebuilds only what changed
 *   rig.setOpacity(0.35);                // yield fade
 *   rig.dispose();
 *
 * Draw calls: body, hair and blob shadow (three). Triangles: see `rig.stats`.
 */
import type { BufferGeometry } from 'three';
import {
  Bone,
  DoubleSide,
  Group,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
} from 'three';
import type { AvatarConfig } from '@contract';
import { GlowDecalMaterial } from '../../shaders/glowDecal/GlowDecalMaterial';
import { createBlobShadowGeometry } from '../../materials/geometry/decals';
import { BLOB_SHADOW } from '../../materials/palette';
import { BONE_NAMES, type BoneName } from './geometry/partBuilder';
import { buildBodyGeometry, type AvatarRole } from './parts/body';
import { buildHairGeometry } from './parts/hair';
import { applyPose, HIP_REST_Y, NEUTRAL_POSE, type AvatarPose, type PoseBones } from './pose';
import { BODY_SHAPES, HEIGHT_SCALE, NOMINAL_HEIGHT, jointsFor, type Joints } from './proportions';

export type { AvatarRole } from './parts/body';

export interface AvatarRigOptions {
  /** The Guide wears the brass badge; the Visitor wears the heart sticker. */
  role: AvatarRole;
  /** Include the soft blob shadow under the feet (default true). */
  blobShadow?: boolean;
}

export interface AvatarRigStats {
  triangles: number;
  /** Meshes drawn: body, hair (if any) and the blob shadow (if included). */
  drawCalls: number;
}

export interface AvatarRig {
  /** Add this to the scene. Origin at the feet; the figure faces +Z at heading 0. */
  readonly root: Group;
  readonly bones: PoseBones;
  /** Empty child of `root` 0.35 m above the head (scaled with height) for the name label. */
  readonly labelAnchor: Object3D;
  readonly role: AvatarRole;
  readonly config: Readonly<AvatarConfig>;
  /** Total standing height in metres including hair, for the current height setting. */
  readonly height: number;
  readonly stats: Readonly<AvatarRigStats>;
  /** Replace the appearance. Rebuilds only the parts the change touches. */
  setAppearance(next: AvatarConfig): void;
  /** Set bone rotations for the current frame. Missing fields fall back to the neutral pose. */
  applyPose(pose: Partial<AvatarPose>): void;
  /** The still pose, used for reduced motion. */
  resetPose(): void;
  /** 0 to 1. Below 1 the figure and its shadow turn transparent (yield and relocate fades). */
  setOpacity(opacity: number): void;
  setBlobShadowVisible(visible: boolean): void;
  dispose(): void;
}

const LABEL_ABOVE_HEAD = 0.35;

/** Creates a rig. Nothing in it needs a renderer, so it also works in Node tests. */
export function createAvatarRig(initial: AvatarConfig, options: AvatarRigOptions): AvatarRig {
  const role = options.role;
  let config: AvatarConfig = { ...initial };

  const root = new Group();
  root.name = `avatar-${role}`;

  // Bones, created once; positions are refreshed when the body type changes.
  const boneByName = {} as Record<BoneName, Bone>;
  for (const name of BONE_NAMES) {
    const bone = new Bone();
    bone.name = name;
    boneByName[name] = bone;
  }
  const link = (parent: BoneName, child: BoneName) => boneByName[parent].add(boneByName[child]);
  link('hips', 'spine');
  link('spine', 'neck');
  link('neck', 'head');
  link('head', 'hairBack');
  link('spine', 'armL');
  link('armL', 'forearmL');
  link('spine', 'armR');
  link('armR', 'forearmR');
  link('hips', 'legL');
  link('legL', 'shinL');
  link('hips', 'legR');
  link('legR', 'shinR');
  root.add(boneByName.hips);

  const bones: PoseBones = boneByName;
  const skeleton = new Skeleton(BONE_NAMES.map((n) => boneByName[n]));

  const bodyMaterial = new MeshLambertMaterial({ vertexColors: true });
  const hairMaterial = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
  const shadowMaterial = new GlowDecalMaterial({
    vertexIntensity: true,
    color: BLOB_SHADOW.hex,
    opacity: BLOB_SHADOW.alpha,
    power: 1.3,
    blend: 'normal',
  });

  const labelAnchor = new Object3D();
  labelAnchor.name = 'label-anchor';
  root.add(labelAnchor);

  let bodyMesh: SkinnedMesh | null = null;
  let hairMesh: SkinnedMesh | null = null;
  let shadowMesh: Mesh | null = null;
  let opacity = 1;

  const stats: AvatarRigStats = { triangles: 0, drawCalls: 0 };

  const triangles = (g: BufferGeometry | null) => (g?.index ? g.index.count / 3 : 0);

  const place = (joints: Joints) => {
    const set = (
      name: BoneName,
      abs: readonly [number, number, number],
      parent?: readonly [number, number, number],
    ) => {
      const p = parent ?? [0, 0, 0];
      boneByName[name].position.set(abs[0] - p[0], abs[1] - p[1], abs[2] - p[2]);
    };
    set('hips', joints.hips);
    set('spine', joints.spine, joints.hips);
    set('neck', joints.neck, joints.spine);
    set('head', joints.head, joints.neck);
    set('hairBack', joints.hairBack, joints.head);
    set('armL', joints.armL, joints.spine);
    set('forearmL', joints.elbowL, joints.armL);
    set('armR', joints.armR, joints.spine);
    set('forearmR', joints.elbowR, joints.armR);
    set('legL', joints.legL, joints.hips);
    set('shinL', joints.kneeL, joints.legL);
    set('legR', joints.legR, joints.hips);
    set('shinR', joints.kneeR, joints.legR);
  };

  const applyOpacity = () => {
    const transparent = opacity < 0.999;
    for (const m of [bodyMaterial, hairMaterial]) {
      m.opacity = opacity;
      m.transparent = transparent;
      m.depthWrite = !transparent;
      m.needsUpdate = true;
    }
    const u = shadowMaterial.uniforms.uOpacity;
    if (u) u.value = BLOB_SHADOW.alpha * opacity;
  };

  const makeSkinned = (geometry: BufferGeometry, material: MeshLambertMaterial, name: string) => {
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false; // Skinned bounds follow the bind pose; the figure is always near the camera.
    // Parent before binding, so the bind matrix is the mesh's world matrix.
    root.add(mesh);
    mesh.bind(skeleton);
    return mesh;
  };

  const rebuildBody = () => {
    const geometry = buildBodyGeometry(config, role);
    if (bodyMesh) {
      bodyMesh.geometry.dispose();
      bodyMesh.geometry = geometry;
    } else {
      bodyMesh = makeSkinned(geometry, bodyMaterial, 'body');
    }
  };

  const rebuildHair = () => {
    const geometry = buildHairGeometry(config);
    if (!geometry) {
      if (hairMesh) {
        root.remove(hairMesh);
        hairMesh.geometry.dispose();
        hairMesh = null;
      }
      return;
    }
    if (hairMesh) {
      hairMesh.geometry.dispose();
      hairMesh.geometry = geometry;
    } else {
      hairMesh = makeSkinned(geometry, hairMaterial, 'hair');
    }
  };

  const refreshBones = () => {
    // The bind pose must be captured with every bone at rest.
    for (const name of BONE_NAMES) boneByName[name].rotation.set(0, 0, 0);
    place(jointsFor(BODY_SHAPES[config.bodyType]));
    root.updateMatrixWorld(true);
    skeleton.calculateInverses();
  };

  const refreshScale = () => {
    root.scale.setScalar(HEIGHT_SCALE[config.height]);
    labelAnchor.position.set(0, NOMINAL_HEIGHT + LABEL_ABOVE_HEAD, 0);
    root.updateMatrixWorld(true);
  };

  const refreshStats = () => {
    stats.triangles =
      triangles(bodyMesh?.geometry ?? null) +
      triangles(hairMesh?.geometry ?? null) +
      (shadowMesh ? 2 : 0);
    stats.drawCalls = (bodyMesh ? 1 : 0) + (hairMesh ? 1 : 0) + (shadowMesh?.visible ? 1 : 0);
  };

  if (options.blobShadow !== false) {
    shadowMesh = new Mesh(createBlobShadowGeometry(), shadowMaterial);
    shadowMesh.name = 'blob-shadow';
    shadowMesh.renderOrder = -1;
    root.add(shadowMesh);
  }

  // Initial build. Scale is set after the bones so the bind pose is at scale 1.
  root.scale.setScalar(1);
  refreshBones();
  rebuildBody();
  rebuildHair();
  refreshScale();
  applyOpacity();
  refreshStats();

  const rig: AvatarRig = {
    root,
    bones,
    labelAnchor,
    role,
    get config() {
      return config;
    },
    get height() {
      return NOMINAL_HEIGHT * HEIGHT_SCALE[config.height];
    },
    stats,

    setAppearance(next) {
      const prev = config;
      config = { ...next };
      const bodyChanged =
        prev.skinTone !== next.skinTone ||
        prev.outfitStyle !== next.outfitStyle ||
        prev.outfitColor !== next.outfitColor ||
        prev.bodyType !== next.bodyType ||
        prev.facialHair !== next.facialHair;
      const hairChanged =
        prev.hairStyle !== next.hairStyle ||
        prev.hairColor !== next.hairColor ||
        prev.facialHair !== next.facialHair ||
        prev.skinTone !== next.skinTone;
      if (prev.bodyType !== next.bodyType) {
        // Arm and hip joints move with body type, so the bind pose changes.
        root.scale.setScalar(1);
        refreshBones();
      }
      if (bodyChanged) rebuildBody();
      if (hairChanged) rebuildHair();
      refreshScale();
      refreshStats();
    },

    applyPose(pose) {
      applyPose(bones, HIP_REST_Y, pose);
    },

    resetPose() {
      applyPose(bones, HIP_REST_Y, NEUTRAL_POSE);
    },

    setOpacity(value) {
      opacity = Math.min(1, Math.max(0, value));
      applyOpacity();
    },

    setBlobShadowVisible(visible) {
      if (shadowMesh) shadowMesh.visible = visible;
      refreshStats();
    },

    dispose() {
      bodyMesh?.geometry.dispose();
      hairMesh?.geometry.dispose();
      shadowMesh?.geometry.dispose();
      bodyMaterial.dispose();
      hairMaterial.dispose();
      shadowMaterial.dispose();
      skeleton.dispose();
    },
  };
  return rig;
}
