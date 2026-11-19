// Edge Function: keep-alive
// Called daily by a scheduled workflow so the Supabase Free project is never idle for 7 days.
// Read-only: one query, no writes, no rate limit. Contract: docs/api.md. Logic: handler.ts.
import { lazyHandler } from '../_shared/boot.ts';
import { createKeepAliveHandler } from './handler.ts';

Deno.serve(
  lazyHandler('keep-alive', ({ store, config }) => createKeepAliveHandler({ store, config })),
);
