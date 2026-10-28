/**
 * HTTP plumbing shared by the Edge Functions: CORS, JSON bodies, uniform errors, rate limiting
 * and the request wrapper. No Deno globals, so the handlers can be tested with plain Requests.
 *
 * Rules (docs/architecture.md section 10; ADR 0003):
 *   - Every response carries Cache-Control: no-store.
 *   - Errors always use ApiError { error, message, field? }; no stack traces, no internals.
 *   - Request bodies, tokens, names and captions are never logged.
 *   - CORS allows only the origins in ALLOWED_ORIGINS. A request with no Origin header is not
 *     from a browser (cron, curl, tests) and carries no CORS headers.
 */
import type { ApiError, ApiErrorCode } from '@contract';
import { hashClientIp } from './tokens.ts';
import type { MuseumStore } from './ports.ts';

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  photo_limit: 409,
  upload_quota: 409,
  invalid_image: 422,
  rate_limited: 429,
  server_error: 500,
};

export const MAX_BODY_BYTES = 64 * 1024;

export class ApiException extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly field: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { field?: string; status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.field = options.field;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** The one body every bad link produces: unknown, malformed, draft, expired and deleted. */
export function notFound(): ApiException {
  return new ApiException('not_found', 'This museum could not be found.');
}

export function isEmptyObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

export interface EndpointConfig {
  allowedOrigins: string[];
  rateLimitSalt: string;
  cronSecret?: string | undefined;
}

export interface BaseDeps {
  store: MuseumStore;
  config: EndpointConfig;
  /** Injected so tests control time. */
  now?: () => Date;
}

export interface RequestContext {
  request: Request;
  now: () => Date;
  /** Parses the JSON body once. Throws bad_request or a 413 for bad input. */
  json: () => Promise<unknown>;
  /** Salted hash of the client address. Never the address itself. */
  ipHash: () => Promise<string>;
}

export interface EndpointResult {
  status: number;
  body: unknown;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-region';

/** Parses ALLOWED_ORIGINS: comma separated, no trailing slashes, each a real origin. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const origins: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim().replace(/\/+$/, '');
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.origin === trimmed) origins.push(trimmed);
    } catch {
      // An entry that is not an origin is ignored rather than widening access.
    }
  }
  return origins;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  });
}

export function errorBody(error: ApiException): ApiError {
  const body: ApiError = { error: error.code, message: error.message };
  if (error.field !== undefined) body.field = error.field;
  return body;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/**
 * The address the platform saw. cf-connecting-ip is set by the CDN in front of the functions and
 * cannot be forged by the client; x-forwarded-for is only a fallback for local development.
 */
export function clientIpOf(request: Request): string {
  const headers = request.headers;
  const direct = headers.get('cf-connecting-ip') ?? headers.get('x-real-ip');
  if (direct) return direct.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return 'unknown';
}

async function readBodyText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiException('bad_request', 'The request is too large.', { status: 413 });
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiException('bad_request', 'The request is too large.', { status: 413 });
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export function secondsUntilWindowEnds(now: Date, windowSeconds: number): number {
  const elapsed = Math.floor(now.getTime() / 1000) % windowSeconds;
  return Math.max(1, windowSeconds - elapsed);
}

/** Counts a hit against `bucket`; throws rate_limited (429, with Retry-After) when over the limit. */
export async function enforceLimit(
  store: MuseumStore,
  now: Date,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const within = await store.rateLimitHit(bucket, limit, windowSeconds);
  if (!within) throw tooManyRequests(now, windowSeconds);
}

export function tooManyRequests(now: Date, windowSeconds: number): ApiException {
  return new ApiException('rate_limited', 'Too many requests. Please try again shortly.', {
    retryAfterSeconds: secondsUntilWindowEnds(now, windowSeconds),
  });
}

// ---------------------------------------------------------------------------
// Endpoint wrapper
// ---------------------------------------------------------------------------

export interface EndpointOptions {
  name: string;
  /** Browser endpoints send CORS headers; purge-expired is called by the database, not a browser. */
  cors: boolean;
  /** Require a JSON content type. This forces a CORS preflight on cross-site requests. */
  requireJson: boolean;
}

/**
 * Wraps a handler body with the behaviour every endpoint shares: preflight, method and origin
 * checks, body parsing, error mapping and safe logging.
 */
export function createEndpoint(
  deps: BaseDeps,
  options: EndpointOptions,
  run: (ctx: RequestContext) => Promise<EndpointResult>,
): (request: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    let cors: Record<string, string> = {};
    if (options.cors && origin !== null) {
      if (!deps.config.allowedOrigins.includes(origin)) {
        // The browser would block the answer anyway; refuse to do the work as well.
        return jsonResponse(403, errorBody(new ApiException('bad_request', 'Origin not allowed.')));
      }
      cors = corsHeaders(origin);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Cache-Control': 'no-store' } });
    }

    try {
      if (request.method !== 'POST') {
        throw new ApiException('bad_request', 'Use POST.', { status: 405 });
      }
      if (options.requireJson) {
        const type = request.headers.get('content-type') ?? '';
        if (!/^application\/json\b/i.test(type)) {
          throw new ApiException('bad_request', 'Send the request as application/json.', {
            status: 415,
          });
        }
      }

      let parsed: { value: unknown } | undefined;
      let ip: Promise<string> | undefined;
      const ctx: RequestContext = {
        request,
        now,
        json: async () => {
          if (parsed) return parsed.value;
          const text = await readBodyText(request, MAX_BODY_BYTES);
          let value: unknown;
          try {
            value = text.trim() === '' ? {} : JSON.parse(text);
          } catch {
            throw new ApiException('bad_request', 'The request body is not valid JSON.');
          }
          parsed = { value };
          return value;
        },
        ipHash: () => (ip ??= hashClientIp(clientIpOf(request), deps.config.rateLimitSalt)),
      };

      const result = await run(ctx);
      return jsonResponse(result.status, result.body, cors);
    } catch (error) {
      if (error instanceof ApiException) {
        const headers: Record<string, string> = { ...cors };
        if (error.retryAfterSeconds !== undefined) {
          headers['Retry-After'] = String(error.retryAfterSeconds);
        }
        return jsonResponse(error.status, errorBody(error), headers);
      }
      if (error instanceof TypeError && /utf-?8|decode/i.test(error.message)) {
        return jsonResponse(
          400,
          errorBody(new ApiException('bad_request', 'The request body is not valid text.')),
          cors,
        );
      }
      // Log the kind of failure only: messages from the database or storage can contain row data.
      const kind = error instanceof Error ? error.name : 'error';
      const code = (error as { code?: unknown } | null)?.code;
      console.error(
        `${options.name}: unexpected ${kind}${typeof code === 'string' ? ` (${code})` : ''}`,
      );
      return jsonResponse(
        500,
        errorBody(new ApiException('server_error', 'Something went wrong. Please try again.')),
        cors,
      );
    }
  };
}
