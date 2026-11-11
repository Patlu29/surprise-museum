/*
 * FR-89 edge contrast in the LIT museum (QA round 6, 03/11/2026; round 7, 11/11/2026: pixel ratio pinned, polluted first case discarded).
 *
 * Round 7 method (requirements v0.6.2, "Test conditions for FR-89"): the pixel ratio is pinned at 1.5 by default (`--dpr=1.0` is the stretch case:
 * reported, never a pass condition). The context keeps the phone's screen scale factor (3), the canvas renders at the pin (the browser scales it up, as on a phone), and every frame
 * wrapper re-applies the pin if the app's governor lowered it. A warm-up case is measured first and discarded (the first case of a run is polluted
 * by extra samples), and the 8 s coaching hint is waited out. The run is rejected if the renderer pixel ratio is not the pin when sampling.
 * A repeatable audit, not part of the Playwright suite.
 *
 * What it does
 *   Opens a published one-photo museum at the 360x640 phone viewport, device scale factor 3, with the default follow camera. The Visitor is
 *   put at three places in the real, lit scene (gallery floor beside the runner, on the runner, and facing the finale end wall); the Guide is
 *   hidden. For each option it measures, per zone and per backdrop, the median WCAG contrast between a pixel just inside the silhouette and a
 *   pixel just outside it, with the technical-artist's definition (docs/handoffs/technical-artist.md, "Edge contrast"): the better of the pixel
 *   0.3 CSS px inside (rim band) and 1.0 CSS px inside (contour band), against the pixel 0.5 CSS px outside.
 *   - Silhouette: a frame with the Visitor shown minus one with the Visitor hidden (the avatar meshes are found through __THREE_DEVTOOLS__).
 *     The hair mesh is isolated the same way. Zones: hair (hair mesh), head (face and neck, top 22% of the figure), torso and arms (22 to 58%),
 *     legs (below 58%).
 *   - Backdrop: each outside pixel is classified by casting a ray from the camera through it against the museum's planes (floor, runner,
 *     side walls, partitions, end wall), so a sample counts as "oak" only if the surface behind the figure at that pixel is the oak floor,
 *     "runner" if it is the claret runner, "finale-wall" if it is a wall of the finale room, "linen-wall" for the other walls, and so on.
 *     Samples are pooled over the three places.
 *   Unlike the flat-token backdrops in the technical-artist's table, this is the museum as it is lit, at the real camera, so numbers differ.
 *
 * Sweeps: all 11 hair colours x the hair styles (all 12 by default, or `--styles=a,b`); all 12 outfit colours (default shirt and trousers);
 * `--patterns` adds the 3 patterns on 4 outfit colours (`--pattern-colours=a,b,...`); `--skin` adds the 10 skin tones.
 *
 * What the lit museum shows (round 6): at the default follow camera the hair is only ever seen against walls (the far wall, or the finale
 * wall) or the far floor, never against the oak or the runner, because the rays through the head leave the figure at about 10 degrees below the
 * horizontal. Torso and legs are seen against the floor (oak beside the runner, the runner on it). Only a high camera puts hair on the floor.
 *
 * Usage (needs the test-mode mock build served on :4173, see tests/README.md):
 *   node tests/audit/edge-contrast.mjs [chromium|webkit] [--patterns] [--skin] [--styles=bob,afro] [--quick]
 * Output: test-results/cr4-audit/data/<browser>-edge-contrast.json (override the folder with AUDIT_OUT=...), and a table on stdout. Each case under
 * 3:1 is checked against the accepted exceptions X-1 to X-8 (docs/requirements/requirements.md, FR-89). Anything else is listed as a failure
 * (exit code 1) and goes to the technical-artist.
 */
import { launch, newContext, publishMuseum, save, DEVTOOLS_INIT, png } from './lib.mjs';

const argv = process.argv.slice(2);
const browserName = argv.find((a) => a === 'chromium' || a === 'webkit') ?? 'chromium';
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

const HAIR_STYLES = ['shaved', 'buzz', 'short-crop', 'side-part', 'curly-short', 'bob', 'long-straight', 'long-wavy', 'ponytail', 'bun', 'afro', 'braids'];
const HAIR_COLOURS = ['black', 'dark-brown', 'brown', 'auburn', 'ginger', 'blonde', 'platinum', 'grey', 'white', 'pink', 'blue'];
const OUTFIT_COLOURS = ['red', 'coral', 'orange', 'mustard', 'green', 'teal', 'sky', 'navy', 'purple', 'pink', 'charcoal', 'cream'];
const PATTERNS = ['stripes', 'checks', 'dots'];
const SKINS = ['skin-01', 'skin-02', 'skin-03', 'skin-04', 'skin-05', 'skin-06', 'skin-07', 'skin-08', 'skin-09', 'skin-10'];
const styles = (opt('styles')?.split(',') ?? HAIR_STYLES).filter((s) => HAIR_STYLES.includes(s));
const PATTERN_COLOURS = (opt('pattern-colours')?.split(',') ?? ['navy', 'cream', 'charcoal', 'mustard']).filter((c) => OUTFIT_COLOURS.includes(c));
const QUICK = flag('quick');
const DPR = Number(opt('dpr') ?? 1.5);
if (![1, 1.5].includes(DPR)) throw new Error('--dpr must be 1 or 1.5');
const STRETCH = DPR === 1;
/**
 * The phone's screen scale factor (default 3, like a Pixel 7 or an iPhone 13). The canvas renders at the pinned pixel ratio (1.5) and the browser
 * scales it up to the screen, which is what a phone does; the 0.3 / 1.0 / 0.5 CSS px bands are then sampled in screen pixels. Sampling a context
 * whose scale factor equals the pin (`--screen=1.5`) reads whole render pixels instead and gave much higher figures in round 7 (linen torso
 * 4.1 against 2.6), so it is not comparable with the technical-artist's method.
 */
const SCREEN = Number(opt('screen') ?? 3);
/** Backdrops reported: oak, the runner, the two kinds of wall and the finale floor. Others (the ceiling, rays that leave the museum) are kept in the JSON only. */
const REPORTED = ['oak', 'runner', 'linen-wall', 'finale-wall', 'finale-floor'];
const MIN_SAMPLES = 25;

/**
 * Provisional accepted class X-1 to X-7 (requirements v0.6.2, pixel ratio 1.5). X-8 is reserved. Returns the reference, or undefined when the
 * cell is a failure. Hair outside afro, braids and curly-short on linen, and every cell on oak, the runner and the finale floor, are never excepted.
 */
function acceptedClass(c, backdrop, zone) {
  if (backdrop === 'linen-wall') {
    if (zone === 'torso') return 'X-1'; // outfit sweep about 2.64, hair sweep about 2.77
    if (zone === 'head') return 'X-2';
    if (zone === 'hair' && c.style === 'afro') return 'X-3';
    if (zone === 'hair' && c.style === 'braids') return 'X-4';
    if (zone === 'hair' && c.style === 'curly-short') return 'X-5';
  }
  if (backdrop === 'finale-wall' && zone === 'hair') {
    if (c.style === 'afro' || c.style === 'braids') return 'X-6';
    if (c.style === 'curly-short') return 'X-7';
  }
  return undefined;
}

/* ---------- image maths ---------- */
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (d, i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(2); };
const diffMask = (a, b, thr = 24) => {
  const m = new Uint8Array(a.width * a.height);
  for (let i = 0, p = 0; i < a.data.length; i += 4, p++) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > thr) m[p] = 1;
  return m;
};
function bbox(m, w, h) {
  let top = -1, bot = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    let n = 0, l = w, r = -1;
    for (let x = 0; x < w; x++) if (m[y * w + x]) { n++; l = Math.min(l, x); r = x; }
    if (n >= 3) { if (top < 0) top = y; bot = y; left = Math.min(left, l); right = Math.max(right, r); }
  }
  return top < 0 ? null : { top, bot, left, right, h: bot - top + 1, w: right - left + 1 };
}
/** Raw samples { zone, ratio, ox, oy } (ox, oy: the outside pixel, for backdrop classification). */
function edgeSamples(img, m, hairM, bb, dsf) {
  const { width: w, height: h, data: d } = img;
  const inner = [Math.max(1, Math.round(0.3 * dsf)), Math.max(2, Math.round(1.0 * dsf))];
  const outer = Math.max(1, Math.round(0.5 * dsf));
  const out = [];
  const zoneOf = (y) => { const t = (y - bb.top) / bb.h; return t < 0.22 ? 'head' : t < 0.58 ? 'torso' : 'legs'; };
  const add = (y, dx, dy, ex, ey) => {
    const xo = ex + dx * outer, yo = ey + dy * outer;
    if (xo < 0 || xo >= w || yo < 0 || yo >= h || m[yo * w + xo]) return;
    let best = 0;
    let zone = null;
    for (const k of inner) {
      const xi = ex - dx * k, yi = ey - dy * k;
      if (xi < 0 || xi >= w || yi < 0 || yi >= h || !m[yi * w + xi]) continue;
      if (zone === null) zone = hairM[yi * w + xi] ? 'hair' : zoneOf(y);
      best = Math.max(best, ratio(lum(d, (yi * w + xi) * 4), lum(d, (yo * w + xo) * 4)));
    }
    if (zone !== null) out.push({ zone, ratio: best, ox: xo, oy: yo });
  };
  for (let y = bb.top; y <= bb.bot; y++) {
    let l = -1, r = -1;
    for (let x = bb.left; x <= bb.right; x++) if (m[y * w + x]) { if (l < 0) l = x; r = x; }
    if (l < 0) continue;
    add(y, -1, 0, l, y);
    add(y, 1, 0, r, y);
  }
  for (let x = bb.left; x <= bb.right; x++) {
    let t = -1;
    for (let y = bb.top; y <= bb.bot; y++) if (m[y * w + x]) { t = y; break; }
    if (t >= 0) add(t, 0, -1, x, t);
  }
  return out;
}

/* ---------- page helpers ---------- */
const hide = (page, role, mesh, hidden) => page.evaluate(([role, mesh, hidden]) => {
  window.__last.scene.traverse((o) => {
    if (o.name === `avatar-${role}`) o.traverse((c) => { if (c.isSkinnedMesh && (mesh === 'all' || c.name === mesh)) c.visible = !hidden; });
  });
}, [role, mesh, hidden]);
const frame = async (page, ms = 260) => { await page.waitForTimeout(ms); return png(await page.screenshot({ animations: 'allow' })); };
const setAvatar = (page, changes) => page.evaluate((changes) => {
  const store = globalThis.__APP_TEST__.useMuseumStore;
  const c = store.getState().content;
  store.setState({ content: { ...c, visitorAvatar: { ...c.visitorAvatar, ...changes } } });
}, changes);

/**
 * In the page: for each outside pixel (device px in a frame of `size`), cast a ray from the camera and say which museum surface it hits first.
 * Planes only: floor (runner if |x| < 0.8), side walls (x = +-4), the partitions at each room boundary (doorway: 2.4 m wide, 2.7 m high, passes
 * through) and the end wall. The finale room's walls are "finale-wall"; every other wall is "linen-wall".
 */
const classifyInPage = (page, points, size, rooms) => page.evaluate(([points, size, rooms]) => {
  const cam = window.__last.camera;
  cam.updateMatrixWorld(true);
  const V3 = cam.position.constructor;
  const O = cam.position.clone();
  const finale = rooms.find((r) => r.kind === 'finale');
  const zEnd = finale.minZ;
  const partitions = rooms.slice(1).map((r) => r.maxZ).concat([zEnd]); // partition z planes (boundary of each room), then the end wall
  const inFinale = (z) => z <= finale.maxZ + 1e-6 && z >= finale.minZ - 1e-6;
  const classes = [];
  for (const [px, py] of points) {
    const p = new V3((px / size.w) * 2 - 1, -(py / size.h) * 2 + 1, 0.5).unproject(cam);
    const D = p.sub(O).normalize();
    let best = Infinity, cls = 'sky';
    const consider = (t, kind, hit) => {
      if (!(t > 1e-4) || t >= best) return;
      if (hit.y < -1e-3 || hit.y > 3.2 + 1e-3 || Math.abs(hit.x) > 4 + 1e-3 || hit.z > 0 + 1e-3 || hit.z < zEnd - 1e-3) return;
      if (kind === 'partition' && Math.abs(hit.x) < 1.2 && hit.y < 2.7) return; // the doorway
      best = t;
      cls = kind === 'floor' ? (inFinale(hit.z) ? 'finale-floor' : Math.abs(hit.x) < 0.8 ? 'runner' : 'oak')
        : kind === 'ceiling' ? 'ceiling'
        : kind === 'side' ? (inFinale(hit.z) ? 'finale-wall' : 'linen-wall')
        : Math.abs(hit.z - zEnd) < 1e-3 ? 'finale-wall' : 'linen-wall';
    };
    const at = (t) => ({ x: O.x + D.x * t, y: O.y + D.y * t, z: O.z + D.z * t });
    if (D.y < -1e-6) { const t = -O.y / D.y; consider(t, 'floor', at(t)); }
    if (D.y > 1e-6) { const t = (3.2 - O.y) / D.y; consider(t, 'ceiling', at(t)); }
    if (Math.abs(D.x) > 1e-6) for (const wx of [-4, 4]) { const t = (wx - O.x) / D.x; consider(t, 'side', at(t)); }
    if (Math.abs(D.z) > 1e-6) for (const z of partitions) { const t = (z - O.z) / D.z; consider(t, 'partition', at(t)); }
    classes.push(cls);
  }
  return classes;
}, [points, size, rooms]);

const browser = await launch(browserName);
const ctx = await newContext(browser, browserName, '360x640', { reducedMotion: 'reduce', deviceScaleFactor: SCREEN });
await ctx.addInitScript(DEVTOOLS_INIT);
const page = await ctx.newPage();
const dsf = SCREEN;
await ctx.addInitScript((d) => { window.__pinDpr = d; }, DPR);
const token = await publishMuseum(page);
await page.goto('about:blank');
await page.goto(`./?e2e=1#/m/${token}`);
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForTimeout(9000); // the coaching hint toast (8 s) must be gone before sampling (it can cover the legs)
await page.waitForFunction(() => globalThis.__surpriseMuseum?.snapshot().ready && globalThis.__surpriseMuseum.snapshot().guide.opacity >= 1, null, { timeout: 60000 });
const lay = await page.evaluate(() => globalThis.__surpriseMuseum.layout());
const gallery = lay.rooms.find((r) => r.kind === 'gallery');
const finale = lay.rooms.find((r) => r.kind === 'finale');
// Places away from every picture (a presentation starts after 1 s within 3 m of one) and away from the podium (the finale card).
const PLACES = {
  'gallery-beside-runner': { x: 2.6, z: gallery.maxZ - 4.4, heading: Math.PI },
  'gallery-on-runner': { x: 0, z: gallery.maxZ - 4.4, heading: Math.PI },
  'finale-end-wall': { x: 2.8, z: finale.minZ + 2.4, heading: Math.PI },
};

async function place(name) {
  const b = PLACES[name];
  await page.evaluate(([x, z, h]) => globalThis.__surpriseMuseum.teleportVisitor(x, z, h), [b.x, b.z, b.heading]);
  await page.waitForFunction(() => { const s = globalThis.__surpriseMuseum.snapshot(); return s.presentationCamera.mode === 'follow' && s.intent === 'none'; }, null, { timeout: 30000 });
  // A fresh, repeatable camera: back to the default follow pose behind the Visitor (the same action as the Reset view button).
  await page.evaluate(() => globalThis.__APP_TEST__.useSessionStore.getState().resetView());
  // Wait until the camera is at rest (the follow camera catches up with a teleport over a second or so).
  await page.waitForFunction(() => {
    const c = globalThis.__surpriseMuseum.snapshot().camera;
    const last = globalThis.__qaCam;
    globalThis.__qaCam = [c.x, c.y, c.z];
    return !!last && Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]) < 0.002;
  }, null, { timeout: 15000, polling: 400 });
  await page.waitForTimeout(500);
}

/**
 * Changing the avatar in the museum store rebuilds the whole scene (the scene's content key is the JSON of the content), which puts the
 * Visitor back at the spawn and brings the Guide back. So after every change: wait until the scene is ready again, hide the Guide, then place.
 */
async function applyAvatar(changes) {
  await setAvatar(page, changes);
  await page.waitForTimeout(300);
  await page.waitForFunction(() => { const s = globalThis.__surpriseMuseum?.snapshot(); return s && s.ready && s.labels.visitor; }, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await hide(page, 'guide', 'all', true);
}

/**
 * One measurement: raw samples with their backdrop class, in the current place. A frame that shows the avatar is taken twice; if the two differ,
 * the camera or the figure moved by a pixel or so between frames (that would turn every edge into a "difference" and ruin both the silhouette and
 * the hair mask), so the measurement is repeated.
 */
async function measure(withHair) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const pr = await page.evaluate(() => window.__last?.renderer?.getPixelRatio());
    if (pr !== DPR) { console.log(`  (pixel ratio ${pr}, not ${DPR}: waiting)`); await page.waitForTimeout(600); continue; }
    const A = await frame(page, 150);
    const A2 = await frame(page, 80);
    const drift = diffMask(A, A2).reduce((n, v) => n + v, 0);
    if (drift > 30) { await page.waitForTimeout(500); continue; }
    await hide(page, 'visitor', 'all', true);
    const B = await frame(page, 120);
    await hide(page, 'visitor', 'all', false);
    let hairM = new Uint8Array(A.width * A.height);
    if (withHair) {
      await hide(page, 'visitor', 'hair', true);
      const C = await frame(page, 120);
      await hide(page, 'visitor', 'hair', false);
      hairM = diffMask(A, C);
    }
    const m = diffMask(A, B);
    const bb = bbox(m, A.width, A.height);
    if (!bb) return [];
    const samples = edgeSamples(A, m, hairM, bb, dsf);
    const classes = await classifyInPage(page, samples.map((s) => [s.ox, s.oy]), { w: A.width, h: A.height }, lay.rooms);
    return samples.map((s, i) => ({ zone: s.zone, ratio: s.ratio, backdrop: classes[i] }));
  }
  console.log('  (gave up: the frame kept changing)');
  return [];
}

const defaults = { skinTone: 'skin-04', hairStyle: 'short-crop', hairColor: 'dark-brown', outfitStyle: 'shirt-trousers', outfitColor: 'navy', outfitPattern: 'plain', facialHair: 'none', bodyType: 'regular', height: 'medium', gender: 'neutral' };

/** The cases: each is one avatar configuration, measured at every place and pooled. */
const cases = [];
for (const style of QUICK ? ['short-crop', 'curly-short', 'bob'] : styles) {
  for (const colour of QUICK ? ['black', 'blonde', 'pink'] : HAIR_COLOURS) cases.push({ sweep: 'hair', option: colour, style, avatar: { ...defaults, hairStyle: style, hairColor: colour } });
}
for (const colour of OUTFIT_COLOURS) cases.push({ sweep: 'outfit', option: colour, avatar: { ...defaults, outfitColor: colour } });
if (flag('patterns')) for (const pattern of PATTERNS) for (const colour of PATTERN_COLOURS) cases.push({ sweep: `pattern-${pattern}`, option: colour, avatar: { ...defaults, outfitColor: colour, outfitPattern: pattern } });
if (flag('skin')) for (const skin of SKINS) cases.push({ sweep: 'skin', option: skin, avatar: { ...defaults, skinTone: skin } });

// The first case of a run is polluted by extra samples (647 against about 213): measure one warm-up case and throw it away.
{
  const warm = { ...defaults, hairStyle: 'short-crop', hairColor: 'brown' };
  await applyAvatar(warm);
  for (const placeName of Object.keys(PLACES)) { await place(placeName); await measure(true); }
  console.log('warm-up case measured and discarded');
}
const pooled = cases.map(() => []);
for (const [i, c] of cases.entries()) {
  await applyAvatar(c.avatar);
  for (const placeName of Object.keys(PLACES)) {
    await place(placeName);
    pooled[i].push(...(await measure(c.sweep === 'hair')));
  }
  if ((i + 1) % 10 === 0 || i === cases.length - 1) console.log(`${i + 1} of ${cases.length} cases measured`);
}

const rows = [];
const fails = [];
for (const [i, c] of cases.entries()) {
  const row = { sweep: c.sweep, option: c.option, ...(c.style ? { style: c.style } : {}), backdrops: {} };
  for (const backdrop of new Set(pooled[i].map((s) => s.backdrop))) {
    const zones = {};
    for (const zone of ['hair', 'head', 'torso', 'legs']) {
      const v = pooled[i].filter((s) => s.backdrop === backdrop && s.zone === zone).map((s) => s.ratio);
      if (v.length) zones[zone] = { n: v.length, median: median(v) };
    }
    row.backdrops[backdrop] = zones;
    if (!REPORTED.includes(backdrop)) continue;
    for (const [zone, z] of Object.entries(zones)) {
      if (z.n < MIN_SAMPLES || z.median >= 3) continue;
      const label = `${backdrop} ${c.sweep} ${c.style ? c.style + ' ' : ''}${c.option}: ${zone} median ${z.median} (${z.n} samples)`;
      const accepted = acceptedClass(c, backdrop, zone);
      if (accepted) (row.accepted ??= []).push(`${accepted}: ${backdrop} ${zone}`); else fails.push(label);
    }
  }
  rows.push(row);
}
const accepted = rows.filter((r) => r.accepted);
save(`${browserName}-edge-contrast-dpr${DPR}${SCREEN === 3 ? '' : `-screen${SCREEN}`}`, { browserName, viewport: `360x640, screen scale ${SCREEN}, render pixel ratio ${DPR}`, places: PLACES, rows, accepted: accepted.flatMap((r) => r.accepted.map((a) => `${a} (${r.style ?? ''} ${r.option})`)), failures: fails });

// Summary table: the worst (lowest) reported median per sweep value and backdrop.
console.log('\nLowest median per sweep, over zones with at least', MIN_SAMPLES, 'samples (oak / runner / finale-wall):');
for (const sweep of [...new Set(rows.map((r) => r.sweep))]) {
  const line = [];
  for (const backdrop of REPORTED) {
    let worst = null;
    for (const r of rows.filter((x) => x.sweep === sweep)) for (const [zone, z] of Object.entries(r.backdrops[backdrop] ?? {})) if (z.n >= MIN_SAMPLES && (worst === null || z.median < worst.v)) worst = { v: z.median, at: `${r.style ?? ''} ${r.option} ${zone}`.trim() };
    line.push(`${backdrop} ${worst ? `${worst.v} (${worst.at})` : 'no samples'}`);
  }
  console.log(`  ${sweep}: ${line.join(' | ')}`);
}
console.log('\nAccepted exceptions seen:', accepted.flatMap((r) => r.accepted).join('; ') || 'none');
console.log(`\n${cases.length} cases, ${fails.length} zone results under 3:1 outside X-1 to X-8`);
for (const f of fails) console.log('  FAIL', f);
await browser.close();
process.exit(fails.length && !STRETCH ? 1 : 0);
