import { describe, expect, it } from 'vitest';
import { clampDown } from './labelLayout';

describe('clampDown (BUG-10)', () => {
  it('moves a label that sits under the strip down to the strip bottom', () => {
    expect(clampDown({ top: 183.9 }, 192)).toBeCloseTo(8.1);
  });
  it('leaves a label that is already clear', () => {
    expect(clampDown({ top: 200 }, 192)).toBe(0);
  });
});
