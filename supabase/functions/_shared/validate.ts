/**
 * Input validation for every request body (docs/api.md). Used by the Edge Functions and by the
 * in-memory mock API, so both reject exactly the same input.
 *
 * Rules:
 *   - Validate at the boundary; unknown keys are rejected so nothing is stored by accident.
 *   - Text lengths count Unicode code points, matching char_length() in Postgres.
 *   - Text must be well-formed Unicode and contain no control characters. Only the closing
 *     message, the greeting and captions may contain line breaks.
 *   - Error messages never echo the submitted value.
 *
 * Pure TypeScript. The only import is the shared contract (so this file resolves in Deno through
 * its import map, in Vite, and in tsc without file extensions).
 */
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR_GENDER,
  EDIT_TOKEN_PATTERN,
  isAvatarGender,
  LIMITS,
  SHARE_TOKEN_PATTERN,
  type AvatarConfig,
  type ManageMuseumRequest,
  type MuseumDocument,
} from '@contract';

export type Validation<T> = { ok: true; value: T } | { ok: false; field: string; message: string };

/** Result of parsing a manage-museum body. A bad token is separate: it must look like "not found". */
export type ManageParse =
  | { ok: true; value: ManageMuseumRequest }
  | { ok: false; kind: 'bad_token' }
  | { ok: false; kind: 'invalid'; field: string; message: string };

function fail<T>(field: string, message: string): Validation<T> {
  return { ok: false, field, message };
}
function ok<T>(value: T): Validation<T> {
  return { ok: true, value };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isEditTokenShape(value: unknown): value is string {
  return typeof value === 'string' && EDIT_TOKEN_PATTERN.test(value);
}

export function isShareTokenShape(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

// A high surrogate not followed by a low one, or a low surrogate not preceded by a high one.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
// C0 and C1 controls except tab, line feed and carriage return, plus line and paragraph separators
// and the bidirectional override characters used to disguise text.
const FORBIDDEN_RANGES: Array<[number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];
const FORBIDDEN_CHARS = new RegExp(
  '[' + FORBIDDEN_RANGES.map(([from, to]) => String.fromCharCode(from, 45, to)).join('') + ']',
);
const LINE_BREAKS = /[\n\r\t]/;

export function codePointLength(text: string): number {
  let count = 0;
  for (const _ of text) count++;
  return count;
}

interface TextRules {
  field: string;
  label: string;
  min: number;
  max: number;
  multiline: boolean;
}

/** Trims, normalises line breaks to \n, and checks length and characters. */
export function validateText(value: unknown, rules: TextRules): Validation<string> {
  if (typeof value !== 'string') return fail(rules.field, `${rules.label} must be text.`);
  if (LONE_SURROGATE.test(value))
    return fail(rules.field, `${rules.label} contains invalid characters.`);
  let text = value.replace(/\r\n?/g, '\n').trim();
  if (FORBIDDEN_CHARS.test(text))
    return fail(rules.field, `${rules.label} contains invalid characters.`);
  if (!rules.multiline && LINE_BREAKS.test(text)) {
    return fail(rules.field, `${rules.label} must be on one line.`);
  }
  if (rules.multiline) text = text.replace(/\n{4,}/g, '\n\n\n');
  const length = codePointLength(text);
  if (length < rules.min) {
    return fail(rules.field, `${rules.label} is required.`);
  }
  if (length > rules.max) {
    return fail(rules.field, `${rules.label} must be ${rules.max} characters or fewer.`);
  }
  return ok(text);
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

const AVATAR_KEYS = ['v', 'gender', ...Object.keys(AVATAR_OPTIONS)] as const;

export function validateAvatar(value: unknown, field: string): Validation<AvatarConfig> {
  if (!isRecord(value)) return fail(field, 'Avatar settings are required.');
  const extra = unknownKeys(value, AVATAR_KEYS);
  if (extra !== null) return fail(`${field}.${extra}`, 'Unknown avatar setting.');
  if (value.v !== 1) return fail(`${field}.v`, 'Unsupported avatar version.');

  // Optional (ADR 0020): absent means 'neutral'. Anything else present must be a listed id.
  if (value.gender !== undefined && !isAvatarGender(value.gender)) {
    return fail(`${field}.gender`, 'Choose one of the available options.');
  }
  const out: Record<string, unknown> = {
    v: 1,
    gender: value.gender === undefined ? DEFAULT_AVATAR_GENDER : value.gender,
  };
  for (const key of Object.keys(AVATAR_OPTIONS) as Array<keyof typeof AVATAR_OPTIONS>) {
    const option = value[key];
    const allowed: readonly string[] = AVATAR_OPTIONS[key];
    if (typeof option !== 'string' || !allowed.includes(option)) {
      return fail(`${field}.${key}`, 'Choose one of the available options.');
    }
    out[key] = option;
  }
  return ok(out as unknown as AvatarConfig);
}

// ---------------------------------------------------------------------------
// Document (publish)
// ---------------------------------------------------------------------------

const DOCUMENT_KEYS = [
  'title',
  'visitorName',
  'guideName',
  'openingGreeting',
  'closingMessage',
  'theme',
  'visitorAvatar',
  'guideAvatar',
  'photos',
] as const;

export function validateDocument(
  value: unknown,
  fieldPrefix = 'document',
): Validation<MuseumDocument> {
  const f = (name: string) => `${fieldPrefix}.${name}`;
  if (!isRecord(value)) return fail(fieldPrefix, 'The museum document is required.');
  const extra = unknownKeys(value, DOCUMENT_KEYS);
  if (extra !== null) return fail(f(extra), 'Unknown field.');

  const title = validateText(value.title ?? '', {
    field: f('title'),
    label: 'The title',
    min: 0,
    max: LIMITS.titleMaxChars,
    multiline: false,
  });
  if (!title.ok) return title;
  const visitorName = validateText(value.visitorName, {
    field: f('visitorName'),
    label: "The Visitor's name",
    min: LIMITS.nameMinChars,
    max: LIMITS.nameMaxChars,
    multiline: false,
  });
  if (!visitorName.ok) return visitorName;
  const guideName = validateText(value.guideName, {
    field: f('guideName'),
    label: "The Guide's name",
    min: LIMITS.nameMinChars,
    max: LIMITS.nameMaxChars,
    multiline: false,
  });
  if (!guideName.ok) return guideName;
  const openingGreeting = validateText(value.openingGreeting ?? '', {
    field: f('openingGreeting'),
    label: 'The opening greeting',
    min: 0,
    max: LIMITS.greetingMaxChars,
    multiline: true,
  });
  if (!openingGreeting.ok) return openingGreeting;
  const closingMessage = validateText(value.closingMessage ?? '', {
    field: f('closingMessage'),
    label: 'The closing message',
    min: 0,
    max: LIMITS.closingMessageMaxChars,
    multiline: true,
  });
  if (!closingMessage.ok) return closingMessage;

  if (value.theme !== 'default') return fail(f('theme'), 'Choose one of the available themes.');

  const visitorAvatar = validateAvatar(value.visitorAvatar, f('visitorAvatar'));
  if (!visitorAvatar.ok) return visitorAvatar;
  const guideAvatar = validateAvatar(value.guideAvatar, f('guideAvatar'));
  if (!guideAvatar.ok) return guideAvatar;

  if (!Array.isArray(value.photos)) return fail(f('photos'), 'The photo list is required.');
  if (value.photos.length < LIMITS.minPhotos) {
    return fail(f('photos'), `Add at least ${LIMITS.minPhotos} photo.`);
  }
  if (value.photos.length > LIMITS.maxPhotos) {
    return fail(f('photos'), `A museum can hold at most ${LIMITS.maxPhotos} photos.`);
  }
  const seen = new Set<string>();
  const photos: MuseumDocument['photos'] = [];
  for (let i = 0; i < value.photos.length; i++) {
    const entry: unknown = value.photos[i];
    const path = `${f('photos')}[${i}]`;
    if (!isRecord(entry)) return fail(path, 'Each photo must be an object.');
    const extraKey = unknownKeys(entry, ['photoId', 'caption']);
    if (extraKey !== null) return fail(`${path}.${extraKey}`, 'Unknown field.');
    if (!isUuid(entry.photoId)) return fail(`${path}.photoId`, 'The photo id is not valid.');
    const photoId = entry.photoId.toLowerCase();
    if (seen.has(photoId)) return fail(`${path}.photoId`, 'A photo appears more than once.');
    seen.add(photoId);
    const caption = validateText(entry.caption ?? '', {
      field: `${path}.caption`,
      label: 'The caption',
      min: 0,
      max: LIMITS.captionMaxChars,
      multiline: true,
    });
    if (!caption.ok) return caption;
    photos.push({ photoId, caption: caption.value });
  }

  return ok({
    title: title.value,
    visitorName: visitorName.value,
    guideName: guideName.value,
    openingGreeting: openingGreeting.value,
    closingMessage: closingMessage.value,
    theme: 'default',
    visitorAvatar: visitorAvatar.value,
    guideAvatar: guideAvatar.value,
    photos,
  });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export const LQIP_PREFIX = 'data:image/jpeg;base64,';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Checks the shape of the inline placeholder: a JPEG data URL of at most 4,096 characters with
 * valid base64. The bytes are then checked with `checkLqipDataUrl` in jpeg.ts, because the
 * placeholder is shown to every Visitor and is treated as untrusted like the stored renditions.
 */
export function validateLqip(value: unknown, field = 'lqip'): Validation<string> {
  if (typeof value !== 'string') return fail(field, 'The placeholder is required.');
  if (value.length > LIMITS.maxLqipChars) return fail(field, 'The placeholder is too large.');
  if (!value.startsWith(LQIP_PREFIX))
    return fail(field, 'The placeholder must be a JPEG data URL.');
  const base64 = value.slice(LQIP_PREFIX.length);
  if (!BASE64_PATTERN.test(base64) || base64.length % 4 !== 0) {
    return fail(field, 'The placeholder is not valid base64.');
  }
  return ok(value);
}

export function validateDimension(value: unknown, field: string): Validation<number> {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > LIMITS.fullLongEdgePx
  ) {
    return fail(field, `Must be a whole number from 1 to ${LIMITS.fullLongEdgePx}.`);
  }
  return ok(value);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export function parseGetMuseumRequest(body: unknown): Validation<{ shareToken: string }> {
  if (!isRecord(body)) return fail('', 'The request body must be a JSON object.');
  const extra = unknownKeys(body, ['shareToken']);
  if (extra !== null) return fail(extra, 'Unknown field.');
  // A malformed token is reported by the caller as "not found", never as a validation error.
  if (typeof body.shareToken !== 'string')
    return fail('shareToken', 'The share token is required.');
  return ok({ shareToken: body.shareToken });
}

const MANAGE_ACTIONS = [
  'get',
  'reserve-photo',
  'renew-upload',
  'confirm-photo',
  'remove-photo',
  'publish',
  'delete',
] as const;

const ACTION_KEYS: Record<(typeof MANAGE_ACTIONS)[number], readonly string[]> = {
  get: ['action', 'editToken'],
  'reserve-photo': ['action', 'editToken'],
  'renew-upload': ['action', 'editToken', 'photoId'],
  'confirm-photo': ['action', 'editToken', 'photoId', 'width', 'height', 'lqip'],
  'remove-photo': ['action', 'editToken', 'photoId'],
  publish: ['action', 'editToken', 'document'],
  delete: ['action', 'editToken'],
};

function invalid(field: string, message: string): ManageParse {
  return { ok: false, kind: 'invalid', field, message };
}

export function parseManageRequest(body: unknown): ManageParse {
  if (!isRecord(body)) return invalid('', 'The request body must be a JSON object.');
  // The token is checked first so that a wrong token never reveals anything about the action.
  if (!isEditTokenShape(body.editToken)) return { ok: false, kind: 'bad_token' };
  const editToken = body.editToken;

  const action = body.action;
  if (typeof action !== 'string' || !(MANAGE_ACTIONS as readonly string[]).includes(action)) {
    return invalid('action', 'Unknown action.');
  }
  const kind = action as (typeof MANAGE_ACTIONS)[number];
  const extra = unknownKeys(body, ACTION_KEYS[kind]);
  if (extra !== null) return invalid(extra, 'Unknown field.');

  switch (kind) {
    case 'get':
    case 'reserve-photo':
    case 'delete':
      return { ok: true, value: { action: kind, editToken } };
    case 'renew-upload':
    case 'remove-photo': {
      if (!isUuid(body.photoId)) return invalid('photoId', 'The photo id is not valid.');
      return { ok: true, value: { action: kind, editToken, photoId: body.photoId.toLowerCase() } };
    }
    case 'confirm-photo': {
      if (!isUuid(body.photoId)) return invalid('photoId', 'The photo id is not valid.');
      const width = validateDimension(body.width, 'width');
      if (!width.ok) return invalid(width.field, width.message);
      const height = validateDimension(body.height, 'height');
      if (!height.ok) return invalid(height.field, height.message);
      const lqip = validateLqip(body.lqip, 'lqip');
      if (!lqip.ok) return invalid(lqip.field, lqip.message);
      return {
        ok: true,
        value: {
          action: 'confirm-photo',
          editToken,
          photoId: body.photoId.toLowerCase(),
          width: width.value,
          height: height.value,
          lqip: lqip.value,
        },
      };
    }
    case 'publish': {
      const document = validateDocument(body.document);
      if (!document.ok) return invalid(document.field, document.message);
      return { ok: true, value: { action: 'publish', editToken, document: document.value } };
    }
  }
}

// ---------------------------------------------------------------------------
// Photo files
// ---------------------------------------------------------------------------

export const FULL_RENDITION = {
  maxBytes: LIMITS.maxStoredFileBytes,
  maxLongEdge: LIMITS.fullLongEdgePx,
} as const;
export const WALL_RENDITION = {
  maxBytes: LIMITS.maxStoredFileBytes,
  maxLongEdge: LIMITS.wallLongEdgePx,
} as const;

/**
 * The wall rendition must be the same picture as the full one: its proportions must match to
 * within rounding (two pixels), so a Creator cannot publish a different image on the wall.
 */
export function proportionsMatch(
  full: { width: number; height: number },
  wall: { width: number; height: number },
): boolean {
  const expectedWallWidth = (full.width * wall.height) / full.height;
  const expectedWallHeight = (full.height * wall.width) / full.width;
  return (
    Math.abs(wall.width - expectedWallWidth) <= 2 && Math.abs(wall.height - expectedWallHeight) <= 2
  );
}
