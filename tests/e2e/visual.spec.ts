import { expect, test as base } from './support/fixtures';
import {
  chooseGender,
  createMuseum,
  LEGACY_GUIDE_AVATAR,
  LEGACY_VISITOR_AVATAR,
  makeStoredMuseumsLegacy,
  openVisit,
  seedDraftAndOpen,
  startVisit,
  waitForSnap,
  type PageGlobals,
} from './support/app';
import { MUSEUM_CAPTIONS } from './support/fixtures';

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
  // BUG-14 is fixed (fix round 1): the card grows to 90% of the screen height and its body scrolls. finale.png was re-recorded in QA round 7
  // for the CR-4 card (seal, rule, trays) and the un-squeezed footer.
  // Observation N-11 (round 7): the card chooses its dock when it first appears, and on about 1 run in 10 on a loaded host it picks the left
  // (the old position, 22% of pixels differ) instead of the right. Both are valid placements, so the baseline is the usual right dock:
  // open again, up to 4 times, until the card is docked right. The dock seen on each try is recorded as an annotation.
  const docks: string[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await expect(page.locator('.finale-card')).toBeVisible();
    await waitForSnap(page, (n) => n.guide.opacity >= 1, 20_000, 'the Guide to settle');
    docks.push((await page.locator('.finale-card').getAttribute('data-dock')) ?? 'none');
    if (docks[docks.length - 1] === 'right') break;
  }
  test.info().annotations.push({ type: 'finale-dock-per-try', description: docks.join(', ') });
  expect(docks[docks.length - 1], 'the finale card docks right on a 1280x720 desktop').toBe('right');
  // The follow camera keeps easing toward the podium for a while (longer on a loaded host): wait until it has been still for 1.2 s,
  // otherwise the framing differs run to run (22% of pixels in round 7).
  await page.waitForFunction(() => {
    const g = globalThis as unknown as { __qaCam?: { p: number[]; t: number } };
    const c = ((globalThis as unknown as { __surpriseMuseum: { snapshot(): unknown } }).__surpriseMuseum.snapshot() as { camera: { x: number; y: number; z: number } }).camera;
    const p = [c.x, c.y, c.z];
    const last = g.__qaCam;
    if (!last || Math.hypot(p[0] - last.p[0], p[1] - last.p[1], p[2] - last.p[2]) > 0.002) { g.__qaCam = { p, t: performance.now() }; return false; }
    return performance.now() - last.t > 1200;
  }, null, { timeout: 30_000, polling: 200 });
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

// ---------------------------------------------------------------------------------------------
// CR-1 (gender). The preview baselines are made from a restored draft, so the rigs are built once with
// the chosen gender. (Changing gender in place used to move the character off its plinth: BUG-6, fixed in round 4 and
// covered in gender.spec.ts. Restored drafts are kept so the baselines do not depend on click timing.)
// ---------------------------------------------------------------------------------------------

const waitForPreview = async (page: Parameters<typeof seedDraftAndOpen>[0]) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
  await expect(page.locator('.preview-slot__loading')).toBeHidden({ timeout: 30_000 });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(1500);
};

test.describe('gender previews and visits', () => {
  test('visual: builder preview, Guide Woman and Visitor Man', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'feminine' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 'masculine' },
    });
    await waitForPreview(page);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('preview-woman-man.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: builder preview, Guide Man and Visitor Woman', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'masculine' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 'feminine' },
    });
    await waitForPreview(page);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('preview-man-woman.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: builder preview from behind (the Visitor sees their own character from behind), Woman and Man', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'feminine' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 'masculine' },
    });
    await waitForPreview(page);
    await page.getByRole('button', { name: 'Back view' }).click();
    await page.waitForTimeout(1200);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('preview-woman-man-back.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: the restored draft equals a preview built from the same choices (US-46 AC-5)', async ({ page }) => {
    // Same baseline name as the first test: reloading the page must give exactly that preview.
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'feminine' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 'masculine' },
    });
    await waitForPreview(page);
    await page.reload();
    await waitForPreview(page);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('preview-woman-man.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: Woman on the deepest skin tones with dark hair, close up (spec 9.7 brow check)', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'feminine', skinTone: 'skin-10', hairColor: 'black', hairStyle: 'bob' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 'feminine', skinTone: 'skin-09', hairColor: 'dark-brown', hairStyle: 'long-straight' },
    });
    await waitForPreview(page);
    const box = (await page.locator('.preview-slot__stage').boundingBox())!;
    await expect(page).toHaveScreenshot('brows-woman-deep-skin.png', {
      maxDiffPixelRatio: 0.02,
      clip: { x: box.x, y: box.y + 90, width: box.width, height: 100 },
    });
  });

  test('visual: entrance of a visit with a Woman Guide and a Man Visitor', async ({ page }) => {
    const m = await createMuseum(page, {
      photos: 4,
      captions: MUSEUM_CAPTIONS,
      onCharacters: async (p) => {
        await chooseGender(p, 'Guide', 'Woman');
        await chooseGender(p, 'Visitor', 'Man');
      },
    });
    await openVisit(page, m.shareToken);
    await startVisit(page);
    await waitForSnap(page, (n) => Object.values(n.photoStatus).every((v) => v === 'loaded') && n.labels.visitor && n.labels.guide, 30_000, 'photos and labels');
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot('entrance-woman-man.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: entrance of a visit with a Man Guide and a Woman Visitor', async ({ page }) => {
    const m = await createMuseum(page, {
      photos: 4,
      captions: MUSEUM_CAPTIONS,
      onCharacters: async (p) => {
        await chooseGender(p, 'Guide', 'Man');
        await chooseGender(p, 'Visitor', 'Woman');
      },
    });
    await openVisit(page, m.shareToken);
    await startVisit(page);
    await waitForSnap(page, (n) => Object.values(n.photoStatus).every((v) => v === 'loaded') && n.labels.visitor && n.labels.guide, 30_000, 'photos and labels');
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot('entrance-man-woman.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: a museum published before v0.3 (no gender stored) looks exactly like the existing Neutral entrance baseline', async ({ page, museum }) => {
    // Uses the existing baseline `entrance.png` on purpose: FR-75 says older museums look the same.
    expect(await makeStoredMuseumsLegacy(page)).toBe(1);
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await waitForSnap(page, (n) => Object.values(n.photoStatus).every((v) => v === 'loaded') && n.labels.visitor && n.labels.guide, 30_000, 'photos and labels');
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot('entrance.png', { maxDiffPixelRatio: 0.02 });
  });
});

// ---------------------------------------------------------------------------------------------
// Round 6 (CR-4): face shapes, new clothing styles and patterns in the builder preview, the More options group, and the
// ceiling cutaway from above. Baselines are made from restored drafts (no click timing), reduced motion, desktop Chromium.
// ---------------------------------------------------------------------------------------------

test.describe('CR-4 character options', () => {
  for (const shape of ['oval', 'round', 'square', 'heart', 'long']) {
    test(`visual: builder preview, Guide with a ${shape} face`, async ({ page }) => {
      await seedDraftAndOpen(page, {
        step: 3,
        visitorName: 'Alex',
        guideName: 'Sam',
        guideAvatar: { ...LEGACY_GUIDE_AVATAR, faceShape: shape },
        visitorAvatar: { ...LEGACY_VISITOR_AVATAR },
      });
      await waitForPreview(page);
      await expect(page.locator('.preview-slot__stage')).toHaveScreenshot(`face-${shape}.png`, { maxDiffPixelRatio: 0.02 });
    });
  }

  test('visual: builder preview, a sweater with stripes and overalls with checks', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, outfitStyle: 'sweater', outfitColor: 'teal', outfitPattern: 'stripes' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, outfitStyle: 'overalls', outfitColor: 'mustard', outfitPattern: 'checks' },
    });
    await waitForPreview(page);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('styles-sweater-stripes-overalls-checks.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: builder preview, a tracksuit with dots and a tunic', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, outfitStyle: 'tracksuit', outfitColor: 'red', outfitPattern: 'dots' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, outfitStyle: 'tunic', outfitColor: 'purple', outfitPattern: 'plain' },
    });
    await waitForPreview(page);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('styles-tracksuit-dots-tunic.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: builder preview, a coat with stripes and a cardigan with checks', async ({ page }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, outfitStyle: 'coat', outfitColor: 'charcoal', outfitPattern: 'checks' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, outfitStyle: 'cardigan', outfitColor: 'coral', outfitPattern: 'stripes' },
    });
    await waitForPreview(page);
    await expect(page.locator('.preview-slot__stage')).toHaveScreenshot('styles-coat-checks-cardigan-stripes.png', { maxDiffPixelRatio: 0.02 });
  });

  test('visual: the Characters controls with More options open on the Outfit tab (spec 12.5.3)', async ({ page }) => {
    // Tall viewport, so the sticky action bar is not drawn over the panel in the element screenshot.
    await page.setViewportSize({ width: 1280, height: 1500 });
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, outfitStyle: 'overalls', outfitPattern: 'dots', faceShape: 'round' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR },
    });
    await waitForPreview(page);
    await page.getByRole('tab', { name: 'Outfit', exact: true }).click();
    await expect(page.locator('.more-options__button')).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(500);
    await expect(page.locator('.characters__controls')).toHaveScreenshot('more-options-open-outfit.png', { maxDiffPixelRatio: 0.002 });
  });
});

test('visual: the entrance seen from above the ceiling at the top angle (the ceiling is cut away, FR-95)', async ({ page, museum }) => {
  await openVisit(page, museum.shareToken);
  await startVisit(page);
  await waitForSnap(page, (n) => n.guide.opacity >= 1, 30_000, 'the Guide to arrive');
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.mouse.move(640, 600, { steps: 12 });
  await page.mouse.up();
  await waitForSnap(page, (n) => n.camera.pitch > 0.93, 10_000, 'the top angle');
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('ceiling-cutaway-top-angle.png', { maxDiffPixelRatio: 0.02 });
});
