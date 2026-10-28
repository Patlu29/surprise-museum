/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_FUNCTIONS_REGION?: string;
  /**
   * `mock`, `live` or blank (ADR 0015). Blank means live in a production build and "live if the
   * Supabase variables are set, otherwise mock" in development. Read through `getApiMode()` in
   * `@/api`, never directly. Typed as `string` because the value is not validated at build time.
   */
  readonly VITE_API_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
