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
 * ever happens (the real red run, the run history and the dashboards need the deployed project). A missing
 * keep-alive.yml fails the first workflow test (REV-8 (b)); it no longer skips.
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

  // REV-8 (b): the workflow is a release artefact (phase 6). A deleted or renamed file must fail, not skip.
  test('US-69 AC-2: .github/workflows/keep-alive.yml exists', () => {
    expect(
      existsSync(join(process.cwd(), workflowPath)),
      `${workflowPath} is missing: without it nothing keeps the Supabase project awake`,
    ).toBe(true);
  });

  test.describe('the scheduled workflow (US-69 AC-2, AC-4, AC-5; ADR 0022 sections 5 and 6)', () => {
    /** The text of the `run:` block, which GitHub hands to the shell. */
    const runScript = (workflow: string): string => {
      const start = workflow.search(/^\s*run:\s*\|/m);
      expect(start, 'a run: | script').toBeGreaterThan(-1);
      return workflow.slice(start);
    };

    test('US-69 AC-2: runs daily on a schedule (at least once every 72 hours) and can be run by hand', () => {
      const workflow = code(read(workflowPath));
      expect(workflow).toMatch(/^\s*workflow_dispatch:/m);
      const crons = [...workflow.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      expect(crons, 'exactly one cron line, ADR 0022 section 5').toEqual(['37 20 * * *']);
      // Daily: the day-of-month, month and day-of-week fields are all wildcards, so the gap is 24 hours.
      expect(crons[0]?.split(/\s+/).slice(2)).toEqual(['*', '*', '*']);
    });

    test('US-69 AC-2 (ADR 0022 section 5): the job is skipped until VITE_SUPABASE_URL is set, and has no repository access', () => {
      const workflow = code(read(workflowPath));
      expect(workflow).toMatch(
        /^\s{4}if:\s*(\$\{\{\s*)?vars\.VITE_SUPABASE_URL != ''(\s*\}\})?\s*$/m,
      );
      expect(workflow).toMatch(/^permissions:\s*\{\}\s*$/m);
      expect(workflow, 'no write permission anywhere').not.toMatch(/:\s*write\b/);
      expect(
        workflow,
        'no checkout and no third-party action: nothing needs the repository',
      ).not.toMatch(/^\s*-?\s*uses:/m);
      expect(workflow).toMatch(/timeout-minutes:\s*5\b/);
    });

    test('US-69 AC-4: values reach the script through env:, never by ${{ }} inside run:', () => {
      const workflow = code(read(workflowPath));
      expect(workflow).toMatch(/^\s+SUPABASE_URL:\s*\$\{\{\s*vars\.VITE_SUPABASE_URL\s*\}\}\s*$/m);
      expect(workflow).toMatch(
        /^\s+SUPABASE_ANON_KEY:\s*\$\{\{\s*vars\.VITE_SUPABASE_ANON_KEY\s*\}\}\s*$/m,
      );
      expect(runScript(workflow), 'no expression inside the script').not.toContain('${{');
      // Every expression in the file is one of the two env lines or the job condition.
      const expressionLines = workflow.split('\n').filter((line) => line.includes('${{'));
      for (const line of expressionLines) {
        expect(line).toMatch(
          /^\s+(SUPABASE_URL: \$\{\{ vars\.VITE_SUPABASE_URL \}\}|SUPABASE_ANON_KEY: \$\{\{ vars\.VITE_SUPABASE_ANON_KEY \}\}|if: \$\{\{ vars\.VITE_SUPABASE_URL != '' \}\})\s*$/,
        );
      }
    });

    test('US-69 AC-4: the key is masked before the call, no secret is stored or literal, nothing is printed verbosely', () => {
      const raw = read(workflowPath);
      const workflow = code(raw);
      const mask = workflow.indexOf('::add-mask::${SUPABASE_ANON_KEY}');
      const call = workflow.indexOf('curl ');
      expect(mask, 'the key is masked').toBeGreaterThan(-1);
      expect(call, 'a curl call').toBeGreaterThan(-1);
      expect(mask, 'masked before the first use').toBeLessThan(call);
      expect(workflow).not.toMatch(/secrets\./);
      expect(raw, 'no JWT or Supabase key literal, even in a comment').not.toMatch(
        /eyJ[\w-]{10,}|sb_(publishable|secret)_|service_role/i,
      );
      expect(workflow).not.toMatch(
        /set -\w*x|--verbose|\scurl\b[^\n]*\s-v\b|\s-v\s|--trace|\benv\b\s*$|printenv/m,
      );
      // The only echo that expands the key's value is the add-mask line (an error message may name the variable).
      const echoesKey = workflow
        .split('\n')
        .filter((line) => /\becho\b/.test(line) && /\$\{?SUPABASE_ANON_KEY/.test(line))
        .map((line) => line.trim());
      expect(echoesKey).toEqual(['echo "::add-mask::${SUPABASE_ANON_KEY}"']);
    });

    test('US-69 AC-4: calls only POST /functions/v1/keep-alive, never purge-expired, and writes nothing', () => {
      const workflow = code(read(workflowPath));
      expect(workflow).toContain('/functions/v1/keep-alive');
      expect(workflow).not.toMatch(/purge/i);
      expect(workflow).not.toMatch(
        /\/rest\/v1|\/storage\/v1|\/auth\/v1|\/functions\/v1\/(?!keep-alive)/,
      );
      expect([...workflow.matchAll(/\bcurl\b/g)], 'one curl call').toHaveLength(1);
      expect([...workflow.matchAll(/-X\s+(\w+)/g)].map((m) => m[1])).toEqual(['POST']);
      expect(workflow).toMatch(/-d\s+'\{\}'/);
      expect(workflow).not.toMatch(
        /\bgit\s+(push|commit)|gh\s+api|supabase\s+(db|functions|storage)/,
      );
    });

    test('US-69 AC-5 (ADR 0022 section 6): a non-200, a bad body or a timeout fails the step, so the run is red', () => {
      const workflow = code(read(workflowPath));
      const script = runScript(workflow);
      expect(script, 'stops on the first failing command').toMatch(/^\s*set -eu\b/m);
      expect(script, 'a 4xx or 5xx fails curl').toContain('--fail-with-body');
      expect(script, 'a hung call times out').toMatch(/--max-time\s+\d+/);
      expect(script, 'the body must be ok and a string checkedAt').toContain(
        'jq -e \'.ok == true and (.checkedAt | type == "string")\'',
      );
      // The jq check is in an `if !` that exits 1, so a bad body cannot fall through to the success lines.
      expect(script).toMatch(/if ! jq -e [^\n]+\n\s+echo "::error[^\n]+\n\s+exit 1\n\s+fi/);
      expect(workflow, 'a failure must not be swallowed').not.toMatch(
        /continue-on-error:\s*true|\|\|\s*(true|:)\b|set \+e|if:\s*(always|failure|success)\(\)/,
      );
      expect(script, 'the URL must be https').toMatch(/https:\/\/\*\)/);
      expect(script, 'a missing key exits non-zero').toMatch(
        /-z "\$\{SUPABASE_ANON_KEY:-\}"[\s\S]*?exit 1/,
      );
    });
  });
});
