import { describe, expect, it } from 'vitest';
import { generateLayout } from '@/domain/layout/generateLayout';
import { NavGraph } from '@/domain/navigation/navGraph';
import { computeHint } from './hint';

const layout = generateLayout(
  Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 })),
);
const nav = new NavGraph(layout);
const spawn = layout.spawn.visitor.position;

describe('computeHint (FR-32)', () => {
  it('points at the nearest picture not yet viewed', () => {
    const hint = computeHint(layout, nav, spawn, new Set(), Math.PI);
    expect(hint.target).toEqual({ kind: 'photo', photoId: 'p0' });
    // Camera looks down the route, and the first picture is ahead and to the left.
    expect(hint.bearingDeg).toBeGreaterThan(270);
    expect(hint.distanceM).toBeGreaterThan(3);
  });

  it('skips viewed pictures', () => {
    const hint = computeHint(layout, nav, spawn, new Set(['p0', 'p1']), Math.PI);
    expect(hint.target).toEqual({ kind: 'photo', photoId: 'p2' });
  });

  it('points at the finale once every picture has been viewed', () => {
    const all = new Set(layout.slots.map((s) => s.photoId));
    expect(computeHint(layout, nav, spawn, all, Math.PI).target).toEqual({ kind: 'finale' });
  });

  it('measures the bearing from the camera heading: 90 is to the right, 180 is behind', () => {
    // Stand in the first gallery, facing the route: the finale is straight ahead (about 0 degrees).
    const mid = { x: 0, z: layout.rooms[1]!.bounds.maxZ - 3 };
    const all = new Set(layout.slots.map((s) => s.photoId));
    const ahead = computeHint(layout, nav, mid, all, Math.PI);
    expect(Math.min(ahead.bearingDeg, 360 - ahead.bearingDeg)).toBeLessThan(5);
    const behind = computeHint(layout, nav, mid, all, 0);
    expect(behind.bearingDeg).toBeGreaterThan(175);
    expect(behind.bearingDeg).toBeLessThan(185);
  });
});
