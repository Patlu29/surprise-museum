import { expect, test, type Page } from '@playwright/test';
import {
  addPhotos,
  builderAvatars,
  chooseGender,
  createMuseum,
  DRAFT_KEY,
  fillWords,
  LEGACY_GUIDE_AVATAR,
  LEGACY_VISITOR_AVATAR,
  makeStoredMuseumsLegacy,
  museumAvatars,
  openVisit,
  readDemoState,
  savedDraft,
  seedDraftAndOpen,
  startVisit,
  toCharactersStep,
  trackProblems,
  waitForSnap,
  type PageGlobals,
} from './support/app';
import { makePhotos, pixelDiffRatio } from './support/images';

/*
 * CR-1 (requirements v0.3, ADR 0020): US-46 (choose gender in the builder), US-47 (published museums
 * and older museums), US-48 (no gendered pronouns in app text). Gender ids are feminine, masculine and
 * neutral; the labels are Woman, Man and Neutral and appear only in the builder.
 */

const GENDER_GROUP = 'Gender (optional)';
const gender = (page: Page) => page.getByRole('radiogroup', { name: GENDER_GROUP });
const previewReady = (page: Page) => expect(page.locator('.preview-slot__loading')).toBeHidden({ timeout: 30_000 });
const BUG_11 =
  'BUG-11 (frontend-developer): WebKit keeps a failed dynamic import for the document (N-9), so Try again re-imports the same URL and fails again; only a reload recovers. Remove this line when fixed.';
/**
 * Largest share of differing pixels for "the same picture". Exactly 0 at a whole device pixel ratio (desktop, iPhone). On
 * a fractional ratio (Pixel 7: 2.625) two page loads sit half a device pixel apart and every figure edge differs (about
 * 1%, found by shifting one image against the other: best fit at half a pixel; reload against reload is exactly 0). A
 * character off its plinth changes well over 10%, so 3% still catches BUG-6.
 */
const sameLookLimit = async (page: Page) => ((await page.evaluate('window.devicePixelRatio')) as number) % 1 === 0 ? 0.0005 : 0.03;
/** Put the stage 110 px below the top of the viewport first, so the sticky step bar on a phone never covers part of the shot. */
const stageShot = async (page: Page) => {
  const stage = page.locator('.preview-slot__stage');
  // A whole-pixel scroll, so a rebuilt page lands on the same sub-pixel position.
  await stage.evaluate((el) => window.scrollTo(0, Math.round(window.scrollY + el.getBoundingClientRect().top - 110)));
  await page.waitForTimeout(150);
  return stage.screenshot({ animations: 'disabled' });
};
const PRONOUNS = /\b(she|her|hers|herself|he|him|his|himself|girlfriend|boyfriend)\b/i;

/** Everything a person or a screen reader gets from the page: visible text and accessible names. */
async function appText(page: Page): Promise<string> {
  const text = (await page.evaluate(`(() => {
    const doc = globalThis.document;
    const labels = [...doc.querySelectorAll('[aria-label],[title],[alt]')].flatMap((el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt')]).filter(Boolean);
    return doc.body.innerText + '\\n' + labels.join('\\n');
  })()`)) as string;
  // The floating name labels over the characters come and go with the camera; they hold the Creator's own words (the names).
  return text
    .split('\n')
    .filter((line) => !['Sam', 'Alex'].includes(line.trim()))
    // The live scene description changes with the moment ("Finale room" or "Finale. Sam is sharing a note."), not with gender.
    .filter((line) => !/^Finale(\.| room)/.test(line.trim()))
    .join('\n');
}

test.describe('US-46 choose each character gender in the builder', () => {
  test('US-46 AC-1: Woman, Man and Neutral for both characters, Neutral selected, and the Creator can continue without choosing', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await toCharactersStep(page);
    for (const role of ['Guide', 'Visitor'] as const) {
      await page.getByRole('tab', { name: new RegExp(`^${role}`) }).click();
      // Body is the first tab and Gender is the first group on it (spec 9.4).
      await expect(page.getByRole('tab', { name: 'Body' })).toHaveAttribute('aria-selected', 'true');
      const group = gender(page);
      await expect(group).toBeVisible();
      await expect(group.getByRole('radio')).toHaveText(['Woman', 'Man', 'Neutral']);
      await expect(group.getByRole('radio', { name: 'Neutral', exact: true })).toBeChecked();
      const labels = await page.locator('.characters__controls .radio-group__label').allTextContents();
      expect(labels[0], 'Gender is the first group on the Body tab').toBe(GENDER_GROUP);
      await expect(page.getByText('Changes the shape and face. Your other choices stay as they are.')).toBeVisible();
      // The group is linked to its helper text.
      await expect(group).toHaveAttribute('aria-describedby', /.+/);
    }
    const a = await builderAvatars(page);
    expect(a.guide.gender).toBe('neutral');
    expect(a.visitor.gender).toBe('neutral');
    // Nothing is required: Next goes to Review without any choice.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
    problems.expectClean();
  });

  test('US-46 AC-1: the Body tab labels read "Wider hips" and "Wider shoulders"', async ({ page }) => {
    await toCharactersStep(page);
    const body = page.getByRole('radiogroup', { name: 'Body type' }).getByRole('radio');
    await expect(body).toHaveText(['Slim', 'Regular', 'Wider hips', 'Wider shoulders']);
    await expect(page.getByText(/curvy|broad/i)).toHaveCount(0);
  });

  test('US-46 AC-2: choosing a gender changes only that character; the description names it unless Neutral', async ({
    page,
  }) => {
    await toCharactersStep(page);
    const description = page.locator('.preview-slot__description');
    await expect(description).toHaveText(/^Sam: medium height/); // Neutral: no gender word
    await chooseGender(page, 'Guide', 'Woman');
    await expect(description).toHaveText(/^Sam: woman, medium height/);
    let a = await builderAvatars(page);
    expect(a.guide.gender).toBe('feminine');
    expect(a.visitor.gender).toBe('neutral');
    await chooseGender(page, 'Visitor', 'Man');
    await expect(description).toHaveText(/^Alex: man, medium height/);
    a = await builderAvatars(page);
    expect(a.guide.gender).toBe('feminine');
    expect(a.visitor.gender).toBe('masculine');
    // The tabs keep each character's own selection.
    await page.getByRole('tab', { name: /^Guide/ }).click();
    await expect(gender(page).getByRole('radio', { name: 'Woman', exact: true })).toBeChecked();
    await page.getByRole('tab', { name: /^Visitor/ }).click();
    await expect(gender(page).getByRole('radio', { name: 'Man', exact: true })).toBeChecked();
    // Back to Neutral drops the word again.
    await chooseGender(page, 'Visitor', 'Neutral');
    await expect(description).toHaveText(/^Alex: medium height/);
    expect(await description.textContent()).not.toMatch(/woman|\bman\b/i);
    // The whole-preview text alternative lists both characters.
    await expect(page.locator('.preview-slot__stage')).toHaveAttribute('aria-label', /Sam: woman, .*Alex: medium height/);
  });

  test.describe('preview update within 1 second (reduced motion: deterministic frames)', () => {
    test.use({ reducedMotion: 'reduce' });
    /** Fraction of pixels that differ by more than 12/255 (software GL noise is far below this). */
    const SAME = 0.0005;
    const CHANGED = 0.004;

    async function settledPreview(page: Page) {
      await toCharactersStep(page);
      await previewReady(page);
      await page.waitForTimeout(1500); // the first frames and fades have finished
      const box = (await page.locator('.preview-slot__stage').boundingBox())!;
      const half = { width: Math.floor(box.width / 2), height: box.height };
      const left = { x: box.x, y: box.y, ...half };
      const right = { x: box.x + half.width, y: box.y, ...half };
      return { left, right, shot: (clip: typeof left) => page.screenshot({ clip, animations: 'disabled' }) };
    }

    test('US-46 AC-2: the preview changes within 1 s of choosing a gender and then holds still', async ({ page }, testInfo) => {
      const { left, shot } = await settledPreview(page);
      const before = await shot(left);
      expect(pixelDiffRatio(before, await shot(left)), 'the idle preview is stable between two frames').toBeLessThan(SAME);

      const started = Date.now();
      await gender(page).getByRole('radio', { name: 'Woman', exact: true }).click();
      let changedAfterMs = -1;
      let after = before;
      while (Date.now() - started < 3000) {
        after = await shot(left);
        if (pixelDiffRatio(before, after) > CHANGED) {
          changedAfterMs = Date.now() - started;
          break;
        }
      }
      testInfo.annotations.push({ type: 'woman-shape-visible-after-ms', description: String(changedAfterMs) });
      expect(changedAfterMs, 'the Guide preview must change').toBeGreaterThan(0);
      expect(changedAfterMs, 'FR-15: within 1 second').toBeLessThanOrEqual(1000);
      // Reduced motion: the final shape arrives in one frame (spec 9.5), so it does not change afterwards.
      await page.waitForTimeout(600);
      expect(pixelDiffRatio(after, await shot(left)), 'reduced motion shows the final shape at once').toBeLessThan(SAME);
    });

    test('US-46 AC-2: after choosing a gender the character stays on its plinth, so the preview equals one rebuilt from the saved choice, and the other character does not move', async ({
      page,
    }, testInfo) => {
      await toCharactersStep(page);
      await previewReady(page);
      await page.waitForTimeout(1500);
      await gender(page).getByRole('radio', { name: 'Woman', exact: true }).click();
      await page.waitForTimeout(1500);
      const live = await stageShot(page);
      await page.reload(); // the draft keeps the choice; the preview is rebuilt from it in one go
      await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible({ timeout: 10_000 });
      await previewReady(page);
      await page.waitForTimeout(1500);
      const rebuilt = await stageShot(page);
      const ratio = pixelDiffRatio(live, rebuilt);
      testInfo.annotations.push({ type: 'live-vs-rebuilt-diff-ratio', description: String(ratio) });
      expect(ratio, 'the changed preview matches the rebuilt one').toBeLessThan(await sameLookLimit(page));
    });

    test('US-46 AC-2: a body type change leaves the character on its plinth', async ({ page }) => {
      await toCharactersStep(page);
      await previewReady(page);
      await page.waitForTimeout(1500);
      await page.getByRole('radiogroup', { name: 'Body type' }).getByRole('radio', { name: 'Wider shoulders' }).click();
      await page.waitForTimeout(1500);
      const live = await stageShot(page);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible({ timeout: 10_000 });
      await previewReady(page);
      await page.waitForTimeout(1500);
      expect(pixelDiffRatio(live, await stageShot(page))).toBeLessThan(await sameLookLimit(page));
    });

    test('US-46 AC-2: Woman, Man and Neutral give three different Guide shapes, and an old draft with no gender equals Neutral', async ({ page }, testInfo) => {
      const guideLook = async (avatar: Record<string, unknown>) => {
        await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam', guideAvatar: avatar });
        await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
        await previewReady(page);
        await page.waitForTimeout(1500);
        const box = (await page.locator('.preview-slot__stage').boundingBox())!;
        return page.screenshot({ clip: { x: box.x, y: box.y, width: Math.floor(box.width / 2), height: box.height }, animations: 'disabled' });
      };
      const legacy = await guideLook({ ...LEGACY_GUIDE_AVATAR });
      const neutral = await guideLook({ ...LEGACY_GUIDE_AVATAR, gender: 'neutral' });
      const woman = await guideLook({ ...LEGACY_GUIDE_AVATAR, gender: 'feminine' });
      const man = await guideLook({ ...LEGACY_GUIDE_AVATAR, gender: 'masculine' });
      const d = { legacyVsNeutral: pixelDiffRatio(legacy, neutral), womanVsNeutral: pixelDiffRatio(woman, neutral), manVsNeutral: pixelDiffRatio(man, neutral), manVsWoman: pixelDiffRatio(man, woman) };
      testInfo.annotations.push({ type: 'preview-diff-ratios', description: JSON.stringify(d) });
      expect(d.legacyVsNeutral, 'no gender and Neutral are the same look (FR-75)').toBeLessThan(SAME);
      expect(d.womanVsNeutral, 'Woman differs from Neutral').toBeGreaterThan(CHANGED / 4);
      expect(d.manVsNeutral, 'Man differs from Neutral').toBeGreaterThan(CHANGED / 4);
      expect(d.manVsWoman, 'Man differs from Woman').toBeGreaterThan(CHANGED / 4);
    });
  });

  test('US-46 AC-3: changing the gender changes nothing else, and every option stays available', async ({ page }) => {
    await toCharactersStep(page);
    // Put the Guide on a set of non-default choices through the real controls.
    const pick = async (tab: string, group: string, index: number) => {
      await page.getByRole('tab', { name: tab }).click();
      await page.getByRole('radiogroup', { name: group }).getByRole('radio').nth(index).click();
    };
    await page.getByRole('tab', { name: /^Guide/ }).click();
    await pick('Face', 'Skin tone', 8);
    await pick('Face', 'Facial hair', 4);
    await pick('Hair', 'Hair style', 7);
    await pick('Hair', 'Hair colour', 4);
    await pick('Outfit', 'Outfit style', 4);
    await pick('Outfit', 'Outfit colour', 3);
    await pick('Body', 'Body type', 2);
    await pick('Body', 'Height', 2);
    const { gender: g0, ...others } = (await builderAvatars(page)).guide;
    expect(g0).toBe('neutral');
    const groups = [
      ['Face', 'Skin tone'],
      ['Face', 'Facial hair'],
      ['Hair', 'Hair style'],
      ['Hair', 'Hair colour'],
      ['Outfit', 'Outfit style'],
      ['Outfit', 'Outfit colour'],
      ['Body', 'Body type'],
      ['Body', 'Height'],
    ] as const;
    const counts = async () => {
      const out: number[] = [];
      for (const [tab, group] of groups) {
        await page.getByRole('tab', { name: tab }).click();
        const radios = page.getByRole('radiogroup', { name: group }).getByRole('radio');
        out.push(await radios.count());
        for (const r of await radios.all()) {
          await expect(r).toBeEnabled();
          expect(await r.getAttribute('aria-disabled')).not.toBe('true');
        }
      }
      return out;
    };
    const baseline = await counts();
    for (const label of ['Woman', 'Man', 'Neutral', 'Woman'] as const) {
      await chooseGender(page, 'Guide', label);
      const { gender: g, ...rest } = (await builderAvatars(page)).guide;
      expect(g).toBe({ Woman: 'feminine', Man: 'masculine', Neutral: 'neutral' }[label]);
      expect(rest, `other choices unchanged after ${label}`).toEqual(others);
      expect(await counts(), `option counts after ${label}`).toEqual(baseline);
    }
    // The Visitor is untouched by all of that.
    const v = (await builderAvatars(page)).visitor;
    expect(v.gender).toBe('neutral');
    expect(v.hairStyle).toBe(LEGACY_VISITOR_AVATAR.hairStyle);
    // Reset returns the active character to the starting look, including Neutral (spec 9.4).
    await page.getByRole('button', { name: 'Reset Guide to the starting look' }).click();
    const reset = (await builderAvatars(page)).guide;
    expect(reset).toMatchObject({ gender: 'neutral', hairStyle: LEGACY_GUIDE_AVATAR.hairStyle, skinTone: LEGACY_GUIDE_AVATAR.skinTone });
  });

  test('US-46 AC-3: inclusive combinations (Man in a dress, Woman with a full beard) are all selectable', async ({ page }) => {
    await toCharactersStep(page);
    await chooseGender(page, 'Guide', 'Man');
    await page.getByRole('tab', { name: 'Outfit' }).click();
    await page.getByRole('radiogroup', { name: 'Outfit style' }).getByRole('radio', { name: /dress/i }).click();
    await chooseGender(page, 'Visitor', 'Woman');
    await page.getByRole('tab', { name: 'Face' }).click();
    await page.getByRole('radiogroup', { name: 'Facial hair' }).getByRole('radio', { name: 'Full beard' }).click();
    const a = await builderAvatars(page);
    expect(a.guide).toMatchObject({ gender: 'masculine', outfitStyle: 'dress' });
    expect(a.visitor).toMatchObject({ gender: 'feminine', facialHair: 'full-beard' });
    await expect(page.locator('.preview-slot__description')).toContainText('woman, ');
    await expect(page.locator('.preview-slot__description')).toContainText('full beard');
  });

  test('US-46 AC-4: keyboard only, the group is a radiogroup, arrows move and select, the selection is announced and the preview updates', async ({
    page,
  }) => {
    await toCharactersStep(page);
    await previewReady(page);
    const group = gender(page);
    await expect(group).toHaveAttribute('role', 'radiogroup');
    await expect(group).toHaveAttribute('aria-labelledby', /.+/);
    // Roving tabindex: only the selected radio is in the tab order.
    const radios = group.getByRole('radio');
    await expect(radios.nth(2)).toHaveAttribute('tabindex', '0');
    await expect(radios.nth(0)).toHaveAttribute('tabindex', '-1');
    await expect(radios.nth(1)).toHaveAttribute('tabindex', '-1');
    // The first control after the tabs is the Gender group: one Tab from the Body tab lands in it.
    await page.getByRole('tab', { name: 'Body' }).focus();
    await page.keyboard.press('Tab');
    await expect(radios.nth(2)).toBeFocused();
    // Arrow keys move and select (and wrap).
    await page.keyboard.press('ArrowRight');
    await expect(radios.nth(0)).toBeFocused();
    await expect(radios.nth(0)).toBeChecked();
    await expect(page.locator('.preview-slot__description')).toContainText('woman, ');
    await page.keyboard.press('ArrowRight');
    await expect(radios.nth(1)).toBeChecked();
    await expect(page.locator('.preview-slot__description')).toContainText('man, ');
    await page.keyboard.press('ArrowLeft');
    await expect(radios.nth(0)).toBeChecked();
    await page.keyboard.press('End');
    await expect(radios.nth(2)).toBeChecked();
    await page.keyboard.press('Home');
    await expect(radios.nth(0)).toBeChecked();
    // The selection is announced through the polite live region once typing settles (debounced).
    const live = page.locator('.characters [role=status].visually-hidden');
    await expect(live).toHaveText(/Sam: woman, medium height/, { timeout: 3000 });
    // The polite region is not assertive.
    await expect(page.locator('[aria-live=assertive]')).toHaveCount(0);
    // Tab leaves the group: next is the Body type group.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radiogroup', { name: 'Body type' }).getByRole('radio', { checked: true })).toBeFocused();
    // Space selects too.
    await page.getByRole('radiogroup', { name: GENDER_GROUP }).getByRole('radio', { name: 'Man', exact: true }).focus();
    await page.keyboard.press('Space');
    expect((await builderAvatars(page)).guide.gender).toBe('masculine');
    expect((await builderAvatars(page)).visitor.gender).toBe('neutral');
  });

  test('US-46 AC-5: both choices are restored in the controls and the preview after a reload', async ({ page }) => {
    await toCharactersStep(page);
    await chooseGender(page, 'Guide', 'Woman');
    await chooseGender(page, 'Visitor', 'Man');
    const stored = await savedDraft(page);
    expect(stored!.fields.guideAvatar.gender).toBe('feminine');
    expect(stored!.fields.visitorAvatar.gender).toBe('masculine');
    await page.reload();
    await page.goto('./?e2e=1#/create');
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible({ timeout: 10_000 });
    await previewReady(page);
    await expect(page.locator('.preview-slot__stage')).toHaveAttribute('aria-label', /Sam: woman, .*Alex: man, /);
    await page.getByRole('tab', { name: /^Guide/ }).click();
    await expect(gender(page).getByRole('radio', { name: 'Woman', exact: true })).toBeChecked();
    await page.getByRole('tab', { name: /^Visitor/ }).click();
    await expect(gender(page).getByRole('radio', { name: 'Man', exact: true })).toBeChecked();
    const a = await builderAvatars(page);
    expect([a.guide.gender, a.visitor.gender]).toEqual(['feminine', 'masculine']);
  });

  test('US-46 AC-5: a saved draft with an unknown or wrongly typed gender restores as Neutral and keeps every other choice', async ({
    page,
  }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'Woman', hairStyle: 'afro' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 7, hairStyle: 'ponytail' },
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    const a = await builderAvatars(page);
    expect(a.guide).toMatchObject({ gender: 'neutral', hairStyle: 'afro' });
    expect(a.visitor).toMatchObject({ gender: 'neutral', hairStyle: 'ponytail' });
  });

  test('US-46 AC-6: while the preview is loading the Gender group is usable and the choice is saved', async ({ page }) => {
    await page.route('**/assets/AvatarPreview-*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await toCharactersStep(page);
    await expect(page.getByText('Getting your characters ready')).toBeVisible();
    await gender(page).getByRole('radio', { name: 'Man', exact: true }).click();
    await expect(gender(page).getByRole('radio', { name: 'Man', exact: true })).toBeChecked();
    expect((await savedDraft(page))!.fields.guideAvatar.gender).toBe('masculine');
    await expect(page.getByText('Getting your characters ready')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('.preview-slot__stage')).toHaveAttribute('aria-label', /Sam: man, /);
  });

  test('US-46 AC-6: when the preview fails the Gender group stays usable and the choice is saved and shown once the preview loads again', async ({
    page,
    browserName,
  }) => {
    let fail = true;
    await page.route('**/assets/AvatarPreview-*.js', async (route) => {
      if (fail) await route.abort('failed');
      else await route.continue();
    });
    await toCharactersStep(page);
    await expect(page.getByText("We couldn't show the 3D preview. Your choices are still saved.")).toBeVisible({ timeout: 30_000 });
    await gender(page).getByRole('radio', { name: 'Woman', exact: true }).click();
    await expect(gender(page).getByRole('radio', { name: 'Woman', exact: true })).toBeChecked();
    expect((await savedDraft(page))!.fields.guideAvatar.gender).toBe('feminine');
    // The preview recovers (here on a reload, in a fresh document) and shows the saved choice.
    fail = false;
    // iPhone WebKit remembers the failed module for the session (note N-9), so recovery is only checked elsewhere.
    if (browserName === 'webkit') return;
    await page.goto('about:blank'); // a brand new document, so no failed module is remembered
    await page.goto('./?e2e=1#/create');
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible({ timeout: 10_000 });
    await previewReady(page);
    await expect(page.locator('.preview-slot__stage[role=img]')).toHaveAttribute('aria-label', /Sam: woman, /, { timeout: 20_000 });
  });

  test('US-46 AC-6: Try again after a failed preview load brings the preview back without a reload', async ({ page, browserName }) => {
    test.fail(browserName === 'webkit', BUG_11);
    let fail = true;
    await page.route('**/assets/AvatarPreview-*.js', async (route) => {
      if (fail) await route.abort('failed');
      else await route.continue();
    });
    await toCharactersStep(page);
    await expect(page.getByText("We couldn't show the 3D preview. Your choices are still saved.")).toBeVisible({ timeout: 30_000 });
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await previewReady(page);
    await expect(page.locator('.preview-slot__stage[role=img]')).toBeVisible({ timeout: 15_000 });
  });

  test('US-46 AC-6: without WebGL the Gender group works and the text description names the gender', async ({ page }) => {
    await page.addInitScript(() => {
      const proto = (globalThis as unknown as { HTMLCanvasElement: { prototype: { getContext: (...a: unknown[]) => unknown } } }).HTMLCanvasElement.prototype;
      const original = proto.getContext;
      proto.getContext = function (this: unknown, type: unknown, ...rest: unknown[]) {
        if (typeof type === 'string' && /webgl/i.test(type)) return null;
        return original.call(this, type, ...rest);
      };
    });
    await toCharactersStep(page);
    await expect(page.getByText("3D preview isn't available on this device")).toBeVisible();
    await gender(page).getByRole('radio', { name: 'Woman', exact: true }).click();
    await expect(page.locator('.preview-slot__description')).toHaveText(/^Sam: woman, /);
  });
});

test.describe('US-47 published museums show the chosen gender, and older museums still load', () => {
  test.setTimeout(240_000);

  const pickGenders = (guide: 'Woman' | 'Man' | 'Neutral', visitor: 'Woman' | 'Man' | 'Neutral') => async (page: Page) => {
    await chooseGender(page, 'Guide', guide);
    await chooseGender(page, 'Visitor', visitor);
  };
  const ID = { Woman: 'feminine', Man: 'masculine', Neutral: 'neutral' } as const;

  test('US-47 AC-1: all nine gender pairs publish and open with the genders chosen', async ({ page }) => {
    const problems = trackProblems(page);
    for (const guide of ['Woman', 'Man', 'Neutral'] as const) {
      for (const visitor of ['Woman', 'Man', 'Neutral'] as const) {
        await page.goto('about:blank');
        const m = await createMuseum(page, { photos: 1, captions: ['One.'], onCharacters: pickGenders(guide, visitor) });
        await openVisit(page, m.shareToken);
        await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
        const a = await museumAvatars(page);
        expect([guide, visitor, a.guide.gender, a.visitor.gender]).toEqual([guide, visitor, ID[guide], ID[visitor]]);
      }
    }
    problems.expectClean();
  });

  test('US-47 AC-1 and AC-2: preview equals published (every avatar field), and a Visitor beard publishes and renders', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await page.goto('./?e2e=1#/create');
    // Build to Review with a Woman Guide, a Man Visitor with a full beard.
    const m = await createMuseum(page, {
      photos: 1,
      captions: ['One.'],
      onCharacters: async (p) => {
        await chooseGender(p, 'Guide', 'Woman');
        await chooseGender(p, 'Visitor', 'Man');
        await p.getByRole('tab', { name: 'Face' }).click();
        await p.getByRole('radiogroup', { name: 'Facial hair' }).getByRole('radio', { name: 'Full beard' }).click();
        await p.getByRole('tab', { name: 'Hair' }).click();
        await p.getByRole('radiogroup', { name: 'Hair style' }).getByRole('radio').nth(5).click();
      },
    });
    const built = await builderAvatars(page); // still in the store on the published screen
    expect(built.visitor.facialHair).toBe('full-beard');
    await openVisit(page, m.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    const published = await museumAvatars(page);
    expect(published.visitor).toMatchObject({ gender: 'masculine', facialHair: 'full-beard' });
    expect(published.guide.gender).toBe('feminine');
    // The published document equals what the builder held, field for field (round trip).
    expect(published.guide).toEqual(built.guide);
    expect(published.visitor).toEqual(built.visitor);
    await startVisit(page);
    await waitForSnap(page, (s) => s.ready && s.labels.visitor, 30_000, 'the beard Visitor to render');
    problems.expectClean();
  });

  test('US-47 AC-2: the Preview before publishing uses the chosen genders, identical to the published copy', async ({ page }) => {
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {
      onCharacters: async (p) => {
        await chooseGender(p, 'Guide', 'Man');
        await chooseGender(p, 'Visitor', 'Woman');
      },
    }); // ends on Review
    await page.getByRole('button', { name: 'Preview' }).first().click();
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    const previewAvatars = await museumAvatars(page);
    expect(previewAvatars.guide.gender).toBe('masculine');
    expect(previewAvatars.visitor.gender).toBe('feminine');
    await page.getByRole('button', { name: 'Exit preview' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    const publish = page.getByRole('button', { name: /Publish museum/ });
    await expect(publish).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    await publish.click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    const share = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
    await openVisit(page, share.split('/').pop() ?? '');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    expect(await museumAvatars(page)).toEqual(previewAvatars);
  });

  test('US-47 AC-3: a museum published before v0.3 (no gender stored) loads, reads as Neutral and runs', async ({ page }) => {
    const problems = trackProblems(page);
    const m = await createMuseum(page, { photos: 1, captions: ['One.'] });
    const n = await makeStoredMuseumsLegacy(page);
    expect(n).toBe(1);
    const stored = Object.values((await readDemoState(page)).museums)[0]!.document!;
    expect(stored.guideAvatar, 'the stored record really has no gender').not.toHaveProperty('gender');
    expect(stored.visitorAvatar).not.toHaveProperty('gender');
    await openVisit(page, m.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    const a = await museumAvatars(page);
    expect([a.guide.gender, a.visitor.gender]).toEqual(['neutral', 'neutral']);
    await startVisit(page);
    await waitForSnap(page, (s) => s.ready && s.labels.visitor, 30_000, 'the legacy visit to render');
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await expect(page.locator('.caption-card')).toBeVisible({ timeout: 30_000 });
    // The stored record is not rewritten by reading it.
    const after = Object.values((await readDemoState(page)).museums)[0]!.document!;
    expect(after.guideAvatar).not.toHaveProperty('gender');
    problems.expectClean();
  });
});

test.describe('US-47 AC-4 rejection of unknown gender values by the demo backend', () => {
  test.setTimeout(240_000);

  test('every invalid gender is refused with an error, nothing is stored, and a valid value publishes', async ({ page }, testInfo) => {
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {});
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    const publish = page.getByRole('button', { name: /Publish museum/ });
    await expect(publish).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    const cases: Array<[string, string]> = [
      ['visitorAvatar', "'Woman'"],
      ['visitorAvatar', "''"],
      ['visitorAvatar', 'null'],
      ['visitorAvatar', '3'],
      ['guideAvatar', "'male'"],
      ['guideAvatar', "'FEMININE'"],
    ];
    for (const [key, value] of cases) {
      await page.evaluate(
        `(() => { const st = globalThis.__APP_TEST__.useBuilderStore; st.setState({ ${key}: { ...st.getState().${key}, gender: ${value} }, publish: { phase: 'idle', error: null, shareToken: null } }); })()`,
      );
      await publish.click();
      await expect(page.getByRole('alert').filter({ hasText: "Publishing didn't work" }), `${key} gender ${value}`).toBeVisible({ timeout: 30_000 });
      const shown = await page.evaluate(`globalThis.__APP_TEST__.useBuilderStore.getState().publish.error`);
      testInfo.annotations.push({ type: `rejected ${key} ${value}`, description: String(shown) });
      // Uploads leave a draft museum with no document; a rejected publish must not have stored one.
      const stored = Object.values((await readDemoState(page)).museums);
      expect(stored.filter((x) => x.document !== null || x.status === 'published'), 'a rejected document stores nothing').toHaveLength(0);
      await page.getByRole('button', { name: 'Try again' }).waitFor();
      // Back to the start state so the next case begins from a clean Review.
      await page.evaluate(
        `globalThis.__APP_TEST__.useBuilderStore.setState({ publish: { phase: 'idle', error: null, shareToken: null } })`,
      );
    }
    // Restore valid values and publish for real.
    await page.evaluate(
      `(() => { const st = globalThis.__APP_TEST__.useBuilderStore; st.setState({ guideAvatar: { ...st.getState().guideAvatar, gender: 'feminine' }, visitorAvatar: { ...st.getState().visitorAvatar, gender: 'masculine' } }); })()`,
    );
    await publish.click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    const docs = Object.values((await readDemoState(page)).museums).map((x) => x.document).filter((d) => d !== null);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.guideAvatar.gender).toBe('feminine');
    expect(docs[0]!.visitorAvatar.gender).toBe('masculine');
  });
});

test.describe('US-48 app text does not assume anyone gender', () => {
  test.setTimeout(300_000);

  const CAPTION = 'A day at the beach.';
  const CLOSING = 'Thank you for visiting.';

  /** The visit's own text at the welcome, a presentation and the finale, minus the Creator's words. */
  async function visitText(page: Page, token: string): Promise<{ welcome: string; card: string; finale: string }> {
    await openVisit(page, token);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    const welcome = await appText(page);
    await startVisit(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await expect(page.locator('.caption-card')).toBeVisible({ timeout: 40_000 });
    await waitForSnap(page, (s) => s.guide.mode === 'present', 40_000, 'the Guide to present');
    const card = await appText(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await expect(page.locator('.finale-card')).toBeVisible({ timeout: 20_000 });
    const finale = await appText(page);
    return { welcome, card, finale };
  }

  test('US-48 AC-1 and AC-3: the visit text has no gendered pronoun or noun and is identical for every gender pair', async ({ page }) => {
    const pairs: Array<['Woman' | 'Man' | 'Neutral', 'Woman' | 'Man' | 'Neutral']> = [
      ['Neutral', 'Neutral'],
      ['Woman', 'Man'],
      ['Man', 'Woman'],
    ];
    const texts: Array<Awaited<ReturnType<typeof visitText>>> = [];
    for (const [g, v] of pairs) {
      await page.goto('about:blank');
      const m = await createMuseum(page, {
        photos: 1,
        captions: [CAPTION],
        closingMessage: CLOSING,
        onCharacters: async (p) => {
          await chooseGender(p, 'Guide', g);
          await chooseGender(p, 'Visitor', v);
        },
      });
      texts.push(await visitText(page, m.shareToken));
    }
    for (const t of texts) {
      for (const [screen, text] of Object.entries(t)) {
        expect(text.match(PRONOUNS), `${screen} text contains a gendered pronoun`).toBeNull();
        // "Woman" and "Man" are builder option labels only (A-20): never in the visit.
        expect(text.match(/\b(woman|man|women|men|girl|boy|lady|gentleman)\b/i), `${screen} text names a gender`).toBeNull();
      }
    }
    for (const key of ['welcome', 'card', 'finale'] as const) {
      expect(texts[1]![key], `${key} text for Woman and Man equals Neutral`).toBe(texts[0]![key]);
      expect(texts[2]![key], `${key} text for Man and Woman equals Neutral`).toBe(texts[0]![key]);
    }
  });

  test('US-48 AC-2: a caption and a closing message with "she" and "he" are shown exactly as typed', async ({ page }) => {
    const caption = 'She said he would come. Her hat, his dog, him and them.';
    const closing = 'He and she send their love to him and to her.';
    const m = await createMuseum(page, { photos: 1, captions: [caption], closingMessage: closing });
    await openVisit(page, m.shareToken);
    await startVisit(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await expect(page.locator('.caption-card')).toContainText(caption, { timeout: 40_000 });
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await expect(page.locator('.finale-card')).toContainText(closing, { timeout: 20_000 });
  });

  test('US-48 AC-1: the builder, review and publish screens contain no gendered pronoun or noun (the Gender labels aside)', async ({
    page,
  }) => {
    const hits: string[] = [];
    const scan = async (where: string) => {
      const text = (await appText(page)).replace(/\b(Woman|Man)\b/g, ''); // builder option labels are allowed
      const found = text.match(PRONOUNS);
      if (found) hits.push(`${where}: ${found[0]}`);
    };
    await page.goto('./?e2e=1');
    await scan('home');
    await page.goto('./?e2e=1#/create');
    await scan('step 1');
    await addPhotos(page, makePhotos(1));
    await scan('step 1 with a photo');
    await page.getByRole('button', { name: 'Next' }).click();
    await scan('step 2');
    await page.getByLabel(/Who is this museum for/).fill('Alex');
    await page.getByLabel(/Your name/).fill('Sam');
    await page.getByRole('button', { name: 'Next' }).click();
    for (const role of ['Guide', 'Visitor'] as const) {
      await chooseGender(page, role, 'Woman');
      for (const tab of ['Body', 'Face', 'Hair', 'Outfit']) {
        await page.getByRole('tab', { name: tab }).click();
        await scan(`step 3 ${role} ${tab}`);
      }
      await chooseGender(page, role, 'Man');
      await scan(`step 3 ${role} Man`);
    }
    await page.getByRole('button', { name: 'Next' }).click();
    await scan('review');
    expect(hits).toEqual([]);
  });
});

test.describe('draft and legacy data (ADR 0020 compatibility matrix)', () => {
  test('ADR 0020: a legacy draft (version 1, no gender) restores as Neutral with every other choice kept, then saves an explicit gender', async ({
    page,
  }) => {
    await seedDraftAndOpen(page, {
      step: 3,
      visitorName: 'Alex',
      guideName: 'Sam',
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, hairStyle: 'afro', facialHair: 'goatee', bodyType: 'broad' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, outfitStyle: 'dress', height: 'tall' },
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    const a = await builderAvatars(page);
    expect(a.guide).toMatchObject({ gender: 'neutral', hairStyle: 'afro', facialHair: 'goatee', bodyType: 'broad' });
    expect(a.visitor).toMatchObject({ gender: 'neutral', outfitStyle: 'dress', height: 'tall' });
    await expect(gender(page).getByRole('radio', { name: 'Neutral', exact: true })).toBeChecked();
    // Touching anything writes an explicit gender; the draft key and version are unchanged.
    await page.getByRole('tab', { name: 'Hair' }).click();
    await page.getByRole('radiogroup', { name: 'Hair style' }).getByRole('radio').nth(1).click();
    await page.waitForTimeout(300);
    const raw = JSON.parse((await page.evaluate((k) => (globalThis as unknown as { localStorage: { getItem(k: string): string | null } }).localStorage.getItem(k), DRAFT_KEY))!) as { version: number; fields: Record<string, Record<string, unknown>> };
    expect(raw.version).toBe(1);
    expect(raw.fields.guideAvatar!.gender).toBe('neutral');
    expect(raw.fields.visitorAvatar!.gender).toBe('neutral');
  });
});
