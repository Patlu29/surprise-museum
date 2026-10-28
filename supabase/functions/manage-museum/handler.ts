/**
 * manage-museum: everything the edit token allows. One endpoint, discriminated on `action`:
 * get, reserve-photo, renew-upload, confirm-photo, remove-photo, publish, delete.
 *
 * Authorisation: the edit token in the body is hashed and looked up; no other credential exists.
 * A malformed, unknown, expired or deleted token returns the same 404 as a bad share link, and
 * counts toward the per-IP miss limit. docs/api.md, "manage-museum".
 */
import {
  LIMITS,
  type ConfirmPhotoResponse,
  type DeleteResponse,
  type ManageGetResponse,
  type ManageMuseumRequest,
  type PhotoUploadTicket,
  type PublishResponse,
  type RemovePhotoResponse,
} from '@contract';
import {
  ApiException,
  createEndpoint,
  enforceLimit,
  notFound,
  tooManyRequests,
  type BaseDeps,
  type EndpointResult,
} from '../_shared/http.ts';
import { checkJpeg, checkLqipDataUrl, JPEG_REJECTION_MESSAGES } from '../_shared/jpeg.ts';
import {
  photoPaths,
  UPLOAD_URL_TTL_SECONDS,
  type MuseumRecord,
  type PhotoStorage,
} from '../_shared/ports.ts';
import { toMuseumDocument, toMuseumPhotos } from '../_shared/present.ts';
import { deriveShareToken, hashToken } from '../_shared/tokens.ts';
import {
  FULL_RENDITION,
  parseManageRequest,
  proportionsMatch,
  WALL_RENDITION,
} from '../_shared/validate.ts';

export const IP_LIMIT = { limit: 120, windowSeconds: 60 } as const;
export const MUSEUM_LIMIT = { limit: 600, windowSeconds: 3600 } as const;
export const MISS_LIMIT = { limit: 20, windowSeconds: 600 } as const;

export interface ManageMuseumDeps extends BaseDeps {
  storage: PhotoStorage;
}

export function createManageMuseumHandler(deps: ManageMuseumDeps) {
  const { store, storage } = deps;

  return createEndpoint(
    deps,
    { name: 'manage-museum', cors: true, requireJson: true },
    async (ctx) => {
      const now = ctx.now();
      const ip = await ctx.ipHash();

      await enforceLimit(store, now, `manage:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowSeconds);
      if (await store.rateLimitBlocked(`miss:${ip}`, MISS_LIMIT.limit, MISS_LIMIT.windowSeconds)) {
        throw tooManyRequests(now, MISS_LIMIT.windowSeconds);
      }

      const miss = async (): Promise<never> => {
        await store.rateLimitHit(`miss:${ip}`, MISS_LIMIT.limit, MISS_LIMIT.windowSeconds);
        throw notFound();
      };

      const parsed = parseManageRequest(await ctx.json());
      if (!parsed.ok) {
        if (parsed.kind === 'bad_token') return miss();
        throw new ApiException('bad_request', parsed.message, { field: parsed.field });
      }
      const request = parsed.value;

      const museum = await store.findLiveByEditHash(await hashToken(request.editToken), now);
      if (!museum) return miss();
      await enforceLimit(
        store,
        now,
        `museum:${museum.id}`,
        MUSEUM_LIMIT.limit,
        MUSEUM_LIMIT.windowSeconds,
      );

      return dispatch(request, museum, now);
    },
  );

  // -------------------------------------------------------------------------

  async function dispatch(
    request: ManageMuseumRequest,
    museum: MuseumRecord,
    now: Date,
  ): Promise<EndpointResult> {
    switch (request.action) {
      case 'get':
        return { status: 200, body: await getForEdit(request.editToken, museum) };
      case 'reserve-photo':
        return { status: 201, body: await reservePhoto(museum, now) };
      case 'renew-upload':
        return { status: 200, body: await renewUpload(museum, request.photoId, now) };
      case 'confirm-photo':
        return { status: 200, body: await confirmPhoto(museum, request) };
      case 'remove-photo':
        return { status: 200, body: await removePhoto(museum, request.photoId) };
      case 'publish':
        return { status: 200, body: await publish(museum, request) };
      case 'delete':
        return { status: 200, body: await deleteMuseum(museum) };
    }
  }

  async function getForEdit(editToken: string, museum: MuseumRecord): Promise<ManageGetResponse> {
    const ready = await store.listPhotos(museum.id, 'ready');
    const published = museum.status === 'published';
    return {
      status: museum.status,
      shareToken: published ? await deriveShareToken(editToken) : null,
      document: toMuseumDocument(
        museum,
        ready.filter((p) => p.position !== null),
      ),
      photos: await toMuseumPhotos(storage, ready),
      publishedAt: museum.publishedAt,
      expiresAt: museum.expiresAt,
    };
  }

  async function ticketFor(
    museumId: string,
    photoId: string,
    now: Date,
  ): Promise<PhotoUploadTicket> {
    const paths = photoPaths(museumId, photoId);
    const [full, wall] = await Promise.all([
      storage.createUploadUrl(paths.full),
      storage.createUploadUrl(paths.wall),
    ]);
    return {
      photoId,
      full: { signedUrl: full },
      wall: { signedUrl: wall },
      expiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async function reservePhoto(museum: MuseumRecord, now: Date): Promise<PhotoUploadTicket> {
    const photoId = await store.reservePhoto(museum.id);
    return ticketFor(museum.id, photoId, now);
  }

  async function renewUpload(
    museum: MuseumRecord,
    photoId: string,
    now: Date,
  ): Promise<PhotoUploadTicket> {
    const photo = await store.findPhoto(museum.id, photoId);
    if (!photo) throw new ApiException('not_found', 'Photo not found.');
    if (photo.status === 'ready') {
      throw new ApiException('conflict', 'This photo has already been uploaded.');
    }
    return ticketFor(museum.id, photoId, now);
  }

  async function confirmPhoto(
    museum: MuseumRecord,
    request: Extract<ManageMuseumRequest, { action: 'confirm-photo' }>,
  ): Promise<ConfirmPhotoResponse> {
    const photo = await store.findPhoto(museum.id, request.photoId);
    if (!photo) throw new ApiException('not_found', 'Photo not found.');
    if (photo.status === 'ready') return { photoId: photo.id, status: 'ready' };

    // The placeholder is the Creator's value, not a stored object: a bad one is a bad request and
    // leaves any uploaded objects alone.
    const lqip = checkLqipDataUrl(request.lqip);
    if (!lqip.ok) {
      throw new ApiException('bad_request', 'The photo placeholder is not a clean JPEG.', {
        field: 'lqip',
      });
    }

    const paths = photoPaths(museum.id, photo.id);
    const [full, wall] = await Promise.all([
      storage.download(paths.full, LIMITS.maxStoredFileBytes),
      storage.download(paths.wall, LIMITS.maxStoredFileBytes),
    ]);
    if (full.kind === 'missing' || wall.kind === 'missing') {
      throw new ApiException('conflict', 'The photo has not finished uploading.', {
        field: full.kind === 'missing' ? 'full' : 'wall',
      });
    }

    const rejectImage = async (message: string, field: string): Promise<never> => {
      // Remove both objects so unsafe bytes do not linger. The reservation stays, so the Creator
      // can ask for new upload URLs (renew-upload) and try again, or remove the photo.
      await storage.remove([paths.full, paths.wall]).catch(() => undefined);
      throw new ApiException('invalid_image', message, { field });
    };

    if (full.kind === 'too_large') return rejectImage(JPEG_REJECTION_MESSAGES.too_large, 'full');
    if (wall.kind === 'too_large') return rejectImage(JPEG_REJECTION_MESSAGES.too_large, 'wall');

    const fullCheck = checkJpeg(full.bytes, FULL_RENDITION);
    if (!fullCheck.ok) return rejectImage(JPEG_REJECTION_MESSAGES[fullCheck.reason], 'full');
    const wallCheck = checkJpeg(wall.bytes, WALL_RENDITION);
    if (!wallCheck.ok) return rejectImage(JPEG_REJECTION_MESSAGES[wallCheck.reason], 'wall');

    if (fullCheck.info.width !== request.width || fullCheck.info.height !== request.height) {
      return rejectImage('The photo size does not match the size reported.', 'width');
    }
    if (!proportionsMatch(fullCheck.info, wallCheck.info)) {
      return rejectImage('The two versions of the photo do not match.', 'wall');
    }

    await store.markPhotoReady(museum.id, photo.id, {
      width: request.width,
      height: request.height,
      lqip: request.lqip,
    });
    return { photoId: photo.id, status: 'ready' };
  }

  async function removePhoto(museum: MuseumRecord, photoId: string): Promise<RemovePhotoResponse> {
    const photo = await store.findPhoto(museum.id, photoId);
    // Removing a photo that is already gone succeeds, so a retry after a dropped response is safe.
    if (!photo) return { photoId, removed: true };
    if (museum.status === 'published' && photo.position !== null) {
      throw new ApiException(
        'conflict',
        'This photo is part of the published museum. Publish a new version without it instead.',
      );
    }
    await store.deletePhoto(museum.id, photoId);
    const paths = photoPaths(museum.id, photoId);
    // The row is gone, so the photo is already unreachable. Objects that survive a storage error
    // are removed with the rest of the museum's files when it expires or is deleted.
    await storage.remove([paths.full, paths.wall]).catch(() => undefined);
    return { photoId, removed: true };
  }

  async function publish(
    museum: MuseumRecord,
    request: Extract<ManageMuseumRequest, { action: 'publish' }>,
  ): Promise<PublishResponse> {
    const doc = request.document;

    // A precise error for the common mistake (publishing before an upload has finished). The
    // database function checks again inside its transaction, which is what actually guards it.
    const known = new Map((await store.listPhotos(museum.id)).map((p) => [p.id, p]));
    for (let i = 0; i < doc.photos.length; i++) {
      const entry = doc.photos[i];
      const photo = entry ? known.get(entry.photoId) : undefined;
      if (!photo || photo.status !== 'ready') {
        throw new ApiException('conflict', 'A photo is not ready. Wait for uploads to finish.', {
          field: `document.photos[${i}].photoId`,
        });
      }
    }

    const result = await store.publish(museum.id, {
      title: doc.title,
      visitorName: doc.visitorName,
      guideName: doc.guideName,
      openingGreeting: doc.openingGreeting,
      closingMessage: doc.closingMessage,
      theme: doc.theme,
      visitorAvatar: doc.visitorAvatar,
      guideAvatar: doc.guideAvatar,
      photos: doc.photos.map((p) => ({ id: p.photoId, caption: p.caption })),
      retentionDays: LIMITS.retentionDays,
    });

    if (result.removedPhotoIds.length > 0) {
      const paths = result.removedPhotoIds.flatMap((id) => {
        const p = photoPaths(museum.id, id);
        return [p.full, p.wall];
      });
      await storage.remove(paths).catch(() => undefined);
    }

    return {
      shareToken: await deriveShareToken(request.editToken),
      publishedAt: result.publishedAt,
      expiresAt: result.expiresAt,
    };
  }

  async function deleteMuseum(museum: MuseumRecord): Promise<DeleteResponse> {
    // Rows first: from this point the share and edit links return not found (FR-52).
    await store.deleteMuseum(museum.id);
    try {
      await storage.removePrefix(museum.id);
      await store.clearPurgeQueueEntry(museum.id);
    } catch {
      // The museum is already queued for storage clean-up; purge-expired retries it every hour.
    }
    return { deleted: true };
  }
}
