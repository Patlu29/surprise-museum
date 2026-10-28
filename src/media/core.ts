import { LIMITS } from '@contract';
import { blobToJpegDataUrl, encodeToTarget } from './encode';
import { stripJpegBlob } from './jpeg';
import { fitWithin, planResizeSteps } from './plan';
import type { ProcessedPhoto, SourceKind } from './types';
import { MediaError } from './types';

/**
 * Photo pipeline core (ADR 0004, architecture 10.3). It is independent of where it runs: the
 * main thread and the Web Worker each pass in a `CanvasEnv`. Re-encoding through a canvas writes
 * a brand-new JPEG, so EXIF, GPS, XMP, IPTC and maker notes are gone (FR-10).
 */

/** Never allocate a canvas larger than this on its long edge (iOS canvas area limit). */
export const MAX_CANVAS_EDGE = 4096;

export interface Surface {
  readonly width: number;
  readonly height: number;
  /** The canvas, for drawing this surface into the next, smaller one. */
  readonly source: CanvasImageSource;
  /** Paints a white backing (JPEG has no alpha) and draws `image` scaled to fill the surface. */
  draw(image: CanvasImageSource): void;
  toJpeg(quality: number): Promise<Blob>;
  /** Frees the pixel memory straight away. Phones are tight on memory. */
  release(): void;
}

export interface CanvasEnv {
  createSurface(width: number, height: number): Surface;
  /** Decodes with EXIF orientation applied. */
  decode(blob: Blob): Promise<ImageBitmap>;
}

export interface ProcessOptions {
  /** Converts HEIC to a JPEG blob. Supplied only where the lazy HEIC decoder can run (main thread). */
  convertHeic?: (blob: Blob) => Promise<Blob>;
}

async function decodeSource(
  source: Blob,
  kind: SourceKind,
  env: CanvasEnv,
  options: ProcessOptions,
): Promise<ImageBitmap> {
  try {
    return await env.decode(source);
  } catch {
    if (kind !== 'heic') {
      throw new MediaError('decode-failed', 'We could not open this photo.', kind);
    }
  }
  // Only HEIC reaches here: the browser cannot decode it natively, so use the lazy decoder.
  if (!options.convertHeic) {
    throw new MediaError('decode-failed', 'This browser cannot open HEIC photos directly.', kind);
  }
  try {
    const jpeg = await options.convertHeic(source);
    return await env.decode(jpeg);
  } catch {
    throw new MediaError('heic-failed', 'We could not open this HEIC photo.', kind);
  }
}

/**
 * Shrinks `image` to `target` on the long edge through the planned canvases and returns the last
 * one. Intermediate canvases are released as soon as the next step has read them. The caller owns
 * the returned surface and the original `image`.
 */
function shrink(
  image: CanvasImageSource,
  width: number,
  height: number,
  target: number,
  env: CanvasEnv,
): Surface {
  const planned = planResizeSteps(width, height, target, MAX_CANVAS_EDGE);
  const sizes = planned.length > 0 ? planned : [fitWithin(width, height, target)];
  let current = image;
  let previous: Surface | null = null;
  for (const size of sizes) {
    const surface = env.createSurface(size.width, size.height);
    surface.draw(current);
    previous?.release();
    previous = surface;
    current = surface.source;
  }
  // `sizes` always has at least one entry, so a surface exists.
  return previous as Surface;
}

/** Encodes, then removes any metadata the browser's own encoder wrote (see jpeg.ts). */
async function encodeClean(surface: Surface, quality: number): Promise<Blob> {
  return stripJpegBlob(await surface.toJpeg(quality));
}

export async function processBlob(
  source: Blob,
  kind: SourceKind,
  env: CanvasEnv,
  options: ProcessOptions = {},
): Promise<ProcessedPhoto> {
  const bitmap = await decodeSource(source, kind, env, options);
  const surfaces: Surface[] = [];
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (sourceWidth < 1 || sourceHeight < 1) {
      throw new MediaError('decode-failed', 'This photo has no picture data.', kind);
    }

    const full = shrink(bitmap, sourceWidth, sourceHeight, LIMITS.fullLongEdgePx, env);
    surfaces.push(full);
    // The original is no longer needed once the full rendition exists.
    bitmap.close();

    const fullResult = await encodeToTarget((q) => encodeClean(full, q), {
      startQuality: 0.85,
      targetBytes: LIMITS.fullTargetBytes,
      minQuality: 0.5,
      step: 0.05,
    });
    if (fullResult.blob.size > LIMITS.maxStoredFileBytes) {
      throw new MediaError('encode-failed', 'This photo is too detailed to prepare.', kind);
    }

    const wall = shrink(full.source, full.width, full.height, LIMITS.wallLongEdgePx, env);
    surfaces.push(wall);
    const wallResult = await encodeToTarget((q) => encodeClean(wall, q), {
      startQuality: 0.8,
      targetBytes: LIMITS.wallTargetBytes,
      minQuality: 0.5,
      step: 0.05,
    });

    const tiny = shrink(wall.source, wall.width, wall.height, LIMITS.lqipLongEdgePx, env);
    surfaces.push(tiny);
    // A 24 px JPEG is a few hundred bytes. The limit keeps its base64 inside maxLqipChars.
    const lqipBytes = Math.floor(
      ((LIMITS.maxLqipChars - 'data:image/jpeg;base64,'.length) * 3) / 4,
    );
    const lqipResult = await encodeToTarget((q) => encodeClean(tiny, q), {
      startQuality: 0.5,
      targetBytes: lqipBytes,
      minQuality: 0.2,
      step: 0.1,
    });
    const lqip = await blobToJpegDataUrl(lqipResult.blob);
    if (lqip.length > LIMITS.maxLqipChars) {
      throw new MediaError('encode-failed', 'We could not prepare a preview of this photo.', kind);
    }

    return {
      full: fullResult.blob,
      wall: wallResult.blob,
      lqip,
      width: full.width,
      height: full.height,
      wallWidth: wall.width,
      wallHeight: wall.height,
      sourceKind: kind,
    };
  } finally {
    for (const surface of surfaces) surface.release();
    try {
      bitmap.close();
    } catch {
      // Already closed.
    }
  }
}
