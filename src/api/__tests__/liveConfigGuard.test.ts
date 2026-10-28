import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkLiveConfig,
  formatProblems,
  parseEnvFile,
  requireLiveBackend,
} from '../../../supabase/scripts/check-live-config.mjs';

const SCRIPT = join(process.cwd(), 'supabase/scripts/check-live-config.mjs');
const jwt = (payload: object) => {
  const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(payload)}.signature`;
};
const good = {
  VITE_API_MODE: 'live',
  VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }),
};

describe('checkLiveConfig', () => {
  it('accepts a configured live backend, with a JWT anon key or a publishable key', () => {
    expect(checkLiveConfig(good)).toMatchObject({ ok: true, problems: [] });
    expect(checkLiveConfig(good).summary).toContain('abcdefghijklmnop.supabase.co');
    expect(checkLiveConfig({ ...good, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc123' }).ok).toBe(
      true,
    );
    expect(checkLiveConfig({ ...good, VITE_API_MODE: undefined }).ok).toBe(true);
    expect(
      checkLiveConfig({ ...good, VITE_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co/' }).ok,
    ).toBe(true);
  });

  it('fails when either variable is missing or blank', () => {
    const result = checkLiveConfig({ VITE_API_MODE: 'live' });
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('VITE_SUPABASE_URL is missing');
    expect(result.problems.join(' ')).toContain('VITE_SUPABASE_ANON_KEY is missing');
    expect(checkLiveConfig({ ...good, VITE_SUPABASE_URL: '' }).ok).toBe(false);
    expect(checkLiveConfig({ ...good, VITE_SUPABASE_ANON_KEY: '   ' }).ok).toBe(false);
    expect(checkLiveConfig({}).problems).toHaveLength(2);
  });

  it('fails when the build asks for the mock', () => {
    const result = checkLiveConfig({ ...good, VITE_API_MODE: 'mock' });
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain('"mock"');
    expect(checkLiveConfig({ ...good, VITE_API_MODE: ' MOCK ' }).ok).toBe(false);
  });

  it('rejects a bad URL: not https, a path, not a URL, a placeholder', () => {
    for (const url of [
      'http://abc.supabase.co',
      'https://abc.supabase.co/rest/v1',
      'abc.supabase.co',
      'https://abc.supabase.co?x=1',
      'your-project-url',
      '<ref>.supabase.co',
    ]) {
      expect(checkLiveConfig({ ...good, VITE_SUPABASE_URL: url }).ok, url).toBe(false);
    }
  });

  it('rejects placeholder keys and any secret key, which would leak the database from a public site', () => {
    expect(checkLiveConfig({ ...good, VITE_SUPABASE_ANON_KEY: 'your-anon-key' }).ok).toBe(false);
    expect(checkLiveConfig({ ...good, VITE_SUPABASE_ANON_KEY: '${{ vars.KEY }}' }).ok).toBe(false);
    const secretKey = checkLiveConfig({ ...good, VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' });
    expect(secretKey.ok).toBe(false);
    expect(secretKey.problems[0]).toContain('SECRET key');
    const serviceRole = checkLiveConfig({
      ...good,
      VITE_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }),
    });
    expect(serviceRole.ok).toBe(false);
    expect(serviceRole.problems[0]).toContain('SERVICE ROLE');
  });

  it('never repeats a key in its messages', () => {
    const key = jwt({ role: 'service_role' });
    const result = checkLiveConfig({ ...good, VITE_SUPABASE_ANON_KEY: key, VITE_API_MODE: 'mock' });
    expect(JSON.stringify(result)).not.toContain(key);
    expect(formatProblems(result.problems)).not.toContain(key);
  });
});

describe('parseEnvFile', () => {
  it('reads KEY=VALUE lines, ignoring comments, blanks, quotes and export', () => {
    const parsed = parseEnvFile(
      [
        '# comment',
        '',
        'VITE_A=1',
        'VITE_B="two words"',
        "VITE_C='x'",
        'export VITE_D=4 # trailing',
        'not a line',
      ].join('\n'),
    );
    expect(parsed).toEqual({ VITE_A: '1', VITE_B: 'two words', VITE_C: 'x', VITE_D: '4' });
  });
});

describe('requireLiveBackend (Vite plugin)', () => {
  const run = (env: Record<string, string>, options?: { force?: boolean }) =>
    requireLiveBackend(options).configResolved({ env });

  it('only applies to builds, and is silent unless VITE_API_MODE=live', () => {
    expect(requireLiveBackend().apply).toBe('build');
    expect(() => run({})).not.toThrow(); // ordinary local build
    expect(() => run({ VITE_API_MODE: 'mock' })).not.toThrow(); // QA build
  });

  it('fails the build when VITE_API_MODE=live and a variable is missing', () => {
    expect(() => run({ VITE_API_MODE: 'live' })).toThrow(/VITE_SUPABASE_URL is missing/);
    expect(() => run({ VITE_API_MODE: 'live', VITE_SUPABASE_URL: good.VITE_SUPABASE_URL })).toThrow(
      /VITE_SUPABASE_ANON_KEY is missing/,
    );
  });

  it('lets a correctly configured live build through', () => {
    expect(() => run(good)).not.toThrow();
  });

  it('can be forced to check every build', () => {
    expect(() => run({}, { force: true })).toThrow(/cannot go ahead/);
  });
});

describe('check-live-config command', () => {
  const cli = (env: Record<string, string>, args: string[] = []) => {
    const clean = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith('VITE_')),
    );
    return spawnSync(process.execPath, [SCRIPT, ...args], {
      env: { ...clean, ...env },
      encoding: 'utf8',
    });
  };

  it('exits 0 for a good configuration and 1 with the problems for a bad one', () => {
    const ok = cli(good);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('looks good');
    const bad = cli({});
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('VITE_SUPABASE_URL is missing');
    expect(bad.stdout + bad.stderr).not.toContain(good.VITE_SUPABASE_ANON_KEY);
  });

  it('reads an env file, and the process environment wins over it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'live-config-'));
    const file = join(dir, '.env.production');
    writeFileSync(
      file,
      `VITE_SUPABASE_URL=${good.VITE_SUPABASE_URL}\nVITE_SUPABASE_ANON_KEY=sb_publishable_zzz\n`,
    );
    expect(cli({}, ['--file', file]).status).toBe(0);
    const overridden = cli({ VITE_SUPABASE_URL: 'http://insecure.example' }, ['--file', file]);
    expect(overridden.status).toBe(1);
    expect(overridden.stderr).toContain('https://');
  });

  it('exits 2 for usage errors', () => {
    expect(cli({}, ['--nope']).status).toBe(2);
    expect(cli({}, ['--file', '/does/not/exist']).status).toBe(2);
  });
});
