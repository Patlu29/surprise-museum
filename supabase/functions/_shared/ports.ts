/**
 * The two things the handlers depend on: a data store and a photo storage. Real implementations
 * wrap supabase-js (supabaseBackend.ts); tests use the in-memory ones (testing/memoryBackend.ts).
 * Keeping the handlers behind these interfaces lets every access rule be tested without a project.
 */
import type { AvatarConfig, MuseumStatus, MuseumTheme } from '@contract';

export interface MuseumRecord {
  id: string;
  status: MuseumStatus;
  title: string;
  visitorName: string | null;
  guideName: string | null;
  openingGreeting: string;
  closingMessage: string;
  theme: MuseumTheme;
  visitorAvatar: AvatarConfig | null;
  guideAvatar: AvatarConfig | null;
  publishedAt: string | null;
  expiresAt: string;
}

export interface PhotoRecord {
  id: string;
  museumId: string;
  status: 'pending' | 'ready';
  /** Null until the photo is part of a published document. */
  position: number | null;
  caption: string;
  width: number | null;
  height: number | null;
  lqip: string | null;
  createdAt: string;
}

export interface PublishInput {
  title: string;
  visitorName: string;
  guideName: string;
  openingGreeting: string;
  closingMessage: string;
  theme: MuseumTheme;
  visitorAvatar: AvatarConfig;
  guideAvatar: AvatarConfig;
  /** In route order. */
  photos: Array<{ id: string; caption: string }>;
  retentionDays: number;
}

export interface PublishResult {
  publishedAt: string;
  expiresAt: string;
  /** Photos that were not in the document and have been deleted; their objects need removing. */
  removedPhotoIds: string[];
}

export interface MuseumStore {
  insertMuseum(input: {
    editTokenHash: Uint8Array;
    shareTokenHash: Uint8Array;
    expiresAt: string;
  }): Promise<void>;
  /** Live means not yet expired. Drafts and published museums both match. */
  findLiveByEditHash(hash: Uint8Array, now: Date): Promise<MuseumRecord | null>;
  /** Only published, unexpired museums match. */
  findPublishedByShareHash(hash: Uint8Array, now: Date): Promise<MuseumRecord | null>;
  /** Ordered by position (unpositioned last), then creation time. */
  listPhotos(museumId: string, status?: 'pending' | 'ready'): Promise<PhotoRecord[]>;
  findPhoto(museumId: string, photoId: string): Promise<PhotoRecord | null>;
  /** Throws ApiException photo_limit, upload_quota or not_found. */
  reservePhoto(museumId: string): Promise<string>;
  markPhotoReady(
    museumId: string,
    photoId: string,
    fields: { width: number; height: number; lqip: string },
  ): Promise<void>;
  deletePhoto(museumId: string, photoId: string): Promise<void>;
  /** Throws ApiException conflict when a photo is missing or not ready. */
  publish(museumId: string, input: PublishInput): Promise<PublishResult>;
  /** Deletes the rows and queues the storage prefix, atomically. */
  deleteMuseum(museumId: string): Promise<void>;

  rateLimitHit(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;
  rateLimitBlocked(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;

  /** Deletes expired museums (queueing their storage) and returns their ids. */
  expireMuseums(limit: number): Promise<string[]>;
  listPurgeQueue(limit: number): Promise<string[]>;
  clearPurgeQueueEntry(museumId: string): Promise<void>;
  recordPurgeFailure(museumId: string, message: string): Promise<void>;
}

export type DownloadResult =
  { kind: 'ok'; bytes: Uint8Array } | { kind: 'missing' } | { kind: 'too_large' };

export interface PhotoStorage {
  /** A full URL the browser can PUT to (valid 2 hours). Overwrites an existing object. */
  createUploadUrl(path: string): Promise<string>;
  /** Signed read URLs, in the same order as `paths`. */
  createDownloadUrls(paths: string[], ttlSeconds: number): Promise<string[]>;
  download(path: string, maxBytes: number): Promise<DownloadResult>;
  /** Removes objects. Missing objects are not an error. */
  remove(paths: string[]): Promise<void>;
  /** Removes every object under `<prefix>/`, however deep. */
  removePrefix(prefix: string): Promise<void>;
}

export const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

export function photoPaths(museumId: string, photoId: string): { full: string; wall: string } {
  const base = `${museumId}/${photoId}`;
  return { full: `${base}/full.jpg`, wall: `${base}/wall.jpg` };
}
