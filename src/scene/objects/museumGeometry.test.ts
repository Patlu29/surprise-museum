import { describe, expect, it } from 'vitest';
import { generateLayout } from '@/domain/layout/generateLayout';
import { LAYOUT } from '@/domain/layout/constants';
import { Color } from 'three';
import { SCENE_PALETTE } from '../materials/palette';
import { buildMuseumShell } from './museumGeometry';

const layout = generateLayout(
  Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, width: 1000, height: 800 })),
);

describe('museum shell ceilings (spec 6.3 cutaway)', () => {
  const shell = buildMuseumShell(layout);
  const g = shell.ceilings;
  const pos = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  const index = g.getIndex();

  it('is one flat quad per room, at the wall height, with no thickness', () => {
    expect(pos.count).toBe(layout.rooms.length * 4);
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeCloseTo(LAYOUT.wallHeight, 5);
  });

  it('faces down: normals and triangle winding, so a front-side material is culled from above', () => {
    for (let i = 0; i < normal.count; i++) expect(normal.getY(i)).toBeCloseTo(-1, 9);
    expect(index).not.toBeNull();
    // Geometric normal of every triangle, from the winding (counter-clockwise seen from the front).
    for (let t = 0; t < (index?.count ?? 0); t += 3) {
      const [a, b, c] = [index!.getX(t), index!.getX(t + 1), index!.getX(t + 2)] as [
        number,
        number,
        number,
      ];
      const e1 = [
        pos.getX(b) - pos.getX(a),
        pos.getY(b) - pos.getY(a),
        pos.getZ(b) - pos.getZ(a),
      ] as const;
      const e2 = [
        pos.getX(c) - pos.getX(a),
        pos.getY(c) - pos.getY(a),
        pos.getZ(c) - pos.getZ(a),
      ] as const;
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      expect(ny, `triangle ${t / 3}`).toBeLessThan(0);
    }
  });

  it('covers each room exactly (no gap and no overlap in plan)', () => {
    let area = 0;
    for (let t = 0; t < (index?.count ?? 0); t += 3) {
      const [a, b, c] = [index!.getX(t), index!.getX(t + 1), index!.getX(t + 2)] as [
        number,
        number,
        number,
      ];
      const e1x = pos.getX(b) - pos.getX(a);
      const e1z = pos.getZ(b) - pos.getZ(a);
      const e2x = pos.getX(c) - pos.getX(a);
      const e2z = pos.getZ(c) - pos.getZ(a);
      area += Math.abs(e1x * e2z - e1z * e2x) / 2;
    }
    const expected = layout.rooms.reduce(
      (sum, r) => sum + 2 * LAYOUT.halfWidth * (r.bounds.maxZ - r.bounds.minZ),
      0,
    );
    expect(area).toBeCloseTo(expected, 6);
  });

  it('is coloured from the palette ceiling colour (spec 6.3: --scene-ceiling)', () => {
    const colour = g.getAttribute('color');
    expect(colour).toBeDefined();
    const expected = new Color(SCENE_PALETTE.ceiling);
    for (let i = 0; i < colour.count; i++) {
      expect(colour.getX(i)).toBeCloseTo(expected.r, 5);
      expect(colour.getY(i)).toBeCloseTo(expected.g, 5);
      expect(colour.getZ(i)).toBeCloseTo(expected.b, 5);
    }
  });
});
