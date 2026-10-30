import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESTORED_NOTICE_ANNOUNCEMENT } from '@/ui/builder/RestoredDraftNotice';

/**
 * FR-76 guard (US-48, design spec 10.1): the app never writes a gendered pronoun or noun for the
 * Guide, the Visitor or the Creator. Singular "their" and "your" are fine. "Woman" and "Man" are
 * the Creator-facing Gender labels, so they are deliberately not in this list.
 */
const GENDERED = /\b(she|her|hers|herself|he|him|his|himself|girlfriend|boyfriend)\b/i;

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|testutil)\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Removes comments, so only code and text the app can show is left. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** The string literals, template text and JSX text of a file: what a person could read. */
function appStrings(code: string): string[] {
  const stripped = stripComments(code);
  const found: string[] = [];
  for (const match of stripped.matchAll(
    /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g,
  )) {
    found.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  for (const match of stripped.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g)) {
    found.push(match[1] ?? '');
  }
  for (const match of stripped.matchAll(/^\s*([A-Za-z][^<>{}=;()\n]*[a-z.,!?])\s*$/gm)) {
    found.push(match[1] ?? '');
  }
  return found;
}

describe('FR-76: no gendered pronouns or nouns in app-written text', () => {
  it('recognises the words it is meant to catch, and not the allowed ones', () => {
    for (const word of [
      'she',
      'Her',
      'hers',
      'HE',
      'him',
      'his',
      'herself',
      'himself',
      'girlfriend',
      'boyfriend',
    ]) {
      expect(GENDERED.test(`Tell ${word} about it`), word).toBe(true);
    }
    for (const text of [
      'Woman',
      'Man',
      'their photos',
      'your name',
      'the Visitor',
      'Sheffield',
      'Hero',
      'history',
    ]) {
      expect(GENDERED.test(text), text).toBe(false);
    }
  });

  it('finds the strings in a sample, ignoring comments', () => {
    const sample = "// she walks\nconst a = 'Tell her';\nconst b = <p>and him</p>;";
    const strings = appStrings(sample);
    expect(strings.some((text) => GENDERED.test(text))).toBe(true);
    expect(appStrings("// she walks\nconst a = 'Hello';").some((text) => GENDERED.test(text))).toBe(
      false,
    );
  });

  it('finds none in any string literal or JSX text under src/', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const text of appStrings(readFileSync(file, 'utf8'))) {
        if (GENDERED.test(text)) offenders.push(`${relative(SRC, file)}: ${text.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the notice copy clean', () => {
    expect(GENDERED.test(RESTORED_NOTICE_ANNOUNCEMENT)).toBe(false);
  });
});
