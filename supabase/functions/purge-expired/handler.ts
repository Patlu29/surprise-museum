/**
 * purge-expired: called hourly by pg_cron through pg_net (ADR 0010), never by a browser.
 *   1. Deletes museums whose expires_at has passed (drafts after 7 days, published after 90).
 *   2. Removes the storage objects of every museum in the purge queue, and dequeues on success.
 * Authorised by the x-cron-secret header, compared in constant time. docs/api.md, "purge-expired".
 */
import type { PurgeExpiredResponse } from '@contract';
import { ApiException, createEndpoint, notFound, type BaseDeps } from '../_shared/http.ts';
import type { PhotoStorage } from '../_shared/ports.ts';
import { secretsMatch } from '../_shared/tokens.ts';

/** Museums expired and queue entries drained per run. A backlog clears over successive hours. */
export const BATCH_SIZE = 100;

export interface PurgeExpiredDeps extends BaseDeps {
  storage: PhotoStorage;
}

export function createPurgeExpiredHandler(deps: PurgeExpiredDeps) {
  const { store, storage } = deps;

  return createEndpoint(
    deps,
    { name: 'purge-expired', cors: false, requireJson: false },
    async (ctx) => {
      const expected = deps.config.cronSecret;
      if (!expected) {
        // Never run open: without a configured secret the function refuses every call.
        throw new ApiException('server_error', 'The purge function is not configured.');
      }
      const provided = ctx.request.headers.get('x-cron-secret') ?? '';
      if (!(await secretsMatch(provided, expected))) throw notFound();

      const expiredIds = new Set(await store.expireMuseums(BATCH_SIZE));

      let retried = 0;
      let failed = 0;
      for (const museumId of await store.listPurgeQueue(BATCH_SIZE)) {
        try {
          await storage.removePrefix(museumId);
          await store.clearPurgeQueueEntry(museumId);
          if (!expiredIds.has(museumId)) retried++;
        } catch (error) {
          failed++;
          // Record the kind of failure, never object names or row data.
          await store
            .recordPurgeFailure(museumId, error instanceof Error ? error.name : 'error')
            .catch(() => undefined);
        }
      }

      const response: PurgeExpiredResponse = { purged: expiredIds.size, retried, failed };
      return { status: 200, body: response };
    },
  );
}
