/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';

/**
 * The site is served from https://patlu29.github.io/surprise-museum/ (GitHub Pages project site).
 * Routing uses the URL hash (ADR 0002), so the base path is the only path the server ever sees.
 */
const BASE_PATH = '/surprise-museum/';

/**
 * Injects a Content-Security-Policy <meta> tag (and a preconnect to Supabase) into the production
 * build only.
 * GitHub Pages cannot set response headers, so the policy has to live in index.html.
 * The Vite dev server is left alone because it relies on inline scripts for hot reload.
 * See docs/architecture.md, section 10 (Security).
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  let supabaseOrigin = '';
  if (supabaseUrl) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin;
    } catch {
      throw new Error(`VITE_SUPABASE_URL is not a valid URL: "${supabaseUrl}"`);
    }
  }

  const directives = [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is needed only by the lazily loaded HEIC decoder (ADR 0004).
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return {
    name: 'surprise-museum:security-head',
    apply: 'build',
    transformIndexHtml() {
      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: directives.join('; ') },
          injectTo: 'head-prepend',
        },
      ];
      if (supabaseOrigin) {
        // Opens the TLS connection to Supabase while the app bundle downloads (NFR-2).
        tags.push({
          tag: 'link',
          attrs: { rel: 'preconnect', href: supabaseOrigin, crossorigin: '' },
          injectTo: 'head',
        });
      }
      return tags;
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: BASE_PATH,
    plugins: [react(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: {
        '@contract': fileURLToPath(
          new URL('./supabase/functions/_shared/contract.ts', import.meta.url),
        ),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    build: {
      // three.js alone is about 700 kB minified before gzip; the 3D chunk is loaded lazily
      // after the welcome screen. Budgets are in docs/architecture.md, section 12.
      chunkSizeWarningLimit: 1000,
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
      environment: 'node',
      passWithNoTests: true,
    },
  };
});
