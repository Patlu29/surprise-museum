import { describe, expect, it } from 'vitest';
import { createSceneMaterials } from './sceneMaterials';

describe('createSceneMaterials', () => {
  it('provides every role the scene consumes', () => {
    const m = createSceneMaterials('high');
    for (const key of [
      'wall',
      'wallFinale',
      'floor',
      'floorFinale',
      'ceiling',
      'runner',
      'frameWood',
      'frameMat',
      'brass',
      'podium',
      'lectern',
      'book',
      'pool',
    ] as const) {
      expect(m[key], key).toBeDefined();
    }
    expect(m.brass.type).toBe('MeshStandardMaterial');
    expect(m.brass.emissiveIntensity).toBeGreaterThan(0);
    expect(m.pool.transparent).toBe(true);
    m.dispose();
  });

  it('is cheaper at low quality', () => {
    const m = createSceneMaterials('low');
    expect(m.floor.type).toBe('MeshLambertMaterial');
    m.dispose();
  });
});
