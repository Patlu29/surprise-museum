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
 * Third-person follow camera (design spec 3.4 and 6.3). It follows the Visitor's translation with
 * 120 ms damping and shortens its boom when an outer wall blocks the view. Internal walls do not
 * shorten it: the scene fades them instead (PartitionFade), so in a narrow room she keeps her
 * on-screen size. Yaw and pitch change only from
 * user input: the camera never rotates on its own, and under reduced motion it never moves on its
 * own at all (rigidly attached, no damping, instant reset). Composition (Visitor size and screen
 * position) comes from a constant view offset set per viewport, never animated.
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
  private resetAnim: {
    t: number;
    from: { yaw: number; pitch: number; boom: number };
    to: { yaw: number };
  } | null = null;
  private size = { w: 0, h: 0 };
  private poseCache = {
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

  /** Camera pose from the last update, for the world context. */
  get pose() {
    return this.poseCache;
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
      this.pivot.y = targetY;
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
    camera.position.set(
      this.poseCache.position.x,
      this.poseCache.position.y,
      this.poseCache.position.z,
    );
    camera.lookAt(this.pivot.x, this.pivot.y, this.pivot.z);
    camera.updateMatrixWorld();
  }

  private refreshPose(): void {
    const p = cameraPose(this.pivot, this.yaw, this.pitch, this.boomNow);
    this.poseCache.position = p.position;
    this.poseCache.forward = p.forward;
  }
}
