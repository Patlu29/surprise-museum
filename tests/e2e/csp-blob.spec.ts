import { expect, test, type Page } from '@playwright/test';
import { addPhotos, fillWords, openVisit, startVisit, waitForSnap } from './support/app';
import { makePhotos } from './support/images';

/*
 * The production build sets a Content-Security-Policy <meta> (vite.config.ts). Photos the Creator
 * picks are shown from blob: URLs, in thumbnails and as wall textures in the preview. This runs in
 * every browser project (Chromium, WebKit and, where it can launch, Firefox) because blob: handling
 * under a CSP differs between engines. A violation is recorded through the browser's own
 * `securitypolicyviolation` event, not by guessing from the console.
 */

const RECORD_VIOLATIONS = () => {
  const g = globalThis as unknown as {
    __csp: Array<{ directive: string; blocked: string }>;
    addEventListener(type: string, fn: (e: unknown) => void): void;
  };
  g.__csp = [];
  g.addEventListener('securitypolicyviolation', (e) => {
    const event = e as { effectiveDirective: string; blockedURI: string };
    g.__csp.push({ directive: event.effectiveDirective, blocked: event.blockedURI.slice(0, 80) });
  });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(RECORD_VIOLATIONS);
});

const violations = (page: Page) =>
  page.evaluate(`globalThis.__csp`) as Promise<Array<{ directive: string; blocked: string }>>;

test('the production CSP is present and allows blob: images and workers', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toBeTruthy();
  expect(csp).toMatch(/img-src[^;]*blob:/);
  expect(csp).toMatch(/worker-src[^;]*blob:/);
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
});

test('blob: photos load under the CSP: builder thumbnails, preview wall textures and review thumbnails', async ({
  page,
  browserName,
}) => {
  await page.goto('./?e2e=1#/create');
  await addPhotos(page, makePhotos(2));
  // Builder thumbnails are <img src="blob:...">.
  const sources = await page.locator('.photo-row__thumb img').evaluateAll((els) =>
    els.map((el) => ({
      src: (el as unknown as { src: string }).src.slice(0, 5),
      w: (el as unknown as { naturalWidth: number }).naturalWidth,
    })),
  );
  expect(sources.length).toBe(2);
  for (const s of sources) {
    expect(s.src, `${browserName} thumbnail source`).toBe('blob:');
    expect(s.w, `${browserName} thumbnail decoded`).toBeGreaterThan(0);
  }
  await fillWords(page, {});
  const review = await page
    .locator('.review-thumbs img')
    .evaluateAll((els) => els.map((el) => (el as unknown as { naturalWidth: number }).naturalWidth));
  expect(review.every((w) => w > 0)).toBe(true);
  // The preview builds wall textures from the same blob: URLs inside WebGL.
  await page.getByRole('button', { name: 'Preview' }).first().click();
  await page.getByRole('button', { name: 'Start' }).click();
  const snap = await waitForSnap(
    page,
    (n) => Object.keys(n.photoStatus).length === 2 && Object.values(n.photoStatus).every((v) => v === 'loaded'),
    40_000,
    'blob: wall textures to load in the preview',
  );
  expect(Object.values(snap.photoStatus)).toEqual(['loaded', 'loaded']);
  expect(await violations(page), `${browserName} CSP violations`).toEqual([]);
});

test('photos served to the Visitor (the demo backend returns blob: URLs) load under the CSP', async ({ page, browserName }) => {
  const { createMuseum } = await import('./support/app');
  const made = await createMuseum(page, { photos: 2 });
  await openVisit(page, made.shareToken);
  await startVisit(page);
  const snap = await waitForSnap(
    page,
    (n) => Object.values(n.photoStatus).length === 2 && Object.values(n.photoStatus).every((v) => v === 'loaded'),
    40_000,
    'photos to load for the Visitor',
  );
  expect(Object.values(snap.photoStatus)).toEqual(['loaded', 'loaded']);
  expect(await violations(page), `${browserName} CSP violations`).toEqual([]);
});
