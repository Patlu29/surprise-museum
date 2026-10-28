/**
 * Chooses between the real backend and the mock.
 *
 * Production builds (what GitHub Pages serves) must never fall back to the mock by accident, so
 * the rule differs between a development server and a production build:
 *
 *   VITE_API_MODE=mock    the mock, in any build. Local development and QA only.
 *   VITE_API_MODE=live    the real backend, in any build.
 *   blank, development    the real backend when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are
 *                         both set, otherwise the mock, so `npm run dev` works with no setup.
 *   blank, production     always the real backend. If the Supabase variables are missing every call
 *                         fails with `unconfigured` instead of quietly running a demo.
 *
 * The deploy build is stopped before it is published when the variables are missing: see
 * supabase/scripts/check-live-config.mjs (a CLI check and a Vite plugin), documented in
 * docs/api.md section 12.
 */
export type ApiMode = 'live' | 'mock';

export interface ModeInputs {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Value of VITE_API_MODE, if any. */
  flag?: string | undefined;
  /** True in a production build (`import.meta.env.PROD`). */
  production?: boolean | undefined;
}

export function resolveApiMode(inputs: ModeInputs): ApiMode {
  const flag = inputs.flag?.trim().toLowerCase();
  if (flag === 'mock') return 'mock';
  if (flag === 'live') return 'live';
  if (inputs.production) return 'live';
  return inputs.supabaseUrl && inputs.supabaseAnonKey ? 'live' : 'mock';
}
