import { Color, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { LAYOUT } from '@/domain/layout/constants';
import { generateLayout } from '@/domain/layout/generateLayout';
import type { MuseumLayout } from '@/domain/layout/types';
import { CEILING_STRIP } from '../materials/geometry/walls';
import { LOOK } from '../materials/look';
import { buildMuseumDressing } from './museumDressing';

/** Photo counts that cover every room shape: none, small galleries (6 m), full galleries (10 m). */
const COUNTS = [0, 1, 3, 4, 5, 8, 9, 20];

function layoutFor(n: number): MuseumLayout {
  return generateLayout(
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 })),
  );
}

interface Extent {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

/**
 * The lit faces of every ceiling strip in the merged ceiling geometry, one extent per room. The strip
 * is the only emissive part in `LOOK.ceilingStrip` (the rose lamp is a different colour).
 */
function stripExtents(geometry: BufferGeometry, layout: MuseumLayout): Map<number, Extent> {
  const pos = geometry.getAttribute('position');
  const col = geometry.getAttribute('color');
  const glow = geometry.getAttribute('aGlow');
  const lit = new Color(LOOK.ceilingStrip);
  const out = new Map<number, Extent>();
  for (let i = 0; i < pos.count; i++) {
    const isStrip =
      glow.getX(i) > 0.5 &&
      Math.abs(col.getX(i) - lit.r) < 1e-4 &&
      Math.abs(col.getY(i) - lit.g) < 1e-4 &&
      Math.abs(col.getZ(i) - lit.b) < 1e-4;
    if (!isStrip) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const roomIndex = layout.rooms.findIndex((r) => z >= r.bounds.minZ && z <= r.bounds.maxZ);
    const e = out.get(roomIndex) ?? { minX: x, maxX: x, minZ: z, maxZ: z, y: pos.getY(i) };
    e.minX = Math.min(e.minX, x);
    e.maxX = Math.max(e.maxX, x);
    e.minZ = Math.min(e.minZ, z);
    e.maxZ = Math.max(e.maxZ, z);
    out.set(roomIndex, e);
  }
  return out;
}

describe('ceiling strip position (spec 12.8.3, v2.0.1: toward the exit)', () => {
  it.each(COUNTS)('is on the exit side of the rose and clear of everything, %i photos', (n) => {
    const layout = layoutFor(n);
    const dressing = buildMuseumDressing(layout);
    const strips = stripExtents(dressing.ceilingDressing, layout);
    const routeRooms = layout.rooms.filter((r) => r.kind !== 'finale');
    expect(strips.size).toBe(routeRooms.length);

    layout.rooms.forEach((room, roomIndex) => {
      const strip = strips.get(roomIndex);
      if (room.kind === 'finale') {
        expect(strip, 'the finale has an oculus, not a strip').toBeUndefined();
        return;
      }
      expect(strip).toBeDefined();
      if (!strip) return;
      const depth = room.bounds.maxZ - room.bounds.minZ;
      const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;
      const offset = Math.min(depth * 0.3, 2.4);

      // Centre: exactly `offset` toward -Z (the exit), on the room's centre line.
      expect((strip.minZ + strip.maxZ) / 2).toBeCloseTo(cz - offset, 5);
      expect(strip.maxZ - strip.minZ).toBeCloseTo(CEILING_STRIP.length, 5);
      expect((strip.minX + strip.maxX) / 2).toBeCloseTo(0, 5);
      expect(strip.y).toBeGreaterThan(LAYOUT.wallHeight - 0.05);
      expect(strip.y).toBeLessThanOrEqual(LAYOUT.wallHeight);

      // Rose: its 0.4 m disc at the room centre stays clear, with a gap of at least 0.5 m.
      expect(cz - strip.maxZ).toBeGreaterThan(0.4 + 0.5);

      // Inside the room, with a margin from the entrance wall and from the doorway wall ahead.
      expect(strip.maxZ).toBeLessThan(room.bounds.maxZ - 0.5);
      expect(strip.minZ).toBeGreaterThan(room.bounds.minZ + 0.5);
      for (const door of layout.doorways) {
        const zClear = Math.min(Math.abs(strip.minZ - door.z), Math.abs(strip.maxZ - door.z));
        // The strip is on the ceiling, 0.5 m above the 2.7 m door head, so this is a plan margin.
        if (strip.minZ <= door.z && strip.maxZ >= door.z)
          throw new Error('strip crosses a doorway');
        expect(zClear).toBeGreaterThan(0.5);
      }

      // Every standing spot, plinth and character start is far from the strip in plan.
      const nearest = (x: number, z: number): number => {
        const dx = Math.max(strip.minX - x, 0, x - strip.maxX);
        const dz = Math.max(strip.minZ - z, 0, z - strip.maxZ);
        return Math.hypot(dx, dz);
      };
      for (const slot of layout.slots.filter((s) => s.roomIndex === roomIndex)) {
        expect(nearest(slot.standingSpot.x, slot.standingSpot.z)).toBeGreaterThan(2);
      }
      expect(nearest(layout.finale.center.x, layout.finale.center.z)).toBeGreaterThan(
        layout.finale.radius,
      );
    });

    // The entrance strip leads ahead of the Visitor: it is wholly beyond her spawn point.
    const entrance = strips.get(0);
    expect(entrance?.maxZ).toBeLessThan(layout.spawn.visitor.position.z);
    dressing.dispose();
  });
});
