import { AVATAR_GENDERS, AVATAR_OPTIONS } from '@contract';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GUIDE_APPEARANCE } from '@/domain/characters/avatarOptions';
import { avatarHeight } from './avatarRig';
import { buildAvatar } from '../seams';

/**
 * CR-1 (ADR 0020, scene-developer item 4; design spec 9.5): head size and height do not change
 * with gender, so a name label sits 0.35 m above the head for every gender, body type and height,
 * and does not move when the gender changes.
 */
describe('name label height across genders', () => {
  it('is 0.35 m above the head for every gender, body type and height, for both roles', () => {
    for (const role of ['guide', 'visitor'] as const) {
      for (const gender of AVATAR_GENDERS) {
        for (const bodyType of AVATAR_OPTIONS.bodyType) {
          for (const height of AVATAR_OPTIONS.height) {
            const config = { ...DEFAULT_GUIDE_APPEARANCE, gender, bodyType, height };
            const rig = buildAvatar(config, role);
            const head = avatarHeight(config);
            expect(rig.height).toBeCloseTo(head, 4);
            expect(rig.labelHeight - rig.height).toBeCloseTo(0.35 * rig.scale, 3);
            rig.dispose();
          }
        }
      }
    }
  });

  it('does not move when only the gender changes', () => {
    for (const height of AVATAR_OPTIONS.height) {
      const heights = AVATAR_GENDERS.map((gender) => {
        const rig = buildAvatar({ ...DEFAULT_GUIDE_APPEARANCE, gender, height }, 'guide');
        const value = rig.labelHeight;
        rig.dispose();
        return value;
      });
      expect(new Set(heights.map((h) => h.toFixed(5))).size).toBe(1);
    }
  });
});
