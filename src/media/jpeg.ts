/**
 * JPEG metadata removal (FR-10, ADR 0004).
 *
 * Re-encoding through a canvas drops the SOURCE photo's EXIF, GPS, XMP and IPTC, but some
 * browsers' own encoders add segments of their own. Safari's writes an APP1 "Exif" segment and an
 * APP13 "Photoshop 3.0" segment into every canvas JPEG, and the server's `confirm-photo` rejects
 * any APP1 or APP13 (architecture 10.3). So the client rewrites the file without them. Without
 * this step, every upload from an iPhone would fail.
 *
 * Kept, by marker AND identifier, matching the server's allow-list exactly
 * (supabase/functions/_shared/jpeg.ts, `isAllowedApplicationSegment`):
 *   - APP0 whose payload starts "JFIF\0", is at most 14 bytes, and (if 14 bytes) has a 0 by 0
 *     thumbnail, since a JFIF thumbnail could carry extra data;
 *   - APP2 whose payload starts "ICC_PROFILE\0" (a colour profile, so colours stay true);
 *   - APP14 whose payload starts "Adobe" and is at most 12 bytes (the colour transform);
 *   - every structural segment (DQT, DHT, SOF, DRI, SOS) and the entropy-coded data.
 * Dropped: APP1, APP3 to APP13, APP15, COM, and any APP0, APP2 or APP14 with another identifier
 * (for example JFXX, MPF or a long Adobe block). `src/api/__tests__/clientCompat.test.ts` keeps
 * this file and the server's checker in step.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

const ASCII_JFIF = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF\0"
const ASCII_ICC = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]; // "ICC_PROFILE\0"
const ASCII_ADOBE = [0x41, 0x64, 0x6f, 0x62, 0x65]; // "Adobe"

function startsWith(bytes: Uint8Array, offset: number, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[offset + index] === value);
}

/**
 * True when the segment at `offset` (the 0xFF of its marker) is one the server refuses and so must
 * be dropped. `payloadStart` is just after the two length bytes; `payloadLength` excludes them.
 */
function isDropped(
  bytes: Uint8Array,
  marker: number,
  payloadStart: number,
  payloadLength: number,
): boolean {
  switch (marker) {
    case 0xe0:
      return !(
        payloadLength >= ASCII_JFIF.length &&
        payloadLength <= 14 &&
        startsWith(bytes, payloadStart, ASCII_JFIF) &&
        (payloadLength < 14 || (bytes[payloadStart + 12] === 0 && bytes[payloadStart + 13] === 0))
      );
    case 0xe2:
      return !(payloadLength >= ASCII_ICC.length && startsWith(bytes, payloadStart, ASCII_ICC));
    case 0xee:
      return !(
        payloadLength >= ASCII_ADOBE.length &&
        payloadLength <= 12 &&
        startsWith(bytes, payloadStart, ASCII_ADOBE)
      );
    case 0xe1: // APP1: EXIF and XMP
    case 0xed: // APP13: IPTC and Photoshop
    case 0xfe: // COM
      return true;
    default:
      // Every other APPn (APP3 to APP12, APP15) is dropped too.
      return marker >= 0xe3 && marker <= 0xef;
  }
}

/** Marker byte of each header segment in a JPEG, in order, up to and including SOS. Empty if not a JPEG. */
export function listJpegMarkers(bytes: Uint8Array): number[] {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return [];
  const markers: number[] = [];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    markers.push(marker);
    if (marker === SOS || marker === EOI) break;
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2) break;
    offset += 2 + length;
  }
  return markers;
}

/** True when the file still has a segment the server rejects (APP1 or APP13). */
export function hasRejectedMetadata(bytes: Uint8Array): boolean {
  return listJpegMarkers(bytes).some((marker) => marker === 0xe1 || marker === 0xed);
}

/**
 * Returns the JPEG without metadata segments. Input that is not a well-formed JPEG header is
 * returned unchanged, so callers never lose a file because of this step.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return bytes;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let reachedScan = false;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return bytes; // malformed: leave it alone
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === SOS) {
      // Everything from here on is scan data (and the closing EOI): copy it as it is.
      parts.push(bytes.subarray(offset));
      reachedScan = true;
      break;
    }
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > bytes.length) return bytes;
    if (!isDropped(bytes, marker, offset + 4, length - 2)) {
      parts.push(bytes.subarray(offset, offset + 2 + length));
    }
    offset += 2 + length;
  }
  if (!reachedScan) return bytes;

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

/** Strips metadata from a JPEG blob. Non-JPEG blobs are returned as they are. */
export async function stripJpegBlob(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const clean = stripJpegMetadata(bytes);
  return clean === bytes ? blob : new Blob([clean as BlobPart], { type: 'image/jpeg' });
}
