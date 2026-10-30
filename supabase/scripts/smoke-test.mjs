#!/usr/bin/env node
/**
 * End-to-end smoke test of the deployed (or locally served) Edge Functions.
 *
 *   node supabase/scripts/smoke-test.mjs <project-url> <anon-or-publishable-key>
 *
 * It creates a throw-away museum, uploads two tiny synthetic JPEGs through the signed upload
 * URLs, confirms them, publishes, reads the museum back by share token, checks that bad links
 * and a metadata-bearing upload are refused, then deletes everything. Nothing is left behind.
 * It prints PASS or FAIL for each step and exits with status 1 if any step fails.
 *
 * Needs Node 18 or later. No dependencies. Sends no Origin header, so CORS is not exercised.
 */

const [baseArg, anonKey] = process.argv.slice(2);
if (!baseArg || !anonKey) {
  console.error(
    'Usage: node supabase/scripts/smoke-test.mjs <project-url> <anon-or-publishable-key>',
  );
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, '');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failures++;
};

async function call(fn, body) {
  const response = await fetch(`${base}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, 'x-region': 'ap-southeast-2' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // leave json null
  }
  return { status: response.status, json, text };
}

// --- a minimal structurally valid JPEG (the server checks bytes, it never decodes pixels) -------
function segment(marker, payload) {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}
function jpeg(width, height, extraSegments = []) {
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
  return new Uint8Array([
    0xff,
    0xd8,
    ...segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...extraSegments.flat(),
    ...segment(0xdb, [0, ...Array.from({ length: 64 }, () => 16)]),
    ...segment(0xc0, [
      8,
      height >> 8,
      height & 0xff,
      width >> 8,
      width & 0xff,
      3,
      1,
      0x11,
      0,
      2,
      0x11,
      0,
      3,
      0x11,
      0,
    ]),
    ...segment(0xc4, [0, 1, ...Array.from({ length: 15 }, () => 0), 0]),
    ...segment(0xda, [3, 1, 0, 2, 0, 3, 0, 0, 63, 0]),
    0x12,
    0x34,
    0xff,
    0x00,
    0x56,
    0x78,
    0xff,
    0xd9,
  ]);
}
const exif = segment(
  0xe1,
  [...'Exif'].map((c) => c.charCodeAt(0)).concat([0, 0, 77, 77, 0, 42, 0, 0, 0, 8]),
);
const lqip = 'data:image/jpeg;base64,' + Buffer.from(jpeg(24, 16)).toString('base64');

async function put(url, bytes) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: bytes,
  });
  return response.status;
}

const avatar = (gender = 'neutral', facialHair = 'none') => ({
  v: 1,
  gender,
  skinTone: 'skin-03',
  hairStyle: 'bob',
  hairColor: 'brown',
  outfitStyle: 'hoodie',
  outfitColor: 'teal',
  bodyType: 'regular',
  height: 'medium',
  facialHair,
  glasses: 'none',
  hat: 'none',
});

let editToken = null;
try {
  const created = await call('create-museum', {});
  check(
    'create-museum returns an edit token',
    created.status === 201 && /^[A-Za-z0-9_-]{43}$/.test(created.json?.editToken ?? ''),
    `status ${created.status}`,
  );
  editToken = created.json?.editToken;
  if (!editToken) throw new Error('cannot continue without an edit token');
  const manage = (body) => call('manage-museum', { editToken, ...body });

  const photoIds = [];
  for (let i = 0; i < 2; i++) {
    const ticket = await manage({ action: 'reserve-photo' });
    check(
      `reserve-photo ${i + 1}`,
      ticket.status === 201 && ticket.json?.photoId,
      `status ${ticket.status} ${ticket.text.slice(0, 120)}`,
    );
    if (!ticket.json?.photoId) throw new Error('reserve failed');
    const fullStatus = await put(ticket.json.full.signedUrl, jpeg(800, 600));
    const wallStatus = await put(ticket.json.wall.signedUrl, jpeg(400, 300));
    check(
      `signed upload PUT ${i + 1} (full and wall)`,
      fullStatus === 200 && wallStatus === 200,
      `full ${fullStatus}, wall ${wallStatus}`,
    );
    const confirmed = await manage({
      action: 'confirm-photo',
      photoId: ticket.json.photoId,
      width: 800,
      height: 600,
      lqip,
    });
    check(
      `confirm-photo ${i + 1}`,
      confirmed.status === 200 && confirmed.json?.status === 'ready',
      `status ${confirmed.status} ${confirmed.text.slice(0, 160)}`,
    );
    photoIds.push(ticket.json.photoId);
  }

  // A file with EXIF must be refused and its objects deleted.
  const bad = await manage({ action: 'reserve-photo' });
  await put(bad.json.full.signedUrl, jpeg(800, 600, [exif]));
  await put(bad.json.wall.signedUrl, jpeg(400, 300));
  const refused = await manage({
    action: 'confirm-photo',
    photoId: bad.json.photoId,
    width: 800,
    height: 600,
    lqip,
  });
  check(
    'confirm-photo refuses a JPEG that still has EXIF (422 invalid_image)',
    refused.status === 422 && refused.json?.error === 'invalid_image',
    `status ${refused.status}`,
  );
  await manage({ action: 'remove-photo', photoId: bad.json.photoId });

  const published = await manage({
    action: 'publish',
    document: {
      title: 'Smoke test',
      visitorName: 'Sam',
      guideName: 'Alex',
      openingGreeting: '',
      closingMessage: 'It works.',
      theme: 'default',
      visitorAvatar: avatar('feminine', 'stubble'),
      guideAvatar: avatar('masculine', 'stubble'),
      photos: [
        { photoId: photoIds[1], caption: 'Second' },
        { photoId: photoIds[0], caption: 'First' },
      ],
    },
  });
  check(
    'publish returns a share token',
    published.status === 200 && /^[A-Za-z0-9_-]{24}$/.test(published.json?.shareToken ?? ''),
    `status ${published.status} ${published.text.slice(0, 160)}`,
  );
  const shareToken = published.json?.shareToken;

  const visit = await call('get-museum', { shareToken });
  const photos = visit.json?.museum?.photos ?? [];
  check(
    'get-museum returns the museum in the published order',
    visit.status === 200 &&
      photos.map((p) => p.id).join() === photoIds.slice().reverse().join() &&
      visit.json.museum.guideName === 'Alex' &&
      visit.json.museum.visitorAvatar?.gender === 'feminine' &&
      visit.json.museum.visitorAvatar?.facialHair === 'stubble' &&
      visit.json.museum.guideAvatar?.gender === 'masculine',
    `status ${visit.status}`,
  );
  const image = photos[0] ? await fetch(photos[0].wallUrl) : null;
  check(
    'signed wall URL downloads the photo',
    image?.status === 200 && (await image.arrayBuffer()).byteLength > 100,
    `status ${image?.status}`,
  );

  const edit = await manage({ action: 'get' });
  check(
    'manage get shows the share token and document',
    edit.status === 200 &&
      edit.json?.shareToken === shareToken &&
      edit.json?.document?.visitorName === 'Sam',
    `status ${edit.status}`,
  );

  const notFound = await Promise.all([
    call('get-museum', { shareToken: 'x'.repeat(24) }),
    call('get-museum', { shareToken: 'short' }),
    call('manage-museum', { action: 'get', editToken: 'y'.repeat(43) }),
  ]);
  check(
    'bad links all return the identical 404 body',
    notFound.every((r) => r.status === 404) && new Set(notFound.map((r) => r.text)).size === 1,
    notFound.map((r) => r.status).join(),
  );

  const removed = await manage({ action: 'delete' });
  check(
    'delete removes the museum',
    removed.status === 200 && removed.json?.deleted === true,
    `status ${removed.status}`,
  );
  editToken = null;
  const gone = await call('get-museum', { shareToken });
  check(
    'share link returns 404 immediately after delete',
    gone.status === 404,
    `status ${gone.status}`,
  );
} catch (error) {
  failures++;
  console.log(`FAIL  stopped early: ${error.message}`);
} finally {
  if (editToken) {
    await call('manage-museum', { action: 'delete', editToken }).catch(() => undefined);
    console.log('cleaned up the test museum');
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
