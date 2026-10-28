import { createOffscreenCanvasEnv } from './canvasEnv';
import { processBlob } from './core';
import type { ProcessedPhoto, SourceKind } from './types';
import { MediaError } from './types';

/**
 * Web Worker host for the photo pipeline. Keeps decoding and encoding off the main thread so
 * the builder stays responsive while 20 photos are prepared. HEIC conversion needs a dynamic
 * import of the lazy decoder, so it stays on the main thread: this worker reports
 * `decode-failed` for HEIC and the caller converts, then sends a JPEG back here.
 */
export interface WorkerRequest {
  id: number;
  blob: Blob;
  kind: SourceKind;
}

export type WorkerResponse =
  | { id: number; ok: true; result: ProcessedPhoto }
  | { id: number; ok: false; code: string; message: string; sourceKind: SourceKind | undefined };

const scope = self as unknown as {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

scope.onmessage = async (event) => {
  const { id, blob, kind } = event.data;
  try {
    const result = await processBlob(blob, kind, createOffscreenCanvasEnv());
    scope.postMessage({ id, ok: true, result });
  } catch (error) {
    if (error instanceof MediaError) {
      scope.postMessage({
        id,
        ok: false,
        code: error.code,
        message: error.message,
        sourceKind: error.sourceKind,
      });
    } else {
      scope.postMessage({
        id,
        ok: false,
        code: 'worker-error',
        message: error instanceof Error ? error.message : 'The photo worker failed.',
        sourceKind: undefined,
      });
    }
  }
};
