/**
 * The real MuseumStore and PhotoStorage, backed by supabase-js with the service-role key.
 * supabase-js is used only here, inside Edge Functions; the browser never bundles it (ADR 0012).
 *
 * Every table in this schema has RLS on with no policies, so only the service role can reach it.
 * Atomic work (reserving a photo, publishing, deleting, expiring, rate limiting) is done by the
 * database functions in supabase/migrations.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiException } from './http.ts';
import type {
  DownloadResult,
  MuseumRecord,
  MuseumStore,
  PhotoRecord,
  PhotoStorage,
  PublishInput,
  PublishResult,
} from './ports.ts';
import { toByteaLiteral } from './tokens.ts';

const BUCKET = 'photos';

const MUSEUM_COLUMNS =
  'id,status,title,visitor_name,guide_name,opening_greeting,closing_message,theme,visitor_avatar,guide_avatar,published_at,expires_at';
const PHOTO_COLUMNS = 'id,museum_id,status,position,caption,width,height,lqip,created_at';

/** A failure from the database or storage. Only the name and code are ever logged. */
export class BackendError extends Error {
  readonly code: string;
  constructor(code: string) {
    super('Backend request failed');
    this.name = 'BackendError';
    this.code = code;
  }
}

interface PgError {
  message?: string;
  code?: string;
}

/** Maps the short messages raised by the database functions to API errors. */
function mapRpcError(error: PgError): never {
  switch (error.message) {
    case 'not_found':
      throw new ApiException('not_found', 'Museum not found.');
    case 'photo_limit':
      throw new ApiException('photo_limit', 'A museum can hold at most 20 photos.');
    case 'upload_quota':
      throw new ApiException(
        'upload_quota',
        'This museum has used all of its photo uploads. Remove nothing more; publish what you have.',
      );
    case 'conflict':
      throw new ApiException('conflict', 'A photo is not ready. Wait for uploads to finish.');
    case 'bad_request':
      throw new ApiException('bad_request', 'The museum document is not valid.');
    default:
      throw new BackendError(error.code ?? 'unknown');
  }
}

function check(error: PgError | null): void {
  if (error) throw new BackendError(error.code ?? 'unknown');
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function toMuseum(row: Row): MuseumRecord {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    visitorName: row.visitor_name,
    guideName: row.guide_name,
    openingGreeting: row.opening_greeting,
    closingMessage: row.closing_message,
    theme: row.theme,
    visitorAvatar: row.visitor_avatar,
    guideAvatar: row.guide_avatar,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
  };
}

function toPhoto(row: Row): PhotoRecord {
  return {
    id: row.id,
    museumId: row.museum_id,
    status: row.status,
    position: row.position,
    caption: row.caption,
    width: row.width,
    height: row.height,
    lqip: row.lqip,
    createdAt: row.created_at,
  };
}

export function createSupabaseStore(client: SupabaseClient): MuseumStore {
  return {
    async insertMuseum(input) {
      const { error } = await client.from('museums').insert({
        edit_token_hash: toByteaLiteral(input.editTokenHash),
        share_token_hash: toByteaLiteral(input.shareTokenHash),
        expires_at: input.expiresAt,
      });
      check(error);
    },

    async findLiveByEditHash(hash, now) {
      const { data, error } = await client
        .from('museums')
        .select(MUSEUM_COLUMNS)
        .eq('edit_token_hash', toByteaLiteral(hash))
        .gt('expires_at', now.toISOString())
        .maybeSingle();
      check(error);
      return data ? toMuseum(data) : null;
    },

    async findPublishedByShareHash(hash, now) {
      const { data, error } = await client
        .from('museums')
        .select(MUSEUM_COLUMNS)
        .eq('share_token_hash', toByteaLiteral(hash))
        .eq('status', 'published')
        .gt('expires_at', now.toISOString())
        .maybeSingle();
      check(error);
      return data ? toMuseum(data) : null;
    },

    async listPhotos(museumId, status) {
      let query = client.from('photos').select(PHOTO_COLUMNS).eq('museum_id', museumId);
      if (status) query = query.eq('status', status);
      const { data, error } = await query
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      check(error);
      return (data ?? []).map(toPhoto);
    },

    async findPhoto(museumId, photoId) {
      const { data, error } = await client
        .from('photos')
        .select(PHOTO_COLUMNS)
        .eq('museum_id', museumId)
        .eq('id', photoId)
        .maybeSingle();
      check(error);
      return data ? toPhoto(data) : null;
    },

    async reservePhoto(museumId) {
      const { data, error } = await client.rpc('reserve_photo', { p_museum_id: museumId });
      if (error) mapRpcError(error);
      if (typeof data !== 'string') throw new BackendError('bad_rpc_result');
      return data;
    },

    async markPhotoReady(museumId, photoId, fields) {
      const { error } = await client
        .from('photos')
        .update({
          status: 'ready',
          width: fields.width,
          height: fields.height,
          lqip: fields.lqip,
          confirmed_at: new Date().toISOString(),
        })
        .eq('museum_id', museumId)
        .eq('id', photoId);
      check(error);
    },

    async deletePhoto(museumId, photoId) {
      const { error } = await client
        .from('photos')
        .delete()
        .eq('museum_id', museumId)
        .eq('id', photoId);
      check(error);
    },

    async publish(museumId, input: PublishInput): Promise<PublishResult> {
      const { data, error } = await client.rpc('publish_museum', {
        p_museum_id: museumId,
        p_title: input.title,
        p_visitor_name: input.visitorName,
        p_guide_name: input.guideName,
        p_opening_greeting: input.openingGreeting,
        p_closing_message: input.closingMessage,
        p_theme: input.theme,
        p_visitor_avatar: input.visitorAvatar,
        p_guide_avatar: input.guideAvatar,
        p_photos: input.photos,
        p_retention_days: input.retentionDays,
      });
      if (error) mapRpcError(error);
      const row: Row | undefined = Array.isArray(data) ? data[0] : data;
      if (!row) throw new BackendError('bad_rpc_result');
      return {
        publishedAt: row.out_published_at,
        expiresAt: row.out_expires_at,
        removedPhotoIds: row.out_removed_photo_ids ?? [],
      };
    },

    async deleteMuseum(museumId) {
      const { error } = await client.rpc('delete_museum_rows', { p_museum_id: museumId });
      check(error);
    },

    async rateLimitHit(bucket, limit, windowSeconds) {
      const { data, error } = await client.rpc('rate_limit_hit', {
        p_bucket: bucket,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      check(error);
      return data === true;
    },

    async rateLimitBlocked(bucket, limit, windowSeconds) {
      const { data, error } = await client.rpc('rate_limit_blocked', {
        p_bucket: bucket,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      check(error);
      return data === true;
    },

    async expireMuseums(limit) {
      const { data, error } = await client.rpc('expire_museums', { p_limit: limit });
      check(error);
      // PostgREST returns a set of scalars as an array of values; accept an array of objects too.
      return ((data ?? []) as unknown[]).map((item) =>
        typeof item === 'string' ? item : String(Object.values(item as Row)[0]),
      );
    },

    async listPurgeQueue(limit) {
      const { data, error } = await client
        .from('storage_purge_queue')
        .select('museum_id')
        .order('enqueued_at', { ascending: true })
        .limit(limit);
      check(error);
      return (data ?? []).map((row: Row) => row.museum_id as string);
    },

    async clearPurgeQueueEntry(museumId) {
      const { error } = await client.from('storage_purge_queue').delete().eq('museum_id', museumId);
      check(error);
    },

    async recordPurgeFailure(museumId, message) {
      const { data } = await client
        .from('storage_purge_queue')
        .select('attempts')
        .eq('museum_id', museumId)
        .maybeSingle();
      const attempts = ((data as Row | null)?.attempts ?? 0) + 1;
      const { error } = await client
        .from('storage_purge_queue')
        .update({ attempts: Math.min(attempts, 32000), last_error: message.slice(0, 200) })
        .eq('museum_id', museumId);
      check(error);
    },
  };
}

export function createSupabaseStorage(
  client: SupabaseClient,
  options: { publicUrl?: string | undefined; internalUrl: string },
): PhotoStorage {
  const bucket = () => client.storage.from(BUCKET);

  // Inside the local Edge Runtime SUPABASE_URL points at an internal host the browser cannot
  // reach, so PUBLIC_API_URL replaces the origin of every URL handed to the browser.
  const forBrowser = (url: string): string => {
    if (!options.publicUrl) return url;
    return url.startsWith(options.internalUrl)
      ? options.publicUrl + url.slice(options.internalUrl.length)
      : url;
  };

  async function listFiles(directory: string, depth = 0): Promise<string[]> {
    const files: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await bucket().list(directory, { limit: 100, offset });
      if (error) throw new BackendError(String((error as PgError).code ?? 'storage_list'));
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const path = `${directory}/${entry.name}`;
        // Folders are virtual: they come back with no id.
        if (entry.id === null && depth < 3) files.push(...(await listFiles(path, depth + 1)));
        else files.push(path);
      }
      if (data.length < 100) break;
    }
    return files;
  }

  return {
    async createUploadUrl(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path, { upsert: true });
      if (error || !data) throw new BackendError('storage_sign_upload');
      return forBrowser(data.signedUrl);
    },

    async createDownloadUrls(paths, ttlSeconds) {
      const { data, error } = await bucket().createSignedUrls(paths, ttlSeconds);
      if (error || !data) throw new BackendError('storage_sign');
      const byPath = new Map<string, string>();
      for (const item of data) {
        if (item.signedUrl && item.path) byPath.set(item.path, forBrowser(item.signedUrl));
      }
      return paths.map((path) => {
        const url = byPath.get(path);
        if (!url) throw new BackendError('storage_sign_missing');
        return url;
      });
    },

    async download(path, maxBytes): Promise<DownloadResult> {
      const { data, error } = await bucket().download(path);
      if (error) {
        const info = error as { message?: string; status?: number; statusCode?: string };
        if (
          /not found|does not exist/i.test(info.message ?? '') ||
          info.status === 404 ||
          info.statusCode === '404'
        ) {
          return { kind: 'missing' };
        }
        throw new BackendError(String(info.statusCode ?? info.status ?? 'storage_download'));
      }
      if (!data) return { kind: 'missing' };
      if (data.size > maxBytes) return { kind: 'too_large' };
      return { kind: 'ok', bytes: new Uint8Array(await data.arrayBuffer()) };
    },

    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await bucket().remove(paths);
      if (error) throw new BackendError('storage_remove');
    },

    async removePrefix(prefix) {
      const files = await listFiles(prefix);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await bucket().remove(files.slice(i, i + 100));
        if (error) throw new BackendError('storage_remove');
      }
    },
  };
}

export function createSupabaseBackend(config: {
  supabaseUrl: string;
  serviceRoleKey: string;
  publicStorageUrl?: string | undefined;
}): { store: MuseumStore; storage: PhotoStorage } {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    store: createSupabaseStore(client),
    storage: createSupabaseStorage(client, {
      publicUrl: config.publicStorageUrl,
      internalUrl: config.supabaseUrl,
    }),
  };
}
