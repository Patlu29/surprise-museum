/**
 * get-museum: the Visitor's read-only view. A share token in, MuseumContent with signed photo URLs
 * out. Unknown, malformed, draft, expired and deleted tokens all return the same 404 body.
 * Rate limits per IP hash: 60 lookups per minute, and 20 misses per 10 minutes (link guessing).
 * docs/api.md, "get-museum".
 */
import { LIMITS, type GetMuseumResponse } from '@contract';
import {
  ApiException,
  createEndpoint,
  enforceLimit,
  notFound,
  tooManyRequests,
  type BaseDeps,
} from '../_shared/http.ts';
import type { PhotoStorage } from '../_shared/ports.ts';
import { toMuseumContent, toMuseumPhotos } from '../_shared/present.ts';
import { hashToken, isShareToken } from '../_shared/tokens.ts';
import { parseGetMuseumRequest } from '../_shared/validate.ts';

export const LOOKUP_LIMIT = { limit: 60, windowSeconds: 60 } as const;
export const MISS_LIMIT = { limit: 20, windowSeconds: 600 } as const;

export interface GetMuseumDeps extends BaseDeps {
  storage: PhotoStorage;
}

export function createGetMuseumHandler(deps: GetMuseumDeps) {
  const { store, storage } = deps;

  return createEndpoint(
    deps,
    { name: 'get-museum', cors: true, requireJson: true },
    async (ctx) => {
      const now = ctx.now();
      const ip = await ctx.ipHash();

      if (await store.rateLimitBlocked(`miss:${ip}`, MISS_LIMIT.limit, MISS_LIMIT.windowSeconds)) {
        throw tooManyRequests(now, MISS_LIMIT.windowSeconds);
      }
      await enforceLimit(store, now, `get:${ip}`, LOOKUP_LIMIT.limit, LOOKUP_LIMIT.windowSeconds);

      const parsed = parseGetMuseumRequest(await ctx.json());
      if (!parsed.ok)
        throw new ApiException('bad_request', parsed.message, { field: parsed.field });

      const miss = async (): Promise<never> => {
        await store.rateLimitHit(`miss:${ip}`, MISS_LIMIT.limit, MISS_LIMIT.windowSeconds);
        throw notFound();
      };

      // A token of the wrong shape cannot exist, so no query is made for it.
      if (!isShareToken(parsed.value.shareToken)) return miss();
      const museum = await store.findPublishedByShareHash(
        await hashToken(parsed.value.shareToken),
        now,
      );
      if (!museum) return miss();

      const photos = (await store.listPhotos(museum.id, 'ready')).filter(
        (p) => p.position !== null,
      );
      const content = toMuseumContent(museum, await toMuseumPhotos(storage, photos));
      if (!content) return miss();

      const response: GetMuseumResponse = {
        museum: content,
        urlsExpireAt: new Date(now.getTime() + LIMITS.signedUrlTtlSeconds * 1000).toISOString(),
      };
      return { status: 200, body: response };
    },
  );
}
