import { describe, expect, it } from 'vitest';
import { LIMITS } from '@contract';
import { MAX_CANVAS_EDGE, processBlob, type CanvasEnv, type Surface } from './core';
import { bytesToBase64, encodeToTarget } from './encode';
import { fitWithin, planResizeSteps } from './plan';
import { sniffImageKind } from './sniff';
import { checkSourceFile } from './validate';

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}
function text(value: string): number[] {
  return [...value].map((char) => char.charCodeAt(0));
}
function ftyp(major: string, compatible: string[]): Uint8Array {
  const size = 16 + compatible.length * 4;
  return Uint8Array.from([
    0,
    0,
    0,
    size,
    ...text('ftyp'),
    ...text(major),
    0,
    0,
    0,
    0,
    ...compatible.flatMap(text),
  ]);
}

describe('sniffImageKind', () => {
  it('recognises JPEG, PNG and WebP by content', () => {
    expect(sniffImageKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniffImageKind(bytes(0x89, ...text('PNG'), 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(sniffImageKind(bytes(...text('RIFF'), 1, 2, 3, 4, ...text('WEBP')))).toBe('webp');
  });

  it('recognises HEIC and HEIF brands, including generic mif1 files', () => {
    expect(sniffImageKind(ftyp('heic', ['mif1', 'heic']))).toBe('heic');
    expect(sniffImageKind(ftyp('heix', []))).toBe('heic');
    expect(sniffImageKind(ftyp('mif1', ['heic']))).toBe('heic');
    expect(sniffImageKind(ftyp('mif1', ['miaf']))).toBe('heic');
  });

  it('rejects AVIF, PDF, text and empty input', () => {
    expect(sniffImageKind(ftyp('avif', ['mif1', 'miaf']))).toBeNull();
    expect(sniffImageKind(ftyp('mif1', ['avif']))).toBeNull();
    expect(sniffImageKind(bytes(...text('%PDF-1.7')))).toBeNull();
    expect(sniffImageKind(bytes(...text('hello world!')))).toBeNull();
    expect(sniffImageKind(bytes())).toBeNull();
  });
});

describe('checkSourceFile', () => {
  const jpegHeader = bytes(0xff, 0xd8, 0xff, 0xe0);

  it('accepts a valid JPEG under the limit', () => {
    expect(checkSourceFile({ size: 2_000_000 }, jpegHeader)).toEqual({ ok: true, kind: 'jpeg' });
  });

  it('rejects files over 15 MB with a reason', () => {
    const result = checkSourceFile({ size: LIMITS.maxSourceFileBytes + 1 }, jpegHeader);
    expect(result).toEqual({ ok: false, reason: 'It is larger than 15 MB.' });
  });

  it('rejects files that are not photos, whatever their name says', () => {
    const result = checkSourceFile({ size: 1000 }, bytes(...text('%PDF-1.7')));
    expect(result.ok).toBe(false);
  });

  it('rejects empty files', () => {
    expect(checkSourceFile({ size: 0 }, bytes())).toEqual({
      ok: false,
      reason: 'The file is empty.',
    });
  });
});

describe('fitWithin', () => {
  it('shrinks to the long edge and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it('never enlarges', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('never returns a zero-pixel side', () => {
    expect(fitWithin(10000, 1, 2048).height).toBe(1);
  });
});

describe('planResizeSteps', () => {
  it('needs no steps when the source already fits', () => {
    expect(planResizeSteps(2000, 1500, 2048, MAX_CANVAS_EDGE)).toEqual([]);
  });

  it('goes straight to the target when less than 2x smaller', () => {
    expect(planResizeSteps(3000, 2000, 2048, MAX_CANVAS_EDGE)).toEqual([
      { width: 2048, height: 1365 },
    ]);
  });

  it('uses one intermediate step for a 48 megapixel iPhone photo and stays within 4096 px', () => {
    const steps = planResizeSteps(8064, 6048, 2048, MAX_CANVAS_EDGE);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toEqual({ width: 4032, height: 3024 });
    expect(steps[1]).toEqual({ width: 2048, height: 1536 });
  });

  it('caps every canvas at 4096 px, even for an extreme panorama', () => {
    const steps = planResizeSteps(20000, 5000, 2048, MAX_CANVAS_EDGE);
    for (const step of steps)
      expect(Math.max(step.width, step.height)).toBeLessThanOrEqual(MAX_CANVAS_EDGE);
    expect(steps.at(-1)).toEqual({ width: 2048, height: 512 });
  });

  it('never shrinks by more than 2x per step after the first', () => {
    const steps = planResizeSteps(1024, 768, 24, MAX_CANVAS_EDGE);
    let previous = 1024;
    for (const step of steps) {
      expect(previous / Math.max(step.width, step.height)).toBeLessThanOrEqual(2.0001);
      previous = Math.max(step.width, step.height);
    }
    expect(steps.at(-1)).toEqual({ width: 24, height: 18 });
  });
});

describe('encodeToTarget', () => {
  const fakeEncoder = (sizeAt: (quality: number) => number) => async (quality: number) =>
    new Blob([new Uint8Array(sizeAt(quality))]);

  it('keeps the first encode when it already fits', async () => {
    const result = await encodeToTarget(
      fakeEncoder(() => 100),
      {
        startQuality: 0.85,
        targetBytes: 600,
        minQuality: 0.5,
        step: 0.05,
      },
    );
    expect(result.quality).toBe(0.85);
    expect(result.metTarget).toBe(true);
  });

  it('steps quality down until the file meets the target', async () => {
    const result = await encodeToTarget(
      fakeEncoder((q) => Math.round(q * 1000)),
      {
        startQuality: 0.85,
        targetBytes: 700,
        minQuality: 0.5,
        step: 0.05,
      },
    );
    expect(result.quality).toBe(0.7);
    expect(result.blob.size).toBe(700);
    expect(result.metTarget).toBe(true);
  });

  it('stops at the minimum quality and reports a miss', async () => {
    const result = await encodeToTarget(
      fakeEncoder(() => 5000),
      {
        startQuality: 0.85,
        targetBytes: 600,
        minQuality: 0.5,
        step: 0.05,
      },
    );
    expect(result.quality).toBe(0.5);
    expect(result.metTarget).toBe(false);
  });
});

describe('bytesToBase64', () => {
  it('matches the platform encoder, including for arrays larger than one chunk', () => {
    const data = new Uint8Array(100_000).map((_, index) => index % 251);
    expect(bytesToBase64(data)).toBe(Buffer.from(data).toString('base64'));
  });
});

/** A canvas stand-in that records every canvas it is asked to allocate. */
function fakeEnv(
  sourceWidth: number,
  sourceHeight: number,
  log: Array<[number, number]>,
): CanvasEnv {
  return {
    async decode() {
      return { width: sourceWidth, height: sourceHeight, close() {} } as unknown as ImageBitmap;
    },
    createSurface(width, height): Surface {
      log.push([width, height]);
      const canvas = { width, height } as unknown as CanvasImageSource;
      return {
        width,
        height,
        source: canvas,
        draw() {},
        // Roughly 0.1 byte per pixel at full quality, so quality steps matter a little.
        async toJpeg(quality) {
          return new Blob([
            new Uint8Array(Math.max(300, Math.round(width * height * 0.1 * quality))),
          ]);
        },
        release() {},
      };
    },
  };
}

describe('processBlob', () => {
  it('produces full, wall and tiny renditions within limits for a 48 megapixel photo', async () => {
    const log: Array<[number, number]> = [];
    const result = await processBlob(new Blob(['x']), 'jpeg', fakeEnv(8064, 6048, log));
    expect(result.width).toBe(2048);
    expect(result.height).toBe(1536);
    expect(result.wallWidth).toBe(1024);
    expect(result.wallHeight).toBe(768);
    expect(result.lqip.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.lqip.length).toBeLessThanOrEqual(LIMITS.maxLqipChars);
    expect(result.full.size).toBeLessThanOrEqual(LIMITS.maxStoredFileBytes);
    for (const [width, height] of log) {
      expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_CANVAS_EDGE);
    }
  });

  it('keeps a small photo at its own size and never enlarges', async () => {
    const result = await processBlob(new Blob(['x']), 'png', fakeEnv(640, 480, []));
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.wallWidth).toBe(640);
  });

  it('keeps a portrait photo portrait', async () => {
    const result = await processBlob(new Blob(['x']), 'jpeg', fakeEnv(3000, 4000, []));
    expect(result.height).toBe(2048);
    expect(result.width).toBe(1536);
  });

  it('asks the caller to convert HEIC when the browser cannot decode it', async () => {
    const env = fakeEnv(100, 100, []);
    let calls = 0;
    const failingFirst: CanvasEnv = {
      ...env,
      async decode(blob) {
        calls += 1;
        if (calls === 1) throw new Error('unsupported');
        return env.decode(blob);
      },
    };
    const result = await processBlob(new Blob(['x']), 'heic', failingFirst, {
      convertHeic: async () => new Blob(['jpeg']),
    });
    expect(result.sourceKind).toBe('heic');
    expect(calls).toBe(2);
  });

  it('reports a decode failure for HEIC when no converter is available (worker path)', async () => {
    const failing: CanvasEnv = {
      ...fakeEnv(1, 1, []),
      async decode() {
        throw new Error('unsupported');
      },
    };
    await expect(processBlob(new Blob(['x']), 'heic', failing)).rejects.toMatchObject({
      code: 'decode-failed',
      sourceKind: 'heic',
    });
  });

  it('reports a failed HEIC conversion distinctly', async () => {
    const failing: CanvasEnv = {
      ...fakeEnv(1, 1, []),
      async decode() {
        throw new Error('unsupported');
      },
    };
    await expect(
      processBlob(new Blob(['x']), 'heic', failing, {
        convertHeic: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toMatchObject({ code: 'heic-failed' });
  });
});
