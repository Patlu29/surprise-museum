// Edge Function: create-museum
// Starts an unpublished draft and returns a new edit token. Rate limited per IP hash.
// Contract: docs/api.md. Logic: handler.ts. Security rules: docs/architecture.md, section 10
// (never log bodies, tokens, names or captions).
import { lazyHandler } from '../_shared/boot.ts';
import { createCreateMuseumHandler } from './handler.ts';

Deno.serve(
  lazyHandler('create-museum', ({ store, config }) => createCreateMuseumHandler({ store, config })),
);
