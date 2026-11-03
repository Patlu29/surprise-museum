#!/usr/bin/env node
/**
 * Fails when a built JavaScript chunk is over its size budget.
 *
 * Budgets mirror vite.config.ts (chunkSizeBudgets): 1000 kB for every chunk, and 3500 kB for the
 * lazily loaded HEIC decoder (ADR 0004). A kB here is 1000 bytes.
 *
 * The three.js code is two named chunks (vite.config.ts, THREE_CHUNK_GROUPS), so the guards no
 * longer depend on which module Vite names a shared chunk after (it was `NameLabel-<hash>.js`,
 * then `finale-<hash>.js`):
 *   - `three-<hash>.js` (three, react-three-fiber, drei): the team's 985 kB guard.
 *   - `three-` plus `scene-shared-<hash>.js` (our avatar kit, look materials and shaders that the
 *     visit scene and the builder preview share): together under 1000 kB, NFR-27's limit for the
 *     three.js chunk as it was before the split, so splitting code out cannot hide growth.
 * If either chunk is missing the script fails, so a rename cannot silently turn the guard off.
 *
 * Vite itself only warns when a chunk is over budget. This is the part that fails the build.
 *
 * Usage: node .github/scripts/check-bundle-size.mjs [dist-directory]   (default: dist)
 */
import { readdirSync, statSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_LIMIT_KB = 1000;
const THREE_TOTAL_LIMIT_KB = 1000;
const LIMITS = [
  { label: 'HEIC decoder (ADR 0004)', pattern: /^heic-to-.*\.js$/, limitKb: 3500 },
  { label: 'three.js vendor chunk guard', pattern: /^three-.*\.js$/, limitKb: 985 },
];

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

const THREE_RE = /^three-.*\.js$/;
const SHARED_RE = /^scene-shared-.*\.js$/;

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

// Every match counts (not just the first), so an extra three-* chunk cannot slip out of the total.
const threeRows = rows.filter((row) => THREE_RE.test(row.name));
const sharedRows = rows.filter((row) => SHARED_RE.test(row.name));
const threeTotalKb = [...threeRows, ...sharedRows].reduce((sum, row) => sum + row.sizeKb, 0);
const threeTotalOver = threeTotalKb > THREE_TOTAL_LIMIT_KB;

// The table is printed before any failure, so a failing run still shows the numbers.
// It lists the six largest chunks plus the 3D chunks, then the combined row.
const shown = rows.filter(
  (row, index) => index < 6 || THREE_RE.test(row.name) || SHARED_RE.test(row.name),
);
const lines = ['| Chunk | Size (kB) | Budget (kB) | Status |', '|---|---:|---:|---|'];
for (const row of shown) {
  lines.push(
    `| ${row.name} | ${row.sizeKb.toFixed(1)} | ${row.limitKb} | ${row.sizeKb > row.limitKb ? 'OVER BUDGET' : 'ok'} |`,
  );
}
lines.push(
  `| three + scene-shared (3D total) | ${threeTotalKb.toFixed(1)} | ${THREE_TOTAL_LIMIT_KB} | ${threeTotalOver ? 'OVER BUDGET' : 'ok'} |`,
);
const table = lines.join('\n');
console.log(table);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Bundle size (largest chunks)\n\n${table}\n`);
}

// A missing guard target is a configuration fault (exit 2), reported ahead of budget breaches.
if (threeRows.length === 0 || sharedRows.length === 0) {
  console.error(
    `::error title=Bundle guard target missing::No ${threeRows.length ? '' : 'three-*.js '}${sharedRows.length ? '' : 'scene-shared-*.js '}chunk found in ${assets}. Update THREE_CHUNK_GROUPS in vite.config.ts and this script together.`,
  );
  process.exit(2);
}

// Report every breach, then fail once, so one run shows the whole picture.
let failed = false;
for (const row of rows.filter((entry) => entry.sizeKb > entry.limitKb)) {
  failed = true;
  console.error(
    `::error title=Bundle over budget::${row.name} is ${row.sizeKb.toFixed(1)} kB, over its ${row.limitKb} kB budget (${row.label}). See docs/performance.md (sections A.3 and 6).`,
  );
}
if (threeTotalOver) {
  failed = true;
  console.error(
    `::error title=Bundle over budget::three + scene-shared is ${threeTotalKb.toFixed(1)} kB, over ${THREE_TOTAL_LIMIT_KB} kB (NFR-27). See docs/performance.md (section A.3).`,
  );
}
if (failed) {
  process.exit(1);
}

const biggest = rows.find((row) => !/^heic-to-/.test(row.name));
console.log(
  `All chunks are within budget. 3D total ${threeTotalKb.toFixed(1)} of ${THREE_TOTAL_LIMIT_KB} kB ` +
    `(${(THREE_TOTAL_LIMIT_KB - threeTotalKb).toFixed(1)} kB headroom). ` +
    `Largest chunk other than the HEIC decoder: ${biggest?.name} at ${biggest?.sizeKb.toFixed(1)} kB.`,
);
