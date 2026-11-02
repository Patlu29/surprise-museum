import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERA_LIMITS } from '@/domain/camera/composition';
import { FollowCameraRig } from './FollowCameraRig';
import { ceilingOpacityFor, maxCameraHeight } from './ceilingFade';

const DEG = Math.PI / 180;

function rigAt(pitchDeg: number, boomOffset: number) {
  const rig = new FollowCameraRig(Math.PI, { x: 0, z: -4 }, { w: 1280, h: 720 });
  const camera = new PerspectiveCamera();
  rig.setViewport(camera, 1280, 720);
  rig.pitch = pitchDeg * DEG;
  rig.boomOffset = boomOffset;
  // Rigidly attached and teleported: no easing, so one update settles it.
  rig.update(0.016, camera, { x: 0, z: -4 }, true, [], [], true);
  return { rig, camera };
}

describe('follow camera height (ceiling cutaway, spec 6.3)', () => {
  it('keeps the camera at or under 2 m above the ceiling at the highest pitch and the longest boom', () => {
    const { camera } = rigAt(55, CAMERA_LIMITS.boomMax);
    expect(camera.position.y).toBeLessThanOrEqual(maxCameraHeight() + 1e-9);
    expect(camera.position.y).toBeGreaterThan(4.5); // still a real top view
  });

  it('leaves the default pose and the default-boom top view alone', () => {
    const def = rigAt(14, 0);
    expect(ceilingOpacityFor(def.camera.position.y)).toBe(1);
    const top = rigAt(55, 0);
    const boom = top.rig.composition.boom;
    expect(top.rig.follow.boom).toBeCloseTo(boom, 9);
    expect(top.camera.position.y).toBeCloseTo(0.9 + boom * Math.sin(55 * DEG), 6);
  });

  it('does not change the stored pitch or zoom, so lowering the pitch gives the zoom back', () => {
    const { rig, camera } = rigAt(55, CAMERA_LIMITS.boomMax);
    const wantedBoom = rig.composition.boom + rig.boomOffset;
    expect(rig.follow.boom).toBeLessThan(wantedBoom);
    expect(rig.pitch).toBeCloseTo(55 * DEG, 9);
    rig.pitch = 20 * DEG;
    rig.update(0.016, camera, { x: 0, z: -4 }, true, [], [], true);
    expect(rig.follow.boom).toBeCloseTo(CAMERA_LIMITS.boomMax, 9);
  });
});
