/**
 * Implementation of `MuseumApi` for use when no Supabase project is configured (see mode.ts), so
 * the whole app works end to end on a laptop and in QA.
 *
 * It follows the server's rules, not just its shapes:
 *   - tokens are created, derived and hashed with the same code as create-museum;
 *   - request bodies pass the same validators as manage-museum (limits, avatar options, text);
 *   - confirmPhoto runs the same JPEG metadata checker on the uploaded bytes, so a photo that the
 *     real backend would refuse (EXIF, wrong size) is refused here too;
 *   - bad links are one indistinguishable `not_found`; drafts expire after 7 days and published
 *     museums after 90; 20 photos and 100 reservations per museum;
 *   - "signed" photo URLs are object URLs of the uploaded blobs.
 *
 * Persistence: all state lives in a `DemoStorage` (IndexedDB, else localStorage, else memory; see
 * demoStorage.ts). Every call loads the latest state from it, runs, and saves any change, under a
 * lock shared by all tabs. So a museum published in one tab can be opened by its share link in
 * another tab or after a reload. Photo bytes are capped (200 MiB in IndexedDB, 3 MiB in
 * localStorage); an upload past the cap is refused with a 413, as Storage would.
 * `reset()` clears all demo data. There is no rate limiting. Nothing leaves the browser.
 */
import type {
  ApiErrorCode,
  ConfirmPhotoResponse,
  CreateMuseumResponse,
  AvatarConfig,
  DeleteResponse,
  GetMuseumResponse,
  ManageGetResponse,
  ManageMuseumRequest,
  MuseumContent,
  MuseumDocument,
  MuseumPhoto,
  MuseumStatus,
  PhotoUploadTicket,
  PublishResponse,
  RemovePhotoResponse,
} from '@contract';
import type { ConfirmPhotoInput, MuseumApi } from '@/lib/apiPort';
import { ApiRequestError } from '@/lib/apiPort';
import { avatarGender, LIMITS } from '@contract';
import {
  createMemoryStorage,
  DemoStorageFullError,
  type DemoStorage,
  type DemoStorageKind,
} from './demoStorage';
import {
  base64UrlEncode,
  bytesToHex,
  checkJpeg,
  checkLqipDataUrl,
  createTokenPair,
  deriveShareToken,
  FULL_RENDITION,
  hashToken,
  isShareToken,
  JPEG_REJECTION_MESSAGES,
  parseManageRequest,
  proportionsMatch,
  WALL_RENDITION,
} from './shared';

/** Always return `gender`; demo data stored before v1.1 has none and reads as 'neutral' (not rewritten). */
const withGender = (avatar: AvatarConfig): AvatarConfig => ({
  ...avatar,
  gender: avatarGender(avatar),
});

export interface MockApiOptions {
  /** Where data is kept. Default: a private in-memory store (nothing persists). */
  storage?: DemoStorage;
  /** Simulated network delay per call, in milliseconds. Default 0. */
  latencyMs?: number;
  /** Clock in milliseconds since the epoch. Injected so tests control expiry. */
  now?: () => number;
  /** Run the server's JPEG checks on uploads. Default true. */
  verifyImages?: boolean;
  /** Lower the photo-byte cap below the backend's own capacity. */
  maxBytes?: number;
}

/** What the UI can show about the demo data. */
export interface DemoDataInfo {
  storage: DemoStorageKind;
  museums: number;
  photos: number;
  usedBytes: number;
  capacityBytes: number;
}

export type MockMuseumApi = MuseumApi & {
  readonly kind: 'mock';
  /** Deletes every demo museum and photo in this browser ("Clear demo data"). */
  reset(): Promise<void>;
  /** Counts and storage use, for a "Demo data" panel. */
  info(): Promise<DemoDataInfo>;
};

const DAY_MS = 86_400_000;
const UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;
const STATE_VERSION = 1;

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  photo_limit: 409,
  upload_quota: 409,
  invalid_image: 422,
  rate_limited: 429,
  server_error: 500,
};

function fail(code: ApiErrorCode, message: string, field?: string): ApiRequestError {
  return new ApiRequestError(code, message, {
    status: STATUS[code],
    ...(field !== undefined ? { field } : {}),
  });
}

/** The one body every bad link produces, matching the server's message. */
const notFound = () => fail('not_found', 'This museum could not be found.');

const storageFull = () =>
  new ApiRequestError(
    'server_error',
    'The demo storage on this device is full. Clear the demo data and try again.',
    { status: 413 },
  );

// ---------------------------------------------------------------------------
// Stored state (plain JSON, so it can live in any backend)
// ---------------------------------------------------------------------------

interface PhotoRec {
  id: string;
  museumKey: string;
  status: 'pending' | 'ready';
  position: number | null;
  caption: string;
  width: number | null;
  height: number | null;
  lqip: string | null;
  createdAt: number;
  uploadUntil: number;
  fullBytes: number;
  wallBytes: number;
  /** Bumped on every upload, so cached object URLs never show an older file. */
  seq: number;
}

interface MuseumRec {
  key: string;
  shareKey: string;
  status: MuseumStatus;
  document: Omit<MuseumDocument, 'photos'> | null;
  publishedAt: number | null;
  expiresAt: number;
  reservations: number;
}

interface DemoState {
  v: number;
  museums: Record<string, MuseumRec>;
  photos: Record<string, PhotoRec>;
}

const emptyState = (): DemoState => ({ v: STATE_VERSION, museums: {}, photos: {} });

function parseState(text: string | null): DemoState {
  if (!text) return emptyState();
  try {
    const value = JSON.parse(text) as Partial<DemoState>;
    if (value.v === STATE_VERSION && value.museums && value.photos) return value as DemoState;
  } catch {
    // unreadable: start again
  }
  return emptyState();
}

type Rendition = 'full' | 'wall';
const blobKey = (photoId: string, rendition: Rendition) => `${photoId}/${rendition}`;

function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  // crypto.randomUUID needs a secure context; getRandomValues does not.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function createMockApi(options: MockApiOptions = {}): MockMuseumApi {
  const storage = options.storage ?? createMemoryStorage();
  const latencyMs = options.latencyMs ?? 0;
  const now = options.now ?? (() => Date.now());
  const verifyImages = options.verifyImages ?? true;

  // Object URLs created by this tab, by photo, rendition and upload number.
  const urls = new Map<string, string>();
  let blobCounter = 0;

  async function pause(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new ApiRequestError('aborted', 'The request was cancelled.');
    if (latencyMs <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, latencyMs);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new ApiRequestError('aborted', 'The request was cancelled.'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  function createUrl(blob: Blob): string {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(blob);
    }
    blobCounter++;
    return `mock://object/${blobCounter}`;
  }

  function revokeUrls(match: (key: string) => boolean): void {
    for (const [key, url] of urls) {
      if (!match(key)) continue;
      if (url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
      urls.delete(key);
    }
  }

  async function urlFor(photo: PhotoRec, rendition: Rendition): Promise<string> {
    const key = `${photo.id}:${rendition}:${photo.seq}`;
    const cached = urls.get(key);
    if (cached) return cached;
    const blob = await storage.getBlob(blobKey(photo.id, rendition));
    if (!blob) return '';
    const url = createUrl(blob);
    urls.set(key, url);
    return url;
  }

  // -------------------------------------------------------------------------
  // Transactions: load the latest state, run, save any change, under a cross-tab lock
  // -------------------------------------------------------------------------

  let tail: Promise<unknown> = Promise.resolve();

  function transact<T>(fn: (state: DemoState) => Promise<T>): Promise<T> {
    const task = tail.then(() => storage.lock(() => execute(fn)));
    tail = task.catch(() => undefined);
    return task;
  }

  async function execute<T>(fn: (state: DemoState) => Promise<T>): Promise<T> {
    const state = parseState(await storage.loadState());
    const baseline = JSON.stringify(state);

    let outcome: { ok: true; value: T } | { ok: false; error: unknown };
    try {
      await pruneExpired(state);
      outcome = { ok: true, value: await fn(state) };
    } catch (error) {
      outcome = { ok: false, error: error instanceof DemoStorageFullError ? storageFull() : error };
    }

    // Saved even when the call failed: a refused photo, for example, has been discarded.
    const after = JSON.stringify(state);
    if (after !== baseline) {
      try {
        await storage.saveState(after);
      } catch (error) {
        throw error instanceof DemoStorageFullError ? storageFull() : error;
      }
    }
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  }

  /** Expired museums are gone for good, and their photo bytes are freed. */
  async function pruneExpired(state: DemoState): Promise<void> {
    for (const museum of Object.values(state.museums)) {
      if (museum.expiresAt > now()) continue;
      await removeMuseum(state, museum);
    }
  }

  async function removePhoto(state: DemoState, photo: PhotoRec): Promise<void> {
    delete state.photos[photo.id];
    revokeUrls((key) => key.startsWith(`${photo.id}:`));
    await storage.deleteBlobs([blobKey(photo.id, 'full'), blobKey(photo.id, 'wall')]);
  }

  async function removeMuseum(state: DemoState, museum: MuseumRec): Promise<void> {
    for (const photo of photosOf(state, museum.key)) await removePhoto(state, photo);
    delete state.museums[museum.key];
  }

  function photosOf(state: DemoState, museumKey: string): PhotoRec[] {
    return Object.values(state.photos)
      .filter((p) => p.museumKey === museumKey)
      .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.createdAt - b.createdAt);
  }

  const usedBytes = (state: DemoState) =>
    Object.values(state.photos).reduce((sum, p) => sum + p.fullBytes + p.wallBytes, 0);

  async function capacity(): Promise<number> {
    const { capacityBytes } = await storage.info();
    return Math.min(capacityBytes, options.maxBytes ?? Infinity);
  }

  async function toMuseumPhotos(list: PhotoRec[]): Promise<MuseumPhoto[]> {
    const out: MuseumPhoto[] = [];
    for (const [index, p] of list.entries()) {
      out.push({
        id: p.id,
        position: p.position ?? index,
        caption: p.caption,
        width: p.width ?? 1,
        height: p.height ?? 1,
        lqip: p.lqip ?? '',
        wallUrl: await urlFor(p, 'wall'),
        fullUrl: await urlFor(p, 'full'),
      });
    }
    return out;
  }

  function ticketFor(photo: PhotoRec): PhotoUploadTicket {
    photo.uploadUntil = now() + UPLOAD_TTL_MS;
    const nonce = base64UrlEncode(globalThis.crypto.getRandomValues(new Uint8Array(6)));
    return {
      photoId: photo.id,
      full: { signedUrl: `mock://upload/${photo.id}/full?t=${nonce}` },
      wall: { signedUrl: `mock://upload/${photo.id}/wall?t=${nonce}` },
      expiresAt: new Date(photo.uploadUntil).toISOString(),
    };
  }

  async function bytesOf(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer());
  }

  // -------------------------------------------------------------------------

  async function manage(request: ManageMuseumRequest, signal?: AbortSignal): Promise<unknown> {
    await pause(signal);
    const parsed = parseManageRequest(request);
    if (!parsed.ok) {
      if (parsed.kind === 'bad_token') throw notFound();
      throw fail('bad_request', parsed.message, parsed.field);
    }
    const req = parsed.value;
    const key = bytesToHex(await hashToken(req.editToken));
    const shareToken =
      req.action === 'get' || req.action === 'publish' ? await deriveShareToken(req.editToken) : '';

    return transact(async (state) => {
      const museum = state.museums[key];
      if (!museum || museum.expiresAt <= now()) throw notFound();

      switch (req.action) {
        case 'get': {
          const ready = photosOf(state, key).filter((p) => p.status === 'ready');
          const published = museum.status === 'published' && museum.document !== null;
          const response: ManageGetResponse = {
            status: museum.status,
            shareToken: museum.status === 'published' ? shareToken : null,
            document: published
              ? {
                  ...(museum.document as Omit<MuseumDocument, 'photos'>),
                  visitorAvatar: withGender((museum.document as MuseumDocument).visitorAvatar),
                  guideAvatar: withGender((museum.document as MuseumDocument).guideAvatar),
                  photos: ready
                    .filter((p) => p.position !== null)
                    .map((p) => ({ photoId: p.id, caption: p.caption })),
                }
              : null,
            photos: await toMuseumPhotos(ready),
            publishedAt:
              museum.publishedAt === null ? null : new Date(museum.publishedAt).toISOString(),
            expiresAt: new Date(museum.expiresAt).toISOString(),
          };
          return response;
        }

        case 'reserve-photo': {
          if (photosOf(state, key).length >= LIMITS.maxPhotos) {
            throw fail('photo_limit', 'A museum can hold at most 20 photos.');
          }
          if (museum.reservations >= LIMITS.maxPhotoReservations) {
            throw fail('upload_quota', 'This museum has used all of its photo uploads.');
          }
          museum.reservations++;
          const photo: PhotoRec = {
            id: uuid(),
            museumKey: key,
            status: 'pending',
            position: null,
            caption: '',
            width: null,
            height: null,
            lqip: null,
            createdAt: now() + Object.keys(state.photos).length,
            uploadUntil: 0,
            fullBytes: 0,
            wallBytes: 0,
            seq: 0,
          };
          state.photos[photo.id] = photo;
          return ticketFor(photo);
        }

        case 'renew-upload': {
          const photo = state.photos[req.photoId];
          if (!photo || photo.museumKey !== key) throw fail('not_found', 'Photo not found.');
          if (photo.status === 'ready') {
            throw fail('conflict', 'This photo has already been uploaded.');
          }
          return ticketFor(photo);
        }

        case 'confirm-photo': {
          const photo = state.photos[req.photoId];
          if (!photo || photo.museumKey !== key) throw fail('not_found', 'Photo not found.');
          const ok: ConfirmPhotoResponse = { photoId: photo.id, status: 'ready' };
          if (photo.status === 'ready') return ok;

          if (!checkLqipDataUrl(req.lqip).ok) {
            throw fail('bad_request', 'The photo placeholder is not a clean JPEG.', 'lqip');
          }
          const [full, wall] = await Promise.all([
            storage.getBlob(blobKey(photo.id, 'full')),
            storage.getBlob(blobKey(photo.id, 'wall')),
          ]);
          if (!full || !wall) {
            throw fail('conflict', 'The photo has not finished uploading.', full ? 'wall' : 'full');
          }
          if (verifyImages) {
            const reject = async (message: string, field: string): Promise<never> => {
              await storage.deleteBlobs([blobKey(photo.id, 'full'), blobKey(photo.id, 'wall')]);
              revokeUrls((k) => k.startsWith(`${photo.id}:`));
              photo.fullBytes = 0;
              photo.wallBytes = 0;
              photo.seq++;
              throw fail('invalid_image', message, field);
            };
            const fullCheck = checkJpeg(await bytesOf(full), FULL_RENDITION);
            if (!fullCheck.ok) return reject(JPEG_REJECTION_MESSAGES[fullCheck.reason], 'full');
            const wallCheck = checkJpeg(await bytesOf(wall), WALL_RENDITION);
            if (!wallCheck.ok) return reject(JPEG_REJECTION_MESSAGES[wallCheck.reason], 'wall');
            if (fullCheck.info.width !== req.width || fullCheck.info.height !== req.height) {
              return reject('The photo size does not match the size reported.', 'width');
            }
            if (!proportionsMatch(fullCheck.info, wallCheck.info)) {
              return reject('The two versions of the photo do not match.', 'wall');
            }
          }
          photo.status = 'ready';
          photo.width = req.width;
          photo.height = req.height;
          photo.lqip = req.lqip;
          return ok;
        }

        case 'remove-photo': {
          const photo = state.photos[req.photoId];
          const response: RemovePhotoResponse = { photoId: req.photoId, removed: true };
          if (!photo || photo.museumKey !== key) return response;
          if (museum.status === 'published' && photo.position !== null) {
            throw fail(
              'conflict',
              'This photo is part of the published museum. Publish a new version without it instead.',
            );
          }
          await removePhoto(state, photo);
          return response;
        }

        case 'publish': {
          const doc = req.document;
          const mine = new Map(photosOf(state, key).map((p) => [p.id, p]));
          for (let i = 0; i < doc.photos.length; i++) {
            const entry = doc.photos[i];
            const photo = entry ? mine.get(entry.photoId) : undefined;
            if (!photo || photo.status !== 'ready') {
              throw fail(
                'conflict',
                'A photo is not ready. Wait for uploads to finish.',
                `document.photos[${i}].photoId`,
              );
            }
          }
          const keep = new Set(doc.photos.map((p) => p.photoId));
          for (const photo of mine.values())
            if (!keep.has(photo.id)) await removePhoto(state, photo);
          doc.photos.forEach((entry, index) => {
            const photo = state.photos[entry.photoId];
            if (photo) {
              photo.position = index;
              photo.caption = entry.caption;
            }
          });
          const { photos: _photos, ...rest } = doc;
          museum.document = rest;
          museum.status = 'published';
          if (museum.publishedAt === null) {
            museum.publishedAt = now();
            museum.expiresAt = museum.publishedAt + LIMITS.retentionDays * DAY_MS;
          }
          const response: PublishResponse = {
            shareToken,
            publishedAt: new Date(museum.publishedAt).toISOString(),
            expiresAt: new Date(museum.expiresAt).toISOString(),
          };
          return response;
        }

        case 'delete': {
          await removeMuseum(state, museum);
          const response: DeleteResponse = { deleted: true };
          return response;
        }
      }
    });
  }

  return {
    kind: 'mock',

    async reset() {
      // Queued behind in-flight calls and under the cross-tab lock. Not a normal transaction,
      // because that would write the state it loaded back after the clear.
      const task = tail.then(() => storage.lock(() => storage.clear()));
      tail = task.catch(() => undefined);
      await task;
      revokeUrls(() => true);
    },

    async info(): Promise<DemoDataInfo> {
      const { kind, capacityBytes } = await storage.info();
      const state = parseState(await storage.loadState());
      const live = Object.values(state.museums).filter((m) => m.expiresAt > now());
      return {
        storage: kind,
        museums: live.length,
        photos: Object.keys(state.photos).length,
        usedBytes: usedBytes(state),
        capacityBytes: Math.min(capacityBytes, options.maxBytes ?? Infinity),
      };
    },

    async createMuseum(signal): Promise<CreateMuseumResponse> {
      await pause(signal);
      const tokens = await createTokenPair();
      const key = bytesToHex(tokens.editTokenHash);
      const expiresAt = now() + LIMITS.draftRetentionDays * DAY_MS;
      await transact(async (state) => {
        state.museums[key] = {
          key,
          shareKey: bytesToHex(tokens.shareTokenHash),
          status: 'draft',
          document: null,
          publishedAt: null,
          expiresAt,
          reservations: 0,
        };
      });
      return { editToken: tokens.editToken, draftExpiresAt: new Date(expiresAt).toISOString() };
    },

    async getMuseum(shareToken, signal): Promise<GetMuseumResponse> {
      await pause(signal);
      if (!isShareToken(shareToken)) throw notFound();
      const shareKey = bytesToHex(await hashToken(shareToken));
      return transact(async (state) => {
        const museum = Object.values(state.museums).find((m) => m.shareKey === shareKey);
        if (
          !museum ||
          museum.expiresAt <= now() ||
          museum.status !== 'published' ||
          !museum.document
        ) {
          throw notFound();
        }
        const content: MuseumContent = {
          ...museum.document,
          visitorAvatar: withGender(museum.document.visitorAvatar),
          guideAvatar: withGender(museum.document.guideAvatar),
          photos: await toMuseumPhotos(
            photosOf(state, museum.key).filter((p) => p.status === 'ready' && p.position !== null),
          ),
        };
        return {
          museum: content,
          urlsExpireAt: new Date(now() + LIMITS.signedUrlTtlSeconds * 1000).toISOString(),
        };
      });
    },

    manageGet: (editToken, signal) =>
      manage({ action: 'get', editToken }, signal) as Promise<ManageGetResponse>,
    reservePhoto: (editToken, signal) =>
      manage({ action: 'reserve-photo', editToken }, signal) as Promise<PhotoUploadTicket>,
    renewUpload: (editToken, photoId, signal) =>
      manage({ action: 'renew-upload', editToken, photoId }, signal) as Promise<PhotoUploadTicket>,
    confirmPhoto: (editToken, input: ConfirmPhotoInput, signal) =>
      manage(
        {
          action: 'confirm-photo',
          editToken,
          photoId: input.photoId,
          width: input.width,
          height: input.height,
          lqip: input.lqip,
        },
        signal,
      ) as Promise<ConfirmPhotoResponse>,
    removePhoto: (editToken, photoId, signal) =>
      manage(
        { action: 'remove-photo', editToken, photoId },
        signal,
      ) as Promise<RemovePhotoResponse>,
    publish: (editToken, document, signal) =>
      manage({ action: 'publish', editToken, document }, signal) as Promise<PublishResponse>,
    deleteMuseum: (editToken, signal) =>
      manage({ action: 'delete', editToken }, signal) as Promise<DeleteResponse>,

    async uploadPhotoFile(signedUrl, blob, onProgress, signal): Promise<void> {
      const match = /^mock:\/\/upload\/([0-9a-f-]{36})\/(full|wall)\?/.exec(signedUrl);
      const refuse = (status: number) =>
        new ApiRequestError('server_error', 'The photo upload was refused.', { status });
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        await pause(signal);
        onProgress((i / steps) * 0.99);
      }
      if (!match?.[1]) throw refuse(403);
      const photoId = match[1];
      const rendition = match[2] as Rendition;
      await transact(async (state) => {
        const photo = state.photos[photoId];
        // Mirrors Storage: an unknown or expired signed URL is refused, and so is a file over 2 MiB.
        if (!photo || photo.uploadUntil < now()) throw refuse(403);
        if (blob.size > LIMITS.maxStoredFileBytes) throw refuse(413);
        const previous = rendition === 'full' ? photo.fullBytes : photo.wallBytes;
        if (usedBytes(state) - previous + blob.size > (await capacity())) throw storageFull();
        await storage.putBlob(blobKey(photoId, rendition), blob);
        if (rendition === 'full') photo.fullBytes = blob.size;
        else photo.wallBytes = blob.size;
        photo.seq++;
        revokeUrls((key) => key.startsWith(`${photoId}:`));
      });
      onProgress(1);
    },
  };
}
