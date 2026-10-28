/**
 * Token derivation and hashing (docs/architecture.md, section 10.1; ADR 0003).
 *
 *   editToken  = base64url(32 random bytes)                                 43 characters, 256 bits
 *   shareToken = base64url(SHA-256(SHARE_TOKEN_DERIVATION + editToken))[0..24]  24 characters, 144 bits
 *   stored     = SHA-256(token) for each, never the token itself
 *
 * Pure Web APIs only (Web Crypto, TextEncoder, btoa), so this file runs unchanged in Deno, Node,
 * Vitest and the browser (the in-memory mock API uses it). The only import is the shared contract.
 */
import { EDIT_TOKEN_PATTERN, SHARE_TOKEN_DERIVATION, SHARE_TOKEN_PATTERN } from '@contract';

const utf8 = new TextEncoder();

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** PostgREST representation of a bytea value: a `\x` prefix followed by hex. */
export function toByteaLiteral(bytes: Uint8Array): string {
  return '\\x' + bytesToHex(bytes);
}

/** Parses a bytea value as PostgREST returns it (`\x...`). */
export function fromByteaLiteral(value: string): Uint8Array<ArrayBuffer> {
  if (!value.startsWith('\\x')) {
    throw new Error('Unexpected bytea format');
  }
  return hexToBytes(value.slice(2));
}

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

/**
 * SHA-256. Uses Web Crypto when it exists. `crypto.subtle` is missing on pages served over plain
 * HTTP from a LAN address (for example a phone testing the Vite dev server), so there is a small
 * pure JavaScript fallback; the in-memory mock API needs it. The Edge Functions always have
 * Web Crypto.
 */
export async function sha256(input: Uint8Array | string): Promise<Uint8Array<ArrayBuffer>> {
  const data = typeof input === 'string' ? utf8.encode(input) : input;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    return new Uint8Array(await subtle.digest('SHA-256', new Uint8Array(data)));
  }
  return sha256Js(data);
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Synchronous pure JavaScript SHA-256 (FIPS 180-4). Exported so tests can check it directly. */
export function sha256Js(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const length = data.length;
  const paddedLength = (((length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(paddedLength - 4, (length << 3) >>> 0, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let a = h[0] ?? 0;
    let b = h[1] ?? 0;
    let c = h[2] ?? 0;
    let d = h[3] ?? 0;
    let e = h[4] ?? 0;
    let f = h[5] ?? 0;
    let g = h[6] ?? 0;
    let hh = h[7] ?? 0;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = ((h[0] ?? 0) + a) >>> 0;
    h[1] = ((h[1] ?? 0) + b) >>> 0;
    h[2] = ((h[2] ?? 0) + c) >>> 0;
    h[3] = ((h[3] ?? 0) + d) >>> 0;
    h[4] = ((h[4] ?? 0) + e) >>> 0;
    h[5] = ((h[5] ?? 0) + f) >>> 0;
    h[6] = ((h[6] ?? 0) + g) >>> 0;
    h[7] = ((h[7] ?? 0) + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i] ?? 0, false);
  return out;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type RandomBytes = (length: number) => Uint8Array;

const defaultRandomBytes: RandomBytes = (length) => {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
};

/** 32 random bytes, base64url: 43 characters, 256 bits. */
export function generateEditToken(randomBytes: RandomBytes = defaultRandomBytes): string {
  return base64UrlEncode(randomBytes(32));
}

export function isEditToken(value: unknown): value is string {
  return typeof value === 'string' && EDIT_TOKEN_PATTERN.test(value);
}

export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_PATTERN.test(value);
}

/** The share token is the first 24 base64url characters of SHA-256 of the derivation prefix and the edit token. */
export async function deriveShareToken(editToken: string): Promise<string> {
  const digest = await sha256(SHARE_TOKEN_DERIVATION + editToken);
  return base64UrlEncode(digest).slice(0, 24);
}

/** SHA-256 of a token, as stored in the database (32 bytes). */
export function hashToken(token: string): Promise<Uint8Array<ArrayBuffer>> {
  return sha256(token);
}

export interface TokenPair {
  editToken: string;
  shareToken: string;
  editTokenHash: Uint8Array<ArrayBuffer>;
  shareTokenHash: Uint8Array<ArrayBuffer>;
}

/** Creates a new edit token with its derived share token and both database hashes. */
export async function createTokenPair(randomBytes?: RandomBytes): Promise<TokenPair> {
  const editToken = generateEditToken(randomBytes);
  const shareToken = await deriveShareToken(editToken);
  return {
    editToken,
    shareToken,
    editTokenHash: await hashToken(editToken),
    shareTokenHash: await hashToken(shareToken),
  };
}

// ---------------------------------------------------------------------------
// Secrets and rate-limit keys
// ---------------------------------------------------------------------------

/**
 * Compares two secrets without leaking where they differ or how long they are: both are hashed
 * first, then the fixed-length digests are compared without early exit.
 */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Reduces an IP address to the unit that identifies one client for rate limiting: the whole
 * address for IPv4, the /64 network for IPv6 (a single household owns at least a /64, and
 * otherwise one client could rotate through billions of addresses). IPv4-mapped IPv6 addresses
 * are treated as IPv4. Anything unparseable is returned trimmed and lower-cased.
 */
export function normaliseIp(ip: string): string {
  const value = ip.trim().toLowerCase().split('%')[0] ?? '';
  if (!value.includes(':')) return value;

  const mapped = /^(?:0{0,4}:){2,5}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped?.[1]) return mapped[1];

  const [head = '', tail = ''] = value.split('::');
  const hasGap = value.includes('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  if ((hasGap && missing < 1) || (!hasGap && headGroups.length !== 8)) return value;
  const groups = hasGap
    ? [...headGroups, ...Array.from({ length: missing }, () => '0'), ...tailGroups]
    : headGroups;
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return value;
  return groups
    .slice(0, 4)
    .map((g) => g.padStart(4, '0'))
    .join(':');
}

/** Salted, truncated hash of a client IP: stable for rate limiting, useless for identifying anyone. */
export async function hashClientIp(ip: string, salt: string): Promise<string> {
  const digest = await sha256(`${salt}|${normaliseIp(ip)}`);
  return bytesToHex(digest.subarray(0, 16));
}
