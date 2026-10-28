import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { EDIT_TOKEN_PATTERN, SHARE_TOKEN_PATTERN } from '@contract';
import {
  buildJpeg,
  EXIF,
  JFIF,
  lqipDataUrl,
  safariCanvasJpeg,
} from '../_shared/testing/jpegFixtures.ts';
import { deriveShareToken } from '../_shared/tokens.ts';
import { call, createApp, documentFor, draftWithPhotos, ORIGIN } from './helpers.ts';

const SERVER_ERROR_KEYS = ['error', 'message'];

Deno.test(
  'create-museum issues a 256-bit edit token, stores only hashes, and expires drafts in 7 days',
  async () => {
    const app = createApp();
    const { status, json, headers } = await call(app.handlers.create, {});
    assertEquals(status, 201);
    assert(EDIT_TOKEN_PATTERN.test(json.editToken));
    assertEquals(json.draftExpiresAt, new Date(app.nowMs() + 7 * 86_400_000).toISOString());
    assertEquals(headers.get('cache-control'), 'no-store');
    assertEquals(headers.get('access-control-allow-origin'), ORIGIN);
    assertEquals(app.backend.museums.size, 1);
    const stored = JSON.stringify([...app.backend.museums.values()]);
    assert(!stored.includes(json.editToken), 'the token must not be stored');
    assert(
      !stored.includes(await deriveShareToken(json.editToken)),
      'the share token must not be stored',
    );
  },
);

Deno.test('create-museum rejects unexpected bodies and non-JSON content types', async () => {
  const app = createApp();
  assertEquals((await call(app.handlers.create, { name: 'x' })).status, 400);
  assertEquals((await call(app.handlers.create, '{bad json')).status, 400);
  assertEquals((await call(app.handlers.create, {}, { contentType: 'text/plain' })).status, 415);
  assertEquals((await call(app.handlers.create, {}, { method: 'GET' })).status, 405);
});

Deno.test('create-museum is limited to 10 drafts per hour per IP', async () => {
  const app = createApp();
  for (let i = 0; i < 10; i++) assertEquals((await call(app.handlers.create, {})).status, 201);
  const blocked = await call(app.handlers.create, {});
  assertEquals(blocked.status, 429);
  assertEquals(blocked.json.error, 'rate_limited');
  assert(Number(blocked.headers.get('retry-after')) >= 1);
  // A different client is unaffected.
  assertEquals((await call(app.handlers.create, {}, { ip: '198.51.100.9' })).status, 201);
});

Deno.test('CORS: allowed origins get headers, others are refused, preflight works', async () => {
  const app = createApp();
  const preflight = await call(app.handlers.manage, null, { method: 'OPTIONS' });
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  assert(preflight.headers.get('access-control-allow-headers')!.includes('x-region'));
  assert(preflight.headers.get('access-control-allow-headers')!.includes('apikey'));
  assertEquals(preflight.headers.get('vary'), 'Origin');

  const refused = await call(app.handlers.create, {}, { origin: 'https://evil.example' });
  assertEquals(refused.status, 403);
  assertEquals(refused.headers.get('access-control-allow-origin'), null);
  assertEquals(app.backend.museums.size, 0);

  // No Origin header (cron, curl): allowed, and no CORS headers.
  const server = await call(app.handlers.create, {}, { origin: null });
  assertEquals(server.status, 201);
  assertEquals(server.headers.get('access-control-allow-origin'), null);
});

Deno.test('full lifecycle: upload, publish, visit by share token, edit, delete', async () => {
  const app = createApp();
  const { editToken, photoIds } = await draftWithPhotos(app, 3);

  // Before publishing, the derived share link finds nothing.
  const shareToken = await deriveShareToken(editToken);
  assert(SHARE_TOKEN_PATTERN.test(shareToken));
  assertEquals((await call(app.handlers.get, { shareToken })).status, 404);

  const draft = await call(app.handlers.manage, { action: 'get', editToken });
  assertEquals(draft.status, 200);
  assertEquals(draft.json.status, 'draft');
  assertEquals(draft.json.shareToken, null);
  assertEquals(draft.json.document, null);
  assertEquals(draft.json.photos.length, 3);

  // Publish with a new order, dropping nothing; captions and avatars persist.
  const order = [photoIds[2]!, photoIds[0]!, photoIds[1]!];
  const published = await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(order),
  });
  assertEquals(published.status, 200);
  assertEquals(published.json.shareToken, shareToken);
  assertEquals(published.json.expiresAt, new Date(app.nowMs() + 90 * 86_400_000).toISOString());

  const visit = await call(app.handlers.get, { shareToken });
  assertEquals(visit.status, 200);
  const museum = visit.json.museum;
  assertEquals(museum.visitorName, 'Sam');
  assertEquals(museum.guideAvatar.facialHair, 'stubble');
  assertEquals(museum.closingMessage, 'Happy birthday!\nLove always.');
  assertEquals(
    museum.photos.map((p: { id: string }) => p.id),
    order,
  );
  assertEquals(
    museum.photos.map((p: { position: number }) => p.position),
    [0, 1, 2],
  );
  assertEquals(museum.photos[0].caption, 'Caption 1');
  assertEquals(museum.photos[0].width, 2048);
  assert(museum.photos[0].wallUrl.includes('ttl=3600'));
  assert(
    museum.photos[0].fullUrl.endsWith('full.jpg?token=t&ttl=3600') ||
      museum.photos[0].fullUrl.includes('/full.jpg'),
  );
  assertEquals(visit.json.urlsExpireAt, new Date(app.nowMs() + 3600_000).toISOString());
  assertEquals(Object.keys(museum.photos[0]).sort(), [
    'caption',
    'fullUrl',
    'height',
    'id',
    'lqip',
    'position',
    'wallUrl',
    'width',
  ]);

  // The edit screen shows the share token and the stored document.
  const edit = await call(app.handlers.manage, { action: 'get', editToken });
  assertEquals(edit.json.status, 'published');
  assertEquals(edit.json.shareToken, shareToken);
  assertEquals(
    edit.json.document.photos.map((p: { photoId: string }) => p.photoId),
    order,
  );

  // Re-publishing with one photo removed deletes it and does not extend retention.
  app.advance(86_400_000);
  const second = await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(order.slice(0, 2), { closingMessage: 'Edited' }),
  });
  assertEquals(second.status, 200);
  assertEquals(second.json.expiresAt, published.json.expiresAt);
  assertEquals(second.json.publishedAt, published.json.publishedAt);
  assertEquals((await call(app.handlers.get, { shareToken })).json.museum.photos.length, 2);
  assert(
    ![...app.backend.objects.keys()].some((k) => k.includes(order[2]!)),
    'removed photo objects are deleted',
  );

  // Delete: both links stop working at once and storage is cleared.
  const deleted = await call(app.handlers.manage, { action: 'delete', editToken });
  assertEquals(deleted.json, { deleted: true });
  assertEquals((await call(app.handlers.get, { shareToken })).status, 404);
  assertEquals((await call(app.handlers.manage, { action: 'get', editToken })).status, 404);
  assertEquals(app.backend.objects.size, 0);
  assertEquals(app.backend.purgeQueue.size, 0);
});

Deno.test('delete keeps the museum queued for the hourly retry when storage fails', async () => {
  const app = createApp();
  const { editToken } = await draftWithPhotos(app, 1);
  app.backend.failStorageRemoval = true;
  const deleted = await call(app.handlers.manage, { action: 'delete', editToken });
  assertEquals(deleted.status, 200);
  assertEquals(app.backend.purgeQueue.size, 1);
  assert(app.backend.objects.size > 0);
});

Deno.test('every bad link returns the identical 404 body', async () => {
  const app = createApp();
  const { editToken, photoIds } = await draftWithPhotos(app, 1);
  const draftShare = await deriveShareToken(editToken);
  await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(photoIds),
  });
  const deletedApp = await draftWithPhotos(app, 1, '198.51.100.1');
  await call(app.handlers.manage, { action: 'delete', editToken: deletedApp.editToken });
  const deletedShare = await deriveShareToken(deletedApp.editToken);

  const bodies: string[] = [];
  for (const shareToken of [
    'short',
    'x'.repeat(24),
    'not valid!!!!!!!!!!!!!!!',
    deletedShare,
    '_'.repeat(24),
  ]) {
    const r = await call(app.handlers.get, { shareToken }, { ip: `192.0.2.${bodies.length + 1}` });
    assertEquals(r.status, 404);
    bodies.push(JSON.stringify(r.json));
  }
  // An expired museum behaves the same.
  app.advance(91 * 86_400_000);
  const expired = await call(app.handlers.get, { shareToken: draftShare }, { ip: '192.0.2.99' });
  assertEquals(expired.status, 404);
  bodies.push(JSON.stringify(expired.json));
  assertEquals(new Set(bodies).size, 1);
  assertEquals(Object.keys(JSON.parse(bodies[0]!)).sort(), SERVER_ERROR_KEYS);

  // The edit endpoint answers a bad edit token the same way.
  const manage = await call(
    app.handlers.manage,
    { action: 'get', editToken: 'x'.repeat(43) },
    { ip: '192.0.2.50' },
  );
  assertEquals(manage.status, 404);
  assertEquals(JSON.stringify(manage.json), bodies[0]);
  const malformed = await call(
    app.handlers.manage,
    { action: 'get', editToken: 'bad' },
    { ip: '192.0.2.51' },
  );
  assertEquals(JSON.stringify(malformed.json), bodies[0]);
});

Deno.test(
  'the share token cannot be used as an edit token, and the edit token cannot read as a share token',
  async () => {
    const app = createApp();
    const { editToken, photoIds } = await draftWithPhotos(app, 1);
    await call(app.handlers.manage, {
      action: 'publish',
      editToken,
      document: documentFor(photoIds),
    });
    const shareToken = await deriveShareToken(editToken);
    assertEquals(
      (await call(app.handlers.manage, { action: 'delete', editToken: shareToken.padEnd(43, 'A') }))
        .status,
      404,
    );
    assertEquals(
      (await call(app.handlers.get, { shareToken: editToken.slice(0, 24) })).status,
      404,
    );
    assertEquals(app.backend.museums.size, 1);
  },
);

Deno.test(
  'get-museum limits guessing: 20 misses per 10 minutes per IP, then 429 even for valid links',
  async () => {
    const app = createApp();
    const { editToken, photoIds } = await draftWithPhotos(app, 1);
    await call(app.handlers.manage, {
      action: 'publish',
      editToken,
      document: documentFor(photoIds),
    });
    const shareToken = await deriveShareToken(editToken);
    for (let i = 0; i < 20; i++) {
      assertEquals(
        (
          await call(
            app.handlers.get,
            { shareToken: `${'a'.repeat(23)}${i % 10}` },
            { ip: '192.0.2.10' },
          )
        ).status,
        404,
      );
    }
    const blocked = await call(app.handlers.get, { shareToken }, { ip: '192.0.2.10' });
    assertEquals(blocked.status, 429);
    assert(blocked.headers.get('retry-after') !== null);
    // Another address is unaffected; valid lookups never count as misses.
    for (let i = 0; i < 25; i++)
      assertEquals(
        (await call(app.handlers.get, { shareToken }, { ip: '192.0.2.11' })).status,
        200,
      );
  },
);

Deno.test('get-museum is limited to 60 lookups per minute per IP', async () => {
  const app = createApp();
  const { editToken, photoIds } = await draftWithPhotos(app, 1);
  await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor(photoIds),
  });
  const shareToken = await deriveShareToken(editToken);
  for (let i = 0; i < 60; i++)
    assertEquals((await call(app.handlers.get, { shareToken }, { ip: '192.0.2.20' })).status, 200);
  assertEquals((await call(app.handlers.get, { shareToken }, { ip: '192.0.2.20' })).status, 429);
  app.advance(60_000);
  assertEquals((await call(app.handlers.get, { shareToken }, { ip: '192.0.2.20' })).status, 200);
});

Deno.test('get-museum rejects a body with no token as bad_request', async () => {
  const app = createApp();
  const r = await call(app.handlers.get, {});
  assertEquals(r.status, 400);
  assertEquals(r.json.error, 'bad_request');
  assertEquals(r.json.field, 'shareToken');
});

Deno.test(
  'confirm-photo rejects EXIF, wrong size and missing uploads, and deletes the objects',
  async () => {
    const app = createApp();
    const created = await call(app.handlers.create, {});
    const editToken: string = created.json.editToken;
    const ticket = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
    const photoId: string = ticket.json.photoId;
    const confirm = (extra: Record<string, unknown> = {}) =>
      call(app.handlers.manage, {
        action: 'confirm-photo',
        editToken,
        photoId,
        width: 800,
        height: 600,
        lqip: lqipDataUrl(),
        ...extra,
      });

    // Nothing uploaded yet.
    const missing = await confirm();
    assertEquals(missing.status, 409);
    assertEquals(missing.json.error, 'conflict');

    // EXIF in the full rendition.
    app.backend.putToUploadUrl(
      ticket.json.full.signedUrl,
      buildJpeg({ width: 800, height: 600, before: [JFIF, EXIF] }),
    );
    app.backend.putToUploadUrl(ticket.json.wall.signedUrl, buildJpeg({ width: 800, height: 600 }));
    const exif = await confirm();
    assertEquals(exif.status, 422);
    assertEquals(exif.json.error, 'invalid_image');
    assertEquals(exif.json.field, 'full');
    assert(!JSON.stringify(exif.json).includes('Exif'));
    assertEquals(app.backend.objects.size, 0, 'unsafe objects are deleted');

    // The photo is still pending, so new URLs can be issued and the upload retried.
    const renewed = await call(app.handlers.manage, { action: 'renew-upload', editToken, photoId });
    assertEquals(renewed.status, 200);
    app.backend.putToUploadUrl(renewed.json.full.signedUrl, buildJpeg({ width: 800, height: 600 }));
    app.backend.putToUploadUrl(renewed.json.wall.signedUrl, buildJpeg({ width: 800, height: 600 }));

    // Declared size must match the file.
    assertEquals((await confirm({ width: 799 })).status, 422);
    app.backend.putToUploadUrl(renewed.json.full.signedUrl, buildJpeg({ width: 800, height: 600 }));
    app.backend.putToUploadUrl(renewed.json.wall.signedUrl, buildJpeg({ width: 400, height: 600 }));
    const mismatch = await confirm();
    assertEquals(mismatch.status, 422, 'wall and full must show the same picture');

    // Wall rendition over 1024 px.
    app.backend.putToUploadUrl(
      renewed.json.full.signedUrl,
      buildJpeg({ width: 2048, height: 1536 }),
    );
    app.backend.putToUploadUrl(
      renewed.json.wall.signedUrl,
      buildJpeg({ width: 2048, height: 1536 }),
    );
    assertEquals((await confirm({ width: 2048, height: 1536 })).status, 422);

    // A good pair, then confirming again is idempotent.
    app.backend.putToUploadUrl(
      renewed.json.full.signedUrl,
      buildJpeg({ width: 2048, height: 1536 }),
    );
    app.backend.putToUploadUrl(
      renewed.json.wall.signedUrl,
      buildJpeg({ width: 1024, height: 768 }),
    );
    const good = await confirm({ width: 2048, height: 1536 });
    assertEquals(good.status, 200);
    assertEquals(good.json, { photoId, status: 'ready' });
    assertEquals((await confirm({ width: 2048, height: 1536 })).status, 200);
    assertEquals(
      (await call(app.handlers.manage, { action: 'renew-upload', editToken, photoId })).status,
      409,
    );
  },
);

Deno.test(
  'confirm-photo rejects non-JPEG bytes, oversize files and a bad placeholder',
  async () => {
    const app = createApp();
    const editToken: string = (await call(app.handlers.create, {})).json.editToken;
    const ticket = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
    const photoId: string = ticket.json.photoId;
    const confirm = (lqip = lqipDataUrl()) =>
      call(app.handlers.manage, {
        action: 'confirm-photo',
        editToken,
        photoId,
        width: 100,
        height: 100,
        lqip,
      });

    app.backend.putToUploadUrl(
      ticket.json.full.signedUrl,
      new TextEncoder().encode('<svg onload=alert(1)>'),
    );
    app.backend.putToUploadUrl(ticket.json.wall.signedUrl, buildJpeg({ width: 100, height: 100 }));
    assertEquals((await confirm()).status, 422);

    app.backend.putToUploadUrl(ticket.json.full.signedUrl, new Uint8Array(2 * 1024 * 1024 + 1));
    app.backend.putToUploadUrl(ticket.json.wall.signedUrl, buildJpeg({ width: 100, height: 100 }));
    assertEquals((await confirm()).status, 422);

    const bad = await confirm(
      'data:image/jpeg;base64,' + btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe1, 0, 4, 1, 2)),
    );
    assertEquals(bad.status, 400);
    assertEquals(bad.json.field, 'lqip');
    assertEquals((await confirm('data:image/png;base64,AAAA')).status, 400);
    assertEquals((await confirm('x'.repeat(5000))).status, 400);
  },
);

Deno.test('reserve-photo enforces 20 live photos and 100 lifetime reservations', async () => {
  const app = createApp();
  const editToken: string = (await call(app.handlers.create, {})).json.editToken;
  for (let i = 0; i < 20; i++) {
    assertEquals(
      (await call(app.handlers.manage, { action: 'reserve-photo', editToken })).status,
      201,
    );
  }
  const over = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
  assertEquals(over.status, 409);
  assertEquals(over.json.error, 'photo_limit');

  // Churn through reservations to hit the lifetime quota.
  const museumId = [...app.backend.museums.keys()][0]!;
  for (const p of [...app.backend.photos.values()]) {
    await call(app.handlers.manage, { action: 'remove-photo', editToken, photoId: p.id });
  }
  app.backend.museums.get(museumId)!.reservations = 100;
  const quota = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
  assertEquals(quota.status, 409);
  assertEquals(quota.json.error, 'upload_quota');
});

Deno.test('remove-photo is idempotent and cannot remove a published photo', async () => {
  const app = createApp();
  const { editToken, photoIds } = await draftWithPhotos(app, 2);
  const first = await call(app.handlers.manage, {
    action: 'remove-photo',
    editToken,
    photoId: photoIds[1],
  });
  assertEquals(first.json, { photoId: photoIds[1], removed: true });
  assertEquals(
    (await call(app.handlers.manage, { action: 'remove-photo', editToken, photoId: photoIds[1] }))
      .status,
    200,
  );
  assertEquals(app.backend.photos.size, 1);
  assertEquals([...app.backend.objects.keys()].filter((k) => k.includes(photoIds[1]!)).length, 0);

  await call(app.handlers.manage, {
    action: 'publish',
    editToken,
    document: documentFor([photoIds[0]!]),
  });
  const blocked = await call(app.handlers.manage, {
    action: 'remove-photo',
    editToken,
    photoId: photoIds[0],
  });
  assertEquals(blocked.status, 409);
});

Deno.test(
  "publish validates the document and refuses photos that are not ready or not this museum's",
  async () => {
    const app = createApp();
    const { editToken, photoIds } = await draftWithPhotos(app, 2);
    const other = await draftWithPhotos(app, 1, '198.51.100.2');
    const publish = (document: unknown) =>
      call(app.handlers.manage, { action: 'publish', editToken, document });

    const pendingTicket = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
    const notReady = await publish(documentFor([photoIds[0]!, pendingTicket.json.photoId]));
    assertEquals(notReady.status, 409);
    assertEquals(notReady.json.field, 'document.photos[1].photoId');

    const foreign = await publish(documentFor([other.photoIds[0]!]));
    assertEquals(foreign.status, 409);

    const empty = await publish(documentFor([]));
    assertEquals(empty.status, 400);
    assertEquals(empty.json.field, 'document.photos');

    const noName = await publish(documentFor(photoIds, { visitorName: '   ' }));
    assertEquals(noName.status, 400);
    assertEquals(noName.json.field, 'document.visitorName');

    const longCaption = documentFor(photoIds);
    longCaption.photos[0]!.caption = 'x'.repeat(281);
    assertEquals((await publish(longCaption)).json.field, 'document.photos[0].caption');

    const extra = { ...documentFor(photoIds), isAdmin: true };
    assertEquals((await publish(extra)).json.field, 'document.isAdmin');

    assertEquals((await publish(documentFor([photoIds[0]!, photoIds[0]!]))).status, 400);
    assertEquals(
      app.backend.museums.values().next().value!.status,
      'draft',
      'nothing was published',
    );
    // The error body never echoes input.
    assert(!JSON.stringify(noName.json).includes('   '));
  },
);

Deno.test('one museum cannot touch another: tokens scope every action', async () => {
  const app = createApp();
  const a = await draftWithPhotos(app, 1);
  const b = await draftWithPhotos(app, 1, '198.51.100.3');
  // B's token with A's photo id behaves as if the photo does not exist.
  const renew = await call(app.handlers.manage, {
    action: 'renew-upload',
    editToken: b.editToken,
    photoId: a.photoIds[0],
  });
  assertEquals(renew.status, 404);
  const removed = await call(app.handlers.manage, {
    action: 'remove-photo',
    editToken: b.editToken,
    photoId: a.photoIds[0],
  });
  assertEquals(removed.status, 200);
  assertEquals(app.backend.photos.has(a.photoIds[0]!), true, "A's photo is untouched");
  const confirm = await call(app.handlers.manage, {
    action: 'confirm-photo',
    editToken: b.editToken,
    photoId: a.photoIds[0],
    width: 1,
    height: 1,
    lqip: lqipDataUrl(),
  });
  assertEquals(confirm.status, 404);
});

Deno.test('manage-museum rejects unknown actions, extra fields and bad photo ids', async () => {
  const app = createApp();
  const editToken: string = (await call(app.handlers.create, {})).json.editToken;
  assertEquals(
    (await call(app.handlers.manage, { action: 'explode', editToken })).json.field,
    'action',
  );
  assertEquals(
    (await call(app.handlers.manage, { action: 'get', editToken, extra: 1 })).json.field,
    'extra',
  );
  assertEquals(
    (await call(app.handlers.manage, { action: 'renew-upload', editToken, photoId: 'nope' })).json
      .field,
    'photoId',
  );
  assertEquals((await call(app.handlers.manage, [1, 2])).status, 400);
});

Deno.test('manage-museum is limited to 120 requests per minute per IP', async () => {
  const app = createApp();
  const editToken: string = (await call(app.handlers.create, {})).json.editToken;
  for (let i = 0; i < 120; i++)
    assertEquals((await call(app.handlers.manage, { action: 'get', editToken })).status, 200);
  assertEquals((await call(app.handlers.manage, { action: 'get', editToken })).status, 429);
});

Deno.test('oversized request bodies are refused', async () => {
  const app = createApp();
  const r = await call(app.handlers.manage, {
    action: 'get',
    editToken: 'x',
    pad: 'y'.repeat(70_000),
  });
  assertEquals(r.status, 413);
});

Deno.test('error responses never leak internals', async () => {
  const app = createApp();
  app.backend.store.insertMuseum = () =>
    Promise.reject(Object.assign(new Error('relation "museums" secret detail'), { code: '42P01' }));
  const r = await call(app.handlers.create, {});
  assertEquals(r.status, 500);
  assertEquals(r.json, {
    error: 'server_error',
    message: 'Something went wrong. Please try again.',
  });
  assertNotEquals(r.json.message, undefined);
});

Deno.test(
  'confirm-photo accepts Safari canvas output after the browser strips APP1 and APP13, and refuses it raw',
  async () => {
    const app = createApp();
    const editToken: string = (await call(app.handlers.create, {})).json.editToken;
    const ticket = await call(app.handlers.manage, { action: 'reserve-photo', editToken });
    const photoId: string = ticket.json.photoId;
    const confirm = () =>
      call(app.handlers.manage, {
        action: 'confirm-photo',
        editToken,
        photoId,
        width: 2048,
        height: 1536,
        lqip: lqipDataUrl(),
      });
    const put = (stripped: boolean) => {
      app.backend.putToUploadUrl(
        ticket.json.full.signedUrl,
        safariCanvasJpeg({ width: 2048, height: 1536, stripped }),
      );
      app.backend.putToUploadUrl(
        ticket.json.wall.signedUrl,
        safariCanvasJpeg({ width: 1024, height: 768, stripped }),
      );
    };

    put(false);
    const raw = await confirm();
    assertEquals(raw.status, 422);
    assertEquals(raw.json.error, 'invalid_image');
    assertEquals(raw.json.field, 'full');
    assertEquals(app.backend.objects.size, 0);

    const renewed = await call(app.handlers.manage, { action: 'renew-upload', editToken, photoId });
    ticket.json.full.signedUrl = renewed.json.full.signedUrl;
    ticket.json.wall.signedUrl = renewed.json.wall.signedUrl;
    put(true);
    const clean = await confirm();
    assertEquals(clean.status, 200);
    assertEquals(clean.json, { photoId, status: 'ready' });
  },
);
