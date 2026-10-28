import type { CanvasEnv, Surface } from './core';
import { MediaError } from './types';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeSurface(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  ctx: Ctx2D,
  toBlob: (quality: number) => Promise<Blob>,
): Surface {
  const width = canvas.width;
  const height = canvas.height;
  return {
    width,
    height,
    source: canvas,
    draw(image) {
      // JPEG has no alpha: a transparent PNG would turn black without a white backing.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);
    },
    toJpeg: toBlob,
    release() {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

async function decodeBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Older engines reject the options object. Retry plainly: modern engines still apply EXIF.
    return await createImageBitmap(blob);
  }
}

/** Canvas environment for the main thread. Works in every supported browser. */
export function createHtmlCanvasEnv(): CanvasEnv {
  return {
    decode: decodeBitmap,
    createSurface(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new MediaError('encode-failed', 'This browser could not prepare the photo.');
      return makeSurface(
        canvas,
        ctx,
        (quality) =>
          new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) =>
                blob
                  ? resolve(blob)
                  : reject(
                      new MediaError('encode-failed', 'This browser could not save the photo.'),
                    ),
              'image/jpeg',
              quality,
            );
          }),
      );
    },
  };
}

/** True when `OffscreenCanvas` can encode JPEG here (Chrome, Edge, Firefox, Safari 16.4 and later). */
export function supportsOffscreenJpeg(): boolean {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'
  );
}

/** Canvas environment for a Web Worker. */
export function createOffscreenCanvasEnv(): CanvasEnv {
  return {
    decode: decodeBitmap,
    createSurface(width, height) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new MediaError('encode-failed', 'This browser could not prepare the photo.');
      return makeSurface(canvas, ctx, (quality) =>
        canvas.convertToBlob({ type: 'image/jpeg', quality }),
      );
    },
  };
}
