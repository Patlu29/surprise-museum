import { expect, test, type Page } from '@playwright/test';
import {
  addPhotos,
  builderAvatars,
  createMuseum,
  fillWords,
  LEGACY_GUIDE_AVATAR,
  LEGACY_VISITOR_AVATAR,
  museumAvatars,
  openVisit,
  readDemoState,
  rewriteDemoState,
  savedDraft,
  seedDraftAndOpen,
  startVisit,
  trackProblems,
  waitForSnap,
} from './support/app';
import { decodePng, makePhotos, pixelDiffRatio } from './support/images';

/*
 * CR-4 character options: face shape (FR-96), 12 clothing styles (FR-97), pattern (FR-98), identical for everyone
 * (FR-99), optional in the data (FR-100), saved and shown the same everywhere (FR-101), and kept out of the way in the
 * "More options" group (FR-102). Live description words (FR-103). US-63 to US-67.
 */

type Role = 'Guide' | 'Visitor';

const FACE_SHAPES = [
  ['oval', 'Oval'],
  ['round', 'Round'],
  ['square', 'Square'],
  ['heart', 'Heart'],
  ['long', 'Long'],
] as const;
const PATTERNS = [
  ['plain', 'Plain'],
  ['stripes', 'Stripes'],
  ['checks', 'Checks'],
  ['dots', 'Dots'],
] as const;
/** Today's six, always visible under "Outfit style". */
const CLOSED_STYLES = [
  ['tee-jeans', 'T-shirt and jeans'],
  ['hoodie', 'Hoodie'],
  ['shirt-trousers', 'Shirt and trousers'],
  ['dress', 'Dress'],
  ['suit', 'Suit'],
  ['jumpsuit', 'Jumpsuit'],
] as const;
/** The six new ones, in "More styles (optional)" inside More options. */
const NEW_STYLES = [
  ['sweater', 'Sweater'],
  ['overalls', 'Overalls'],
  ['coat', 'Coat'],
  ['tracksuit', 'Tracksuit'],
  ['cardigan', 'Cardigan'],
  ['tunic', 'Tunic'],
] as const;
const PATTERN_WORD: Record<string, string> = { stripes: 'striped', checks: 'checked', dots: 'spotted' };

const more = (page: Page) => page.locator('.more-options__button');
const description = (page: Page) => page.locator('.preview-slot__description');
const group = (page: Page, name: string) => page.getByRole('radiogroup', { name });
const previewReady = (page: Page) => expect(page.locator('.preview-slot__loading')).toBeHidden({ timeout: 30_000 });

async function openCharacters(page: Page, seed: Parameters<typeof seedDraftAndOpen>[1] = {}) {
  await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam', ...seed });
  await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
}
async function role(page: Page, who: Role) {
  await page.getByRole('tab', { name: new RegExp(`^${who}`) }).click();
}
async function tab(page: Page, name: 'Body' | 'Face' | 'Hair' | 'Outfit') {
  await page.getByRole('tab', { name }).click();
}
async function openMore(page: Page) {
  const button = more(page);
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
}
async function pickShape(page: Page, who: Role, label: string) {
  await role(page, who);
  await tab(page, 'Face');
  await openMore(page);
  await group(page, 'Face shape (optional)').getByRole('radio', { name: label, exact: true }).click();
}
async function pickStyle(page: Page, who: Role, label: string, isNew: boolean) {
  await role(page, who);
  await tab(page, 'Outfit');
  if (isNew) {
    await openMore(page);
    await group(page, 'More styles (optional)').getByRole('radio', { name: label, exact: true }).click();
  } else {
    await group(page, 'Outfit style').getByRole('radio', { name: label, exact: true }).click();
  }
}
async function pickPattern(page: Page, who: Role, label: string) {
  await role(page, who);
  await tab(page, 'Outfit');
  await openMore(page);
  await group(page, 'Pattern (optional)').getByRole('radio', { name: label, exact: true }).click();
}
async function draftAvatar(page: Page, who: Role) {
  const draft = await savedDraft(page);
  return draft?.fields[who === 'Guide' ? 'guideAvatar' : 'visitorAvatar'] ?? {};
}

test.describe('US-67 and FR-102: the closed group leaves the Characters step as it was', () => {
  test.setTimeout(240_000);

  /**
   * Measured on the build before CR-4 (commit 4a0c9ee, test-mode build, the same seeded draft, the Guide, both browsers
   * agree to the pixel): the controls panel (from the first group to the Reset row) and the whole `.characters` step, in
   * CSS px, and how many radios each tab shows.
   */
  const BEFORE = {
    '360x640': {
      Body: { controls: 532, step: 1091, radios: 10 },
      Face: { controls: 346, step: 905, radios: 15 },
      Hair: { controls: 558, step: 1117, radios: 23 },
      Outfit: { controls: 454, step: 1013, radios: 18 },
    },
    '390x844': {
      Body: { controls: 532, step: 1176, radios: 10 },
      Face: { controls: 346, step: 990, radios: 15 },
      Hair: { controls: 450, step: 1094, radios: 23 },
      Outfit: { controls: 398, step: 1042, radios: 18 },
    },
  } as const;

  for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    const key = `${vp.width}x${vp.height}` as keyof typeof BEFORE;
    test(`US-67 AC-1 at ${key}: no more radios, no taller controls panel and no taller step, on every tab (More options closed)`, async ({ page }, testInfo) => {
      await page.setViewportSize(vp);
      await openCharacters(page);
      const notes: string[] = [];
      for (const name of ['Body', 'Face', 'Hair', 'Outfit'] as const) {
        await tab(page, name);
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => {
          const q = (s: string) => document.querySelector(s)!;
          const panel = q('[id^=section-panel-]').getBoundingClientRect();
          const footer = q('.characters__footer').getBoundingClientRect();
          const visible = (e: Element) => (e as HTMLElement).offsetParent !== null;
          const controls = q('.characters__controls');
          return {
            controls: Math.round(footer.bottom - panel.top),
            step: Math.round(q('.characters').getBoundingClientRect().height),
            radios: [...controls.querySelectorAll('[role=radio]')].filter(visible).length,
            otherButtons: [...controls.querySelectorAll('button')].filter(visible).filter((b) => !['radio', 'tab'].includes(b.getAttribute('role') ?? '')).length,
          };
        });
        const before = BEFORE[key][name];
        notes.push(`${name}: controls ${m.controls} (was ${before.controls}), step ${m.step} (was ${before.step}), radios ${m.radios}`);
        expect(m.radios, `${key} ${name}: radios shown closed`).toBe(before.radios);
        expect(m.controls, `${key} ${name}: controls panel height`).toBeLessThanOrEqual(before.controls + 1);
        expect(m.step, `${key} ${name}: whole step height`).toBeLessThanOrEqual(before.step);
        // One button before (Reset). The disclosure is the only addition, and only where it applies.
        expect(m.otherButtons, `${key} ${name}: Reset${name === 'Face' || name === 'Outfit' ? ' and the More options disclosure' : ''}`).toBe(name === 'Face' || name === 'Outfit' ? 2 : 1);
        await expect(more(page)).toHaveCount(name === 'Face' || name === 'Outfit' ? 1 : 0);
        if (name === 'Face' || name === 'Outfit') {
          await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
          await expect(more(page)).toHaveText(/^More options/);
          // Closed content leaves the accessibility tree.
          await expect(page.locator('.more-options__panel')).toBeHidden();
          await expect(group(page, 'Face shape (optional)')).toHaveCount(0);
          await expect(group(page, 'Pattern (optional)')).toHaveCount(0);
        }
        // The disclosure and Reset share one row of one height (spec 12.5.3).
        if (name === 'Face' || name === 'Outfit') {
          const rowH = await page.locator('.characters__footer').evaluate((e) => e.getBoundingClientRect().height);
          expect(rowH, `${key} ${name}: the disclosure row is one 44 px row`).toBeLessThanOrEqual(48);
          const button = (await more(page).boundingBox())!;
          expect(button.height).toBeGreaterThanOrEqual(44 - 0.5);
        }
      }
      testInfo.annotations.push({ type: 'closed-step', description: notes.join(' | ') });
    });
  }

  test('US-67 AC-2 and AC-3 (disclosure by touch): it says More options, the groups inside say optional, the preview keeps showing the choices', async ({ page }) => {
    await openCharacters(page);
    await tab(page, 'Face');
    const button = more(page);
    await expect(button).toContainText('More options');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(group(page, 'Face shape (optional)')).toBeVisible();
    await expect(page.getByText('Changes the shape of the face. Your other choices stay as they are.')).toBeVisible();
    // The step as a whole is marked Optional in text.
    await expect(page.locator('.step-purpose .tag--optional')).toHaveText('Optional');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(group(page, 'Face shape (optional)')).toHaveCount(0);
    // The preview is still there.
    await expect(page.locator('.preview-slot__stage')).toBeVisible();
  });
});

test.describe('US-63, US-64 and US-67: keyboard path, count chip and the open state', () => {
  test.setTimeout(240_000);

  test('US-67 AC-3: Enter and Space on the disclosure open and close it and focus stays on the button; the hidden group is out of the tab order', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit (Safari) does not Tab to buttons unless Full Keyboard Access is on; the arrow-key and Enter/Space parts are covered on the Chromium projects');
    await openCharacters(page);
    await tab(page, 'Face');
    const button = more(page);
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toBeFocused();
    await expect(group(page, 'Face shape (optional)')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    await expect(group(page, 'Face shape (optional)')).toHaveCount(0);
    // aria-controls points at the panel.
    const controls = await button.getAttribute('aria-controls');
    await expect(page.locator(`#${controls}`)).toHaveCount(1);
    // Closed: Tab from the button goes to Reset, not into the hidden group.
    await page.keyboard.press('Tab');
    await expect(page.locator('.characters__reset')).toBeFocused();
  });

  test('US-67 AC-3: Escape closes the open group (the AC says "Escape or the control closes it again")', async ({ page, browserName }, testInfo) => {
    await openCharacters(page);
    await tab(page, 'Face');
    await more(page).focus();
    await page.keyboard.press('Enter');
    await expect(group(page, 'Face shape (optional)')).toBeVisible();
    const oval = group(page, 'Face shape (optional)').getByRole('radio', { name: 'Oval', exact: true });
    if (browserName === 'webkit') {
      // Safari does not Tab into radios (Full Keyboard Access is off), so put focus in the group directly, as a click would. Escape is the part under test.
      await oval.focus();
    } else {
      await page.keyboard.press('Tab'); // Reset sits between the disclosure button and its panel
      await page.keyboard.press('Tab'); // into the face shape group
    }
    await expect(oval).toBeFocused();
    await page.keyboard.press('Escape');
    const closed = (await more(page).getAttribute('aria-expanded')) === 'false';
    testInfo.annotations.push({ type: 'escape-closes', description: String(closed) });
    expect(closed, 'Escape inside the group closes it').toBe(true);
    // stopPropagation: Escape must not also leave the step (no navigation, the Characters heading stays) and the page keeps working.
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await expect(page).toHaveURL(/#\/create/);
    testInfo.annotations.push({ type: 'focus-after-escape', description: await page.evaluate(() => (document.activeElement?.getAttribute('aria-controls') ? 'on the disclosure button' : `on ${document.activeElement?.tagName}.${document.activeElement?.className}`)) });
  });

  test('US-63 AC-4 and US-64 AC-4: Face shape, Style and Pattern are radiogroups; arrow keys move and select, the description and draft follow', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit (Safari) does not Tab to buttons unless Full Keyboard Access is on; the arrow-key and Enter/Space parts are covered on the Chromium projects');
    await openCharacters(page);
    await tab(page, 'Face');
    await more(page).focus();
    await page.keyboard.press('Enter');
    const shapes = group(page, 'Face shape (optional)');
    await expect(shapes.getByRole('radio')).toHaveText(['Oval', 'Round', 'Square', 'Heart', 'Long']);
    await expect(shapes.getByRole('radio', { name: 'Oval', exact: true })).toBeChecked();
    await page.keyboard.press('Tab'); // Reset sits between the disclosure button and its panel
    await expect(page.locator('.characters__reset')).toBeFocused();
    await page.keyboard.press('Tab'); // the selected radio is the tab stop
    await expect(shapes.getByRole('radio', { name: 'Oval', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(shapes.getByRole('radio', { name: 'Round', exact: true })).toBeChecked();
    await expect(shapes.getByRole('radio', { name: 'Round', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(shapes.getByRole('radio', { name: 'Square', exact: true })).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(shapes.getByRole('radio', { name: 'Round', exact: true })).toBeChecked();
    await expect(description(page)).toContainText('round face');
    await expect.poll(async () => (await draftAvatar(page, 'Guide')).faceShape).toBe('round');
    // Outfit tab: the six, then the new styles and the patterns inside the disclosure.
    await tab(page, 'Outfit');
    await more(page).focus();
    await page.keyboard.press('Enter');
    const patterns = group(page, 'Pattern (optional)');
    await expect(patterns.getByRole('radio')).toHaveText(['Plain', 'Stripes', 'Checks', 'Dots']);
    await patterns.getByRole('radio', { name: 'Plain', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(patterns.getByRole('radio', { name: 'Stripes', exact: true })).toBeChecked();
    await expect(description(page)).toContainText('striped');
    const styles = group(page, 'More styles (optional)');
    await expect(styles.getByRole('radio')).toHaveText(NEW_STYLES.map((s) => s[1]));
    // Nothing is selected in More styles while the style is one of the old six; Tab lands on the first.
    await expect(styles.getByRole('radio', { checked: true })).toHaveCount(0);
    await styles.getByRole('radio').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(styles.getByRole('radio', { name: 'Overalls', exact: true })).toBeChecked();
    await expect(description(page)).toContainText('striped');
    await expect(description(page)).toContainText('overalls');
    // One value across both groups: the six old tiles are all unchecked now.
    await expect(group(page, 'Outfit style').getByRole('radio', { checked: true })).toHaveCount(0);
  });

  test('FR-102 and spec 12.5.3: the count chip says how many changed, shows when closed, and the group opens by itself for a saved non-default', async ({ page }) => {
    await openCharacters(page);
    await tab(page, 'Face');
    await expect(page.locator('.more-options__count')).toHaveCount(0);
    await openMore(page);
    await group(page, 'Face shape (optional)').getByRole('radio', { name: 'Heart', exact: true }).click();
    await more(page).click(); // close
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.more-options__count')).toHaveText('1 changed');
    await expect(more(page)).toContainText('1');
    // Choice kept while closed.
    await expect(description(page)).toContainText('heart face');
    // Outfit tab: a new style and a pattern are two changes.
    await tab(page, 'Outfit');
    await expect(page.locator('.more-options__count')).toHaveCount(0);
    await openMore(page);
    await group(page, 'More styles (optional)').getByRole('radio', { name: 'Coat', exact: true }).click();
    await group(page, 'Pattern (optional)').getByRole('radio', { name: 'Dots', exact: true }).click();
    await more(page).click();
    await expect(page.locator('.more-options__count')).toHaveText('2 changed');
    // Back to defaults: the chip goes (Reset resets the new options too and closes nothing).
    await page.locator('.characters__reset').click();
    await expect(page.locator('.more-options__count')).toHaveCount(0);
    await expect(description(page)).not.toContainText(/spotted|coat/);
    // Reset on Face too.
    await tab(page, 'Face');
    await expect(page.locator('.more-options__count')).toHaveCount(0);
    await expect(description(page)).not.toContainText('heart face');
    // Open on load: a saved non-default opens its group by itself and counts it.
    await openCharacters(page, {
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, faceShape: 'long', outfitStyle: 'tunic', outfitPattern: 'checks' },
    });
    await tab(page, 'Face');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(group(page, 'Face shape (optional)').getByRole('radio', { name: 'Long', exact: true })).toBeChecked();
    await tab(page, 'Outfit');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(group(page, 'More styles (optional)').getByRole('radio', { name: 'Tunic', exact: true })).toBeChecked();
    await expect(group(page, 'Pattern (optional)').getByRole('radio', { name: 'Checks', exact: true })).toBeChecked();
    await expect(page.locator('.more-options__count')).toHaveText('2 changed');
  });

  test('spec 12.5.3: the open state is kept per character and tab, in memory only', async ({ page }) => {
    await openCharacters(page);
    await tab(page, 'Face');
    await openMore(page);
    await tab(page, 'Outfit');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await tab(page, 'Face');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
    await role(page, 'Visitor');
    await tab(page, 'Face');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    // Not in the draft: no key holds it.
    const raw = await page.evaluate(() => JSON.stringify(globalThis.localStorage));
    expect(raw).not.toMatch(/moreOptions|more-options|expanded/i);
  });
});

test.describe('US-65 and FR-99: every option is for everyone', () => {
  test.setTimeout(240_000);

  test('US-65 AC-1 and AC-2: identical lists for the Guide and the Visitor, all offered and enabled under every gender', async ({ page }) => {
    await openCharacters(page);
    const lists: Record<string, string[][]> = {};
    for (const who of ['Guide', 'Visitor'] as const) {
      for (const gender of ['Woman', 'Man', 'Neutral'] as const) {
        await role(page, who);
        await tab(page, 'Body');
        await group(page, 'Gender (optional)').getByRole('radio', { name: gender, exact: true }).click();
        const seen: string[][] = [];
        await tab(page, 'Face');
        await openMore(page);
        seen.push(await group(page, 'Face shape (optional)').getByRole('radio').allInnerTexts());
        await tab(page, 'Outfit');
        await openMore(page);
        seen.push(await group(page, 'Outfit style').getByRole('radio').allInnerTexts());
        seen.push(await group(page, 'More styles (optional)').getByRole('radio').allInnerTexts());
        seen.push(await group(page, 'Pattern (optional)').getByRole('radio').allInnerTexts());
        // Nothing greyed out or hidden.
        for (const name of ['Outfit style', 'More styles (optional)', 'Pattern (optional)']) {
          for (const r of await group(page, name).getByRole('radio').all()) {
            await expect(r).toBeEnabled();
            await expect(r).not.toHaveAttribute('aria-disabled', 'true');
          }
        }
        lists[`${who} ${gender}`] = seen;
      }
    }
    const reference = lists['Guide Neutral']!;
    expect(reference[0]).toEqual(['Oval', 'Round', 'Square', 'Heart', 'Long']);
    expect(reference[1]!.concat(reference[2]!)).toEqual(CLOSED_STYLES.concat(NEW_STYLES as never).map((s) => s[1]));
    expect(reference[3]).toEqual(['Plain', 'Stripes', 'Checks', 'Dots']);
    for (const [key, value] of Object.entries(lists)) expect(value, `${key} offers the same lists as Guide Neutral`).toEqual(reference);
  });

  test('US-65 AC-3: changing the gender changes none of the three choices, for both characters', async ({ page }) => {
    await openCharacters(page);
    for (const who of ['Guide', 'Visitor'] as const) {
      await pickShape(page, who, 'Square');
      await pickStyle(page, who, 'Cardigan', true);
      await pickPattern(page, who, 'Checks');
    }
    const before = await builderAvatars(page);
    for (const who of ['Guide', 'Visitor'] as const) {
      for (const gender of ['Woman', 'Man', 'Neutral'] as const) {
        await role(page, who);
        await tab(page, 'Body');
        await group(page, 'Gender (optional)').getByRole('radio', { name: gender, exact: true }).click();
        const a = (await builderAvatars(page))[who === 'Guide' ? 'guide' : 'visitor'];
        expect([a.faceShape, a.outfitStyle, a.outfitPattern], `${who} ${gender}`).toEqual(['square', 'cardigan', 'checks']);
      }
    }
    const after = await builderAvatars(page);
    expect(after.guide).toEqual({ ...before.guide, gender: 'neutral' });
    expect(after.visitor).toEqual({ ...before.visitor, gender: 'neutral' });
  });

  test('US-65 AC-4 and FR-99: option labels and helper text have no gendered word', async ({ page }) => {
    await openCharacters(page);
    const labels: string[] = [];
    await tab(page, 'Face');
    await openMore(page);
    labels.push(...(await page.locator('.more-options__panel').innerText()).split('\n'));
    await tab(page, 'Outfit');
    await openMore(page);
    labels.push(...(await page.locator('.more-options__panel').innerText()).split('\n'));
    labels.push(...(await group(page, 'Outfit style').innerText()).split('\n'));
    // aria-labels and titles inside the panel too.
    labels.push(...(await page.locator('.characters__controls [aria-label], .characters__controls [title]').evaluateAll((els) => els.flatMap((e) => [e.getAttribute('aria-label') ?? '', e.getAttribute('title') ?? '']))));
    const text = labels.join('\n');
    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toMatch(/\b(women'?s?|men'?s?|woman'?s|man'?s|lad(?:y|ies)|gentlem[ae]n|girls?|boys?|female|male|feminine|masculine|for her|for him|for men|for women|she|he|her|his|him)\b/i);
  });
});

test.describe('US-63, US-64, US-66: every face shape, style and pattern is saved and survives reload', () => {
  test.setTimeout(300_000);

  test('US-63 AC-1 and US-64 AC-1: a new draft starts on Oval, the current style and Plain; 5 shapes, 12 styles and 4 patterns are offered', async ({ page }) => {
    await openCharacters(page);
    await tab(page, 'Face');
    await openMore(page);
    await expect(group(page, 'Face shape (optional)').getByRole('radio', { name: 'Oval', exact: true })).toBeChecked();
    await expect(more(page)).not.toContainText('changed');
    await tab(page, 'Outfit');
    await openMore(page);
    await expect(group(page, 'Pattern (optional)').getByRole('radio', { name: 'Plain', exact: true })).toBeChecked();
    await expect(group(page, 'Outfit style').getByRole('radio', { name: 'Shirt and trousers', exact: true })).toBeChecked();
    const total = (await group(page, 'Outfit style').getByRole('radio').count()) + (await group(page, 'More styles (optional)').getByRole('radio').count());
    expect(total, 'twelve or more clothing styles').toBeGreaterThanOrEqual(12);
  });

  test('US-63 AC-2, US-64 AC-2, US-66 AC-1: each of the 5 shapes, 12 styles and 4 patterns, chosen in the UI for each character, reaches the store and the saved draft and changes nothing else', async ({ page }) => {
    await openCharacters(page);
    for (const who of ['Guide', 'Visitor'] as const) {
      const key = who === 'Guide' ? 'guide' : 'visitor';
      const other = who === 'Guide' ? 'visitor' : 'guide';
      const untouched = (await builderAvatars(page))[other];
      for (const [id, label] of FACE_SHAPES) {
        await pickShape(page, who, label);
        expect((await builderAvatars(page))[key].faceShape ?? 'oval', `${who} ${label}`).toBe(id);
        await expect.poll(async () => (await draftAvatar(page, who)).faceShape ?? 'oval').toBe(id);
      }
      for (const [id, label] of CLOSED_STYLES) {
        await pickStyle(page, who, label, false);
        expect((await builderAvatars(page))[key].outfitStyle, `${who} ${label}`).toBe(id);
        await expect.poll(async () => (await draftAvatar(page, who)).outfitStyle).toBe(id);
      }
      for (const [id, label] of NEW_STYLES) {
        await pickStyle(page, who, label, true);
        expect((await builderAvatars(page))[key].outfitStyle, `${who} ${label}`).toBe(id);
        await expect.poll(async () => (await draftAvatar(page, who)).outfitStyle).toBe(id);
        // Exactly one tile is selected across the two groups.
        await expect(group(page, 'Outfit style').getByRole('radio', { checked: true })).toHaveCount(0);
        await expect(group(page, 'More styles (optional)').getByRole('radio', { checked: true })).toHaveCount(1);
      }
      for (const [id, label] of PATTERNS) {
        await pickPattern(page, who, label);
        expect((await builderAvatars(page))[key].outfitPattern ?? 'plain', `${who} ${label}`).toBe(id);
        await expect.poll(async () => (await draftAvatar(page, who)).outfitPattern ?? 'plain').toBe(id);
      }
      // Skin, hair, colours, body and gender were not touched; the other character was not touched.
      const now = await builderAvatars(page);
      expect(now[other], `${other} is unchanged`).toEqual(untouched);
      expect(now[key]).toMatchObject({ skinTone: 'skin-04', hairColor: key === 'guide' ? 'dark-brown' : 'brown', outfitColor: key === 'guide' ? 'navy' : 'coral', bodyType: 'regular', height: 'medium', gender: 'neutral' });
    }
  });

  test('US-66 AC-1: a mixed choice for both characters comes back after a reload, in the controls and the description, and the groups open by themselves', async ({ page }) => {
    await openCharacters(page);
    await pickShape(page, 'Guide', 'Heart');
    await pickStyle(page, 'Guide', 'Overalls', true);
    await pickPattern(page, 'Guide', 'Dots');
    await pickShape(page, 'Visitor', 'Long');
    await pickStyle(page, 'Visitor', 'Hoodie', false);
    await pickPattern(page, 'Visitor', 'Stripes');
    await expect.poll(async () => (await draftAvatar(page, 'Visitor')).outfitPattern).toBe('stripes');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    const a = await builderAvatars(page);
    expect(a.guide).toMatchObject({ faceShape: 'heart', outfitStyle: 'overalls', outfitPattern: 'dots' });
    expect(a.visitor).toMatchObject({ faceShape: 'long', outfitStyle: 'hoodie', outfitPattern: 'stripes' });
    await role(page, 'Guide');
    await tab(page, 'Face');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(group(page, 'Face shape (optional)').getByRole('radio', { name: 'Heart', exact: true })).toBeChecked();
    await expect(description(page)).toContainText('heart face');
    await tab(page, 'Outfit');
    await expect(group(page, 'More styles (optional)').getByRole('radio', { name: 'Overalls', exact: true })).toBeChecked();
    await expect(group(page, 'Pattern (optional)').getByRole('radio', { name: 'Dots', exact: true })).toBeChecked();
    await expect(description(page)).toContainText('spotted overalls');
    await role(page, 'Visitor');
    await expect(group(page, 'Outfit style').getByRole('radio', { name: 'Hoodie', exact: true })).toBeChecked();
    await expect(group(page, 'Pattern (optional)').getByRole('radio', { name: 'Stripes', exact: true })).toBeChecked();
    await expect(description(page)).toContainText('striped hoodie');
  });

  test('US-66 AC-1: every shape, style and pattern restores from a saved draft into the controls and the store', async ({ page }) => {
    // Six drafts cover the 5 shapes, 12 styles and 4 patterns on both characters.
    for (let i = 0; i < 6; i++) {
      const g = { ...LEGACY_GUIDE_AVATAR, faceShape: FACE_SHAPES[i % 5]![0], outfitStyle: [...CLOSED_STYLES, ...NEW_STYLES][i]![0], outfitPattern: PATTERNS[i % 4]![0] };
      const v = { ...LEGACY_VISITOR_AVATAR, faceShape: FACE_SHAPES[(i + 1) % 5]![0], outfitStyle: [...CLOSED_STYLES, ...NEW_STYLES][i + 6]![0], outfitPattern: PATTERNS[(i + 1) % 4]![0] };
      await openCharacters(page, { guideAvatar: g, visitorAvatar: v });
      const a = await builderAvatars(page);
      expect(a.guide, `draft ${i} Guide`).toMatchObject({ faceShape: g.faceShape, outfitStyle: g.outfitStyle, outfitPattern: g.outfitPattern });
      expect(a.visitor, `draft ${i} Visitor`).toMatchObject({ faceShape: v.faceShape, outfitStyle: v.outfitStyle, outfitPattern: v.outfitPattern });
      // The controls show the same: the label of the saved shape and pattern is the checked radio.
      await role(page, 'Guide');
      await tab(page, 'Face');
      await openMore(page);
      await expect(group(page, 'Face shape (optional)').getByRole('radio', { name: FACE_SHAPES[i % 5]![1], exact: true })).toBeChecked();
      await tab(page, 'Outfit');
      await openMore(page);
      await expect(group(page, 'Pattern (optional)').getByRole('radio', { name: PATTERNS[i % 4]![1], exact: true })).toBeChecked();
      await expect(page.locator('.characters__controls [role=radio][aria-checked=true]').filter({ hasText: [...CLOSED_STYLES, ...NEW_STYLES][i]![1] })).toHaveCount(1);
      // The shared stage renders (no error state).
      await expect(page.locator('.preview-slot__error, [data-preview-error]')).toHaveCount(0);
    }
  });
});

test.describe('US-66 AC-2 and FR-101: published and shared', () => {
  test.setTimeout(420_000);

  const combos = [
    { guide: ['Round', 'Sweater', 'Stripes'], visitor: ['Square', 'Overalls', 'Checks'] },
    { guide: ['Heart', 'Coat', 'Dots'], visitor: ['Long', 'Tracksuit', 'Plain'] },
    { guide: ['Oval', 'Cardigan', 'Plain'], visitor: ['Oval', 'Tunic', 'Stripes'] },
  ] as const;
  const idOf = (list: ReadonlyArray<readonly [string, string]>, label: string) => list.find((e) => e[1] === label)![0];

  for (const [index, combo] of combos.entries()) {
    test(`US-66 AC-2: published museum ${index + 1} (${combo.guide.join(', ')} and ${combo.visitor.join(', ')}) opens from the share link with the same choices, equal to the builder, and renders`, async ({ page }) => {
      const problems = trackProblems(page);
      const choose = (who: Role, [shape, style, pattern]: readonly [string, string, string]) => async (p: Page) => {
        await pickShape(p, who, shape);
        await pickStyle(p, who, style, NEW_STYLES.some((s) => s[1] === style));
        await pickPattern(p, who, pattern);
      };
      const made = await createMuseum(page, {
        photos: 1,
        captions: ['One.'],
        onCharacters: async (p) => {
          await choose('Guide', combo.guide)(p);
          await choose('Visitor', combo.visitor)(p);
        },
      });
      const built = await builderAvatars(page);
      const stored = Object.values((await readDemoState(page)).museums).map((m) => m.document).filter((d) => d !== null)[0]!;
      for (const [key, who] of [['guideAvatar', combo.guide], ['visitorAvatar', combo.visitor]] as const) {
        expect(stored[key], `${key} as stored`).toMatchObject({
          faceShape: idOf(FACE_SHAPES, who[0]),
          outfitStyle: idOf([...CLOSED_STYLES, ...NEW_STYLES], who[1]),
          outfitPattern: idOf(PATTERNS, who[2]),
        });
      }
      await openVisit(page, made.shareToken);
      await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
      const published = await museumAvatars(page);
      expect(published.guide, 'the Visitor sees what the Creator built').toEqual(built.guide);
      expect(published.visitor).toEqual(built.visitor);
      await startVisit(page);
      await waitForSnap(page, (s) => s.ready && s.labels.visitor, 30_000, 'the characters to render');
      problems.expectClean();
    });
  }

  test('US-66 AC-2: the Preview before publishing uses the chosen options, identical to the published copy', async ({ page }) => {
    await page.goto('./?e2e=1#/create');
    const made = await createMuseum(page, {
      photos: 1,
      captions: ['One.'],
      onCharacters: async (p) => {
        await pickShape(p, 'Guide', 'Square');
        await pickStyle(p, 'Guide', 'Tunic', true);
        await pickPattern(p, 'Guide', 'Dots');
      },
    });
    const built = await builderAvatars(page);
    expect(built.guide).toMatchObject({ faceShape: 'square', outfitStyle: 'tunic', outfitPattern: 'dots' });
    await openVisit(page, made.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    expect(await museumAvatars(page)).toEqual({ guide: built.guide, visitor: built.visitor });
  });
});

test.describe('US-66 AC-3 to AC-5 and FR-100, FR-101: optional in the data, older data reads as defaults, bad values rejected', () => {
  test.setTimeout(300_000);

  test('FR-100 / US-66 AC-3: a draft saved before this change (no face shape, no pattern) opens on Oval, Plain and its own style, with the description unchanged', async ({ page }) => {
    await openCharacters(page);
    const a = await builderAvatars(page);
    // The seeded legacy avatars have neither key; the builder reads them as defaults.
    expect(a.guide.faceShape ?? 'oval').toBe('oval');
    expect(a.guide.outfitPattern ?? 'plain').toBe('plain');
    await expect(description(page)).toHaveText('Sam: medium height, regular build, short crop dark brown hair, navy shirt and trousers.');
    await tab(page, 'Face');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await openMore(page);
    await expect(group(page, 'Face shape (optional)').getByRole('radio', { name: 'Oval', exact: true })).toBeChecked();
    await tab(page, 'Outfit');
    await openMore(page);
    await expect(group(page, 'Pattern (optional)').getByRole('radio', { name: 'Plain', exact: true })).toBeChecked();
    await expect(group(page, 'Outfit style').getByRole('radio', { name: 'Shirt and trousers', exact: true })).toBeChecked();
    await expect(page.locator('.more-options__count')).toHaveCount(0);
    // Unknown or wrong-typed values in an old draft also read as defaults rather than breaking it.
    await openCharacters(page, { guideAvatar: { ...LEGACY_GUIDE_AVATAR, faceShape: 'triangle', outfitPattern: 7 } });
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await expect(description(page)).toHaveText('Sam: medium height, regular build, short crop dark brown hair, navy shirt and trousers.');
  });

  test('FR-100: a saved draft holding an unknown clothing style, hair style or colour opens on the starting values instead of crashing the builder', async ({ page }) => {
    const problems = trackProblems(page);
    await openCharacters(page, {
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, outfitStyle: 'cape', hairStyle: 'mohawk', outfitColor: 'gold', faceShape: 'triangle', outfitPattern: 'spots' },
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await expect(description(page)).toBeVisible();
    const guide = (await builderAvatars(page)).guide;
    expect(['tee-jeans', 'hoodie', 'shirt-trousers', 'dress', 'suit', 'jumpsuit', 'sweater', 'overalls', 'coat', 'tracksuit', 'cardigan', 'tunic']).toContain(guide.outfitStyle);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
    problems.expectClean();
  });

  test('FR-100 / US-66 AC-3 and AC-6: a museum published before this change loads and looks as before, and opening its edit page changes no stored field (there is no Save in this release)', async ({ page }) => {
    const problems = trackProblems(page);
    const made = await createMuseum(page, { photos: 1, captions: ['One.'] });
    // Make the stored record exactly what the previous release wrote: no faceShape, no outfitPattern.
    const n = await rewriteDemoState(
      page,
      `(state) => { for (const m of Object.values(state.museums)) { for (const k of ['guideAvatar', 'visitorAvatar']) { delete m.document[k].faceShape; delete m.document[k].outfitPattern; } } }`,
    );
    expect(n).toBe(1);
    const before = Object.values((await readDemoState(page)).museums)[0]!.document!;
    expect(before.guideAvatar).not.toHaveProperty('faceShape');
    expect(before.guideAvatar).not.toHaveProperty('outfitPattern');
    await openVisit(page, made.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    const a = await museumAvatars(page);
    expect(a.guide.faceShape ?? 'oval').toBe('oval');
    expect(a.guide.outfitPattern ?? 'plain').toBe('plain');
    await startVisit(page);
    await waitForSnap(page, (s) => s.ready && s.labels.visitor, 30_000, 'the older museum to render');
    // Reading does not rewrite the record.
    const read = Object.values((await readDemoState(page)).museums)[0]!.document!;
    expect(read).toEqual(before);
    // US-66 AC-6 (edit and save untouched): this release's edit page is view and delete only (US-25, MVP), so there is nothing to
    // save. Opening it must still load an older museum without error and must not rewrite the stored document.
    await page.goto('about:blank');
    await page.goto(`./?e2e=1#/edit/${made.editToken}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Delete museum' })).toBeVisible();
    const after = Object.values((await readDemoState(page)).museums)[0]!.document!;
    expect(after, 'opening the edit page changes no stored field').toEqual(before);
    problems.expectClean();
  });

  test('FR-101 / US-66 AC-4 and AC-5: unrecognised or wrong-typed face shape and pattern are refused and nothing is stored; absent values and every valid one are accepted', async ({ page }, testInfo) => {
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {});
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    const publish = page.getByRole('button', { name: /Publish museum/ });
    await expect(publish).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    const cases: Array<[string, string, string]> = [
      ['visitorAvatar', 'faceShape', "'Round'"],
      ['visitorAvatar', 'faceShape', "'triangle'"],
      ['visitorAvatar', 'faceShape', "''"],
      ['visitorAvatar', 'faceShape', 'null'],
      ['visitorAvatar', 'faceShape', '3'],
      ['guideAvatar', 'faceShape', "['round']"],
      ['guideAvatar', 'outfitPattern', "'spots'"],
      ['guideAvatar', 'outfitPattern', "'STRIPES'"],
      ['guideAvatar', 'outfitPattern', '0'],
      ['guideAvatar', 'outfitPattern', 'null'],
      ['visitorAvatar', 'outfitPattern', "''"],
      // Unknown clothing styles are not driven through the Review screen here: its description helper reads the style
      // table directly, so a made-up style written into the store throws while the page renders (BUG-13 observation,
      // unreachable from the UI). The refusal of unknown styles is covered by src/api/__tests__.
    ];
    for (const [who, field, value] of cases) {
      await page.evaluate(
        `(() => { const st = globalThis.__APP_TEST__.useBuilderStore; st.setState({ ${who}: { ...st.getState().${who}, ${field}: ${value} }, publish: { phase: 'idle', error: null, shareToken: null } }); })()`,
      );
      await publish.click();
      await expect(page.getByRole('alert').filter({ hasText: "Publishing didn't work" }), `${who}.${field} = ${value}`).toBeVisible({ timeout: 30_000 });
      const shown = await page.evaluate(`globalThis.__APP_TEST__.useBuilderStore.getState().publish.error`);
      testInfo.annotations.push({ type: `rejected ${who}.${field}=${value}`, description: String(shown) });
      const stored = Object.values((await readDemoState(page)).museums);
      expect(stored.filter((x) => x.document !== null || x.status === 'published'), `${who}.${field} = ${value}: nothing is stored`).toHaveLength(0);
      await page.evaluate(
        `(() => { const st = globalThis.__APP_TEST__.useBuilderStore; const clean = { ...st.getState().${who} }; delete clean.${field}; st.setState({ ${who}: clean, publish: { phase: 'idle', error: null, shareToken: null } }); })()`,
      );
    }
    // Absent fields are accepted (US-66 AC-5) and so are valid ones: publish for real.
    await page.evaluate(
      `(() => { const st = globalThis.__APP_TEST__.useBuilderStore; const g = { ...st.getState().guideAvatar }; const v = { ...st.getState().visitorAvatar }; delete g.faceShape; delete g.outfitPattern; delete v.faceShape; delete v.outfitPattern; st.setState({ guideAvatar: g, visitorAvatar: v, publish: { phase: 'idle', error: null, shareToken: null } }); })()`,
    );
    await publish.click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    const docs = Object.values((await readDemoState(page)).museums).map((x) => x.document).filter((d) => d !== null);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.guideAvatar.faceShape ?? 'oval').toBe('oval');
  });

  test('FR-101: a document whose stored face shape or pattern is unknown is never rendered with it (it reads as the default)', async ({ page }) => {
    const made = await createMuseum(page, { photos: 1, captions: ['One.'] });
    await rewriteDemoState(
      page,
      `(state) => { for (const m of Object.values(state.museums)) { m.document.guideAvatar.faceShape = 'triangle'; m.document.guideAvatar.outfitPattern = 'spots'; } }`,
    );
    await openVisit(page, made.shareToken);
    // The visit either refuses the document or renders it with the defaults; it must not crash and must not show 'triangle'.
    const start = page.getByRole('button', { name: 'Start' });
    if (await start.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await startVisit(page);
      await waitForSnap(page, (s) => s.ready && s.labels.visitor, 30_000, 'the visit to render');
    } else {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(await page.locator('body').innerText()).not.toMatch(/triangle|spots/);
  });
});

test.describe('FR-103, US-63 AC-6, US-64 AC-6: the live description names the face shape and pattern', () => {
  test.setTimeout(300_000);

  test('face shape and pattern words appear when not the default, in neutral wording, and not when default', async ({ page }) => {
    await openCharacters(page);
    const base = 'Sam: medium height, regular build, short crop dark brown hair, navy shirt and trousers.';
    await expect(description(page)).toHaveText(base);
    for (const [id, label] of FACE_SHAPES) {
      await pickShape(page, 'Guide', label);
      if (id === 'oval') await expect(description(page)).toHaveText(base);
      else await expect(description(page)).toHaveText(`Sam: medium height, regular build, ${label.toLowerCase()} face, short crop dark brown hair, navy shirt and trousers.`);
    }
    await pickShape(page, 'Guide', 'Oval');
    for (const [id, label] of PATTERNS) {
      await pickPattern(page, 'Guide', label);
      if (id === 'plain') await expect(description(page)).toHaveText(base);
      else await expect(description(page)).toHaveText(`Sam: medium height, regular build, short crop dark brown hair, navy ${PATTERN_WORD[id]} shirt and trousers.`);
    }
    // The pattern word sits with the style, and a new style keeps both: "striped sweater" style wording (US-64 AC-6).
    await pickPattern(page, 'Guide', 'Stripes');
    await pickStyle(page, 'Guide', 'Sweater', true);
    await expect(description(page)).toHaveText('Sam: medium height, regular build, short crop dark brown hair, navy striped sweater and trousers.');
    // A face shape and a pattern together, with the gender word first.
    await pickShape(page, 'Guide', 'Heart');
    await role(page, 'Guide');
    await tab(page, 'Body');
    await group(page, 'Gender (optional)').getByRole('radio', { name: 'Woman', exact: true }).click();
    await expect(description(page)).toHaveText('Sam: woman, medium height, regular build, heart face, short crop dark brown hair, navy striped sweater and trousers.');
    // The Visitor's own description is separate.
    await pickShape(page, 'Visitor', 'Long');
    await expect(description(page)).toContainText('Alex: medium height, regular build, long face, bob brown hair, coral jumpsuit.');
  });

  test('FR-103: the same words reach the Review step, the preview alternative text and the announcement for the character that changed', async ({ page }) => {
    await openCharacters(page);
    await pickShape(page, 'Visitor', 'Round');
    await pickPattern(page, 'Visitor', 'Dots');
    await expect(page.locator('.preview-slot__stage')).toHaveAttribute('aria-label', /Sam: medium height.*Alex: medium height, regular build, round face, bob brown hair, coral spotted jumpsuit\./);
    // The status region announces only the character that changed, once settled.
    await expect(page.locator('.characters__controls [role=status]')).toHaveText(/^Alex: .*round face.*spotted jumpsuit/, { timeout: 5000 });
    expect(await page.locator('.characters__controls [role=status]').innerText()).not.toContain('Sam:');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="review-characters"]')).toContainText('Alex: medium height, regular build, round face, bob brown hair, coral spotted jumpsuit.');
    await expect(page.locator('section[aria-labelledby="review-characters"]')).toContainText('Sam: medium height, regular build, short crop dark brown hair, navy shirt and trousers.');
  });

  test('FR-99 and FR-103: across every gender, face shape, style and pattern (720 combinations) the description names the choice and has no gendered word beyond the gender word itself', async ({ page }) => {
    // The Review step prints describeAvatar without rendering the 3D preview, so this is fast.
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {});
    await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
    const result = (await page.evaluate(`(async () => {
      const g = globalThis;
      const store = g.__APP_TEST__.useBuilderStore;
      const genders = ['neutral', 'feminine', 'masculine'];
      const shapes = ['oval', 'round', 'square', 'heart', 'long'];
      const styles = ['tee-jeans', 'hoodie', 'shirt-trousers', 'dress', 'suit', 'jumpsuit', 'sweater', 'overalls', 'coat', 'tracksuit', 'cardigan', 'tunic'];
      const patterns = ['plain', 'stripes', 'checks', 'dots'];
      const raf = () => new Promise((r) => g.requestAnimationFrame(() => g.requestAnimationFrame(r)));
      const out = [];
      for (const gender of genders) for (const faceShape of shapes) for (const outfitStyle of styles) for (const outfitPattern of patterns) {
        const s = store.getState();
        store.setState({ guideAvatar: { ...s.guideAvatar, gender, faceShape, outfitStyle, outfitPattern } });
        await raf();
        const p = g.document.querySelector('#review-characters').closest('section').querySelectorAll('p.user-text')[0];
        out.push({ gender, faceShape, outfitStyle, outfitPattern, text: p.textContent });
      }
      return out;
    })()`)) as Array<{ gender: string; faceShape: string; outfitStyle: string; outfitPattern: string; text: string }>;
    expect(result).toHaveLength(720);
    const words: Record<string, string> = { sweater: 'sweater', overalls: 'overalls', coat: 'coat', tracksuit: 'tracksuit', cardigan: 'cardigan', tunic: 'tunic', hoodie: 'hoodie', suit: 'suit', jumpsuit: 'jumpsuit', dress: 'dress', 'tee-jeans': 'T-shirt and jeans', 'shirt-trousers': 'shirt and trousers' };
    const bad: string[] = [];
    for (const r of result) {
      const t = r.text;
      const withoutGender = t.replace(/^Sam: (woman|man), /, 'Sam: ');
      if (/\b(she|her|hers|he|him|his|women|woman|men|man|girl|boy|lady|gentleman|female|male|feminine|masculine)\b/i.test(withoutGender)) bad.push(`gendered word: ${t}`);
      if (r.gender === 'neutral' && /\b(woman|man)\b/.test(t)) bad.push(`gender word on Neutral: ${t}`);
      if (r.faceShape === 'oval' ? /face,/.test(t) : !t.includes(`${r.faceShape} face`)) bad.push(`face shape: ${r.faceShape} in ${t}`);
      if (r.outfitPattern === 'plain') { if (/striped|checked|spotted/.test(t)) bad.push(`pattern word on plain: ${t}`); }
      else if (!t.includes(PATTERN_WORD[r.outfitPattern]!)) bad.push(`pattern: ${r.outfitPattern} in ${t}`);
      if (!t.includes(words[r.outfitStyle]!)) bad.push(`style: ${r.outfitStyle} in ${t}`);
    }
    expect(bad.slice(0, 10), `${bad.length} of 720 descriptions are wrong`).toEqual([]);
    // Distinct choices give distinct descriptions (except the Neutral default word omission).
    expect(new Set(result.map((r) => r.text)).size, 'every combination reads differently').toBe(720);
  });
});

test.describe('US-63 AC-3 and FR-96: the five face shapes are visibly distinct in the preview', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  test.setTimeout(240_000);

  test('every pair of shapes differs in the Guide head by at least 150 pixels (the smallest measured in round 6 is 246 of 4,550)', async ({ page, browserName, isMobile }, testInfo) => {
    test.skip(browserName !== 'chromium' || isMobile, 'measured on desktop Chromium, where the preview size is fixed');
    const ids = ['oval', 'round', 'square', 'heart', 'long'];
    const shots: Record<string, Buffer> = {};
    for (const id of ids) {
      await openCharacters(page, { guideAvatar: { ...LEGACY_GUIDE_AVATAR, faceShape: id } });
      await previewReady(page);
      await page.waitForTimeout(1500);
      shots[id] = await page.locator('.preview-slot__stage').screenshot({ animations: 'disabled' });
    }
    const a = decodePng(shots.oval!);
    // The Guide stands on the left: the head is about 17% to 34% across and 22% to 37% down the stage.
    const crop = { x0: Math.round(a.width * 0.17), x1: Math.round(a.width * 0.34), y0: Math.round(a.height * 0.22), y1: Math.round(a.height * 0.37) };
    const different = (p: Buffer, q: Buffer) => {
      const x = decodePng(p);
      const y = decodePng(q);
      let n = 0;
      for (let row = crop.y0; row < crop.y1; row++) {
        for (let col = crop.x0; col < crop.x1; col++) {
          const i = (row * x.width + col) * 4;
          if (Math.max(Math.abs(x.data[i]! - y.data[i]!), Math.abs(x.data[i + 1]! - y.data[i + 1]!), Math.abs(x.data[i + 2]! - y.data[i + 2]!)) > 12) n++;
        }
      }
      return n;
    };
    const lines: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const n = different(shots[ids[i]!]!, shots[ids[j]!]!);
        lines.push(`${ids[i]}-${ids[j]} ${n}`);
        expect(n, `${ids[i]} against ${ids[j]}: pixels that differ in the head crop`).toBeGreaterThanOrEqual(150);
      }
    }
    testInfo.annotations.push({ type: 'face-pair-diff-px', description: lines.join(', ') });
  });
});

test.describe('FR-15 and FR-102: a change inside More options updates the preview within 1 second', () => {
  test.use({ reducedMotion: 'reduce' });
  test.setTimeout(300_000);

  async function stage(page: Page) {
    const el = page.locator('.preview-slot__stage');
    return () => el.screenshot({ animations: 'disabled' });
  }

  /** `prep` goes to the tab and opens the group (not timed); `act` makes the one choice that is timed. */
  const changes: Array<{ name: string; prep: (p: Page) => Promise<void>; act: (p: Page) => Promise<void> }> = [
    {
      name: 'face shape (Round)',
      prep: async (p) => { await role(p, 'Guide'); await tab(p, 'Face'); await openMore(p); },
      act: (p) => group(p, 'Face shape (optional)').getByRole('radio', { name: 'Round', exact: true }).click(),
    },
    {
      name: 'face shape (Long)',
      prep: async (p) => { await role(p, 'Guide'); await tab(p, 'Face'); await openMore(p); },
      act: (p) => group(p, 'Face shape (optional)').getByRole('radio', { name: 'Long', exact: true }).click(),
    },
    {
      name: 'pattern (Stripes)',
      prep: async (p) => { await role(p, 'Guide'); await tab(p, 'Outfit'); await openMore(p); },
      act: (p) => group(p, 'Pattern (optional)').getByRole('radio', { name: 'Stripes', exact: true }).click(),
    },
    {
      name: 'pattern (Checks)',
      prep: async (p) => { await role(p, 'Guide'); await tab(p, 'Outfit'); await openMore(p); },
      act: (p) => group(p, 'Pattern (optional)').getByRole('radio', { name: 'Checks', exact: true }).click(),
    },
    {
      name: 'a new style (Coat)',
      prep: async (p) => { await role(p, 'Guide'); await tab(p, 'Outfit'); await openMore(p); },
      act: (p) => group(p, 'More styles (optional)').getByRole('radio', { name: 'Coat', exact: true }).click(),
    },
  ];

  for (const change of changes) {
    test(`US-67 AC-4 / FR-15: choosing ${change.name} changes the preview within 1 s`, async ({ page }, testInfo) => {
      await openCharacters(page);
      await previewReady(page);
      await change.prep(page);
      await page.waitForTimeout(1500);
      const shot = await stage(page);
      // The sticky preview stays in view; scroll to the top so both shots are taken at the same place.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
      const before = await shot();
      expect(pixelDiffRatio(before, await shot()), 'the idle preview is stable').toBeLessThan(0.0005);
      const started = Date.now();
      await change.act(page);
      let changedAfter = -1;
      for (;;) {
        const now = await shot();
        if (pixelDiffRatio(before, now) > 0.0008) {
          changedAfter = Date.now() - started;
          break;
        }
        if (Date.now() - started > 5000) break;
      }
      testInfo.annotations.push({ type: 'preview-changed-after-ms', description: String(changedAfter) });
      expect(changedAfter, `${change.name}: the preview changed`).toBeGreaterThan(0);
      expect(changedAfter, `${change.name}: FR-15, within 1 second`).toBeLessThanOrEqual(1000);
    });
  }
});
