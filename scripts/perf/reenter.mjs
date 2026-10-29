// Leave and re-enter the museum repeatedly without reloading; checks that the scene releases memory.
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
  cycles = Number(a.cycles ?? 6);
const origin = `http://localhost:${port}`;
const url = fs.readFileSync(`${S}/state20.url`, 'utf8').replace(/^http:\/\/localhost:\d+/, origin);
const browser = await launch(a.gpu ?? 'm4');
const s = await newSession(browser, {
  profile: 'laptop',
  quality: a.quality ?? 'high',
  cpu: 1,
  net: null,
  photoRoute: true,
  origin,
  state: `${S}/state20.json`,
});
const { page, cdp } = s;
await cdp.send('HeapProfiler.enable');
await page.goto(url);
const out = [];
for (let i = 0; i < cycles; i++) {
  await startAndWait(page);
  const layout = await page.evaluate(() => window.__surpriseMuseum.layout());
  // visit the last picture so every photo has loaded (nearest-first loading)
  await page.evaluate(() => window.__surpriseMuseum.standAtPhoto(19));
  await page.waitForFunction(
    () =>
      Object.values(window.__surpriseMuseum.snapshot().photoStatus).every((x) => x === 'loaded'),
    null,
    { timeout: 60000, polling: 200 },
  );
  await page.waitForTimeout(1500);
  const before = await snap(page);
  await page.goto(`${origin}/surprise-museum/#/`);
  await page.waitForTimeout(1500);
  await cdp.send('HeapProfiler.collectGarbage');
  const m = await metrics(cdp);
  const rss = browserRssMb(browser.__tag);
  out.push({
    cycle: i + 1,
    texturesInScene: before.render.textures,
    geometries: before.render.geometries,
    photoTexMB: r1(before.render.photoTextureBytes / 1048576),
    heapMBAfterLeave: r1(m.JSHeapUsedSize / 1048576),
    nodes: m.Nodes,
    rssTotal: r1(rss.totalMb),
    rssRenderer: r1(rss.rendererMb),
    rssGpu: r1(rss.gpuMb),
  });
  console.log(JSON.stringify(out.at(-1)));
  await page.goto(url);
  await page.waitForTimeout(500);
}
console.log(
  'LOGS',
  JSON.stringify([...new Set(s.logs)].filter((l) => !/THREE.Clock|ReadPixels/.test(l)).slice(0, 5)),
);
if (a.out) fs.writeFileSync(a.out, JSON.stringify(out, null, 1));
await s.ctx.close();
await browser.close();
