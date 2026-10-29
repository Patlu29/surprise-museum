// node scripts/perf/load.mjs --port 4180 --museum 5 --profile phone --cpu 4 --net 4g --gpu m4|sw --runs 3 [--quality low|high] [--live]
import { launch, newSession, S, r1 } from './lib.mjs';
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
  museum = a.museum ?? 5,
  runs = Number(a.runs ?? 3);
const origin = `http://localhost:${port}`;
const url = fs
  .readFileSync(`${S}/state${museum}.url`, 'utf8')
  .replace(/^http:\/\/localhost:\d+/, origin);
const browser = await launch(a.gpu ?? 'm4');
const results = [];
for (let i = 0; i < runs; i++) {
  const s = await newSession(browser, {
    profile: a.profile ?? 'phone',
    quality: a.quality,
    cpu: Number(a.cpu ?? 1),
    net: a.net,
    photoRoute: !!a.live,
    origin,
    state: `${S}/state${museum}.json`,
  });
  const { page } = s;
  await page.goto(url, { waitUntil: 'commit' });
  await page.locator('.welcome__start').waitFor({ timeout: 90000 });
  const welcomeMs = await page.evaluate(() => window.__welcomeAt);
  await page
    .locator('canvas[data-scene-ready="true"]')
    .waitFor({ state: 'attached', timeout: 90000 });
  const readyMs = await page.evaluate(() => window.__readyAt);
  await page.waitForFunction(
    () => {
      const h = window.__surpriseMuseum;
      if (!h) return false;
      const st = Object.values(h.snapshot().photoStatus);
      return st[0] === 'loaded';
    },
    null,
    { timeout: 90000, polling: 100 },
  );
  const firstPhotoMs = await page.evaluate(() => performance.now());
  await page
    .waitForFunction(
      () =>
        Object.values(window.__surpriseMuseum.snapshot().photoStatus).every((x) => x === 'loaded'),
      null,
      { timeout: 120000, polling: 200 },
    )
    .catch(() => {});
  const allPhotosMs = await page.evaluate(() => performance.now());
  const res = await page.evaluate((welcomeMs) => {
    const es = performance.getEntriesByType('resource').filter((e) => !e.name.includes('__photo'));
    const kind = (n) =>
      /\.js(\?|$)/.test(n) ? 'js' : /\.css/.test(n) ? 'css' : /\.woff2/.test(n) ? 'font' : 'other';
    const sum = (arr) => arr.reduce((t, e) => t + e.encodedBodySize, 0);
    const before = es.filter((e) => e.responseEnd <= welcomeMs);
    return {
      jsBeforeWelcome: sum(before.filter((e) => kind(e.name) === 'js')),
      allBeforeWelcome: sum(before) + 0,
      beforeFiles: before
        .filter((e) => kind(e.name) === 'js')
        .map((e) => `${e.name.split('/').pop()}:${e.encodedBodySize}`),
      jsTotal: sum(es.filter((e) => kind(e.name) === 'js')),
      cssTotal: sum(es.filter((e) => kind(e.name) === 'css')),
      fontTotal: sum(es.filter((e) => kind(e.name) === 'font')),
      total: sum(es),
      requests: es.length,
      jsFiles: es
        .filter((e) => kind(e.name) === 'js')
        .map((e) => `${e.name.split('/').pop()}:${e.encodedBodySize}@${Math.round(e.responseEnd)}`),
    };
  }, welcomeMs);
  results.push({
    welcomeMs,
    readyMs,
    firstPhotoMs,
    allPhotosMs,
    ...res,
    photoBytes: s.photoLog.bytes,
    logs: s.logs,
  });
  await s.ctx.close();
}
await browser.close();
const med = (k) => {
  const v = results.map((r) => r[k]).sort((x, y) => x - y);
  return v[Math.floor(v.length / 2)];
};
console.log(
  JSON.stringify(
    {
      args: a,
      runs: results.map((r) => ({
        welcome: r1(r.welcomeMs),
        ready: r1(r.readyMs),
        firstPhoto: r1(r.firstPhotoMs),
        allPhotos: r1(r.allPhotosMs),
      })),
      median: {
        welcome: r1(med('welcomeMs')),
        ready: r1(med('readyMs')),
        firstPhoto: r1(med('firstPhotoMs')),
        allPhotos: r1(med('allPhotosMs')),
        jsBeforeWelcomeKB: r1(med('jsBeforeWelcome') / 1000),
        jsTotalKB: r1(med('jsTotal') / 1000),
        cssKB: r1(med('cssTotal') / 1000),
        fontKB: r1(med('fontTotal') / 1000),
        totalKB: r1(med('total') / 1000),
        photoKB: r1(med('photoBytes') / 1000),
      },
      beforeFiles: results[0].beforeFiles,
      jsFiles: results[0].jsFiles,
      logs: [...new Set(results.flatMap((r) => r.logs))].slice(0, 6),
    },
    null,
    1,
  ),
);
