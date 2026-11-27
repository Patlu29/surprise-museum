import { assert, assertEquals } from '@std/assert';
import { loadConfig, ConfigError } from '../_shared/config.ts';
import { DEFAULT_SPACE_LIMITS, isSpaceFull } from '../_shared/space.ts';
import { buildJpeg, lqipDataUrl } from '../_shared/testing/jpegFixtures.ts';
import { deriveShareToken } from '../_shared/tokens.ts';
import { createCreateMuseumHandler } from '../create-museum/handler.ts';
import { call, createApp, CRON_SECRET, documentFor, draftWithPhotos } from './helpers.ts';

const FULL_BODY = {
  error: 'space_full',
  message: 'Surprise Museum is full for now. Please try again later.',
};
const anon = { origin: null } as const;

type App = ReturnType<typeof createApp>;

const setFull = (app: App) => (app.backend.usage = { storageBytes: 800_000_000, databaseBytes: 1 });
const setFree = (app: App) => (app.backend.usage = { storageBytes: 1, databaseBytes: 1 });

/** Runs `fn` with console.error captured, so a fail-open log line can be asserted. */
async function captureErrors(fn: () => Promise<void>): Promise<string[]> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => void lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return lines;
}

// ---------------------------------------------------------------------------
// The pure rule (US-74 boundaries)
// ---------------------------------------------------------------------------

Deno.test('isSpaceFull: storage 799,999,999 accepts and 800,000,000 refuses', () => {
  const db = 1;
  assertEquals(
    isSpaceFull({ storageBytes: 799_999_999, databaseBytes: db }, DEFAULT_SPACE_LIMITS),
    false,
  );
  assertEquals(
    isSpaceFull({ storageBytes: 800_000_000, databaseBytes: db }, DEFAULT_SPACE_LIMITS),
    true,
  );
  assertEquals(
    isSpaceFull({ storageBytes: 900_000_000, databaseBytes: db }, DEFAULT_SPACE_LIMITS),
    true,
  );
});

Deno.test('isSpaceFull: database 399,999,999 accepts and 400,000,000 refuses', () => {
  const st = 1;
  assertEquals(
    isSpaceFull({ storageBytes: st, databaseBytes: 399_999_999 }, DEFAULT_SPACE_LIMITS),
    false,
  );
  assertEquals(
    isSpaceFull({ storageBytes: st, databaseBytes: 400_000_000 }, DEFAULT_SPACE_LIMITS),
    true,
  );
});

Deno.test('isSpaceFull: either figure alone refuses, and empty is free', () => {
  assertEquals(isSpaceFull({ storageBytes: 0, databaseBytes: 0 }, DEFAULT_SPACE_LIMITS), false);
  assertEquals(
    isSpaceFull({ storageBytes: 800_000_000, databaseBytes: 0 }, DEFAULT_SPACE_LIMITS),
    true,
  );
  assertEquals(
    isSpaceFull({ storageBytes: 0, databaseBytes: 400_000_000 }, DEFAULT_SPACE_LIMITS),
    true,
  );
});

// ---------------------------------------------------------------------------
// create-museum
// ---------------------------------------------------------------------------

Deno.test(
  'create-museum refuses with 409 space_full, stores nothing, and still counts the hit',
  async () => {
    const app = createApp();
    setFull(app);
    const r = await call(app.handlers.create, {});
    assertEquals(r.status, 409);
    assertEquals(r.json, FULL_BODY);
    assertEquals(Object.keys(r.json).sort(), ['error', 'message'], 'no field, no figure');
    assertEquals(r.headers.get('retry-after'), null);
    assertEquals(app.backend.museums.size, 0);
    assertEquals([...app.backend.rateHits.values()], [1], 'a refusal counts toward the 10 an hour');
  },
);

Deno.test('create-museum: at the thresholds refuses, one byte below accepts', async () => {
  const cases: Array<[number, number, number]> = [
    [799_999_999, 1, 201],
    [800_000_000, 1, 409],
    [1, 399_999_999, 201],
    [1, 400_000_000, 409],
  ];
  for (const [storageBytes, databaseBytes, status] of cases) {
    const app = createApp();
    app.backend.usage = { storageBytes, databaseBytes };
    assertEquals(
      (await call(app.handlers.create, {})).status,
      status,
      `${storageBytes}/${databaseBytes}`,
    );
  }
});

Deno.test('create-museum resumes by itself once space is free', async () => {
  const app = createApp();
  setFull(app);
  assertEquals((await call(app.handlers.create, {})).status, 409);
  setFree(app);
  assertEquals((await call(app.handlers.create, {})).status, 201);
});

Deno.test('a bad body is rejected before space is measured', async () => {
  const app = createApp();
  setFull(app);
  assertEquals((await call(app.handlers.create, { x: 1 })).status, 400);
  assertEquals(app.backend.spaceChecks, 0);
});

Deno.test('thresholds come from the config: a lower storage limit refuses sooner', async () => {
  const app = createApp();
  const handler = createCreateMuseumHandler({
    store: app.backend.store,
    config: {
      allowedOrigins: [],
      rateLimitSalt: 's',
      spaceLimits: { storageBytes: 1000, databaseBytes: 2000 },
    },
    now: () => new Date(app.nowMs()),
  });
  app.backend.usage = { storageBytes: 999, databaseBytes: 1999 };
  assertEquals((await call(handler, {}, anon)).status, 201);
  app.backend.usage = { storageBytes: 1000, databaseBytes: 1 };
  assertEquals((await call(handler, {}, anon)).status, 409);
  app.backend.usage = { storageBytes: 1, databaseBytes: 2000 };
  assertEquals((await call(handler, {}, anon)).status, 409);
});

// ---------------------------------------------------------------------------
// reserve-photo
// ---------------------------------------------------------------------------

Deno.test('reserve-photo refuses with 409 space_full and reserves nothing', async () => {
  const app = createApp();
  const { editToken } = await draftWithPhotos(app, 1);
  setFull(app);
  const r = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
  assertEquals(r.status, 409);
  assertEquals(r.json, FULL_BODY);
  assertEquals(app.backend.photos.size, 1, 'no slot reserved');
  setFree(app);
  assertEquals(
    (await call(app.handlers.manage, { action: 'reserve-photo', editToken })).status,
    201,
  );
});

Deno.test('reserve-photo: a refusal uses none of the 100 lifetime reservations', async () => {
  const app = createApp();
  const { editToken } = await draftWithPhotos(app, 0);
  setFull(app);
  for (let i = 0; i < 150; i++) {
    // Spread over addresses so the per-address rate limit does not interfere.
    const ip = `198.51.100.${(i % 200) + 1}`;
    const r = await call(app.handlers.manage, { action: 'reserve-photo', editToken }, { ip });
    assertEquals(r.status, 409);
    assertEquals(r.json.error, 'space_full');
  }
  setFree(app);
  const ok = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
  assertEquals(ok.status, 201, 'the quota was untouched');
});

Deno.test('reserve-photo at the thresholds: refuses at, accepts one byte below', async () => {
  const cases: Array<[number, number, number]> = [
    [799_999_999, 1, 201],
    [800_000_000, 1, 409],
    [1, 399_999_999, 201],
    [1, 400_000_000, 409],
  ];
  for (const [storageBytes, databaseBytes, status] of cases) {
    const app = createApp();
    const { editToken } = await draftWithPhotos(app, 0);
    app.backend.usage = { storageBytes, databaseBytes };
    const r = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
    assertEquals(r.status, status, `${storageBytes}/${databaseBytes}`);
  }
});

Deno.test('reserve-photo with a wrong token is the uniform 404 and measures nothing', async () => {
  const app = createApp();
  setFull(app);
  const r = await call(app.handlers.manage, { action: 'reserve-photo', editToken: 'x'.repeat(43) });
  assertEquals(r.status, 404);
  assertEquals(app.backend.spaceChecks, 0);
});

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

Deno.test('publish with every photo ready is never refused, and measures nothing', async () => {
  const app = createApp();
  const { editToken, photoIds } = await draftWithPhotos(app, 2);
  const checksBefore = app.backend.spaceChecks; // the two reservations measured; publish must not
  setFull(app);
  const r = await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(photoIds),
  });
  assertEquals(r.status, 200);
  assertEquals(app.backend.spaceChecks, checksBefore);
  // A re-publish that adds no file is also accepted while full.
  const again = await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(photoIds, { title: 'Changed' }),
  });
  assertEquals(again.status, 200);
  assertEquals(app.backend.spaceChecks, checksBefore);
});

Deno.test(
  'publish listing a photo that is not ready: space_full while full, conflict while free',
  async () => {
    const app = createApp();
    const { editToken, photoIds } = await draftWithPhotos(app, 1);
    const pending = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
    const document = documentFor([...photoIds, pending.json.photoId]);

    setFull(app);
    const checksBefore = app.backend.spaceChecks;
    const full = await call(app.handlers.manage, { action: 'publish', editToken, document });
    assertEquals(full.status, 409);
    assertEquals(full.json, FULL_BODY, 'no field');
    assertEquals(app.backend.spaceChecks, checksBefore + 1, 'measured once');
    assertEquals(app.backend.museums.size, 1);
    assertEquals([...app.backend.museums.values()][0]!.status, 'draft', 'nothing published');

    setFree(app);
    const free = await call(app.handlers.manage, { action: 'publish', editToken, document });
    assertEquals(free.status, 409);
    assertEquals(free.json.error, 'conflict');
    assertEquals(free.json.field, 'document.photos[1].photoId');
  },
);

Deno.test(
  'publish listing an unknown photo id is judged the same way as an unready one',
  async () => {
    const app = createApp();
    const { editToken } = await draftWithPhotos(app, 0);
    const document = documentFor(['00000000-0000-4000-8000-0000000000ff']);
    setFull(app);
    assertEquals(
      (await call(app.handlers.manage, { action: 'publish', editToken, document })).json,
      FULL_BODY,
    );
    setFree(app);
    assertEquals(
      (await call(app.handlers.manage, { action: 'publish', editToken, document })).json.error,
      'conflict',
    );
  },
);

// ---------------------------------------------------------------------------
// Never refused for space (FR-107, FR-104 (c))
// ---------------------------------------------------------------------------

Deno.test('while full, every other action and function works and measures nothing', async () => {
  const app = createApp();
  const { editToken, photoIds } = await draftWithPhotos(app, 2);
  const published = await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(photoIds),
  });
  assertEquals(published.status, 200);

  // A photo reserved before the threshold, with both files uploaded, but not yet confirmed.
  const ticket = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
  app.backend.putToUploadUrl(ticket.json.full.signedUrl, buildJpeg({ width: 2048, height: 1536 }));
  app.backend.putToUploadUrl(ticket.json.wall.signedUrl, buildJpeg({ width: 1024, height: 768 }));
  // A second one, used for renew-upload and remove-photo.
  const spare = await call(app.handlers.manage, { action: 'reserve-photo', editToken });

  const checksBefore = app.backend.spaceChecks;
  setFull(app);

  const get = await call(app.handlers.manage, { action: 'get', editToken });
  assertEquals(get.status, 200);

  const renew = await call(app.handlers.manage, {
    action: 'renew-upload',
    editToken,
    photoId: spare.json.photoId,
  });
  assertEquals(renew.status, 200);

  const confirm = await call(app.handlers.manage, {
    action: 'confirm-photo',
    editToken,
    photoId: ticket.json.photoId,
    width: 2048,
    height: 1536,
    lqip: lqipDataUrl(),
  });
  assertEquals(confirm.status, 200, 'a photo reserved before the threshold still finishes');

  const remove = await call(app.handlers.manage, {
    action: 'remove-photo',
    editToken,
    photoId: spare.json.photoId,
  });
  assertEquals(remove.status, 200);

  const shareToken = await deriveShareToken(editToken);
  assertEquals((await call(app.handlers.get, { shareToken })).status, 200, 'Visitors are served');

  assertEquals((await call(app.handlers.keepAlive, {}, anon)).status, 200);
  assertEquals(
    (
      await call(
        app.handlers.purge,
        {},
        { origin: null, headers: { 'x-cron-secret': CRON_SECRET } },
      )
    ).status,
    200,
  );

  const del = await call(app.handlers.manage, { action: 'delete', editToken });
  assertEquals(del.status, 200);

  assertEquals(app.backend.spaceChecks, checksBefore, 'none of these measured space');
});

// ---------------------------------------------------------------------------
// Fail open
// ---------------------------------------------------------------------------

Deno.test(
  'a failed measurement fails open on every gated action and logs only the error name',
  async () => {
    const app = createApp();
    app.backend.failSpaceUsage = true;
    const lines = await captureErrors(async () => {
      const created = await call(app.handlers.create, {});
      assertEquals(created.status, 201);
      const editToken: string = created.json.editToken;
      const reserved = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
      assertEquals(reserved.status, 201);
      // Publish listing an unready photo: the guard cannot measure, so it is the usual conflict.
      const publish = await call(app.handlers.manage, {
        action: 'publish',
        editToken,
        document: documentFor([reserved.json.photoId]),
      });
      assertEquals(publish.status, 409);
      assertEquals(publish.json.error, 'conflict');
    });
    assertEquals(lines, [
      'space check unavailable (Error)',
      'space check unavailable (Error)',
      'space check unavailable (Error)',
    ]);
    assertEquals(lines.join('').includes('usage query down'), false, 'no message, no figure');
  },
);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_ENV: Record<string, string> = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
  RATE_LIMIT_SALT: 'salt',
  ALLOWED_ORIGINS: 'https://patlu29.github.io',
};
const envWith = (extra: Record<string, string>) => (name: string) =>
  ({ ...BASE_ENV, ...extra })[name];

Deno.test('config: both thresholds default to 800,000,000 and 400,000,000', () => {
  assertEquals(loadConfig(envWith({})).spaceLimits, {
    storageBytes: 800_000_000,
    databaseBytes: 400_000_000,
  });
});

Deno.test('config: valid overrides are read, with spaces trimmed', () => {
  const config = loadConfig(
    envWith({ SPACE_FULL_STORAGE_BYTES: ' 1 ', SPACE_FULL_DATABASE_BYTES: '1000000000000' }),
  );
  assertEquals(config.spaceLimits, { storageBytes: 1, databaseBytes: 1_000_000_000_000 });
});

Deno.test('config: an invalid threshold is a ConfigError that names the variable', () => {
  const bad = [
    '0',
    '-5',
    '1.5',
    '1e9',
    'abc',
    '0x10',
    '1000000000001',
    '99999999999999999999',
    '8 00',
  ];
  for (const value of bad) {
    for (const name of ['SPACE_FULL_STORAGE_BYTES', 'SPACE_FULL_DATABASE_BYTES']) {
      let error: unknown;
      try {
        loadConfig(envWith({ [name]: value }));
      } catch (e) {
        error = e;
      }
      assert(error instanceof ConfigError, `${name}=${value}`);
      assertEquals(error.missing, [name]);
      assert(!error.message.includes(value), 'the value is not echoed');
    }
  }
});

Deno.test('config: a blank threshold counts as unset', () => {
  assertEquals(
    loadConfig(envWith({ SPACE_FULL_STORAGE_BYTES: '  ' })).spaceLimits.storageBytes,
    800_000_000,
  );
});
