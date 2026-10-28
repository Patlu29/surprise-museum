/**
 * JPEG metadata removal (FR-10, ADR 0004).
 *
 * Re-encoding through a canvas drops the SOURCE photo's EXIF, GPS, XMP and IPTC, but some
 * browsers' own encoders add segments of their own. Safari's writes an APP1 "Exif" segment and an
 * APP13 "Photoshop 3.0" segment into every canvas JPEG, and the server's `confirm-photo` rejects
 * any APP1 or APP13 (architecture 10.3). So the client rewrites the file without them. Without
 * this step, every upload from an iPhone would fail.
 *
 * Kept: SOI, APP0 (JFIF), APP2 (ICC colour profile, so colours stay true), APP14 (Adobe colour
 * transform) and every structural segment (DQT, DHT, SOF, DRI, SOS) and the entropy-coded data.
 * Dropped: APP1, APP3 to APP13, APP15 and COM.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

function isDropped(marker: number): boolean {
  if (marker === 0xe1) return true; // APP1: EXIF and XMP
  if (marker >= 0xe3 && marker <= 0xed) return true; // APP3 to APP13 (APP13 holds IPTC)
  if (marker === 0xef) return true; // APP15
  if (marker === 0xfe) return true; // COM
  return false;
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
    if (!isDropped(marker)) parts.push(bytes.subarray(offset, offset + 2 + length));
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
