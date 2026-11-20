import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/*
 * US-69 (NFR-32 (a) and (b)): static checks that the repository files match ADR 0022. No browser is used.
 *
 * What this proves: the endpoint contract, the SQL function and its grants, the function config and the
 * documentation say what the ADR says, and the handler's source reaches nothing that writes.
 * What it does not prove: that the function writes nothing at run time (the backend's Deno tests do, 35 pass),
 * that Supabase counts the call as activity (needs 7 or more days on a real project), or that a scheduled run
 * ever happens (the workflow file is written in phase 6; its checks below run when it exists and are skipped,
 * with that reason, until then).
 *
 * The files are read once on one project so the result is not repeated per browser.
 */
test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'static file checks run once',
);

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

/** Source with `--`, `//` and `#` line comments and block comments removed, so a comment cannot satisfy a check. */
const code = (text: string): string =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*(--|\/\/|#).*$/gm, '')
    .replace(/\s\/\/.*$/gm, '');

function filesUnder(dir: string, extension: RegExp): string[] {
  const root = join(process.cwd(), dir);
  return (readdirSync(root, { recursive: true, encoding: 'utf8' }) as string[])
    .filter((name) => extension.test(name))
    .map((name) => join(dir, name));
}

test.describe('US-69 keep-alive matches ADR 0022', () => {
  test('US-69 AC-4 (contract, ADR 0022 section 4): FUNCTION_NAMES.keepAlive, the request and response types, CONTRACT_VERSION 1 and the 7-day limits', () => {
    const contract = code(read('supabase/functions/_shared/contract.ts'));
    expect(contract).toMatch(/keepAlive:\s*'keep-alive'/);
    expect(contract).toMatch(/export type KeepAliveRequest = Record<string, never>;/);
    expect(contract).toMatch(
      /export interface KeepAliveResponse\s*\{\s*ok: true;\s*checkedAt: string;?\s*\}/,
    );
    expect(contract).toMatch(/CONTRACT_VERSION\s*=\s*1\b/);
    expect(contract).toMatch(/retentionDays:\s*7\b/);
    expect(contract).toMatch(/draftRetentionDays:\s*7\b/);
  });

  test('US-69 AC-4 (supabase/config.toml): the function is declared with verify_jwt off, as the other public functions', () => {
    const config = read('supabase/config.toml');
    expect(config).toMatch(/^\[functions\.keep-alive\]\s*\nverify_jwt = false\s*$/m);
  });

  test('US-69 AC-4 (migration, ADR 0022 section 4): keep_alive() is a stable select of now(), with a fixed search_path, executable by service_role only', () => {
    const sql = code(read('supabase/migrations/20261118000100_keep_alive.sql')).replace(
      /\s+/g,
      ' ',
    );
    expect(sql).toMatch(
      /create or replace function public\.keep_alive\(\) returns timestamptz language sql stable set search_path = ''/i,
    );
    expect(sql).toMatch(/as \$\$ select now\(\); \$\$;/i);
    expect(sql).toMatch(
      /revoke all on function public\.keep_alive\(\) from public, anon, authenticated;/i,
    );
    expect(sql).toMatch(/grant execute on function public\.keep_alive\(\) to service_role;/i);
    expect(sql, 'only service_role is granted').not.toMatch(
      /grant [^;]*? to [^;]*\b(anon|authenticated|public)\b/i,
    );
    expect(sql, 'the migration writes nothing').not.toMatch(
      /\b(insert|update|delete|truncate|alter table|create table|drop)\b/i,
    );
  });

  test('US-69 AC-4 (handler source): imports nothing from purge-expired or the rate limiter, makes no HTTP call, and only calls store.keepAlive()', () => {
    const handler = code(read('supabase/functions/keep-alive/handler.ts'));
    const index = code(read('supabase/functions/keep-alive/index.ts'));
    for (const source of [handler, index]) {
      expect(source).not.toMatch(/purge/i);
      expect(source).not.toMatch(/rate_?limit|rateLimit|ipHash|hashIp/i);
      expect(source).not.toMatch(/\bfetch\(|XMLHttpRequest|Deno\.env/);
    }
    expect(handler, 'it is not rate limited (a rate limit needs a write)').toMatch(
      /name: 'keep-alive', cors: false, requireJson: true/,
    );
    const storeCalls = [...handler.matchAll(/deps\.store\.(\w+)/g)].map((m) => m[1]);
    expect(storeCalls).toEqual(['keepAlive']);
  });

  test('US-69 (docs/api.md 10a): documents POST /functions/v1/keep-alive, the anon key only, body {} and the 200 shape', () => {
    const api = read('docs/api.md');
    const start = api.indexOf('## 10a. `keep-alive`');
    expect(start, 'section 10a exists').toBeGreaterThan(-1);
    const section = api.slice(start, api.indexOf('\n## 11.', start));
    expect(section).toContain('POST /functions/v1/keep-alive');
    expect(section).toContain('apikey: <public anon or publishable key>');
    expect(section).toMatch(/\{ "ok": true, "checkedAt": "\d{4}-\d\d-\d\dT[\d:.]+Z" \}/);
    expect(section).toMatch(/\*\*Rate limit:\*\* none/);
    expect(section).toMatch(/never calls `purge-expired`/);
    expect(section).toMatch(/\| 500 \| `server_error` \|/);
  });

  test('NFR-16: no 90-day retention figure is left in application code, the contract, api.md or the SQL', () => {
    const files = [
      ...filesUnder('src', /\.(ts|tsx)$/).filter((f) => !/\.test\.tsx?$/.test(f)),
      ...filesUnder('supabase/functions', /\.ts$/).filter((f) => !/(_test|\.test)\.ts$/.test(f)),
      ...filesUnder('supabase/migrations', /\.sql$/),
      'docs/api.md',
    ];
    const hits = files.flatMap((file) =>
      read(file)
        .split('\n')
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(
          ({ text }) =>
            /\b90[- ]?days?\b|retentionDays:\s*90|interval '90/i.test(text) ||
            // A bare 90 beside a retention word, such as "published museums after 90" (REV-8a). The
            // api.md changelog row that says the value "was 90" records the change and is not a leftover.
            (/\b90\b/.test(text) &&
              /retention|expire|publish/i.test(text) &&
              !/\(was 90\)/.test(text)),
        ),
    );
    expect(hits).toEqual([]);
  });

  const workflowPath = '.github/workflows/keep-alive.yml';
  test.describe('the scheduled workflow (US-69 AC-2, AC-4, AC-5)', () => {
    test.skip(
      !existsSync(join(process.cwd(), workflowPath)),
      'Not verified: .github/workflows/keep-alive.yml does not exist yet (devops-engineer, phase 6)',
    );

    test('US-69 AC-2: it runs on a schedule at least once every 72 hours and can be run by hand', () => {
      const workflow = read(workflowPath);
      expect(workflow).toMatch(/workflow_dispatch:/);
      const cron = /cron:\s*['"]([^'"]+)['"]/.exec(workflow);
      expect(cron, 'a cron line').not.toBeNull();
      const [minute, hour, dayOfMonth, month, dayOfWeek] = cron![1]!.split(/\s+/);
      expect(`${minute} ${hour}`).toMatch(/^\d+ \d+$/);
      // Daily means every day-of-month, month and day-of-week field is a wildcard.
      expect([dayOfMonth, month, dayOfWeek]).toEqual(['*', '*', '*']);
    });

    test('US-69 AC-4 and AC-5: calls only /functions/v1/keep-alive, fails the job on a bad answer, holds no secret and never prints the key', () => {
      const workflow = code(read(workflowPath));
      expect(workflow).toMatch(/permissions:\s*\{\}/);
      expect(workflow).toContain('/functions/v1/keep-alive');
      expect(workflow).not.toMatch(/purge-expired|\/rest\/v1|\/storage\/v1/);
      expect(workflow).not.toMatch(/secrets\./);
      expect(workflow).not.toMatch(/set -x|--verbose|\s-v\s/);
      expect(workflow, 'a non-200 fails the step').toMatch(/--fail(-with-body)?/);
      expect(workflow, 'the body is checked').toMatch(/jq -e/);
      expect(workflow).not.toMatch(/continue-on-error:\s*true/);
    });
  });
});
