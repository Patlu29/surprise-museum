/**
 * Byte-level JPEG checker used by confirm-photo (ADR 0004, docs/architecture.md section 10.3).
 *
 * The browser re-encodes every photo through a canvas, which writes a fresh JPEG with no metadata.
 * A modified client could skip that, so the server checks the bytes. It reads the marker structure
 * only; it never decodes the image, because Edge Functions have tight CPU and memory limits.
 *
 * A file is accepted only if ALL of the following hold:
 *   - it is at most `maxBytes` and starts with the JPEG signature FF D8 FF;
 *   - the marker structure is well formed from start to end (every segment length is in bounds);
 *   - it ends with EOI and has nothing after it (no appended data);
 *   - it has exactly one baseline, extended-sequential or progressive frame (8-bit, 1 or 3
 *     components), at least one scan, and a long edge of at most `maxLongEdge` pixels;
 *   - its only application segments are the ones a canvas encoder writes and that carry no
 *     personal data: a plain JFIF header (no thumbnail), an ICC colour profile and an Adobe
 *     colour-transform marker. EVERY other APPn segment is rejected, which includes APP1 (EXIF,
 *     XMP), APP13 (IPTC and Photoshop data), maker notes and multi-picture data. This is the
 *     same set the browser keeps when it strips Safari's own APP1 and APP13 (src/media/jpeg.ts);
 *     src/api/__tests__/clientCompat.test.ts keeps the two in step;
 *   - it has no COM (comment) segment.
 *
 * Pure TypeScript with no imports, so it runs in Deno, Node, Vitest and the browser.
 * (Sibling files are imported without a file extension from src/api and with one from Deno
 * code, so the shared modules never import each other.)
 */

export interface JpegCheckOptions {
  /** Largest file accepted, in bytes. */
  maxBytes: number;
  /** Largest allowed width or height, in pixels. */
  maxLongEdge: number;
}

export interface JpegInfo {
  width: number;
  height: number;
  progressive: boolean;
  components: number;
}

export type JpegRejection =
  | 'empty'
  | 'too_large'
  | 'not_jpeg'
  | 'truncated'
  | 'malformed'
  | 'exif_or_xmp'
  | 'metadata_segment'
  | 'comment_segment'
  | 'trailing_data'
  | 'unsupported_encoding'
  | 'no_frame'
  | 'multiple_frames'
  | 'no_scan'
  | 'dimensions_invalid'
  | 'dimensions_too_large';

export type JpegCheck = { ok: true; info: JpegInfo } | { ok: false; reason: JpegRejection };

/** A message that is safe to show to the Creator. It never repeats anything from the file. */
export const JPEG_REJECTION_MESSAGES: Record<JpegRejection, string> = {
  empty: 'The photo file is empty.',
  too_large: 'The photo file is too large.',
  not_jpeg: 'The photo is not a JPEG file.',
  truncated: 'The photo file is incomplete.',
  malformed: 'The photo file is damaged.',
  exif_or_xmp: 'The photo still contains camera or location metadata.',
  metadata_segment: 'The photo still contains embedded metadata.',
  comment_segment: 'The photo still contains an embedded comment.',
  trailing_data: 'The photo file has extra data after the image.',
  unsupported_encoding: 'The photo uses an unsupported JPEG encoding.',
  no_frame: 'The photo file has no image data.',
  multiple_frames: 'The photo file contains more than one image.',
  no_scan: 'The photo file has no image data.',
  dimensions_invalid: 'The photo has invalid dimensions.',
  dimensions_too_large: 'The photo is larger than the allowed size.',
};

const SOF_SUPPORTED = new Set([0xc0, 0xc1, 0xc2]);
// Start-of-frame markers for encodings a browser cannot be relied on to display.
const SOF_UNSUPPORTED = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
// Table and housekeeping markers that carry no metadata: DHT, DAC, DQT, DNL, DRI, DHP, EXP.
const TABLE_MARKERS = new Set([0xc4, 0xcc, 0xdb, 0xdc, 0xdd, 0xde, 0xdf]);

const ASCII_JFIF = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF\0"
const ASCII_ICC = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]; // "ICC_PROFILE\0"
const ASCII_ADOBE = [0x41, 0x64, 0x6f, 0x62, 0x65]; // "Adobe"

function startsWith(bytes: Uint8Array, start: number, prefix: number[]): boolean {
  if (start + prefix.length > bytes.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[start + i] !== prefix[i]) return false;
  }
  return true;
}

function reject(reason: JpegRejection): JpegCheck {
  return { ok: false, reason };
}

export function checkJpeg(bytes: Uint8Array, options: JpegCheckOptions): JpegCheck {
  const length = bytes.length;
  if (length === 0) return reject('empty');
  if (length > options.maxBytes) return reject('too_large');
  if (length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return reject('not_jpeg');
  }

  let pos = 2;
  let frame: JpegInfo | null = null;
  let scans = 0;

  for (;;) {
    // Every iteration starts at the 0xFF that introduces a marker.
    if (pos >= length) return reject('truncated');
    if (bytes[pos] !== 0xff) return reject('malformed');
    // Any number of 0xFF fill bytes may precede the marker code.
    while (pos + 1 < length && bytes[pos + 1] === 0xff) pos++;
    if (pos + 1 >= length) return reject('truncated');
    const marker = bytes[pos + 1] ?? 0;
    pos += 2;

    if (marker === 0xd9) {
      // EOI: nothing may follow.
      if (pos !== length) return reject('trailing_data');
      break;
    }
    // A marker code of 0x00 is a stuffed byte, SOI cannot nest, and RSTn and TEM carry no
    // meaning outside entropy-coded data.
    if (
      marker === 0x00 ||
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      return reject('malformed');
    }

    if (pos + 2 > length) return reject('truncated');
    const segmentLength = ((bytes[pos] ?? 0) << 8) | (bytes[pos + 1] ?? 0);
    if (segmentLength < 2) return reject('malformed');
    const end = pos + segmentLength;
    if (end > length) return reject('truncated');
    const payloadStart = pos + 2;
    const payloadLength = segmentLength - 2;

    if (marker >= 0xe0 && marker <= 0xef) {
      const allowed = isAllowedApplicationSegment(bytes, marker, payloadStart, payloadLength);
      if (!allowed) return reject(marker === 0xe1 ? 'exif_or_xmp' : 'metadata_segment');
    } else if (marker === 0xfe) {
      return reject('comment_segment');
    } else if (SOF_SUPPORTED.has(marker)) {
      if (frame) return reject('multiple_frames');
      if (payloadLength < 6) return reject('malformed');
      const precision = bytes[payloadStart] ?? 0;
      const height = ((bytes[payloadStart + 1] ?? 0) << 8) | (bytes[payloadStart + 2] ?? 0);
      const width = ((bytes[payloadStart + 3] ?? 0) << 8) | (bytes[payloadStart + 4] ?? 0);
      const components = bytes[payloadStart + 5] ?? 0;
      if (payloadLength !== 6 + 3 * components) return reject('malformed');
      if (precision !== 8 || (components !== 1 && components !== 3)) {
        return reject('unsupported_encoding');
      }
      if (width < 1 || height < 1) return reject('dimensions_invalid');
      if (Math.max(width, height) > options.maxLongEdge) return reject('dimensions_too_large');
      frame = { width, height, progressive: marker === 0xc2, components };
    } else if (SOF_UNSUPPORTED.has(marker)) {
      return reject('unsupported_encoding');
    } else if (marker === 0xda) {
      // SOS: a scan header, followed by entropy-coded data up to the next real marker.
      if (!frame) return reject('malformed');
      scans++;
      pos = end;
      while (pos < length) {
        if (bytes[pos] === 0xff) {
          const next = bytes[pos + 1];
          if (next === undefined) return reject('truncated');
          // FF00 is a stuffed data byte and FFD0..FFD7 are restart markers: both stay in the scan.
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            pos += 2;
            continue;
          }
          break;
        }
        pos++;
      }
      continue;
    } else if (!TABLE_MARKERS.has(marker)) {
      // Reserved and JPEG-extension markers have no business in a canvas-encoded photo.
      return reject('malformed');
    }

    pos = end;
  }

  if (!frame) return reject('no_frame');
  if (scans === 0) return reject('no_scan');
  return { ok: true, info: frame };
}

function isAllowedApplicationSegment(
  bytes: Uint8Array,
  marker: number,
  payloadStart: number,
  payloadLength: number,
): boolean {
  switch (marker) {
    case 0xe0:
      // JFIF header: "JFIF\0" plus at most 9 more bytes (version, units, densities, thumbnail
      // size). Real encoders write all 14; a shorter header is tolerated because there is no room
      // in it for anything else. If the thumbnail size is present it must be 0 x 0, because a JFIF
      // thumbnail could carry extra data.
      return (
        payloadLength >= ASCII_JFIF.length &&
        payloadLength <= 14 &&
        startsWith(bytes, payloadStart, ASCII_JFIF) &&
        (payloadLength < 14 || (bytes[payloadStart + 12] === 0 && bytes[payloadStart + 13] === 0))
      );
    case 0xe2:
      // ICC colour profile chunks (a colour space, not personal data). Safari and Chrome write
      // these; the identifier alone is enough, the chunk numbers and profile bytes follow it.
      return payloadLength >= ASCII_ICC.length && startsWith(bytes, payloadStart, ASCII_ICC);
    case 0xee:
      // Adobe colour transform marker: "Adobe", version, two flag words and a transform byte
      // (12 bytes in total). Nothing longer is accepted.
      return (
        payloadLength >= ASCII_ADOBE.length &&
        payloadLength <= 12 &&
        startsWith(bytes, payloadStart, ASCII_ADOBE)
      );
    default:
      // APP1 (EXIF, XMP) and APP13 (IPTC, Photoshop) land here, and so does every other APPn.
      return false;
  }
}

// ---------------------------------------------------------------------------
// Inline placeholder (LQIP)
// ---------------------------------------------------------------------------

const LQIP_PREFIX = 'data:image/jpeg;base64,';
/** The 24 px placeholder may be a little larger than asked for; it is still tiny. */
const LQIP_MAX_EDGE = 32;
const LQIP_MAX_BYTES = 4096;

export function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Runs the metadata checks on a placeholder data URL. The shape (prefix, length, base64
 * alphabet) must already have passed `validateLqip` in validate.ts.
 */
export function checkLqipDataUrl(dataUrl: string): JpegCheck {
  if (!dataUrl.startsWith(LQIP_PREFIX)) return reject('not_jpeg');
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(dataUrl.slice(LQIP_PREFIX.length));
  } catch {
    return reject('malformed');
  }
  return checkJpeg(bytes, { maxBytes: LQIP_MAX_BYTES, maxLongEdge: LQIP_MAX_EDGE });
}
