/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOB_SHADOW, SCENE_PALETTE } from './palette';

/** Vitest blanks CSS imports, so read the token file directly. */
const tokensCss = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');

/** `--scene-wall-shade` becomes `wallShade`. */
function camel(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function sceneTokens(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of tokensCss.matchAll(/--scene-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, hex] = m;
    if (name && hex) out.set(camel(name), hex.toLowerCase());
  }
  return out;
}

describe('SCENE_PALETTE', () => {
  const tokens = sceneTokens();

  it('mirrors every hex --scene-* token in tokens.css', () => {
    const palette = new Map(Object.entries(SCENE_PALETTE));
    expect([...tokens.keys()].sort()).toEqual([...palette.keys()].sort());
    for (const [key, hex] of tokens) {
      expect(palette.get(key), key).toBe(hex);
    }
  });

  it('mirrors the blob shadow rgba token', () => {
    const m = /--scene-blob-shadow:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(tokensCss);
    expect(m).not.toBeNull();
    expect([Number(m?.[1]), Number(m?.[2]), Number(m?.[3])]).toEqual([...BLOB_SHADOW.rgb]);
    expect(Number(m?.[4])).toBeCloseTo(BLOB_SHADOW.alpha, 5);
  });
});
