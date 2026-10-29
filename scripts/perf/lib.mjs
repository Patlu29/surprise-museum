import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
const require = createRequire(new URL('../../package.json', import.meta.url));
export const { chromium, devices } = require('playwright-core');
/** Working folder for seeded state, photos and builds. Override with PERF_DIR. */
export const S = process.env.PERF_DIR ?? path.join(os.tmpdir(), 'surprise-perf');

export const PROFILES = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
};

export async function launch(gpu) {
  const tag = `perf-${process.pid}-${Date.now()}`;
  const args = [`--perf-tag=${tag}`, '--enable-precise-memory-info', '--js-flags=--expose-gc'];
  const browser =
    gpu === 'sw'
      ? await chromium.launch({ args })
      : await chromium.launch({
          channel: 'chromium',
          args: [...args, '--use-angle=metal', '--ignore-gpu-blocklist'],
        });
  browser.__tag = tag;
  return browser;
}

/** Sum of resident memory (MB) of the browser process tree. */
export function browserRssMb(tag) {
  const out = execSync('ps -axo pid=,ppid=,rss=,command=', { maxBuffer: 1 << 26 })
    .toString()
    .split('\n');
  const rows = out
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: +m[1], ppid: +m[2], rss: +m[3], cmd: m[4] }));
  const roots = rows.filter(
    (r) => r.cmd.includes(`--perf-tag=${tag}`) && !r.cmd.includes('--type='),
  );
  const ids = new Set(roots.map((r) => r.pid));
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows)
      if (!ids.has(r.pid) && ids.has(r.ppid)) {
        ids.add(r.pid);
        grew = true;
      }
  }
  // Also include any process carrying the tag (children sometimes inherit it)
  for (const r of rows) if (r.cmd.includes(`--perf-tag=${tag}`)) ids.add(r.pid);
  let total = 0,
    renderer = 0,
    gpu = 0,
    browserProc = 0;
  for (const r of rows)
    if (ids.has(r.pid)) {
      total += r.rss;
      if (r.cmd.includes('--type=renderer')) renderer += r.rss;
      else if (r.cmd.includes('--type=gpu-process')) gpu += r.rss;
      else if (!r.cmd.includes('--type=')) browserProc += r.rss;
    }
  return {
    totalMb: total / 1024,
    rendererMb: renderer / 1024,
    gpuMb: gpu / 1024,
    browserMb: browserProc / 1024,
  };
}

/** Writes a copy of the storage state with the origin rewritten for another port. */
export function stateFor(file, origin) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const o of j.origins) o.origin = origin;
  const out = file.replace(/\.json$/, `.${origin.split(':').pop()}.json`);
  fs.writeFileSync(out, JSON.stringify(j));
  return out;
}

const INIT = ({ quality, photoRoute }) => {
  window.__SURPRISE_E2E__ = true;
  if (quality) window.__SURPRISE_QUALITY__ = quality;
  // First-appearance timestamps, taken inside the page so CDP latency does not inflate them.
  new MutationObserver(() => {
    if (!window.__welcomeAt && document.querySelector('.welcome__start'))
      window.__welcomeAt = performance.now();
    if (!window.__readyAt && document.querySelector('canvas[data-scene-ready="true"]'))
      window.__readyAt = performance.now();
  }).observe(document, { subtree: true, childList: true, attributes: true });
  // Frame timestamps: three clears the canvas once per rendered frame.
  window.__renders = [];
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const orig = C.prototype.clear;
    C.prototype.clear = function (m) {
      if (m & 0x4000) window.__renders.push(performance.now());
      return orig.call(this, m);
    };
  }
  if (photoRoute) {
    const blobs = new Map();
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => {
      if (obj instanceof Blob && obj.type.startsWith('image/') && obj.size > 20000) {
        const id = `p${blobs.size}`;
        blobs.set(id, obj);
        return `${location.origin}/surprise-museum/__photo/${id}.jpg`;
      }
      return orig(obj);
    };
    window.__readPhoto = async (id) => {
      const b = blobs.get(id);
      const buf = new Uint8Array(await b.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000)
        s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(s);
    };
  }
};

/**
 * Opens a fresh context from a seeded storage state.
 * opts: { profile, quality, cpu, net, photoRoute, origin, state }
 */
export async function newSession(browser, opts) {
  const state = stateFor(opts.state, opts.origin);
  const ctx = await browser.newContext({
    ...PROFILES[opts.profile],
    storageState: state,
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(INIT, { quality: opts.quality ?? null, photoRoute: !!opts.photoRoute });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const logs = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()))
      logs.push(`${m.type()}: ${m.text()}`.slice(0, 300));
  });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`.slice(0, 300)));
  await cdp.send('Performance.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (opts.net === '4g') {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 170,
      downloadThroughput: 9e6 / 8,
      uploadThroughput: 1.5e6 / 8,
    });
  }
  if (opts.cpu && opts.cpu > 1)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  const photoLog = { bytes: 0, count: 0 };
  if (opts.photoRoute) {
    const cache = new Map();
    let pipeFree = 0;
    await page.route('**/__photo/*.jpg', async (route) => {
      const id = route
        .request()
        .url()
        .match(/__photo\/(p\d+)\.jpg/)[1];
      let buf = cache.get(id);
      if (!buf) {
        buf = Buffer.from(await page.evaluate((i) => window.__readPhoto(i), id), 'base64');
        cache.set(id, buf);
      }
      photoLog.bytes += buf.length;
      photoLog.count++;
      if (opts.net === '4g') {
        const now = Date.now();
        const start = Math.max(now, pipeFree);
        pipeFree = start + ((buf.length * 8) / 9e6) * 1000;
        await new Promise((r) => setTimeout(r, pipeFree - now + 170));
      }
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: buf });
    });
  }
  return { ctx, page, cdp, logs, photoLog, opts };
}

export async function metrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

export const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
export const r1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);
export const r2 = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);

export async function startAndWait(page, timeout = 60000) {
  await page.locator('.welcome__start').waitFor({ timeout });
  await page.locator('canvas[data-scene-ready="true"]').waitFor({ state: 'attached', timeout });
  await page.locator('.welcome__start').click();
  await page.waitForFunction(() => !document.querySelector('.welcome'), null, { timeout: 15000 });
}

export const snap = (page) => page.evaluate(() => window.__surpriseMuseum.snapshot());
