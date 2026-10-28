import { describe, expect, it } from 'vitest';
import { dist2 } from '../math/vec2';
import { NavGraph } from '../navigation/navGraph';
import { LAYOUT } from './constants';
import { fitPhoto, generateLayout } from './generateLayout';
import type { PhotoInput } from './types';

function photos(n: number, w = 1600, h = 1200): PhotoInput[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, width: w, height: h }));
}

describe('generateLayout', () => {
  it('is deterministic', () => {
    const a = generateLayout(photos(13));
    const b = generateLayout(photos(13));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('rejects more than 20 photos', () => {
    expect(() => generateLayout(photos(21))).toThrow(RangeError);
  });

  it.each(Array.from({ length: 20 }, (_, i) => i + 1))('lays out %i photo(s)', (n) => {
    const layout = generateLayout(photos(n));
    const galleries = Math.ceil(n / 4);

    // Entrance, galleries, finale.
    expect(layout.rooms).toHaveLength(galleries + 2);
    expect(layout.rooms[0]?.kind).toBe('entrance');
    expect(layout.rooms.at(-1)?.kind).toBe('finale');
    expect(layout.slots).toHaveLength(n);

    // Creator's order is kept, photos alternate between walls.
    layout.slots.forEach((slot, i) => {
      expect(slot.photoId).toBe(`p${i}`);
      expect(slot.index).toBe(i);
      expect(slot.wall).toBe(i % 2 === 0 ? 'left' : 'right');
    });

    // Rooms are chained without gaps along -Z.
    for (let i = 1; i < layout.rooms.length; i++) {
      expect(layout.rooms[i]?.bounds.maxZ).toBeCloseTo(layout.rooms[i - 1]?.bounds.minZ ?? NaN);
    }

    // Length: entrance 7.5 m + rooms + finale 8 m, at most 65.5 m for 20 photos (about 41 s).
    const length = layout.rooms[0]!.bounds.maxZ - layout.rooms.at(-1)!.bounds.minZ;
    expect(length).toBeLessThanOrEqual(65.5);

    // One doorway per internal wall.
    expect(layout.doorways).toHaveLength(layout.rooms.length - 1);
  });

  it('uses 10 m rooms for 3 or 4 photos and 6 m rooms for 1 or 2', () => {
    const depth = (n: number) => {
      const room = generateLayout(photos(n)).rooms[1]!;
      return room.bounds.maxZ - room.bounds.minZ;
    };
    expect(depth(1)).toBe(6);
    expect(depth(2)).toBe(6);
    expect(depth(3)).toBe(10);
    expect(depth(4)).toBe(10);
  });

  it('puts slots at the specified near and far rows', () => {
    const layout = generateLayout(photos(4));
    const room = layout.rooms[1]!;
    const [a, b, c, d] = layout.slots;
    expect(a!.position.z).toBeCloseTo(room.bounds.maxZ - 2.5);
    expect(b!.position.z).toBeCloseTo(room.bounds.maxZ - 2.5);
    expect(c!.position.z).toBeCloseTo(room.bounds.maxZ - 7.5);
    expect(d!.position.z).toBeCloseTo(room.bounds.maxZ - 7.5);
    expect(a!.normal).toEqual({ x: 1, z: 0 });
    expect(b!.normal).toEqual({ x: -1, z: 0 });
    expect(a!.zonePoint.x).toBeCloseTo(-4 + 0.3);
    expect(b!.zonePoint.x).toBeCloseTo(4 - 0.3);

    const small = generateLayout(photos(1));
    expect(small.slots[0]!.position.z).toBeCloseTo(small.rooms[1]!.bounds.maxZ - 3);
  });

  it('keeps the walls 8 m apart so the centre line is outside every 3 m zone', () => {
    const layout = generateLayout(photos(20));
    for (const slot of layout.slots) {
      expect(dist2({ x: 0, z: slot.zonePoint.z }, slot.zonePoint)).toBeGreaterThan(3);
    }
  });

  it('fits every photo inside 1.6 by 1.4 m at its own aspect ratio', () => {
    const cases: Array<[number, number]> = [
      [4000, 3000],
      [3000, 4000],
      [1000, 1000],
      [4000, 1000],
      [1000, 4000],
    ];
    for (const [w, h] of cases) {
      const f = fitPhoto(w, h);
      expect(f.width).toBeLessThanOrEqual(1.6 + 1e-9);
      expect(f.height).toBeLessThanOrEqual(1.4 + 1e-9);
      expect(f.width / f.height).toBeCloseTo(w / h);
    }
    // Degenerate sizes fall back to 4:3 instead of producing NaN.
    expect(fitPhoto(0, 0).width).toBeGreaterThan(0);
  });

  it('places the finale podium with the specified radii and a solid lectern', () => {
    const layout = generateLayout(photos(5));
    expect(layout.finale.radius).toBe(1.5);
    expect(layout.finale.triggerRadius).toBe(1.8);
    expect(layout.finale.exitRadius).toBeCloseTo(2.8);
    const finaleRoom = layout.rooms.at(-1)!;
    expect(layout.finale.center.z).toBeCloseTo(
      (finaleRoom.bounds.minZ + finaleRoom.bounds.maxZ) / 2 - 1,
    );
    expect(layout.colliders).toContainEqual(layout.finale.lectern);
  });

  it('spawns the Visitor and Guide in the entrance hall facing the route', () => {
    const layout = generateLayout(photos(3));
    expect(layout.spawn.visitor.position).toEqual(LAYOUT.spawnVisitor);
    expect(layout.spawn.guide.position).toEqual(LAYOUT.spawnGuide);
    expect(layout.spawn.visitor.heading).toBeCloseTo(Math.PI);
    const nav = new NavGraph(layout);
    expect(nav.isWalkable(layout.spawn.visitor.position)).toBe(true);
    expect(nav.isWalkable(layout.spawn.guide.position)).toBe(true);
  });

  it('has a connected navigation graph reaching every standing spot and the podium', () => {
    for (const n of [1, 4, 5, 9, 13, 20]) {
      const layout = generateLayout(photos(n));
      const nav = new NavGraph(layout);
      const from = layout.spawn.visitor.position;
      for (const slot of layout.slots) {
        expect(nav.isWalkable(slot.standingSpot), `slot ${slot.index} of ${n}`).toBe(true);
        expect(
          nav.findPath(from, slot.standingSpot),
          `path to slot ${slot.index} of ${n}`,
        ).not.toBeNull();
      }
      expect(nav.findPath(from, layout.finale.center)).not.toBeNull();
      expect(layout.navGraph.nodes.length).toBeLessThan(140);
    }
  });

  it('lists partitions with their colliders, and keeps them out of the hard colliders', () => {
    const layout = generateLayout(photos(8));
    expect(layout.partitions).toHaveLength(layout.doorways.length);
    for (const p of layout.partitions) {
      expect(p.colliders).toHaveLength(2);
      for (const c of p.colliders) {
        expect(layout.colliders).toContain(c);
        expect(layout.hardColliders).not.toContain(c);
      }
    }
    expect(layout.hardColliders).toContainEqual(layout.finale.lectern);
    expect(layout.hardColliders.length + layout.partitions.length * 2).toBe(
      layout.colliders.length,
    );
  });

  it('supports an empty museum (entrance and finale only)', () => {
    const layout = generateLayout([]);
    expect(layout.rooms.map((r) => r.kind)).toEqual(['entrance', 'finale']);
    expect(layout.slots).toHaveLength(0);
  });

  it('exposes the doorway width from the specification', () => {
    expect(LAYOUT.doorWidth).toBe(2.4);
    expect(generateLayout(photos(1)).doorways.every((d) => d.width === 2.4)).toBe(true);
  });
});
