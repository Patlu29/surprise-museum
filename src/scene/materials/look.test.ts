/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOK } from './look';

/** Vitest blanks CSS imports, so read the token file directly. */
const tokensCss = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');

/** `--look-rim-px` becomes `rimPx`. */
function camel(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function lookTokens(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of tokensCss.matchAll(/--look-([a-z-]+):\s*([^;]+?)\s*;/g)) {
    const [, name, value] = m;
    if (name && value) out.set(camel(name), value);
  }
  return out;
}

describe('LOOK', () => {
  const tokens = lookTokens();

  it('mirrors every --look-* token in tokens.css, and nothing else', () => {
    expect([...tokens.keys()].sort()).toEqual(Object.keys(LOOK).sort());
  });

  it('matches every value', () => {
    for (const [key, raw] of tokens) {
      const mirrored = LOOK[key as keyof typeof LOOK];
      if (typeof mirrored === 'string') {
        expect(raw.toLowerCase(), key).toBe(mirrored);
      } else if (typeof mirrored === 'number') {
        expect(Number(raw), key).toBe(mirrored);
      } else {
        const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(raw);
        expect(m, `${key} is rgba`).not.toBeNull();
        expect([Number(m?.[1]), Number(m?.[2]), Number(m?.[3])], key).toEqual([...mirrored.rgb]);
        expect(Number(m?.[4]), key).toBeCloseTo(mirrored.alpha, 5);
      }
    }
  });

  it('keeps hex colours as lower-case #rrggbb', () => {
    for (const [key, value] of Object.entries(LOOK)) {
      if (typeof value === 'string') expect(value, key).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
