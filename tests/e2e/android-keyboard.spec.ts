import { expect, test } from '@playwright/test';
import { addPhotos } from './support/app';
import { makePhotos } from './support/images';

/*
 * index.html sets `interactive-widget=resizes-content` so that on Chromium and Firefox for Android
 * the on-screen keyboard shrinks the layout viewport (and dvh) instead of covering the page.
 *
 * What this checks, and what it cannot: Playwright has no on-screen keyboard. The test sets the
 * meta tag (verified from the built page) and then shrinks the Pixel 7 viewport by the height of a
 * typical Android keyboard, which is the layout viewport the browser would produce under
 * `resizes-content`. It proves the builder's layout copes with that size (focused field visible, the
 * sticky Next and Back bar still on screen, the preview shrinking with dvh). It does NOT prove that
 * Android Chrome or Firefox apply the meta tag, nor how a real keyboard, IME suggestion strip,
 * visual viewport or iOS Safari (which ignores the setting) behave. Those are "not verified".
 */

const PIXEL_7 = { width: 412, height: 915 };
const KEYBOARD = 320; // typical Gboard height in CSS px, portrait

test('index.html asks for interactive-widget=resizes-content', async ({ page }) => {
  await page.goto('./');
  const content = await page.locator('meta[name=viewport]').getAttribute('content');
  expect(content).toContain('interactive-widget=resizes-content');
  expect(content).toContain('width=device-width');
  expect(content).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?(?![\d])/);
});

test.describe('builder with the keyboard open (emulated by shrinking the viewport)', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !isMobile, 'Android Chromium emulation only');

  test('the focused caption stays visible above the sticky Next and Back bar', async ({ page }) => {
    await page.setViewportSize(PIXEL_7);
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(1));
    await page.setViewportSize({ width: PIXEL_7.width, height: PIXEL_7.height - KEYBOARD });
    const caption = page.getByLabel('Caption (optional)');
    await caption.click();
    await caption.evaluate((el) => (el as unknown as { scrollIntoView(o: unknown): void }).scrollIntoView({ block: 'center' }));
    const viewport = page.viewportSize()!;
    const field = (await caption.boundingBox())!;
    const bar = (await page.locator('.builder__actions').boundingBox())!;
    expect(field.y, 'field top is on screen').toBeGreaterThanOrEqual(0);
    expect(field.y + field.height, 'field bottom is above the sticky bar').toBeLessThanOrEqual(bar.y + 1);
    expect(bar.y + bar.height, 'sticky bar is on screen').toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.getByRole('button', { name: 'Next' })).toBeInViewport();
  });

  test('the Words fields can all be reached and typed into with the keyboard open', async ({ page }) => {
    await page.setViewportSize(PIXEL_7);
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(1));
    await page.getByRole('button', { name: 'Next' }).click();
    await page.setViewportSize({ width: PIXEL_7.width, height: PIXEL_7.height - KEYBOARD });
    for (const label of [/Who is this museum for/, /Your name/, /Museum title/, /Closing message/]) {
      const field = page.getByLabel(label);
      await field.click();
      await field.evaluate((el) => (el as unknown as { scrollIntoView(o: unknown): void }).scrollIntoView({ block: 'center' }));
      const box = (await field.boundingBox())!;
      const bar = (await page.locator('.builder__actions').boundingBox())!;
      expect(box.y, `${label}`).toBeGreaterThanOrEqual(0);
      expect(box.y + Math.min(box.height, 60), `${label} sits above the sticky bar`).toBeLessThanOrEqual(bar.y + 1);
    }
  });

  test('the 3D preview shrinks with the viewport and the options remain reachable', async ({ page }) => {
    await page.setViewportSize(PIXEL_7);
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(1));
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel(/Who is this museum for/).fill('Alex');
    await page.getByLabel(/Your name/).fill('Sam');
    await page.getByRole('button', { name: 'Next' }).click();
    const full = (await page.locator('.preview-slot__frame').boundingBox())!;
    await page.setViewportSize({ width: PIXEL_7.width, height: PIXEL_7.height - KEYBOARD });
    const shrunk = (await page.locator('.preview-slot__frame').boundingBox())!;
    expect(shrunk.height).toBeLessThan(full.height);
    expect(shrunk.height).toBeLessThanOrEqual((PIXEL_7.height - KEYBOARD) * 0.55);
    await page.getByRole('tab', { name: 'Hair' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Hair style' })).toBeVisible();
  });
});
