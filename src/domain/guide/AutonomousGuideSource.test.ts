import { describe, expect, it } from 'vitest';
import { generateLayout } from '../layout/generateLayout';
import { dist2, distToSegment, type Vec2 } from '../math/vec2';
import { NavGraph } from '../navigation/navGraph';
import { createSimulation, makePhotos, walkVisitorTo } from './simulation';

describe('Guide: following (FR-31)', () => {
  it('trails the Visitor down the route and stays within 5 m of her', () => {
    const sim = createSimulation(12);
    const target = { x: 0, z: -40 };
    let worst = 0;
    let ok = false;
    for (let i = 0; i < 90 * 30 && !ok; i++) {
      const path = sim.nav.findPath(sim.visitorPos(), target);
      sim.steer(path?.[0] ?? target);
      sim.step();
      if (i > 120) worst = Math.max(worst, dist2(sim.guidePos(), sim.visitorPos()));
      ok = dist2(sim.visitorPos(), target) < 0.3;
    }
    expect(ok).toBe(true);
    expect(worst).toBeLessThan(5.5);
  });

  it('stands idle once the Visitor stops, 2 to 4 m away', () => {
    const sim = createSimulation(8);
    walkVisitorTo(sim, { x: 0, z: -10 });
    sim.run(8);
    const g = sim.guide.read();
    expect(g.locomotion).toBe('idle');
    expect(g.speed).toBe(0);
    const d = dist2(sim.guidePos(), sim.visitorPos());
    expect(d).toBeGreaterThan(1.6);
    expect(d).toBeLessThan(4.2);
  });

  it('never stays in the Visitor path or the camera corridor', () => {
    const sim = createSimulation(8);
    let bad = 0;
    walkVisitorTo(sim, { x: 0, z: -12 });
    // Walk straight back towards the Guide, through where it stands.
    const target = { x: 0, z: -2 };
    for (let i = 0; i < 20 * 30; i++) {
      sim.steer(target);
      sim.step();
      const V = sim.visitorPos();
      const G = sim.guidePos();
      if (dist2(V, G) < 0.45) bad++;
    }
    // Brief overlaps while sidestepping are fine; a Guide that blocks her is not.
    expect(bad).toBeLessThan(30);
  });
});

describe('Guide: presenting (FR-26, FR-27, FR-30)', () => {
  it('walks beside the Visitor, facing the picture, without standing between them', () => {
    const sim = createSimulation(8);
    const slot = sim.layout.slots[0]!;
    walkVisitorTo(sim, slot.standingSpot);
    sim.run(8);

    expect(sim.director.intent).toMatchObject({ kind: 'photo', photoId: slot.photoId });
    expect(sim.guide.read().presentation).toEqual({ kind: 'photo', photoId: slot.photoId });
    expect(sim.guide.currentMode).toBe('present');

    const V = sim.visitorPos();
    const G = sim.guidePos();
    // Beside her: about 1.1 m away, no nearer the picture than she is.
    expect(dist2(V, G)).toBeGreaterThan(0.8);
    expect(dist2(V, G)).toBeLessThan(1.5);
    const wallDistV = Math.abs(V.x - slot.position.x);
    const wallDistG = Math.abs(G.x - slot.position.x);
    expect(wallDistG).toBeGreaterThanOrEqual(wallDistV - 0.01);
    // Not on the line between her and the picture.
    const zone = slot.zonePoint;
    expect(distToSegment(G, V, zone).dist).toBeGreaterThan(0.45);
    // Faces somewhere between the picture and the Visitor (a heading towards the wall side).
    expect(Math.sin(sim.guide.read().heading) * slot.normal.x).toBeLessThan(0.9);
  });

  it('publishes the presentation on arrival, or 1.5 s after the intent at the latest', () => {
    const sim = createSimulation(8);
    const slot = sim.layout.slots[0]!;
    // Put the Guide on the far side of the room so it cannot arrive within 1.5 s.
    sim.guide.teleport({ x: 3.4, y: 0, z: slot.position.z - 4.5 }, 0);
    sim.visitor.teleport({ x: slot.standingSpot.x, y: 0, z: slot.standingSpot.z }, Math.PI / 2);
    sim.director.reset();
    let intentAt = -1;
    let shownAt = -1;
    sim.run(8, (s) => {
      if (intentAt < 0 && s.director.intent.kind === 'photo') intentAt = s.time;
      if (shownAt < 0 && s.guide.read().presentation.kind === 'photo') shownAt = s.time;
    });
    expect(intentAt).toBeGreaterThan(0);
    expect(shownAt - intentAt).toBeLessThanOrEqual(1.55);
  });

  it('plays the present gesture once, then stands still', () => {
    const sim = createSimulation(8);
    const slot = sim.layout.slots[0]!;
    walkVisitorTo(sim, slot.standingSpot);
    let sawGesture = false;
    sim.run(10, (s) => {
      if (s.guide.read().gesture === 'present') sawGesture = true;
    });
    expect(sawGesture).toBe(true);
    expect(sim.guide.read().gesture).toBe('none');
  });

  it('closes beyond 4.5 m and goes back to following', () => {
    const sim = createSimulation(8);
    const slot = sim.layout.slots[0]!;
    walkVisitorTo(sim, slot.standingSpot);
    sim.run(6);
    expect(sim.guide.read().presentation.kind).toBe('photo');
    walkVisitorTo(sim, { x: 0, z: slot.position.z - 3 });
    sim.run(3);
    expect(sim.guide.read().presentation.kind).toBe('none');
    expect(sim.guide.currentMode).toBe('follow');
  });

  it('only one presentation at a time, the nearest wins', () => {
    const sim = createSimulation(8);
    const a = sim.layout.slots[0]!;
    const c = sim.layout.slots[2]!;
    walkVisitorTo(sim, a.standingSpot);
    sim.run(4);
    walkVisitorTo(sim, { x: c.standingSpot.x, z: c.standingSpot.z });
    sim.run(6);
    expect(sim.guide.read().presentation).toEqual({ kind: 'photo', photoId: c.photoId });
  });

  it('presents a picture with no caption the same way (the caption is a UI matter)', () => {
    const sim = createSimulation(3);
    walkVisitorTo(sim, sim.layout.slots[1]!.standingSpot);
    sim.run(6);
    expect(sim.guide.read().presentation.kind).toBe('photo');
  });

  it('stands beside the Visitor on the podium for the finale', () => {
    const sim = createSimulation(4);
    walkVisitorTo(sim, sim.layout.finale.center);
    sim.run(6);
    expect(sim.guide.read().presentation).toEqual({ kind: 'finale' });
    const d = dist2(sim.guidePos(), sim.visitorPos());
    expect(d).toBeGreaterThan(0.6);
    expect(d).toBeLessThan(1.6);
  });

  it('dismiss ends the presentation and the Guide resumes following', () => {
    const sim = createSimulation(8);
    walkVisitorTo(sim, sim.layout.slots[0]!.standingSpot);
    sim.run(6);
    sim.director.dismiss();
    sim.run(2);
    expect(sim.guide.read().presentation.kind).toBe('none');
    expect(sim.guide.currentMode).toBe('follow');
  });

  it('does not walk if it is already beside the Visitor (A-19)', () => {
    // A tolerant follow band, so the Guide is not stepping away while the dwell timer runs.
    const sim = createSimulation(8, { guideConfig: { followNear: 0.5 } });
    const slot = sim.layout.slots[0]!;
    walkVisitorTo(sim, slot.standingSpot);
    sim.run(8);
    const spot = sim.guide.presentSpot!;
    expect(spot).not.toBeNull();

    // Re-approach with the Guide already standing at the spot.
    sim.director.reset();
    sim.guide.teleport({ x: spot.x, y: 0, z: spot.z }, 0);
    const seq = sim.guide.read().teleportSeq;
    let travelled = 0;
    let last = sim.guidePos();
    let shownWithin = -1;
    const start = sim.time;
    sim.run(3, (s) => {
      travelled += dist2(last, s.guidePos());
      last = s.guidePos();
      if (shownWithin < 0 && s.guide.read().presentation.kind === 'photo')
        shownWithin = s.time - start;
    });
    // It may settle a few centimetres onto the exact spot, but it does not walk across.
    expect(travelled).toBeLessThan(0.7);
    expect(sim.guide.read().teleportSeq).toBe(seq);
    expect(shownWithin).toBeGreaterThan(0);
    expect(shownWithin).toBeLessThan(1.6);
  });

  it('presents a picture again after the Visitor leaves beyond 4.5 m (A-19)', () => {
    const sim = createSimulation(8);
    const slot = sim.layout.slots[0]!;
    walkVisitorTo(sim, slot.standingSpot);
    sim.run(6);
    sim.director.dismiss();
    sim.run(1);
    expect(sim.guide.read().presentation.kind).toBe('none');
    walkVisitorTo(sim, { x: 0, z: slot.position.z - 3 });
    walkVisitorTo(sim, slot.standingSpot);
    sim.run(8);
    expect(sim.guide.read().presentation).toEqual({ kind: 'photo', photoId: slot.photoId });
  });
});

describe('Guide: relocating (FR-31)', () => {
  it('reappears beside the Visitor when more than 8 m away, with a fade', () => {
    const sim = createSimulation(12);
    sim.run(1);
    const seq = sim.guide.read().teleportSeq;
    sim.visitor.teleport({ x: 0, y: 0, z: -20 }, Math.PI);
    let minOpacity = 1;
    sim.run(2, (s) => {
      minOpacity = Math.min(minOpacity, s.guide.read().opacity);
    });
    expect(sim.guide.read().teleportSeq).toBeGreaterThan(seq);
    expect(minOpacity).toBeLessThan(0.1);
    expect(sim.guide.read().opacity).toBe(1);
    const d = dist2(sim.guidePos(), sim.visitorPos());
    expect(d).toBeGreaterThan(1.5);
    expect(d).toBeLessThan(4.5);
    expect(sim.nav.isWalkable(sim.guidePos())).toBe(true);
  });

  it('reappears after being stuck for 3 s', () => {
    // Wall the Guide in with four boxes, so it can only be rescued by relocating.
    const base = generateLayout(makePhotos(8));
    const g = base.spawn.guide.position;
    const r = 0.5;
    const walls = [
      { minX: g.x - r - 0.1, maxX: g.x - r, minZ: g.z - r, maxZ: g.z + r },
      { minX: g.x + r, maxX: g.x + r + 0.1, minZ: g.z - r, maxZ: g.z + r },
      { minX: g.x - r, maxX: g.x + r, minZ: g.z - r - 0.1, maxZ: g.z - r },
      { minX: g.x - r, maxX: g.x + r, minZ: g.z + r, maxZ: g.z + r + 0.1 },
    ];
    const trapped = { ...base, colliders: [...base.colliders, ...walls] };
    const sim = createSimulation(8, { layout: trapped });
    sim.visitor.teleport({ x: -3, y: 0, z: -4.5 }, Math.PI);
    let relocatedAt = -1;
    const seq = sim.guide.read().teleportSeq;
    sim.run(10, (s) => {
      if (relocatedAt < 0 && s.guide.read().teleportSeq > seq) relocatedAt = s.time;
    });
    expect(relocatedAt).toBeGreaterThan(0);
    expect(relocatedAt).toBeLessThan(6);
    expect(new NavGraph(trapped).isWalkable(sim.guidePos())).toBe(true);
  });
});

describe('Guide: reduced motion (FR-62)', () => {
  it('fades in beside the Visitor instead of walking, with no gesture', () => {
    const sim = createSimulation(8, { reducedMotion: true });
    const slot = sim.layout.slots[0]!;
    // Guide far from the picture so a walk would be obvious.
    sim.guide.teleport({ x: 3.4, y: 0, z: slot.position.z - 4.5 }, 0);
    sim.visitor.teleport({ x: slot.standingSpot.x, y: 0, z: slot.standingSpot.z }, Math.PI / 2);
    sim.director.reset();
    let walked = false;
    let sawGesture = false;
    let faded = false;
    sim.run(5, (s) => {
      const g = s.guide.read();
      // Before the intent the Guide may follow normally; the rule is about the presentation.
      if (s.director.intent.kind === 'photo' && g.locomotion === 'walk') walked = true;
      if (g.gesture === 'present') sawGesture = true;
      if (g.presentation.kind === 'photo' && g.opacity > 0 && g.opacity < 1) faded = true;
    });
    expect(walked).toBe(false);
    expect(sawGesture).toBe(false);
    expect(faded).toBe(true);
    expect(sim.guide.read().opacity).toBe(1);
    expect(sim.guide.read().presentation.kind).toBe('photo');
    expect(dist2(sim.guidePos(), sim.visitorPos())).toBeLessThan(1.6);
  });

  it('relocates instantly, without a fade', () => {
    const sim = createSimulation(12, { reducedMotion: true });
    sim.run(1);
    sim.visitor.teleport({ x: 0, y: 0, z: -20 }, Math.PI);
    let minOpacity = 1;
    sim.run(1, (s) => {
      minOpacity = Math.min(minOpacity, s.guide.read().opacity);
    });
    expect(minOpacity).toBe(1);
    expect(dist2(sim.guidePos(), sim.visitorPos())).toBeLessThan(4.5);
  });
});

describe('Guide: placeBesideVisitor', () => {
  it('puts the Guide 2 to 4 m from the Visitor with line of sight', () => {
    const sim = createSimulation(8);
    sim.visitor.teleport({ x: -2.4, y: 0, z: -11 }, Math.PI / 2);
    sim.guide.placeBesideVisitor(sim.visitorPos());
    const d = dist2(sim.guidePos(), sim.visitorPos());
    expect(d).toBeGreaterThan(1.9);
    expect(d).toBeLessThan(4.1);
    expect(sim.nav.hasSightLine(sim.guidePos(), sim.visitorPos(), 0.1)).toBe(true);
  });
});

describe('type sanity', () => {
  it('Vec2 helper is imported', () => {
    const v: Vec2 = { x: 0, z: 0 };
    expect(v).toBeDefined();
  });
});
