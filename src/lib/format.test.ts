import { afterEach, describe, expect, it } from 'vitest';
import { formatBytes, formatEndDateTime } from './format';

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3 GB');
  });

  it('copes with bad input', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('formatEndDateTime', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('formats a fixed instant in local time (Sydney, UTC+11 in November)', () => {
    process.env.TZ = 'Australia/Sydney';
    expect(formatEndDateTime('2026-11-25T03:30:00Z')).toBe('25/11/2026 14:30');
  });

  it('gives the same instant a different local time in another zone', () => {
    process.env.TZ = 'UTC';
    expect(formatEndDateTime('2026-11-25T03:30:00Z')).toBe('25/11/2026 03:30');
  });

  it('zero-pads single-digit days and months and shows midnight as 00:00', () => {
    process.env.TZ = 'UTC';
    expect(formatEndDateTime('2026-01-02T00:00:00Z')).toBe('02/01/2026 00:00');
    expect(formatEndDateTime('2026-03-09T09:05:00Z')).toBe('09/03/2026 09:05');
    expect(formatEndDateTime('2026-12-31T23:59:00Z')).toBe('31/12/2026 23:59');
  });

  it('rolls the local date over when the zone is ahead of UTC', () => {
    process.env.TZ = 'Australia/Sydney';
    expect(formatEndDateTime('2026-12-31T13:30:00Z')).toBe('01/01/2027 00:30');
  });

  it('follows daylight saving: Sydney springs forward on 4 October 2026 at 02:00', () => {
    process.env.TZ = 'Australia/Sydney';
    expect(formatEndDateTime('2026-10-03T15:59:00Z')).toBe('04/10/2026 01:59');
    expect(formatEndDateTime('2026-10-03T16:00:00Z')).toBe('04/10/2026 03:00');
  });

  it('shows the repeated hour when daylight saving ends (5 April 2026), the instant is in dateTime', () => {
    process.env.TZ = 'Australia/Sydney';
    expect(formatEndDateTime('2026-04-04T15:30:00Z')).toBe('05/04/2026 02:30');
    expect(formatEndDateTime('2026-04-04T16:30:00Z')).toBe('05/04/2026 02:30');
  });

  it('returns null for missing or invalid input', () => {
    expect(formatEndDateTime(null)).toBeNull();
    expect(formatEndDateTime(undefined)).toBeNull();
    expect(formatEndDateTime('')).toBeNull();
    expect(formatEndDateTime('not a date')).toBeNull();
    expect(formatEndDateTime('2026-13-45T99:00:00Z')).toBeNull();
  });
});
