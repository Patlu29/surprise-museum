/**
 * Runtime configuration, read from environment variables (supabase/functions/.env.example).
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase and never leave the function.
 */
import { parseAllowedOrigins, type EndpointConfig } from './http.ts';

export class ConfigError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing or invalid configuration: ${missing.join(', ')}`);
    this.name = 'ConfigError';
    this.missing = missing;
  }
}

export interface RuntimeConfig extends EndpointConfig {
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
  if (missing.length > 0) throw new ConfigError(missing);

  const publicStorageUrl = getEnv('PUBLIC_API_URL')?.trim().replace(/\/+$/, '') || undefined;
  return {
    supabaseUrl,
    serviceRoleKey,
    rateLimitSalt,
    allowedOrigins,
    cronSecret: getEnv('CRON_SECRET')?.trim() || undefined,
    publicStorageUrl,
  };
}
