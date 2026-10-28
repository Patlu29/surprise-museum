// Edge Function: purge-expired
// Called hourly by pg_cron with the x-cron-secret header. Deletes expired museums and their
// storage objects, and retries any storage clean-up that failed earlier.
// Contract: docs/api.md. Logic: handler.ts.
import { lazyHandler } from '../_shared/boot.ts';
import { createPurgeExpiredHandler } from './handler.ts';

Deno.serve(
  lazyHandler('purge-expired', ({ store, storage, config }) =>
    createPurgeExpiredHandler({ store, storage, config }),
  ),
);
