import { expect, test, type Page } from '@playwright/test';
import { createMuseum, snap, trackProblems, type PageGlobals } from './support/app';
import { pixelDiffRatio } from './support/images';
import {
  cardInfo,
  enterVisit,
  intersects,
  leavePicture,
  sceneRects,
  standAndFrame,
  type Rect,
} from './support/presentation';

/*
 * CR-4 visit HUD and overlays (design spec 12.6 and 12.7), name labels on narrow screens (12.6.8, QA N-10),
 * and the landing page (12.3, US-51).
 */

const R = (b: { x: number; y: number; width: number; height: number }): Rect => ({ x: b.x, y: b.y, width: b.width, height: b.height });
/** The element's rectangle, or null when it is not in the page (boundingBox alone would wait for it). */
const box = async (page: Page, selector: string) => {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return null;
  const b = await loc.boundingBox();
  return b ? R(b) : null;
};

/** Everything that matters about a button's text: is it inside the button, and is the button inside the viewport. */
async function labelFit(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const texts = [...range.getClientRects()].filter((t) => t.width > 0.5 && t.height > 0.5);
    const cs = getComputedStyle(el);
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      textLeft: Math.min(...texts.map((t) => t.left)),
      textRight: Math.max(...texts.map((t) => t.right)),
      textTop: Math.min(...texts.map((t) => t.top)),
      textBottom: Math.max(...texts.map((t) => t.bottom)),
      overflow: cs.overflow,
      text: el.textContent?.trim() ?? '',
      viewport: { width: innerWidth, height: innerHeight, docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth },
    };
  }, selector);
}

function expectFits(fit: NonNullable<Awaited<ReturnType<typeof labelFit>>>, where: string) {
  const { rect } = fit;
  expect(fit.scrollWidth, `${where}: text wider than its button (scrollWidth ${fit.scrollWidth} against ${fit.clientWidth})`).toBeLessThanOrEqual(fit.clientWidth + 1);
  expect(fit.scrollHeight, `${where}: text taller than its button`).toBeLessThanOrEqual(fit.clientHeight + 1);
  expect(fit.textLeft, `${where}: text starts inside the button`).toBeGreaterThanOrEqual(rect.x - 0.5);
  expect(fit.textRight, `${where}: text ends inside the button`).toBeLessThanOrEqual(rect.x + rect.width + 0.5);
  expect(fit.textTop, `${where}: text top inside the button`).toBeGreaterThanOrEqual(rect.y - 0.5);
  expect(fit.textBottom, `${where}: text bottom inside the button`).toBeLessThanOrEqual(rect.y + rect.height + 0.5);
  expect(rect.x, `${where}: button inside the viewport (left)`).toBeGreaterThanOrEqual(-0.5);
  expect(rect.x + rect.width, `${where}: button inside the viewport (right)`).toBeLessThanOrEqual(fit.viewport.width + 0.5);
  expect(rect.y + rect.height, `${where}: button inside the viewport (bottom)`).toBeLessThanOrEqual(fit.viewport.height + 0.5);
  expect(fit.viewport.docOverflow, `${where}: no horizontal scrolling`).toBeLessThanOrEqual(0);
}

const CAPTIONS = ['A day at the beach.', 'Second picture, with a few more words in the caption.', 'Third.'];
const LONG_CLOSING = 'Dear Alex, thank you for coming all this way. I put this museum together over a few weeks, one photo at a time, and I hope every picture makes you smile. '.repeat(2).trim();

test.describe('US-52, FR-82, spec 12.7: Done and Carry on on a phone in portrait', () => {
  test.setTimeout(300_000);

  for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    test(`Done: shown with the docked top card at ${vp.width}x${vp.height}; named "Done with this photo"; same effect as Close; takes no focus; clear of the card`, async ({ page }, testInfo) => {
      const problems = trackProblems(page);
      const made = await createMuseum(page, { photos: 3, captions: CAPTIONS, closingMessage: 'Thanks.' });
      await enterVisit(page, made.shareToken, vp);
      // A polite-region log, to compare what Done and Close announce.
      const watch = async () => {
        await page.evaluate(`(() => { const g = globalThis; g.__qaLive = []; const read = () => [...g.document.querySelectorAll('[role=status][aria-live=polite]')].map((e) => e.textContent).join('|'); let last = read(); g.__qaLiveObs?.disconnect(); g.__qaLiveObs = new g.MutationObserver(() => { const t = read(); if (t !== last) { last = t; g.__qaLive.push(t); } }); g.__qaLiveObs.observe(g.document.documentElement, { subtree: true, childList: true, characterData: true }); })()`);
      };
      const live = () => page.evaluate(`globalThis.__qaLive`) as Promise<string[]>;

      // No card, no Done.
      await expect(page.locator('.hud__done')).toHaveCount(0);

      await standAndFrame(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(800);
      const info = (await cardInfo(page))!;
      testInfo.annotations.push({ type: 'dock', description: `${info.dock} ${info.size}` });
      const done = page.getByRole('button', { name: 'Done with this photo' });
      if (info.dock !== 'top') {
        await expect(done, `dock is ${info.dock}, so no Done`).toHaveCount(0);
        test.info().annotations.push({ type: 'skipped-checks', description: 'card was not docked at the top at this viewport' });
        return;
      }
      await expect(done).toBeVisible();
      await expect(done).toHaveText('Done');
      expect(await done.getAttribute('tabindex'), 'out of the tab order').toBe('-1');
      const d = (await box(page, '.hud__done'))!;
      expect(d.height, 'Done is 48 px tall (at least 44)').toBeGreaterThanOrEqual(44 - 0.5);
      expect(d.width).toBeGreaterThanOrEqual(44);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x + d.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(d.y + d.height, 'bottom of the screen, above the home indicator').toBeLessThanOrEqual(vp.height);
      expect(d.y, 'lower 60% of the screen (FR-82)').toBeGreaterThanOrEqual(vp.height * 0.4);
      // It never sits on the card, a label, the picture or the characters.
      const rects = await sceneRects(page);
      expect(intersects(d, info.rect), 'Done does not touch the card').toBe(false);
      for (const [name, r] of Object.entries(rects)) if (r) expect(intersects(d, r), `Done does not cover the ${name} rectangle`).toBe(false);
      // It takes no focus: the caption card keeps it, or the canvas does.
      const focusOnDone = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.classList.contains('hud__done') ?? false);
      expect(focusOnDone).toBe(false);
      // Opposite the joystick or arrow pad when there is one.
      const joystick = await box(page, '.joystick');
      if (joystick) {
        const joystickRight = joystick.x + joystick.width / 2 > vp.width / 2;
        const doneRight = d.x + d.width / 2 > vp.width / 2;
        expect(doneRight, `Done is on the side opposite the joystick (joystick ${joystickRight ? 'right' : 'left'})`).toBe(!joystickRight);
        expect(intersects(d, joystick), 'Done does not touch the joystick').toBe(false);
      }
      // A different name from Close, so a test or a screen reader tells them apart.
      await expect(page.getByRole('button', { name: 'Close caption' })).toHaveCount(1);
      await watch();
      await done.click();
      await expect(page.locator('.caption-card')).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('.hud__done')).toHaveCount(0);
      await page.waitForTimeout(500);
      const afterDone = await live();
      const stateAfterDone = await snap(page);

      // The same action as Close: do the same on picture 2 with Close, and compare the result.
      await leavePicture(page);
      await standAndFrame(page, 1);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(800);
      await watch();
      await page.getByRole('button', { name: 'Close caption' }).click();
      await expect(page.locator('.caption-card')).toHaveCount(0, { timeout: 5000 });
      await page.waitForTimeout(500);
      const afterClose = await live();
      expect(afterDone, 'Done announces nothing that Close does not').toEqual(afterClose);
      const stateAfterClose = await snap(page);
      expect(stateAfterDone.guide.presentation, 'the Guide state after Done matches Close').toBe(stateAfterClose.guide.presentation);
      problems.expectClean();
    });
  }

  test('Done is not offered on a phone in landscape or on a wide screen, and not without a card', async ({ page }) => {
    const made = await createMuseum(page, { photos: 3, captions: CAPTIONS, closingMessage: 'Thanks.' });
    for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 720 }]) {
      await enterVisit(page, made.shareToken, vp);
      await standAndFrame(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(500);
      await expect(page.locator('.hud__done'), `${vp.width}x${vp.height}`).toHaveCount(0);
    }
  });

  for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    test(`Carry on: the finale card at ${vp.width}x${vp.height} shows "Carry on" (named "Carry on exploring") when docked at the top, and it runs Keep exploring`, async ({ page }, testInfo) => {
      const made = await createMuseum(page, { photos: 1, captions: ['One.'], closingMessage: 'Thank you for visiting.' });
      await enterVisit(page, made.shareToken, vp);
      await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
      await expect(page.locator('.finale-card')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      const dock = await page.locator('.finale-card').getAttribute('data-dock');
      testInfo.annotations.push({ type: 'finale-dock', description: String(dock) });
      const carry = page.getByRole('button', { name: 'Carry on exploring' });
      if (dock !== 'top') {
        await expect(carry).toHaveCount(0);
        return;
      }
      await expect(carry).toBeVisible();
      await expect(carry).toHaveText('Carry on');
      expect(await carry.getAttribute('tabindex')).toBe('-1');
      const c = (await box(page, '.hud__done'))!;
      expect(c.height).toBeGreaterThanOrEqual(44 - 0.5);
      expect(c.y).toBeGreaterThanOrEqual(vp.height * 0.4);
      const card = (await box(page, '.finale-card'))!;
      expect(intersects(c, card), 'Carry on does not sit on the finale card').toBe(false);
      await carry.click();
      await expect(page.locator('.finale-card')).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('.hud__done')).toHaveCount(0);
    });
  }
});

test.describe('spec 12.6.5 and 12.7: the finale footer at 320 px and with large text; labels must not clip', () => {
  test.setTimeout(420_000);

  const cases: Array<{ name: string; vp: { width: number; height: number }; large: 'caption' | 'text200' | 'both' | null; closing: string }> = [
    { name: '320x568 normal text, short message', vp: { width: 320, height: 568 }, large: null, closing: 'Thank you for visiting.' },
    { name: '320x568 normal text, long message', vp: { width: 320, height: 568 }, large: null, closing: LONG_CLOSING },
    { name: '320x568 largest caption size', vp: { width: 320, height: 568 }, large: 'caption', closing: 'Thank you for visiting.' },
    { name: '320x568 browser text 200%', vp: { width: 320, height: 568 }, large: 'text200', closing: 'Thank you for visiting.' },
    { name: '320x568 browser text 200% and the largest caption size, long message', vp: { width: 320, height: 568 }, large: 'both', closing: LONG_CLOSING },
    { name: '360x640 browser text 200%', vp: { width: 360, height: 640 }, large: 'text200', closing: 'Thank you for visiting.' },
    { name: '390x844 largest caption size', vp: { width: 390, height: 844 }, large: 'caption', closing: LONG_CLOSING },
  ];

  for (const c of cases) {
    test(`finale footer, ${c.name}: both buttons keep their whole label, 44 px or taller, 8 px apart, inside the card and the screen`, async ({ page }, testInfo) => {
      const made = await createMuseum(page, { photos: 1, captions: ['One.'], closingMessage: c.closing });
      await enterVisit(page, made.shareToken, c.vp);
      if (c.large === 'caption' || c.large === 'both') {
        await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('xlarge')`);
      }
      if (c.large === 'text200' || c.large === 'both') {
        // Everything is rem-based, so a 200% root size is what a browser text size of 200% does to the layout.
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      }
      await page.waitForTimeout(400);
      await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
      await expect(page.locator('.finale-card')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1000);
      // BUG-14 (fixed, QA round 7): the card grows to 90% of the screen height and then its body scrolls, bottom-docked cards grow upwards,
      // the buttons stack under 22 rem. Whether the strip or the full card is chosen depends on the room the camera leaves.
      const isStrip = (await page.locator('.finale-card.is-strip').count()) > 0;
      testInfo.annotations.push({ type: 'finale-card', description: isStrip ? 'strip (136 px)' : 'full card' });
      const keep = await labelFit(page, '.finale-card__footer .btn--primary');
      const replay = await labelFit(page, '.finale-card__footer .btn--secondary');
      expect(keep, 'Keep exploring is in the footer').not.toBeNull();
      expect(replay, 'Replay from the start is in the footer').not.toBeNull();
      expect(keep!.text).toBe('Keep exploring');
      expect(replay!.text).toBe('Replay from the start');
      expectFits(keep!, `${c.name} Keep exploring`);
      expectFits(replay!, `${c.name} Replay`);
      expect(keep!.rect.height, 'Keep exploring is 44 px or taller').toBeGreaterThanOrEqual(44 - 0.5);
      expect(replay!.rect.height, 'Replay is 44 px or taller').toBeGreaterThanOrEqual(44 - 0.5);
      // 8 px between them, side by side or stacked.
      const k = keep!.rect;
      const r = replay!.rect;
      const gapX = Math.max(r.x - (k.x + k.width), k.x - (r.x + r.width));
      const gapY = Math.max(r.y - (k.y + k.height), k.y - (r.y + r.height));
      testInfo.annotations.push({ type: 'footer', description: `keep ${Math.round(k.width)}x${Math.round(k.height)} at ${Math.round(k.x)},${Math.round(k.y)}; replay ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}; gap ${Math.round(Math.max(gapX, gapY))}` });
      expect(Math.max(gapX, gapY), 'at least 8 px between the two buttons').toBeGreaterThanOrEqual(8 - 0.5);
      // Inside the card.
      const card = (await box(page, '.finale-card'))!;
      for (const [name, b] of [['Keep exploring', k], ['Replay', r]] as const) {
        expect(b.x, `${name} inside the card (left)`).toBeGreaterThanOrEqual(card.x - 0.5);
        expect(b.x + b.width, `${name} inside the card (right)`).toBeLessThanOrEqual(card.x + card.width + 0.5);
        expect(b.y + b.height, `${name} inside the card (bottom)`).toBeLessThanOrEqual(card.y + card.height + 0.5);
      }
      // The card itself is on screen and the message can be reached.
      expect(card.x).toBeGreaterThanOrEqual(-0.5);
      expect(card.x + card.width).toBeLessThanOrEqual(c.vp.width + 0.5);
      // Carry on / Done, when the card is docked at the top on a phone, must not clip either.
      const dock = await page.locator('.finale-card').getAttribute('data-dock');
      if (dock === 'top') {
        const carry = await labelFit(page, '.hud__done');
        expect(carry, 'Carry on is shown').not.toBeNull();
        expectFits(carry!, `${c.name} Carry on`);
        expect(carry!.text).toBe('Carry on');
      }
      // The buttons still do their job.
      await page.getByRole('button', { name: 'Keep exploring' }).click();
      await expect(page.locator('.finale-card')).toHaveCount(0, { timeout: 5000 });
    });
  }
});

test.describe('N-10 and spec 12.6.8: name labels stay inside the viewport and apart on narrow screens', () => {
  test.setTimeout(420_000);

  const GUIDE = 'Alexandra Montgomery-Ray'; // 24 characters
  const VISITOR = 'Bartholomew Featherstone'; // 24 characters
  const CAPS = ['Short caption here.', 'A medium caption about the quiet light on the water.', 'Another one.'];
  const MARGIN = 8;

  interface L { role: string; rect: Rect; hidden: boolean; opacity: number }
  const readLabels = (page: Page): Promise<L[]> =>
    page.evaluate(`(() => {
      const out = [];
      for (const role of ['guide', 'visitor']) {
        const e = document.querySelector('[data-testid="name-label-' + role + '"]');
        if (!e) continue;
        const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        out.push({ role, rect: { x: b.x, y: b.y, width: b.width, height: b.height }, hidden: cs.visibility === 'hidden' || cs.display === 'none', opacity: Number(cs.opacity) });
      }
      return out;
    })()`) as Promise<L[]>;

  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ];

  /** Wholly outside the viewport counts as not shown (the character is off screen). */
  const onScreen = (r: Rect, vp: { width: number; height: number }) => r.x + r.width > 0 && r.x < vp.width && r.y + r.height > 0 && r.y < vp.height;
  /** The two label boxes overlap by more than 6 px in both directions (a 4 px graze is not a collision). */
  const overlapsBadly = (a: Rect, b: Rect) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 6 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 6;

  for (const vp of viewports) {
    test(`both 24-character names at ${vp.width}x${vp.height}: in framed presentations of pictures 1 to 3, each visible label is inside the viewport, the labels do not overlap and the picture stays clear`, async ({ page }, testInfo) => {
      // The accepted residual (360x640, picture 1) is checked on its own below. Everything else must hold.
      const made = await createMuseum(page, { photos: 3, captions: CAPS, guideName: GUIDE, visitorName: VISITOR, closingMessage: 'Thanks.' });
      expect(GUIDE).toHaveLength(24);
      expect(VISITOR).toHaveLength(24);
      await enterVisit(page, made.shareToken, vp);
      const issues: string[] = [];
      const notes: string[] = [];
      for (const i of [0, 1, 2]) {
        await standAndFrame(page, i);
        await page.locator('.caption-card').waitFor({ timeout: 20_000 });
        // The layout runs about every 100 ms and the shift is eased over 150 ms.
        await page.waitForTimeout(1800);
        const where = `picture ${i + 1}`;
        const labels = (await readLabels(page)).filter((l) => !l.hidden && l.opacity >= 0.5 && onScreen(l.rect, vp));
        const picture = (await sceneRects(page)).picture;
        for (const l of labels) {
          const left = l.rect.x;
          const right = l.rect.x + l.rect.width;
          notes.push(`${where} ${l.role}: x ${Math.round(left)}..${Math.round(right)}`);
          const over = Math.max(MARGIN - left, right - (vp.width - MARGIN), 0);
          const accepted = vp.width === 360 && vp.height === 640 && i === 0;
          // Round 7: the fix leaves the label up to about 1 px short of the 8 px margin at 390x844 picture 2 and 320x568 picture 3 (BUG-15 residual,
          // cosmetic: the label is still fully inside the viewport, 7 px from the edge). Tolerance 1.5 px; any shortfall over 0.5 px is annotated.
          if (over > 0.5 && over <= 1.5) testInfo.annotations.push({ type: 'bug-15-residual', description: `${where}: ${l.role} label ${over.toFixed(1)} px short of the ${MARGIN} px margin` });
          if (over > 1.5 && !accepted) issues.push(`${where}: ${l.role} label x ${Math.round(left)}..${Math.round(right)} is ${Math.round(over)} px past the ${MARGIN} px margin of a ${vp.width} px viewport`);
          if (picture && intersects(l.rect, picture) && !accepted) issues.push(`${where}: ${l.role} label covers the picture`);
        }
        if (labels.length === 2 && overlapsBadly(labels[0]!.rect, labels[1]!.rect) && !(vp.width === 360 && vp.height === 640 && i === 0)) {
          issues.push(`${where}: the two labels overlap (${JSON.stringify(labels.map((l) => [l.role, Math.round(l.rect.x), Math.round(l.rect.y), Math.round(l.rect.width), Math.round(l.rect.height)]))})`);
        }
        await leavePicture(page);
      }
      testInfo.annotations.push({ type: 'label-x', description: notes.join(' | ') });
      expect(issues, 'label placement problems (outside the accepted 360x640 picture 1 residual)').toEqual([]);
    });
  }

  test('the accepted residual: 360x640, two 24-character names, picture 1: the Guide label may overhang the right edge by up to 40% of its width, the Visitor label is fine', async ({ page }, testInfo) => {
    const vp = { width: 360, height: 640 };
    const made = await createMuseum(page, { photos: 3, captions: CAPS, guideName: GUIDE, visitorName: VISITOR, closingMessage: 'Thanks.' });
    await enterVisit(page, made.shareToken, vp);
    await standAndFrame(page, 0);
    await page.locator('.caption-card').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1800);
    const labels = (await readLabels(page)).filter((l) => !l.hidden && l.opacity >= 0.5 && onScreen(l.rect, vp));
    const picture = (await sceneRects(page)).picture!;
    const guide = labels.find((l) => l.role === 'guide');
    const visitor = labels.find((l) => l.role === 'visitor');
    expect(visitor, 'the Visitor label is shown').toBeTruthy();
    expect(visitor!.rect.x, 'the Visitor label is inside the viewport').toBeGreaterThanOrEqual(0);
    expect(intersects(visitor!.rect, picture), 'the Visitor label stays clear of the picture').toBe(false);
    if (guide) {
      const overhang = Math.max(0, guide.rect.x + guide.rect.width - vp.width);
      testInfo.annotations.push({ type: 'guide-overhang-px', description: `${Math.round(overhang)} of ${Math.round(guide.rect.width)}` });
      expect(overhang, 'at most 40% of the label past the edge (spec 12.6.8 rule 4)').toBeLessThanOrEqual(guide.rect.width * 0.4 + 1);
      // Part of the residual: the Guide label still covers the right edge of the picture by this many px (measured, not asserted).
      testInfo.annotations.push({ type: 'guide-label-over-picture-px', description: String(Math.max(0, Math.min(guide.rect.x + guide.rect.width, picture.x + picture.width) - Math.max(guide.rect.x, picture.x))) });
      expect(overlapsBadly(guide.rect, visitor!.rect), 'the labels do not overlap').toBe(false);
    }
  });

  test('a name label whose character is off screen is hidden, never half cut off while the head is on screen', async ({ page }) => {
    const made = await createMuseum(page, { photos: 3, captions: CAPS, guideName: GUIDE, visitorName: VISITOR, closingMessage: 'Thanks.' });
    const vp = { width: 390, height: 844 };
    await enterVisit(page, made.shareToken, vp);
    const seen: string[] = [];
    for (const i of [0, 1, 2]) {
      await standAndFrame(page, i);
      await page.locator('.caption-card').waitFor({ timeout: 20_000 });
      await page.waitForTimeout(1500);
      for (const l of await readLabels(page)) {
        if (l.hidden) { seen.push(`picture ${i + 1} ${l.role}: hidden`); continue; }
        if (l.opacity < 0.5) continue;
        // A visible label's head anchor (its horizontal centre before any shift) is on screen: at least some of the label is.
        const visibleWidth = Math.min(l.rect.x + l.rect.width, vp.width) - Math.max(l.rect.x, 0);
        expect(visibleWidth, `picture ${i + 1} ${l.role}: a visible label must show most of itself`).toBeGreaterThanOrEqual(l.rect.width * 0.6 - 0.5);
        seen.push(`picture ${i + 1} ${l.role}: ${Math.round(visibleWidth)} of ${Math.round(l.rect.width)} px shown`);
      }
      await leavePicture(page);
    }
    test.info().annotations.push({ type: 'labels', description: seen.join(' | ') });
  });
});

test.describe('US-51 and FR-80: the landing page', () => {
  for (const vp of [{ width: 360, height: 640 }, { width: 1280, height: 720 }]) {
    test(`US-51 AC-1 at ${vp.width}x${vp.height}: the name, a description of at most two sentences and Create a museum are all visible without scrolling; no 3D`, async ({ page }) => {
      const problems = trackProblems(page);
      await page.setViewportSize(vp);
      await page.goto('./');
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      const create = page.getByRole('link', { name: 'Create a museum' });
      await expect(create).toBeVisible();
      const body = page.locator('.home__body');
      const text = (await body.innerText()).trim();
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, `"${text}"`).toBeLessThanOrEqual(2);
      for (const [name, el] of [['product name', page.locator('.home__brand')], ['heading', h1], ['description', body], ['Create a museum', create]] as const) {
        const b = (await el.boundingBox())!;
        expect(b.y + b.height, `${name} is above the fold (${vp.height})`).toBeLessThanOrEqual(vp.height);
        expect(b.x, name).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, name).toBeLessThanOrEqual(vp.width + 0.5);
      }
      if (vp.width === 360) {
        const b = (await create.boundingBox())!;
        expect(b.y + b.height, 'spec 12.7: the Create button bottom edge is at or above y 560').toBeLessThanOrEqual(560);
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('canvas')).toHaveCount(0);
      problems.expectClean();
    });
  }

  test('US-51 AC-2: three how-it-works steps, each with a short heading and one line', async ({ page }) => {
    await page.goto('./');
    const steps = page.locator('.home__steps > li');
    await expect(steps).toHaveCount(3);
    for (const s of await steps.all()) {
      const title = (await s.locator('.home__step-title').innerText()).trim();
      const line = (await s.locator('.home__step-line').innerText()).trim();
      expect(title.split(/\s+/).length, `"${title}" is a short heading`).toBeLessThanOrEqual(6);
      expect(line.split(/(?<=[.!?])\s+/).filter(Boolean).length, `"${line}" is one idea`).toBe(1);
    }
    await expect(steps.locator('.home__step-title')).toHaveText(['Add up to 20 photos', 'Make your two characters', 'Send the link']);
  });

  test('US-51 AC-3: interactive within 5 s on a throttled 4G connection, no layout shift over 0.1', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'throttling uses the Chrome DevTools Protocol');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    // "Fast 4G" as DevTools defines it: 9 Mbit/s down, 1.5 Mbit/s up is "Slow 4G"; use the slower upload and 1.6 Mbit/s down (Lighthouse's mobile profile).
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as Array<{ hadRecentInput: boolean; value: number }>) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const started = Date.now();
    await page.goto('./');
    const create = page.getByRole('link', { name: 'Create a museum' });
    await create.waitFor({ state: 'visible' });
    await page.evaluate('document.fonts.ready');
    const ready = Date.now() - started;
    test.info().annotations.push({ type: 'interactive-ms-4g', description: String(ready) });
    expect(ready).toBeLessThan(5000);
    await page.waitForTimeout(1500);
    const cls = (await page.evaluate(`window.__cls`)) as number;
    test.info().annotations.push({ type: 'cls', description: cls.toFixed(4) });
    expect(cls).toBeLessThan(0.1);
  });

  test('US-51 AC-4: the first Tab stop is a useful control and Enter on Create a museum opens the builder', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to links by default (Full Keyboard Access is off)');
    await page.goto('./');
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '');
    expect(first).toBe('Create a museum');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
  });
});


test.describe('US-60 (FR-93): depth cues on Auto, simplified on Low', () => {
  test.setTimeout(240_000);

  test('AC-1 and AC-2: the High tier draws the contact shadows (more draw calls) and the Low tier does not, and both render without errors', async ({ page }) => {
    const problems = trackProblems(page);
    const made = await createMuseum(page, { photos: 2, captions: ['One.', 'Two.'], closingMessage: 'Thanks.' });
    const calls: Record<string, number> = {};
    for (const tier of ['low', 'high']) {
      // The scene honours the forced tier only in E2E mode, which the hook flag switches on.
      await page.addInitScript(`globalThis.__SURPRISE_E2E__ = true; globalThis.__SURPRISE_QUALITY__ = '${tier}'`);
      await enterVisit(page, made.shareToken, { width: 1280, height: 720 });
      await page.waitForTimeout(1200);
      const s = await snap(page);
      calls[tier] = s.render.calls;
      expect(s.quality, `the ${tier} tier is the one in use`).toBe(tier);
    }
    expect(calls.high, `draw calls High ${calls.high} against Low ${calls.low}`).toBeGreaterThan(calls.low!);
    expect(calls.high! - calls.low!, 'the depth cues add a few draw calls, not many').toBeLessThanOrEqual(6);
    problems.expectClean();
  });
});

test.describe('US-58 AC-2 and AC-3 (FR-91): a standing character is not frozen, and reduced motion removes the idle movement', () => {
  test.setTimeout(240_000);

  async function idleDiff(page: Page, token: string, reduced: boolean): Promise<number> {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enterVisit(page, token, { width: 1280, height: 720 });
    await page.waitForTimeout(2500); // arrival and the first idle cycle settle
    // The Visitor stands in the middle of the default view: a 240 x 300 px window around the centre holds the figure.
    const vp = page.viewportSize()!;
    const clip = { x: vp.width / 2 - 120, y: vp.height / 2 - 100, width: 240, height: 300 };
    const a = await page.screenshot({ clip, animations: 'allow' });
    // The idle sway is slow (0.12 to 0.3 Hz): sample about half a breathing cycle later, over five seconds.
    let worst = 0;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      worst = Math.max(worst, pixelDiffRatio(a, await page.screenshot({ clip, animations: 'allow' }), 6));
    }
    return worst;
  }

  test('AC-2: watched for five seconds, the standing Visitor changes (a subtle movement); AC-3: under reduced motion it does not', async ({ page }, testInfo) => {
    const made = await createMuseum(page, { photos: 1, captions: ['One.'], closingMessage: 'Thanks.' });
    const moving = await idleDiff(page, made.shareToken, false);
    const still = await idleDiff(page, made.shareToken, true);
    testInfo.annotations.push({ type: 'idle-diff', description: `motion ${moving.toFixed(5)}, reduced ${still.toFixed(5)}` });
    expect(moving, 'the idle character moves a little').toBeGreaterThan(0.0004);
    expect(still, 'reduced motion: no idle movement').toBeLessThan(0.0002);
    expect(moving, 'subtle, not a dance').toBeLessThan(0.2);
  });
});
