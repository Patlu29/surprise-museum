#!/usr/bin/env node
/**
 * Fails when a built JavaScript chunk is over its size budget.
 *
 * Budgets mirror vite.config.ts (chunkSizeBudgets): 1000 kB for every chunk, and 3500 kB for the
 * lazily loaded HEIC decoder (ADR 0004). A kB here is 1000 bytes. The three.js chunk (the
 * react-three-fiber and three core bundle, about 962 kB on 02/11/2026) is the one that matters:
 * Vite names it after one of its modules (it was `NameLabel-<hash>.js`), so this script does not
 * match by name, it checks every chunk and reports the largest.
 *
 * Vite itself only warns when a chunk is over budget. This is the part that fails the build.
 *
 * Usage: node .github/scripts/check-bundle-size.mjs [dist-directory]   (default: dist)
 */
import { readdirSync, statSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_LIMIT_KB = 1000;
const LIMITS = [{ label: 'HEIC decoder (ADR 0004)', pattern: /^heic-to-.*\.js$/, limitKb: 3500 }];

const dist = process.argv[2] ?? 'dist';
const assets = join(dist, 'assets');

let files;
try {
  files = readdirSync(assets).filter((name) => name.endsWith('.js'));
} catch {
  console.error(`No ${assets} directory. Run "npm run build" first.`);
  process.exit(2);
}
if (files.length === 0) {
  console.error(`No JavaScript chunks found in ${assets}.`);
  process.exit(2);
}

const rows = files
  .map((name) => {
    const sizeKb = statSync(join(assets, name)).size / 1000;
    const special = LIMITS.find((entry) => entry.pattern.test(name));
    return {
      name,
      sizeKb,
      limitKb: special?.limitKb ?? DEFAULT_LIMIT_KB,
      label: special?.label ?? 'default',
    };
  })
  .sort((a, b) => b.sizeKb - a.sizeKb);

const over = rows.filter((row) => row.sizeKb > row.limitKb);
const lines = ['| Chunk | Size (kB) | Budget (kB) | Status |', '|---|---:|---:|---|'];
for (const row of rows.slice(0, 6)) {
  const status = row.sizeKb > row.limitKb ? 'OVER BUDGET' : 'ok';
  lines.push(`| ${row.name} | ${row.sizeKb.toFixed(1)} | ${row.limitKb} | ${status} |`);
}
const table = lines.join('\n');
console.log(table);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Bundle size (largest chunks)\n\n${table}\n`);
}

if (over.length > 0) {
  for (const row of over) {
    console.error(
      `::error title=Bundle over budget::${row.name} is ${row.sizeKb.toFixed(1)} kB, over its ${row.limitKb} kB budget (${row.label}). See docs/performance.md (sections 3 and 6).`,
    );
  }
  process.exit(1);
}
const biggest = rows.find((row) => row.limitKb === DEFAULT_LIMIT_KB);
console.log(
  `All chunks are within budget. Largest regular chunk: ${biggest?.name} at ${biggest?.sizeKb.toFixed(1)} of ${DEFAULT_LIMIT_KB} kB.`,
);
