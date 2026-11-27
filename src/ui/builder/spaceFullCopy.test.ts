import { describe, expect, it } from 'vitest';
import {
  SPACE_FULL_BACK,
  SPACE_FULL_HEADING,
  SPACE_FULL_PARAGRAPHS,
  SPACE_FULL_TRY_AGAIN,
} from './spaceFullCopy';

/**
 * The space-full copy against US-75 AC-1 and AC-2 (design spec 13.5, 13.12): one heading, 1 to 4
 * sentences of 20 words or fewer, exactly two controls, no digit, none of the banned words and no
 * gendered pronoun. The heading is not counted as a sentence.
 */
const BANNED = /\b(storage|database|egress|quota|limit|error)\b/i;
const GENDERED = /\b(she|her|hers|herself|he|him|his|himself|girlfriend|boyfriend)\b/i;

const sentences = SPACE_FULL_PARAGRAPHS.flatMap((paragraph) =>
  paragraph.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 0),
);
const wordCount = (sentence: string) => sentence.split(/\s+/).filter(Boolean).length;
const everything = [
  SPACE_FULL_HEADING,
  ...SPACE_FULL_PARAGRAPHS,
  SPACE_FULL_TRY_AGAIN,
  SPACE_FULL_BACK,
].join(' ');

describe('space-full copy (US-75 AC-1, AC-2)', () => {
  it('is the approved wording of design spec 13.5', () => {
    expect(SPACE_FULL_HEADING).toBe("We're full for now");
    expect(SPACE_FULL_TRY_AGAIN).toBe('Try again');
    expect(SPACE_FULL_BACK).toBe('Back to my museum');
    expect(SPACE_FULL_PARAGRAPHS[0]).toBe(
      "Surprise Museum can't take another museum right now. Space opens up again as older museums reach the end of their week.",
    );
    expect(SPACE_FULL_PARAGRAPHS[1]).toBe(
      'Everything you added is still here, so keep this page open and try again later. If you close this page, your words and characters stay saved, but the photos need adding again.',
    );
  });

  it('has 1 to 4 sentences of 20 words or fewer (AC-1)', () => {
    expect(sentences.length).toBeGreaterThanOrEqual(1);
    expect(sentences.length).toBeLessThanOrEqual(4);
    for (const sentence of sentences) expect(wordCount(sentence), sentence).toBeLessThanOrEqual(20);
    expect(sentences.map(wordCount)).toEqual([8, 13, 15, 17]);
  });

  it('holds no digit (AC-2)', () => {
    expect(everything).not.toMatch(/\d/);
  });

  it('uses none of the banned words (AC-2)', () => {
    expect(everything).not.toMatch(BANNED);
  });

  it('uses no gendered pronoun (AC-2)', () => {
    expect(everything).not.toMatch(GENDERED);
  });

  it('recognises what it is meant to catch', () => {
    for (const word of ['storage', 'Database', 'egress', 'quota', 'limit', 'error']) {
      expect(BANNED.test(`about the ${word} now`), word).toBe(true);
    }
    expect(BANNED.test('We are limited by time')).toBe(false);
    expect(GENDERED.test('Ask her')).toBe(true);
    expect(GENDERED.test('their week')).toBe(false);
  });

  it('never carries the server wording', () => {
    expect(everything).not.toContain('Please try again later');
    expect(everything).not.toContain('full for now.');
  });
});
