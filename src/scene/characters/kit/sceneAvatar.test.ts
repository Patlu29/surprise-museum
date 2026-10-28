import { describe, expect, it } from 'vitest';
import { DEFAULT_GUIDE_APPEARANCE } from './options';
import { buildAvatar } from './sceneAvatar';

describe('buildAvatar (scene adapter)', () => {
  it('reports metres and scale as the scene expects', () => {
    const rig = buildAvatar(DEFAULT_GUIDE_APPEARANCE, 'guide');
    expect(rig.scale).toBe(1);
    expect(rig.height).toBeCloseTo(1.7, 5);
    // The label sits 0.35 m above the head.
    expect(rig.labelHeight).toBeCloseTo(1.7 + 0.35, 2);
    rig.dispose();
  });

  it('scales the label with the height option', () => {
    const rig = buildAvatar({ ...DEFAULT_GUIDE_APPEARANCE, height: 'tall' }, 'guide');
    expect(rig.scale).toBeCloseTo(1.09, 5);
    expect(rig.height).toBeCloseTo(1.7 * 1.09, 5);
    expect(rig.labelHeight).toBeCloseTo((1.7 + 0.35) * 1.09, 2);
    rig.dispose();
  });

  it('applies a pose and a fade without error', () => {
    const rig = buildAvatar(DEFAULT_GUIDE_APPEARANCE, 'guide');
    rig.applyPose({ walkPhase: 1, walkAmount: 1, idleTime: 2, present: 0 });
    rig.applyPose({ walkPhase: 0, walkAmount: 0, idleTime: 0, present: 1 });
    rig.setOpacity(0.35);
    rig.setOpacity(1);
    rig.dispose();
  });
});
