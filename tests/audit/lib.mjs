/*
 * Audit harness (QA). Not part of the Playwright suite (testDir is tests/e2e); these are repeatable checks that need a person to read the
 * numbers. Output goes to test-results/cr4-audit/ (override with AUDIT_OUT), which is not committed. Run against the test-mode mock build
 * already served on :4173 (`VITE_API_MODE=mock npm run build -- --mode test`, then `npm run preview -- --port 4173`):
 *   node tests/audit/ui-audit.mjs [chromium|webkit] [360x640 ...]   tap targets, text sizes, overflow and thumb reach, per screen
 *   node tests/audit/edge-contrast.mjs [chromium|webkit] [...]      FR-89 edge contrast of the characters in the lit museum
 * This file holds what both share: the browser launch, the publish-a-museum helper, the page measurements and the three.js hook
 * (`DEVTOOLS_INIT`, which exposes the scene and camera as window.__last).
 */
import { chromium, webkit, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { decodePng } from '../e2e/support/images.ts';

export const BASE = `http://localhost:${process.env.AUDIT_PORT ?? 4173}/surprise-museum/`;
// Playwright empties test-results/ at the start of every run, so write elsewhere and copy in at the end.
export const OUT = (process.env.AUDIT_OUT ?? new URL('../../test-results/cr4-audit/', import.meta.url).pathname).replace(/\/?$/, '/');
mkdirSync(OUT + 'data', { recursive: true });
mkdirSync(OUT + 'shots', { recursive: true });

export const VIEWPORTS = {
  '360x640': { width: 360, height: 640, phone: true },
  '390x844': { width: 390, height: 844, phone: true },
  '844x390': { width: 844, height: 390, phone: true },
  '768x1024': { width: 768, height: 1024, phone: true },
  '1280x720': { width: 1280, height: 720, phone: false },
};

const SWIFTSHADER = [
  '--use-angle=swiftshader',
  '--use-gl=angle',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export async function launch(browserName) {
  return browserName === 'webkit'
    ? webkit.launch()
    : chromium.launch({ args: SWIFTSHADER });
}

export async function newContext(browser, browserName, vpId, extra = {}) {
  const vp = VIEWPORTS[vpId];
  const base = vp.phone
    ? browserName === 'webkit'
      ? devices['iPhone 13']
      : devices['Pixel 7']
    : browserName === 'webkit'
      ? devices['Desktop Safari']
      : devices['Desktop Chrome'];
  const ctx = await browser.newContext({
    ...base,
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.phone ? 2 : 1,
    baseURL: BASE,
    serviceWorkers: 'block',
    ...extra,
  });
  return ctx;
}

export function save(name, data) {
  writeFileSync(OUT + 'data/' + name + '.json', JSON.stringify(data, null, 1));
}

/* ------------------------------------------------------------------------------------------ */
/* In-page measurement. Serialised into the page, so it must not reference outer variables.   */
/* ------------------------------------------------------------------------------------------ */
export function measureInPage(opts) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TARGET_SEL =
    'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=radio],[role=checkbox],[role=switch],[role=slider],[role=link],[role=menuitem],[tabindex]:not([tabindex="-1"])';
  const visible = (el) => {
    if (!el.checkVisibility({ checkVisibilityCSS: true, opacityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isSrOnly = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) return true;
    return /visually-hidden|sr-only/.test(el.className?.toString?.() ?? '');
  };
  const nameOf = (el) =>
    (
      el.getAttribute('aria-label') ||
      el.textContent ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.getAttribute('name') ||
      ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
  const cls = (el) => (el.className?.toString?.() ?? '').split(/\s+/).slice(0, 3).join('.');
  const modal = [...document.querySelectorAll('[aria-modal="true"],dialog[open],[role=dialog]')].find(visible);

  // ---- tap targets
  let els = [...document.querySelectorAll(TARGET_SEL)].filter(
    (el) => el.tagName !== 'CANVAS' && !el.closest('[inert]') && !el.closest('[aria-hidden="true"]'),
  );
  els = els.filter((el) => {
    if (el.tagName === 'INPUT' && (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio')) {
      const lab = el.labels?.[0];
      return lab ? visible(lab) : visible(el) && !isSrOnly(el);
    }
    return visible(el) && !isSrOnly(el);
  });
  if (modal) els = els.filter((el) => modal.contains(el));
  const targets = els.map((el) => {
    let r = el.getBoundingClientRect();
    if (el.tagName === 'INPUT' && ['file', 'checkbox', 'radio'].includes(el.type) && el.labels?.[0]) {
      const lr = el.labels[0].getBoundingClientRect();
      if (r.width * r.height < lr.width * lr.height) r = lr;
    }
    // Hit-test: is the centre of the target reachable (not covered)? Only meaningful on screen.
    let covered = null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx >= 0 && cx <= vw && cy >= 0 && cy <= vh) {
      const top = document.elementFromPoint(cx, cy);
      covered = !(top && (el === top || el.contains(top) || top.contains(el) || (el.labels && [...el.labels].some((l) => l.contains(top)))));
    }
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      cls: cls(el),
      name: nameOf(el),
      x: Math.round(r.left * 10) / 10,
      y: Math.round(r.top * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      cyFrac: Math.round((cy / vh) * 100) / 100,
      onScreen: cy >= 0 && cy <= vh && cx >= 0 && cx <= vw,
      covered,
      _el: el,
    };
  });
  const small = targets.filter((t) => t.w < 44 - 0.5 || t.h < 44 - 0.5);
  const gaps = [];
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i];
      const b = targets[j];
      if (a._el.contains(b._el) || b._el.contains(a._el)) continue;
      const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
      const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
      const d = Math.hypot(dx, dy);
      if (d < 8 - 0.01) gaps.push({ a: `${a.name} [${a.cls}]`, b: `${b.name} [${b.cls}]`, gap: Math.round(d * 10) / 10 });
    }
  }
  const clean = (t) => {
    const { _el, ...rest } = t;
    void _el;
    return rest;
  };

  // ---- text sizes
  const groups = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const p = n.parentElement;
    if (!p || p.closest('script,style,noscript,svg,canvas,[aria-hidden="true"]')) continue;
    if (!visible(p) || isSrOnly(p)) continue;
    const cs = getComputedStyle(p);
    const key = `${parseFloat(cs.fontSize)}|${cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()}`;
    const g = groups.get(key) ?? { size: parseFloat(cs.fontSize), family: key.split('|')[1], n: 0, samples: [], cls: new Set(), weight: cs.fontWeight };
    g.n++;
    if (g.samples.length < 3) g.samples.push(text.slice(0, 40));
    if (g.cls.size < 4) g.cls.add(p.tagName.toLowerCase() + '.' + cls(p));
    groups.set(key, g);
  }
  for (const f of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),textarea,select')) {
    if (!visible(f) || isSrOnly(f)) continue;
    const cs = getComputedStyle(f);
    const key = `${parseFloat(cs.fontSize)}|FIELD:${cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()}`;
    const g = groups.get(key) ?? { size: parseFloat(cs.fontSize), family: key.split('|')[1], n: 0, samples: [], cls: new Set(), weight: cs.fontWeight };
    g.n++;
    if (g.cls.size < 4) g.cls.add(f.tagName.toLowerCase() + '.' + cls(f));
    groups.set(key, g);
  }
  const texts = [...groups.values()].map((g) => ({ ...g, cls: [...g.cls] })).sort((a, b) => a.size - b.size);

  // ---- overflow and clipping
  const de = document.documentElement;
  const doc = { scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight, clientH: de.clientHeight, hOverflow: de.scrollWidth > de.clientWidth + 1 };
  const outside = [];
  const clipped = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg,canvas,script,style') || !visible(el) || isSrOnly(el)) continue;
    const r = el.getBoundingClientRect();
    const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (hasText && (r.right > vw + 1 || r.left < -1)) {
      outside.push({ el: `${el.tagName.toLowerCase()}.${cls(el)}`, text: el.textContent.trim().slice(0, 30), left: Math.round(r.left), right: Math.round(r.right) });
    }
    const cs = getComputedStyle(el);
    if (hasText && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none')) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
        clipped.push({ el: `${el.tagName.toLowerCase()}.${cls(el)}`, text: el.textContent.trim().slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
      }
    }
  }

  // ---- fixed and sticky bars
  const bars = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (!visible(el) || isSrOnly(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20) continue;
    bars.push({ el: `${el.tagName.toLowerCase()}.${cls(el)}`, pos: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width) });
  }

  // ---- how much of the viewport is user interface rather than canvas (visit screens)
  let uiCover = null;
  if (opts?.cover && document.querySelector('canvas')) {
    let ui = 0;
    let total = 0;
    const cols = 40;
    const rows = 24;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = ((i + 0.5) / cols) * vw;
        const y = ((j + 0.5) / rows) * vh;
        const top = document.elementFromPoint(x, y);
        total++;
        if (top && top.tagName !== 'CANVAS' && !top.closest('.name-label,[data-name-label]')) ui++;
      }
    }
    uiCover = Math.round((ui / total) * 1000) / 10;
  }

  return {
    vw,
    vh,
    scrollY: Math.round(window.scrollY),
    targets: targets.map(clean),
    small: small.map(clean),
    gaps,
    texts,
    doc,
    outside,
    clipped,
    bars,
    uiCover,
    modal: modal ? `${modal.tagName.toLowerCase()}.${cls(modal)}` : null,
  };
}

export async function measure(page, opts = {}) {
  return page.evaluate(measureInPage, opts);
}

export async function shot(page, id, screen, opts = {}) {
  const path = `${OUT}shots/${id}-${screen}.png`;
  await page.screenshot({ path, fullPage: !!opts.full, animations: 'allow' });
  return path;
}

/** Build and publish a 3-photo museum through the real builder UI; returns the share token. */
export async function publishMuseum(page, { photos = 3, visitor = 'Alex', guide = 'Sam' } = {}) {
  const { makePhotos } = await import('../e2e/support/images.ts');
  await page.goto('./?e2e=1#/create');
  await page.locator('input[type=file]').first().setInputFiles(makePhotos(photos));
  await page.locator('.photo-row__status--ready').nth(photos - 1).waitFor({ timeout: 60000 });
  for (let i = 0; i < photos; i++) await page.getByLabel('Caption (optional)').nth(i).fill(`Caption for photo ${i + 1}.`);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Who is this museum for?').fill(visitor);
  await page.getByLabel('Your name').fill(guide);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
  await page.getByRole('button', { name: /Publish museum/ }).click();
  await page.getByRole('heading', { name: 'Your museum is ready' }).waitFor({ timeout: 60000 });
  const share = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  return share.split('/').pop();
}

export async function openAndStart(page, token) {
  await page.goto('about:blank');
  await page.goto(`./?e2e=1#/m/${token}`);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => globalThis.__surpriseMuseum?.snapshot().ready, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
}

/** Records the renderer, scene and last camera (three.js announces them to __THREE_DEVTOOLS__). */
export const DEVTOOLS_INIT = () => {
  const t = new EventTarget();
  window.__THREE_DEVTOOLS__ = t;
  t.addEventListener('observe', (e) => {
    const o = e.detail;
    if (o.isWebGLRenderer) {
      const r = o.render.bind(o);
      o.render = (s, c) => { window.__last = { scene: s, camera: c }; return r(s, c); };
    }
  });
};

/** Decode a Playwright screenshot (PNG) to RGBA. */
export const png = (buf) => decodePng(buf);
