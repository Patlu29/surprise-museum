/**
 * keep-alive: called daily by a scheduled GitHub Actions workflow with only the public anon key
 * (ADR 0022). It runs one read-only query so the Supabase Free project never idles into a pause.
 * It writes nothing (no rate_limits row, no miss), never calls purge, and reveals only the
 * database clock. docs/api.md, "keep-alive".
 */
import type { KeepAliveResponse } from '@contract';
import { ApiException, type BaseDeps, createEndpoint, isEmptyObject } from '../_shared/http.ts';

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
      const response: KeepAliveResponse = { ok: true, checkedAt };
      return { status: 200, body: response };
    },
  );
}
