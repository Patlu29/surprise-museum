import { describe, expect, it } from 'vitest';
import { generateLayout } from '../layout/generateLayout';
import { cameraPose, classifyViewport, computeComposition, occludedBoom } from './composition';

/** Project a point at height h above the feet to a vertical position from the top (0..1). */
function screenY(c: ReturnType<typeof computeComposition>, h: number): number {
  const pitch = (c.defaultPitchDeg * Math.PI) / 180;
  const pivot = { x: 0, y: c.pivotHeight, z: 0 };
  const pose = cameraPose(pivot, Math.PI, pitch, c.boom);
  // Camera basis: forward f, up u = world up made orthogonal to f.
  const f = pose.forward;
  const upRaw = { x: 0, y: 1, z: 0 };
  const dotUF = upRaw.y * f.y;
  const u = { x: -dotUF * f.x, y: 1 - dotUF * f.y, z: -dotUF * f.z };
  const ul = Math.hypot(u.x, u.y, u.z);
  const p = { x: 0 - pose.position.x, y: h - pose.position.y, z: 0 - pose.position.z };
  const depth = p.x * f.x + p.y * f.y + p.z * f.z;
  const up = (p.x * u.x + p.y * u.y + p.z * u.z) / ul;
  const ndc = up / depth / Math.tan((c.fovDeg * Math.PI) / 360) + c.viewOffsetY * 2;
  return (1 - ndc) / 2;
}

describe('camera composition (design spec 3.4)', () => {
  it.each([
    ['phone portrait 390x844', 390, 844, [0.24, 0.32], [0.7, 0.74]],
    ['phone portrait 360x640', 360, 640, [0.24, 0.32], [0.7, 0.74]],
    ['phone landscape 844x390', 844, 390, [0.42, 0.5], [0.78, 0.82]],
    ['desktop 1280x720', 1280, 720, [0.36, 0.44], [0.8, 0.84]],
  ])('%s keeps the Visitor within the target size and position', (_n, w, h, size, feet) => {
    const c = computeComposition(w, h);
    expect(c.fovDeg).toBeGreaterThanOrEqual(50);
    expect(c.fovDeg).toBeLessThanOrEqual(60);
    const feetY = screenY(c, 0);
    const headY = screenY(c, 1.7);
    expect(feetY - headY).toBeGreaterThanOrEqual(size![0]! - 0.01);
    expect(feetY - headY).toBeLessThanOrEqual(size![1]! + 0.01);
    expect(feetY).toBeGreaterThanOrEqual(feet![0]! - 0.01);
    expect(feetY).toBeLessThanOrEqual(feet![1]! + 0.01);
  });

  it('keeps the boom inside the desktop adjustable range', () => {
    for (const [w, h] of [
      [360, 640],
      [844, 390],
      [1280, 720],
      [1920, 1080],
    ] as const) {
      const c = computeComposition(w, h);
      expect(c.boom).toBeGreaterThanOrEqual(2.5);
      expect(c.boom).toBeLessThanOrEqual(6);
    }
  });

  it('classifies viewports', () => {
    expect(classifyViewport(390, 844)).toBe('phone-portrait');
    expect(classifyViewport(844, 390)).toBe('phone-landscape');
    expect(classifyViewport(1024, 768)).toBe('wide');
    expect(classifyViewport(800, 1200)).toBe('wide');
  });
});

describe('camera pose and occlusion', () => {
  const layout = generateLayout([{ id: 'a', width: 1, height: 1 }]);

  it('sits behind the pivot looking along the yaw', () => {
    const pose = cameraPose({ x: 0, y: 1, z: -5 }, Math.PI, 0.25, 4);
    expect(pose.position.z).toBeGreaterThan(-5); // behind, since facing -Z
    expect(pose.position.y).toBeGreaterThan(1);
    expect(pose.forward.z).toBeLessThan(0);
  });

  it('shortens the boom when a wall is behind the Visitor, to at most 1.2 m', () => {
    // Visitor close to the back wall at z=0, camera behind her.
    const boom = occludedBoom({ x: 0, z: -1.0 }, Math.PI, 0.25, 5, layout.colliders);
    expect(boom).toBeLessThan(5);
    expect(boom).toBeGreaterThanOrEqual(1.2);
  });

  it('lets the camera sit behind a partition, which the scene fades (design spec 6.3)', () => {
    // First gallery, near row: the camera would be in the entrance hall, behind the partition.
    const partition = layout.partitions[0]!;
    const pivot = { x: -2.4, z: partition.z - 2.5 };
    const hardOnly = occludedBoom(pivot, Math.PI, 0.244, 4.7, layout.hardColliders);
    const withAll = occludedBoom(pivot, Math.PI, 0.244, 4.7, layout.colliders);
    expect(hardOnly).toBeCloseTo(4.7, 1); // full boom, so she keeps her on-screen size
    expect(withAll).toBeLessThan(3); // the old behaviour: shortened, Visitor fills the screen
  });

  it('still keeps the camera out of a partition wall itself', () => {
    const partition = layout.partitions[0]!;
    // Aim the camera end right at the partition plane, away from the doorway.
    const pivot = { x: -2.4, z: partition.z - 3.9 };
    const boom = occludedBoom(pivot, Math.PI, 0.244, 4, layout.hardColliders, partition.colliders);
    const horizontal = boom * Math.cos(0.244);
    expect(pivot.z + horizontal).toBeLessThan(partition.z - 0.1 - 0.25);
  });

  it('keeps the outer walls hard', () => {
    // Behind the Visitor is the back wall of the entrance hall.
    const boom = occludedBoom(
      { x: 0, z: -1.0 },
      Math.PI,
      0.25,
      5,
      layout.hardColliders,
      layout.partitions.flatMap((p) => p.colliders),
    );
    expect(boom).toBeLessThan(2);
  });

  it('leaves the boom alone with clear space behind', () => {
    expect(occludedBoom({ x: 0, z: -4 }, Math.PI, 0.25, 3, layout.colliders)).toBe(3);
  });
});
