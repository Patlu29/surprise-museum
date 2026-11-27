/**
 * keep-alive: called daily by a scheduled GitHub Actions workflow with only the public anon key
 * (ADR 0022). It runs two read-only queries: keep_alive(), so the Supabase Free project never
 * idles into a pause, and purge_health_inputs(), from which a pure function works out one flag
 * (ADR 0023, NFR-33). It writes nothing (no rate_limits row, no miss) and never calls purge.
 * It reveals the database clock and one boolean, `purgeHealthy`: no count, age, time or reason.
 * A failed health check is not an error: the answer is still 200 with `purgeHealthy: false`.
 * docs/api.md, "keep-alive".
 */
import type { KeepAliveResponse } from '@contract';
import { ApiException, type BaseDeps, createEndpoint, isEmptyObject } from '../_shared/http.ts';
import { isPurgeHealthy } from '../_shared/purgeHealth.ts';

export function createKeepAliveHandler(deps: BaseDeps) {
  return createEndpoint(
    deps,
    { name: 'keep-alive', cors: false, requireJson: true },
    async (ctx) => {
      const body = await ctx.json();
      if (!isEmptyObject(body)) {
        throw new ApiException('bad_request', 'The request body must be an empty object.');
      }
      // A failure here is a generic 500 from createEndpoint, which the workflow reports as red.
      const checkedAt = await deps.store.keepAlive();

      // The health check must never decide whether Postgres was reached (NFR-33 (d)).
      let purgeHealthy = false;
      try {
        purgeHealthy = isPurgeHealthy(await deps.store.purgeHealthInputs());
      } catch (error) {
        // The error name only: a message from the database could carry a value.
        console.error(
          `keep-alive: purge health check failed (${error instanceof Error ? error.name : 'error'})`,
        );
      }
      const response: KeepAliveResponse = { ok: true, checkedAt, purgeHealthy };
      return { status: 200, body: response };
    },
  );
}
