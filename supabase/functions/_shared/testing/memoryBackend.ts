/**
 * In-memory MuseumStore and PhotoStorage for tests. They follow the same rules as the SQL
 * functions in supabase/migrations (photo limits, publish checks, expiry), so handler tests
 * exercise real access rules without a Supabase project. Test-only: never imported by an index.ts.
 */
import { ApiException } from '../http.ts';
import type {
  DownloadResult,
  MuseumRecord,
  MuseumStore,
  PhotoRecord,
  PhotoStorage,
  PublishInput,
  PublishResult,
} from '../ports.ts';
import { bytesToHex } from '../tokens.ts';

interface MuseumRow extends MuseumRecord {
  editHash: string;
  shareHash: string;
  reservations: number;
}

export class MemoryBackend {
  readonly museums = new Map<string, MuseumRow>();
  readonly photos = new Map<string, PhotoRecord>();
  readonly purgeQueue = new Map<string, { attempts: number; lastError: string | null }>();
  readonly rateHits = new Map<string, number>();
  readonly objects = new Map<string, Uint8Array>();
  /** Set to make storage removal fail, to test the retry queue. */
  failStorageRemoval = false;
  now: () => Date = () => new Date();
  private counter = 0;

  newId(): string {
    this.counter++;
    const hex = this.counter.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  }

  private windowKey(bucket: string, windowSeconds: number): string {
    return `${bucket}@${Math.floor(this.now().getTime() / 1000 / windowSeconds)}`;
  }

  readonly store: MuseumStore = {
    insertMuseum: (input) => {
      const id = this.newId();
      this.museums.set(id, {
        id,
        editHash: bytesToHex(input.editTokenHash),
        shareHash: bytesToHex(input.shareTokenHash),
        status: 'draft',
        title: '',
        visitorName: null,
        guideName: null,
        openingGreeting: '',
        closingMessage: '',
        theme: 'default',
        visitorAvatar: null,
        guideAvatar: null,
        publishedAt: null,
        expiresAt: input.expiresAt,
        reservations: 0,
      });
      return Promise.resolve();
    },

    findLiveByEditHash: (hash, now) => {
      const wanted = bytesToHex(hash);
      for (const m of this.museums.values()) {
        if (m.editHash === wanted && new Date(m.expiresAt) > now)
          return Promise.resolve(this.view(m));
      }
      return Promise.resolve(null);
    },

    findPublishedByShareHash: (hash, now) => {
      const wanted = bytesToHex(hash);
      for (const m of this.museums.values()) {
        if (m.shareHash === wanted && m.status === 'published' && new Date(m.expiresAt) > now) {
          return Promise.resolve(this.view(m));
        }
      }
      return Promise.resolve(null);
    },

    listPhotos: (museumId, status) => {
      const list = [...this.photos.values()]
        .filter((p) => p.museumId === museumId && (!status || p.status === status))
        .sort(
          (a, b) =>
            (a.position ?? 1e9) - (b.position ?? 1e9) || a.createdAt.localeCompare(b.createdAt),
        );
      return Promise.resolve(list.map((p) => ({ ...p })));
    },

    findPhoto: (museumId, photoId) => {
      const p = this.photos.get(photoId);
      return Promise.resolve(p && p.museumId === museumId ? { ...p } : null);
    },

    reservePhoto: (museumId) => {
      const m = this.museums.get(museumId);
      if (!m) return Promise.reject(new ApiException('not_found', 'Museum not found.'));
      const live = [...this.photos.values()].filter((p) => p.museumId === museumId).length;
      if (live >= 20) return Promise.reject(new ApiException('photo_limit', 'Photo limit.'));
      if (m.reservations >= 100) return Promise.reject(new ApiException('upload_quota', 'Quota.'));
      m.reservations++;
      const id = this.newId();
      this.photos.set(id, {
        id,
        museumId,
        status: 'pending',
        position: null,
        caption: '',
        width: null,
        height: null,
        lqip: null,
        createdAt: new Date(this.now().getTime() + this.counter).toISOString(),
      });
      return Promise.resolve(id);
    },

    markPhotoReady: (museumId, photoId, fields) => {
      const p = this.photos.get(photoId);
      if (p && p.museumId === museumId) Object.assign(p, { status: 'ready', ...fields });
      return Promise.resolve();
    },

    deletePhoto: (museumId, photoId) => {
      const p = this.photos.get(photoId);
      if (p && p.museumId === museumId) this.photos.delete(photoId);
      return Promise.resolve();
    },

    publish: (museumId, input: PublishInput): Promise<PublishResult> => {
      const m = this.museums.get(museumId);
      if (!m) return Promise.reject(new ApiException('not_found', 'Museum not found.'));
      const ids = input.photos.map((p) => p.id);
      const ready = ids.filter((id) => {
        const p = this.photos.get(id);
        return p && p.museumId === museumId && p.status === 'ready';
      });
      if (new Set(ids).size !== ids.length || ready.length !== ids.length) {
        return Promise.reject(new ApiException('conflict', 'A photo is not ready.'));
      }
      const removed: string[] = [];
      for (const p of [...this.photos.values()]) {
        if (p.museumId === museumId && !ids.includes(p.id)) {
          this.photos.delete(p.id);
          removed.push(p.id);
        }
      }
      input.photos.forEach((entry, index) => {
        const p = this.photos.get(entry.id);
        if (p) Object.assign(p, { position: index, caption: entry.caption });
      });
      const firstPublish = m.publishedAt === null;
      const now = this.now();
      Object.assign(m, {
        status: 'published',
        title: input.title,
        visitorName: input.visitorName,
        guideName: input.guideName,
        openingGreeting: input.openingGreeting,
        closingMessage: input.closingMessage,
        theme: input.theme,
        visitorAvatar: input.visitorAvatar,
        guideAvatar: input.guideAvatar,
        publishedAt: m.publishedAt ?? now.toISOString(),
        expiresAt: firstPublish
          ? new Date(now.getTime() + input.retentionDays * 86_400_000).toISOString()
          : m.expiresAt,
      });
      return Promise.resolve({
        publishedAt: m.publishedAt as string,
        expiresAt: m.expiresAt,
        removedPhotoIds: removed,
      });
    },

    deleteMuseum: (museumId) => {
      this.purgeQueue.set(museumId, { attempts: 0, lastError: null });
      this.museums.delete(museumId);
      for (const p of [...this.photos.values()])
        if (p.museumId === museumId) this.photos.delete(p.id);
      return Promise.resolve();
    },

    rateLimitHit: (bucket, limit, windowSeconds) => {
      const key = this.windowKey(bucket, windowSeconds);
      const hits = (this.rateHits.get(key) ?? 0) + 1;
      this.rateHits.set(key, hits);
      return Promise.resolve(hits <= limit);
    },

    rateLimitBlocked: (bucket, limit, windowSeconds) =>
      Promise.resolve((this.rateHits.get(this.windowKey(bucket, windowSeconds)) ?? 0) >= limit),

    expireMuseums: (limit) => {
      const now = this.now();
      const expired = [...this.museums.values()]
        .filter((m) => new Date(m.expiresAt) <= now)
        .slice(0, limit)
        .map((m) => m.id);
      for (const id of expired) {
        this.purgeQueue.set(id, { attempts: 0, lastError: null });
        this.museums.delete(id);
        for (const p of [...this.photos.values()]) if (p.museumId === id) this.photos.delete(p.id);
      }
      return Promise.resolve(expired);
    },

    listPurgeQueue: (limit) => Promise.resolve([...this.purgeQueue.keys()].slice(0, limit)),
    clearPurgeQueueEntry: (museumId) => {
      this.purgeQueue.delete(museumId);
      return Promise.resolve();
    },
    recordPurgeFailure: (museumId, message) => {
      const entry = this.purgeQueue.get(museumId);
      if (entry) {
        entry.attempts++;
        entry.lastError = message;
      }
      return Promise.resolve();
    },
  };

  readonly storage: PhotoStorage = {
    createUploadUrl: (path) => Promise.resolve(`https://storage.test/upload/${path}?token=t`),
    createDownloadUrls: (paths, ttl) =>
      Promise.resolve(paths.map((p) => `https://storage.test/object/${p}?token=t&ttl=${ttl}`)),
    download: (path, maxBytes): Promise<DownloadResult> => {
      const bytes = this.objects.get(path);
      if (!bytes) return Promise.resolve({ kind: 'missing' });
      if (bytes.length > maxBytes) return Promise.resolve({ kind: 'too_large' });
      return Promise.resolve({ kind: 'ok', bytes });
    },
    remove: (paths) => {
      if (this.failStorageRemoval) return Promise.reject(new Error('storage down'));
      for (const p of paths) this.objects.delete(p);
      return Promise.resolve();
    },
    removePrefix: (prefix) => {
      if (this.failStorageRemoval) return Promise.reject(new Error('storage down'));
      for (const key of [...this.objects.keys()])
        if (key.startsWith(prefix + '/')) this.objects.delete(key);
      return Promise.resolve();
    },
  };

  /** Simulates the browser PUT to a signed upload URL. */
  putToUploadUrl(url: string, bytes: Uint8Array): void {
    const path = new URL(url).pathname.replace('/upload/', '');
    this.objects.set(path, bytes);
  }

  private view(m: MuseumRow): MuseumRecord {
    const { editHash: _e, shareHash: _s, reservations: _r, ...record } = m;
    return { ...record };
  }
}
