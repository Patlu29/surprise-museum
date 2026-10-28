#!/usr/bin/env node
/**
 * Stops a production build that would ship without a working backend.
 *
 * Production builds for GitHub Pages must run in live mode (docs/api.md section 12). If
 * VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing at build time, the site would load and
 * then fail on every call, so the deploy build must fail first. This file offers that check in
 * two forms, both using the same rules:
 *
 *   1. A command, for the deploy workflow (run it before `npm run build`):
 *
 *        node supabase/scripts/check-live-config.mjs
 *        node supabase/scripts/check-live-config.mjs --file .env.production
 *
 *      It reads the process environment (and optionally an env file; the process environment
 *      wins, as in Vite). It exits 0 when the configuration is good and 1 with a plain-language
 *      list of problems when it is not. It never prints a key.
 *
 *   2. A Vite plugin, an optional second line of defence inside the build itself:
 *
 *        import { requireLiveBackend } from './supabase/scripts/check-live-config.mjs';
 *        plugins: [react(), requireLiveBackend()],
 *
 *      It does nothing unless VITE_API_MODE=live (which the deploy workflow sets), so ordinary
 *      local builds and QA builds are unaffected. With VITE_API_MODE=live it fails the build on
 *      the same problems.
 *
 * The checks (all must pass):
 *   - VITE_API_MODE is not "mock";
 *   - VITE_SUPABASE_URL is set and is an https URL with no path, for example
 *     https://abcdefghijklmnop.supabase.co;
 *   - VITE_SUPABASE_ANON_KEY is set, is not an obvious placeholder, and is not a secret key. The
 *     website is public, so a service-role JWT or an sb_secret_ key here would leak the database.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PLACEHOLDER = /^(your[-_ ]|<|\$\{|changeme|todo|xxx|example)/i;

/** Decodes the payload of a JWT, or returns null if the value is not one. */
function jwtPayload(value) {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, problems: string[], summary: string }}
 */
export function checkLiveConfig(env) {
  const problems = [];
  const mode = (env.VITE_API_MODE ?? '').trim().toLowerCase();
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const key = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  if (mode === 'mock') {
    problems.push(
      'VITE_API_MODE is "mock". Production builds must use the real backend: set VITE_API_MODE=live (or leave it blank).',
    );
  }

  let host = '';
  if (!url) {
    problems.push(
      'VITE_SUPABASE_URL is missing. Add it as a GitHub Actions variable (Settings, Secrets and variables, Actions, Variables).',
    );
  } else if (PLACEHOLDER.test(url)) {
    problems.push('VITE_SUPABASE_URL still holds a placeholder value.');
  } else {
    try {
      const parsed = new URL(url);
      host = parsed.host;
      if (parsed.protocol !== 'https:') {
        problems.push('VITE_SUPABASE_URL must start with https://.');
      } else if (
        (parsed.pathname !== '/' && parsed.pathname !== '') ||
        parsed.search ||
        parsed.hash
      ) {
        problems.push(
          'VITE_SUPABASE_URL must be the project URL only, for example https://<ref>.supabase.co, with no path.',
        );
      }
    } catch {
      problems.push('VITE_SUPABASE_URL is not a valid URL.');
    }
  }

  let keyKind = 'unknown format';
  if (!key) {
    problems.push(
      'VITE_SUPABASE_ANON_KEY is missing. Add the anon or publishable key as a GitHub Actions variable.',
    );
  } else if (PLACEHOLDER.test(key)) {
    problems.push('VITE_SUPABASE_ANON_KEY still holds a placeholder value.');
  } else if (key.startsWith('sb_secret_')) {
    problems.push(
      'VITE_SUPABASE_ANON_KEY is a SECRET key (sb_secret_...). Never put it in the website. Use the publishable key (sb_publishable_...).',
    );
  } else {
    const payload = jwtPayload(key);
    if (payload) {
      keyKind = `JWT, role ${String(payload.role ?? 'none')}`;
      if (payload.role === 'service_role') {
        problems.push(
          'VITE_SUPABASE_ANON_KEY is the SERVICE ROLE key. Never put it in the website: it bypasses all security. Use the anon key, and rotate this one in the Supabase dashboard because it is now exposed.',
        );
      }
    } else if (key.startsWith('sb_publishable_')) {
      keyKind = 'publishable key';
    }
  }

  const ok = problems.length === 0;
  return {
    ok,
    problems,
    summary: ok ? `Live backend configuration looks good: https://${host} (key: ${keyKind}).` : '',
  };
}

/** Parses KEY=VALUE lines (comments and blank lines ignored, optional quotes). */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    out[match[1]] = value;
  }
  return out;
}

/** The message shown when the check fails. Lists problems, never values. */
export function formatProblems(problems) {
  return [
    'The production build cannot go ahead: the live backend is not configured correctly.',
    ...problems.map((p) => `  - ${p}`),
    'See supabase/README.md, step 9, and docs/api.md section 12.',
  ].join('\n');
}

/**
 * Vite plugin: fails `vite build` when VITE_API_MODE=live and the configuration is not usable.
 * Pass `{ force: true }` to check in every build.
 */
export function requireLiveBackend(options = {}) {
  return {
    name: 'surprise-museum:require-live-backend',
    apply: 'build',
    configResolved(config) {
      const env = {
        ...config.env,
        ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('VITE_'))),
      };
      const wantsLive = (env.VITE_API_MODE ?? '').trim().toLowerCase() === 'live';
      if (!options.force && !wantsLive) return;
      const result = checkLiveConfig(env);
      if (!result.ok) throw new Error(formatProblems(result.problems));
    },
  };
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

function main(argv) {
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) files.push(argv[++i]);
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node supabase/scripts/check-live-config.mjs [--file <path>]...');
      return 0;
    } else {
      console.error(`Unknown argument: ${argv[i]}`);
      return 2;
    }
  }
  let env = {};
  for (const file of files) {
    try {
      env = { ...env, ...parseEnvFile(readFileSync(file, 'utf8')) };
    } catch {
      console.error(`Could not read ${file}.`);
      return 2;
    }
  }
  // The process environment wins over files, as it does in Vite.
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') && value !== undefined) env[key] = value;
  }
  const result = checkLiveConfig(env);
  if (result.ok) {
    console.log(result.summary);
    return 0;
  }
  console.error(formatProblems(result.problems));
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
