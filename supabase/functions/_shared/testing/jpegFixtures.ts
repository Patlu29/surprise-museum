/**
 * Builds structurally valid JPEG byte streams for tests. The checker never decodes pixels, so a
 * synthetic stream (headers plus a few bytes of "entropy data") exercises exactly what it reads.
 * No imports, so Deno and Vitest can both use it.
 */

export interface Segment {
  marker: number;
  payload: number[];
}

export function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

export const ascii = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0));

export const JFIF = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
export const ICC = segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 1, 2, 3, 4]);
export const ADOBE = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
export const EXIF = segment(0xe1, [...ascii('Exif'), 0, 0, 77, 77, 0, 42, 0, 0, 0, 8]);
export const XMP = segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, 60, 120]);
export const IPTC = segment(0xed, [...ascii('Photoshop 3.0'), 0, 56, 66, 73, 77]);
export const COMMENT = segment(0xfe, ascii('hello'));

export interface JpegOptions {
  width: number;
  height: number;
  /** Segments placed after SOI, before the frame. Defaults to a JFIF header. */
  before?: number[][];
  /** SOF marker, default 0xC0 (baseline). */
  sof?: number;
  precision?: number;
  components?: number;
  /** Extra bytes after EOI. */
  trailing?: number[];
  omitFrame?: boolean;
  omitScan?: boolean;
  omitEoi?: boolean;
  /** Two frames in one file. */
  secondFrame?: boolean;
}

export function buildJpeg(options: JpegOptions): Uint8Array<ArrayBuffer> {
  const { width, height } = options;
  const components = options.components ?? 3;
  const bytes: number[] = [0xff, 0xd8];
  for (const part of options.before ?? [JFIF]) bytes.push(...part);
  // Quantisation table (one 8-bit table of 64 entries).
  bytes.push(...segment(0xdb, [0, ...Array.from({ length: 64 }, () => 16)]));
  const frame = segment(options.sof ?? 0xc0, [
    options.precision ?? 8,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    components,
    ...Array.from({ length: components }, (_, i) => [i + 1, 0x11, 0]).flat(),
  ]);
  if (!options.omitFrame) bytes.push(...frame);
  if (options.secondFrame) bytes.push(...frame);
  // Huffman table (minimal).
  bytes.push(
    ...segment(0xc4, [0x00, ...Array.from({ length: 16 }, (_, i) => (i === 0 ? 1 : 0)), 0]),
  );
  if (!options.omitScan) {
    bytes.push(
      ...segment(0xda, [
        components,
        ...Array.from({ length: components }, (_, i) => [i + 1, 0]).flat(),
        0,
        63,
        0,
      ]),
    );
    // Entropy-coded data containing a stuffed FF00 and a restart marker, which must not end the scan.
    bytes.push(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a);
  }
  if (!options.omitEoi) bytes.push(0xff, 0xd9);
  if (options.trailing) bytes.push(...options.trailing);
  return new Uint8Array(bytes);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** A clean placeholder data URL, as the browser produces (24 px long edge). */
export function lqipDataUrl(width = 24, height = 16): string {
  return 'data:image/jpeg;base64,' + toBase64(buildJpeg({ width, height }));
}

/**
 * A JPEG shaped like the output of Safari's canvas encoder (`toBlob('image/jpeg')`).
 *
 * Raw, Safari writes JFIF, then an APP1 "Exif" segment and an APP13 "Photoshop 3.0" segment of
 * its own, then an ICC colour profile, then the tables, frame and scan. The browser's stripper
 * (src/media/jpeg.ts) removes APP1 and APP13 before upload, so `stripped: true` is what the server
 * must accept, and `stripped: false` is what it must refuse.
 */
export function safariCanvasJpeg(options: {
  width: number;
  height: number;
  stripped: boolean;
}): Uint8Array<ArrayBuffer> {
  const { width, height, stripped } = options;
  const exif = segment(0xe1, [
    ...ascii('Exif'),
    0,
    0,
    77,
    77,
    0,
    42,
    0,
    0,
    0,
    8,
    0,
    1,
    1,
    18,
    0,
    3,
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    0, // TIFF header and an orientation tag
    ...ascii('GPSLatitude=-33.8688;GPSLongitude=151.2093'),
  ]);
  const photoshop = segment(0xed, [
    ...ascii('Photoshop 3.0'),
    0,
    ...ascii('8BIM'),
    4,
    4,
    0,
    0,
    0,
    0,
    0,
    8,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
  // A 3 KB ICC profile in a single chunk: identifier, chunk 1 of 1, then profile bytes.
  const icc = segment(0xe2, [
    ...ascii('ICC_PROFILE'),
    0,
    1,
    1,
    ...Array.from({ length: 3072 }, (_, i) => i & 0xff),
  ]);
  const before = stripped ? [JFIF, icc] : [JFIF, exif, photoshop, icc];
  return buildJpeg({ width, height, before });
}
