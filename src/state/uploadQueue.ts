import type { PhotoUploadTicket } from '@contract';
import { LIMITS } from '@contract';
import { describeApiError, getApi, isApiError } from '@/lib/apiPort';
import { newLocalId } from '@/lib/id';
import type { FileCheck, ProcessedPhoto } from '@/media';
import { MediaError, processPhoto, validateSourceFile } from '@/media';
import { createDraftPhoto, useBuilderStore } from './builderStore';
import type { DraftPhoto, PhotoErrorKind } from './draft';

/**
 * Photo intake and upload for the builder (architecture 5.2).
 *
 *   add file -> validate by content -> process one at a time (resize, strip, re-encode)
 *            -> create-museum (first photo only) -> reserve-photo -> PUT full + wall (progress)
 *            -> confirm-photo -> 'ready'
 *
 * Processing is sequential to stay inside phone memory. Uploads run three at a time. A failed
 * photo is retried alone (FR-4). Blobs and original files live here, not in the store, because
 * the store holds plain data only; the store keeps the object URLs for thumbnails and preview.
 *
 * `backendConfigured` is true in normal use: src/api answers with the real backend or its in-memory
 * mock. It exists so a test (or a host with no backend at all) can stop photos at 'ready' with no
 * `photoId`, which keeps preview working.
 */

const MAX_PARALLEL_UPLOADS = 3;
const PROGRESS_STEP = 0.02;

export const MSG_PHOTO_LIMIT = 'You can add up to 20 photos. Remove one to add another.';
export const MSG_HEIC = "We couldn't open this HEIC photo. Try exporting it as a JPEG.";
export const MSG_UPLOAD_FAILED = 'Upload failed: check your connection.';

export interface UploadDeps {
  process: (file: File) => Promise<ProcessedPhoto>;
  validate: (file: File) => Promise<FileCheck>;
  backendConfigured: () => boolean;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
}

const defaultDeps: UploadDeps = {
  process: processPhoto,
  validate: validateSourceFile,
  backendConfigured: () => true,
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
};
let deps: UploadDeps = defaultDeps;

/** For tests: replace pieces of the pipeline. Pass nothing to restore the real ones. */
export function configureUploads(overrides?: Partial<UploadDeps>): void {
  deps = { ...defaultDeps, ...overrides };
}

interface Entry {
  file: File | null;
  processed: ProcessedPhoto | null;
  controller: AbortController | null;
  removed: boolean;
}

const entries = new Map<string, Entry>();
const processQueue: string[] = [];
const uploadQueue: string[] = [];
let processing = false;
let uploading = 0;
let museumPromise: Promise<string> | null = null;

function store() {
  return useBuilderStore.getState();
}

function findPhoto(localId: string): DraftPhoto | undefined {
  return store().photos.find((photo) => photo.localId === localId);
}

function fail(localId: string, error: string, errorKind: PhotoErrorKind): void {
  store().patchPhoto(localId, { status: 'failed', error, errorKind, progress: 0 });
}

function mediaFailure(error: unknown): { message: string; kind: PhotoErrorKind } {
  if (error instanceof MediaError) {
    switch (error.code) {
      case 'heic-failed':
        return { message: MSG_HEIC, kind: 'heic' };
      case 'unsupported-type':
      case 'too-large':
      case 'empty':
        return { message: error.message, kind: 'unreadable' };
      case 'decode-failed':
        return {
          message:
            error.sourceKind === 'heic'
              ? MSG_HEIC
              : "We couldn't open this photo. Try a different file.",
          kind: error.sourceKind === 'heic' ? 'heic' : 'unreadable',
        };
      case 'encode-failed':
        return {
          message: "We couldn't prepare this photo. Try a smaller one.",
          kind: 'unreadable',
        };
    }
  }
  return { message: 'Something went wrong preparing this photo. Please try again.', kind: 'other' };
}

function uploadFailure(error: unknown): { message: string; kind: PhotoErrorKind } {
  if (isApiError(error)) {
    switch (error.code) {
      case 'network':
      case 'timeout':
        return { message: MSG_UPLOAD_FAILED, kind: 'network' };
      case 'rate_limited':
        return { message: describeApiError(error), kind: 'network' };
      case 'photo_limit':
        return { message: MSG_PHOTO_LIMIT, kind: 'quota' };
      case 'upload_quota':
        return { message: describeApiError(error), kind: 'quota' };
      case 'invalid_image':
        return { message: describeApiError(error), kind: 'rejected' };
      case 'not_found':
        return {
          message: 'Your draft has expired. Please start a new museum.',
          kind: 'expired',
        };
      default:
        return { message: 'Upload failed. Please try again.', kind: 'other' };
    }
  }
  return { message: 'Upload failed. Please try again.', kind: 'other' };
}

function ensureMuseum(): Promise<string> {
  const existing = store().editToken;
  if (existing) return Promise.resolve(existing);
  if (!museumPromise) {
    museumPromise = getApi()
      .createMuseum()
      .then((response) => {
        store().setEditToken(response.editToken);
        return response.editToken;
      })
      .finally(() => {
        museumPromise = null;
      });
  }
  return museumPromise;
}

function freeUrls(photo: DraftPhoto | undefined): void {
  if (!photo) return;
  if (photo.wallUrl) deps.revokeObjectUrl(photo.wallUrl);
  if (photo.fullUrl) deps.revokeObjectUrl(photo.fullUrl);
}

function pump(): void {
  if (!processing) {
    const next = processQueue.shift();
    if (next) void runProcess(next);
  }
  while (uploading < MAX_PARALLEL_UPLOADS) {
    const next = uploadQueue.shift();
    if (!next) break;
    void runUpload(next);
  }
}

async function runProcess(localId: string): Promise<void> {
  const entry = entries.get(localId);
  if (!entry || entry.removed || !entry.file) {
    pump();
    return;
  }
  processing = true;
  store().patchPhoto(localId, { status: 'processing', error: null, errorKind: null, progress: 0 });
  try {
    const result = await deps.process(entry.file);
    if (entry.removed) return;
    entry.processed = result;
    const backend = deps.backendConfigured();
    store().patchPhoto(localId, {
      width: result.width,
      height: result.height,
      lqip: result.lqip,
      wallUrl: deps.createObjectUrl(result.wall),
      fullUrl: deps.createObjectUrl(result.full),
      processed: true,
      status: backend ? 'uploading' : 'ready',
      progress: backend ? 0 : 1,
    });
    if (backend) uploadQueue.push(localId);
  } catch (error) {
    if (entry.removed) return;
    const { message, kind } = mediaFailure(error);
    fail(localId, message, kind);
  } finally {
    processing = false;
    pump();
  }
}

async function runUpload(localId: string): Promise<void> {
  const entry = entries.get(localId);
  const processed = entry?.processed;
  if (!entry || entry.removed || !processed) {
    pump();
    return;
  }
  uploading += 1;
  const controller = new AbortController();
  entry.controller = controller;
  const { signal } = controller;
  try {
    const api = getApi();
    const editToken = await ensureMuseum();
    if (entry.removed) return;

    const existingId = findPhoto(localId)?.photoId ?? null;
    let ticket: PhotoUploadTicket;
    if (existingId) {
      ticket = await api.renewUpload(editToken, existingId, signal);
    } else {
      ticket = await api.reservePhoto(editToken, signal);
      if (entry.removed) {
        // Removed while reserving: free the server slot.
        void api.removePhoto(editToken, ticket.photoId).catch(() => undefined);
        return;
      }
      store().patchPhoto(localId, { photoId: ticket.photoId });
    }

    let fullDone = 0;
    let wallDone = 0;
    let lastReported = 0;
    const totalBytes = processed.full.size + processed.wall.size;
    const report = () => {
      const bytes = fullDone * processed.full.size + wallDone * processed.wall.size;
      // Leave the last few per cent for the confirm step.
      const progress = Math.min(0.97, (bytes / totalBytes) * 0.97);
      if (progress - lastReported >= PROGRESS_STEP) {
        lastReported = progress;
        store().patchPhoto(localId, { progress });
      }
    };
    await Promise.all([
      api.uploadPhotoFile(
        ticket.full.signedUrl,
        processed.full,
        (fraction) => {
          fullDone = fraction;
          report();
        },
        signal,
      ),
      api.uploadPhotoFile(
        ticket.wall.signedUrl,
        processed.wall,
        (fraction) => {
          wallDone = fraction;
          report();
        },
        signal,
      ),
    ]);
    await api.confirmPhoto(
      editToken,
      {
        photoId: ticket.photoId,
        width: processed.width,
        height: processed.height,
        lqip: processed.lqip,
      },
      signal,
    );
    if (entry.removed) return;
    store().patchPhoto(localId, { status: 'ready', progress: 1, error: null, errorKind: null });
  } catch (error) {
    if (entry.removed || (isApiError(error) && error.code === 'aborted')) return;
    const { message, kind } = uploadFailure(error);
    if (kind === 'rejected') {
      // The server deleted the objects, so a retry must reserve a fresh slot.
      store().patchPhoto(localId, { photoId: null });
    }
    fail(localId, message, kind);
  } finally {
    entry.controller = null;
    uploading -= 1;
    pump();
  }
}

function newItem(file: File, caption = ''): DraftPhoto {
  const localId = newLocalId('photo');
  entries.set(localId, { file, processed: null, controller: null, removed: false });
  return createDraftPhoto(localId, file.name, caption);
}

/**
 * Validates the picked files and adds the good ones (FR-2, FR-3). Rejected files are listed with
 * their name and reason, and the valid files carry on. The 20-photo limit is enforced here.
 */
export async function addFiles(files: readonly File[]): Promise<void> {
  const valid: File[] = [];
  const rejections: Array<{ id: string; fileName: string; reason: string }> = [];
  for (const file of files) {
    const check = await deps.validate(file);
    if (check.ok) valid.push(file);
    else rejections.push({ id: newLocalId('rej'), fileName: file.name, reason: check.reason });
  }
  // Re-read the count after the awaits above: another pick may have landed meanwhile.
  const room = Math.max(0, LIMITS.maxPhotos - store().photos.length);
  const accepted = valid.slice(0, room);
  for (const file of valid.slice(room)) {
    rejections.push({ id: newLocalId('rej'), fileName: file.name, reason: MSG_PHOTO_LIMIT });
  }
  if (rejections.length > 0) store().addRejections(rejections);
  if (accepted.length === 0) return;
  const items = accepted.map((file) => newItem(file));
  store().addPhotoItems(items);
  for (const item of items) processQueue.push(item.localId);
  pump();
}

/** Stops the photo's work, frees its blobs and, if it reached the server, asks for it to be removed. */
function release(localId: string, removeFromServer: boolean): void {
  const entry = entries.get(localId);
  const photo = findPhoto(localId);
  if (entry) {
    entry.removed = true;
    entry.controller?.abort();
  }
  for (const queue of [processQueue, uploadQueue]) {
    const index = queue.indexOf(localId);
    if (index >= 0) queue.splice(index, 1);
  }
  freeUrls(photo);
  entries.delete(localId);
  const editToken = store().editToken;
  if (removeFromServer && photo?.photoId && editToken && deps.backendConfigured()) {
    void getApi()
      .removePhoto(editToken, photo.photoId)
      .catch(() => undefined);
  }
}

export function removePhoto(localId: string): void {
  release(localId, true);
  store().removePhotoItem(localId);
}

/** Swaps the picture and keeps the caption and the position (US-3). Returns false if the file was rejected. */
export async function replacePhoto(localId: string, file: File): Promise<boolean> {
  const check = await deps.validate(file);
  if (!check.ok) {
    store().addRejections([{ id: newLocalId('rej'), fileName: file.name, reason: check.reason }]);
    return false;
  }
  const current = findPhoto(localId);
  if (!current) return false;
  const caption = current.caption;
  release(localId, true);
  entries.set(localId, { file, processed: null, controller: null, removed: false });
  store().patchPhoto(localId, { ...createDraftPhoto(localId, file.name, caption) });
  processQueue.push(localId);
  pump();
  return true;
}

/** Retries one failed photo on its own (FR-4). Uses the processed blobs if they exist. */
export function retryPhoto(localId: string): void {
  const entry = entries.get(localId);
  const photo = findPhoto(localId);
  if (!entry || !photo || photo.status !== 'failed') return;
  if (entry.processed) {
    store().patchPhoto(localId, { status: 'uploading', error: null, errorKind: null, progress: 0 });
    uploadQueue.push(localId);
  } else if (entry.file) {
    store().patchPhoto(localId, { status: 'queued', error: null, errorKind: null, progress: 0 });
    processQueue.push(localId);
  }
  pump();
}

/** Retries photos that failed only because the connection dropped. Called when the browser comes back online. */
export function retryNetworkFailures(): void {
  for (const photo of store().photos) {
    if (photo.status === 'failed' && photo.errorKind === 'network') retryPhoto(photo.localId);
  }
}

/** Ends every job, frees every blob and clears the draft. */
export function discardDraft(): void {
  for (const photo of store().photos) release(photo.localId, false);
  entries.clear();
  processQueue.length = 0;
  uploadQueue.length = 0;
  museumPromise = null;
  store().reset();
}
