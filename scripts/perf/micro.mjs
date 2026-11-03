// node scripts/perf/micro.mjs --port P --museum N --mode default|zoom|ceiling [--quality low|high] [--profile laptop|phone] [--secs 20] [--out file]
// Steady-state frame cost with the Visitor standing still: "zoom" (camera in close, for shader A/B builds) or "ceiling" (default view, mid-fade, camera above the ceiling).
import { launch, newSession, startAndWait, metrics, pct, r1, r2, snap, S } from './lib.mjs';
import fs from 'node:fs';
const a = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc),
      [],
    ),
);
const port = a.port,
  museum = a.museum ?? 20,
  secs = Number(a.secs ?? 20);
const origin = `http://localhost:${port}`;
const url = fs
  .readFileSync(`${S}/state${museum}.url`, 'utf8')
  .replace(/^http:\/\/localhost:\d+/, origin);
const browser = await launch(a.gpu ?? 'sw');
const s = await newSession(browser, {
  profile: a.profile ?? 'laptop',
  quality: a.quality ?? 'low',
  cpu: 1,
  net: null,
  photoRoute: true,
  origin,
  state: `${S}/state${museum}.json`,
});
const { page, cdp } = s;
await page.goto(url);
await startAndWait(page);
await page.waitForFunction(() => window.__surpriseMuseum.snapshot().guide.opacity >= 1, null, {
  timeout: 30000,
});
await page.evaluate(() => window.__surpriseMuseum.teleportVisitor(0, -3.5, Math.PI));
await page.waitForTimeout(3000);
const measure = async (label) => {
  await page.evaluate(() => {
    window.__renders.length = 0;
  });
  const m0 = await metrics(cdp);
  const t0 = Date.now();
  await page.waitForTimeout(secs * 1000);
  const m1 = await metrics(cdp);
  const dur = (Date.now() - t0) / 1000;
  const r = await page.evaluate(() => window.__renders.slice());
  const dts = r.slice(1).map((t, i) => t - r[i]);
  const sn = await snap(page);
  return {
    label,
    fps: r1(r.length / dur),
    meanMs: r2(dts.reduce((x, y) => x + y, 0) / dts.length),
    p50: r1(pct(dts, 50)),
    p95: r1(pct(dts, 95)),
    taskMs: r2(((m1.TaskDuration - m0.TaskDuration) * 1000) / r.length),
    scriptMs: r2(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / r.length),
    calls: sn.render.calls,
    tris: sn.render.triangles,
    camY: r2(sn.camera.y),
    ceil: r2(sn.ceilingOpacity),
  };
};
const out = [];
if (a.mode === 'zoom') {
  await page
    .locator('canvas')
    .first()
    .focus()
    .catch(() => {});
  for (let i = 0; i < 10; i++) await page.keyboard.press('+');
  await page.waitForTimeout(1500);
  out.push(await measure('zoomed in'));
} else if (a.mode === 'default') {
  out.push(await measure('default view'));
} else {
  out.push(await measure('default view (ceiling opaque)'));
  const tap = async () => {
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(12);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(120);
  };
  for (let i = 0; i < 80; i++) {
    const o = (await snap(page)).ceilingOpacity;
    if (o < 0.7) break;
    await tap();
  }
  await page.waitForTimeout(800);
  out.push(await measure('fading (ceiling opacity about 0.5)'));
  for (let i = 0; i < 80; i++) {
    const o = (await snap(page)).ceilingOpacity;
    if (o <= 0.001) break;
    await tap();
  }
  await page.waitForTimeout(1200);
  out.push(await measure('top view (ceiling hidden)'));
}
console.log(JSON.stringify({ args: a, out }));
if (a.out) fs.appendFileSync(a.out, JSON.stringify({ args: a, out }) + '\n');
await s.ctx.close();
await browser.close();
