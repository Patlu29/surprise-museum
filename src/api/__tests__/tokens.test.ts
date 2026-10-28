import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EDIT_TOKEN_PATTERN, SHARE_TOKEN_DERIVATION, SHARE_TOKEN_PATTERN } from '@contract';
import {
  base64UrlEncode,
  bytesToHex,
  createTokenPair,
  deriveShareToken,
  fromByteaLiteral,
  generateEditToken,
  hashClientIp,
  hashToken,
  hexToBytes,
  normaliseIp,
  secretsMatch,
  sha256,
  sha256Js,
  toByteaLiteral,
} from '../../../supabase/functions/_shared/tokens';

const nodeSha256 = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex');

describe('sha256', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    const empty = bytesToHex(sha256Js(new Uint8Array()));
    expect(empty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const abc = bytesToHex(sha256Js(new TextEncoder().encode('abc')));
    expect(abc).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const long = bytesToHex(
      sha256Js(
        new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      ),
    );
    expect(long).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('the pure JavaScript fallback agrees with Web Crypto for many lengths', async () => {
    for (const length of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 1000, 4097]) {
      const data = new Uint8Array(randomBytes(length));
      expect(bytesToHex(sha256Js(data))).toBe(nodeSha256(data));
      expect(bytesToHex(await sha256(data))).toBe(nodeSha256(data));
    }
  });

  it('falls back to the pure implementation when crypto.subtle is missing', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) },
      configurable: true,
    });
    try {
      expect(bytesToHex(await sha256('abc'))).toBe(nodeSha256('abc'));
      expect(await deriveShareToken('a'.repeat(43))).toMatch(SHARE_TOKEN_PATTERN);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});

describe('encoding', () => {
  it('base64url has no padding or unsafe characters', () => {
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-');
    expect(base64UrlEncode(new Uint8Array([1]))).toBe('AQ');
  });

  it('round-trips hex and the PostgREST bytea literal', () => {
    const bytes = new Uint8Array([0, 1, 254, 255]);
    expect(bytesToHex(bytes)).toBe('0001feff');
    expect([...hexToBytes('0001FEFF')]).toEqual([...bytes]);
    expect(toByteaLiteral(bytes)).toBe('\\x0001feff');
    expect([...fromByteaLiteral('\\x0001feff')]).toEqual([...bytes]);
    expect(() => hexToBytes('abc')).toThrow();
    expect(() => hexToBytes('zz')).toThrow();
    expect(() => fromByteaLiteral('0001')).toThrow();
  });
});

describe('edit and share tokens', () => {
  it('an edit token is 32 random bytes as 43 base64url characters (256 bits)', () => {
    const token = generateEditToken();
    expect(token).toMatch(EDIT_TOKEN_PATTERN);
    expect(token).toHaveLength(43);
    expect(new Set(Array.from({ length: 200 }, () => generateEditToken())).size).toBe(200);
  });

  it('uses exactly the bytes the random source returns', () => {
    const token = generateEditToken(() => new Uint8Array(32).fill(0xff));
    // 256 bits of ones: 42 full groups of six bits, then the last four bits ('8' pads the rest).
    expect(token).toBe('_'.repeat(42) + '8');
  });

  it('derives the share token as the first 24 characters of base64url(SHA-256(prefix + edit token))', async () => {
    const edit = generateEditToken(() => new Uint8Array(32).fill(7));
    const expected = createHash('sha256')
      .update(SHARE_TOKEN_DERIVATION + edit)
      .digest('base64url')
      .slice(0, 24);
    const share = await deriveShareToken(edit);
    expect(share).toBe(expected);
    expect(share).toMatch(SHARE_TOKEN_PATTERN);
    expect(SHARE_TOKEN_DERIVATION).toBe('surprise-museum/share/v1:');
  });

  it('is deterministic, and different edit tokens give different share tokens', async () => {
    const a = generateEditToken(() => new Uint8Array(32).fill(1));
    const b = generateEditToken(() => new Uint8Array(32).fill(2));
    expect(await deriveShareToken(a)).toBe(await deriveShareToken(a));
    expect(await deriveShareToken(a)).not.toBe(await deriveShareToken(b));
  });

  it('the share token reveals nothing usable about the edit token', async () => {
    const edit = generateEditToken();
    const share = await deriveShareToken(edit);
    expect(edit.includes(share)).toBe(false);
    expect(edit.startsWith(share)).toBe(false);
  });

  it('stores SHA-256 of each token, never the token', async () => {
    const pair = await createTokenPair();
    expect(pair.editTokenHash).toHaveLength(32);
    expect(bytesToHex(pair.editTokenHash)).toBe(nodeSha256(pair.editToken));
    expect(bytesToHex(pair.shareTokenHash)).toBe(nodeSha256(pair.shareToken));
    expect(bytesToHex(pair.editTokenHash)).not.toBe(bytesToHex(pair.shareTokenHash));
    expect(bytesToHex(await hashToken(pair.editToken))).toBe(bytesToHex(pair.editTokenHash));
    expect(pair.shareToken).toBe(await deriveShareToken(pair.editToken));
  });
});

describe('secretsMatch', () => {
  it('compares equal and different secrets, including different lengths', async () => {
    expect(await secretsMatch('abc', 'abc')).toBe(true);
    expect(await secretsMatch('abc', 'abd')).toBe(false);
    expect(await secretsMatch('abc', 'abcd')).toBe(false);
    expect(await secretsMatch('', 'abc')).toBe(false);
    expect(await secretsMatch('', '')).toBe(true);
  });
});

describe('rate-limit keys', () => {
  it('uses the whole IPv4 address and the /64 of an IPv6 address', () => {
    expect(normaliseIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normaliseIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:0db8:0001:0002');
    expect(normaliseIp('2001:db8:1:2::1')).toBe('2001:0db8:0001:0002');
    expect(normaliseIp('2001:DB8:1:2:ffff::')).toBe('2001:0db8:0001:0002');
    expect(normaliseIp('::1')).toBe('0000:0000:0000:0000');
    expect(normaliseIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normaliseIp(' fe80::1%eth0 ')).toBe('fe80:0000:0000:0000');
    expect(normaliseIp('unknown')).toBe('unknown');
  });

  it('hashes with a salt, never stores the address, and is stable', async () => {
    const a = await hashClientIp('203.0.113.7', 'salt');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain('203');
    expect(await hashClientIp('203.0.113.7', 'salt')).toBe(a);
    expect(await hashClientIp('203.0.113.7', 'other')).not.toBe(a);
    expect(await hashClientIp('203.0.113.8', 'salt')).not.toBe(a);
    expect(await hashClientIp('2001:db8:1:2::1', 's')).toBe(
      await hashClientIp('2001:db8:1:2::ffff', 's'),
    );
  });
});
