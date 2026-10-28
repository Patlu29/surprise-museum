export interface EncodeTargetOptions {
  startQuality: number;
  /** The encoder lowers quality in steps until the file is this size or smaller. */
  targetBytes: number;
  minQuality: number;
  step: number;
}

export interface EncodeResult {
  blob: Blob;
  quality: number;
  /** False when even the lowest quality missed the target. */
  metTarget: boolean;
}

/**
 * Encodes at `startQuality` and steps the quality down until the result fits `targetBytes`
 * (ADR 0004: full at 0.85 down to 600 KB). `encode` is injected so this is testable without a canvas.
 */
export async function encodeToTarget(
  encode: (quality: number) => Promise<Blob>,
  options: EncodeTargetOptions,
): Promise<EncodeResult> {
  let quality = options.startQuality;
  let blob = await encode(quality);
  while (blob.size > options.targetBytes && quality - options.step >= options.minQuality - 1e-9) {
    quality = Math.round((quality - options.step) * 100) / 100;
    blob = await encode(quality);
  }
  return { blob, quality, metTarget: blob.size <= options.targetBytes };
}

/** Base64 of raw bytes. Chunked so a large array never overflows the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function blobToJpegDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
}
