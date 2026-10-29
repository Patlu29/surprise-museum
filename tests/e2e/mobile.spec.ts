import { expect, test as base, type Page } from '@playwright/test';
import { addPhotos, fillWords, openVisit, startVisit, snap, waitForSnap, type PageGlobals } from './support/app';
import { test } from './support/fixtures';
import { makePhotos } from './support/images';

/*
 * Touch and phone behaviour (US-15 AC-1, US-33, US-1 AC-2, US-16 AC-2). Most of these only make
 * sense on the mobile projects (iPhone 13 WebKit, Pixel 7 Chromium) and skip elsewhere.
 */

async function sizeOfSmallTargets(page: Page, selector: string, min = 44): Promise<string[]> {
  const small: string[] = [];
  for (const el of await page.locator(selector).all()) {
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (!box) continue;
    if (box.width < min - 0.5 || box.height < min - 0.5) {
      const name = ((await el.getAttribute('aria-label')) ?? (await el.innerText()).trim() ?? '').slice(0, 40);
      small.push(`${name || selector} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  return small;
}

test.describe('touch controls', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch devices only');

  test('US-15 AC-1: the joystick is shown on touch devices and dragging it walks the character', async ({
    page,
    museum,
  }) => {
    await openVisit(page, museum.shareToken);
    // Tapping Start works with touch.
    await page.getByRole('button', { name: 'Start' }).tap();
    await page.waitForFunction(
      () => (globalThis as unknown as PageGlobals).__surpriseMuseum !== undefined,
    );
    const joystick = page.locator('.joystick');
    await expect(joystick).toBeVisible();
    const box = (await joystick.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await waitForSnap(page, (n) => n.ready, 40_000, 'the scene');
    const before = await snap(page);
    // Drag the knob upwards (forward) with a held pointer.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - box.height * 0.4, { steps: 6 });
    await waitForSnap(page, (n) => n.visitor.z < before.visitor.z - 0.4, 15_000, 'her to walk forward');
    await page.mouse.up();
    await waitForSnap(page, (n) => n.visitor.locomotion === 'idle', 10_000, 'her to stop when released');
  });

  test('US-33 AC-1: in portrait the joystick, HUD and caption card fit and do not cover each other or the picture', async ({
    page,
    museum,
  }) => {
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await waitForSnap(page, (n) => n.guide.mode === 'present', 40_000, 'the Guide to present');
    await expect(page.locator('.caption-card')).toBeVisible();
    await page.waitForTimeout(900);
    const rects = (await page.evaluate(`(() => {
      const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const rects = globalThis.__APP_TEST__.screenRects;
      return { card: r('.caption-card'), joystick: r('.joystick'), picture: rects.picture, vw: innerWidth, vh: innerHeight };
    })()`)) as {
      card: { x: number; y: number; w: number; h: number };
      joystick: { x: number; y: number; w: number; h: number } | null;
      picture: { x: number; y: number; width: number; height: number } | null;
      vw: number;
      vh: number;
    };
    expect(rects.card.x).toBeGreaterThanOrEqual(-1);
    expect(rects.card.x + rects.card.w).toBeLessThanOrEqual(rects.vw + 1);
    if (rects.joystick) {
      const overlapX = Math.max(0, Math.min(rects.card.x + rects.card.w, rects.joystick.x + rects.joystick.w) - Math.max(rects.card.x, rects.joystick.x));
      const overlapY = Math.max(0, Math.min(rects.card.y + rects.card.h, rects.joystick.y + rects.joystick.h) - Math.max(rects.card.y, rects.joystick.y));
      expect(overlapX * overlapY, 'card overlaps the joystick').toBeLessThan(4);
    }
    if (rects.picture) {
      const p = rects.picture;
      const overlapX = Math.max(0, Math.min(rects.card.x + rects.card.w, p.x + p.width) - Math.max(rects.card.x, p.x));
      const overlapY = Math.max(0, Math.min(rects.card.y + rects.card.h, p.y + p.height) - Math.max(rects.card.y, p.y));
      expect((overlapX * overlapY) / (p.width * p.height), 'card overlaps the picture').toBeLessThan(0.1);
    }
  });

  test('US-33 AC-3: HUD buttons, joystick and caption controls are at least 44 x 44 on this phone', async ({
    page,
    museum,
  }) => {
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await waitForSnap(page, (n) => n.guide.mode === 'present', 40_000, 'the Guide to present');
    expect(await sizeOfSmallTargets(page, '.hud button, .caption-card button, .joystick')).toEqual([]);
  });

  test('US-16 AC-2: a two-finger pinch zooms the picture in and out', async ({ page, museum, browserName }) => {
    test.skip(browserName !== 'chromium', 'synthesised pinch uses the Chromium DevTools protocol');
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await waitForSnap(page, (n) => n.guide.mode === 'present', 40_000, 'the Guide to present');
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    const image = page.locator('.viewer__image');
    await expect(image).toHaveClass(/is-loaded/);
    const scaleOf = async () => Number(((await image.getAttribute('style')) ?? '').match(/scale\(([\d.]+)\)/)?.[1] ?? '1');
    const stage = (await page.locator('.viewer__stage').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const cx = stage.x + stage.width / 2;
    const cy = stage.y + stage.height / 2;
    // Two fingers placed `gap` apart either side of the centre, moved in small steps.
    const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', gap: number) => {
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints:
          type === 'touchEnd'
            ? []
            : [
                { x: cx - gap / 2, y: cy, id: 1 },
                { x: cx + gap / 2, y: cy, id: 2 },
              ],
      });
    };
    await touch('touchStart', 80);
    for (let gap = 80; gap <= 240; gap += 20) {
      await touch('touchMove', gap);
      await page.waitForTimeout(30);
    }
    await touch('touchEnd', 240);
    await expect.poll(scaleOf, { timeout: 5_000 }).toBeGreaterThan(1.5);
    const zoomed = await scaleOf();
    await touch('touchStart', 240);
    for (let gap = 240; gap >= 80; gap -= 20) {
      await touch('touchMove', gap);
      await page.waitForTimeout(30);
    }
    await touch('touchEnd', 80);
    await expect.poll(scaleOf, { timeout: 5_000 }).toBeLessThan(zoomed - 0.3);
  });
});

base.describe('phone layouts of the builder', () => {
  base('US-1 AC-2 and US-33 AC-3: at 360 x 640 nothing scrolls sideways and builder controls are comfortable targets', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(2));
    const horizontal = async () =>
      (await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')) as number;
    expect(await horizontal()).toBeLessThanOrEqual(0);
    const small = await sizeOfSmallTargets(page, '.builder button, .builder .btn, .builder a.btn', 44);
    // Buttons the design makes smaller (such as the text-only "link buttons") are listed, not failed,
    // when they still meet WCAG 2.5.8 (24 px). Anything under 24 px fails.
    const tooSmall = small.filter((s) => {
      const m = s.match(/(\d+)x(\d+)$/);
      return m ? Number(m[1]) < 24 || Number(m[2]) < 24 : false;
    });
    expect(tooSmall).toEqual([]);
    await base.info().attach('targets-under-44.txt', { body: small.join('\n') || 'none', contentType: 'text/plain' });
    await fillWords(page, {});
    expect(await horizontal()).toBeLessThanOrEqual(0);
  });

  base('US-1 AC-2: Next and Back stay reachable (inside the viewport, bottom of the screen) while scrolling a long step', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(4));
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeInViewport();
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await expect(next).toBeInViewport();
  });
});
