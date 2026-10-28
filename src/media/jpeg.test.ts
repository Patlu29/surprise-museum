import { describe, expect, it } from 'vitest';
import { hasRejectedMetadata, listJpegMarkers, stripJpegBlob, stripJpegMetadata } from './jpeg';

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}
const text = (value: string) => [...value].map((c) => c.charCodeAt(0));

const SCAN_DATA = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9];

/** A small file shaped like Safari's canvas output: JFIF, Exif, Photoshop, then the real data. */
function safariLike(): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    ...segment(0xe0, text('JFIF\0')),
    ...segment(0xe1, [...text('Exif\0\0'), ...text('GPSLatitude=-33.8688')]),
    ...segment(0xed, text('Photoshop 3.0\0')),
    ...segment(0xfe, text('made by a camera')),
    ...segment(0xe2, text('ICC_PROFILE\0')),
    ...segment(0xdb, [0, 1, 2, 3]),
    ...segment(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]),
    ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
    ...SCAN_DATA,
  ]);
}

describe('stripJpegMetadata', () => {
  it('removes Exif (APP1), IPTC (APP13) and comments, which the server rejects', () => {
    const input = safariLike();
    expect(hasRejectedMetadata(input)).toBe(true);
    const output = stripJpegMetadata(input);
    expect(hasRejectedMetadata(output)).toBe(false);
    expect(listJpegMarkers(output)).toEqual([0xe0, 0xe2, 0xdb, 0xc0, 0xda]);
    expect(new TextDecoder('latin1').decode(output)).not.toContain('GPSLatitude');
  });

  it('keeps the picture data byte for byte', () => {
    const output = stripJpegMetadata(safariLike());
    expect([...output.subarray(output.length - SCAN_DATA.length)]).toEqual(SCAN_DATA);
    expect([...output.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it('keeps the colour profile and structure segments', () => {
    const markers = listJpegMarkers(stripJpegMetadata(safariLike()));
    expect(markers).toContain(0xe2); // ICC
    expect(markers).toContain(0xdb); // quantisation
    expect(markers).toContain(0xc0); // frame header
  });

  it('is idempotent', () => {
    const once = stripJpegMetadata(safariLike());
    expect([...stripJpegMetadata(once)]).toEqual([...once]);
  });

  it('returns input that is not a JPEG, or is damaged, unchanged', () => {
    const notJpeg = Uint8Array.from(text('hello world'));
    expect(stripJpegMetadata(notJpeg)).toBe(notJpeg);
    const truncated = safariLike().subarray(0, 30);
    expect(stripJpegMetadata(truncated)).toBe(truncated);
    const empty = new Uint8Array();
    expect(stripJpegMetadata(empty)).toBe(empty);
  });

  it('leaves a file with nothing to remove as the same bytes', () => {
    const clean = Uint8Array.from([
      0xff,
      0xd8,
      ...segment(0xe0, text('JFIF\0')),
      ...segment(0xdb, [0, 1]),
      ...segment(0xda, [1, 1, 0]),
      ...SCAN_DATA,
    ]);
    expect([...stripJpegMetadata(clean)]).toEqual([...clean]);
  });

  it('works on blobs, and passes other blobs through', async () => {
    const stripped = await stripJpegBlob(new Blob([safariLike() as BlobPart]));
    expect(hasRejectedMetadata(new Uint8Array(await stripped.arrayBuffer()))).toBe(false);
    const other = new Blob(['not a jpeg']);
    expect(await stripJpegBlob(other)).toBe(other);
  });
});

describe('listJpegMarkers', () => {
  it('lists header segments in order and stops at the scan', () => {
    expect(listJpegMarkers(safariLike())).toEqual([0xe0, 0xe1, 0xed, 0xfe, 0xe2, 0xdb, 0xc0, 0xda]);
  });

  it('returns nothing for non-JPEG input', () => {
    expect(listJpegMarkers(Uint8Array.from(text('PNG...')))).toEqual([]);
  });
});
