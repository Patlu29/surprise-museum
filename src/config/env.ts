/**
 * Client configuration read from VITE_ variables at build time (.env.example).
 * These values are public. Owner: architect (shape); frontend-developer may add fields.
 */
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  functionsRegion: import.meta.env.VITE_SUPABASE_FUNCTIONS_REGION || 'ap-southeast-2',
} as const;

/** False in local development without a Supabase project. Preview still works offline. */
export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
