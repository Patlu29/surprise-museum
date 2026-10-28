import { createHtmlCanvasEnv, supportsOffscreenJpeg } from './canvasEnv';
import { processBlob } from './core';
import type { WorkerRequest, WorkerResponse } from './processor.worker';
import type { MediaErrorCode, ProcessedPhoto, SourceKind } from './types';
import { MediaError } from './types';
import { validateSourceFile } from './validate';

export { checkSourceFile, validateSourceFile } from './validate';
export type { FileCheck } from './validate';
export { sniffImageKind } from './sniff';
export { fitWithin, planResizeSteps } from './plan';
export { encodeToTarget, bytesToBase64 } from './encode';
export { hasRejectedMetadata, listJpegMarkers, stripJpegBlob, stripJpegMetadata } from './jpeg';
export { MediaError } from './types';
export type { ProcessedPhoto, SourceKind, MediaErrorCode } from './types';

/**
 * Entry point for the photo pipeline: validate, decode, resize, re-encode (ADR 0004).
 * Runs in a Web Worker where `OffscreenCanvas` can encode JPEG, otherwise on the main thread.
 * One photo at a time is expected (the caller queues them) to stay inside phone memory.
 */

async function convertHeicToJpeg(blob: Blob): Promise<Blob> {
  // Lazy, separate chunk: about 3 MB of WASM that most Creators never download (LGPL-3.0, ADR 0004).
  const { heicTo } = await import('heic-to/csp');
  return heicTo({ blob, type: 'image/jpeg', quality: 0.92 });
}

let worker: Worker | null = null;
let workerUnusable = false;
let nextRequestId = 1;

function getWorker(): Worker | null {
  if (workerUnusable || typeof Worker === 'undefined' || !supportsOffscreenJpeg()) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./processor.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('error', () => {
      workerUnusable = true;
      worker?.terminate();
      worker = null;
    });
    return worker;
  } catch {
    workerUnusable = true;
    return null;
  }
}

/** Signals that the worker could not run the job at all, as opposed to the photo being bad. */
class WorkerUnavailableError extends Error {}

function runInWorker(blob: Blob, kind: SourceKind): Promise<ProcessedPhoto> {
  const active = getWorker();
  if (!active) return Promise.reject(new WorkerUnavailableError('No worker'));
  const id = nextRequestId;
  nextRequestId += 1;
  return new Promise<ProcessedPhoto>((resolve, reject) => {
    const cleanup = () => {
      active.removeEventListener('message', onMessage);
      active.removeEventListener('error', onError);
    };
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      cleanup();
      if (event.data.ok) {
        resolve(event.data.result);
      } else if (event.data.code === 'worker-error') {
        reject(new WorkerUnavailableError(event.data.message));
      } else {
        reject(
          new MediaError(
            event.data.code as MediaErrorCode,
            event.data.message,
            event.data.sourceKind,
          ),
        );
      }
    };
    const onError = () => {
      cleanup();
      reject(new WorkerUnavailableError('The worker crashed'));
    };
    active.addEventListener('message', onMessage);
    active.addEventListener('error', onError);
    const request: WorkerRequest = { id, blob, kind };
    active.postMessage(request);
  });
}

async function processOnMainThread(file: Blob, kind: SourceKind): Promise<ProcessedPhoto> {
  return processBlob(file, kind, createHtmlCanvasEnv(), { convertHeic: convertHeicToJpeg });
}

/**
 * Processes one picked file. Throws `MediaError` with a Creator-safe message when the file cannot
 * be used. The file is validated by content first, so call sites need not do it separately.
 */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const check = await validateSourceFile(file);
  if (!check.ok) {
    throw new MediaError(file.size === 0 ? 'empty' : 'unsupported-type', check.reason);
  }
  const { kind } = check;

  try {
    return await runInWorker(file, kind);
  } catch (error) {
    if (error instanceof MediaError) {
      // HEIC that the browser cannot decode natively: convert on the main thread, then retry in the worker.
      if (kind === 'heic' && error.code === 'decode-failed') {
        try {
          const jpeg = await convertHeicToJpeg(file);
          return await runInWorker(jpeg, 'jpeg').catch((retryError: unknown) => {
            if (retryError instanceof WorkerUnavailableError)
              return processOnMainThread(jpeg, 'jpeg');
            throw retryError;
          });
        } catch (heicError) {
          if (heicError instanceof MediaError) throw heicError;
          throw new MediaError('heic-failed', 'We could not open this HEIC photo.', 'heic');
        }
      }
      throw error;
    }
    // The worker itself was unavailable or crashed: use the main thread.
    return processOnMainThread(file, kind);
  }
}
