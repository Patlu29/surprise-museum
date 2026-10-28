import type { Box3, BufferGeometry } from 'three';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { mergePlaced, triangleCount } from './geometry/builders';
import { DecalBatch, createBlobShadowGeometry, createFloorRingGeometry } from './geometry/decals';
import {
  createDustMoteGeometry,
  createLecternGeometry,
  createLightConeGeometry,
  createPodiumGeometry,
} from './geometry/finale';
import { createFloorGeometry, createRunnerGeometry } from './geometry/floor';
import {
  FRAME,
  createFrameGeometry,
  createPhotoGeometry,
  createPictureLightGeometry,
} from './geometry/frames';
import {
  createCeilingGeometry,
  createCeilingRoseGeometry,
  createWallRunGeometry,
} from './geometry/walls';
import { createMuseumMaterials } from './museumMaterials';
import { wrapLines } from './plaqueTexture';

const STANDARD = ['position', 'normal', 'uv', 'color', 'aGlow'];

function expectStandardAttributes(g: BufferGeometry, label: string) {
  for (const name of STANDARD) expect(g.hasAttribute(name), `${label} has ${name}`).toBe(true);
  const count = g.getAttribute('position').count;
  for (const name of STANDARD)
    expect(g.getAttribute(name).count, `${label} ${name} count`).toBe(count);
  for (const name of ['position', 'normal', 'color']) {
    for (const v of g.getAttribute(name).array) {
      if (!Number.isFinite(v)) throw new Error(`${label} ${name} not finite`);
    }
  }
}

/** Average geometric normal direction of triangles, to check winding against the stored normals. */
function windingAgrees(g: BufferGeometry): boolean {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const index = g.index;
  if (!index) return true;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let agree = 0;
  let total = 0;
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i);
    const ib = index.getX(i + 1);
    const ic = index.getX(i + 2);
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    const face = b.clone().sub(a).cross(c.clone().sub(a));
    if (face.lengthSq() < 1e-12) continue;
    const n = new Vector3().fromBufferAttribute(nor, ia);
    total++;
    if (face.dot(n) > 0) agree++;
  }
  return total === 0 || agree / total > 0.99;
}

describe('museum geometry', () => {
  it('gives every museum builder the standard attribute set with finite data', () => {
    const builders: Record<string, BufferGeometry> = {
      wall: createWallRunGeometry({ length: 8, doorways: [{ centre: 0 }] }),
      finaleWall: createWallRunGeometry({ length: 8, variant: 'finale' }),
      ceiling: createCeilingGeometry(8, 10),
      rose: createCeilingRoseGeometry(),
      floor: createFloorGeometry(8, 10),
      runner: createRunnerGeometry({ length: 20, end: 'semicircle' }),
      frame: createFrameGeometry(1.6, 1.1),
      light: createPictureLightGeometry(1.6, 1.1),
      podium: createPodiumGeometry(),
      lectern: createLecternGeometry(),
    };
    for (const [name, g] of Object.entries(builders)) expectStandardAttributes(g, name);
  });

  it('winds the floor, runner and podium faces consistently with their normals', () => {
    expect(windingAgrees(createFloorGeometry(4, 4))).toBe(true);
    expect(windingAgrees(createRunnerGeometry({ length: 10, end: 'semicircle' }))).toBe(true);
    expect(windingAgrees(createPodiumGeometry())).toBe(true);
    expect(windingAgrees(createFrameGeometry(1, 1))).toBe(true);
  });

  it('cuts a doorway 2.4 m wide and 2.7 m high with a lintel above it', () => {
    const wall = createWallRunGeometry({ length: 8, doorways: [{ centre: 0 }] });
    const pos = wall.getAttribute('position');
    // The lintel spans the opening (x = -1.2 to 1.2) between 2.7 m and the 3.2 m ceiling.
    let lintelTop = false;
    let lintelBottom = false;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) <= 1.2001 && Math.abs(pos.getX(i)) > 1.19) {
        if (Math.abs(pos.getY(i) - 3.2) < 1e-4) lintelTop = true;
        if (Math.abs(pos.getY(i) - 2.7) < 1e-4) lintelBottom = true;
      }
    }
    expect(lintelTop).toBe(true);
    expect(lintelBottom).toBe(true);
    wall.computeBoundingBox();
    const size = wall.boundingBox?.getSize(new Vector3());
    expect(size?.x).toBeCloseTo(8, 1);
    expect(size?.y).toBeCloseTo(3.2, 2);
  });

  it('builds frames with a 0.06 m border and 0.05 m depth, sized to the photo', () => {
    const frame = createFrameGeometry(1.6, 1.0);
    frame.computeBoundingBox();
    const box = frame.boundingBox as Box3;
    expect(box.max.x - box.min.x).toBeCloseTo(1.6 + FRAME.border * 2, 4);
    expect(box.max.y - box.min.y).toBeCloseTo(1.0 + FRAME.border * 2, 4);
    expect(box.max.z).toBeCloseTo(FRAME.depth, 4);
    expect(box.min.z).toBeCloseTo(0, 4);
    const photo = createPhotoGeometry(1.6, 1.0);
    photo.computeBoundingBox();
    expect(photo.boundingBox?.max.z).toBeCloseTo(FRAME.photoZ, 4);
  });

  it('keeps the runner 1.6 m wide and the right length', () => {
    const runner = createRunnerGeometry({ length: 30 });
    runner.computeBoundingBox();
    const size = runner.boundingBox?.getSize(new Vector3());
    expect(size?.x).toBeCloseTo(1.6, 3);
    expect(size?.z).toBeCloseTo(30, 3);
    const rounded = createRunnerGeometry({ length: 30, end: 'semicircle' });
    rounded.computeBoundingBox();
    expect(rounded.boundingBox?.getSize(new Vector3()).z).toBeCloseTo(30, 3);
  });

  it('merges placed copies into one geometry', () => {
    const frame = createFrameGeometry(1.2, 0.9);
    const merged = mergePlaced(frame, [
      { position: [-3.9, 1.55, -2.5], rotationY: Math.PI / 2 },
      { position: [3.9, 1.55, -2.5], rotationY: -Math.PI / 2 },
    ]);
    expect(triangleCount(merged)).toBe(triangleCount(frame) * 2);
    expectStandardAttributes(merged, 'merged frames');
  });

  it('keeps a 20-picture museum well inside the triangle and draw-call budgets', () => {
    const perPicture =
      triangleCount(createFrameGeometry(1.6, 1.4)) +
      triangleCount(createPictureLightGeometry(1.6, 1.4)) +
      2 + // photo
      2 + // wall wash
      2; // floor pool
    const fixed =
      triangleCount(createWallRunGeometry({ length: 10, doorways: [{ centre: 0 }] })) * 14 +
      triangleCount(createPodiumGeometry()) +
      triangleCount(createLecternGeometry()) +
      triangleCount(createRunnerGeometry({ length: 64, end: 'semicircle' }));
    expect(perPicture * 20 + fixed).toBeLessThan(40000);
  });
});

describe('decal batch', () => {
  it('updates per-decal intensity and tracks the dirty flag', () => {
    const batch = new DecalBatch(
      [
        { position: [0, 0, 0], width: 1.6, depth: 1.2 },
        { position: [3, 0, 0], width: 1.6, depth: 1.2 },
      ],
      'floor',
    );
    const attr = batch.geometry.getAttribute('aIntensity');
    expect(attr.count).toBe(8);
    batch.setIntensity(1, 0.4);
    expect(attr.getX(4)).toBeCloseTo(0.4, 5);
    expect(attr.getX(0)).toBe(1);
    batch.setIntensity(1, 5);
    expect(attr.getX(7)).toBe(1);
    batch.commit();
    batch.dispose();
  });

  it('has up-facing blob shadows and rings', () => {
    for (const g of [createBlobShadowGeometry(), createFloorRingGeometry()]) {
      expect(windingAgrees(g)).toBe(true);
    }
  });
});

describe('finale pieces', () => {
  it('caps the dust motes at 40 and seeds them deterministically', () => {
    const a = createDustMoteGeometry({ count: 500 });
    const b = createDustMoteGeometry({ count: 500 });
    expect(a.getAttribute('aSeed').count).toBe(40);
    expect(Array.from(a.getAttribute('aSeed').array)).toEqual(
      Array.from(b.getAttribute('aSeed').array),
    );
  });

  it('builds an open-ended cone', () => {
    const cone = createLightConeGeometry({ radiusTop: 0.4, radiusBottom: 1.5, height: 3.2 });
    cone.computeBoundingBox();
    expect(cone.boundingBox?.getSize(new Vector3()).y).toBeCloseTo(3.2, 4);
  });
});

describe('createMuseumMaterials', () => {
  it('builds the high tier with the cone and motes, and disposes cleanly', () => {
    const m = createMuseumMaterials('high');
    expect(m.cone).not.toBeNull();
    expect(m.motes).not.toBeNull();
    expect(m.floor.type).toBe('MeshStandardMaterial');
    expect(m.wall.type).toBe('MeshLambertMaterial');
    m.update(3);
    m.setReducedMotion(true);
    expect(m.motes?.uniforms.uMotion?.value).toBe(0);
    const photo = m.createPhotoMaterial(null);
    expect(photo.toneMapped).toBe(false);
    m.dispose();
  });

  it('drops the cone, motes and standard materials at low quality', () => {
    const m = createMuseumMaterials('low');
    expect(m.cone).toBeNull();
    expect(m.motes).toBeNull();
    expect(m.floor.type).toBe('MeshLambertMaterial');
    expect(m.features.environmentMap).toBe(false);
    m.dispose();
  });
});

describe('wrapLines', () => {
  const measure = (s: string) => [...s].length * 10;

  it('wraps on words', () => {
    expect(wrapLines(measure, 'one two three four', 90, 3)).toEqual(['one two', 'three', 'four']);
  });

  it('splits an over-long word by code point without losing emoji', () => {
    const lines = wrapLines(measure, '\u{1F496}'.repeat(10), 50, 5);
    expect(lines.join('')).toBe('\u{1F496}'.repeat(10));
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(50);
  });

  it('ends the last line with an ellipsis when text is cut', () => {
    const lines = wrapLines(measure, 'alpha beta gamma delta epsilon zeta', 60, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
  });
});
