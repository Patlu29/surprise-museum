import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
const dist = process.argv[2];
const read = (f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8');
const statics = (code) =>
  [...code.matchAll(/(?:^|[;}\n])\s*import\s*(?:[^"';]*?from\s*)?"\.\/([^"]+\.js)"/g)].map(
    (m) => m[1],
  );
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const entry = html.match(/assets\/(index-[^"]+\.js)/)[1];
const seen = new Set();
const walk = (f) => {
  if (seen.has(f)) return;
  seen.add(f);
  for (const d of statics(read(f))) walk(d);
};
walk(entry);
const visit = fs.readdirSync(path.join(dist, 'assets')).find((f) => f.startsWith('VisitScreen-'));
walk(visit);
let total = 0;
const rows = [...seen].map((f) => {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(dist, 'assets', f)), { level: 9 }).length;
  total += gz;
  return [f, gz];
});
console.log(
  rows
    .sort((a, b) => b[1] - a[1])
    .map(([f, g]) => `${String(g).padStart(7)} ${f}`)
    .join('\n'),
);
console.log('TOTAL gz (level 9)', (total / 1000).toFixed(1), 'kB');
