import { AVATAR_OPTIONS } from '@contract';
import type { AvatarConfig } from '@contract';
import { Box3, SkinnedMesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GUIDE_APPEARANCE, DEFAULT_VISITOR_APPEARANCE, describeAvatar } from './options';
import { createAvatarRig } from './rig';

const TRIANGLE_BUDGET = 6000;
const DRAW_CALL_BUDGET = 10;

function withConfig(patch: Partial<AvatarConfig>, base = DEFAULT_GUIDE_APPEARANCE): AvatarConfig {
  return { ...base, ...patch };
}

function boundsOf(rig: ReturnType<typeof createAvatarRig>): Box3 {
  const box = new Box3();
  rig.root.updateMatrixWorld(true);
  rig.root.traverse((o) => {
    if (o instanceof SkinnedMesh && o.name !== 'blob-shadow') {
      o.skeleton.update();
      const p = o.geometry.getAttribute('position');
      const v = new Vector3();
      for (let i = 0; i < p.count; i++) {
        o.getVertexPosition(i, v);
        v.applyMatrix4(o.matrixWorld);
        box.expandByPoint(v);
      }
    }
  });
  return box;
}

describe('avatar rig', () => {
  it('stays within the triangle and draw-call budgets for every hair style and outfit', () => {
    let worst = 0;
    for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
      for (const outfitStyle of AVATAR_OPTIONS.outfitStyle) {
        for (const facialHair of AVATAR_OPTIONS.facialHair) {
          const rig = createAvatarRig(
            withConfig({ hairStyle, outfitStyle, facialHair, bodyType: 'broad' }),
            {
              role: 'guide',
            },
          );
          worst = Math.max(worst, rig.stats.triangles);
          expect(
            rig.stats.triangles,
            `${hairStyle}/${outfitStyle}/${facialHair}`,
          ).toBeLessThanOrEqual(TRIANGLE_BUDGET);
          expect(rig.stats.drawCalls).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
          rig.dispose();
        }
      }
    }
    expect(worst).toBeGreaterThan(1000);
  });

  it('is about 1.70 m tall at medium and scales to 0.91 and 1.09', () => {
    const expected = { short: 1.7 * 0.91, medium: 1.7, tall: 1.7 * 1.09 } as const;
    for (const height of AVATAR_OPTIONS.height) {
      const rig = createAvatarRig(withConfig({ height, hairStyle: 'short-crop' }), {
        role: 'guide',
      });
      const box = boundsOf(rig);
      expect(box.max.y).toBeGreaterThan(expected[height] - 0.06);
      expect(box.max.y).toBeLessThan(expected[height] + 0.1);
      expect(box.min.y).toBeGreaterThan(-0.02);
      expect(rig.height).toBeCloseTo(expected[height], 5);
      rig.dispose();
    }
  });

  it('keeps the head the same size across body types', () => {
    const heights = AVATAR_OPTIONS.bodyType.map((bodyType) => {
      const rig = createAvatarRig(withConfig({ bodyType, hairStyle: 'shaved' }), {
        role: 'visitor',
      });
      const box = boundsOf(rig);
      rig.dispose();
      return box.max.y;
    });
    for (const h of heights) expect(h).toBeCloseTo(heights[0] as number, 3);
  });

  it('produces finite vertex data for all skin tones and body types', () => {
    for (const skinTone of AVATAR_OPTIONS.skinTone) {
      for (const bodyType of AVATAR_OPTIONS.bodyType) {
        const rig = createAvatarRig(
          withConfig({ skinTone, bodyType }, DEFAULT_VISITOR_APPEARANCE),
          { role: 'visitor' },
        );
        rig.root.traverse((o) => {
          if (o instanceof SkinnedMesh) {
            for (const name of ['position', 'normal', 'color']) {
              const arr = o.geometry.getAttribute(name).array;
              for (let i = 0; i < arr.length; i++) {
                if (!Number.isFinite(arr[i])) throw new Error(`${name} has a non-finite value`);
              }
            }
          }
        });
        rig.dispose();
      }
    }
  });

  it('rebuilds only the hair when the hair changes', () => {
    const rig = createAvatarRig(DEFAULT_VISITOR_APPEARANCE, { role: 'visitor' });
    const body = rig.root.getObjectByName('body') as SkinnedMesh;
    const bodyGeometry = body.geometry;
    const hair = rig.root.getObjectByName('hair') as SkinnedMesh;
    const hairGeometry = hair.geometry;
    rig.setAppearance({
      ...DEFAULT_VISITOR_APPEARANCE,
      hairStyle: 'ponytail',
      hairColor: 'blonde',
    });
    expect((rig.root.getObjectByName('body') as SkinnedMesh).geometry).toBe(bodyGeometry);
    expect((rig.root.getObjectByName('hair') as SkinnedMesh).geometry).not.toBe(hairGeometry);
    rig.dispose();
  });

  it('drops the hair mesh for no hair style that produces none, and survives every transition', () => {
    const rig = createAvatarRig(DEFAULT_GUIDE_APPEARANCE, { role: 'guide' });
    for (const hairStyle of AVATAR_OPTIONS.hairStyle) {
      rig.setAppearance({ ...rig.config, hairStyle });
      expect(rig.stats.triangles).toBeGreaterThan(0);
    }
    rig.dispose();
  });

  it('applies poses without producing NaN and returns to rest', () => {
    const rig = createAvatarRig(DEFAULT_GUIDE_APPEARANCE, { role: 'guide' });
    rig.applyPose({ walkPhase: 1.2, walkAmount: 1, idleTime: 3, present: 1, lookYaw: 0.4 });
    for (const bone of Object.values(rig.bones)) {
      expect(Number.isFinite(bone.rotation.x + bone.rotation.y + bone.rotation.z)).toBe(true);
    }
    expect(rig.bones.armR.rotation.x).toBeLessThan(-1);
    rig.resetPose();
    expect(rig.bones.legL.rotation.x).toBeCloseTo(0, 6);
    expect(rig.bones.hips.position.y).toBeCloseTo(0.78, 2);
    rig.dispose();
  });

  it('fades the figure and its shadow with setOpacity', () => {
    const rig = createAvatarRig(DEFAULT_GUIDE_APPEARANCE, { role: 'guide' });
    rig.setOpacity(0.35);
    const body = rig.root.getObjectByName('body') as SkinnedMesh;
    expect((body.material as { opacity: number }).opacity).toBeCloseTo(0.35, 5);
    expect((body.material as { transparent: boolean }).transparent).toBe(true);
    rig.setOpacity(1);
    expect((body.material as { transparent: boolean }).transparent).toBe(false);
    rig.dispose();
  });
});

describe('describeAvatar', () => {
  it('matches the design spec example', () => {
    expect(describeAvatar(DEFAULT_GUIDE_APPEARANCE, 'Tom')).toBe(
      'Tom: medium height, regular build, short crop dark brown hair, navy shirt and trousers.',
    );
  });

  it('mentions facial hair and works without a name', () => {
    const text = describeAvatar(withConfig({ facialHair: 'goatee', height: 'tall' }));
    expect(text).toBe(
      'Taller height, regular build, short crop dark brown hair, navy shirt and trousers, goatee.',
    );
  });
});
