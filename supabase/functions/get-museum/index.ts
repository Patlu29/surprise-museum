// Edge Function: get-museum
// Visitor read path. Share token in, MuseumContent with signed photo URLs out. Uniform 404.
// Contract: docs/api.md. Logic: handler.ts. Security rules: docs/architecture.md, section 10
// (never log bodies, tokens, names or captions).
import { lazyHandler } from '../_shared/boot.ts';
import { createGetMuseumHandler } from './handler.ts';

Deno.serve(
  lazyHandler('get-museum', ({ store, storage, config }) =>
    createGetMuseumHandler({ store, storage, config }),
  ),
);
