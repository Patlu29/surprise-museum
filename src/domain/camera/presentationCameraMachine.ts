import { angleDiff } from '../math/vec2';
import { easeCamera } from './easing';

/**
 * The presentation camera's state machine (design spec 6.12.3 and 6.12.7). Pure: it moves a pose
 * between the live follow pose and a framing pose and knows nothing about three.js, the DOM or the
 * stores. The scene feeds it the follow pose each frame and writes the pose it returns.
 *
 * Modes: `follow` (not involved), `entering` (the delay, the eased move, or the veil), `framed`
 * (holding the framing), `returning` (easing back to the follow pose, a moving target) and `cut`
 * (a hard cut has just happened; held briefly so it can be observed, then `framed`).
 */

/**
 * Timing, mirrored from design spec 6.12.3 and tokens.css (`--duration-presentation-camera-in`
 * 800 ms, `-out` 600 ms, `--duration-camera` 450 ms, `--duration-fade-through` 400 ms,
 * `--ease-camera`). Change both together.
 */
export const CAMERA_TIMING = {
  /** The Guide's turn reads first. */
  delayMs: 150,
  inMs: 800,
  /** Longer swings take degrees / 45 per second, up to this cap. */
  inCapMs: 1300,
  swingDegPerSec: 45,
  /** Above this swing the camera cuts behind the fade-through veil instead of easing. */
  veilSwingDeg: 60,
  veilMs: 400,
  outMs: 600,
  /** Resize re-solve (`--duration-camera`). */
  resizeMs: 450,
  /** An interrupted move never takes less than this. */
  minRetargetMs: 300,
  /** How long `cut` is reported after a hard cut, so polling tests can see it. */
  cutHoldMs: 300,
} as const;

export type PresentationCameraMode = 'follow' | 'entering' | 'framed' | 'returning' | 'cut';

export interface CamPose {
  px: number;
  py: number;
  pz: number;
  yaw: number;
  pitch: number;
  boom: number;
}

export function createPose(): CamPose {
  return { px: 0, py: 0, pz: 0, yaw: 0, pitch: 0, boom: 0 };
}

export function copyPose(from: Readonly<CamPose>, to: CamPose): CamPose {
  to.px = from.px;
  to.py = from.py;
  to.pz = from.pz;
  to.yaw = from.yaw;
  to.pitch = from.pitch;
  to.boom = from.boom;
  return to;
}

function blend(a: Readonly<CamPose>, b: Readonly<CamPose>, e: number, out: CamPose): void {
  out.px = a.px + (b.px - a.px) * e;
  out.py = a.py + (b.py - a.py) * e;
  out.pz = a.pz + (b.pz - a.pz) * e;
  out.yaw = a.yaw + angleDiff(a.yaw, b.yaw) * e;
  out.pitch = a.pitch + (b.pitch - a.pitch) * e;
  out.boom = a.boom + (b.boom - a.boom) * e;
}

/** Duration of the move in (6.12.3): 800 ms up to 35 degrees, then degrees / 45 per second, capped. */
export function moveInMs(swingDeg: number): number {
  const t = CAMERA_TIMING;
  return Math.min(t.inCapMs, Math.max(t.inMs, (Math.abs(swingDeg) / t.swingDegPerSec) * 1000));
}

export interface BeginOptions {
  /** Effective reduced motion: a single-frame cut. */
  reduced: boolean;
  /** Re-solve for a viewport change: eased over `resizeMs`, no delay. */
  resize?: boolean;
}

type Phase = 'delay' | 'move' | 'veil-in' | 'veil-out' | 'hold' | 'back';

export class PresentationCameraMachine {
  private _mode: PresentationCameraMode = 'follow';
  private phase: Phase = 'hold';
  private readonly cur = createPose();
  private readonly from = createPose();
  private readonly target = createPose();
  private elapsed = 0;
  private duration = 0;
  private delayLeft = 0;
  private cutHold = 0;
  private bigSwing = false;
  private veilPending = false;
  /** Increments each time the camera arrives (eased, cut or veil), for the settled signal. */
  settledSeq = 0;
  /** Increments for every hard cut, for QA. */
  cutSeq = 0;
  /** Duration in ms of the last eased move in (0 for a cut), for QA. */
  lastMoveMs = 0;
  lastOutMs = 0;
  /** Veil alpha 0 to 1, for the scene to draw. */
  veil = 0;

  get mode(): PresentationCameraMode {
    return this._mode;
  }

  /** True while the machine, not the follow rig, places the camera. */
  get active(): boolean {
    return this._mode !== 'follow';
  }

  /** The pose being shown (valid while active). */
  get pose(): Readonly<CamPose> {
    return this.cur;
  }

  /** The framing the machine is heading for or holding. */
  get framing(): Readonly<CamPose> {
    return this.target;
  }

  /** Start (or retarget) a move to a framing from the pose on screen now. */
  begin(shown: Readonly<CamPose>, framing: Readonly<CamPose>, opts: BeginOptions): void {
    const t = CAMERA_TIMING;
    const wasActive = this.active;
    if (!wasActive) copyPose(shown, this.cur);
    copyPose(this.cur, this.from);
    copyPose(framing, this.target);
    const swing = Math.abs(angleDiff(this.cur.yaw, framing.yaw)) * (180 / Math.PI);
    this.bigSwing = swing > t.veilSwingDeg;
    this.veilPending = false;
    this.elapsed = 0;
    this.veil = 0;

    if (opts.reduced) {
      this.cutTo();
      return;
    }
    if (opts.resize) {
      this._mode = 'entering';
      this.phase = 'move';
      this.delayLeft = 0;
      this.duration = t.resizeMs;
      this.lastMoveMs = t.resizeMs;
      return;
    }
    this._mode = 'entering';
    this.delayLeft = t.delayMs;
    if (this.bigSwing) {
      // The veil fades in over half its duration, the camera cuts at the midpoint, then it fades out.
      this.phase = 'veil-in';
      this.veilPending = true;
      this.duration = t.veilMs / 2;
      this.lastMoveMs = 0;
      return;
    }
    this.phase = 'delay';
    this.duration = moveInMs(swing);
    this.lastMoveMs = this.duration;
  }

  /**
   * Release toward the follow pose. Returns `keepOrientation` true when the caller should keep the
   * framing's yaw and pitch as the user's pose (a swing over 60 degrees does not swing back).
   * A move still in its delay never started, so it is cancelled with no motion.
   */
  release(reduced: boolean): { keepOrientation: boolean } {
    const t = CAMERA_TIMING;
    if (!this.active) return { keepOrientation: false };
    if (this.phase === 'delay' || this.phase === 'veil-in') {
      this.toFollow();
      return { keepOrientation: false };
    }
    if (reduced) {
      this.toFollow();
      return { keepOrientation: false };
    }
    const keep = this.bigSwing && (this.phase === 'hold' || this.phase === 'veil-out');
    // Interrupted in mid-move: the larger of 300 ms and the full out duration times what is left.
    let ms: number = t.outMs;
    if (this.phase === 'move') {
      const left = 1 - easeCamera(Math.min(1, this.elapsed / this.duration));
      ms = Math.max(t.minRetargetMs, t.outMs * left);
    }
    copyPose(this.cur, this.from);
    this.phase = 'back';
    this._mode = 'returning';
    this.elapsed = 0;
    this.duration = ms;
    this.lastOutMs = ms;
    this.veil = 0;
    return { keepOrientation: keep };
  }

  /** The user took the camera (look-around, zoom, reset): the machine lets go with no ease. */
  takeOver(): Readonly<CamPose> {
    this.toFollow();
    return this.cur;
  }

  /** A cut to the default pose (replay, jump): everything stops. */
  cancel(): void {
    this.toFollow();
  }

  /**
   * Advance by dt seconds. `follow` is the live follow pose (the target while returning). Writes
   * the pose to show into `out` and returns true while the machine is in charge.
   */
  update(dt: number, follow: Readonly<CamPose>, out: CamPose): boolean {
    if (!this.active) return false;
    const ms = dt * 1000;

    switch (this.phase) {
      case 'delay': {
        this.delayLeft -= ms;
        copyPose(this.from, this.cur);
        if (this.delayLeft <= 0) {
          this.elapsed = Math.max(0, -this.delayLeft);
          this.phase = 'move';
        }
        break;
      }
      case 'move': {
        this.elapsed += ms;
        const e = easeCamera(Math.min(1, this.elapsed / this.duration));
        blend(this.from, this.target, e, this.cur);
        if (this.elapsed >= this.duration) this.arrive(false);
        break;
      }
      case 'veil-in': {
        this.elapsed += ms;
        this.veil = Math.min(1, this.elapsed / this.duration);
        copyPose(this.from, this.cur);
        if (this.elapsed >= this.duration && this.veilPending) {
          this.veilPending = false;
          copyPose(this.target, this.cur);
          this.cutSeq += 1;
          this.phase = 'veil-out';
          this.elapsed = 0;
        }
        break;
      }
      case 'veil-out': {
        this.elapsed += ms;
        this.veil = Math.max(0, 1 - this.elapsed / this.duration);
        copyPose(this.target, this.cur);
        if (this.elapsed >= this.duration) {
          this.veil = 0;
          this.arrive(true);
        }
        break;
      }
      case 'hold': {
        copyPose(this.target, this.cur);
        if (this._mode === 'cut') {
          this.cutHold -= ms;
          if (this.cutHold <= 0) this._mode = 'framed';
        }
        break;
      }
      case 'back': {
        this.elapsed += ms;
        const e = easeCamera(Math.min(1, this.elapsed / this.duration));
        blend(this.from, follow, e, this.cur);
        if (this.elapsed >= this.duration) {
          this.toFollow();
          copyPose(follow, this.cur);
        }
        break;
      }
    }
    copyPose(this.cur, out);
    return this.active;
  }

  // ---- Internals ---------------------------------------------------------------------------

  private cutTo(): void {
    copyPose(this.target, this.cur);
    this.cutSeq += 1;
    this.lastMoveMs = 0;
    this.arrive(true);
  }

  private arrive(cut: boolean): void {
    this.phase = 'hold';
    this.settledSeq += 1;
    if (cut) {
      this._mode = 'cut';
      this.cutHold = CAMERA_TIMING.cutHoldMs;
    } else {
      this._mode = 'framed';
    }
  }

  private toFollow(): void {
    this._mode = 'follow';
    this.phase = 'hold';
    this.veil = 0;
    this.veilPending = false;
    this.settledSeq += 1;
  }
}
