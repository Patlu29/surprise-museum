import { assert, assertEquals } from '@std/assert';
import { buildJpeg } from '../_shared/testing/jpegFixtures.ts';
import { deriveShareToken } from '../_shared/tokens.ts';
import { call, createApp, CRON_SECRET, documentFor, draftWithPhotos } from './helpers.ts';

const cron = (secret: string | null) => ({
  origin: null,
  headers: (secret === null ? {} : { 'x-cron-secret': secret }) as Record<string, string>,
});

Deno.test(
  'purge-expired needs the cron secret and otherwise looks like a missing page',
  async () => {
    const app = createApp();
    for (const secret of [null, '', 'wrong', CRON_SECRET + 'x', CRON_SECRET.slice(0, -1)]) {
      const r = await call(app.handlers.purge, {}, cron(secret));
      assertEquals(r.status, 404);
    }
    assertEquals((await call(app.handlers.purge, {}, cron(CRON_SECRET))).status, 200);
  },
);

Deno.test('purge-expired refuses to run when no secret is configured', async () => {
  const { createPurgeExpiredHandler } = await import('../purge-expired/handler.ts');
  const app = createApp();
  const handler = createPurgeExpiredHandler({
    store: app.backend.store,
    storage: app.backend.storage,
    config: { allowedOrigins: [], rateLimitSalt: 's' },
  });
  const r = await call(handler, {}, { origin: null, headers: { 'x-cron-secret': '' } });
  assertEquals(r.status, 500);
});

Deno.test(
  'purge-expired removes stale drafts after 7 days and published museums 7 days after first publish',
  async () => {
    const app = createApp();
    const draft = await draftWithPhotos(app, 1, '192.0.2.1');
    const live = await draftWithPhotos(app, 1, '192.0.2.2');
    const day = 86_400_000;

    app.advance(3 * day); // day 3: publish inside the window, so it expires on day 10
    await call(
      app.handlers.manage,
      { action: 'publish', editToken: live.editToken, document: documentFor(live.photoIds) },
      { ip: '192.0.2.2' },
    );
    const shareToken = await deriveShareToken(live.editToken);

    app.advance(3 * day); // day 6: nothing has expired yet
    assertEquals((await call(app.handlers.purge, {}, cron(CRON_SECRET))).json, {
      purged: 0,
      retried: 0,
      failed: 0,
    });

    app.advance(2 * day); // day 8: the draft (created day 0) has expired; the museum has 2 days left
    const day8 = await call(app.handlers.purge, {}, cron(CRON_SECRET));
    assertEquals(day8.json, { purged: 1, retried: 0, failed: 0 });
    assertEquals(app.backend.museums.size, 1);
    assertEquals(
      (
        await call(
          app.handlers.manage,
          { action: 'get', editToken: draft.editToken },
          { ip: '192.0.2.3' },
        )
      ).status,
      404,
    );
    assertEquals((await call(app.handlers.get, { shareToken }, { ip: '192.0.2.4' })).status, 200);
    assertEquals(
      [...app.backend.objects.keys()].filter((k) =>
        k.startsWith([...app.backend.museums.keys()][0]!),
      ).length,
      2,
    );
    assertEquals(app.backend.objects.size, 2, 'only the live museum keeps objects');

    app.advance(2 * day + 1000); // day 10 plus 1 second: 7 days and 1 second after first publish
    assertEquals(
      (await call(app.handlers.get, { shareToken }, { ip: '192.0.2.5' })).status,
      404,
      'expired links stop before the purge runs',
    );
    assertEquals((await call(app.handlers.purge, {}, cron(CRON_SECRET))).json, {
      purged: 1,
      retried: 0,
      failed: 0,
    });
    assertEquals(app.backend.museums.size, 0);
    assertEquals(app.backend.objects.size, 0);
  },
);

Deno.test('purge-expired retries failed storage clean-up on the next run', async () => {
  const app = createApp();
  const { editToken } = await draftWithPhotos(app, 1);
  app.backend.failStorageRemoval = true;
  await call(app.handlers.manage, { action: 'delete', editToken });
  assertEquals(app.backend.purgeQueue.size, 1);

  const failing = await call(app.handlers.purge, {}, cron(CRON_SECRET));
  assertEquals(failing.json, { purged: 0, retried: 0, failed: 1 });
  assertEquals([...app.backend.purgeQueue.values()][0]!.attempts, 1);
  assert(
    ![...app.backend.purgeQueue.values()][0]!.lastError!.includes('/'),
    'no paths in the recorded error',
  );

  app.backend.failStorageRemoval = false;
  assertEquals((await call(app.handlers.purge, {}, cron(CRON_SECRET))).json, {
    purged: 0,
    retried: 1,
    failed: 0,
  });
  assertEquals(app.backend.purgeQueue.size, 0);
  assertEquals(app.backend.objects.size, 0);
  void buildJpeg;
});

Deno.test('purge-expired records the heartbeat as its last step on a clean run', async () => {
  const app = createApp();
  assertEquals(app.backend.heartbeat, null);
  const r = await call(app.handlers.purge, {}, cron(CRON_SECRET));
  assertEquals(r.json, { purged: 0, retried: 0, failed: 0 });
  assertEquals(app.backend.heartbeat, new Date(app.nowMs()).toISOString());
});

Deno.test(
  'purge-expired still records the heartbeat when some storage deletes failed',
  async () => {
    const app = createApp();
    const { editToken } = await draftWithPhotos(app, 1);
    app.backend.failStorageRemoval = true;
    await call(app.handlers.manage, { action: 'delete', editToken });
    const r = await call(app.handlers.purge, {}, cron(CRON_SECRET));
    assertEquals(r.json, { purged: 0, retried: 0, failed: 1 });
    assertEquals(app.backend.heartbeat, new Date(app.nowMs()).toISOString());
  },
);

Deno.test('purge-expired records nothing for a wrong or missing secret', async () => {
  const app = createApp();
  for (const secret of [null, '', 'wrong']) {
    assertEquals((await call(app.handlers.purge, {}, cron(secret))).status, 404);
  }
  assertEquals(app.backend.heartbeat, null);
});

Deno.test('purge-expired records nothing when no secret is configured', async () => {
  const { createPurgeExpiredHandler } = await import('../purge-expired/handler.ts');
  const app = createApp();
  const handler = createPurgeExpiredHandler({
    store: app.backend.store,
    storage: app.backend.storage,
    config: { allowedOrigins: [], rateLimitSalt: 's' },
  });
  assertEquals((await call(handler, {}, { origin: null })).status, 500);
  assertEquals(app.backend.heartbeat, null);
});

Deno.test('purge-expired records nothing when a step throws, and answers 500', async () => {
  const app = createApp();
  const original = console.error;
  console.error = () => undefined;
  try {
    app.backend.store.listPurgeQueue = () => Promise.reject(new Error('queue down'));
    assertEquals((await call(app.handlers.purge, {}, cron(CRON_SECRET))).status, 500);
    assertEquals(app.backend.heartbeat, null);

    // A failure of the heartbeat write itself is also a 500, with the usual generic body.
    const other = createApp();
    other.backend.failRecordPurgeSuccess = true;
    const r = await call(other.handlers.purge, {}, cron(CRON_SECRET));
    assertEquals(r.status, 500);
    assertEquals(r.json.error, 'server_error');
    assertEquals(other.backend.heartbeat, null);
  } finally {
    console.error = original;
  }
});
