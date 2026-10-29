import { expect, test as base } from './support/fixtures';
import { openVisit, startVisit, waitForSnap, type PageGlobals } from './support/app';

/*
 * Visual regression: a small, deliberately stable set. Rules (see tests/README.md):
 *  - desktop-chromium and mobile-chromium only (software GL, same machine for baselines);
 *  - reduced motion on, so idle sway, fades and the Guide's walk do not move between runs;
 *  - fixed viewport, device scale factor 1 on desktop;
 *  - the test museum is generated from fixed PNGs, so the pictures are identical every run;
 *  - the scene is captured only after the Guide has arrived and the frame has settled.
 * Thresholds: 0.002 for pure 2D screens, 0.02 for anything with the 3D canvas (software GL
 * anti-aliasing noise). Baselines are never updated to make a failure pass: a failure is a visual
 * change to be reviewed first (docs/qa-report.md, "Visual regression").
 */

const test = base.extend({});
test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'baselines are made on desktop Chromium');

test('visual: home screen', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate('document.fonts.ready');
  await expect(page).toHaveScreenshot('home.png', { maxDiffPixelRatio: 0.002 });
});

test('visual: welcome screen', async ({ page, museum }) => {
  await openVisit(page, museum.shareToken);
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(600);
  await expect(page.locator('.welcome__card')).toHaveScreenshot('welcome-card.png', { maxDiffPixelRatio: 0.002 });
});

test('visual: entrance at the start of the visit', async ({ page, museum }) => {
  await openVisit(page, museum.shareToken);
  await startVisit(page);
  await waitForSnap(page, (n) => Object.values(n.photoStatus).every((v) => v === 'loaded') && n.labels.visitor && n.labels.guide, 30_000, 'photos and labels');
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('entrance.png', { maxDiffPixelRatio: 0.02 });
});

test('visual: the Guide presenting picture 1 with its caption', async ({ page, museum }) => {
  await openVisit(page, museum.shareToken);
  await startVisit(page);
  await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
  await waitForSnap(page, (n) => n.guide.mode === 'present' && n.guide.opacity >= 1, 40_000, 'the Guide to arrive');
  await expect(page.locator('.caption-card')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('presenting-photo-1.png', { maxDiffPixelRatio: 0.02 });
});

test('visual: the finale card', async ({ page, museum }) => {
  await openVisit(page, museum.shareToken);
  await startVisit(page);
  await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
  await expect(page.locator('.finale-card')).toBeVisible();
  await waitForSnap(page, (n) => n.guide.opacity >= 1, 20_000, 'the Guide to settle');
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('finale.png', { maxDiffPixelRatio: 0.02 });
});

test('visual: the full-screen picture viewer', async ({ page, museum }) => {
  await openVisit(page, museum.shareToken);
  await startVisit(page);
  await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
  await waitForSnap(page, (n) => n.guide.mode === 'present', 40_000, 'the Guide to present');
  await page.getByRole('button', { name: /Look closer/i }).first().click();
  await expect(page.locator('.viewer__image')).toHaveClass(/is-loaded/);
  await page.waitForTimeout(500);
  await expect(page.locator('.viewer')).toHaveScreenshot('viewer.png', { maxDiffPixelRatio: 0.002 });
});
