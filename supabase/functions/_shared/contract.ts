/**
 * Surprise Museum API contract.
 *
 * Shared by the browser (imported as `@contract`) and the Supabase Edge Functions (Deno).
 * Rules for this file, so both runtimes can compile it:
 *   - no imports of any kind;
 *   - no runtime dependencies on DOM, Node or Deno APIs;
 *   - only erasable TypeScript syntax (no enums, no namespaces, no parameter properties).
 *
 * Designed by the architect (docs/architecture.md, section 7). Owner from here on:
 * backend-developer. Changes need a matching update to docs/api.md (and docs/architecture.md where
 * it differs), and the version below must be bumped when a stored shape changes.
 */

export const CONTRACT_VERSION = 1;

// ---------------------------------------------------------------------------
// Limits (FR-2, FR-6, FR-7, FR-8, FR-9, NFR-5, NFR-15, NFR-16)
// Text lengths count Unicode code points: [...text].length in JS, char_length() in Postgres.
// ---------------------------------------------------------------------------

export const LIMITS = {
  minPhotos: 1,
  maxPhotos: 20,
  /** Uploads one museum may reserve over its life, including replacements and retries. */
  maxPhotoReservations: 100,
  /** Largest file the Creator may pick, before processing. */
  maxSourceFileBytes: 15 * 1024 * 1024,
  /** Long edge of the full-size rendition, opened in the full-screen viewer. */
  fullLongEdgePx: 2048,
  /** Long edge of the wall rendition, used as the texture in the 3D scene. */
  wallLongEdgePx: 1024,
  /** Long edge of the inline blurred placeholder. */
  lqipLongEdgePx: 24,
  /** Target size of the full rendition; the encoder lowers quality to meet it. */
  fullTargetBytes: 600 * 1024,
  /** Target size of the wall rendition. */
  wallTargetBytes: 200 * 1024,
  /** Hard ceiling enforced by the storage bucket and by confirm-photo. */
  maxStoredFileBytes: 2 * 1024 * 1024,
  /** Maximum length of the LQIP data URL string. */
  maxLqipChars: 4096,
  captionMaxChars: 280,
  nameMinChars: 1,
  nameMaxChars: 24,
  titleMaxChars: 60,
  greetingMaxChars: 500,
  closingMessageMaxChars: 1000,
  /** Days a published museum stays available (NFR-16). */
  retentionDays: 90,
  /** Days an unpublished draft is kept before purge. */
  draftRetentionDays: 7,
  /** Lifetime of signed photo download URLs returned by get-museum. */
  signedUrlTtlSeconds: 3600,
} as const;

// ---------------------------------------------------------------------------
// Tokens (NFR-15). See docs/architecture.md, section 10.
//   editToken  = base64url(32 random bytes)                         -> 43 characters, 256 bits
//   shareToken = base64url(SHA-256(SHARE_TOKEN_DERIVATION + editToken)).slice(0, 24)
//                                                                   -> 24 characters, 144 bits
// The database stores only SHA-256(token) for each, never the tokens themselves.
// ---------------------------------------------------------------------------

export const SHARE_TOKEN_DERIVATION = 'surprise-museum/share/v1:';
export const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

/** Hash routes. The token is in the URL fragment, so it never reaches GitHub Pages or a log. */
export const ROUTES = {
  home: '/',
  create: '/create',
  preview: '/create/preview',
  visit: (shareToken: string) => `/m/${shareToken}`,
  edit: (editToken: string) => `/edit/${editToken}`,
  privacy: '/privacy',
  terms: '/terms',
} as const;

// ---------------------------------------------------------------------------
// Avatar options (FR-13, FR-14, FR-20). The option ids are stable storage keys.
// Display labels and actual colours belong to the design spec and the avatar renderer.
// ---------------------------------------------------------------------------

export const AVATAR_OPTIONS = {
  skinTone: [
    'skin-01',
    'skin-02',
    'skin-03',
    'skin-04',
    'skin-05',
    'skin-06',
    'skin-07',
    'skin-08',
    'skin-09',
    'skin-10',
  ],
  hairStyle: [
    'shaved',
    'buzz',
    'short-crop',
    'side-part',
    'curly-short',
    'bob',
    'long-straight',
    'long-wavy',
    'ponytail',
    'bun',
    'afro',
    'braids',
  ],
  hairColor: [
    'black',
    'dark-brown',
    'brown',
    'auburn',
    'ginger',
    'blonde',
    'platinum',
    'grey',
    'white',
    'pink',
    'blue',
  ],
  outfitStyle: ['tee-jeans', 'hoodie', 'shirt-trousers', 'dress', 'suit', 'jumpsuit'],
  outfitColor: [
    'red',
    'coral',
    'orange',
    'mustard',
    'green',
    'teal',
    'sky',
    'navy',
    'purple',
    'pink',
    'charcoal',
    'cream',
  ],
  bodyType: ['slim', 'regular', 'curvy', 'broad'],
  height: ['short', 'medium', 'tall'],
  facialHair: ['none', 'stubble', 'moustache', 'goatee', 'full-beard'],
  glasses: ['none', 'round', 'square'],
  hat: ['none', 'beanie', 'cap'],
} as const;

type OptionOf<K extends keyof typeof AVATAR_OPTIONS> = (typeof AVATAR_OPTIONS)[K][number];

/** Stored as JSON in museums.visitor_avatar and museums.guide_avatar. */
export interface AvatarConfig {
  v: 1;
  skinTone: OptionOf<'skinTone'>;
  hairStyle: OptionOf<'hairStyle'>;
  hairColor: OptionOf<'hairColor'>;
  outfitStyle: OptionOf<'outfitStyle'>;
  outfitColor: OptionOf<'outfitColor'>;
  bodyType: OptionOf<'bodyType'>;
  height: OptionOf<'height'>;
  /** The builder offers this for the Guide only (FR-14). Always 'none' for the Visitor in v1. */
  facialHair: OptionOf<'facialHair'>;
  /** Release 2 (FR-20). Accepted now so that adding the UI needs no migration. */
  glasses: OptionOf<'glasses'>;
  /** Release 2 (FR-20). */
  hat: OptionOf<'hat'>;
}

export type MuseumTheme = 'default';

// ---------------------------------------------------------------------------
// Museum content
// ---------------------------------------------------------------------------

/** What the Creator publishes. Sent whole on every publish (and, in Release 2, every save). */
export interface MuseumDocument {
  /** Empty string means "A museum for <visitorName>" (FR-7). */
  title: string;
  visitorName: string;
  guideName: string;
  /** Release 2 (FR-9). Empty string when unused. */
  openingGreeting: string;
  /** Empty string shows the "The end" panel (FR-29). Line breaks are preserved. */
  closingMessage: string;
  theme: MuseumTheme;
  visitorAvatar: AvatarConfig;
  guideAvatar: AvatarConfig;
  /** In route order, entrance to finale (FR-5). Every photoId must be 'ready'. */
  photos: Array<{ photoId: string; caption: string }>;
}

/** One photo as the Visitor (or preview) sees it. */
export interface MuseumPhoto {
  id: string;
  /** 0-based route order. */
  position: number;
  caption: string;
  /** Pixel size of the full rendition; the aspect ratio drives frame size (FR-39). */
  width: number;
  height: number;
  /** Tiny inline JPEG data URL shown until the wall texture loads (NFR-3, FR-58). */
  lqip: string;
  /** Signed URL of the 1024 px rendition (or a blob: URL in preview). */
  wallUrl: string;
  /** Signed URL of the 2048 px rendition, fetched only for the full-screen viewer. */
  fullUrl: string;
}

/** Everything the Visitor experience needs. Built from get-museum, or from the local draft in preview. */
export interface MuseumContent {
  title: string;
  visitorName: string;
  guideName: string;
  openingGreeting: string;
  closingMessage: string;
  theme: MuseumTheme;
  visitorAvatar: AvatarConfig;
  guideAvatar: AvatarConfig;
  photos: MuseumPhoto[];
}

// ---------------------------------------------------------------------------
// Edge Function requests and responses. All calls are POST with a JSON body.
// Tokens travel in the body, never in a URL or query string.
// ---------------------------------------------------------------------------

export const FUNCTION_NAMES = {
  createMuseum: 'create-museum',
  getMuseum: 'get-museum',
  manageMuseum: 'manage-museum',
  purgeExpired: 'purge-expired',
} as const;

/** create-museum: starts an unpublished draft. Called when the Creator adds the first photo. */
export type CreateMuseumRequest = Record<string, never>;
export interface CreateMuseumResponse {
  editToken: string;
  /** ISO 8601. The draft is purged after this unless published. */
  draftExpiresAt: string;
}

/** get-museum: the Visitor's read-only view. Unknown, draft, expired and deleted all return 404 not_found. */
export interface GetMuseumRequest {
  shareToken: string;
}
export interface GetMuseumResponse {
  museum: MuseumContent;
  /** ISO 8601. Call get-museum again after this to refresh photo URLs. */
  urlsExpireAt: string;
}

export interface SignedUpload {
  /** Full URL. Upload with HTTP PUT, header Content-Type: image/jpeg, header x-upsert: true. */
  signedUrl: string;
}

export interface PhotoUploadTicket {
  photoId: string;
  full: SignedUpload;
  wall: SignedUpload;
  /** ISO 8601. Ask for renew-upload after this. */
  expiresAt: string;
}

/** manage-museum: everything the edit token allows. Discriminated on `action`. */
export type ManageMuseumRequest =
  | { action: 'get'; editToken: string }
  | { action: 'reserve-photo'; editToken: string }
  | { action: 'renew-upload'; editToken: string; photoId: string }
  | {
      action: 'confirm-photo';
      editToken: string;
      photoId: string;
      width: number;
      height: number;
      lqip: string;
    }
  | { action: 'remove-photo'; editToken: string; photoId: string }
  | { action: 'publish'; editToken: string; document: MuseumDocument }
  | { action: 'delete'; editToken: string };

export type MuseumStatus = 'draft' | 'published';

export interface ManageGetResponse {
  status: MuseumStatus;
  /** Null until first published. */
  shareToken: string | null;
  /** Null while a draft has never been published. */
  document: MuseumDocument | null;
  /** Ready photos with signed wall and full URLs, for thumbnails in the editor. */
  photos: MuseumPhoto[];
  publishedAt: string | null;
  expiresAt: string;
}
export type ReservePhotoResponse = PhotoUploadTicket;
export type RenewUploadResponse = PhotoUploadTicket;
export interface ConfirmPhotoResponse {
  photoId: string;
  status: 'ready';
}
export interface RemovePhotoResponse {
  photoId: string;
  removed: true;
}
export interface PublishResponse {
  shareToken: string;
  publishedAt: string;
  expiresAt: string;
}
export interface DeleteResponse {
  deleted: true;
}

/** purge-expired (called by pg_cron, never by the browser). */
export interface PurgeExpiredResponse {
  /** Museums whose retention period ended in this run; their rows are gone. */
  purged: number;
  /** Storage clean-ups from earlier runs (or a failed delete) that succeeded in this run. */
  retried: number;
  /** Storage clean-ups that failed in this run and stay queued for the next hour. */
  failed: number;
}

// ---------------------------------------------------------------------------
// Errors. Every non-2xx response has this body.
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'bad_request' // 400: malformed body or failed validation
  | 'not_found' // 404: unknown, malformed, draft, expired or deleted token (always the same body)
  | 'conflict' // 409: for example publishing while a photo is not ready
  | 'photo_limit' // 409: 20 photos already reserved or ready
  | 'upload_quota' // 409: maxPhotoReservations used up
  | 'invalid_image' // 422: confirm-photo found a bad or unsafe file; the objects were deleted
  | 'rate_limited' // 429: with a Retry-After header in seconds
  | 'server_error'; // 500

export interface ApiError {
  error: ApiErrorCode;
  /** Safe to show to the Creator. Never contains tokens, names, captions or file names. */
  message: string;
  /** For bad_request: which field failed, as a JSON path such as "document.photos[3].caption". */
  field?: string;
}
