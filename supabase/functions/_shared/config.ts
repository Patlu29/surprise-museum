/**
 * Runtime configuration, read from environment variables (supabase/functions/.env.example).
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase and never leave the function.
 */
import { parseAllowedOrigins, type EndpointConfig } from './http.ts';
import { DEFAULT_SPACE_LIMITS, type SpaceLimits } from './space.ts';

export class ConfigError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing or invalid configuration: ${missing.join(', ')}`);
    this.name = 'ConfigError';
    this.missing = missing;
  }
}

/** A set threshold must be a whole number in this range (ADR 0024 section 2). */
const MAX_SPACE_LIMIT = 1_000_000_000_000;

/** Unset or blank means `fallback`; a value that is not a whole number from 1 to 10^12 is invalid. */
function parseSpaceLimit(raw: string | undefined, fallback: number): number | null {
  const text = raw?.trim();
  if (!text) return fallback;
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_SPACE_LIMIT ? value : null;
}

export interface RuntimeConfig extends EndpointConfig {
  spaceLimits: SpaceLimits;
  supabaseUrl: string;
  serviceRoleKey: string;
  /** Local development only: the URL the browser uses for Storage, when it differs from SUPABASE_URL. */
  publicStorageUrl?: string | undefined;
}

export function loadConfig(getEnv: (name: string) => string | undefined): RuntimeConfig {
  const missing: string[] = [];
  const need = (name: string): string => {
    const value = getEnv(name)?.trim();
    if (!value) missing.push(name);
    return value ?? '';
  };

  const supabaseUrl = need('SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = need('SUPABASE_SERVICE_ROLE_KEY');
  const rateLimitSalt = need('RATE_LIMIT_SALT');
  const allowedOrigins = parseAllowedOrigins(getEnv('ALLOWED_ORIGINS'));
  if (allowedOrigins.length === 0) missing.push('ALLOWED_ORIGINS');

  // Optional thresholds. An invalid value is a loud 500, never a silent default (ADR 0024).
  const storageBytes = parseSpaceLimit(
    getEnv('SPACE_FULL_STORAGE_BYTES'),
    DEFAULT_SPACE_LIMITS.storageBytes,
  );
  const databaseBytes = parseSpaceLimit(
    getEnv('SPACE_FULL_DATABASE_BYTES'),
    DEFAULT_SPACE_LIMITS.databaseBytes,
  );
  if (storageBytes === null) missing.push('SPACE_FULL_STORAGE_BYTES');
  if (databaseBytes === null) missing.push('SPACE_FULL_DATABASE_BYTES');
  if (missing.length > 0 || storageBytes === null || databaseBytes === null) {
    throw new ConfigError(missing);
  }

  const publicStorageUrl = getEnv('PUBLIC_API_URL')?.trim().replace(/\/+$/, '') || undefined;
  return {
    supabaseUrl,
    serviceRoleKey,
    rateLimitSalt,
    allowedOrigins,
    cronSecret: getEnv('CRON_SECRET')?.trim() || undefined,
    publicStorageUrl,
    spaceLimits: { storageBytes, databaseBytes },
  };
}
