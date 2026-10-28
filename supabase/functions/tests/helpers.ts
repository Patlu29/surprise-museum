import { AVATAR_OPTIONS, type AvatarConfig, type MuseumDocument } from '@contract';
import { createCreateMuseumHandler } from '../create-museum/handler.ts';
import { createGetMuseumHandler } from '../get-museum/handler.ts';
import { createManageMuseumHandler } from '../manage-museum/handler.ts';
import { createPurgeExpiredHandler } from '../purge-expired/handler.ts';
import { buildJpeg, lqipDataUrl } from '../_shared/testing/jpegFixtures.ts';
import { MemoryBackend } from '../_shared/testing/memoryBackend.ts';

export const ORIGIN = 'https://patlu29.github.io';
export const CRON_SECRET = 'test-cron-secret-value';

export function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    v: 1,
    skinTone: AVATAR_OPTIONS.skinTone[2],
    hairStyle: AVATAR_OPTIONS.hairStyle[3],
    hairColor: AVATAR_OPTIONS.hairColor[1],
    outfitStyle: AVATAR_OPTIONS.outfitStyle[0],
    outfitColor: AVATAR_OPTIONS.outfitColor[4],
    bodyType: AVATAR_OPTIONS.bodyType[1],
    height: AVATAR_OPTIONS.height[1],
    facialHair: 'none',
    glasses: 'none',
    hat: 'none',
    ...overrides,
  };
}

export function createApp() {
  const backend = new MemoryBackend();
  let clock = new Date('2026-10-28T01:00:00Z').getTime();
  backend.now = () => new Date(clock);
  const config = {
    allowedOrigins: [ORIGIN, 'http://localhost:5173'],
    rateLimitSalt: 'salt',
    cronSecret: CRON_SECRET,
  };
  const base = { store: backend.store, config, now: () => new Date(clock) };
  const handlers = {
    create: createCreateMuseumHandler({ ...base }),
    get: createGetMuseumHandler({ ...base, storage: backend.storage }),
    manage: createManageMuseumHandler({ ...base, storage: backend.storage }),
    purge: createPurgeExpiredHandler({ ...base, storage: backend.storage }),
  };
  return {
    backend,
    handlers,
    advance(ms: number) {
      clock += ms;
    },
    nowMs: () => clock,
  };
}

export type Handler = (request: Request) => Promise<Response>;

export async function call(
  handler: Handler,
  body: unknown,
  options: {
    origin?: string | null;
    ip?: string;
    headers?: Record<string, string>;
    method?: string;
    contentType?: string;
  } = {},
): Promise<{ status: number; json: any; headers: Headers }> {
  const headers: Record<string, string> = {
    'content-type': options.contentType ?? 'application/json',
    'cf-connecting-ip': options.ip ?? '203.0.113.7',
    ...options.headers,
  };
  if (options.origin !== null) headers['origin'] = options.origin ?? ORIGIN;
  const response = await handler(
    new Request('https://project.supabase.co/functions/v1/x', {
      method: options.method ?? 'POST',
      headers,
      body:
        options.method === 'OPTIONS' || options.method === 'GET'
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body),
    }),
  );
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

/** Creates a draft, uploads and confirms `count` photos, and returns the tokens and photo ids. */
export async function draftWithPhotos(
  app: ReturnType<typeof createApp>,
  count: number,
  ip = '203.0.113.7',
) {
  const created = await call(app.handlers.create, {}, { ip });
  const editToken: string = created.json.editToken;
  const photoIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const ticket = await call(app.handlers.manage, { action: 'reserve-photo', editToken }, { ip });
    if (ticket.status !== 201) throw new Error(`reserve failed ${ticket.status}`);
    app.backend.putToUploadUrl(
      ticket.json.full.signedUrl,
      buildJpeg({ width: 2048, height: 1536 }),
    );
    app.backend.putToUploadUrl(ticket.json.wall.signedUrl, buildJpeg({ width: 1024, height: 768 }));
    const confirmed = await call(
      app.handlers.manage,
      {
        action: 'confirm-photo',
        editToken,
        photoId: ticket.json.photoId,
        width: 2048,
        height: 1536,
        lqip: lqipDataUrl(),
      },
      { ip },
    );
    if (confirmed.status !== 200) throw new Error(`confirm failed ${confirmed.status}`);
    photoIds.push(ticket.json.photoId);
  }
  return { editToken, photoIds };
}

export function documentFor(
  photoIds: string[],
  overrides: Partial<MuseumDocument> = {},
): MuseumDocument {
  return {
    title: 'For Sam',
    visitorName: 'Sam',
    guideName: 'Alex',
    openingGreeting: '',
    closingMessage: 'Happy birthday!\nLove always.',
    theme: 'default',
    visitorAvatar: avatar(),
    guideAvatar: avatar({ facialHair: 'stubble' }),
    photos: photoIds.map((photoId, i) => ({ photoId, caption: `Caption ${i + 1}` })),
    ...overrides,
  };
}
