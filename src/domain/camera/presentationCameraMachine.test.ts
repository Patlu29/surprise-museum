import { describe, expect, it } from 'vitest';
import {
  CAMERA_TIMING,
  PresentationCameraMachine,
  createPose,
  moveInMs,
  type CamPose,
} from './presentationCameraMachine';

const pose = (yawDeg: number, boom = 4): CamPose => ({
  px: 0,
  py: 1,
  pz: 0,
  yaw: (yawDeg * Math.PI) / 180,
  pitch: 0.2,
  boom,
});

/** Run the machine for `ms` in 16 ms frames and return the last pose. */
function run(m: PresentationCameraMachine, ms: number, follow: CamPose, out = createPose()) {
  for (let t = 0; t < ms; t += 16) m.update(0.016, follow, out);
  return out;
}

describe('move durations (6.12.3)', () => {
  it('800 ms up to 35 degrees, then degrees / 45 per second, capped at 1,300 ms', () => {
    expect(moveInMs(10)).toBe(800);
    expect(moveInMs(35)).toBe(800);
    expect(moveInMs(45)).toBe(1000);
    expect(moveInMs(58)).toBeCloseTo(1288.9, 0);
    expect(moveInMs(59.9)).toBe(1300);
  });
});

describe('PresentationCameraMachine', () => {
  it('waits 150 ms, eases in over 800 ms, then holds, and reports a settled arrival', () => {
    const m = new PresentationCameraMachine();
    const follow = pose(0);
    const target = pose(35, 3.5);
    m.begin(follow, target, { reduced: false });
    expect(m.mode).toBe('entering');
    const out = createPose();
    run(m, 120, follow, out);
    expect(out.yaw).toBe(0); // still in the 150 ms delay
    const seq = m.settledSeq;
    run(m, 100 + 800, follow, out);
    expect(m.mode).toBe('framed');
    expect(m.settledSeq).toBe(seq + 1);
    expect(out.boom).toBeCloseTo(3.5, 3);
    expect(m.lastMoveMs).toBe(800);
  });

  it('never overshoots', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0, 4.5), pose(35, 3), { reduced: false });
    const out = createPose();
    for (let t = 0; t < 1200; t += 16) {
      m.update(0.016, pose(0), out);
      expect(out.boom).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(out.boom).toBeLessThanOrEqual(4.5 + 1e-9);
      expect(out.yaw).toBeLessThanOrEqual(pose(35).yaw + 1e-9);
    }
  });

  it('is a single-frame cut under reduced motion', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(52), { reduced: true });
    expect(m.mode).toBe('cut');
    expect(m.cutSeq).toBe(1);
    const out = createPose();
    m.update(0.016, pose(0), out);
    expect(out.yaw).toBeCloseTo(pose(52).yaw, 6);
    run(m, CAMERA_TIMING.cutHoldMs + 50, pose(0), out);
    expect(m.mode).toBe('framed');
    // And back as a cut.
    m.release(true);
    expect(m.mode).toBe('follow');
  });

  it('uses the veil for swings over 60 degrees: cut at the midpoint, never a whirl', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(100), { reduced: false });
    const out = createPose();
    let sawVeil = 0;
    let maxYawStep = 0;
    let prev = 0;
    for (let t = 0; t < 700; t += 16) {
      m.update(0.016, pose(0), out);
      sawVeil = Math.max(sawVeil, m.veil);
      maxYawStep = Math.max(maxYawStep, Math.abs(out.yaw - prev));
      prev = out.yaw;
    }
    expect(sawVeil).toBeGreaterThan(0.9);
    expect(m.cutSeq).toBe(1);
    expect(m.mode === 'framed' || m.mode === 'cut').toBe(true);
    expect(m.veil).toBe(0);
    // The only yaw jump is the single cut.
    expect(maxYawStep).toBeGreaterThan(1);
  });

  it('returns in 600 ms to the live follow pose, a moving target', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(35, 3), { reduced: false });
    const out = run(m, 1100, pose(0));
    expect(m.mode).toBe('framed');
    const { keepOrientation } = m.release(false);
    expect(keepOrientation).toBe(false);
    expect(m.mode).toBe('returning');
    const follow = pose(0);
    for (let t = 0; t < 600; t += 16) {
      follow.px += 0.01; // the Visitor is walking
      m.update(0.016, follow, out);
    }
    m.update(0.016, follow, out);
    expect(m.mode).toBe('follow');
    expect(m.lastOutMs).toBe(600);
  });

  it('does not swing back after a swing over 60 degrees: keep the orientation', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(90), { reduced: false });
    run(m, 800, pose(0));
    expect(m.release(false).keepOrientation).toBe(true);
  });

  it('retargets an interrupted move from the current pose, in at least 300 ms', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(35, 3), { reduced: false });
    const out = run(m, 150 + 700, pose(0)); // nearly there
    const before = out.yaw;
    m.release(false);
    expect(m.mode).toBe('returning');
    expect(m.lastOutMs).toBeGreaterThanOrEqual(CAMERA_TIMING.minRetargetMs);
    expect(m.lastOutMs).toBeLessThan(CAMERA_TIMING.outMs);
    m.update(0.016, pose(0), out);
    expect(Math.abs(out.yaw - before)).toBeLessThan(0.05); // no jump
  });

  it('cancels a move that never started (still in the delay) with no motion', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(35), { reduced: false });
    run(m, 80, pose(0));
    m.release(false);
    expect(m.mode).toBe('follow');
  });

  it('takes over instantly: the pose on screen becomes the user pose, mode follow', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(35, 3), { reduced: false });
    run(m, 600, pose(0));
    const shown = { ...m.pose };
    const taken = m.takeOver();
    expect(taken.yaw).toBeCloseTo(shown.yaw, 9);
    expect(m.mode).toBe('follow');
    expect(m.active).toBe(false);
  });

  it('re-frames directly from the current pose without returning to follow', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(35, 3), { reduced: false });
    run(m, 1200, pose(0));
    m.begin(m.pose, pose(-40, 3.2), { reduced: false });
    expect(m.mode).toBe('entering');
    const out = run(m, 20, pose(0));
    expect(out.yaw).toBeCloseTo(pose(35).yaw, 3); // starts where it was, after the delay
    run(m, 1500, pose(0), out);
    expect(m.mode).toBe('framed');
    expect(out.yaw).toBeCloseTo(pose(-40).yaw, 3);
  });

  it('a resize re-solve eases over 450 ms', () => {
    const m = new PresentationCameraMachine();
    m.begin(pose(0), pose(35, 3), { reduced: false });
    run(m, 1200, pose(0));
    m.begin(m.pose, pose(45, 3.4), { reduced: false, resize: true });
    expect(m.lastMoveMs).toBe(CAMERA_TIMING.resizeMs);
  });
});
