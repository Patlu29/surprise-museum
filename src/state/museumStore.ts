import { create } from 'zustand';
import type { MuseumContent } from '@contract';
import type { ApiFailureCode } from '@/lib/apiPort';
import { getApi, isApiError } from '@/lib/apiPort';
import { isShareToken } from '@/lib/links';

/**
 * The museum being visited or previewed (architecture section 8).
 *
 * Read by: the scene (`content` for layout, avatars and photos; `photoStatus` is written back),
 * the UI (welcome, captions, viewer, pictures list).
 * The scene writes: `setPhotoStatus` (from PhotoLoader) and `refreshUrls()` (when signed URLs
 * near `urlsExpireAt`, or a texture request returns 400 or 403 after it; keeps photo ids and
 * order, replaces only `wallUrl` and `fullUrl`).
 * The scene reads `retryRequest` (a counter-style command): when `seq` changes, retry that photo's
 * download from the start (reset its attempts).
 *
 * Title: `content.title` may be an empty string. Show it with `effectiveTitle()` from
 * `@/state/draft` ("A museum for {Visitor}") on the plaque and everywhere else.
 */

export type MuseumLoadStatus = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';
export type MuseumSource = 'published' | 'preview';
export type PhotoLoadStatus = 'placeholder' | 'loading' | 'loaded' | 'failed';

export interface MuseumState {
  status: MuseumLoadStatus;
  source: MuseumSource | null;
  content: MuseumContent | null;
  /** ISO 8601 expiry of the signed photo URLs. Null for previews. */
  urlsExpireAt: string | null;
  /** Why `status` is 'error', for the message. */
  errorCode: ApiFailureCode | null;
  photoStatus: Readonly<Record<string, PhotoLoadStatus>>;
  retryRequest: { photoId: string; seq: number } | null;

  loadPublished: (shareToken: string) => Promise<void>;
  setPreview: (content: MuseumContent) => void;
  refreshUrls: () => Promise<boolean>;
  setPhotoStatus: (photoId: string, status: PhotoLoadStatus) => void;
  requestPhotoRetry: (photoId: string) => void;
  clear: () => void;
}

let loadController: AbortController | null = null;
let lastShareToken: string | null = null;

const emptyValues = {
  status: 'idle' as MuseumLoadStatus,
  source: null as MuseumSource | null,
  content: null as MuseumContent | null,
  urlsExpireAt: null as string | null,
  errorCode: null as ApiFailureCode | null,
  photoStatus: {} as Readonly<Record<string, PhotoLoadStatus>>,
  retryRequest: null as { photoId: string; seq: number } | null,
};

export const useMuseumStore = create<MuseumState>()((set, get) => ({
  ...emptyValues,

  loadPublished: async (shareToken) => {
    loadController?.abort();
    lastShareToken = shareToken;
    if (!isShareToken(shareToken)) {
      // A malformed token cannot exist, so skip the network (the server answers the same way).
      set({ ...emptyValues, status: 'not-found', source: 'published' });
      return;
    }
    const controller = new AbortController();
    loadController = controller;
    set({ ...emptyValues, status: 'loading', source: 'published' });
    try {
      const response = await getApi().getMuseum(shareToken, controller.signal);
      if (controller.signal.aborted) return;
      set({
        status: 'ready',
        source: 'published',
        content: response.museum,
        urlsExpireAt: response.urlsExpireAt,
        errorCode: null,
        photoStatus: Object.fromEntries(
          response.museum.photos.map((photo) => [photo.id, 'placeholder' as const]),
        ),
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isApiError(error) && error.code === 'not_found') {
        set({ ...emptyValues, status: 'not-found', source: 'published' });
      } else {
        set({
          ...emptyValues,
          status: 'error',
          source: 'published',
          errorCode: isApiError(error) ? error.code : 'network',
        });
      }
    }
  },

  setPreview: (content) => {
    loadController?.abort();
    set({
      ...emptyValues,
      status: 'ready',
      source: 'preview',
      content,
      photoStatus: Object.fromEntries(
        content.photos.map((photo) => [photo.id, 'placeholder' as const]),
      ),
    });
  },

  refreshUrls: async () => {
    const { source, content } = get();
    if (source !== 'published' || !content || !lastShareToken) return false;
    try {
      const response = await getApi().getMuseum(lastShareToken);
      const fresh = new Map(response.museum.photos.map((photo) => [photo.id, photo]));
      set((state) =>
        state.content
          ? {
              urlsExpireAt: response.urlsExpireAt,
              content: {
                ...state.content,
                photos: state.content.photos.map((photo) => {
                  const next = fresh.get(photo.id);
                  return next ? { ...photo, wallUrl: next.wallUrl, fullUrl: next.fullUrl } : photo;
                }),
              },
            }
          : state,
      );
      return true;
    } catch {
      return false;
    }
  },

  setPhotoStatus: (photoId, status) =>
    set((state) =>
      state.photoStatus[photoId] === status
        ? state
        : { photoStatus: { ...state.photoStatus, [photoId]: status } },
    ),

  requestPhotoRetry: (photoId) =>
    set((state) => ({
      retryRequest: { photoId, seq: (state.retryRequest?.seq ?? 0) + 1 },
      // Show the retrying state straight away; the scene then reports loading and loaded.
      photoStatus: { ...state.photoStatus, [photoId]: 'loading' },
    })),

  clear: () => {
    loadController?.abort();
    loadController = null;
    lastShareToken = null;
    set({ ...emptyValues });
  },
}));
