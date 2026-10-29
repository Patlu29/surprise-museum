import { deflateSync } from 'node:zlib';

/**
 * Deterministic test images, generated in Node so no fixtures need committing. PNG is used
 * because it needs only zlib; the app re-encodes every photo to JPEG in the browser anyway.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** A smooth two-colour diagonal gradient with a pale frame, `width` x `height`. */
export function makePng(width: number, height: number, seed = 0): Buffer {
  const hue = (seed * 67) % 360;
  const rgb = (h: number, l: number): [number, number, number] => {
    const a = 0.5 * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  };
  const [r1, g1, b1] = rgb(hue, 0.55);
  const [r2, g2, b2] = rgb((hue + 80) % 360, 0.35);
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      const edge = x < 12 || y < 12 || x >= width - 12 || y >= height - 12;
      const o = y * stride + 1 + x * 3;
      raw[o] = edge ? 240 : Math.round(r1 + (r2 - r1) * t);
      raw[o + 1] = edge ? 235 : Math.round(g1 + (g2 - g1) * t);
      raw[o + 2] = edge ? 225 : Math.round(b1 + (b2 - b1) * t);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** Mixed portrait and landscape photos, so aspect ratio handling is exercised. */
export function makePhotos(count: number): UploadFile[] {
  const shapes: Array<[number, number]> = [
    [900, 600],
    [600, 900],
    [800, 800],
    [960, 540],
    [540, 960],
  ];
  return Array.from({ length: count }, (_, index) => {
    const [w, h] = shapes[index % shapes.length]!;
    return {
      name: `photo-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: makePng(w, h, index + 1),
    };
  });
}

/** Insert an EXIF APP1 segment with a GPS block into a JPEG (for the metadata-stripping test). */
export function withExifGps(jpeg: Buffer): Buffer {
  const marker = Buffer.from('Exif\0\0', 'binary');
  const body = Buffer.concat([marker, Buffer.from('GPS-LATITUDE-37.8136-LONGITUDE-144.9631', 'ascii')]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(body.length + 2, 0);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), length, body]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
