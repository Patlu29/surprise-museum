/**
 * The browser strips Safari's own APP1 (Exif) and APP13 (Photoshop) segments before upload
 * (src/media/jpeg.ts), and the server refuses both (supabase/functions/_shared/jpeg.ts). These
 * tests keep the two halves in step: whatever the client leaves in a file must pass the server's
 * checker, and the checker must still refuse the raw Safari output.
 *
 * The client's stripper is imported by relative path on purpose, as a read-only cross-check; the
 * src/api layer otherwise never depends on src/media.
 */
import { describe, expect, it } from 'vitest';
import { listJpegMarkers, stripJpegMetadata } from '../../media/jpeg';
import { checkJpeg, checkLqipDataUrl } from '../../../supabase/functions/_shared/jpeg';
import {
  ADOBE,
  ascii,
  buildJpeg,
  COMMENT,
  EXIF,
  ICC,
  IPTC,
  JFIF,
  safariCanvasJpeg,
  segment,
  toBase64,
  XMP,
} from '../../../supabase/functions/_shared/testing/jpegFixtures';
import { createMockApi } from '../mockClient';
import { lqipDataUrl } from '../../../supabase/functions/_shared/testing/jpegFixtures';

const FULL = { maxBytes: 2 * 1024 * 1024, maxLongEdge: 2048 };
const WALL = { maxBytes: 2 * 1024 * 1024, maxLongEdge: 1024 };

describe('Safari canvas JPEG', () => {
  it('raw Safari output is refused by the server rule (APP1, then APP13)', () => {
    const raw = safariCanvasJpeg({ width: 2048, height: 1536, stripped: false });
    expect(listJpegMarkers(raw)).toContain(0xe1);
    expect(listJpegMarkers(raw)).toContain(0xed);
    expect(checkJpeg(raw, FULL)).toEqual({ ok: false, reason: 'exif_or_xmp' });

    // With only the Exif segment removed, the Photoshop segment alone is still refused.
    const withoutExif = buildJpeg({
      width: 2048,
      height: 1536,
      before: [JFIF, segment(0xed, [...ascii('Photoshop 3.0'), 0, ...ascii('8BIM')]), ICC],
    });
    expect(checkJpeg(withoutExif, FULL)).toEqual({ ok: false, reason: 'metadata_segment' });
  });

  it('after the browser strips it, the server accepts the full and wall renditions', () => {
    for (const [size, limits] of [
      [{ width: 2048, height: 1536 }, FULL],
      [{ width: 1024, height: 768 }, WALL],
    ] as const) {
      const raw = safariCanvasJpeg({ ...size, stripped: false });
      const stripped = stripJpegMetadata(raw);
      expect(listJpegMarkers(stripped)).not.toContain(0xe1);
      expect(listJpegMarkers(stripped)).not.toContain(0xed);
      const result = checkJpeg(stripped, limits);
      expect(result).toMatchObject({ ok: true, info: { width: size.width, height: size.height } });
    }
  });

  it('stripping the raw file gives the same bytes as the stripped fixture', () => {
    const raw = safariCanvasJpeg({ width: 800, height: 600, stripped: false });
    const expected = safariCanvasJpeg({ width: 800, height: 600, stripped: true });
    expect([...stripJpegMetadata(raw)]).toEqual([...expected]);
    expect(checkJpeg(expected, FULL).ok).toBe(true);
  });

  it('accepts the same for the placeholder, at 24 px', () => {
    const stripped = stripJpegMetadata(
      safariCanvasJpeg({ width: 24, height: 16, stripped: false }),
    );
    expect(checkLqipDataUrl('data:image/jpeg;base64,' + toBase64(stripped)).ok).toBe(true);
  });

  it('the mock confirms a stripped Safari photo and refuses a raw one, like the server', async () => {
    const api = createMockApi();
    const { editToken } = await api.createMuseum();
    const upload = async (full: Uint8Array, wall: Uint8Array) => {
      const ticket = await api.reservePhoto(editToken);
      await api.uploadPhotoFile(
        ticket.full.signedUrl,
        new Blob([full as BlobPart]),
        () => undefined,
      );
      await api.uploadPhotoFile(
        ticket.wall.signedUrl,
        new Blob([wall as BlobPart]),
        () => undefined,
      );
      return api.confirmPhoto(editToken, {
        photoId: ticket.photoId,
        width: 2048,
        height: 1536,
        lqip: lqipDataUrl(),
      });
    };
    const raw = (w: number, h: number) =>
      safariCanvasJpeg({ width: w, height: h, stripped: false });
    await expect(upload(raw(2048, 1536), raw(1024, 768))).rejects.toMatchObject({
      code: 'invalid_image',
      field: 'full',
    });
    const clean = (w: number, h: number) => stripJpegMetadata(raw(w, h));
    await expect(upload(clean(2048, 1536), clean(1024, 768))).resolves.toMatchObject({
      status: 'ready',
    });
  });
});

describe('every segment the browser keeps is accepted, and the ones it drops are refused', () => {
  const kept = [
    ['APP0 JFIF', JFIF],
    ['APP2 ICC', ICC],
    ['APP14 Adobe', ADOBE],
    ['a short JFIF header', segment(0xe0, [...ascii('JFIF'), 0])],
    ['a header-only ICC chunk', segment(0xe2, [...ascii('ICC_PROFILE'), 0])],
  ] as const;
  const dropped = [
    ['APP1 Exif', EXIF],
    ['APP1 XMP', XMP],
    ['APP13 Photoshop', IPTC],
    ['COM', COMMENT],
    ['APP3', segment(0xe3, [1, 2, 3])],
    ['APP15', segment(0xef, [1, 2, 3])],
  ] as const;

  it.each(kept)('server accepts %s, and the client leaves it in', (_name, bytes) => {
    const file = buildJpeg({ width: 100, height: 80, before: [[...bytes]] });
    expect(listJpegMarkers(stripJpegMetadata(file))).toContain(bytes[1]);
    expect(checkJpeg(stripJpegMetadata(file), FULL).ok).toBe(true);
  });

  it.each(dropped)(
    'client removes %s, and the server refuses it if it is still there',
    (_name, bytes) => {
      const file = buildJpeg({ width: 100, height: 80, before: [JFIF, [...bytes]] });
      expect(checkJpeg(file, FULL).ok).toBe(false);
      const stripped = stripJpegMetadata(file);
      expect(listJpegMarkers(stripped)).not.toContain(bytes[1]);
      expect(checkJpeg(stripped, FULL).ok).toBe(true);
    },
  );
});
