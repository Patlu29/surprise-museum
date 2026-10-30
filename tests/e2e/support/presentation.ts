import { expect, type Page } from '@playwright/test';
import { openVisit, snap, startVisit, waitForSnap, type PageGlobals, type Snap } from './app';

/**
 * Helpers for the presentation camera (CR-2, design spec 6.12) and the caption card (spec 3.5, v1.4).
 * Everything the tests read comes from the documented hooks: `snapshot().presentationCamera`, the
 * `data-presentation-camera` attribute, the `surprise-museum:presentation-camera` event, the card's
 * DOM and `data-card-size`, and the published screen rectangles.
 */

export interface Viewport {
  name: string;
  width: number;
  height: number;
  /** Lowest accepted `pictureVisibleFraction` (tech lead tolerances, docs/project-status.md). */
  minVisible: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: '360x640', width: 360, height: 640, minVisible: 0.99 },
  { name: '390x844', width: 390, height: 844, minVisible: 0.98 },
  { name: '844x390', width: 844, height: 390, minVisible: 0.9 },
  { name: '1280x720', width: 1280, height: 720, minVisible: 0.99 },
];

/** Open the museum at a viewport and press Start. */
export async function enterVisit(page: Page, token: string, vp: { width: number; height: number }): Promise<void> {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await openVisit(page, token);
  await startVisit(page);
  // Let the arrival settle (the Guide and the camera) before a test starts its own clock.
  await waitForSnap(page, (s) => s.guide.opacity >= 1 && s.presentationCamera.mode === 'follow', 30_000, 'the arrival to settle');
}

export interface CamSample {
  t: number;
  mode: string;
  card: boolean;
  size: string | null;
  simTime: number;
  veil: number;
  presentation: string;
  intent: string;
  guideMode: string;
  visible: number;
  x: number;
  z: number;
  yawDeg: number;
  guideArrived: boolean;
  guidePresenting: boolean;
}
export interface CamRecord {
  events: Array<{ t: number; mode: string; settled: boolean; photoId: string | null; seq: number }>;
  samples: CamSample[];
  /** performance.now() of the first sample with the card present, per card appearance. */
  cardAppearedAt: number[];
  veilMax: number;
  veilElementSeen: boolean;
}

/** Record camera events and a sample every animation frame, from now on. Call after the visit has started. */
export async function startRecording(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    const g = globalThis;
    const rec = { events: [], samples: [], cardAppearedAt: [], veilMax: 0, veilElementSeen: false };
    g.__qaCam = rec;
    g.addEventListener('surprise-museum:presentation-camera', (e) => rec.events.push({ t: performance.now(), ...e.detail }));
    const canvas = g.document.querySelector('canvas');
    let hadCard = false;
    const loop = () => {
      if (g.__qaCamStop) return;
      const sn = g.__surpriseMuseum.snapshot();
      const card = g.document.querySelector('.caption-card');
      const veilEl = g.document.querySelector('[data-testid=camera-veil]');
      if (veilEl) rec.veilElementSeen = true;
      rec.veilMax = Math.max(rec.veilMax, sn.presentationCamera.veil);
      if (card && !hadCard) rec.cardAppearedAt.push(performance.now());
      hadCard = !!card;
      rec.samples.push({
        t: performance.now(), mode: canvas.dataset.presentationCamera, card: !!card, size: card ? card.dataset.cardSize : null,
        simTime: sn.time, veil: sn.presentationCamera.veil,
        presentation: g.__APP_TEST__.useSessionStore.getState().presentation.kind, intent: sn.intent, guideMode: sn.guide.mode,
        visible: sn.presentationCamera.pictureVisibleFraction, x: sn.camera.x, z: sn.camera.z,
        yawDeg: sn.presentationCamera.shownYawDeg, guidePresenting: !!sn.presentationCamera.guidePresenting,
        guideArrived: !!(sn.presentationCamera.guidePresenting && sn.presentationCamera.guidePresenting.arrived),
      });
      g.requestAnimationFrame(loop);
    };
    loop();
  })()`);
}

export async function stopRecording(page: Page): Promise<CamRecord> {
  return page.evaluate(`(() => { globalThis.__qaCamStop = true; return globalThis.__qaCam; })()`) as Promise<CamRecord>;
}

export async function readRecording(page: Page): Promise<CamRecord> {
  return page.evaluate(`globalThis.__qaCam`) as Promise<CamRecord>;
}

/**
 * Peak turning speed (degrees per second, simulation time) over consecutive samples that both satisfy `inRun`,
 * from the per-frame `shownYawDeg`. Frames that share a simulation time are skipped.
 */
export function peakYawRate(rec: CamRecord, inRun: (s: CamSample) => boolean): { peak: number; frames: number } {
  let peak = 0;
  let frames = 0;
  for (let i = 1; i < rec.samples.length; i++) {
    const a = rec.samples[i - 1]!;
    const b = rec.samples[i]!;
    if (!inRun(a) || !inRun(b)) continue;
    const dt = b.simTime - a.simTime;
    if (dt <= 1e-4) continue;
    const d = Math.abs((((b.yawDeg - a.yawDeg) % 360) + 540) % 360 - 180);
    frames++;
    peak = Math.max(peak, d / dt);
  }
  return { peak, frames };
}

export const pc = async (page: Page) => (await snap(page)).presentationCamera;

/** Stand at a picture and wait until the camera has framed it. */
export async function standAndFrame(page: Page, index: number, timeout = 40_000): Promise<Snap> {
  const ok = await page.evaluate((i) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(i), index);
  expect(ok, `standAtPhoto(${index})`).toBe(true);
  return waitForSnap(
    page,
    (s) => (s.presentationCamera.mode === 'framed' || s.presentationCamera.mode === 'cut') && s.presentationCamera.settled && s.presentationCamera.photoId !== null,
    timeout,
    `the camera to frame picture ${index + 1}`,
  );
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Rects {
  picture: Rect | null;
  visitor: Rect | null;
  guide: Rect | null;
}

/** The scene's published rectangles (CSS px, viewport coordinates). */
export async function sceneRects(page: Page): Promise<Rects> {
  return page.evaluate(`(() => { const r = globalThis.__APP_TEST__.screenRects; const c = (x) => (x ? { x: x.x, y: x.y, width: x.width, height: x.height } : null); return { picture: c(r.picture), visitor: c(r.visitor), guide: c(r.guide) }; })()`) as Promise<Rects>;
}

export const right = (r: Rect) => r.x + r.width;
export const bottom = (r: Rect) => r.y + r.height;
export function intersects(a: Rect, b: Rect, grow = 0): boolean {
  return a.x < right(b) + grow && right(a) > b.x - grow && a.y < bottom(b) + grow && bottom(a) > b.y - grow;
}
export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(right(a), right(b)) - Math.max(a.x, b.x);
  const h = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export interface CardInfo {
  rect: Rect;
  size: string;
  dock: string;
  expanded: boolean;
  header: Rect;
  close: Rect;
  look: Rect | null;
  toggle: (Rect & { label: string; expanded: string | null }) | null;
  name: Rect & { text: string; lineHeight: number };
  text: { box: Rect; lineHeight: number; totalLines: number; naturalLines: number; visibleLines: number; firstLine: Rect | null; clamped: boolean; overflowing: boolean };
  scrollWidth: number;
  clientWidth: number;
  controls: Rect[];
  viewport: { width: number; height: number; docOverflow: number };
}

/** Measure the caption card in the page. Returns null when no card is shown. */
export async function cardInfo(page: Page): Promise<CardInfo | null> {
  return page.evaluate(`(() => {
    const d = globalThis.document;
    const card = d.querySelector('.caption-card');
    if (!card) return null;
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const textEl = card.querySelector('.caption-card__text');
    const cs = globalThis.getComputedStyle(textEl);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const range = d.createRange();
    range.selectNodeContents(textEl);
    const boxes = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    const tops = [...new Set(boxes.map((r) => Math.round(r.top)))].sort((a, b) => a - b);
    const tb = textEl.getBoundingClientRect();
    const lines = tops.map((top) => { const rs = boxes.filter((r) => Math.round(r.top) === top); const l = Math.min(...rs.map((r) => r.left)); const r = Math.max(...rs.map((r) => r.right)); const b = Math.max(...rs.map((r) => r.bottom)); return { x: l, y: top, width: r - l, height: b - top }; });
    const visible = lines.filter((l) => l.y >= tb.top - 1 && l.y + l.height <= tb.bottom + 1.5);
    // The caption's real length in lines, measured on an unclamped copy at the same width, so truncation
    // detection (scrollHeight against clientHeight, which differs between engines) is checked independently.
    const probe = textEl.cloneNode(true);
    probe.removeAttribute('id');
    probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;display:block;overflow:visible;max-height:none;height:auto;-webkit-line-clamp:unset;line-clamp:unset;width:' + tb.width + 'px';
    textEl.parentNode.appendChild(probe);
    const naturalLines = Math.round(probe.getBoundingClientRect().height / lineHeight);
    probe.remove();
    const toggle = card.querySelector('.caption-card__toggle');
    const look = card.querySelector('.caption-card__look');
    const close = card.querySelector('[aria-label="Close caption"]');
    const name = card.querySelector('.caption-card__name');
    const ncs = globalThis.getComputedStyle(name);
    const controls = [close, look, toggle].filter(Boolean).map(R);
    return {
      rect: R(card), size: card.dataset.cardSize, dock: card.dataset.dock, expanded: card.dataset.expanded === 'true',
      header: R(card.querySelector('.caption-card__header')), close: R(close), look: R(look),
      toggle: toggle ? { ...R(toggle), label: toggle.textContent.trim(), expanded: toggle.getAttribute('aria-expanded') } : null,
      name: { ...R(name), text: name.textContent, lineHeight: parseFloat(ncs.lineHeight) || parseFloat(ncs.fontSize) * 1.3 },
      text: { box: R(textEl), lineHeight, naturalLines, totalLines: Math.round(textEl.scrollHeight / lineHeight), visibleLines: visible.length, firstLine: lines[0] || null, clamped: cs.webkitLineClamp === '2' || cs.getPropertyValue('-webkit-line-clamp') === '2', overflowing: textEl.scrollHeight > textEl.clientHeight + 1 },
      scrollWidth: card.scrollWidth, clientWidth: card.clientWidth, controls,
      viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight, docOverflow: d.documentElement.scrollWidth - d.documentElement.clientWidth },
    };
  })()`) as Promise<CardInfo | null>;
}

/** Leave the picture: back to the entrance hall, away from every picture, and wait for the camera to follow again. */
export async function leavePicture(page: Page): Promise<void> {
  await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.teleportVisitor(0, -3.5));
  await waitForSnap(page, (s) => s.presentationCamera.mode === 'follow' && s.intent === 'none' && s.guide.presentation === 'none', 30_000, 'the presentation to end');
  await expect(page.locator('.caption-card')).toHaveCount(0, { timeout: 10_000 });
}

/**
 * Replace the scene's published rectangles with fixed ones (the spec 3.5 fixtures: "move the Guide
 * rectangle away"). The scene's own writes are ignored until `release()`. Pass null for "no rectangle".
 */
export async function fixRects(page: Page, rects: Partial<Rects>): Promise<void> {
  await page.evaluate(
    (r) => {
      const g = globalThis as unknown as { __APP_TEST__: { screenRects: Record<string, unknown> }; __qaRectFix?: Record<string, unknown> };
      const target = g.__APP_TEST__.screenRects;
      const fix = (g.__qaRectFix = g.__qaRectFix ?? {});
      for (const key of ['picture', 'visitor', 'guide'] as const) {
        if (!(key in r)) continue;
        fix[key] = (r as Record<string, unknown>)[key];
        if (!Object.getOwnPropertyDescriptor(target, key)?.get) {
          Object.defineProperty(target, key, { configurable: true, enumerable: true, get: () => fix[key] ?? null, set: () => undefined });
        }
      }
    },
    rects,
  );
}
