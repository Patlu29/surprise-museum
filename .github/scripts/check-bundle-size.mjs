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

const threeRow = rows.find((row) => /^three-.*\.js$/.test(row.name));
const sharedRow = rows.find((row) => /^scene-shared-.*\.js$/.test(row.name));
if (!threeRow || !sharedRow) {
  console.error(
    `::error title=Bundle guard target missing::No ${threeRow ? '' : 'three-*.js '}${sharedRow ? '' : 'scene-shared-*.js '}chunk found. Update THREE_CHUNK_GROUPS in vite.config.ts and this script together.`,
  );
  process.exit(2);
}
const threeTotalKb = threeRow.sizeKb + sharedRow.sizeKb;
const lines = ['| Chunk | Size (kB) | Budget (kB) | Status |', '|---|---:|---:|---|'];
for (const row of rows.slice(0, 6)) {
  const status = row.sizeKb > row.limitKb ? 'OVER BUDGET' : 'ok';
  lines.push(`| ${row.name} | ${row.sizeKb.toFixed(1)} | ${row.limitKb} | ${status} |`);
}
lines.push(
  `| three + scene-shared (3D total) | ${threeTotalKb.toFixed(1)} | ${THREE_TOTAL_LIMIT_KB} | ${threeTotalKb > THREE_TOTAL_LIMIT_KB ? 'OVER BUDGET' : 'ok'} |`,
);
const table = lines.join('\n');
console.log(table);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Bundle size (largest chunks)\n\n${table}\n`);
}

if (threeTotalKb > THREE_TOTAL_LIMIT_KB) {
  console.error(
    `::error title=Bundle over budget::three + scene-shared is ${threeTotalKb.toFixed(1)} kB, over ${THREE_TOTAL_LIMIT_KB} kB (NFR-27). See docs/performance.md (sections 3 and 6).`,
  );
  process.exit(1);
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
