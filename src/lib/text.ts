/**
 * Text helpers. Limits count Unicode code points, exactly like `contract.ts` ([...text].length)
 * and Postgres char_length(), so an emoji counts as one character and the native `maxlength`
 * attribute (UTF-16 units) is never used (design spec 5.2).
 */

export function codePointLength(text: string): number {
  let count = 0;
  for (const _char of text) count += 1;
  return count;
}

/** Keeps the first `max` code points. Never splits a surrogate pair. */
export function truncateToCodePoints(text: string, max: number): string {
  if (max <= 0) return '';
  // Fast path: UTF-16 length is never smaller than the code point count.
  if (text.length <= max) return text;
  let count = 0;
  let end = 0;
  for (const char of text) {
    if (count === max) break;
    count += 1;
    end += char.length;
  }
  return text.slice(0, end);
}

export interface LimitResult {
  value: string;
  /** True when characters were dropped to fit the limit. */
  truncated: boolean;
}

export function limitText(text: string, max: number): LimitResult {
  if (codePointLength(text) <= max) return { value: text, truncated: false };
  return { value: truncateToCodePoints(text, max), truncated: true };
}

/** Control characters other than the line feed. */
const CONTROL_EXCEPT_LF = /[^\P{Cc}\n]/gu;
const CONTROL_ANY = /\p{Cc}+/gu;

/** For names and titles: one line, no control characters, trimmed. */
export function sanitiseSingleLine(text: string): string {
  return text.replace(CONTROL_ANY, ' ').replace(/ {2,}/g, ' ').trim();
}

/** For captions and the closing message: keeps line breaks, drops other control characters. */
export function sanitiseMultiline(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(CONTROL_EXCEPT_LF, '').trim();
}

/** The first line of a caption, for list rows. */
export function firstLine(text: string): string {
  const line = text.split('\n').find((part) => part.trim().length > 0);
  return line ? line.trim() : '';
}
