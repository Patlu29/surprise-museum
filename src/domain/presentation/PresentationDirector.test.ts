import { beforeEach, describe, expect, it } from 'vitest';
import { generateLayout } from '../layout/generateLayout';
import type { Vec2 } from '../math/vec2';
import { PresentationDirector } from './PresentationDirector';

const photos = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 }));
const layout = generateLayout(photos);
const slot0 = layout.slots[0]!; // left wall, near row of gallery 1
const slot1 = layout.slots[1]!; // right wall, near row of gallery 1

/** Standing beside a picture: 1.6 m from its wall, level with it. */
const at = (slot: typeof slot0, extraZ = 0): Vec2 => ({
  x: slot.standingSpot.x,
  z: slot.standingSpot.z + extraZ,
});

let director: PresentationDirector;
beforeEach(() => {
  director = new PresentationDirector(layout);
});

/** Run the director for `seconds` at 30 Hz with the Visitor at `pos`. */
function run(pos: Vec2 | ((t: number) => Vec2), seconds: number): void {
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) {
    director.update(1 / 30, typeof pos === 'function' ? pos(i / 30) : pos);
  }
}

describe('PresentationDirector: starting', () => {
  it('starts nothing at once, and presents after 1 s within 3 m', () => {
    run(at(slot0), 0.9);
    expect(director.intent.kind).toBe('none');
    run(at(slot0), 0.2);
    expect(director.intent).toMatchObject({ kind: 'photo', photoId: slot0.photoId });
  });

  it('starts nothing for a pass-through shorter than 1 s (US-13)', () => {
    run(at(slot0), 0.6);
    run({ x: 0, z: slot0.position.z }, 1); // walk off to the centre line: 3.7 m away
    expect(director.intent.kind).toBe('none');
    run(at(slot0), 0.6); // timer was reset, so another 0.6 s is still not enough
    expect(director.intent.kind).toBe('none');
  });

  it('does not start from the middle of a room (outside every 3 m zone)', () => {
    run({ x: 0, z: slot0.position.z }, 5);
    expect(director.intent.kind).toBe('none');
  });

  it('ignores a picture on the far side of a wall', () => {
    // In the entrance hall, hard against the wall that separates it from gallery 1's first picture.
    const behind: Vec2 = { x: -3.7, z: layout.rooms[0]!.bounds.minZ + 0.3 };
    expect(Math.hypot(behind.x - slot0.zonePoint.x, behind.z - slot0.zonePoint.z)).toBeLessThan(3);
    run(behind, 3);
    expect(director.intent).toMatchObject({ kind: 'none' });
  });

  it('measures "within 3 m" to the zone point at the exact boundary', () => {
    const justOutside: Vec2 = { x: slot0.zonePoint.x + 3.05, z: slot0.zonePoint.z };
    run(justOutside, 3);
    expect(director.intent.kind).toBe('none');
    const justInside: Vec2 = { x: slot0.zonePoint.x + 2.95, z: slot0.zonePoint.z };
    run(justInside, 1.1);
    expect(director.intent.kind).toBe('photo');
  });
});

describe('PresentationDirector: ending', () => {
  it('stays open between 3 m and 4.5 m, and closes beyond 4.5 m', () => {
    run(at(slot0), 1.2);
    expect(director.intent.kind).toBe('photo');
    run({ x: slot0.zonePoint.x + 4.2, z: slot0.zonePoint.z }, 1);
    expect(director.intent.kind).toBe('photo');
    run({ x: slot0.zonePoint.x + 4.6, z: slot0.zonePoint.z }, 0.1);
    expect(director.intent.kind).toBe('none');
  });

  it('does not flicker at the boundary', () => {
    let changes = 0;
    run(at(slot0), 1.2);
    let last = director.intent.kind;
    // Wobble the Visitor across the 3 m entry distance: never past 4.5 m.
    for (let i = 0; i < 300; i++) {
      const x = slot0.zonePoint.x + 3 + Math.sin(i / 3) * 0.4;
      director.update(1 / 30, { x, z: slot0.zonePoint.z });
      if (director.intent.kind !== last) {
        changes++;
        last = director.intent.kind;
      }
    }
    expect(changes).toBe(0);
  });
});

describe('PresentationDirector: switching (FR-28)', () => {
  it('replaces a presentation with the nearest new picture after its own dwell, never queueing', () => {
    const far = layout.slots[2]!; // same wall, far row: 5 m further along
    run(at(slot0), 1.2);
    expect(director.intent).toMatchObject({ photoId: slot0.photoId });

    // Walk part-way along the wall: slot0 is 3.1 m away (still open, inside 4.5 m), far is nearest.
    const between: Vec2 = {
      x: slot0.standingSpot.x,
      z: (slot0.position.z + far.position.z) / 2 - 0.4,
    };
    run(between, 0.5);
    expect(director.intent).toMatchObject({ photoId: slot0.photoId }); // not yet replaced
    run(between, 0.6);
    expect(director.intent).toMatchObject({ photoId: far.photoId });
  });

  it('picks the nearest picture when two zones overlap', () => {
    const between: Vec2 = { x: slot0.standingSpot.x + 0.8, z: slot0.position.z + 0.3 }; // closer to p0
    run(between, 1.2);
    expect(director.intent).toMatchObject({ photoId: slot0.photoId });
  });

  it('resets the dwell when the nearest candidate changes', () => {
    run(at(slot0), 0.7);
    run(at(slot1), 0.7);
    expect(director.intent.kind).toBe('none');
    run(at(slot1), 0.4);
    expect(director.intent).toMatchObject({ photoId: slot1.photoId });
  });

  it('exposes dwell progress for the floor pool', () => {
    run(at(slot0), 0.5);
    expect(director.dwell.photoId).toBe(slot0.photoId);
    expect(director.dwell.progress).toBeCloseTo(0.5, 1);
  });
});

describe('PresentationDirector: dismiss (A-19)', () => {
  it('suppresses the picture until the Visitor goes beyond 4.5 m, then presents again', () => {
    run(at(slot0), 1.2);
    director.dismiss();
    expect(director.intent.kind).toBe('none');
    run(at(slot0), 3);
    expect(director.intent.kind).toBe('none');
    run({ x: slot0.zonePoint.x + 4.6, z: slot0.zonePoint.z }, 0.2);
    run(at(slot0), 1.2);
    expect(director.intent).toMatchObject({ photoId: slot0.photoId });
  });
});

describe('PresentationDirector: finale (FR-29)', () => {
  const c = layout.finale.center;

  it('starts at once on the podium, keeps going to trigger + 1 m, then ends', () => {
    director.update(1 / 30, { x: c.x + 1.7, z: c.z });
    expect(director.intent.kind).toBe('finale');
    expect(director.finaleReached).toBe(true);
    director.update(1 / 30, { x: c.x + 2.7, z: c.z });
    expect(director.intent.kind).toBe('finale');
    director.update(1 / 30, { x: c.x + 2.9, z: c.z });
    expect(director.intent.kind).toBe('none');
  });

  it('can be dismissed with Keep exploring and returns after leaving the zone (US-14)', () => {
    director.update(1 / 30, c);
    director.dismiss();
    director.update(1 / 30, c);
    expect(director.intent.kind).toBe('none');
    director.update(1 / 30, { x: c.x + 3, z: c.z });
    director.update(1 / 30, c);
    expect(director.intent.kind).toBe('finale');
  });

  it('does not start from outside the trigger radius', () => {
    director.update(1 / 30, { x: c.x + 2, z: c.z });
    expect(director.intent.kind).toBe('none');
  });
});

describe('PresentationDirector: reset', () => {
  it('clears everything for Replay and jump', () => {
    run(at(slot0), 1.2);
    director.dismiss();
    director.reset();
    run(at(slot0), 1.2);
    expect(director.intent.kind).toBe('photo');
  });
});
