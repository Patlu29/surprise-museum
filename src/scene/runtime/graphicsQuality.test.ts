import { describe, expect, it } from 'vitest';
import { isWeakRenderer, resolveGraphicsQuality, type DeviceHints } from './graphicsQuality';

const desktop: DeviceHints = {
  coarsePointer: false,
  shortSide: 1080,
  deviceMemoryGb: 8,
  cores: 8,
  renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
};
const phone: DeviceHints = {
  ...desktop,
  coarsePointer: true,
  shortSide: 390,
  renderer: 'Apple GPU',
};

describe('resolveGraphicsQuality', () => {
  it('uses high on a capable desktop', () => {
    expect(resolveGraphicsQuality('auto', desktop)).toBe('high');
  });

  it('uses low on a phone, whatever its GPU', () => {
    expect(resolveGraphicsQuality('auto', phone)).toBe('low');
  });

  it('keeps high on a tablet', () => {
    expect(resolveGraphicsQuality('auto', { ...phone, shortSide: 820 })).toBe('high');
  });

  it('uses low on software and old GPUs', () => {
    for (const renderer of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Mali-400 MP',
      'Mali-T720',
      'Adreno (TM) 306',
      'PowerVR SGX 544MP',
      'Intel(R) HD Graphics 4000',
    ]) {
      expect(isWeakRenderer(renderer), renderer).toBe(true);
      expect(resolveGraphicsQuality('auto', { ...desktop, renderer })).toBe('low');
    }
  });

  it('does not flag capable GPUs', () => {
    for (const renderer of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
      'Mali-G78',
      'Adreno (TM) 740',
      'Intel(R) Iris(R) Xe Graphics',
      'Apple M2',
    ]) {
      expect(isWeakRenderer(renderer), renderer).toBe(false);
    }
  });

  it('uses low on very little memory or few cores', () => {
    expect(resolveGraphicsQuality('auto', { ...desktop, deviceMemoryGb: 2 })).toBe('low');
    expect(resolveGraphicsQuality('auto', { ...desktop, cores: 2 })).toBe('low');
  });

  it('lets the Visitor setting win either way (the hook for a future manual toggle)', () => {
    expect(resolveGraphicsQuality('low', desktop)).toBe('low');
    expect(resolveGraphicsQuality('high', phone)).toBe('high');
  });

  it('copes with unknown hints', () => {
    expect(
      resolveGraphicsQuality('auto', {
        ...desktop,
        deviceMemoryGb: null,
        cores: null,
        renderer: null,
      }),
    ).toBe('high');
  });
});
