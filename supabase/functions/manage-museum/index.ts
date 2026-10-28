// Edge Function: manage-museum
// Everything the edit token allows: get, reserve-photo, renew-upload, confirm-photo,
// remove-photo, publish, delete.
// Contract: docs/api.md. Logic: handler.ts. Security rules: docs/architecture.md, section 10
// (never log bodies, tokens, names or captions).
import { lazyHandler } from '../_shared/boot.ts';
import { createManageMuseumHandler } from './handler.ts';

Deno.serve(
  lazyHandler('manage-museum', ({ store, storage, config }) =>
    createManageMuseumHandler({ store, storage, config }),
  ),
);
