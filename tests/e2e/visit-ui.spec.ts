import { type Page } from '@playwright/test';
import {
  dist,
  FACE_LEFT_WALL,
  layout,
  openVisit,
  sessionState,
  snap,
  startVisit,
  waitForSnap,
  type PageGlobals,
} from './support/app';
import { expect, test } from './support/fixtures';

/*
 * The 2D overlays over the scene: picture viewer (US-16), Pictures list (US-44), hint and progress
 * (US-35), on-screen arrow buttons (WCAG 2.5.7), settings (US-34), failed pictures (US-30) and the
 * WebGL fallback and context-lost screens (US-31).
 */

const enter = async (page: Page, token: string) => {
  await openVisit(page, token);
  await startVisit(page);
};

/** Present picture `index` the way a Visitor does, by standing at it, and wait for the card. */
async function presentPhoto(page: Page, index: number) {
  await page.evaluate(
    (i) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(i),
    index,
  );
  await waitForSnap(page, (n) => n.guide.mode === 'present', 30_000, 'the Guide to present');
}

test.describe('US-16 view a picture full-screen', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-16 AC-1 and AC-3: Look closer opens the picture with its caption; Close and Escape return to the museum', async ({
    page,
  }) => {
    await presentPhoto(page, 0);
    await page.getByRole('button', { name: /Look closer at photo 1 of 4/i }).click();
    const viewer = page.getByRole('dialog', { name: 'Photo 1 of 4' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Caption one: a day at the beach.');
    await expect(viewer.getByRole('img', { name: 'Caption one: a day at the beach.' })).toBeVisible();
    const before = await snap(page);
    await viewer.getByRole('button', { name: 'Close photo' }).click();
    await expect(viewer).toBeHidden();
    await expect(page.locator('.scene-root')).toBeFocused();
    // Reopen and close with Escape.
    await page.getByRole('button', { name: /Look closer at photo 1 of 4/i }).click();
    await expect(viewer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    // She is where she was.
    const after = await snap(page);
    expect(dist(after.visitor, before.visitor)).toBeLessThan(0.3);
  });

  test('US-16 AC-1: clicking or tapping a picture in the 3D view opens it', async ({ page, hasTouch }) => {
    // standAtPhoto is a jump, so the camera faces the picture as it does in the app.
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await waitForSnap(page, (n) => n.guide.mode === 'present', 30_000, 'the Guide to present');
    await page.getByRole('button', { name: 'Close caption' }).click();
    // Scan the canvas for the picture; the click is a real pointer click on the 3D scene.
    const box = (await page.locator('canvas').boundingBox())!;
    const viewer = page.getByRole('dialog', { name: /Photo \d of 4/ });
    let opened = false;
    for (const fy of [0.5, 0.42, 0.58, 0.34, 0.66]) {
      for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85, 0.4, 0.6]) {
        const px = box.x + box.width * fx;
        const py = box.y + box.height * fy;
        if (hasTouch) await page.touchscreen.tap(px, py);
        else await page.mouse.click(px, py);
        if (await viewer.isVisible()) {
          opened = true;
          break;
        }
      }
      if (opened) break;
    }
    expect(opened, 'a click on the picture should open the viewer').toBe(true);
    await expect(viewer).toContainText('Photo 1 of 4');
  });

  test('US-16 AC-2: the scroll wheel zooms the picture in and Reset zoom restores it', async ({ page, browserName, isMobile }) => {
    const noWheel = browserName === 'webkit' && isMobile; // Playwright has no wheel in mobile WebKit
    await presentPhoto(page, 0);
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    const image = page.locator('.viewer__image');
    await expect(image).toHaveClass(/is-loaded/);
    const scaleOf = async () =>
      Number(((await image.getAttribute('style')) ?? '').match(/scale\(([\d.]+)\)/)?.[1] ?? '1');
    expect(await scaleOf()).toBeCloseTo(1, 2);
    const stage = (await page.locator('.viewer__stage').boundingBox())!;
    if (!noWheel) {
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
      await page.mouse.wheel(0, -400);
      await expect.poll(scaleOf).toBeGreaterThan(1.2);
      await page.getByRole('button', { name: 'Reset zoom' }).click();
      await expect.poll(scaleOf).toBeCloseTo(1, 2);
    }
    // Keyboard zoom.
    await page.keyboard.press('+');
    await expect.poll(scaleOf).toBeGreaterThan(1.2);
    await page.keyboard.press('0');
    await expect.poll(scaleOf).toBeCloseTo(1, 2);
  });

  /** Make photo 1's full-size picture fail to load, optionally allowing it on a later request. */
  async function breakFullPicture(page: Page): Promise<{ allow: () => void }> {
    let allowed = false;
    await page.route('**/missing-full.jpg', async (route) => {
      if (!allowed) return route.fulfill({ status: 404, body: 'no' });
      // A 1x1 PNG is enough to prove the retry path loads an image.
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    });
    await page.evaluate((url) => {
      const store = (globalThis as unknown as PageGlobals).__APP_TEST__!.useMuseumStore;
      const state = store.getState();
      const photos = state.content.photos.map((p: { id: string }, i: number) =>
        i === 0 ? { ...p, fullUrl: url } : p,
      );
      store.setState({ content: { ...state.content, photos } });
    }, 'http://localhost:4173/surprise-museum/missing-full.jpg');
    return { allow: () => (allowed = true) };
  }

  test('US-16 AC-4 and AC-5: a placeholder shows while loading; a failed photo shows an error with Try again', async ({
    page,
  }) => {
    await presentPhoto(page, 0);
    await breakFullPicture(page);
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    // Placeholder (the blurred LQIP) is there while the full picture is not.
    await expect(page.locator('.viewer__lqip')).toBeVisible();
    const error = page.getByRole('alert').filter({ hasText: "We couldn't load this photo" });
    await expect(error).toBeVisible();
    await expect(error.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('US-16 AC-5 (keyboard): Try again re-requests the picture and shows it', async ({ page }) => {
    await presentPhoto(page, 0);
    const broken = await breakFullPicture(page);
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    await expect(page.getByRole('alert').filter({ hasText: "We couldn't load this photo" })).toBeVisible();
    broken.allow();
    await page.getByRole('button', { name: 'Try again' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.viewer__image')).toHaveClass(/is-loaded/);
  });

  // BUG-2: a pointer press on Try again is treated as a tap on the dark background by the viewer's
  // stage handler, so the viewer closes instead of retrying. Expected to fail until fixed.
  test('US-16 AC-5 (BUG-2): clicking or tapping Try again retries and keeps the viewer open', async ({ page }) => {
    await presentPhoto(page, 0);
    const broken = await breakFullPicture(page);
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    await expect(page.getByRole('alert').filter({ hasText: "We couldn't load this photo" })).toBeVisible();
    broken.allow();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('.viewer__image')).toHaveClass(/is-loaded/, { timeout: 5_000 });
  });
});

test.describe('US-44 jump to a picture (the Pictures list)', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-44 AC-1: choosing a picture moves her to stand in front of it and the Guide presents it', async ({
    page,
  }) => {
    const l = await layout(page);
    await page.getByRole('button', { name: 'Pictures' }).click();
    const sheet = page.getByRole('dialog', { name: 'Pictures' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button')).toHaveCount(5 + 1); // 4 pictures, the finale, and Close
    await sheet.getByRole('button', { name: /Photo 3/ }).click();
    await expect(sheet).toBeHidden();
    const s = await waitForSnap(page, (n) => n.intent === `photo:${l.slots[2]!.photoId}`, 20_000, 'photo 3 to be presented');
    expect(dist(s.visitor, l.slots[2]!.standingSpot)).toBeLessThan(1);
    await expect(page.locator('.caption-card')).toContainText('Caption three.');
  });

  test('US-44 AC-2: the list works with the keyboard alone (P opens it, Tab moves, Enter selects)', async ({ page, browserName, isMobile }) => {
    test.skip(browserName === 'webkit' && isMobile, 'the iPhone emulation does not Tab to buttons (iOS needs Full Keyboard Access); desktop WebKit and Chromium cover it');
    const l = await layout(page);
    await page.locator('.scene-root').focus();
    await page.keyboard.press('p');
    const sheet = page.getByRole('dialog', { name: 'Pictures' });
    await expect(sheet).toBeVisible();
    // Focus starts on the first picture.
    await expect(sheet.getByRole('button', { name: /Photo 1/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(sheet.getByRole('button', { name: /Photo 2/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(sheet).toBeHidden();
    await waitForSnap(page, (n) => n.intent === `photo:${l.slots[2]!.photoId}`, 20_000, 'photo 3 to be presented');
  });

  test('US-44 AC-3: pictures that have been viewed are marked "Viewed" in words', async ({ page }) => {
    await presentPhoto(page, 0);
    await page.getByRole('button', { name: 'Pictures' }).click();
    const sheet = page.getByRole('dialog', { name: 'Pictures' });
    await expect(sheet.getByRole('button', { name: /Photo 1/ })).toContainText('Viewed');
    await expect(sheet.getByRole('button', { name: /Photo 2/ })).not.toContainText('Viewed');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('US-44: the Finale entry in the list takes her to the closing message', async ({ page }) => {
    await page.getByRole('button', { name: 'Pictures' }).click();
    await page.getByRole('dialog', { name: 'Pictures' }).getByRole('button', { name: /Finale/ }).click();
    await expect(page.locator('.finale-card')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('US-35 hint and progress', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-35 AC-1 and AC-4: the hint control (keyboard operable) highlights a picture and does not move her or the camera', async ({
    page,
  }) => {
    const before = await snap(page);
    const hint = page.getByRole('button', { name: 'Where next?' });
    await hint.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => sessionState(page, (s) => s.hint !== null), { timeout: 10_000 }).toBe(true);
    const hintInfo = await sessionState(page, (s) => s.hint);
    expect(hintInfo.target.kind).toBe('photo');
    const after = await snap(page);
    expect(dist(after.visitor, before.visitor)).toBeLessThan(0.05);
    expect(Math.abs(after.camera.yaw - before.camera.yaw)).toBeLessThan(0.01);
    // It fades by itself and never blocks her.
    await expect.poll(() => sessionState(page, (s) => s.hint === null), { timeout: 12_000 }).toBe(true);
  });

  test('US-35 AC-3: the progress count increases when a new picture is presented', async ({ page }) => {
    await expect(page.locator('.hud-pill')).toContainText('0 of 4');
    await presentPhoto(page, 0);
    await expect(page.locator('.hud-pill')).toContainText('1 of 4');
    await presentPhoto(page, 2);
    await expect(page.locator('.hud-pill')).toContainText('2 of 4');
  });

  test('US-43 AC-1: once everything is viewed the hint button says "To the finale"', async ({ page }) => {
    for (const i of [0, 1, 2, 3]) await presentPhoto(page, i);
    await expect(page.getByRole('button', { name: 'To the finale' })).toBeVisible();
  });
});

test.describe('WCAG 2.5.7 and US-34 on-screen controls and settings', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('arrow buttons walk and turn without any drag (WCAG 2.5.7)', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const sheet = page.getByRole('dialog', { name: 'Settings' });
    await sheet.getByRole('radio', { name: 'Arrow buttons' }).check();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    const pad = page.getByRole('group', { name: 'Move and turn' });
    await expect(pad).toBeVisible();
    await expect(page.locator('.joystick')).toHaveCount(0);
    const before = await snap(page);
    // Press and hold with a single pointer: no dragging needed.
    const forward = pad.getByRole('button', { name: 'Walk forward' });
    const box = (await forward.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await waitForSnap(page, (n) => n.visitor.z < before.visitor.z - 0.4, 12_000, 'her to walk forward');
    await page.mouse.up();
    const turn = pad.getByRole('button', { name: 'Turn view right' });
    const tbox = (await turn.boundingBox())!;
    const yawBefore = (await snap(page)).camera.yaw;
    await page.mouse.move(tbox.x + tbox.width / 2, tbox.y + tbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    expect(Math.abs((await snap(page)).camera.yaw - yawBefore)).toBeGreaterThan(0.1);
    // Every arrow button is a comfortable target (WCAG 2.5.8 needs 24, the design spec asks for 44).
    for (const button of await pad.getByRole('button').all()) {
      const b = (await button.boundingBox())!;
      expect(b.width, (await button.getAttribute('aria-label')) ?? 'arrow button').toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('US-34 AC-2: larger caption text applies immediately', async ({ page }) => {
    await presentPhoto(page, 0);
    const text = page.locator('.caption-card__text');
    const size = async (): Promise<number> =>
      text.evaluate((el) =>
        Number.parseFloat(
          (globalThis as unknown as { getComputedStyle(e: unknown): { fontSize: string } }).getComputedStyle(el).fontSize,
        ),
      );
    const normal = await size();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: 'Extra large' }).check();
    await expect.poll(size).toBeGreaterThan(normal + 2);
  });

  test('US-32 AC-2 (settings): choosing Reduce motion sets the page to reduced motion', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('radio', { name: 'Reduce' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  });

  test('Help sheet opens with H and closes with Escape; keys are explained', async ({ page }) => {
    await page.locator('.scene-root').focus();
    await page.keyboard.press('h');
    const help = page.getByRole('dialog', { name: /Help|How to explore/i });
    await expect(help).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });
});

test.describe('US-30 a photo that fails to load', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-30 AC-3: a failed frame shows Retry near it, the Guide still presents the caption, she can keep roaming', async ({
    page,
  }) => {
    const l = await layout(page);
    const first = l.slots[0]!;
    await page.evaluate((id) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.failPhoto(id), first.photoId);
    await waitForSnap(page, (n) => n.photoStatus[first.photoId] === 'failed', 10_000, 'the photo to fail');
    await page.evaluate(
      ([x, z, h]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.teleportVisitor(x as number, z as number, h as number),
      [first.standingSpot.x, first.standingSpot.z, FACE_LEFT_WALL] as const,
    );
    await expect(page.locator('.hud-chip--action')).toContainText('Photo 1 did not load.', { timeout: 10_000 });
    // The Guide still presents the caption.
    await waitForSnap(page, (n) => n.guide.mode === 'present', 30_000, 'the Guide to present');
    await expect(page.locator('.caption-card')).toContainText('Caption one');
    // And she can keep roaming.
    const before = await snap(page);
    await page.locator('.scene-root').focus();
    await page.keyboard.down('d');
    await waitForSnap(page, (n) => Math.abs(n.visitor.x - before.visitor.x) > 0.3, 12_000, 'her to move');
    await page.keyboard.up('d');
    // Retry loads it.
    await page.getByRole('button', { name: 'Retry' }).click();
    await waitForSnap(page, (n) => n.photoStatus[first.photoId] === 'loaded', 20_000, 'the photo to load on retry');
    await expect(page.locator('.hud-chip--action')).toHaveCount(0);
  });
});

test.describe('US-31 WebGL is unavailable or lost', () => {
  test('US-31 AC-1: without WebGL she sees a plain-language message and a way out', async ({ page, museum }) => {
    await page.addInitScript(() => {
      const proto = (globalThis as unknown as { HTMLCanvasElement: { prototype: { getContext: (...a: unknown[]) => unknown } } }).HTMLCanvasElement.prototype;
      const original = proto.getContext;
      proto.getContext = function (this: unknown, type: unknown, ...rest: unknown[]) {
        if (typeof type === 'string' && /webgl/i.test(type)) return null;
        return original.call(this, type, ...rest);
      };
    });
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('heading', { name: "This device can't show the 3D museum" })).toBeVisible();
    await expect(page.getByText(/Try the latest Chrome, Safari, Edge or Firefox/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('US-31 AC-3: if the graphics context is lost mid-session she sees a message and a Reload control', async ({
    page,
    museum,
  }) => {
    await enter(page, museum.shareToken);
    await page.evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      gl.getExtension('WEBGL_lose_context').loseContext();
    })()`);
    const dialog = page.getByRole('alertdialog', { name: 'The 3D view stopped' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('button', { name: 'Reload' })).toBeFocused();
    const reloaded = page.waitForEvent('load');
    await dialog.getByRole('button', { name: 'Reload' }).click();
    await reloaded;
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});

test.describe('US-33 portrait, landscape and small screens', () => {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [412, 915],
  ] as const) {
    test(`US-33 AC-1: every HUD control is fully on screen at ${width}x${height}${width === 412 ? ' (BUG-4)' : ''}`, async ({ page, museum }) => {
      // BUG-4: at 412 px wide (Pixel 7, a very common width) the Help button is pushed past the right edge.
      await page.setViewportSize({ width, height });
      await enter(page, museum.shareToken);
      await page.waitForTimeout(600);
      const off: string[] = [];
      for (const button of await page.locator('.hud__top button').all()) {
        if (!(await button.isVisible())) continue;
        const b = (await button.boundingBox())!;
        if (b.x < -0.5 || b.x + b.width > width + 0.5) {
          off.push(`${(await button.getAttribute('aria-label')) ?? (await button.innerText())} x=${Math.round(b.x)} w=${Math.round(b.width)}`);
        }
      }
      expect(off, 'HUD buttons cut off by the screen edge').toEqual([]);
    });
  }

  test('US-33 AC-2: rotating the phone keeps her position and viewed pictures, with no restart', async ({
    page,
    museum,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page, museum.shareToken);
    await presentPhoto(page, 0);
    await page.evaluate(`window.__marker = 'same page'`);
    const before = await snap(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(800);
    const after = await snap(page);
    expect(await page.evaluate(`window.__marker`)).toBe('same page');
    expect(dist(after.visitor, before.visitor)).toBeLessThan(0.3);
    await expect(page.locator('.hud-pill')).toContainText('1 of 4');
    await expect(page.locator('.caption-card')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await expect(page.locator('.hud-pill')).toContainText('1 of 4');
  });

  test('US-33 AC-3: every control is at least 44 x 44 CSS px at 360 x 640', async ({ page, museum }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await enter(page, museum.shareToken);
    await presentPhoto(page, 0);
    const small: string[] = [];
    const buttons = await page.locator('.hud button, .caption-card button').all();
    for (const button of buttons) {
      if (!(await button.isVisible())) continue;
      const b = (await button.boundingBox())!;
      if (b.width < 43.5 || b.height < 43.5) {
        small.push(`${(await button.getAttribute('aria-label')) ?? (await button.innerText())} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
    }
    expect(small, 'targets under 44 x 44').toEqual([]);
  });
});

test.describe('US-12 AC-5 caption placement (design spec 3.5)', () => {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [844, 390],
    [1280, 720],
  ] as const) {
    test(`the caption card covers neither the characters nor the picture at ${width}x${height}, and Close is at least 44x44`, async ({
      page,
      museum,
    }) => {
      await page.setViewportSize({ width, height });
      await enter(page, museum.shareToken);
      // standAtPhoto is a jump: the camera is placed behind her, facing the picture (as in the app).
      await presentPhoto(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible();
      // Let the placement settle (it re-evaluates about every 100 ms).
      await page.waitForTimeout(900);
      const result = (await page.evaluate(`(() => {
        const rects = globalThis.__APP_TEST__.screenRects;
        const card = document.querySelector('.caption-card').getBoundingClientRect();
        const close = document.querySelector('.caption-card button[aria-label="Close caption"]').getBoundingClientRect();
        const overlap = (r) => {
          if (!r) return 0;
          const w = Math.max(0, Math.min(card.right, r.x + r.width) - Math.max(card.left, r.x));
          const h = Math.max(0, Math.min(card.bottom, r.y + r.height) - Math.max(card.top, r.y));
          return (w * h) / (r.width * r.height);
        };
        return {
          picture: overlap(rects.picture), visitor: overlap(rects.visitor), guide: overlap(rects.guide),
          hasRects: Boolean(rects.picture && rects.visitor),
          close: { w: close.width, h: close.height },
          card: { top: card.top, bottom: card.bottom, left: card.left, right: card.right },
          vw: innerWidth, vh: innerHeight,
        };
      })()`)) as {
        picture: number;
        visitor: number;
        guide: number;
        hasRects: boolean;
        close: { w: number; h: number };
        card: { top: number; bottom: number; left: number; right: number };
        vw: number;
        vh: number;
      };
      expect(result.hasRects, 'the scene published screen rectangles').toBe(true);
      // Small overlaps (a few per cent, at the edge of a label) are tolerated by the design.
      expect(result.picture, 'overlap with the picture').toBeLessThan(0.1);
      expect(result.visitor, 'overlap with the Visitor').toBeLessThan(0.1);
      expect(result.close.w).toBeGreaterThanOrEqual(44);
      expect(result.close.h).toBeGreaterThanOrEqual(44);
      // The card stays on the screen.
      expect(result.card.left).toBeGreaterThanOrEqual(-1);
      expect(result.card.right).toBeLessThanOrEqual(result.vw + 1);
      expect(result.card.bottom).toBeLessThanOrEqual(result.vh + 1);
    });
  }
});
