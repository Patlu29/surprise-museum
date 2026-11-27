import { assertEquals } from '@std/assert';
import { call, createApp, draftWithPhotos } from './helpers.ts';

const anonCall = { origin: null } as const;

Deno.test(
  'keep-alive answers 200 with exactly ok, the database time and purgeHealthy',
  async () => {
    const app = createApp();
    app.backend.heartbeat = new Date(app.nowMs() - 60_000).toISOString();
    const r = await call(app.handlers.keepAlive, {}, anonCall);
    assertEquals(r.status, 200);
    assertEquals(r.json, {
      ok: true,
      checkedAt: new Date(app.nowMs()).toISOString(),
      purgeHealthy: true,
    });
    assertEquals(Object.keys(r.json).sort(), ['checkedAt', 'ok', 'purgeHealthy']);
    assertEquals(r.headers.get('cache-control'), 'no-store');
  },
);

Deno.test(
  'keep-alive says purgeHealthy false before any purge has ever been recorded',
  async () => {
    const app = createApp();
    const r = await call(app.handlers.keepAlive, {}, anonCall);
    assertEquals(r.status, 200);
    assertEquals(r.json.purgeHealthy, false);
    assertEquals(app.backend.heartbeat, null, 'the keep-alive never seeds the heartbeat');
  },
);

Deno.test(
  'keep-alive follows the 3-hour rule through the backend: 2 h 59 min, 3 h 1 min',
  async () => {
    const app = createApp();
    const minute = 60_000;
    app.backend.heartbeat = new Date(app.nowMs() - (3 * 60 - 1) * minute).toISOString();
    assertEquals((await call(app.handlers.keepAlive, {}, anonCall)).json.purgeHealthy, true);
    app.backend.heartbeat = new Date(app.nowMs() - (3 * 60 + 1) * minute).toISOString();
    assertEquals((await call(app.handlers.keepAlive, {}, anonCall)).json.purgeHealthy, false);
  },
);

Deno.test(
  'keep-alive is unhealthy when an expired museum was left behind or the queue is stale',
  async () => {
    const app = createApp();
    const hour = 3_600_000;
    await draftWithPhotos(app, 1);
    // The draft ends 7 days after creation; the purge has run recently but missed it.
    app.advance(7 * 24 * hour + 4 * hour);
    app.backend.heartbeat = new Date(app.nowMs() - hour).toISOString();
    assertEquals((await call(app.handlers.keepAlive, {}, anonCall)).json.purgeHealthy, false);

    // Purged just now: healthy again, and a stale queue entry turns it unhealthy on its own.
    const clean = createApp();
    clean.backend.heartbeat = new Date(clean.nowMs()).toISOString();
    clean.backend.purgeQueue.set('m1', {
      attempts: 1,
      lastError: null,
      enqueuedAt: new Date(clean.nowMs() - 3 * hour - 60_000).toISOString(),
    });
    assertEquals((await call(clean.handlers.keepAlive, {}, anonCall)).json.purgeHealthy, false);
    clean.backend.purgeQueue.clear();
    assertEquals((await call(clean.handlers.keepAlive, {}, anonCall)).json.purgeHealthy, true);
  },
);

Deno.test(
  'keep-alive still answers 200 with purgeHealthy false when the health check fails, and logs only the error name',
  async () => {
    const app = createApp();
    app.backend.heartbeat = new Date(app.nowMs()).toISOString();
    app.backend.failPurgeHealth = true;
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const r = await call(app.handlers.keepAlive, {}, anonCall);
      assertEquals(r.status, 200);
      assertEquals(r.json, {
        ok: true,
        checkedAt: new Date(app.nowMs()).toISOString(),
        purgeHealthy: false,
      });
    } finally {
      console.error = original;
    }
    assertEquals(logged, [['keep-alive: purge health check failed (Error)']]);
    assertEquals(JSON.stringify(logged).includes('health query down'), false);
  },
);

Deno.test('keep-alive treats a timeout of the health check like any other failure', async () => {
  const app = createApp();
  app.backend.store.purgeHealthInputs = () =>
    Promise.reject(new DOMException('signal timed out', 'TimeoutError'));
  const original = console.error;
  const logged: string[] = [];
  console.error = (message: string) => void logged.push(message);
  try {
    const r = await call(app.handlers.keepAlive, {}, anonCall);
    assertEquals(r.status, 200);
    assertEquals(r.json.purgeHealthy, false);
  } finally {
    console.error = original;
  }
  assertEquals(logged, ['keep-alive: purge health check failed (TimeoutError)']);
});

Deno.test('keep-alive does not run the health check when keep_alive() itself fails', async () => {
  const app = createApp();
  app.backend.failKeepAlive = true;
  let healthCalls = 0;
  const real = app.backend.store.purgeHealthInputs;
  app.backend.store.purgeHealthInputs = () => {
    healthCalls++;
    return real();
  };
  const original = console.error;
  console.error = () => undefined;
  try {
    assertEquals((await call(app.handlers.keepAlive, {}, anonCall)).status, 500);
  } finally {
    console.error = original;
  }
  assertEquals(healthCalls, 0);
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
