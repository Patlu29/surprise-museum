import { expect, test, type Page } from '@playwright/test';
import { createMuseum, openVisit, startVisit, trackProblems, waitForSnap, type PageGlobals } from './support/app';
import {
  bottom,
  cardInfo,
  enterVisit,
  fixRects,
  intersectionArea,
  intersects,
  leavePicture,
  right,
  sceneRects,
  standAndFrame,
  VIEWPORTS,
  type CardInfo,
  type Rect,
} from './support/presentation';

/*
 * Caption card, design spec 3.5 (v1.4): readable strip, fitted card, upgrade rule, widths. Acceptance
 * criteria S1, S3, S4, S5, S6, S7, U1, U5, U7, U8 and G1 (the frontend-developer left S1, S3, S4, S7 except at
 * 1280, U7, U8 and G1 for QA). S2 is checked in passing. U2 to U4 and U6 are unit-tested by the developer.
 */

/** Text of exactly `n` characters made of short words, ending in a full stop. */
function words(n: number, seed: string): string {
  const base = `${seed} the quiet light on the water, a long afternoon, laughing, salt on our skin and nowhere to be `;
  let out = '';
  while (out.length < n) out += base;
  const cut = out.slice(0, n - 1).replace(/\s+$/, '');
  return `${cut}.`.padEnd(n, '.').slice(0, n);
}
const CAPTIONS = [words(30, 'Short'), words(140, 'Medium'), words(280, 'Long')];
const LABELS = ['short (30)', 'medium (140)', 'long (280)'];
const LONG_GUIDE_NAME = 'Alexandra Montgomery-Ray'; // 24 characters

const BUG_7 =
  'BUG-7 (frontend-developer): the card never upgrades. The top bar is a keepOut rectangle, the dock starts 12 px below it (CLEARANCE_BELOW_BARS) and the upgrade test grows every candidate by 16 px (UPGRADE_CLEARANCE), so every candidate touches the top bar. Remove this line when fixed.';

const BUG_9 =
  'BUG-9 (frontend-developer): at 844x390 the card is 256 px wide but its header needs 260 px (fitted or full) or 288 px (strip with Read more), so Close is cut off by 4 to 32 px (spec S4). Remove this line when fixed.';
const BUG_10 =
  'BUG-10 (scene-developer, frontend-developer): at 360x640 with caption size 1.5 the 124 px strip covers the Guide name label; the framing reserves only the 104 px strip (spec 3.5 footprint). Remove this line when fixed.';

const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|girlfriend|boyfriend)\b/i;

test.describe('caption card, spec 3.5 v1.4', () => {
  test.setTimeout(300_000);

  async function museumWith(page: Page, guideName: string) {
    const m = await createMuseum(page, { photos: 3, captions: CAPTIONS, guideName, closingMessage: 'Thank you for visiting.' });
    return m;
  }

  /** Stand at a picture and wait for the card, then for its placement to hold still for 500 ms. */
  async function showCard(page: Page, index: number): Promise<CardInfo> {
    await standAndFrame(page, index);
    await expect(page.locator('.caption-card')).toBeVisible({ timeout: 20_000 });
    let last = JSON.stringify((await cardInfo(page))?.rect);
    let stableSince = Date.now();
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(150);
      const now = JSON.stringify((await cardInfo(page))?.rect);
      if (now !== last) {
        last = now;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= 600) break;
    }
    return (await cardInfo(page))!;
  }

  const stripHeight = { normal: 104, large: 112, xlarge: 124 } as const;

  function checkCard(vp: { width: number; height: number }, info: CardInfo, label: string, scale: 'normal' | 'large' | 'xlarge', rects: Awaited<ReturnType<typeof sceneRects>>) {
    const where = `${label} at ${vp.width}x${vp.height}, size ${info.size}`;
    const card = info.rect;
    // S1 readable caption: the first line is inside the card, below the header, with a real height.
    const first = info.text.firstLine;
    expect(first, `${where}: first caption line exists`).not.toBeNull();
    expect(first!.y, `${where}: first line is below the header`).toBeGreaterThanOrEqual(bottom(info.header) - 0.5);
    expect(bottom(first!), `${where}: first line inside the card`).toBeLessThanOrEqual(bottom(card) + 0.5);
    expect(first!.x, `${where}: first line inside left`).toBeGreaterThanOrEqual(card.x - 0.5);
    expect(right(first!), `${where}: first line inside right`).toBeLessThanOrEqual(right(card) + 0.5);
    expect(first!.height, `${where}: first line has a line's height`).toBeGreaterThanOrEqual(info.text.lineHeight * 0.7);
    if (info.size === 'strip') {
      // Two lines are visible when the caption has two or more; one when it has one.
      const expected = Math.min(2, info.text.totalLines);
      expect(info.text.visibleLines, `${where}: visible caption lines in the strip`).toBeGreaterThanOrEqual(expected);
      expect(info.text.visibleLines, `${where}: the strip shows no more than two lines`).toBeLessThanOrEqual(2);
      // S2: strip size.
      expect(Math.abs(card.height - stripHeight[scale]), `${where}: strip height ${card.height}`).toBeLessThanOrEqual(1.5);
      expect(card.width, `${where}: strip width`).toBeGreaterThanOrEqual(Math.min(256, vp.width) - 0.5);
      expect(Math.abs(info.header.height - 44), `${where}: header row is 44 px`).toBeLessThanOrEqual(1.5);
    }
    // S4 controls.
    expect(info.close.width, `${where}: Close width`).toBeGreaterThanOrEqual(44 - 0.5);
    expect(info.close.height, `${where}: Close height`).toBeGreaterThanOrEqual(44 - 0.5);
    for (const c of [info.close, ...(info.look ? [info.look] : []), ...(info.toggle ? [info.toggle] : [])]) {
      expect(c.x, `${where}: control not clipped on the left`).toBeGreaterThanOrEqual(card.x - 0.5);
      expect(right(c), `${where}: control not clipped on the right`).toBeLessThanOrEqual(right(card) + 0.5);
      expect(c.y, `${where}: control not clipped at the top`).toBeGreaterThanOrEqual(card.y - 0.5);
      expect(bottom(c), `${where}: control not clipped at the bottom`).toBeLessThanOrEqual(bottom(card) + 0.5);
      expect(c.height, `${where}: control height`).toBeGreaterThanOrEqual(44 - 0.5);
    }
    for (let i = 0; i < info.controls.length; i++) {
      for (let j = i + 1; j < info.controls.length; j++) {
        expect(intersectionArea(info.controls[i]!, info.controls[j]!), `${where}: controls ${i} and ${j} overlap`).toBeLessThanOrEqual(1);
      }
    }
    // The name is not wrapped one letter per line, and it has room (5.5 rem = 88 px).
    expect(info.name.height, `${where}: the name stays on one line`).toBeLessThanOrEqual(info.name.lineHeight * 1.6);
    expect(info.name.width, `${where}: the name box is at least 5.5 rem wide`).toBeGreaterThanOrEqual(88 - 1);
    // No horizontal scrolling.
    expect(info.scrollWidth, `${where}: card scrolls horizontally`).toBeLessThanOrEqual(info.clientWidth + 1);
    expect(info.viewport.docOverflow, `${where}: page scrolls horizontally`).toBeLessThanOrEqual(0);
    // The card is on screen.
    expect(card.x).toBeGreaterThanOrEqual(-0.5);
    expect(card.y).toBeGreaterThanOrEqual(-0.5);
    expect(right(card)).toBeLessThanOrEqual(vp.width + 0.5);
    expect(bottom(card)).toBeLessThanOrEqual(vp.height + 0.5);
    // S5 footprint: clear of the picture grown by 8 px, or (only if forced) a strip with limited overlap.
    if (rects.picture && intersects(card, rects.picture, 8)) {
      expect(info.size, `${where}: only a strip may overlap the picture`).toBe('strip');
      const area = intersectionArea(card, rects.picture);
      expect(area / (rects.picture.width * rects.picture.height), `${where}: overlap of the picture`).toBeLessThanOrEqual(0.15);
      const centre: Rect = { x: rects.picture.x + rects.picture.width / 3, y: rects.picture.y + rects.picture.height / 3, width: rects.picture.width / 3, height: rects.picture.height / 3 };
      expect(intersects(card, centre), `${where}: strip over the centre third of the picture`).toBe(false);
    }
    for (const who of ['visitor', 'guide'] as const) {
      const r = rects[who];
      if (r) expect(intersects(card, r), `${where}: card overlaps the ${who}`).toBe(false);
    }
  }

  for (const vp of VIEWPORTS) {
    test(`S1 S3 S4 S5 at ${vp.width}x${vp.height}: short, 140 and 280 character captions at scale 1 (Guide "Sam")`, async ({ page }, testInfo) => {
      test.fail(vp.width === 844, BUG_9);
      const problems = trackProblems(page);
      const m = await museumWith(page, 'Sam');
      await enterVisit(page, m.shareToken, vp);
      const seen: Array<Record<string, unknown>> = [];
      for (let i = 0; i < 3; i++) {
        const info = await showCard(page, i);
        const rects = await sceneRects(page);
        seen.push({ caption: LABELS[i], size: info.size, dock: info.dock, rect: info.rect, totalLines: info.text.totalLines, visibleLines: info.text.visibleLines, overflowing: info.text.overflowing });
        checkCard(vp, info, LABELS[i]!, 'normal', rects);
        // S3: truncation and Read more.
        if (info.size === 'strip') {
          // The truncation test must agree with the caption's real length (the unclamped copy), in every engine.
          expect(info.text.overflowing, `${LABELS[i]}: truncation detected exactly when the caption is longer than two lines (natural ${info.text.naturalLines} lines)`).toBe(info.text.naturalLines > 2);
          if (info.text.naturalLines > 2) {
            expect(info.toggle, `${LABELS[i]}: Read more shown when the caption is cut off`).not.toBeNull();
            expect(info.toggle!.label).toBe('Read more');
            expect(info.toggle!.expanded).toBe('false');
            expect(info.toggle!.height).toBeGreaterThanOrEqual(43.5);
            expect(info.look, 'Look closer gives way to Read more').toBeNull();
            // Expand in place: aria-expanded true, label Show less, focus stays on the button.
            const toggle = page.locator('.caption-card__toggle');
            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await expect(toggle).toHaveText('Show less');
            await expect(toggle).toBeFocused();
            const open = (await cardInfo(page))!;
            expect(open.rect.height, 'the card grew in place').toBeGreaterThan(info.rect.height + 4);
            expect(open.text.firstLine!.y, 'first line below the header when expanded').toBeGreaterThanOrEqual(bottom(open.header) - 0.5);
            expect(bottom(open.rect)).toBeLessThanOrEqual(vp.height + 0.5);
            await toggle.click();
            await expect(toggle).toHaveText('Read more');
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
            await expect(toggle).toBeFocused();
          } else {
            expect(info.toggle, `${LABELS[i]}: no Read more when the caption fits`).toBeNull();
            expect(info.look, 'Look closer is shown when the caption fits').not.toBeNull();
            expect(info.look!.height).toBeGreaterThanOrEqual(43.5);
            expect(info.look!.width).toBeGreaterThanOrEqual(43.5);
          }
        } else {
          expect(info.toggle, `${LABELS[i]}: no Read more outside a strip`).toBeNull();
          expect(info.look, `${LABELS[i]}: Look closer is shown`).not.toBeNull();
        }
        await leavePicture(page);
      }
      await testInfo.attach('placements.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' });
      testInfo.annotations.push({ type: 'placements', description: JSON.stringify(seen.map((s) => `${s.caption}: ${s.size}/${s.dock} ${Math.round((s.rect as Rect).width)}x${Math.round((s.rect as Rect).height)}`)) });
      problems.expectClean();
    });

    test(`S1 S2 S4 at ${vp.width}x${vp.height}: scale 1.5 and a 24-character Guide name`, async ({ page }) => {
      test.fail(vp.width === 844, BUG_9);
      test.fail(vp.width === 360, BUG_10);
      const m = await museumWith(page, LONG_GUIDE_NAME);
      expect(LONG_GUIDE_NAME).toHaveLength(24);
      await enterVisit(page, m.shareToken, vp);
      await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('xlarge')`);
      for (const i of [0, 2]) {
        const info = await showCard(page, i);
        const rects = await sceneRects(page);
        checkCard(vp, info, `${LABELS[i]}, scale 1.5, name of 24`, 'xlarge', rects);
        await leavePicture(page);
      }
    });
  }

  test('S6 at 390x844: the 140-character caption sits in a fitted card of about 168 px with at least three lines visible, not a strip', async ({ page }) => {
    const m = await museumWith(page, 'Sam');
    await enterVisit(page, m.shareToken, { width: 390, height: 844 });
    const info = await showCard(page, 1);
    expect(info.size).toBe('fitted');
    expect(Math.abs(info.rect.height - 168), `fitted height ${info.rect.height}`).toBeLessThanOrEqual(16);
    expect(info.text.visibleLines).toBeGreaterThanOrEqual(3);
    expect(info.dock).toBe('top');
  });

  const WIDTHS: Array<{ w: number; h: number; expect: [number, number]; note: string }> = [
    { w: 844, h: 390, expect: [255, 257], note: 'landscape card at 844: 256' },
    { w: 932, h: 430, expect: [270, 281], note: 'landscape card at 932: 270 to 280' },
    { w: 1200, h: 500, expect: [351, 353], note: 'landscape card at 1,200: 352' },
    { w: 1280, h: 720, expect: [357, 359], note: 'wide card at 1280: 358' },
    { w: 1024, h: 768, expect: [287, 289], note: 'wide card at 1024: 288' },
  ];
  for (const c of WIDTHS) {
    test(`S7 widths at ${c.w}x${c.h}: ${c.note}; left edge clear of the framed picture and characters`, async ({ page }, testInfo) => {
      const m = await museumWith(page, 'Sam');
      await enterVisit(page, m.shareToken, { width: c.w, height: c.h });
      const info = await showCard(page, 1);
      const rects = await sceneRects(page);
      testInfo.annotations.push({ type: 'placed', description: `${info.size} ${info.dock} ${Math.round(info.rect.width)}x${Math.round(info.rect.height)} at x ${Math.round(info.rect.x)}` });
      if (info.dock === 'right') {
        expect(info.rect.width, `card width ${info.rect.width}`).toBeGreaterThanOrEqual(c.expect[0]);
        expect(info.rect.width).toBeLessThanOrEqual(c.expect[1]);
        // The card's left edge is at or right of every framed rectangle's right edge (6.12.2, right bound R).
        const edge = Math.max(...(['picture', 'visitor', 'guide'] as const).map((k) => (rects[k] ? right(rects[k]!) : 0)));
        expect(info.rect.x, `card left ${info.rect.x} vs framed right edge ${edge}`).toBeGreaterThanOrEqual(edge - 0.5);
      } else {
        testInfo.annotations.push({ type: 'not-right-dock', description: `${info.dock}: width check skipped` });
        expect(info.rect.width).toBeGreaterThanOrEqual(256 - 0.5);
      }
    });
  }

  test('G1 copy: the strip, fitted and full card text and labels contain no gendered pronoun, whatever the size', async ({ page }) => {
    const m = await museumWith(page, 'Sam');
    const seenSizes = new Set<string>();
    const texts: string[] = [];
    for (const vp of VIEWPORTS) {
      await enterVisit(page, m.shareToken, vp);
      for (const i of [1, 2]) {
        const info = await showCard(page, i);
        seenSizes.add(info.size);
        // Everything the app wrote on the card: visible text and accessible names, minus the Creator's own words.
        texts.push(
          (await page.evaluate(`(() => {
            const card = globalThis.document.querySelector('.caption-card');
            const clone = card.cloneNode(true);
            clone.querySelectorAll('.user-text').forEach((n) => n.remove());
            const labels = [...clone.querySelectorAll('[aria-label],[title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('title'));
            return clone.innerText + ' ' + (card.getAttribute('aria-labelledby') || '') + ' ' + labels.join(' ');
          })()`)) as string,
        );
        await leavePicture(page);
      }
    }
    for (const t of texts) expect(t.match(PRONOUNS), `card copy: ${t}`).toBeNull();
    expect(seenSizes.size, 'more than one card size was exercised').toBeGreaterThanOrEqual(2);
  });

  test.describe('upgrade rule fixtures (U1, U5, U7, U8)', () => {
    type Size = { width: number; height: number };
    const PORTRAIT: Size = { width: 390, height: 844 };
    const WIDE: Size = { width: 1280, height: 720 };

    /**
     * Place the card as a strip by blocking everything below the strip with a fixed Guide rectangle that
     * starts 190 px down (the strip ends near 168 px; Full and Fitted need more room). The scene's own
     * rectangles are ignored while the fixture holds.
     */
    async function stripFixture(page: Page, size: Size = WIDE) {
      const m = await museumWith(page, 'Sam');
      await enterVisit(page, m.shareToken, size);
      await fixRects(page, {
        picture: { x: 40, y: size.height - 300, width: 200, height: 180 },
        visitor: { x: 240, y: size.height - 280, width: 110, height: 260 },
        guide: { x: 0, y: 190, width: size.width, height: 120 },
      });
      return showCard(page, 0);
    }
    const clearBlocker = (page: Page) => fixRects(page, { guide: { x: 0, y: 3000, width: 100, height: 100 } });

    /** Record placement changes and live region text from now on. */
    async function watch(page: Page) {
      await page.evaluate(`(() => {
        const g = globalThis; g.__qaWatch = { changes: [], live: [], el: null };
        const card = g.document.querySelector('.caption-card'); g.__qaWatch.el = card; card.__qaTag = 'original';
        let size = card.dataset.cardSize;
        const tick = () => { const c = g.document.querySelector('.caption-card'); if (c && c.dataset.cardSize !== size) { g.__qaWatch.changes.push({ t: performance.now(), from: size, to: c.dataset.cardSize, tag: c.__qaTag || null }); size = c.dataset.cardSize; } g.requestAnimationFrame(tick); };
        tick();
        let last = '';
        new g.MutationObserver(() => { const t = [...g.document.querySelectorAll('[role=status][aria-live=polite]')].map((e) => e.textContent).join('|'); if (t !== last) { last = t; g.__qaWatch.live.push({ t: performance.now(), text: t }); } }).observe(g.document.documentElement, { subtree: true, childList: true, characterData: true });
      })()`);
    }
    const watched = (page: Page) =>
      page.evaluate(`globalThis.__qaWatch`) as Promise<{ changes: Array<{ t: number; from: string; to: string; tag: string | null }>; live: Array<{ t: number; text: string }> }>;

    for (const size of [WIDE, PORTRAIT]) {
    test(`U1 at ${size.width}x${size.height}: the card upgrades once, 600 to 800 ms after the blocker clears, on the same element, with focus unchanged`, async ({ page }) => {
      test.fail(true, BUG_7);
      const info = await stripFixture(page, size);
      expect(info.size, 'the fixture forces a strip').toBe('strip');
      await page.waitForTimeout(2500); // past any cool-down
      await watch(page);
      const focusBefore = await page.evaluate(`globalThis.document.activeElement && globalThis.document.activeElement.tagName`);
      const clearedAt = await page.evaluate(() => performance.now());
      await clearBlocker(page);
      await expect.poll(async () => (await watched(page)).changes.length, { timeout: 4000 }).toBeGreaterThan(0);
      const w = await watched(page);
      expect(w.changes, 'one upgrade').toHaveLength(1);
      const delay = w.changes[0]!.t - clearedAt;
      expect(['fitted', 'full']).toContain(w.changes[0]!.to);
      // 600 ms dwell on 100 ms samples; software rendering can stretch a sample, so allow 500 to 1,100 ms.
      expect(delay, `upgrade ${Math.round(delay)} ms after the blocker cleared`).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1100);
      expect(w.changes[0]!.tag, 'the same DOM element (no remount)').toBe('original');
      expect(await page.evaluate(`globalThis.document.activeElement && globalThis.document.activeElement.tagName`)).toBe(focusBefore);
      await page.waitForTimeout(1500);
      expect((await watched(page)).changes.length, 'no further change').toBeLessThanOrEqual(2);
    });
    }

    test('U5 no upgrade while focus is inside the card; it follows 600 ms after the focus leaves', async ({ page }) => {
      test.fail(true, BUG_7);
      const info = await stripFixture(page);
      expect(info.size).toBe('strip');
      await page.waitForTimeout(2500);
      await watch(page);
      await page.getByRole('button', { name: 'Close caption' }).focus();
      await clearBlocker(page);
      await page.waitForTimeout(2500);
      expect((await watched(page)).changes, 'held while focus is in the card').toHaveLength(0);
      const blurredAt = await page.evaluate(() => { (globalThis as unknown as { document: { activeElement: { blur(): void } } }).document.activeElement.blur(); return performance.now(); });
      await expect.poll(async () => (await watched(page)).changes.length, { timeout: 4000 }).toBeGreaterThan(0);
      const delay = (await watched(page)).changes[0]!.t - blurredAt;
      expect(delay, `upgrade ${Math.round(delay)} ms after focus left`).toBeGreaterThanOrEqual(500);
    });

    test('U8 an upgrade causes no live-region update (cannot be reached: needs an upgrade, BUG-7)', async ({ page }) => {
      test.fail(true, BUG_7);
      const info = await stripFixture(page);
      expect(info.size).toBe('strip');
      await page.waitForTimeout(2500);
      await watch(page);
      const before = (await watched(page)).live.length;
      await clearBlocker(page);
      await expect.poll(async () => (await watched(page)).changes.length, { timeout: 4000 }).toBeGreaterThan(0);
      await page.waitForTimeout(800);
      expect((await watched(page)).live.length, 'live region messages during the upgrade').toBe(before);
    });

    test.describe('reduced motion', () => {
      test.use({ reducedMotion: 'reduce' });
      test('U7 with reduced motion the upgrade is instant: no cross-fade, same timers', async ({ page }) => {
        test.fail(true, BUG_7);
        const info = await stripFixture(page);
        expect(info.size).toBe('strip');
        await page.waitForTimeout(2500);
        await watch(page);
        const clearedAt = await page.evaluate(() => performance.now());
        await clearBlocker(page);
        await expect.poll(async () => (await watched(page)).changes.length, { timeout: 4000 }).toBeGreaterThan(0);
        const delay = (await watched(page)).changes[0]!.t - clearedAt;
        expect(delay, 'same dwell as without reduced motion').toBeGreaterThanOrEqual(500);
        const animation = await page.evaluate(`(() => { const c = globalThis.document.querySelector('.caption-card'); const s = globalThis.getComputedStyle(c); return { duration: s.animationDuration, name: s.animationName, transition: s.transitionDuration }; })()`) as { duration: string; name: string; transition: string };
        expect(parseFloat(animation.duration), `cross-fade duration after the upgrade: ${JSON.stringify(animation)}`).toBe(0);
      });
    });
  });
});

// Keep these imports in use for the type checker.
export type { PageGlobals };
void openVisit;
void startVisit;
void waitForSnap;
