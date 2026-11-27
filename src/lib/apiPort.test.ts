import { describe, expect, it } from 'vitest';
import { ApiRequestError, describeApiError, isSpaceFull, MSG_SPACE_FULL } from './apiPort';

describe('space_full (design spec 13.11)', () => {
  const refusal = new ApiRequestError('space_full', 'Surprise Museum is full for now.', {
    status: 409,
  });

  it('isSpaceFull is true only for the space_full code', () => {
    expect(isSpaceFull(refusal)).toBe(true);
    expect(isSpaceFull(new ApiRequestError('conflict', 'x', { status: 409 }))).toBe(false);
    expect(isSpaceFull(new Error('space_full'))).toBe(false);
    expect(isSpaceFull(null)).toBe(false);
  });

  it('describeApiError gives the designer text and never the server message', () => {
    expect(describeApiError(refusal)).toBe("We're full for now. Please try again later.");
    expect(describeApiError(refusal)).toBe(MSG_SPACE_FULL);
    expect(describeApiError(refusal)).not.toContain('Surprise Museum');
  });
});
