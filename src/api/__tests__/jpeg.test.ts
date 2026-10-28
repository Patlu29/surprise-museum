import { describe, expect, it } from 'vitest';
import {
  checkJpeg,
  checkLqipDataUrl,
  JPEG_REJECTION_MESSAGES,
  type JpegRejection,
} from '../../../supabase/functions/_shared/jpeg';
import {
  ADOBE,
  ascii,
  buildJpeg,
  COMMENT,
  EXIF,
  ICC,
  IPTC,
  JFIF,
  lqipDataUrl,
  segment,
  toBase64,
  XMP,
} from '../../../supabase/functions/_shared/testing/jpegFixtures';

const OPTIONS = { maxBytes: 2 * 1024 * 1024, maxLongEdge: 2048 };
const reason = (bytes: Uint8Array, options = OPTIONS): JpegRejection | 'ok' => {
  const result = checkJpeg(bytes, options);
  return result.ok ? 'ok' : result.reason;
};

describe('checkJpeg: accepts what a canvas encoder writes', () => {
  it('accepts baseline, progressive and extended-sequential JPEGs and reports the size', () => {
    const baseline = checkJpeg(buildJpeg({ width: 2048, height: 1536 }), OPTIONS);
    expect(baseline).toEqual({
      ok: true,
      info: { width: 2048, height: 1536, progressive: false, components: 3 },
    });
    const progressive = checkJpeg(buildJpeg({ width: 800, height: 600, sof: 0xc2 }), OPTIONS);
    expect(progressive.ok && progressive.info.progressive).toBe(true);
    expect(reason(buildJpeg({ width: 800, height: 600, sof: 0xc1 }))).toBe('ok');
    expect(reason(buildJpeg({ width: 10, height: 10, components: 1 }))).toBe('ok');
  });

  it('accepts JFIF, an ICC profile and an Adobe marker, which carry no personal data', () => {
    expect(reason(buildJpeg({ width: 10, height: 10, before: [JFIF, ICC, ADOBE] }))).toBe('ok');
    expect(reason(buildJpeg({ width: 10, height: 10, before: [] }))).toBe('ok');
  });

  it('is not fooled by marker-like bytes inside image data', () => {
    // buildJpeg puts FF00 and a restart marker inside the scan; both must stay inside it.
    expect(reason(buildJpeg({ width: 10, height: 10 }))).toBe('ok');
  });

  it('accepts a long edge exactly at the limit and a 1024 limit for wall renditions', () => {
    expect(reason(buildJpeg({ width: 2048, height: 1 }))).toBe('ok');
    expect(reason(buildJpeg({ width: 1024, height: 768 }), { ...OPTIONS, maxLongEdge: 1024 })).toBe(
      'ok',
    );
  });
});

describe('checkJpeg: rejects metadata (FR-10)', () => {
  it.each([
    ['EXIF', EXIF, 'exif_or_xmp'],
    ['XMP', XMP, 'exif_or_xmp'],
    ['IPTC / Photoshop (APP13)', IPTC, 'metadata_segment'],
    ['a comment', COMMENT, 'comment_segment'],
    ['a maker-note style APP4', segment(0xe4, ascii('MakerNote')), 'metadata_segment'],
    [
      'a multi-picture APP2 that is not an ICC profile',
      segment(0xe2, ascii('MPF\0 data data')),
      'metadata_segment',
    ],
    ['an APP15', segment(0xef, [1, 2, 3]), 'metadata_segment'],
    [
      'a JFIF header with a thumbnail',
      segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 9, 9, 9]),
      'metadata_segment',
    ],
    [
      'an APP0 that is not JFIF',
      segment(0xe0, [...ascii('JFXX'), 0, 16, 1, 2, 3, 4, 5, 6, 7, 8]),
      'metadata_segment',
    ],
    [
      'an Adobe-named APP14 with extra data',
      segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1, 9, 9]),
      'metadata_segment',
    ],
  ] as const)('rejects %s anywhere before the frame', (_name, segmentBytes, expected) => {
    expect(reason(buildJpeg({ width: 10, height: 10, before: [JFIF, [...segmentBytes]] }))).toBe(
      expected,
    );
    expect(reason(buildJpeg({ width: 10, height: 10, before: [[...segmentBytes]] }))).toBe(
      expected,
    );
  });

  it('rejects EXIF hidden between frame and scan, or after the first scan of a progressive file', () => {
    const clean = [...buildJpeg({ width: 10, height: 10 })];
    const sosAt = clean.findIndex((b, i) => b === 0xff && clean[i + 1] === 0xda);
    const injected = new Uint8Array([...clean.slice(0, sosAt), ...EXIF, ...clean.slice(sosAt)]);
    expect(reason(injected)).toBe('exif_or_xmp');
    // After the scan: insert before EOI.
    const eoiAt = clean.length - 2;
    const late = new Uint8Array([...clean.slice(0, eoiAt), ...EXIF, 0xff, 0xd9]);
    expect(reason(late)).toBe('exif_or_xmp');
  });

  it('rejects data appended after EOI, including a second JPEG with EXIF', () => {
    expect(reason(buildJpeg({ width: 10, height: 10, trailing: [0] }))).toBe('trailing_data');
    expect(
      reason(
        buildJpeg({
          width: 10,
          height: 10,
          trailing: [...buildJpeg({ width: 5, height: 5, before: [EXIF] })],
        }),
      ),
    ).toBe('trailing_data');
  });
});

describe('checkJpeg: rejects files that are not safe photos', () => {
  it('rejects empty, wrong-signature and tiny input', () => {
    expect(reason(new Uint8Array())).toBe('empty');
    expect(reason(new Uint8Array([1, 2, 3]))).toBe('not_jpeg');
    expect(reason(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(
      'not_jpeg',
    );
    expect(reason(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe('not_jpeg');
    expect(reason(new Uint8Array([0xff, 0xd8]))).toBe('not_jpeg');
    expect(reason(new Uint8Array([0xff, 0xd8, 0xfe, 0x00]))).toBe('not_jpeg');
  });

  it('enforces the byte limit', () => {
    const file = buildJpeg({ width: 10, height: 10 });
    expect(reason(file, { ...OPTIONS, maxBytes: file.length })).toBe('ok');
    expect(reason(file, { ...OPTIONS, maxBytes: file.length - 1 })).toBe('too_large');
  });

  it('enforces the pixel limit on either edge', () => {
    expect(reason(buildJpeg({ width: 2049, height: 10 }))).toBe('dimensions_too_large');
    expect(reason(buildJpeg({ width: 10, height: 2049 }))).toBe('dimensions_too_large');
    expect(reason(buildJpeg({ width: 65535, height: 65535 }))).toBe('dimensions_too_large');
    expect(reason(buildJpeg({ width: 1025, height: 10 }), { ...OPTIONS, maxLongEdge: 1024 })).toBe(
      'dimensions_too_large',
    );
  });

  it('rejects zero dimensions, unsupported precision and component counts, and unsupported encodings', () => {
    expect(reason(buildJpeg({ width: 0, height: 10 }))).toBe('dimensions_invalid');
    expect(reason(buildJpeg({ width: 10, height: 0 }))).toBe('dimensions_invalid');
    expect(reason(buildJpeg({ width: 10, height: 10, precision: 12 }))).toBe(
      'unsupported_encoding',
    );
    expect(reason(buildJpeg({ width: 10, height: 10, components: 4 }))).toBe(
      'unsupported_encoding',
    );
    expect(reason(buildJpeg({ width: 10, height: 10, sof: 0xc3 }))).toBe('unsupported_encoding');
    expect(reason(buildJpeg({ width: 10, height: 10, sof: 0xc9 }))).toBe('unsupported_encoding');
  });

  it('rejects structurally broken files', () => {
    expect(reason(buildJpeg({ width: 10, height: 10, omitFrame: true }))).toBe('malformed');
    expect(reason(buildJpeg({ width: 10, height: 10, omitScan: true }))).toBe('no_scan');
    expect(reason(buildJpeg({ width: 10, height: 10, secondFrame: true }))).toBe('multiple_frames');
    expect(reason(buildJpeg({ width: 10, height: 10, omitEoi: true }))).toBe('truncated');
    const good = buildJpeg({ width: 10, height: 10 });
    expect(reason(good.slice(0, 20))).toBe('truncated');
    // A segment that claims to be longer than the file.
    const lying = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0xff, 0xff, 0, 0]);
    expect(reason(lying)).toBe('truncated');
    // A segment length below the minimum of 2.
    expect(reason(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 1, 0, 0]))).toBe('malformed');
    // Garbage where a marker should be, and reserved markers.
    expect(reason(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2, 0x12, 0x34]))).toBe('malformed');
    expect(reason(new Uint8Array([0xff, 0xd8, 0xff, 0xf0, 0, 2, 0xff, 0xd9]))).toBe('malformed');
    expect(reason(new Uint8Array([0xff, 0xd8, 0xff, 0xd8, 0xff, 0xd9]))).toBe('malformed');
  });

  it('tolerates fill bytes before a marker', () => {
    const base = [...buildJpeg({ width: 10, height: 10 })];
    const withFill = new Uint8Array([...base.slice(0, 2), 0xff, 0xff, 0xff, ...base.slice(2)]);
    expect(reason(withFill)).toBe('ok');
  });

  it('has a safe message for every rejection reason', () => {
    for (const message of Object.values(JPEG_REJECTION_MESSAGES)) {
      expect(message).toMatch(/^The photo/);
      expect(message.length).toBeGreaterThan(10);
    }
  });
});

describe('checkLqipDataUrl', () => {
  it('accepts the placeholder the browser produces', () => {
    expect(checkLqipDataUrl(lqipDataUrl(24, 16)).ok).toBe(true);
  });

  it('rejects placeholders with metadata, wrong type or oversize dimensions', () => {
    const withExif =
      'data:image/jpeg;base64,' +
      toBase64(buildJpeg({ width: 24, height: 16, before: [JFIF, EXIF] }));
    expect(checkLqipDataUrl(withExif).ok).toBe(false);
    expect(checkLqipDataUrl('data:image/png;base64,AAAA').ok).toBe(false);
    expect(checkLqipDataUrl(lqipDataUrl(400, 300)).ok).toBe(false);
    expect(checkLqipDataUrl('data:image/jpeg;base64,####').ok).toBe(false);
  });
});
