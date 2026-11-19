import { assertEquals } from '@std/assert';
import { call, createApp, draftWithPhotos } from './helpers.ts';

const anonCall = { origin: null } as const;

Deno.test('keep-alive answers 200 with ok and the database time, and nothing else', async () => {
  const app = createApp();
  const r = await call(app.handlers.keepAlive, {}, anonCall);
  assertEquals(r.status, 200);
  assertEquals(r.json, { ok: true, checkedAt: new Date(app.nowMs()).toISOString() });
  assertEquals(r.headers.get('cache-control'), 'no-store');
});

Deno.test('keep-alive treats an empty body as {}', async () => {
  const app = createApp();
  const r = await call(app.handlers.keepAlive, '', anonCall);
  assertEquals(r.status, 200);
});

Deno.test(
  'keep-alive writes nothing: no rate_limits row, no miss, no museum or object change',
  async () => {
    const app = createApp();
    await draftWithPhotos(app, 1, '192.0.2.1');
    const before = {
      museums: app.backend.museums.size,
      photos: app.backend.photos.size,
      objects: app.backend.objects.size,
      queue: app.backend.purgeQueue.size,
      rateHits: new Map(app.backend.rateHits),
    };
    for (let i = 0; i < 30; i++) {
      assertEquals((await call(app.handlers.keepAlive, {}, anonCall)).status, 200);
    }
    assertEquals(app.backend.museums.size, before.museums);
    assertEquals(app.backend.photos.size, before.photos);
    assertEquals(app.backend.objects.size, before.objects);
    assertEquals(app.backend.purgeQueue.size, before.queue);
    assertEquals(app.backend.rateHits, before.rateHits, 'no rate_limits row written');
    // Thirty calls from one address never rate-limit it, and never touch a real lookup's allowance.
    assertEquals((await call(app.handlers.create, {}, { ip: '203.0.113.7' })).status, 201);
  },
);

Deno.test('keep-alive never purges expired museums', async () => {
  const app = createApp();
  await draftWithPhotos(app, 1);
  app.advance(30 * 86_400_000);
  await call(app.handlers.keepAlive, {}, anonCall);
  assertEquals(app.backend.museums.size, 1, 'the expired museum is still there');
  assertEquals(app.backend.purgeQueue.size, 0);
});

Deno.test('keep-alive rejects a non-empty or malformed body with 400', async () => {
  const app = createApp();
  for (const body of [{ a: 1 }, [], 'null', '[]', '{not json', '"text"']) {
    const r = await call(app.handlers.keepAlive, body, anonCall);
    assertEquals(r.status, 400, JSON.stringify(body));
    assertEquals(r.json.error, 'bad_request');
  }
});

Deno.test(
  'keep-alive rejects other methods with 405 and a wrong content type with 415',
  async () => {
    const app = createApp();
    const get = await call(app.handlers.keepAlive, {}, { ...anonCall, method: 'GET' });
    assertEquals(get.status, 405);
    assertEquals(get.json.error, 'bad_request');
    const type = await call(app.handlers.keepAlive, '{}', {
      ...anonCall,
      contentType: 'text/plain',
    });
    assertEquals(type.status, 415);
    assertEquals(type.json.error, 'bad_request');
  },
);

Deno.test('keep-alive rejects a body over 64 KiB with 413', async () => {
  const app = createApp();
  const r = await call(
    app.handlers.keepAlive,
    JSON.stringify({ pad: 'x'.repeat(70 * 1024) }),
    anonCall,
  );
  assertEquals(r.status, 413);
  assertEquals(r.json.error, 'bad_request');
});

Deno.test(
  'keep-alive answers 500 server_error without detail when the database fails',
  async () => {
    const app = createApp();
    app.backend.failKeepAlive = true;
    const r = await call(app.handlers.keepAlive, {}, anonCall);
    assertEquals(r.status, 500);
    assertEquals(Object.keys(r.json).sort(), ['error', 'message']);
    assertEquals(r.json.error, 'server_error');
    assertEquals(JSON.stringify(r.json).includes('database down'), false);
  },
);
