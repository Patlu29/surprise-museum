import { describe, expect, it } from 'vitest';
import {
  codePointLength,
  firstLine,
  limitText,
  sanitiseMultiline,
  sanitiseSingleLine,
  truncateToCodePoints,
} from './text';

describe('code point counting', () => {
  it('counts an emoji as one character, not two UTF-16 units', () => {
    expect('😀'.length).toBe(2);
    expect(codePointLength('😀')).toBe(1);
    expect(codePointLength('Zoë 😀')).toBe(5);
  });
});

describe('truncateToCodePoints', () => {
  it('keeps text that fits', () => {
    expect(truncateToCodePoints('hello', 10)).toBe('hello');
  });

  it('never splits a surrogate pair', () => {
    expect(truncateToCodePoints('ab😀cd', 3)).toBe('ab😀');
    expect(truncateToCodePoints('😀😀😀', 2)).toBe('😀😀');
  });

  it('handles zero and negative limits', () => {
    expect(truncateToCodePoints('abc', 0)).toBe('');
    expect(truncateToCodePoints('abc', -1)).toBe('');
  });
});

describe('limitText', () => {
  it('reports whether anything was dropped', () => {
    expect(limitText('abcd', 4)).toEqual({ value: 'abcd', truncated: false });
    expect(limitText('abcde', 4)).toEqual({ value: 'abcd', truncated: true });
  });

  it('allows 24 emoji in a 24-character name', () => {
    const name = '😀'.repeat(24);
    expect(limitText(name, 24).truncated).toBe(false);
    expect(limitText(name + '😀', 24).truncated).toBe(true);
  });
});

describe('sanitising', () => {
  it('flattens names to one trimmed line', () => {
    expect(sanitiseSingleLine('  Zoë\n\tSmith  ')).toBe('Zoë Smith');
  });

  it('keeps line breaks in messages and drops other control characters', () => {
    expect(sanitiseMultiline('Hello\r\nworld\u0007!\n\n')).toBe('Hello\nworld!');
  });

  it('finds the first non-empty line', () => {
    expect(firstLine('\n  First\nSecond')).toBe('First');
    expect(firstLine('')).toBe('');
  });
});
