import type { PerspectiveCamera } from 'three';
import {
  CAMERA_LIMITS,
  cameraPose,
  clampBoom,
  clampPitch,
  computeComposition,
  occludedBoom,
  type Composition,
} from '@/domain/camera/composition';
import type { Aabb } from '@/domain/navigation/geometry';
import { angleDiff, smoothingFactor } from '@/domain/math/vec2';
import { createPose, type CamPose } from '@/domain/camera/presentationCameraMachine';

const DEG = Math.PI / 180;
const RESET_SECONDS = 0.45;

export interface CameraInput {
  /** Degrees per second while a key or button is held. yaw > 0 turns the view right. */
  rateYawDeg: number;
  /** Degrees per second; pitch > 0 raises the camera. */
  ratePitchDeg: number;
  /** Degrees accumulated from drags this frame. Same signs. */
  deltaYawDeg: number;
  deltaPitchDeg: number;
  /** Metres of boom change this frame; positive moves the camera away. */
  zoomMetres: number;
}

/**
 * Something that may take over the final camera pose for a while: the presentation camera
 * (design spec 6.12). It reads the live follow pose and may write a different pose to show.
 */
export interface PoseOverride {
  /** Returns true when it wrote `out` and the camera should use it instead of the follow pose. */
  compose(dt: number, follow: Readonly<CamPose>, out: CamPose): boolean;
  /** A cut to the default pose (replay, jump): drop everything at once. */
  cancel(): void;
}

/**
 * Third-person follow camera (design spec 3.4 and 6.3). It follows the Visitor's translation with
 * 120 ms damping and shortens its boom when an outer wall blocks the view. Internal walls do not
 * shorten it: the scene fades them instead (PartitionFade), so in a narrow room she keeps her
 * on-screen size. Yaw and pitch change only from user input: the camera never rotates on its own
 * except for the one exception in design spec 6.3 (c), the presentation camera (6.12), which an
 * attached `presenter` applies on top of this rig's follow pose and which any input overrides.
 * Under reduced motion the follow camera never moves on its own at all (rigidly attached, no
 * damping, instant reset). Composition (Visitor size and screen position) comes from a constant
 * view offset set per viewport, never animated, in both modes.
 */
export class FollowCameraRig {
  yaw: number;
  pitch: number;
  /** Desktop zoom: metres added to the default boom (0.4 m per wheel notch, 2.5 to 6.0 m total). */
  boomOffset = 0;
  composition: Composition;

  private referenceYaw: number;
  private pivot = { x: 0, y: 0, z: 0 };
  private boomNow: number;
  /** The presentation camera, when attached (SceneRoot). */
  presenter: PoseOverride | null = null;
  private readonly followPose = createPose();
  private readonly shownPose = createPose();
  private readonly followCache = { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
  private resetAnim: {
    t: number;
    from: { yaw: number; pitch: number; boom: number };
    to: { yaw: number };
  } | null = null;
  private size = { w: 0, h: 0 };
  private poseCache: {
    position: { x: number; y: number; z: number };
    forward: { x: number; y: number; z: number };
  } = {
    position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
  };

  constructor(initialYaw: number, start: { x: number; z: number }, viewport = { w: 390, h: 844 }) {
    this.composition = computeComposition(viewport.w, viewport.h);
    this.yaw = initialYaw;
    this.referenceYaw = initialYaw;
    this.pitch = this.composition.defaultPitchDeg * DEG;
    this.boomNow = this.composition.boom;
    this.pivot = { x: start.x, y: this.composition.pivotHeight, z: start.z };
    this.refreshPose();
  }

  /** The camera's pose as shown, from the last update, for the world context. */
  get pose() {
    return this.poseCache;
  }

  /**
   * The follow pose's direction. Camera-relative walking uses this, not the shown camera, so a
   * presentation camera that is easing back never swings the walking direction (design 6.12.7).
   */
  get moveForward() {
    return this.followCache.forward;
  }

  /** The live follow pose (pivot, yaw, pitch, boom), valid after `update`. */
  get follow(): Readonly<CamPose> {
    return this.followPose;
  }

  /**
   * Take over a pose with no ease: the user's pose becomes whatever the camera shows now, and the
   * follow camera resumes from it (look-around, zoom, reset during a presentation).
   */
  adopt(pose: Readonly<CamPose>): void {
    this.yaw = pose.yaw;
    this.pitch = clampPitch(pose.pitch);
    this.boomOffset = pose.boom - this.composition.boom;
    this.boomNow = pose.boom;
    this.pivot.x = pose.px;
    this.pivot.y = pose.py;
    this.pivot.z = pose.pz;
    this.resetAnim = null;
  }

  /** Keep a pose's yaw and pitch as the user's pose, leaving the boom and pivot to ease (6.12.3). */
  keepOrientation(pose: Readonly<CamPose>): void {
    this.yaw = pose.yaw;
    this.pitch = clampPitch(pose.pitch);
    this.resetAnim = null;
  }

  get fovYRadians(): number {
    return this.composition.fovDeg * DEG;
  }

  /** True once the camera is more than 20 degrees off the default, or the boom was changed. */
  get offDefault(): boolean {
    const yawOff =
      Math.abs(angleDiff(this.referenceYaw, this.yaw)) > CAMERA_LIMITS.resetThresholdDeg * DEG;
    const pitchOff =
      Math.abs(this.pitch - this.composition.defaultPitchDeg * DEG) >
      CAMERA_LIMITS.resetThresholdDeg * DEG;
    return yawOff || pitchOff || Math.abs(this.boomOffset) > 0.01;
  }

  /** Apply the viewport's constant composition. Safe to call every frame; it only acts on change. */
  setViewport(camera: PerspectiveCamera, width: number, height: number): void {
    if (width === this.size.w && height === this.size.h) return;
    this.size = { w: width, h: height };
    this.composition = computeComposition(width, height);
    camera.fov = this.composition.fovDeg;
    camera.aspect = width / Math.max(1, height);
    camera.setViewOffset(width, height, 0, this.composition.viewOffsetY * height, width, height);
    camera.updateProjectionMatrix();
  }

  applyInput(dt: number, input: CameraInput): void {
    const yawDeg = input.rateYawDeg * dt + input.deltaYawDeg;
    const pitchDeg = input.ratePitchDeg * dt + input.deltaPitchDeg;
    if (yawDeg !== 0 || pitchDeg !== 0 || input.zoomMetres !== 0) this.resetAnim = null;
    // Turning the view right means the look direction swings clockwise seen from above.
    this.yaw -= yawDeg * DEG;
    this.pitch = clampPitch(this.pitch + pitchDeg * DEG);
    if (input.zoomMetres !== 0) {
      const target = clampBoom(this.composition.boom + this.boomOffset + input.zoomMetres);
      this.boomOffset = target - this.composition.boom;
    }
  }

  /** Return to behind the Visitor at default pitch and boom (design spec 6.4). */
  requestReset(heading: number, reduced: boolean): void {
    this.referenceYaw = heading;
    const target = this.composition.defaultPitchDeg * DEG;
    if (reduced) {
      this.yaw = heading;
      this.pitch = target;
      this.boomOffset = 0;
      this.resetAnim = null;
      return;
    }
    this.resetAnim = {
      t: 0,
      from: { yaw: this.yaw, pitch: this.pitch, boom: this.boomOffset },
      to: { yaw: this.yaw + angleDiff(this.yaw, heading) },
    };
  }

  /** A cut, not a move: after replay or a jump, snap behind the Visitor (user-caused). */
  snapBehind(heading: number): void {
    this.presenter?.cancel();
    this.requestReset(heading, true);
    this.snapPivot = true;
  }

  private snapPivot = false;

  /** Follow the Visitor and write the camera. */
  update(
    dt: number,
    camera: PerspectiveCamera,
    visitor: { x: number; z: number },
    teleported: boolean,
    hardColliders: readonly Aabb[],
    softColliders: readonly Aabb[],
    reduced: boolean,
  ): void {
    if (this.resetAnim) {
      const a = this.resetAnim;
      a.t = Math.min(1, a.t + dt / RESET_SECONDS);
      const e = a.t * a.t * (3 - 2 * a.t);
      this.yaw = a.from.yaw + (a.to.yaw - a.from.yaw) * e;
      this.pitch = a.from.pitch + (this.composition.defaultPitchDeg * DEG - a.from.pitch) * e;
      this.boomOffset = a.from.boom * (1 - e);
      if (a.t >= 1) this.resetAnim = null;
    }

    const targetY = this.composition.pivotHeight;
    if (reduced || teleported || this.snapPivot) {
      // Rigidly attached: no damping, so the camera never drifts on its own.
      this.pivot.x = visitor.x;
      this.pivot.y = targetY;
      this.pivot.z = visitor.z;
      this.snapPivot = false;
    } else {
      const k = smoothingFactor(dt, 0.06);
      this.pivot.x += (visitor.x - this.pivot.x) * k;
      this.pivot.z += (visitor.z - this.pivot.z) * k;
      this.pivot.y += (targetY - this.pivot.y) * k;
    }

    const wanted = clampBoom(this.composition.boom + this.boomOffset);
    const blocked = occludedBoom(
      this.pivot,
      this.yaw,
      this.pitch,
      wanted,
      hardColliders,
      softColliders,
    );
    if (reduced || teleported) this.boomNow = blocked;
    else this.boomNow += (blocked - this.boomNow) * smoothingFactor(dt, 0.05);

    this.refreshPose();
    const f = this.poseCache;
    this.followCache.position = f.position;
    this.followCache.forward = f.forward;
    const fp = this.followPose;
    fp.px = this.pivot.x;
    fp.py = this.pivot.y;
    fp.pz = this.pivot.z;
    fp.yaw = this.yaw;
    fp.pitch = this.pitch;
    fp.boom = this.boomNow;

    // The presentation camera may show a different pose; the follow state above keeps running, so
    // the camera can ease back to a pose that has followed the Visitor all along.
    let px = this.pivot.x;
    let py = this.pivot.y;
    let pz = this.pivot.z;
    if (this.presenter?.compose(dt, fp, this.shownPose)) {
      const o = this.shownPose;
      const p = cameraPose({ x: o.px, y: o.py, z: o.pz }, o.yaw, o.pitch, o.boom);
      px = o.px;
      py = o.py;
      pz = o.pz;
      this.poseCache = { position: p.position, forward: p.forward };
    } else {
      this.poseCache = { position: f.position, forward: f.forward };
    }
    camera.position.set(
      this.poseCache.position.x,
      this.poseCache.position.y,
      this.poseCache.position.z,
    );
    camera.lookAt(px, py, pz);
    camera.updateMatrixWorld();
  }

  private refreshPose(): void {
    const p = cameraPose(this.pivot, this.yaw, this.pitch, this.boomNow);
    this.poseCache = { position: p.position, forward: p.forward };
  }
}
