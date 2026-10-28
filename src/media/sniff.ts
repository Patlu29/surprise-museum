import type { SourceKind } from './types';

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i] ?? 0);
  }
  return out;
}

/** Brands that mark a HEIC or HEIF still image (ISO base media `ftyp` box). */
const HEIC_BRANDS: ReadonlySet<string> = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
]);
/** Generic image brands that HEIC files often use, and that AVIF files use too. */
const GENERIC_BRANDS: ReadonlySet<string> = new Set(['mif1', 'msf1']);
const AVIF_BRANDS: ReadonlySet<string> = new Set(['avif', 'avis']);

function sniffIsoBaseMedia(bytes: Uint8Array): SourceKind | null {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== 'ftyp') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxSize = Math.min(view.getUint32(0), bytes.length);
  const major = ascii(bytes, 8, 4);
  const brands = [major];
  // Compatible brands start after the major brand and its 4-byte minor version.
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    brands.push(ascii(bytes, offset, 4));
  }
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return null;
  if (brands.some((brand) => HEIC_BRANDS.has(brand))) return 'heic';
  if (GENERIC_BRANDS.has(major)) return 'heic';
  return null;
}

/**
 * Detects the photo format from the first bytes of a file (FR-3: by content, not by name).
 * Returns null for anything that is not a JPEG, PNG, WebP or HEIC/HEIF still image.
 */
export function sniffImageKind(bytes: Uint8Array): SourceKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === 'PNG' &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'webp';
  }
  return sniffIsoBaseMedia(bytes);
}
