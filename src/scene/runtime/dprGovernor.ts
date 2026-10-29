/**
 * Adaptive pixel ratio (architecture 6.11, performance report). Watches the frame interval while
 * the Visitor is roaming and, when the device is clearly below its target frame rate for two
 * windows in a row, lowers the pixel-ratio cap one step. It only ever lowers it: raising it again
 * would oscillate, and a Visitor who walks a little would never notice the difference.
 *
 * It does nothing until the device has settled (shaders compiled, first photos uploaded), and
 * ignores the welcome screen, the full-screen viewer, hidden tabs and any single long frame, so a
 * hiccup never costs sharpness. Pure, so it is unit-tested without a renderer.
 */
export interface DprGovernorOptions {
  /** The frame rate the scene is meant to hold: 30 on phones and Low graphics, 60 otherwise. */
  targetFps: number;
  /** The starting cap (the tier's maximum pixel ratio). */
  start: number;
  /** The cap is never lowered past this. 1 keeps one render pixel per CSS pixel. */
  floor: number;
  /** How much to lower the cap each time. Default 0.25. */
  step?: number;
  /** Quiet period after roaming begins, and after each change, in ms. Default 6000 and 2500. */
  warmupMs?: number;
  settleMs?: number;
  /** Length of one judging window in ms. Default 3000. */
  windowMs?: number;
  /** A window is slow when its mean frame interval exceeds this multiple of the target. */
  slowFactor?: number;
}

/** Frame intervals above this are pauses (hidden tab, long task), not slowness. */
const PAUSE_MS = 250;

export class DprGovernor {
  cap: number;
  private readonly opts: Required<DprGovernorOptions>;
  private lastT: number | null = null;
  private activeSince: number | null = null;
  private quietUntil = 0;
  private windowStart = 0;
  private sum = 0;
  private count = 0;
  private strikes = 0;

  constructor(options: DprGovernorOptions) {
    this.opts = {
      step: 0.25,
      warmupMs: 6000,
      settleMs: 2500,
      windowMs: 3000,
      slowFactor: 1.15,
      ...options,
    };
    this.cap = options.start;
  }

  /** Call once per rendered frame with the timestamp in ms. Returns a new cap, or null. */
  frame(nowMs: number, active: boolean): number | null {
    if (!active) {
      this.lastT = null;
      this.activeSince = null;
      this.resetWindow();
      return null;
    }
    if (this.activeSince === null) {
      this.activeSince = nowMs;
      this.quietUntil = nowMs + this.opts.warmupMs;
    }
    const last = this.lastT;
    this.lastT = nowMs;
    if (last === null) return null;
    const dt = nowMs - last;
    if (dt > PAUSE_MS) {
      this.resetWindow();
      return null;
    }
    if (nowMs < this.quietUntil) return null;
    if (this.count === 0) this.windowStart = nowMs;
    this.sum += dt;
    this.count++;
    if (nowMs - this.windowStart < this.opts.windowMs) return null;

    const mean = this.sum / this.count;
    const slow = mean > (1000 / this.opts.targetFps) * this.opts.slowFactor;
    this.resetWindow(false);
    this.strikes = slow ? this.strikes + 1 : 0;
    if (this.strikes < 2 || this.cap <= this.opts.floor) return null;

    this.strikes = 0;
    this.cap = Math.max(this.opts.floor, this.cap - this.opts.step);
    this.quietUntil = nowMs + this.opts.settleMs;
    return this.cap;
  }

  private resetWindow(clearStrikes = true): void {
    this.sum = 0;
    this.count = 0;
    if (clearStrikes) this.strikes = 0;
  }
}
