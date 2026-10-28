import { describe, expect, it } from 'vitest';
import { createRng, dist2, forwardOf, type Vec2 } from '../math/vec2';
import { circleIsFree, CHARACTER_RADIUS } from '../navigation/geometry';
import { createSimulation, type Simulation } from './simulation';

/**
 * NFR-26: a 30-minute run with a simulated Visitor roaming at random. Because src/domain is pure,
 * this takes a few seconds of CPU at a fixed 1/30 s step.
 *
 * Asserts, over the whole run: the Guide is never stuck for more than 10 s, never inside a wall,
 * never jumps without a teleport (so never passes through a wall), never blocks the Visitor for
 * more than 2 s, and never lingers beyond 8 m.
 */
interface SoakReport {
  steps: number;
  presentations: number;
  relocations: number;
  jumps: number;
  maxStuckSeconds: number;
  maxFarSeconds: number;
  maxBlockSeconds: number;
  maxPathBlockSeconds: number;
  wallViolations: number;
  tunnelViolations: number;
  minVisitorGuideDistance: number;
}

function soak(sim: Simulation, minutes: number, seed: number): SoakReport {
  const rng = createRng(seed);
  const dt = 1 / 30;
  const steps = Math.round(minutes * 60 * 30);
  const layout = sim.layout;

  const report: SoakReport = {
    steps,
    presentations: 0,
    relocations: 0,
    jumps: 0,
    maxStuckSeconds: 0,
    maxFarSeconds: 0,
    maxBlockSeconds: 0,
    maxPathBlockSeconds: 0,
    wallViolations: 0,
    tunnelViolations: 0,
    minVisitorGuideDistance: Infinity,
  };

  const randomPoint = (): Vec2 =>
    sim.nav.nearestWalkable({
      x: (rng() - 0.5) * 7,
      z: layout.bounds.maxZ + rng() * (layout.bounds.minZ - layout.bounds.maxZ),
    });
  const pickGoal = (): Vec2 => {
    const r = rng();
    if (r < 0.5 && layout.slots.length > 0) {
      return layout.slots[Math.floor(rng() * layout.slots.length)]!.standingSpot;
    }
    if (r < 0.62) return layout.finale.center;
    if (r < 0.7) return layout.spawn.visitor.position;
    return randomPoint();
  };

  let goal = pickGoal();
  let pauseLeft = 0;
  let nextCameraTurn = 2 + rng() * 8;
  let nextJump = 150 + rng() * 150;
  let stuck = 0;
  let far = 0;
  let block = 0;
  let pathBlock = 0;
  let prevPresentation = '';
  let prevSeq = sim.guide.read().teleportSeq;
  let prevGuide = sim.guidePos();

  for (let i = 0; i < steps; i++) {
    // ---- Simulated user ---------------------------------------------------------------------
    if (sim.time > nextCameraTurn) {
      sim.cameraYaw += (rng() - 0.5) * Math.PI; // the user drags the view around now and then
      nextCameraTurn = sim.time + 3 + rng() * 15;
    }
    if (sim.time > nextJump) {
      // Pictures list jump or replay: cut the Visitor somewhere and put the Guide beside her.
      const slot = layout.slots[Math.floor(rng() * layout.slots.length)];
      const dest = rng() < 0.2 || !slot ? layout.spawn.visitor.position : slot.standingSpot;
      sim.visitor.teleport({ x: dest.x, y: 0, z: dest.z }, slot ? -slot.normal.x * 1.57 : Math.PI);
      sim.director.reset();
      sim.guide.placeBesideVisitor(sim.visitorPos());
      report.jumps++;
      nextJump = sim.time + 150 + rng() * 150;
      goal = pickGoal();
    }

    if (pauseLeft > 0) {
      pauseLeft -= dt;
      sim.stop();
      // Sometimes close the caption card.
      if (sim.director.intent.kind !== 'none' && rng() < 0.002) sim.director.dismiss();
    } else {
      const here = sim.visitorPos();
      if (dist2(here, goal) < 0.25) {
        pauseLeft = rng() < 0.3 ? 0 : rng() * 7;
        goal = pickGoal();
        sim.stop();
      } else {
        const path = sim.nav.findPath(here, goal);
        sim.steer(path?.[0] ?? goal);
      }
    }
    // Now and then walk straight at the Guide, to test yielding.
    if (pauseLeft <= 0 && rng() < 0.0004) goal = sim.nav.nearestWalkable(sim.guidePos());

    sim.step(dt);

    // ---- Invariants -------------------------------------------------------------------------
    const G = sim.guidePos();
    const V = sim.visitorPos();
    const g = sim.guide.read();

    if (!circleIsFree(G, CHARACTER_RADIUS - 0.02, layout.colliders)) report.wallViolations++;
    if (g.teleportSeq === prevSeq && dist2(G, prevGuide) > 0.25) report.tunnelViolations++;
    if (g.teleportSeq !== prevSeq) {
      report.relocations++;
      prevSeq = g.teleportSeq;
    }
    prevGuide = G;

    const dGV = dist2(G, V);
    report.minVisitorGuideDistance = Math.min(report.minVisitorGuideDistance, dGV);

    // Stuck: it should be somewhere else but is not moving. A Guide that is idling inside the
    // 2 to 5 m band, or standing at its presentation spot, is not stuck.
    const outOfBand = dGV > 5.5;
    const owesAWalk =
      g.presentation.kind === 'none' && sim.director.intent.kind !== 'none' && dGV > 2.5;
    if ((outOfBand || owesAWalk) && g.speed < 0.05 && g.opacity > 0.5) stuck += dt;
    else stuck = 0;
    report.maxStuckSeconds = Math.max(report.maxStuckSeconds, stuck);

    far = dGV > 8.3 ? far + dt : 0;
    report.maxFarSeconds = Math.max(report.maxFarSeconds, far);

    block = dGV < 0.45 && g.opacity > 0.5 ? block + dt : 0;
    report.maxBlockSeconds = Math.max(report.maxBlockSeconds, block);

    const vel = sim.visitor.read().speed;
    const fwd = forwardOf(sim.visitor.read().heading);
    const ahead = { x: V.x + fwd.x * vel, z: V.z + fwd.z * vel };
    pathBlock = vel > 0.5 && dist2(G, ahead) < 0.5 && g.opacity > 0.5 ? pathBlock + dt : 0;
    report.maxPathBlockSeconds = Math.max(report.maxPathBlockSeconds, pathBlock);

    const key = g.presentation.kind === 'photo' ? g.presentation.photoId : g.presentation.kind;
    if (key !== prevPresentation) {
      if (g.presentation.kind !== 'none') report.presentations++;
      prevPresentation = key;
    }
  }
  return report;
}

function expectHealthy(r: SoakReport): void {
  expect(r.wallViolations, 'Guide inside a wall').toBe(0);
  expect(r.tunnelViolations, 'Guide moved without a teleport faster than walking').toBe(0);
  expect(r.maxStuckSeconds, 'longest stuck period (s)').toBeLessThanOrEqual(10);
  expect(r.maxFarSeconds, 'longest time beyond 8 m (s)').toBeLessThanOrEqual(2);
  expect(r.maxBlockSeconds, 'longest overlap with the Visitor (s)').toBeLessThanOrEqual(2);
  expect(r.maxPathBlockSeconds, 'longest time in the Visitor path (s)').toBeLessThanOrEqual(2);
  expect(r.presentations, 'the run should include many presentations').toBeGreaterThan(20);
}

describe('NFR-26: Guide soak test', () => {
  it('survives 30 minutes of random roaming in a 20-photo museum', { timeout: 120_000 }, () => {
    const sim = createSimulation(20);
    const report = soak(sim, 30, 2026);
    expectHealthy(report);
    expect(report.steps).toBe(54_000);
  });

  it('survives 10 minutes in a small museum with another seed', { timeout: 60_000 }, () => {
    expectHealthy(soak(createSimulation(5), 10, 7));
  });

  it('survives 10 minutes with reduced motion', { timeout: 60_000 }, () => {
    expectHealthy(soak(createSimulation(9, { reducedMotion: true }), 10, 99));
  });
});
