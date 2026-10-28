/**
 * A local stand-in for the deployed functions: the real handlers, over real HTTP, backed by the
 * in-memory store. It exists to test supabase/scripts/smoke-test.mjs and the signed upload
 * request format without a Supabase project. Not deployed.
 *
 *   deno run --allow-net --config supabase/functions/deno.json supabase/functions/tests/devServer.ts
 *   node supabase/scripts/smoke-test.mjs http://localhost:8787 any-key
 */
import { MemoryBackend } from '../_shared/testing/memoryBackend.ts';
import { createCreateMuseumHandler } from '../create-museum/handler.ts';
import { createGetMuseumHandler } from '../get-museum/handler.ts';
import { createManageMuseumHandler } from '../manage-museum/handler.ts';

const PORT = 8787;
const origin = `http://localhost:${PORT}`;
const backend = new MemoryBackend();
// Signed URLs point back at this server.
backend.storage.createUploadUrl = (path) =>
  Promise.resolve(`${origin}/storage/upload/${path}?token=t`);
backend.storage.createDownloadUrls = (paths) =>
  Promise.resolve(paths.map((p) => `${origin}/storage/object/${p}?token=t`));

const deps = {
  store: backend.store,
  storage: backend.storage,
  config: { allowedOrigins: ['http://localhost:5173'], rateLimitSalt: 'dev', cronSecret: 'dev' },
};
const routes: Record<string, (request: Request) => Promise<Response>> = {
  'create-museum': createCreateMuseumHandler(deps),
  'get-museum': createGetMuseumHandler(deps),
  'manage-museum': createManageMuseumHandler(deps),
};

Deno.serve({ port: PORT }, async (request) => {
  const url = new URL(request.url);
  const fn = /^\/functions\/v1\/([a-z-]+)$/.exec(url.pathname)?.[1];
  if (fn && routes[fn]) return routes[fn](request);

  const storage = /^\/storage\/(upload|object)\/(.+)$/.exec(url.pathname);
  if (storage) {
    const path = decodeURIComponent(storage[2]!);
    if (storage[1] === 'upload' && request.method === 'PUT') {
      // What Supabase Storage requires of a signed upload request.
      if (
        request.headers.get('content-type') !== 'image/jpeg' ||
        request.headers.get('x-upsert') !== 'true'
      ) {
        return new Response('bad upload headers', { status: 400 });
      }
      backend.objects.set(path, new Uint8Array(await request.arrayBuffer()));
      return new Response('{"Key":"photos/' + path + '"}', { status: 200 });
    }
    const bytes = backend.objects.get(path);
    if (storage[1] === 'object' && bytes)
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
  }
  return new Response('not found', { status: 404 });
});
console.log(`Dev server on ${origin} (in-memory, resets on restart)`);
