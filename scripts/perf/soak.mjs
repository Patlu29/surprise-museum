// node scripts/perf/soak.mjs --port 4180 --museum 20 --profile phone --cpu 4 --gpu m4 --quality low --minutes 15 --out file
import { launch, newSession, startAndWait, metrics, r1, snap, S, browserRssMb } from './lib.mjs';
import fs from 'node:fs';
const a = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, v, i, arr) =>
        v.startsWith('--')
          ? [...acc, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]
          : acc,
      [],
    ),
);
const port = a.port ?? 4180,
  museum = a.museum ?? 20,
  minutes = Number(a.minutes ?? 15);
const origin = `http://localhost:${port}`;
const url = fs
  .readFileSync(`${S}/state${museum}.url`, 'utf8')
  .replace(/^http:\/\/localhost:\d+/, origin);
const browser = await launch(a.gpu ?? 'm4');
const s = await newSession(browser, {
  profile: a.profile ?? 'phone',
  quality: a.quality,
  cpu: Number(a.cpu ?? 1),
  net: null,
  photoRoute: true,
  origin,
  state: `${S}/state${museum}.json`,
});
const { page, cdp } = s;
let crashed = false;
page.on('crash', () => {
  crashed = true;
});
await page.goto(url);
await startAndWait(page);
await cdp.send('HeapProfiler.enable');
const layout = await page.evaluate(() => window.__surpriseMuseum.layout());
const t0 = Date.now();
const rows = [];
let stop = false;
const sample = async () => {
  await cdp.send('HeapProfiler.collectGarbage');
  const m = await metrics(cdp);
  const x = await snap(page);
  const rss = browserRssMb(browser.__tag);
  const fr = await page.evaluate(() => {
    const r = window.__renders;
    const n = r.length;
    const recent = r.slice(-120);
    const d = recent.slice(1).map((t, i) => t - recent[i]);
    window.__renders = recent;
    return { n, recentMean: d.length ? d.reduce((p, q) => p + q, 0) / d.length : 0 };
  });
  rows.push({
    t: Math.round((Date.now() - t0) / 1000),
    heapMB: r1(m.JSHeapUsedSize / 1048576),
    nodes: m.Nodes,
    listeners: m.JSEventListeners,
    rssTotal: r1(rss.totalMb),
    rssRenderer: r1(rss.rendererMb),
    rssGpu: r1(rss.gpuMb),
    textures: x.render.textures,
    geometries: x.render.geometries,
    programs: x.render.programs,
    photoTexMB: r1(x.render.photoTextureBytes / 1048576),
    calls: x.render.calls,
    frameMs: r1(fr.recentMean),
    crashed,
  });
  process.stdout.write(JSON.stringify(rows.at(-1)) + '\n');
};
const sampler = (async () => {
  while (!stop) {
    await sample().catch((e) => console.log('sample error', e.message));
    await new Promise((r) => setTimeout(r, 15000));
  }
})();
let loops = 0;
while ((Date.now() - t0) / 60000 < minutes && !crashed) {
  const order = loops % 2 === 0 ? layout.slots : [...layout.slots].reverse();
  for (const slot of order) {
    if ((Date.now() - t0) / 60000 >= minutes) break;
    await page.evaluate(
      ([x, z]) => window.__surpriseMuseum.walkVisitorTo(x, z, 60000),
      [slot.standingSpot.x, slot.standingSpot.z],
    );
    await page.waitForTimeout(1700);
  }
  if (loops % 2 === 1) {
    await page.evaluate(() => window.__surpriseMuseum.standAtFinale());
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__surpriseMuseum.replay());
  }
  loops++;
}
stop = true;
await sampler;
await sample();
const first = rows.filter((r) => r.t >= 90 && r.t <= 180),
  last = rows.filter((r) => r.t >= rows.at(-1).t - 90);
const mean = (arr, k) => arr.reduce((p, q) => p + q[k], 0) / Math.max(1, arr.length);
// linear regression slope per minute after 2 minutes
const slope = (k) => {
  const pts = rows.filter((r) => r.t >= 120);
  const n = pts.length;
  if (n < 3) return null;
  const mx = mean(pts, 't'),
    my = mean(pts, k);
  const num = pts.reduce((p, q) => p + (q.t - mx) * (q[k] - my), 0),
    den = pts.reduce((p, q) => p + (q.t - mx) ** 2, 0);
  return (num / den) * 60;
};
const summary = {
  args: a,
  minutes,
  loops,
  crashed,
  samples: rows.length,
  heapMB: {
    early: r1(mean(first, 'heapMB')),
    late: r1(mean(last, 'heapMB')),
    slopePerMin: r1(slope('heapMB')),
  },
  rssTotalMB: {
    early: r1(mean(first, 'rssTotal')),
    late: r1(mean(last, 'rssTotal')),
    slopePerMin: r1(slope('rssTotal')),
  },
  rssRendererMB: {
    early: r1(mean(first, 'rssRenderer')),
    late: r1(mean(last, 'rssRenderer')),
    slopePerMin: r1(slope('rssRenderer')),
  },
  rssGpuMB: {
    early: r1(mean(first, 'rssGpu')),
    late: r1(mean(last, 'rssGpu')),
    slopePerMin: r1(slope('rssGpu')),
  },
  textures: [rows[0].textures, rows.at(-1).textures, Math.max(...rows.map((r) => r.textures))],
  geometries: [
    rows[0].geometries,
    rows.at(-1).geometries,
    Math.max(...rows.map((r) => r.geometries)),
  ],
  programs: [rows[0].programs, rows.at(-1).programs],
  photoTexMB: rows.at(-1).photoTexMB,
  nodes: [rows[0].nodes, rows.at(-1).nodes],
  listeners: [rows[0].listeners, rows.at(-1).listeners],
  logs: [...new Set(s.logs)].filter((l) => !/THREE.Clock|ReadPixels/.test(l)).slice(0, 5),
};
console.log('SUMMARY ' + JSON.stringify(summary));
if (a.out) fs.writeFileSync(a.out, JSON.stringify({ summary, rows }, null, 1));
await s.ctx.close();
await browser.close();
