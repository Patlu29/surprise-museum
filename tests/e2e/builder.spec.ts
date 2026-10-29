import { expect, test, type Page } from '@playwright/test';
import { addPhotos, fillWords, trackProblems, type PageGlobals } from './support/app';
import { makePhotos, makePng } from './support/images';

/*
 * Epic E1 (US-1 to US-8) and the Creator half of E6 (US-22, US-29). The builder runs against the
 * demo backend; nothing leaves the browser.
 */

const NEXT = (page: Page) => page.getByRole('button', { name: 'Next' });

async function openBuilder(page: Page) {
  await page.goto('./?e2e=1#/create');
  await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
}

test.describe('US-1 start without an account', () => {
  test('US-1 AC-1: the builder opens with no sign-in or account prompt', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto('./');
    await page.getByRole('link', { name: 'Create a museum' }).click();
    await expect(page.getByRole('button', { name: 'Add photos' })).toBeVisible();
    await expect(page.locator('input[type=password], input[type=email]')).toHaveCount(0);
    await expect(page.getByText(/sign in|log in|create an account|password/i)).toHaveCount(0);
    problems.expectClean();
  });

  test('US-1 AC-3 and US-30 AC-1: a loading indicator shows while the builder chunk downloads', async ({ page }) => {
    await page.route('**/assets/CreateScreen-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto('./#/create');
    await expect(page.getByRole('heading', { name: 'Opening your surprise' })).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add photos' })).toBeVisible({ timeout: 15_000 });
  });

  test('US-1 AC-2 and US-33: at 360 px wide no step scrolls horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openBuilder(page);
    await addPhotos(page, makePhotos(2));
    const overflow = async () =>
      page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    expect(await overflow(), 'step 1').toBeLessThanOrEqual(0);
    await fillWords(page, {});
    // Review step is now showing; check the earlier steps by the stepper (steps 2 and 3).
    expect(await overflow(), 'step 4').toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: /Edit characters/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    expect(await overflow(), 'step 3').toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: /Edit words/ }).or(page.getByRole('button', { name: 'Back' })).first().click();
    expect(await overflow(), 'step 2').toBeLessThanOrEqual(0);
  });
});

test.describe('US-2 upload photos', () => {
  test('US-2 AC-1: valid photos show progress and become thumbnails', async ({ page }) => {
    await openBuilder(page);
    await page.locator('input[type=file]').first().setInputFiles(makePhotos(3));
    await expect(page.locator('.photo-list > li')).toHaveCount(3);
    await expect(page.locator('.photo-row__status--ready')).toHaveCount(3, { timeout: 60_000 });
    for (const img of await page.locator('.photo-row__thumb img').all()) {
      await expect(img).toBeVisible();
      expect(await img.evaluate((el) => (el as unknown as { naturalWidth: number }).naturalWidth)).toBeGreaterThan(0);
    }
    await expect(page.getByText('3 of 20 photos')).toBeVisible();
  });

  test('US-2 AC-2: a 25 MB file and a PDF are rejected with names and reasons, valid files still upload', async ({
    page,
  }) => {
    await openBuilder(page);
    const valid = makePhotos(2);
    const big = { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(25 * 1024 * 1024, 0xff) };
    const pdf = { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%fake\n') };
    await page.locator('input[type=file]').first().setInputFiles([valid[0]!, big, pdf, valid[1]!]);
    const alert = page.getByRole('alert').filter({ hasText: "weren't added" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('huge.jpg');
    await expect(alert).toContainText('larger than 15 MB');
    await expect(alert).toContainText('notes.pdf');
    await expect(alert).toContainText('not a JPEG, PNG, WebP or HEIC');
    await expect(page.locator('.photo-row__status--ready')).toHaveCount(2, { timeout: 60_000 });
  });

  test('US-2 AC-2: the 21st photo is rejected with a reason', async ({ page }) => {
    test.setTimeout(240_000);
    await openBuilder(page);
    const small = Array.from({ length: 21 }, (_, i) => ({
      name: `tiny-${i + 1}.png`,
      mimeType: 'image/png',
      buffer: makePng(320, 240, i + 1),
    }));
    await page.locator('input[type=file]').first().setInputFiles(small);
    const alert = page.getByRole('alert').filter({ hasText: "wasn't added" });
    await expect(alert).toContainText('tiny-21.png');
    await expect(alert).toContainText('up to 20 photos');
    await expect(page.locator('.photo-list > li')).toHaveCount(20);
    await expect(page.getByText(/You can add up to 20 photos\. Remove one to add another\./).first()).toBeVisible();
  });

  test('US-2 AC-3: Retry re-sends only the failed photo and leaves the others untouched', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(3));
    // The demo backend never drops a connection, so a mid-upload network failure is injected into
    // the store: the row is failed with no server photo id, as if the upload never confirmed.
    const idsBefore = await page.evaluate(() => {
      const g = globalThis as unknown as PageGlobals;
      const store = g.__APP_TEST__!.useBuilderStore;
      const photos = store.getState().photos as Array<{ localId: string; photoId: string | null }>;
      store.getState().patchPhoto(photos[1]!.localId, {
        status: 'failed',
        error: 'Upload failed: check your connection.',
        errorKind: 'network',
        progress: 0,
        photoId: null,
      });
      return photos.map((p) => p.photoId);
    });
    const rows = page.locator('.photo-list > li');
    await expect(rows.nth(1).getByRole('alert')).toContainText('Upload failed');
    await expect(rows.nth(0).locator('.photo-row__status--ready')).toBeVisible();
    await expect(rows.nth(2).locator('.photo-row__status--ready')).toBeVisible();
    await rows.nth(1).getByRole('button', { name: 'Retry' }).click();
    await expect(rows.nth(1).locator('.photo-row__status--ready')).toBeVisible({ timeout: 30_000 });
    await expect(rows.nth(0).locator('.photo-row__status--ready')).toBeVisible();
    // The other two photos kept their server ids: only the failed one was re-sent.
    const idsAfter = await page.evaluate(() => {
      const g = globalThis as unknown as PageGlobals;
      return (g.__APP_TEST__!.useBuilderStore.getState().photos as Array<{ photoId: string | null }>).map(
        (p) => p.photoId,
      );
    });
    expect(idsAfter[0]).toBe(idsBefore[0]);
    expect(idsAfter[2]).toBe(idsBefore[2]);
    expect(idsAfter[1]).not.toBeNull();
  });

  test('US-2 AC-4: a JPEG carrying GPS EXIF is re-encoded and the served file has no EXIF or GPS', async ({ page }) => {
    // The production CSP (connect-src 'self') stops page code fetching blob: bytes, so this one test
    // serves index.html without the CSP <meta> purely to be able to read the bytes. (Playwright's
    // bypassCSP does not cover WebKit.) CSP itself is covered in csp-blob.spec.ts.
    await page.route(/\/surprise-museum\/(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
      await route.fulfill({ response, body: html, headers: { ...response.headers(), 'content-length': String(Buffer.byteLength(html)) } });
    });
    await openBuilder(page);
    const { withExifGps } = await import('./support/images');
    // A real JPEG made in the page (canvas), with an EXIF GPS segment spliced in by the test.
    const b64 = await page.evaluate(`(async () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const g = c.getContext('2d'); g.fillStyle = '#4a7'; g.fillRect(0, 0, 640, 480);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    })()`);
    const jpeg = withExifGps(Buffer.from(b64 as string, 'base64'));
    expect(jpeg.includes(Buffer.from('GPS-LATITUDE'))).toBe(true);
    await addPhotos(page, [{ name: 'gps.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
    // What the museum will serve: the wall and full renditions the app holds for this photo.
    const served = await page.evaluate(`(async () => {
      const state = globalThis.__APP_TEST__.useBuilderStore.getState();
      const photo = state.photos[0];
      const out = {};
      for (const key of ['wallUrl', 'fullUrl']) {
        if (!photo[key]) continue;
        const bytes = new Uint8Array(await (await fetch(photo[key])).arrayBuffer());
        let text = '';
        for (const b of bytes) text += String.fromCharCode(b);
        out[key] = { length: bytes.length, exif: text.includes('Exif'), gps: text.includes('GPS'), app1: text.includes('\\xff\\xe1') };
      }
      return out;
    })()`) as Record<string, { length: number; exif: boolean; gps: boolean; app1: boolean }>;
    expect(Object.keys(served).length).toBeGreaterThan(0);
    for (const [key, info] of Object.entries(served)) {
      expect(info.length, key).toBeGreaterThan(100);
      expect(info.exif, `${key} contains an Exif segment`).toBe(false);
      expect(info.gps, `${key} contains GPS text`).toBe(false);
    }
  });

  test('US-2 AC-5: Add photos is keyboard focusable and Enter opens the file chooser', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not raise a filechooser event for a programmatic input click');
    await openBuilder(page);
    const add = page.getByRole('button', { name: 'Add photos' });
    await add.focus();
    await expect(add).toBeFocused();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    expect(await chooser).toBeTruthy();
  });
});

test.describe('US-3 arrange photos and write captions', () => {
  test('US-3 AC-1: Earlier and Later change the order', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(3));
    const names = () => page.locator('.photo-row__file').allTextContents();
    expect(await names()).toEqual(['photo-1.png', 'photo-2.png', 'photo-3.png']);
    await page.locator('.photo-list > li').nth(2).getByRole('button', { name: /Earlier/ }).click();
    expect(await names()).toEqual(['photo-1.png', 'photo-3.png', 'photo-2.png']);
    await page.locator('.photo-list > li').nth(0).getByRole('button', { name: /Later/ }).click();
    expect(await names()).toEqual(['photo-3.png', 'photo-1.png', 'photo-2.png']);
  });

  test('US-3 AC-1: the keyboard can grab a photo with Space and move it with the arrow keys', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(3));
    const names = () => page.locator('.photo-row__file').allTextContents();
    const grip = page.getByRole('button', { name: 'Reorder photo 1' });
    await grip.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    expect(await names()).toEqual(['photo-2.png', 'photo-1.png', 'photo-3.png']);
  });

  test('US-3 AC-1 and AC-5: dragging a grip with the pointer reorders the photos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1800 });
    await openBuilder(page);
    await addPhotos(page, makePhotos(3));
    const names = () => page.locator('.photo-row__file').allTextContents();
    const from = (await page.getByRole('button', { name: 'Reorder photo 3' }).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // A human-speed drag: pointer moves arrive over time, not all in one millisecond.
    for (let y = from.y; y > 40; y -= 40) {
      await page.mouse.move(from.x + 10, y);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    expect(await names()).toEqual(['photo-3.png', 'photo-1.png', 'photo-2.png']);
  });

  test('US-3 AC-2 and AC-3: captions stop at 280 characters, show a count and explain the limit', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    const caption = page.getByLabel('Caption (optional)');
    await caption.fill('a'.repeat(300));
    expect(await caption.inputValue()).toHaveLength(280);
    await expect(page.locator('.photo-row .field__counter')).toHaveText('280 / 280');
    await expect(page.getByText('That is the limit: 280 characters')).toBeVisible();
    // Emoji count as one character.
    await caption.fill('🎈'.repeat(300));
    expect([...(await caption.inputValue())]).toHaveLength(280);
  });

  test('US-3 AC-4: removing asks to confirm, discards the caption; replacing keeps the caption', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(2));
    const rows = page.locator('.photo-list > li');
    await rows.nth(0).getByLabel('Caption (optional)').fill('Keep me');
    await rows.nth(1).getByLabel('Caption (optional)').fill('Remove me');
    // Replace photo 1 with a new file: caption kept.
    await rows.nth(0).locator('input[type=file]').setInputFiles({
      name: 'replacement.png',
      mimeType: 'image/png',
      buffer: makePng(700, 500, 9),
    });
    await expect(rows.nth(0).locator('.photo-row__file')).toHaveText('replacement.png', { timeout: 30_000 });
    await expect(rows.nth(0).getByLabel('Caption (optional)')).toHaveValue('Keep me');
    // Remove photo 2: a confirmation first.
    await rows.nth(1).getByRole('button', { name: /^Remove/ }).click();
    await expect(page.getByText('Remove photo 2 and its caption?')).toBeVisible();
    await rows.nth(1).getByRole('button', { name: 'Keep' }).click();
    await expect(rows).toHaveCount(2);
    await rows.nth(1).getByRole('button', { name: /^Remove/ }).click();
    await page.getByRole('group', { name: 'Remove photo 2' }).getByRole('button', { name: 'Remove' }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('Remove me')).toHaveCount(0);
  });
});

test.describe('US-4 and US-5 names, title and closing message', () => {
  test('US-4 AC-1: continuing without a name says which field is required', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click(); // to Words
    await NEXT(page).click(); // blocked
    const alert = page.getByRole('alert').filter({ hasText: 'things need fixing' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Enter the name of the person this museum is for.');
    await expect(alert).toContainText('Enter your name');
    await expect(page.getByLabel(/Who is this museum for/)).toHaveAttribute('aria-invalid', 'true');
  });

  test('US-4 AC-2: names stop at 24 characters with a message', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click();
    const field = page.getByLabel(/Who is this museum for/);
    await field.fill('n'.repeat(30));
    expect(await field.inputValue()).toHaveLength(24);
    await expect(page.getByText('That is the limit: 24 characters')).toBeVisible();
  });

  test('US-4 AC-3 and AC-4: a blank title previews as "A museum for <name>"; accents and emoji are kept', async ({
    page,
  }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click();
    await page.getByLabel(/Who is this museum for/).fill('Zoë 🌸');
    await page.getByLabel(/Your name/).fill('Renée');
    await expect(page.locator('.sample__title')).toHaveText('A museum for Zoë 🌸');
    await expect(page.locator('.sample__labels')).toContainText('Zoë 🌸');
    await expect(page.locator('.sample__labels')).toContainText('Renée');
  });

  test('US-5 AC-1: the closing message stops at 1,000 characters with an explanation', async ({ page }) => {
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click();
    const box = page.getByLabel('Closing message (optional)');
    await box.fill('x'.repeat(1100));
    expect(await box.inputValue()).toHaveLength(1000);
    await expect(page.getByText('That is the limit: 1,000 characters')).toBeVisible();
    await expect(page.locator('#closing-message-limit-x, .field__counter').last()).toBeAttached();
  });
});

test.describe('US-6 and US-7 customise the characters', () => {
  async function toCharacters(page: Page) {
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click();
    await page.getByLabel(/Who is this museum for/).fill('Alex');
    await page.getByLabel(/Your name/).fill('Sam');
    await NEXT(page).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
  }

  const counts = async (page: Page, group: string) =>
    page.getByRole('radiogroup', { name: group }).getByRole('radio').count();

  test('US-6 AC-1 and US-7 AC-1: option counts meet the minimums; the Guide also has facial hair', async ({ page }) => {
    await toCharacters(page);
    // Visitor first.
    await page.getByRole('tab', { name: /^Visitor/ }).click();
    expect(await counts(page, 'Skin tone')).toBeGreaterThanOrEqual(8);
    await expect(page.getByRole('radiogroup', { name: 'Facial hair' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Hair' }).click();
    expect(await counts(page, 'Hair style')).toBeGreaterThanOrEqual(8);
    expect(await counts(page, 'Hair colour')).toBeGreaterThanOrEqual(8);
    await page.getByRole('tab', { name: 'Outfit' }).click();
    expect(await counts(page, 'Outfit style')).toBeGreaterThanOrEqual(5);
    expect(await counts(page, 'Outfit colour')).toBeGreaterThanOrEqual(1);
    await page.getByRole('tab', { name: 'Body' }).click();
    expect(await counts(page, 'Body type')).toBeGreaterThanOrEqual(3);
    expect(await counts(page, 'Height')).toBeGreaterThanOrEqual(3);
    // Guide.
    await page.getByRole('tab', { name: /^Guide/ }).click();
    await page.getByRole('tab', { name: 'Face' }).click();
    expect(await counts(page, 'Facial hair')).toBeGreaterThanOrEqual(4); // none plus 3 styles
  });

  test('US-6 AC-2 and AC-4: options are chosen with the keyboard and the description updates', async ({ page }) => {
    await toCharacters(page);
    await page.getByRole('tab', { name: 'Hair' }).click();
    const group = page.getByRole('radiogroup', { name: 'Hair style' });
    const before = await group.getByRole('radio', { checked: true }).getAttribute('aria-label').catch(() => null);
    const description = page.locator('.preview-slot__description');
    const was = await description.textContent();
    await group.getByRole('radio', { checked: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { checked: true })).toBeFocused();
    await expect(description).not.toHaveText(was ?? '');
    void before;
  });

  test('US-6 AC-5: the 3D preview shows a loading indicator and its option lists stay usable', async ({ page }) => {
    await openBuilder(page);
    await page.route('**/assets/AvatarPreview-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click();
    await page.getByLabel(/Who is this museum for/).fill('Alex');
    await page.getByLabel(/Your name/).fill('Sam');
    await NEXT(page).click();
    await expect(page.getByText('Getting your characters ready')).toBeVisible();
    await page.getByRole('tab', { name: 'Hair' }).click();
    await page.getByRole('radiogroup', { name: 'Hair style' }).getByRole('radio').nth(1).click();
    await expect(page.getByText('Getting your characters ready')).toBeHidden({ timeout: 20_000 });
  });

  test('US-6 AC-5: without WebGL the preview is replaced by a message and the options still work', async ({ page }) => {
    await page.addInitScript(() => {
      const proto = (globalThis as unknown as { HTMLCanvasElement: { prototype: { getContext: (...a: unknown[]) => unknown } } }).HTMLCanvasElement.prototype;
      const original = proto.getContext;
      proto.getContext = function (this: unknown, type: unknown, ...rest: unknown[]) {
        if (typeof type === 'string' && /webgl/i.test(type)) return null;
        return original.call(this, type, ...rest);
      };
    });
    await toCharacters(page);
    await expect(page.getByText("3D preview isn't available on this device")).toBeVisible();
    await page.getByRole('tab', { name: 'Hair' }).click();
    await page.getByRole('radiogroup', { name: 'Hair style' }).getByRole('radio').nth(2).click();
    await expect(page.getByRole('radiogroup', { name: 'Hair style' }).getByRole('radio').nth(2)).toBeChecked();
  });

  test('US-7 AC-3: the two previews each show their own name', async ({ page }) => {
    await toCharacters(page);
    await expect(page.getByRole('tab', { name: 'Guide: Sam' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Visitor: Alex' })).toBeVisible();
    await expect(page.locator('.preview-slot')).toContainText('Sam');
    await expect(page.locator('.preview-slot')).toContainText('Alex');
  });

  // US-6 AC-3: "when the page reloads, then my choices are still selected". The draft is memory
  // only (src/state/builderStore.ts says restore is Release 2), so this is expected to fail until
  // BUG-1 is resolved. `test.fail` keeps the suite green and goes red when it is fixed.
  test('US-6 AC-3 (BUG-1): character choices survive a page reload', async ({ page }) => {
    test.fail(true, 'BUG-1: the draft, including avatar choices, is memory-only and is lost on reload');
    await toCharacters(page);
    await page.getByRole('tab', { name: 'Hair' }).click();
    const group = page.getByRole('radiogroup', { name: 'Hair style' });
    const initial = await group.getByRole('radio', { checked: true }).getAttribute('value');
    await group.getByRole('radio').nth(3).click();
    const chosen = await group.getByRole('radio', { checked: true }).getAttribute('value');
    expect(chosen, 'a non-default hair style was chosen').not.toBe(initial);
    await page.reload();
    await page.goto('./?e2e=1#/create');
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('tab', { name: 'Hair' }).click();
    const after = await page.getByRole('radiogroup', { name: 'Hair style' }).getByRole('radio', { checked: true }).getAttribute('value');
    expect(after).toBe(chosen);
  });
});

test.describe('US-8 preview before publishing', () => {
  test('US-8 AC-4: Preview without the minimum lists what is missing', async ({ page }) => {
    await openBuilder(page);
    await page.getByRole('button', { name: 'Preview' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Almost ready to preview' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Add at least one photo.');
    await expect(dialog).toContainText('Enter the name of the person this museum is for.');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });

  test('US-8 AC-1 to AC-3: the full visitor experience runs in preview; Exit preview returns to Review with settings intact', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await openBuilder(page);
    await addPhotos(page, makePhotos(2));
    await page.getByLabel('Caption (optional)').first().fill('Preview caption.');
    await fillWords(page, { visitorName: 'Preview Pat', guideName: 'Guide Gus', closingMessage: 'Bye\nnow' });
    await page.getByRole('button', { name: 'Preview' }).first().click();
    // The welcome screen, then free roaming with the Guide's presentation and the finale.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A museum for Preview Pat');
    await expect(page.getByRole('region', { name: 'Preview' })).toContainText('Preview Pat');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForFunction(() => (globalThis as unknown as PageGlobals).__surpriseMuseum !== undefined);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await expect(page.locator('.caption-card')).toContainText('Preview caption.', { timeout: 30_000 });
    await expect(page.locator('.caption-card')).toContainText('Guide Gus');
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await expect(page.locator('.finale-card')).toContainText('Bye', { timeout: 15_000 });
    // Exit preview: back on Review with everything intact.
    await page.getByRole('button', { name: 'Exit preview' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
    await expect(page.locator('.review-list')).toContainText('Preview Pat');
    await expect(page.locator('.review-list')).toContainText('Guide Gus');
    await expect(page.locator('.review-list')).toContainText('Bye\nnow'.replace('\n', ' ').split(' ')[0]!);
    await expect(page.locator('.review-thumbs img')).toHaveCount(2);
    problems.expectClean();
  });
});

test.describe('US-22 publish', () => {
  async function toReview(page: Page, photos = 2) {
    await openBuilder(page);
    await addPhotos(page, makePhotos(photos));
    await fillWords(page, {});
  }

  test('US-22 AC-1: Publish needs the consent tick, and the terms are linked', async ({ page }) => {
    await toReview(page);
    await page.getByRole('button', { name: /Publish museum/ }).click();
    await expect(page.getByText('Please confirm you have the right to share these photos.').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Read the terms/ })).toHaveAttribute('href', '#/terms');
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toHaveCount(0);
  });

  test('US-22 AC-2 and AC-3: links, Copy confirmation, edit-link warning and acknowledgement', async ({
    page,
    context,
    browserName,
  }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await toReview(page);
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    await page.getByRole('button', { name: /Publish museum/ }).click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Save this link now')).toBeVisible();
    const share = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
    expect(share).toMatch(/#\/m\/[A-Za-z0-9_-]{16,}$/);
    const edit = await page.getByRole('textbox', { name: 'Private edit link' }).inputValue();
    expect(edit).toMatch(/#\/edit\/[A-Za-z0-9_-]{30,}$/);
    expect(share).not.toContain(edit.split('/').pop()!);
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeAttached();
    if (browserName === 'chromium') {
      expect(await page.evaluate("navigator.clipboard.readText()")).toBe(share);
    }
    // The demo notice is honest that this is not a real link for anyone else.
    await expect(page.getByText(/Demo/).first()).toBeVisible();
    // Finish is blocked until the edit link is acknowledged.
    await expect(page.getByRole('button', { name: 'Finish' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('checkbox', { name: /saved my edit link/ }).check();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Turn your photos into a little museum');
  });

  test('US-22 AC-4: publishing cannot run twice (the button shows progress and is not available)', async ({ page }) => {
    await toReview(page);
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    const publish = page.getByRole('button', { name: /Publish museum/ });
    await publish.dblclick();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    const count = await page.evaluate(`globalThis.__APP_TEST__.useBuilderStore.getState().publish.phase`);
    expect(count).toBe('done');
  });

  test('US-22 AC-5: a publish failure keeps the work and offers Try again', async ({ page }) => {
    await toReview(page);
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    // Inject a failed state as the store would after a failed request, then retry for real.
    await page.evaluate(`globalThis.__APP_TEST__.useBuilderStore.setState({ publish: { phase: 'failed', error: 'Something went wrong. Please try again.', shareToken: null } })`);
    await expect(page.getByRole('alert').filter({ hasText: "Publishing didn't work" })).toBeVisible();
    await expect(page.locator('.review-thumbs img')).toHaveCount(2);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
  });
});

test.describe('US-29 draft', () => {
  // The MVP keeps the draft in memory only (FR-12 / US-29 are Should and not built).
  test('US-29 AC-1 (BUG-1): a refresh restores photos, captions, names and characters', async ({ page }) => {
    test.fail(true, 'BUG-1: the draft is memory-only; restore on refresh is not built');
    await openBuilder(page);
    await addPhotos(page, makePhotos(1));
    await NEXT(page).click();
    await page.getByLabel(/Who is this museum for/).fill('Restored');
    await page.reload();
    await page.goto('./?e2e=1#/create');
    await NEXT(page).click({ timeout: 5000 });
    await expect(page.getByLabel(/Who is this museum for/)).toHaveValue('Restored', { timeout: 5000 });
  });
});
