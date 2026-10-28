/**
 * create-museum: starts an unpublished draft and returns its edit token (shown to the Creator once).
 * Rate limited to 10 drafts per hour per IP hash. docs/api.md, "create-museum".
 */
import { LIMITS, type CreateMuseumResponse } from '@contract';
import {
  ApiException,
  createEndpoint,
  enforceLimit,
  isEmptyObject,
  type BaseDeps,
} from '../_shared/http.ts';
import { createTokenPair, type RandomBytes } from '../_shared/tokens.ts';

export const CREATE_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

export interface CreateMuseumDeps extends BaseDeps {
  randomBytes?: RandomBytes;
}

export function createCreateMuseumHandler(deps: CreateMuseumDeps) {
  return createEndpoint(
    deps,
    { name: 'create-museum', cors: true, requireJson: true },
    async (ctx) => {
      const body = await ctx.json();
      if (!isEmptyObject(body)) {
        throw new ApiException('bad_request', 'The request body must be an empty object.');
      }
      const now = ctx.now();
      await enforceLimit(
        deps.store,
        now,
        `create:${await ctx.ipHash()}`,
        CREATE_LIMIT.limit,
        CREATE_LIMIT.windowSeconds,
      );

      const tokens = await createTokenPair(deps.randomBytes);
      const expiresAt = new Date(
        now.getTime() + LIMITS.draftRetentionDays * 86_400_000,
      ).toISOString();
      await deps.store.insertMuseum({
        editTokenHash: tokens.editTokenHash,
        shareTokenHash: tokens.shareTokenHash,
        expiresAt,
      });

      const response: CreateMuseumResponse = {
        editToken: tokens.editToken,
        draftExpiresAt: expiresAt,
      };
      return { status: 201, body: response };
    },
  );
}
