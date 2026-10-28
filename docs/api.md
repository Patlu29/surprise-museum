# API contract: Surprise Museum

Version 1.0 (contract version 1) | 28/10/2026 | Owner: backend-developer
Types: `supabase/functions/_shared/contract.ts` (imported in the browser as `@contract`). Design: `docs/architecture.md` sections 7 and 10, ADRs 0003, 0004, 0010 and 0012.

## 1. Overview

There is no REST resource tree. The browser calls four Supabase Edge Functions, all with `POST` and a JSON body, and uploads photos straight to Storage through signed URLs.

| Function | Caller | Purpose |
|---|---|---|
| `create-museum` | Creator's browser | Start a draft, receive the edit token |
| `get-museum` | Visitor's browser | Read a published museum by share token |
| `manage-museum` | Creator's browser | Everything the edit token allows (7 actions) |
| `purge-expired` | pg_cron only | Delete expired museums and their files |

Base URL: `{VITE_SUPABASE_URL}/functions/v1/<function-name>`.

### Deviations from the team's REST conventions

The team API conventions describe a REST API under `/api/v1/` with nested error objects. This backend is deliberately different, and the architecture (section 7.3) and the shared contract already fix the shape the frontend is built on, so those were kept.

| Convention | Here | Reason |
|---|---|---|
| Routes under `/api/v1/`, REST verbs | `POST /functions/v1/<name>`, actions in the body | Supabase Edge Functions; one gateway (ADR 0003) |
| Error `{ error: { code, message, details } }` | `{ error: <code>, message, field? }` | Fixed by `ApiError` in the contract the frontend uses |
| 401 and 403 | Never returned for access problems; always 404 `not_found` | A bad link must reveal nothing (FR-55). The only 403 is a browser origin that is not allowed (section 3) |
| 204 for delete | 200 with `{ "deleted": true }` | `DeleteResponse` in the contract |
| Lists with `limit` and `cursor` | No list endpoint exists | Nobody may list museums or photos (NFR-15) |
| camelCase JSON, ISO 8601 UTC | Followed | |

## 2. Requests

Every call sends:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` (required; any other type returns 415. It also forces a CORS preflight on cross-site requests) |
| `apikey` | The public anon or publishable key (`VITE_SUPABASE_ANON_KEY`) |
| `x-region` | `ap-southeast-2` (pins the function to Sydney, next to the database) |

Rules that apply to all functions:

- Tokens travel in the body, never in a URL or query string.
- The body is at most 64 KiB. A larger body returns 413.
- Unknown fields are rejected with 400 and the field name. Nothing is stored that was not validated.
- Text lengths count Unicode code points (an emoji counts as one). Leading and trailing spaces are trimmed. Control characters, bidirectional override characters and unpaired surrogates are rejected. Only captions, the greeting and the closing message may contain line breaks (stored as `\n`).
- Responses carry `Cache-Control: no-store`.
- Error messages never echo what you submitted.

## 3. CORS

Functions answer browsers only for the origins in the `ALLOWED_ORIGINS` secret (production: `https://patlu29.github.io`, plus local development ports).

| Request | Result |
|---|---|
| `OPTIONS` from an allowed origin | 204 with `Access-Control-Allow-Origin: <origin>`, `Allow-Methods: POST, OPTIONS`, `Allow-Headers: authorization, x-client-info, apikey, content-type, x-region`, `Max-Age: 86400`, `Vary: Origin` |
| `POST` from an allowed origin | Normal response, with the same `Allow-Origin` and `Vary` |
| Any request from another origin | 403 `bad_request` (message "Origin not allowed."), no CORS headers, and no work is done |
| No `Origin` header (cron, curl, tests) | Normal response, no CORS headers |

Storage's own CORS policy covers the signed upload and download URLs.

## 4. Errors

Every non-2xx response has this body (type `ApiError`):

```json
{ "error": "bad_request", "message": "The Visitor's name is required.", "field": "document.visitorName" }
```

`field` is a JSON path and appears for validation problems (`bad_request`), and also on `conflict` and `invalid_image` when one field is to blame.

| `error` | Status | Meaning |
|---|---|---|
| `bad_request` | 400 | Malformed JSON or failed validation. Also 405 (not `POST`), 413 (body over 64 KiB), 415 (not `application/json`) and 403 (origin not allowed) |
| `not_found` | 404 | Unknown, malformed, draft (for `get-museum`), expired or deleted token. **Always the identical body** (below). Also an unknown `photoId` inside a valid museum, with the message "Photo not found." |
| `conflict` | 409 | The request is valid but the state does not allow it (photo not uploaded yet, photo not ready at publish, photo already uploaded, removing a published photo) |
| `photo_limit` | 409 | The museum already has 20 photos (pending or ready) |
| `upload_quota` | 409 | The museum has used all 100 lifetime photo reservations |
| `invalid_image` | 422 | `confirm-photo` found a bad or unsafe file. Both objects were deleted; the photo stays reserved so the upload can be retried |
| `rate_limited` | 429 | With a `Retry-After` header in seconds |
| `server_error` | 500 | Unexpected. No detail is given; the cause is in the function logs (kind and code only, never content) |

The uniform not-found body (`get-museum` and `manage-museum`; also `purge-expired` with a wrong secret):

```json
{ "error": "not_found", "message": "This museum could not be found." }
```

### Who sees what

| Situation | `get-museum` | `manage-museum` |
|---|---|---|
| Token has the wrong format | 404 (no database query) | 404 (no database query) |
| Token unknown | 404 | 404 |
| Museum is a draft | 404 | works |
| Museum has expired (even before the hourly purge runs) | 404 | 404 |
| Museum was deleted | 404 | 404 |

## 5. Limits

| Item | Limit | Source |
|---|---|---|
| Photos per museum | 1 to 20 (20 live at once) | FR-2 |
| Photo reservations per museum, lifetime | 100 | abuse cap |
| Visitor and Guide name | 1 to 24 characters | FR-15, FR-16 |
| Title | 0 to 60 (empty means "A museum for <name>") | FR-7 |
| Opening greeting | 0 to 500 (Release 2) | FR-9 |
| Closing message | 0 to 1,000 | FR-8 |
| Caption | 0 to 280 | FR-6 |
| `full` rendition | JPEG, at most 2048 px long edge, at most 2 MiB | ADR 0005 |
| `wall` rendition | JPEG, at most 1024 px long edge, at most 2 MiB | ADR 0005 |
| `lqip` | JPEG data URL, at most 4,096 characters, at most 32 px long edge | ADR 0005 |
| Draft lifetime | 7 days from creation | NFR-16 |
| Published lifetime | 90 days from the first publish (re-publishing does not extend it) | NFR-16 |
| Photo download URLs | Valid 1 hour | ADR 0003 |
| Photo upload URLs | Valid 2 hours | ADR 0003 |

Rate limits (fixed windows, keyed by a salted hash of the client address; IPv6 addresses count by their /64 network):

| Function | Limit |
|---|---|
| `create-museum` | 10 drafts per hour per client |
| `get-museum` | 60 lookups per minute per client, and 20 misses per 10 minutes per client. After 20 misses every lookup from that client returns 429 until the window ends, which slows link guessing |
| `manage-museum` | 120 requests per minute per client, 600 per hour per museum, and the same 20-misses-per-10-minutes limit as `get-museum` |

## 6. Tokens

| Token | Creation | Size | In the database |
|---|---|---|---|
| Edit token | 32 random bytes from `crypto.getRandomValues`, base64url | 43 characters, 256 bits | SHA-256 only |
| Share token | First 24 characters of `base64url(SHA-256("surprise-museum/share/v1:" + editToken))` | 24 characters, 144 bits | SHA-256 only |

The edit token is returned once, by `create-museum`. It cannot be recovered. The share token is never stored or returned until the museum is published; `manage-museum` derives it from the edit token whenever it is needed.

## 7. `create-museum`

Starts an unpublished draft. Call it when the Creator adds the first photo.

**Auth:** none. **Rate limit:** 10 per hour per client.
**Body:** `{}` (an empty body is also accepted)

```http
POST /functions/v1/create-museum
Content-Type: application/json
apikey: <anon key>

{}
```

**201**
```json
{ "editToken": "k3Jx9V0mQe1v7mY0cF8sXQw2l5R4aTn6uH1bZp3dEoI", "draftExpiresAt": "2026-11-04T01:00:00.000Z" }
```

| Status | Code |
|---|---|
| 400 | `bad_request` (body is not `{}`) |
| 429 | `rate_limited` |

## 8. `get-museum`

The Visitor's read-only view.

**Auth:** share token. **Rate limit:** section 5.
**Body:** `{ "shareToken": string }`

```json
{ "shareToken": "Qm4yT9xWc1LrB7eKs2VhZ0fA" }
```

**200** (`GetMuseumResponse`)
```json
{
  "museum": {
    "title": "",
    "visitorName": "Sam",
    "guideName": "Alex",
    "openingGreeting": "",
    "closingMessage": "Happy birthday!\nLove always.",
    "theme": "default",
    "visitorAvatar": { "v": 1, "skinTone": "skin-03", "hairStyle": "bob", "hairColor": "brown", "outfitStyle": "hoodie", "outfitColor": "teal", "bodyType": "regular", "height": "medium", "facialHair": "none", "glasses": "none", "hat": "none" },
    "guideAvatar": { "v": 1, "skinTone": "skin-05", "hairStyle": "short-crop", "hairColor": "black", "outfitStyle": "shirt-trousers", "outfitColor": "navy", "bodyType": "broad", "height": "tall", "facialHair": "stubble", "glasses": "none", "hat": "none" },
    "photos": [
      {
        "id": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c",
        "position": 0,
        "caption": "Our first trip",
        "width": 2048,
        "height": 1536,
        "lqip": "data:image/jpeg;base64,/9j/4AAQ...",
        "wallUrl": "https://<ref>.supabase.co/storage/v1/object/sign/photos/<museumId>/<photoId>/wall.jpg?token=...",
        "fullUrl": "https://<ref>.supabase.co/storage/v1/object/sign/photos/<museumId>/<photoId>/full.jpg?token=..."
      }
    ]
  },
  "urlsExpireAt": "2026-10-28T02:00:00.000Z"
}
```

- An empty `title` means the default title "A museum for <visitorName>" (FR-7). The client composes it.
- `photos` are in route order (`position` is 0-based and contiguous). `wallUrl` is the 1024 px texture; `fullUrl` (2048 px) is fetched only for the full-screen viewer.
- After `urlsExpireAt`, call `get-museum` again to refresh the URLs. The Storage URLs also return 400 or 403 once expired.

| Status | Code |
|---|---|
| 400 | `bad_request` (no `shareToken` field) |
| 404 | `not_found` (any bad link) |
| 429 | `rate_limited` |

## 9. `manage-museum`

Everything the edit token allows. Every request has `action` and `editToken`; the other fields depend on the action.

**Auth:** edit token. **Rate limit:** section 5. A wrong or malformed `editToken` always returns the uniform 404, whatever the action.

| Action | Extra fields | Success | Effect |
|---|---|---|---|
| `get` | none | 200 `ManageGetResponse` | Read the museum for the edit screen |
| `reserve-photo` | none | 201 `PhotoUploadTicket` | Reserve a photo slot and sign two upload URLs |
| `renew-upload` | `photoId` | 200 `PhotoUploadTicket` | New upload URLs for a pending photo (retry, FR-4) |
| `confirm-photo` | `photoId`, `width`, `height`, `lqip` | 200 `{ photoId, status: "ready" }` | Verify the uploaded files and mark the photo ready |
| `remove-photo` | `photoId` | 200 `{ photoId, removed: true }` | Delete a photo and its files |
| `publish` | `document` | 200 `PublishResponse` | Validate and publish the whole museum |
| `delete` | none | 200 `{ deleted: true }` | Delete everything |

Common errors for every action: 400 `bad_request` (invalid body; unknown `action` reports `field: "action"`), 404 `not_found` (bad token, or unknown `photoId` where a photo is needed), 429 `rate_limited`.

### `get`

```json
{ "action": "get", "editToken": "k3Jx9V0mQe1v7mY0cF8sXQw2l5R4aTn6uH1bZp3dEoI" }
```

**200** (`ManageGetResponse`)
```json
{
  "status": "published",
  "shareToken": "Qm4yT9xWc1LrB7eKs2VhZ0fA",
  "document": { "title": "", "visitorName": "Sam", "guideName": "Alex", "openingGreeting": "", "closingMessage": "Happy birthday!", "theme": "default", "visitorAvatar": { "v": 1 }, "guideAvatar": { "v": 1 }, "photos": [{ "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c", "caption": "Our first trip" }] },
  "photos": [{ "id": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c", "position": 0, "caption": "Our first trip", "width": 2048, "height": 1536, "lqip": "data:image/jpeg;base64,...", "wallUrl": "https://...", "fullUrl": "https://..." }],
  "publishedAt": "2026-10-28T01:00:00.000Z",
  "expiresAt": "2027-01-26T01:00:00.000Z"
}
```

For a draft that has never been published: `status: "draft"`, `shareToken: null`, `document: null`, `publishedAt: null`, and `expiresAt` is the draft expiry. `photos` lists only `ready` photos; ones not yet published have no stored position, so they are numbered in upload order.

### `reserve-photo`

```json
{ "action": "reserve-photo", "editToken": "..." }
```

**201** (`PhotoUploadTicket`)
```json
{
  "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c",
  "full": { "signedUrl": "https://<ref>.supabase.co/storage/v1/object/upload/sign/photos/<museumId>/<photoId>/full.jpg?token=..." },
  "wall": { "signedUrl": "https://<ref>.supabase.co/storage/v1/object/upload/sign/photos/<museumId>/<photoId>/wall.jpg?token=..." },
  "expiresAt": "2026-10-28T03:00:00.000Z"
}
```

Extra errors: 409 `photo_limit`, 409 `upload_quota`.

### Photo upload (to Storage, not to a function)

Upload each rendition with an HTTP `PUT` to its `signedUrl`:

| Item | Value |
|---|---|
| Method | `PUT` |
| Body | The JPEG bytes (a `Blob` in the browser) |
| `Content-Type` | `image/jpeg` (the bucket rejects any other type) |
| `x-upsert` | `true` (so a retry overwrites a partial upload) |
| `apikey`, `Authorization` | Not needed. The token in the URL is the credential |
| Limits | 2 MiB per object. Larger files get 413 |
| Success | 200 |

Use `XMLHttpRequest` for upload progress. `src/api` does this in `uploadPhotoFile`.

### `renew-upload`

```json
{ "action": "renew-upload", "editToken": "...", "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c" }
```

**200** `PhotoUploadTicket` (as above). Extra errors: 409 `conflict` if the photo is already `ready`.

### `confirm-photo`

Call after both uploads finish. The server downloads both objects and checks the bytes; it never decodes the image.

```json
{
  "action": "confirm-photo",
  "editToken": "...",
  "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c",
  "width": 2048,
  "height": 1536,
  "lqip": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

`width` and `height` are the pixel size of the `full` rendition (whole numbers, 1 to 2048).

**200**
```json
{ "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c", "status": "ready" }
```

Confirming a photo that is already `ready` returns 200 again (safe to repeat).

The checks, in order:

1. `lqip` is a JPEG data URL of at most 4,096 characters with valid base64, and its bytes pass the same JPEG checks (long edge at most 32 px). Failure: 400 `bad_request`, `field: "lqip"`. The uploaded objects are left alone.
2. Both objects exist. Failure: 409 `conflict` (`field` is `full` or `wall`). Nothing is deleted; finish the upload and confirm again.
3. Each object is at most 2 MiB and passes the JPEG rules below. `full` is at most 2048 px and `wall` at most 1024 px on the long edge.
4. The size of `full` equals the declared `width` and `height`.
5. `wall` has the same proportions as `full` (within 2 px of rounding), so it is the same picture.

A failure in 3 to 5 returns 422 `invalid_image` with `field` set to `full`, `wall` or `width`, **and deletes both objects**. The photo stays reserved and `pending`: call `renew-upload` and try again, or `remove-photo`.

**JPEG rules (ADR 0004).** A file is accepted only if all of these hold:

| Rule | Why |
|---|---|
| Starts with `FF D8 FF`, well-formed marker structure, every segment length in bounds, ends with EOI with nothing after it | No appended or hidden data |
| One baseline, extended-sequential or progressive frame; 8-bit; 1 or 3 components; at least one scan | Safe for every browser to display |
| Application segments limited to: JFIF with no thumbnail (APP0), ICC colour profile (APP2), Adobe colour transform (APP14) | Everything else is rejected |
| No APP1 (EXIF and XMP), no APP13 (IPTC and Photoshop), no other APPn (maker notes, multi-picture data) | Location and camera privacy (FR-10) |
| No COM (comment) segments | Free text can hold anything |

The browser re-encodes every photo through a canvas, which produces a file that passes. The server check exists so a modified client cannot store metadata.

Error messages for `invalid_image` are fixed, safe sentences (for example "The photo still contains camera or location metadata."), never parts of the file.

### `remove-photo`

```json
{ "action": "remove-photo", "editToken": "...", "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c" }
```

**200** `{ "photoId": "...", "removed": true }`. Removing a photo that no longer exists also returns 200, so a retry after a dropped response is safe. A photo that is part of the published museum cannot be removed this way: 409 `conflict`. Publish a new document without it instead.

### `publish`

Sent whole. All text, avatars and the photo order are stored in one database transaction.

```json
{
  "action": "publish",
  "editToken": "...",
  "document": {
    "title": "",
    "visitorName": "Sam",
    "guideName": "Alex",
    "openingGreeting": "",
    "closingMessage": "Happy birthday!\nLove always.",
    "theme": "default",
    "visitorAvatar": { "v": 1, "skinTone": "skin-03", "hairStyle": "bob", "hairColor": "brown", "outfitStyle": "hoodie", "outfitColor": "teal", "bodyType": "regular", "height": "medium", "facialHair": "none", "glasses": "none", "hat": "none" },
    "guideAvatar": { "v": 1, "skinTone": "skin-05", "hairStyle": "short-crop", "hairColor": "black", "outfitStyle": "shirt-trousers", "outfitColor": "navy", "bodyType": "broad", "height": "tall", "facialHair": "stubble", "glasses": "none", "hat": "none" },
    "photos": [
      { "photoId": "0b1a3c5e-7d9f-4a21-8c3b-5e7f9a1b3d5c", "caption": "Our first trip" },
      { "photoId": "5d3f1b9a-2c4e-4f60-9a8b-7c6d5e4f3a2b", "caption": "" }
    ]
  }
}
```

**200** (`PublishResponse`)
```json
{ "shareToken": "Qm4yT9xWc1LrB7eKs2VhZ0fA", "publishedAt": "2026-10-28T01:00:00.000Z", "expiresAt": "2027-01-26T01:00:00.000Z" }
```

Rules:

- 1 to 20 photos, each `photoId` unique, belonging to this museum and `ready`. The array order is the route order (entrance to finale).
- Photos of this museum that are **not** in the document are deleted, with their files.
- `visitorName` and `guideName` are required (1 to 24). `title`, `openingGreeting`, `closingMessage` and captions may be empty.
- `theme` must be `"default"`.
- Each avatar must be exactly the keys of `AvatarConfig` with `v: 1` and an option from `AVATAR_OPTIONS`. `visitorAvatar.facialHair` must be `"none"` (facial hair is for the Guide only, FR-14).
- `publishedAt` and `expiresAt` are set by the first publish. Publishing again updates the content but never extends `expiresAt` (90 days from the first publish).

Errors: 400 `bad_request` with `field` such as `document.visitorName` or `document.photos[3].caption`; 409 `conflict` with `field: "document.photos[1].photoId"` when that photo is unknown, belongs to another museum, or is not `ready`.

### `delete`

```json
{ "action": "delete", "editToken": "..." }
```

**200** `{ "deleted": true }`. The database rows are removed in one transaction, so the share link and the edit link return 404 immediately (FR-52). The files are removed in the same request; if that fails, the museum stays on a queue and the hourly job retries.

## 10. `purge-expired`

Called by the database, never by a browser. It sets no CORS headers.

**Auth:** header `x-cron-secret` equal to the `CRON_SECRET` function secret, compared in constant time. A missing or wrong secret returns the uniform 404. If `CRON_SECRET` is not set on the function, it returns 500 and does nothing.

```http
POST /functions/v1/purge-expired
x-cron-secret: <secret>
Content-Type: application/json

{}
```

**200** (`PurgeExpiredResponse`)
```json
{ "purged": 3, "retried": 1, "failed": 0 }
```

| Field | Meaning |
|---|---|
| `purged` | Museums whose retention ended in this run (drafts after 7 days, published after 90). Their rows are gone |
| `retried` | Storage clean-ups from earlier runs, or from a delete whose file removal failed, that succeeded now |
| `failed` | Storage clean-ups that failed in this run and stay queued for the next hour |

Up to 100 museums are expired and 100 queue entries drained per run; a bigger backlog clears over successive hours.

## 11. Retention timeline

| Event | Effect |
|---|---|
| `create-museum` | `expiresAt` = now + 7 days |
| First `publish` | `expiresAt` = now + 90 days |
| `expiresAt` passes | All links return 404 at once. The hourly job (minute 17) deletes the rows and files within the hour |
| `delete` | Rows gone at once; files removed immediately, or within the hour if that failed |

## 12. Mock mode (no Supabase project)

`src/api` selects an in-memory implementation of the same `MuseumApi` interface when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, or when `VITE_API_MODE=mock`. It follows every rule in this document: the same validators, the same JPEG checks on the uploaded bytes, the same limits and expiry, and the same uniform `not_found`. It differs in these ways only:

- Data lives in the page's memory. A reload, or opening the link in a second tab, starts empty.
- There is no rate limiting.
- "Signed URLs" are `blob:` object URLs, and upload URLs are `mock://upload/...`.
- `getApiMode()` returns `"mock"`, so the UI can show a "demo mode, nothing is saved online" notice.

`VITE_API_MODE=live` forces the real backend and makes every call fail with `unconfigured` if the Supabase variables are missing, so a broken deployment cannot silently run on the mock.

## 13. Change log

| Date | Change |
|---|---|
| 28/10/2026 | First full contract. Differences from `docs/architecture.md` section 7.3: `create-museum` and `reserve-photo` return 201; `field` may also appear on `conflict` and `invalid_image`; 403, 405, 413 and 415 are sent with the `bad_request` code; `purge-expired` returns `{ purged, retried, failed }` (`failed` is new, type `PurgeExpiredResponse` added to `contract.ts`); `remove-photo` of a published photo returns `conflict`; `lqip` bytes are checked at `confirm-photo`; `visitorAvatar.facialHair` must be `none` |
