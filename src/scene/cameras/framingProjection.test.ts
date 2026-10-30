import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { computeComposition } from '@/domain/camera/composition';
import { makeCameraModel, projectToScreen } from '@/domain/camera/presentationFraming';

const VIEWPORTS = [
  [360, 640],
  [390, 844],
  [844, 390],
  [1280, 720],
] as const;

describe('camera model', () => {
  it('projects exactly as three.js does, including the constant view offset', () => {
    for (const [w, h] of VIEWPORTS) {
      const c = computeComposition(w, h);
      const cam = new PerspectiveCamera(c.fovDeg, w / h, 0.1, 100);
      cam.setViewOffset(w, h, 0, c.viewOffsetY * h, w, h);
      cam.position.set(-1.5, 2.4, -9);
      cam.lookAt(-3.2, 1.0, -14.6);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      const dir = new Vector3(-3.2 + 1.5, 1.0 - 2.4, -14.6 + 9).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = -Math.asin(dir.y);
      const model = makeCameraModel(cam.position, yaw, pitch, c.fovDeg, c.viewOffsetY, w, h);
      for (const p of [
        [-3.2, 1.0, -14.6],
        [-4, 1.55, -15.5],
        [-2.4, 0, -14.2],
        [-2.4, 1.7, -13.9],
      ] as const) {
        const ndc = new Vector3(...p).project(cam);
        const out = { x: 0, y: 0 };
        expect(projectToScreen(model, p[0], p[1], p[2], out)).toBe(true);
        expect(out.x).toBeCloseTo((ndc.x * 0.5 + 0.5) * w, 1);
        expect(out.y).toBeCloseTo((-ndc.y * 0.5 + 0.5) * h, 1);
      }
    }
  });
});
