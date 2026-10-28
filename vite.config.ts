/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite';
// Owned by the backend-developer; typed by check-live-config.d.mts. ADR 0015.
import { requireLiveBackend } from './supabase/scripts/check-live-config.mjs';

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

/**
 * Chunk size budgets, in kB of minified output (the same measure as Vite's own warning).
 * Every chunk gets DEFAULT_CHUNK_LIMIT_KB, except the HEIC decoder, which is a known 3 MB WASM
 * bundle (ADR 0004). It gets its own ceiling, and only while it stays a lazily loaded chunk that
 * no other chunk imports statically, so growth in it, or anything pulling it into a normal
 * chunk, still warns. See docs/architecture.md, section 12.
 */
const DEFAULT_CHUNK_LIMIT_KB = 1000;
const LAZY_CHUNK_LIMITS_KB: ReadonlyArray<{ label: string; module: RegExp; limitKb: number }> = [
  {
    label: 'heic-to (HEIC decoder, ADR 0004)',
    module: /[\\/]node_modules[\\/]heic-to[\\/]/,
    limitKb: 3500,
  },
];

function chunkSizeBudgets(): Plugin {
  return {
    name: 'surprise-museum:chunk-size-budgets',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
      const staticallyImported = new Set(chunks.flatMap((chunk) => chunk.imports));
      for (const chunk of chunks) {
        const sizeKb = chunk.code.length / 1000;
        const lazy = chunk.isDynamicEntry && !staticallyImported.has(chunk.fileName);
        const exception = lazy
          ? LAZY_CHUNK_LIMITS_KB.find((entry) =>
              chunk.moduleIds.some((id) => entry.module.test(id)),
            )
          : undefined;
        const limitKb = exception?.limitKb ?? DEFAULT_CHUNK_LIMIT_KB;
        if (sizeKb > limitKb) {
          this.warn(
            `${chunk.fileName} is ${sizeKb.toFixed(0)} kB minified, over its ${limitKb} kB budget` +
              `${exception ? ` (${exception.label})` : ''}. See docs/architecture.md, section 12.`,
          );
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: BASE_PATH,
    plugins: [
      react(),
      // Fails `vite build` only when VITE_API_MODE=live and the Supabase variables are missing,
      // placeholders or a secret key. Dev, ordinary and VITE_API_MODE=mock builds are untouched.
      requireLiveBackend(),
      contentSecurityPolicy(env.VITE_SUPABASE_URL),
      chunkSizeBudgets(),
    ],
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
      // Per-chunk budgets are enforced by chunkSizeBudgets() above (1000 kB for every chunk,
      // a separate ceiling for the lazy HEIC decoder). Vite's single global limit is raised to
      // that ceiling so it does not warn about the decoder; it remains a backstop.
      chunkSizeWarningLimit: Math.max(
        DEFAULT_CHUNK_LIMIT_KB,
        ...LAZY_CHUNK_LIMITS_KB.map((c) => c.limitKb),
      ),
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
      environment: 'node',
      passWithNoTests: true,
    },
  };
});
