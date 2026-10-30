import {
  solveFraming,
  type FramingInput,
  type FramingSolution,
} from '@/domain/camera/presentationFraming';
import {
  PresentationCameraMachine,
  copyPose,
  createPose,
  type CamPose,
  type PresentationCameraMode,
} from '@/domain/camera/presentationCameraMachine';
import type { PerspectiveCamera } from 'three';
import { useSettingsStore } from '@/state/settingsStore';
import { avatarHeight } from '../characters/avatarRig';
import { frameCorners } from '../controllers/projection';
import type { SceneRuntime } from '../runtime/SceneRuntime';
import type { FollowCameraRig, PoseOverride } from './FollowCameraRig';

/**
 * The presentation camera (design spec 6.12, v1.2, resolves QA N-2): glue between the pure solver
 * and state machine (`src/domain/camera/`) and the scene. It decides when to frame, solves once per
 * presentation (and again for a new presentation or a viewport change), applies the input rules of
 * table 6.12.7, drives the fade-through veil for swings over 60 degrees, and publishes the camera
 * state for the caption card and for QA.
 *
 * Per-frame cost when idle: one comparison of the director's intent. A solve is a few thousand
 * projections and happens once per presentation.
 */

/** The caption size setting as the UI reads it (Hud.tsx): normal 1, large 1.25, xlarge 1.5. */
function captionScaleOf(size: 'normal' | 'large' | 'xlarge'): number {
  return size === 'xlarge' ? 1.5 : size === 'large' ? 1.25 : 1;
}

/** Joystick dead zone: 15% deflection (design spec 6.12.7). */
export const MOVE_DEAD_ZONE = 0.15;
/** If the Visitor was still walking when the presentation began, wait for her to stop this long. */
const STILL_BEFORE_FRAMING = 0.25;
/** A resize re-solves once the size has been stable this long. */
const RESIZE_SETTLE = 0.15;

export interface CameraFrameInput {
  dt: number;
  reduced: boolean;
  /** Movement input past the dead zone (joystick, keys, arrow buttons, autopilot). */
  moving: boolean;
  viewport: { width: number; height: number };
}

export interface PresentationCameraSnapshot {
  mode: PresentationCameraMode;
  /** Signed yaw offset of the current framing in degrees; 0 when not framed. */
  yawOffsetDeg: number;
  /** Share of the picture inside the viewport and not covered by a character or label. */
  pictureVisibleFraction: number;
  /**
   * The camera's yaw as shown this frame, in degrees (heading convention, atan2 of the look
   * direction), so a test can sample it each frame and measure the peak turning speed.
   */
  shownYawDeg: number;
  /** The solver found nothing for this presentation, so the follow camera stayed (6.12.4 step 4). */
  fallback: boolean;
  guideDropped: boolean;
  /** True once the camera is not moving: the caption card may appear. */
  settled: boolean;
  /** Framing is waiting for the Visitor to stop. */
  pending: boolean;
  /** Counters for QA: hard cuts so far, camera arrivals so far. */
  cutSeq: number;
  settledSeq: number;
  /** Duration in ms of the last move in and out (0 for a cut). */
  lastMoveInMs: number;
  lastMoveOutMs: number;
  /** The photo id being framed, or null. */
  photoId: string | null;
  /** Veil alpha 0 to 1. */
  veil: number;
}

/** The DOM contract for the frontend (the UI may not import the scene). */
export const CAMERA_EVENT = 'surprise-museum:presentation-camera';
export interface CameraEventDetail {
  mode: PresentationCameraMode | 'pending';
  settled: boolean;
  photoId: string | null;
  seq: number;
}

export class PresentationCameraController implements PoseOverride {
  readonly machine = new PresentationCameraMachine();
  private readonly shown = createPose();
  private readonly target = createPose();
  private key: string | null = null;
  private pending = false;
  private waitStill = false;
  private stillFor = 0;
  private blocked = false;
  private fallback = false;
  private solution: FramingSolution | null = null;
  private solvedSize = { w: 0, h: 0 };
  private resizeTimer = 0;
  private emittedKey = '';
  /** True while framing is pending (waiting for stillness), for the snapshot. */
  private pendingNow = false;
  private veilEl: HTMLDivElement | null = null;
  private veilShown = -1;
  private readonly slots = new Map<string, number>();
  private readonly partitionColliders;
  private canvas: HTMLCanvasElement | null = null;
  /** The three.js camera, set by the frame driver, for the QA hook's projection. */
  camera: PerspectiveCamera | null = null;

  private readonly runtime: SceneRuntime;
  private readonly rig: FollowCameraRig;

  constructor(runtime: SceneRuntime, rig: FollowCameraRig) {
    this.runtime = runtime;
    this.rig = rig;
    runtime.layout.slots.forEach((slot, i) => this.slots.set(slot.photoId, i));
    this.partitionColliders = runtime.layout.partitions.flatMap((p) => p.colliders);
    rig.presenter = this;
  }

  attachCanvas(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    if (canvas) canvas.dataset.presentationCamera = this.machine.mode;
  }

  get snapshot(): PresentationCameraSnapshot {
    const m = this.machine;
    const sol = this.solution;
    const framedLike = m.mode === 'framed' || m.mode === 'cut' || m.mode === 'entering';
    return {
      mode: m.mode,
      yawOffsetDeg: framedLike && sol ? sol.yawOffsetDeg : 0,
      pictureVisibleFraction: 0, // filled in by the test hook, which reads the live camera
      shownYawDeg: (Math.atan2(this.rig.pose.forward.x, this.rig.pose.forward.z) * 180) / Math.PI,
      fallback: this.fallback,
      guideDropped: framedLike && sol ? sol.guideDropped : false,
      settled: !this.pendingNow && m.mode !== 'entering' && m.mode !== 'returning',
      pending: this.pendingNow,
      cutSeq: m.cutSeq,
      settledSeq: m.settledSeq,
      lastMoveInMs: m.lastMoveMs,
      lastMoveOutMs: m.lastOutMs,
      photoId: this.key,
      veil: m.veil,
    };
  }

  // ---- PoseOverride -------------------------------------------------------------------------

  compose(dt: number, follow: Readonly<CamPose>, out: CamPose): boolean {
    const active = this.machine.update(dt, follow, out);
    this.drawVeil();
    return active;
  }

  cancel(): void {
    this.machine.cancel();
    this.key = null;
    this.pending = false;
    this.blocked = false;
    this.fallback = false;
    this.solution = null;
    this.drawVeil();
    this.emit();
  }

  // ---- Per frame, before the rig updates --------------------------------------------------

  /** Look-around, zoom or reset takes the camera at once, with no ease (6.12.7). */
  takeOver(): void {
    if (!this.machine.active) return;
    this.rig.adopt(this.machine.takeOver());
    this.blocked = true;
    this.pending = false;
    this.drawVeil();
    this.emit();
  }

  /** Call once per frame after the characters have ticked and before `rig.update`. */
  tick(input: CameraFrameInput): void {
    const rt = this.runtime;
    const intent = rt.director.intent;
    const photoId = intent.kind === 'photo' ? intent.photoId : null;

    if (input.moving) this.stillFor = 0;
    else this.stillFor += input.dt;

    if (photoId !== this.key) {
      const hadFraming = this.machine.active;
      this.key = photoId;
      this.blocked = false;
      this.fallback = false;
      this.solution = hadFraming && photoId !== null ? this.solution : null;
      if (photoId === null) {
        this.pending = false;
        if (hadFraming) this.release(input.reduced);
      } else {
        this.pending = true;
        // Walking at the trigger: frame once she has stopped rather than not at all.
        this.waitStill = input.moving;
      }
    }

    // Movement releases at once and blocks framing this presentation again (6.12.7).
    if (input.moving && this.machine.active && this.machine.mode !== 'returning') {
      if (!this.machine.moved) {
        // The move has not started (still in its delay): movement only delays it (design 6.12).
        this.machine.release(input.reduced);
        this.pending = photoId !== null;
        this.waitStill = true;
      } else {
        this.release(input.reduced);
        this.blocked = true;
        this.pending = false;
      }
    }

    if (this.pending && photoId !== null && !this.blocked) {
      const ready = !input.moving && (!this.waitStill || this.stillFor >= STILL_BEFORE_FRAMING);
      if (ready) {
        this.pending = false;
        const noDelay = this.waitStill;
        this.waitStill = false;
        this.frame(photoId, input, false, noDelay);
      }
    }

    // A viewport change re-solves for the new class and eases to it (cut under reduced motion).
    const m = this.machine.mode;
    if (this.solution && photoId !== null && (m === 'framed' || m === 'cut' || m === 'entering')) {
      const { width, height } = input.viewport;
      if (width !== this.solvedSize.w || height !== this.solvedSize.h) {
        this.resizeTimer += input.dt;
        if (this.resizeTimer >= RESIZE_SETTLE) {
          this.frame(photoId, input, true);
        }
      } else {
        this.resizeTimer = 0;
      }
    }

    this.emit();
  }

  /** Called after a `Reset view` command: the camera hands over first, then the rig eases. */
  beforeReset(): void {
    this.takeOver();
  }

  dispose(): void {
    this.veilEl?.remove();
    this.veilEl = null;
    this.rig.presenter = null;
    if (this.canvas) delete this.canvas.dataset.presentationCamera;
  }

  // ---- Internals ------------------------------------------------------------------------------

  private release(reduced: boolean): void {
    const shown = copyPose(this.machine.pose, this.shown);
    const { keepOrientation } = this.machine.release(reduced, this.rig.follow.yaw);
    if (keepOrientation) this.rig.keepOrientation(shown);
  }

  private frame(photoId: string, input: CameraFrameInput, resize: boolean, noDelay = false): void {
    const rt = this.runtime;
    const slotIndex = this.slots.get(photoId);
    const slot = slotIndex === undefined ? undefined : rt.layout.slots[slotIndex];
    if (!slot) return;
    const visitor = rt.registry.getSource('visitor').read();
    const guide = rt.registry.getSource('guide').read();
    const spot = rt.guide.presentSpot ?? { x: guide.position.x, z: guide.position.z };
    const labelOf = (role: 'visitor' | 'guide', fallback: { w: number; h: number }) => {
      const el = rt.labels.get(role);
      return el && el.offsetWidth > 0 ? { w: el.offsetWidth, h: el.offsetHeight } : fallback;
    };
    const solverInput: FramingInput = {
      viewport: input.viewport,
      picture: {
        corners: frameCorners(slot).map(([x, y, z]) => ({ x, y, z })),
        normal: slot.normal,
      },
      visitor: {
        x: visitor.position.x,
        z: visitor.position.z,
        height: avatarHeight(rt.content.visitorAvatar),
      },
      guide: { x: spot.x, z: spot.z, height: avatarHeight(rt.content.guideAvatar) },
      labelSize: {
        visitor: labelOf('visitor', { w: 110, h: 32 }),
        guide: labelOf('guide', { w: 90, h: 32 }),
      },
      saved: { yaw: this.rig.yaw, pitch: this.rig.pitch },
      captionScale: captionScaleOf(useSettingsStore.getState().captionSize),
      hardColliders: rt.layout.hardColliders,
      partitionColliders: this.partitionColliders,
      ceilingHeight: rt.layout.wallHeight,
    };
    const solution = solveFraming(solverInput);
    this.solvedSize = { w: input.viewport.width, h: input.viewport.height };
    this.resizeTimer = 0;

    if (!solution) {
      // Every candidate breaks a wall rule: the follow camera stays and the presentation goes
      // ahead as in v1.1 (design spec 6.12.4 step 4).
      if (!resize) this.fallback = true;
      return;
    }
    this.fallback = false;
    this.solution = solution;
    const t = this.target;
    t.px = solution.pivot.x;
    t.py = solution.pivot.y;
    t.pz = solution.pivot.z;
    t.yaw = solution.yaw;
    t.pitch = solution.pitch;
    t.boom = solution.boom;
    const from = this.machine.active ? this.machine.pose : this.rig.follow;
    this.machine.begin(from, t, { reduced: input.reduced, resize, noDelay });
  }

  private drawVeil(): void {
    const level = this.machine.veil;
    if (level === this.veilShown) return;
    this.veilShown = level;
    if (level <= 0) {
      if (this.veilEl) this.veilEl.style.opacity = '0';
      return;
    }
    if (!this.veilEl) {
      // The fade-through veil (`--duration-fade-through`, cut at the midpoint): drawn here because
      // the camera, not the UI, decides when it is needed. Tokens come from tokens.css.
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.dataset.testid = 'camera-veil';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        zIndex: 'var(--z-fade, 24)',
        background: 'var(--color-night, #1f1620)',
        pointerEvents: 'none',
        opacity: '0',
      });
      document.body.appendChild(el);
      this.veilEl = el;
    }
    this.veilEl.style.opacity = String(level);
  }

  /**
   * Publish the camera state for the caption card. Besides the machine's own modes it sends:
   *  - `pending` (unsettled) while framing waits for the Visitor to stop, so the card waits;
   *  - `follow` (settled) for this presentation when framing is not happening (fallback, blocked,
   *    reduced-motion cut handled by `cut`), so the card does not rely on a grace period.
   */
  private emit(): void {
    const m = this.machine;
    const waiting = this.pending && this.waitStill && this.key !== null && !m.active;
    const mode: PresentationCameraMode | 'pending' = waiting ? 'pending' : m.mode;
    const settled = !waiting && m.mode !== 'entering' && m.mode !== 'returning';
    const key = `${mode}|${m.settledSeq}|${this.key}|${this.fallback}|${this.blocked}`;
    if (this.emittedKey === key) return;
    this.emittedKey = key;
    this.pendingNow = waiting;
    if (this.canvas) this.canvas.dataset.presentationCamera = mode;
    if (typeof window === 'undefined') return;
    const detail: CameraEventDetail = { mode, settled, photoId: this.key, seq: m.settledSeq };
    window.dispatchEvent(new CustomEvent<CameraEventDetail>(CAMERA_EVENT, { detail }));
  }
}
