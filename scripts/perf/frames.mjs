// node scripts/perf/frames.mjs --port 4180 --museum 20 --profile phone --cpu 4 --gpu m4|sw --quality low|high [--seconds 60] [--live] [--out file]
import { launch, newSession, startAndWait, metrics, pct, r1, r2, snap, S } from './lib.mjs';
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
  seconds = Number(a.seconds ?? 60);
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
  photoRoute: !!a.live,
  origin,
  state: `${S}/state${museum}.json`,
});
const { page, cdp } = s;
await page.goto(url);
await startAndWait(page);
const layout = await page.evaluate(() => window.__surpriseMuseum.layout());
const tier = (await snap(page)).quality;
await page.evaluate(() => {
  window.__renders.length = 0;
});
const m0 = await metrics(cdp);
const t0 = Date.now();
const samples = [];
let presentations = new Set();
let stop = false;
const sampler = (async () => {
  while (!stop) {
    const x = await snap(page).catch(() => null);
    if (x) {
      samples.push({ t: (Date.now() - t0) / 1000, ...x.render });
      if (x.guide.presentation.startsWith('photo:')) presentations.add(x.guide.presentation);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
})();
// Walk the route, lingering at each picture long enough for the Guide to present.
outer: for (;;) {
  for (const slot of layout.slots) {
    if ((Date.now() - t0) / 1000 > seconds) break outer;
    await page.evaluate(
      ([x, z]) => window.__surpriseMuseum.walkVisitorTo(x, z, 60000),
      [slot.standingSpot.x, slot.standingSpot.z],
    );
    await page.waitForTimeout(1700);
  }
  break;
}
// If the walk finished early, keep going back to the first picture.
while ((Date.now() - t0) / 1000 < seconds) {
  for (const slot of [...layout.slots].reverse()) {
    if ((Date.now() - t0) / 1000 > seconds) break;
    await page.evaluate(
      ([x, z]) => window.__surpriseMuseum.walkVisitorTo(x, z, 60000),
      [slot.standingSpot.x, slot.standingSpot.z],
    );
    await page.waitForTimeout(1700);
  }
}
stop = true;
await sampler;
const m1 = await metrics(cdp);
const dur = (Date.now() - t0) / 1000;
const renders = await page.evaluate(() => window.__renders.slice());
const dts = renders.slice(1).map((t, i) => t - renders[i]);
const frames = renders.length;
const final = await snap(page);
const rss = (await import('./lib.mjs')).browserRssMb(browser.__tag);
const med = (k) => {
  const v = samples.map((x) => x[k]).sort((p, q) => p - q);
  return v[Math.floor(v.length / 2)];
};
const mx = (k) => Math.max(...samples.map((x) => x[k]));
const out = {
  args: a,
  tier,
  viewport: s.opts.profile,
  durationS: r1(dur),
  frames,
  fps: r1(frames / dur),
  frameMs: {
    p50: r1(pct(dts, 50)),
    p95: r1(pct(dts, 95)),
    p99: r1(pct(dts, 99)),
    max: r1(Math.max(...dts)),
    over20: r1((100 * dts.filter((d) => d > 20).length) / dts.length),
    over36: r1((100 * dts.filter((d) => d > 36).length) / dts.length),
    over50: r1((100 * dts.filter((d) => d > 50).length) / dts.length),
    over17: r1((100 * dts.filter((d) => d > 16.9).length) / dts.length),
  },
  mainThreadMsPerFrame: {
    task: r2(((m1.TaskDuration - m0.TaskDuration) * 1000) / frames),
    script: r2(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / frames),
    layout: r2(((m1.LayoutDuration - m0.LayoutDuration) * 1000) / frames),
    style: r2(((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000) / frames),
    busyPct: r1((100 * (m1.TaskDuration - m0.TaskDuration)) / dur),
  },
  render: {
    callsMed: med('calls'),
    callsMax: mx('calls'),
    trisMed: med('triangles'),
    trisMax: mx('triangles'),
    textures: final.render.textures,
    geometries: final.render.geometries,
    programs: final.render.programs,
    photoTextures: final.render.photoTextures,
    photoTextureMB: r1(final.render.photoTextureBytes / 1048576),
  },
  presentationsSeen: presentations.size,
  heapMB: r1(m1.JSHeapUsedSize / 1048576),
  rssMB: { total: r1(rss.totalMb), renderer: r1(rss.rendererMb), gpu: r1(rss.gpuMb) },
  logs: [...new Set(s.logs)].filter((l) => !/THREE.Clock/.test(l)).slice(0, 5),
};
console.log(JSON.stringify(out));
if (a.out) fs.appendFileSync(a.out, JSON.stringify(out) + '\n');
await s.ctx.close();
await browser.close();
