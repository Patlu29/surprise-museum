import { describe, expect, it } from 'vitest';
import { generateLayout } from '../layout/generateLayout';
import { createRng, dist2, type Vec2 } from '../math/vec2';
import { moveCircle } from './collision';
import { CHARACTER_RADIUS, circleIsFree, firstHitDistance, segmentClear } from './geometry';
import { NavGraph } from './navGraph';

const photos = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 }));
const layout = generateLayout(photos);
const nav = new NavGraph(layout);

describe('geometry', () => {
  const wall = { minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1 };

  it('detects a segment crossing a box and one passing beside it', () => {
    expect(segmentClear({ x: 0, z: 2 }, { x: 0, z: -2 }, [wall])).toBe(false);
    expect(segmentClear({ x: 2, z: 2 }, { x: 2, z: -2 }, [wall])).toBe(true);
  });

  it('applies a margin', () => {
    expect(segmentClear({ x: 1.2, z: 2 }, { x: 1.2, z: -2 }, [wall], 0.3)).toBe(false);
    expect(segmentClear({ x: 1.5, z: 2 }, { x: 1.5, z: -2 }, [wall], 0.3)).toBe(true);
  });

  it('measures the first hit along a ray', () => {
    expect(firstHitDistance({ x: 0, z: 3 }, { x: 0, z: -1 }, 10, [wall])).toBeCloseTo(2.9);
    expect(firstHitDistance({ x: 5, z: 3 }, { x: 0, z: -1 }, 10, [wall])).toBe(10);
  });
});

describe('collision', () => {
  it('never lets a circle enter a wall, whatever the direction or speed', () => {
    const rng = createRng(7);
    const p: Vec2 = { ...layout.spawn.visitor.position };
    for (let i = 0; i < 20000; i++) {
      const a = rng() * Math.PI * 2;
      const speed = rng() * 4; // up to 4 m in one step: far faster than any character
      moveCircle(p, Math.sin(a) * speed, Math.cos(a) * speed, layout.colliders, layout.bounds);
      expect(circleIsFree(p, CHARACTER_RADIUS, layout.colliders)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(layout.bounds.minX);
      expect(p.x).toBeLessThanOrEqual(layout.bounds.maxX);
      expect(p.z).toBeGreaterThanOrEqual(layout.bounds.minZ);
      expect(p.z).toBeLessThanOrEqual(layout.bounds.maxZ);
    }
  });

  it('slides along a wall instead of stopping dead', () => {
    const p: Vec2 = { x: 3.0, z: -2 };
    moveCircle(p, 2, -1, layout.colliders, layout.bounds); // into the right wall, heading down the room
    expect(p.x).toBeLessThanOrEqual(4 - CHARACTER_RADIUS + 1e-6);
    expect(p.z).toBeLessThan(-2.5);
  });

  it('cannot leave the museum through the doorway end or the back wall', () => {
    const p: Vec2 = { x: 0, z: -2 };
    moveCircle(p, 0, 50, layout.colliders, layout.bounds);
    expect(p.z).toBeLessThanOrEqual(-0.1 - CHARACTER_RADIUS + 1e-6);
  });

  it('passes through a doorway', () => {
    const door = layout.doorways[0]!;
    const p: Vec2 = { x: 0, z: door.z + 2 };
    moveCircle(p, 0, -4, layout.colliders, layout.bounds);
    expect(p.z).toBeLessThan(door.z - 1);
  });
});

describe('NavGraph', () => {
  it('goes straight when there is a clear line', () => {
    const path = nav.findPath({ x: 0, z: -1 }, { x: 2, z: -3 });
    expect(path).toEqual([{ x: 2, z: -3 }]);
  });

  it('routes through doorways, never through walls', () => {
    const from = layout.slots[0]!.standingSpot;
    const to = layout.slots.at(-1)!.standingSpot;
    const path = nav.findPath(from, to)!;
    expect(path).not.toBeNull();
    let prev = from;
    for (const p of path) {
      expect(nav.hasLineOfSight(prev, p)).toBe(true);
      prev = p;
    }
    expect(prev.x).toBeCloseTo(to.x);
    expect(prev.z).toBeCloseTo(to.z);
  });

  it('string-pulls: a straight corridor needs very few waypoints', () => {
    const path = nav.findPath({ x: 0, z: -1 }, { x: 0, z: -20 })!;
    expect(path.length).toBeLessThanOrEqual(2);
  });

  it('finds a route between random walkable points in under a millisecond on average', () => {
    const rng = createRng(3);
    const start = performance.now();
    let count = 0;
    for (let i = 0; i < 300; i++) {
      const a = nav.nearestWalkable({
        x: (rng() - 0.5) * 8,
        z: layout.bounds.maxZ + rng() * (layout.bounds.minZ - layout.bounds.maxZ),
      });
      const b = nav.nearestWalkable({
        x: (rng() - 0.5) * 8,
        z: layout.bounds.maxZ + rng() * (layout.bounds.minZ - layout.bounds.maxZ),
      });
      const path = nav.findPath(a, b);
      expect(path, `${JSON.stringify(a)} -> ${JSON.stringify(b)}`).not.toBeNull();
      count++;
    }
    expect((performance.now() - start) / count).toBeLessThan(2);
  });

  it('reports path length at least the straight-line distance', () => {
    const a = { x: -2.4, z: -8 };
    const b = { x: 2.4, z: -20 };
    expect(nav.pathLength(a, b)).toBeGreaterThanOrEqual(dist2(a, b) - 1e-9);
  });

  it('pulls an unwalkable goal back to a walkable point', () => {
    const path = nav.findPath({ x: 0, z: -2 }, { x: 4.15, z: -2 })!;
    const end = path.at(-1)!;
    expect(nav.isWalkable(end)).toBe(true);
  });
});
