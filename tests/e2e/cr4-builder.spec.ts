import { expect, test, type Page } from '@playwright/test';
import { addPhotos, trackProblems } from './support/app';
import { makePhotos } from './support/images';

/*
 * CR-4 builder shell and steps (design spec 12.4 and 12.5, requirements FR-82, FR-85 to FR-87, US-54 to US-56).
 *   US-54  progress: the stepper, the "Still to do" chips and "Ready to publish"
 *   US-55  the three-Next path to Publish, "Add more photos"
 *   US-56  validation messages on blur and on a failed Next, never while typing
 *   FR-82 / spec 12.4.1  exactly one Preview button is visible at a time
 */

const gotoBuilder = async (page: Page) => {
  await page.goto('./?e2e=1#/create');
  await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
};
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const next = (page: Page) => page.getByRole('button', { name: 'Next' });
const visibleStillToDoHeadings = (page: Page) => page.locator('.still-to-do__heading:visible');

const VISITOR_FIELD = 'Who is this museum for?';
const GUIDE_FIELD = 'Your name';
const VISITOR_MESSAGE = 'Enter the name of the person this museum is for.';
const GUIDE_MESSAGE = 'Enter your name, so your guide has a name to wear.';

test.describe('US-55 AC-3, US-67 AC-5, FR-86: three Next presses and Publish', () => {
  test.setTimeout(180_000);

  test('only 1 photo, a Visitor name, a Guide name and consent: Next three times, then Publish, with no step skipped and More options never opened', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    const seen: string[] = [await h1(page).innerText()];
    let presses = 0;
    // 1 -> 2
    await next(page).click();
    presses++;
    await expect(h1(page)).toHaveText('Words');
    seen.push('Words');
    await page.getByLabel(VISITOR_FIELD).fill('Alex');
    await page.getByLabel(GUIDE_FIELD).fill('Sam');
    // 2 -> 3
    await next(page).click();
    presses++;
    await expect(h1(page)).toHaveText('Characters');
    seen.push('Characters');
    // Nothing on the Characters step is required: More options is never opened on this path.
    await expect(page.locator('.more-options__button[aria-expanded=true]')).toHaveCount(0);
    // 3 -> 4
    await next(page).click();
    presses++;
    await expect(h1(page)).toHaveText('Review and publish');
    seen.push('Review and publish');
    expect(presses, 'Next was pressed exactly three times').toBe(3);
    expect(seen).toEqual(['Photos', 'Words', 'Characters', 'Review and publish']);
    // On Review there is no Next; the consent box and Publish remain.
    await expect(next(page)).toHaveCount(0);
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    const publish = page.getByRole('button', { name: /Publish museum/ });
    await expect(publish).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    await publish.click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    problems.expectClean();
  });

  test('US-55 AC-1: every step groups its fields under short headings and marks each Required or Optional in text', async ({ page }) => {
    await gotoBuilder(page);
    // Step 1: "Your photos" Required.
    await expect(page.locator('.step-card').filter({ hasText: 'Your photos' }).first()).toContainText(/Required/);
    await addPhotos(page, makePhotos(1));
    await next(page).click();
    // Step 2: The names (Required) before Make it yours (Optional), the sample between.
    const headings = await page.locator('.builder__content h2').allInnerTexts();
    expect(headings.map((t) => t.trim())).toEqual(['The names', 'How it will look', 'Make it yours']);
    const tags = await page.locator('.tag').allInnerTexts();
    expect(tags.map((t) => t.trim().toLowerCase())).toEqual(expect.arrayContaining(['required', 'optional']));
    await expect(page.getByLabel(/Museum title \(optional\)/)).toBeVisible();
    await expect(page.getByLabel(/Closing message \(optional\)/)).toBeVisible();
    // Defaults shown as placeholders, never stored (spec 12.5.2).
    await page.getByLabel(VISITOR_FIELD).fill('Alex');
    await expect(page.getByLabel(/Museum title \(optional\)/)).toHaveAttribute('placeholder', 'A museum for Alex');
    await expect(page.getByLabel(/Museum title \(optional\)/)).toHaveValue('');
    await page.getByLabel(GUIDE_FIELD).fill('Sam');
    await next(page).click();
    // Step 3: Optional as a whole.
    await expect(page.locator('.step-purpose .tag--optional')).toHaveText('Optional');
    await next(page).click();
    // Step 4: Consent is Required.
    await expect(page.locator('.consent-card')).toContainText(/Required/);
  });

  test('US-55 AC-5: on a phone in portrait the required fields come before the optional ones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    await next(page).click();
    const required = (await page.getByLabel(VISITOR_FIELD).boundingBox())!;
    const required2 = (await page.getByLabel(GUIDE_FIELD).boundingBox())!;
    const optional = (await page.getByLabel(/Museum title \(optional\)/).boundingBox())!;
    expect(required.y).toBeLessThan(optional.y);
    expect(required2.y).toBeLessThan(optional.y);
  });
});

test.describe('FR-82 and spec 12.4.1: exactly one Preview is visible at a time', () => {
  test.setTimeout(240_000);

  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 639, height: 800 },
    { width: 640, height: 800 },
    { width: 1023, height: 800 },
    { width: 1024, height: 800 },
    { width: 1280, height: 720 },
  ];

  test('steps 1 to 4 at every width: one visible Preview, one in the accessibility tree; on step 4 from 640 px it sits beside Publish', async ({
    page,
  }, testInfo) => {
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    const notes: string[] = [];
    for (let step = 1; step <= 4; step++) {
      if (step === 2) {
        await next(page).click();
        await page.getByLabel(VISITOR_FIELD).fill('Alex');
        await page.getByLabel(GUIDE_FIELD).fill('Sam');
      } else if (step > 2) {
        await next(page).click();
      }
      for (const vp of viewports) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(150);
        const where = `step ${step} at ${vp.width}x${vp.height}`;
        const domCount = await page.locator('.builder__preview').count();
        expect(domCount, `${where}: the DOM holds a Preview in the header, the bar${step === 4 ? ' and Review' : ''}`).toBe(step === 4 ? 3 : 2);
        const visible = page.locator('.builder__preview:visible');
        await expect(visible, `${where}: one visible Preview`).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Preview' }), `${where}: one Preview in the accessibility tree`).toHaveCount(1);
        const cls = (await visible.getAttribute('class')) ?? '';
        const phone = vp.width < 640;
        const expected = phone ? 'builder__preview--bar' : step === 4 ? 'builder__preview--review' : 'builder__preview--header';
        expect(cls, where).toContain(expected);
        notes.push(`${where}: ${expected}`);
        if (step === 4 && !phone) {
          const p = (await visible.boundingBox())!;
          const pub = (await page.getByRole('button', { name: /Publish museum/ }).boundingBox())!;
          expect(Math.abs(p.y + p.height / 2 - (pub.y + pub.height / 2)), `${where}: Preview and Publish share a row`).toBeLessThan(10);
          expect(p.x, `${where}: Preview is left of Publish`).toBeLessThan(pub.x);
        }
      }
    }
    testInfo.annotations.push({ type: 'visible-preview', description: notes.join(' | ') });
  });

  test('spec 12.4.1: Back and Preview are not rendered while publishing', async ({ page }) => {
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    await next(page).click();
    await page.getByLabel(VISITOR_FIELD).fill('Alex');
    await page.getByLabel(GUIDE_FIELD).fill('Sam');
    await next(page).click();
    await next(page).click();
    await expect(h1(page)).toHaveText('Review and publish');
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await page.evaluate(`globalThis.__APP_TEST__.useBuilderStore.setState({ publish: { phase: 'publishing', error: null, shareToken: null } })`);
    await expect(page.getByRole('button', { name: 'Preview' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(page.locator('.builder__preview')).toHaveCount(0);
  });

  test('FR-82: the phone action bar holds Back, Preview and Next in one row, at least 44 px, 8 px apart, in the lower 60% (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    await next(page).click();
    await expect(h1(page)).toHaveText('Words');
    const back = (await page.getByRole('button', { name: 'Back' }).boundingBox())!;
    const prev = (await page.getByRole('button', { name: 'Preview' }).boundingBox())!;
    const nxt = (await next(page).boundingBox())!;
    for (const [name, b] of [['Back', back], ['Preview', prev], ['Next', nxt]] as const) {
      expect(b.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(b.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(b.y, `${name} is in the lower 60% (y >= 338)`).toBeGreaterThanOrEqual(338);
    }
    expect(Math.abs(back.y - nxt.y), 'one row').toBeLessThan(6);
    expect(prev.x - (back.x + back.width), 'gap Back to Preview').toBeGreaterThanOrEqual(8 - 0.5);
    expect(nxt.x - (prev.x + prev.width), 'gap Preview to Next').toBeGreaterThanOrEqual(8 - 0.5);
    // Preview works from the bar: with a photo and both names it opens the preview.
    await page.getByLabel(VISITOR_FIELD).fill('Alex');
    await page.getByLabel(GUIDE_FIELD).fill('Sam');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('US-55 and spec 12.5.1: Add more photos', () => {
  test.setTimeout(240_000);

  test('absent with no photos; with 1 to 19 photos a secondary button named "Add more photos" follows the list and adds more', async ({ page }) => {
    await gotoBuilder(page);
    await expect(page.getByRole('button', { name: 'Add more photos' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add photos', exact: true })).toBeVisible();
    await addPhotos(page, makePhotos(2));
    const more = page.getByRole('button', { name: 'Add more photos' });
    await expect(more).toBeVisible();
    // A different accessible name from "Add photos", which is still there.
    await expect(page.getByRole('button', { name: 'Add photos', exact: true })).toBeVisible();
    await expect(page.getByText('2 of 20 photos')).toBeVisible();
    // It sits after the list, not before it.
    const list = (await page.locator('.photo-list').boundingBox())!;
    const moreBox = (await more.boundingBox())!;
    expect(moreBox.y).toBeGreaterThanOrEqual(list.y + list.height - 1);
    expect(moreBox.height).toBeGreaterThanOrEqual(44);
    // It is secondary: not the primary style.
    expect(await more.getAttribute('class')).toMatch(/secondary/);
    expect(await page.getByRole('button', { name: 'Add photos', exact: true }).getAttribute('class')).toMatch(/primary/);
    // It opens the file chooser and the photos it picks are appended.
    const chooser = page.waitForEvent('filechooser');
    await more.click();
    await (await chooser).setFiles(makePhotos(1).map((f, i) => ({ ...f, name: `extra-${i}.png` })));
    await expect(page.locator('.photo-list > li')).toHaveCount(3, { timeout: 60_000 });
    await expect(page.locator('.photo-row__status--ready')).toHaveCount(3, { timeout: 90_000 });
    await expect(page.getByText('3 of 20 photos')).toBeVisible();
  });

  test('at 20 photos the Add more photos button is gone and Add photos says why', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile || browserName !== 'chromium', 'twenty uploads: desktop Chromium only, to keep the run short');
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(20));
    await expect(page.getByRole('button', { name: 'Add more photos' })).toHaveCount(0);
    await expect(page.getByText(/You can add up to 20 photos/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add photos', exact: true })).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('US-54 and spec 12.4.3: Still to do and Ready to publish', () => {
  test.setTimeout(240_000);

  test('FR-85: the outstanding list is on every step, one visible copy, in step order, and is not a live region', async ({ page }) => {
    await gotoBuilder(page);
    await expect(visibleStillToDoHeadings(page)).toHaveCount(1);
    await expect(visibleStillToDoHeadings(page)).toHaveText('Still to do');
    const chips = page.locator('.still-to-do__chip:visible');
    await expect(chips).toHaveText(['Add a photo', "Add the Visitor's name", 'Add a Guide name', 'Confirm you can share the photos']);
    // Never announced: no live region or alert inside either copy.
    expect(await page.locator('.still-to-do [aria-live], .still-to-do [role=status], .still-to-do [role=alert]').count()).toBe(0);
    // A chip is a button at least 44 px tall.
    for (const box of await chips.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width }; }))) {
      expect(box.h).toBeGreaterThanOrEqual(44 - 0.5);
    }
  });

  test('US-54 AC-2 and AC-3: a chip leads to the field that fixes it and leaves once fixed; "Ready to publish" shows when nothing is left', async ({ page }) => {
    await gotoBuilder(page);
    const chip = (name: string) => page.locator('.still-to-do__chip:visible', { hasText: name });
    // "Add a photo" goes to the Add photos control.
    await chip('Add a photo').click();
    await expect(page.getByRole('button', { name: 'Add photos', exact: true })).toBeFocused();
    // A chip for a step not yet reached leads to the first outstanding item instead of skipping Next's checks.
    await chip("Add the Visitor's name").click();
    await expect(h1(page)).toHaveText('Photos');
    await addPhotos(page, makePhotos(1));
    await expect(chip('Add a photo')).toHaveCount(0);
    await next(page).click();
    await expect(h1(page)).toHaveText('Words');
    await chip("Add the Visitor's name").click();
    await expect(page.getByLabel(VISITOR_FIELD)).toBeFocused();
    await chip('Add a Guide name').click();
    await expect(page.getByLabel(GUIDE_FIELD)).toBeFocused();
    // It does not hide while the Creator is typing, and goes when the field is valid.
    await page.getByLabel(VISITOR_FIELD).fill('Alex');
    await expect(chip("Add the Visitor's name")).toHaveCount(0);
    await expect(chip('Add a Guide name')).toHaveCount(1);
    await page.getByLabel(GUIDE_FIELD).fill('Sam');
    await expect(chip('Add a Guide name')).toHaveCount(0);
    // Only consent is left.
    await expect(page.locator('.still-to-do__chip:visible')).toHaveText(['Confirm you can share the photos']);
    await expect(page.getByText('Ready to publish')).toHaveCount(0);
    await next(page).click();
    await next(page).click();
    await expect(h1(page)).toHaveText('Review and publish');
    // The consent chip leads to the consent box.
    await chip('Confirm you can share the photos').click();
    await expect(page.getByRole('checkbox', { name: /I have the right to share/ })).toBeFocused();
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    await expect(page.locator('.still-to-do__chip:visible')).toHaveCount(0);
    await expect(page.locator('.still-to-do__ready:visible')).toHaveText(/Ready to publish/);
    // Still no live region: a screen reader is not told.
    expect(await page.locator('.still-to-do [aria-live], .still-to-do [role=status]').count()).toBe(0);
  });

  test('US-54 AC-1: the stepper names the step, marks done steps in text, and locked steps are not buttons', async ({ page }) => {
    await gotoBuilder(page);
    const nav = page.getByRole('navigation', { name: 'Builder steps' });
    await expect(nav).toContainText('Step 1 of 4: Photos');
    await expect(nav.getByRole('button')).toHaveCount(1); // only the step reached so far
    await expect(nav.locator('[aria-current=step]')).toContainText('Photos');
    await addPhotos(page, makePhotos(1));
    await next(page).click();
    await expect(nav).toContainText('Step 2 of 4: Words');
    await expect(nav.getByRole('button')).toHaveCount(2);
    await expect(nav.locator('.is-done')).toContainText('Photos');
    await expect(nav.locator('.is-done')).toContainText('(done)');
    await expect(nav.locator('[aria-current=step]')).toContainText('Words');
  });

  test('US-54 AC-5: a polite announcement says which step it is', async ({ page }) => {
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    await page.evaluate(`(() => {
      const g = globalThis; g.__qaLive = [];
      const read = () => [...g.document.querySelectorAll('[role=status][aria-live=polite]')].map((e) => e.textContent).join('|');
      let last = read();
      new g.MutationObserver(() => { const t = read(); if (t !== last) { last = t; g.__qaLive.push(t); } }).observe(g.document.documentElement, { subtree: true, childList: true, characterData: true });
    })()`);
    await next(page).click();
    await expect.poll(async () => ((await page.evaluate(`globalThis.__qaLive`)) as string[]).join(' ~ ')).toContain('Step 2 of 4: Words');
  });
});

test.describe('US-56 AC-2, FR-87 and spec 12.4.5: validation on blur and on a failed Next', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    await gotoBuilder(page);
    await addPhotos(page, makePhotos(1));
    await next(page).click();
    await expect(h1(page)).toHaveText('Words');
  });

  test('no message on first render, none while typing, one after leaving the field, gone when fixed', async ({ page }) => {
    const errors = page.locator('.field__error');
    await expect(errors).toHaveCount(0);
    const visitor = page.getByLabel(VISITOR_FIELD);
    await visitor.focus();
    await expect(errors, 'focus alone shows no message').toHaveCount(0);
    // Typing and deleting leaves the field empty and still focused: no message "while the Creator is still typing".
    await visitor.pressSequentially('Al');
    await visitor.press('Backspace');
    await visitor.press('Backspace');
    await expect(visitor).toHaveValue('');
    await expect(errors, 'empty but still focused').toHaveCount(0);
    await expect(visitor).not.toHaveAttribute('aria-invalid', 'true');
    // Leaving the field empty shows the message beside it, linked to it.
    await visitor.press('Tab');
    const message = page.locator('.field', { has: visitor }).locator('.field__error');
    await expect(message).toHaveText(new RegExp(VISITOR_MESSAGE.replace('.', '\\.')));
    await expect(visitor).toHaveAttribute('aria-invalid', 'true');
    const errorId = await message.getAttribute('id');
    expect(await visitor.getAttribute('aria-describedby')).toContain(errorId!);
    // Only that field: the Guide field was not touched.
    await expect(page.locator('.field', { has: page.getByLabel(GUIDE_FIELD) }).locator('.field__error')).toHaveCount(0);
    // Coming back to the field hides it again while typing, and a valid value clears it.
    await visitor.focus();
    await expect(message).toHaveCount(0);
    await visitor.fill('Alex');
    await visitor.press('Tab');
    await expect(page.locator('.field', { has: visitor }).locator('.field__error')).toHaveCount(0);
    await expect(visitor).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('tabbing through both names empty shows both messages; the message wording has no gendered pronoun', async ({ page }) => {
    await page.getByLabel(VISITOR_FIELD).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const errors = page.locator('.builder__content .field__error');
    await expect(errors).toHaveCount(2);
    const text = (await errors.allInnerTexts()).join(' ');
    expect(text).toContain(VISITOR_MESSAGE);
    expect(text).toContain(GUIDE_MESSAGE);
    expect(text).not.toMatch(/\b(she|her|hers|he|him|his)\b/i);
  });

  test('a failed Next shows the messages beside the fields and a summary, without anyone having typed or left a field', async ({ page }) => {
    await expect(page.locator('.field__error')).toHaveCount(0);
    await next(page).click();
    await expect(h1(page)).toHaveText('Words'); // did not move
    await expect(page.locator('.builder__content .field__error')).toHaveCount(2);
    await expect(page.getByRole('alert').or(page.locator('.alert')).filter({ hasText: '2 things need fixing' })).toBeVisible();
    // Fixing one removes only its message.
    await page.getByLabel(VISITOR_FIELD).fill('Alex');
    await page.getByLabel(GUIDE_FIELD).focus();
    await expect(page.locator('.field', { has: page.getByLabel(VISITOR_FIELD) }).locator('.field__error')).toHaveCount(0);
  });
});

test.describe('US-50 AC-2 and AC-3 (FR-79): overlay motion is 250 ms or less, and instant under reduced motion', () => {
  const durations = (page: Page) =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const ms = (v: string) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000);
      const dialog = document.querySelector('dialog.dialog[open]') as HTMLElement | null;
      const cs = dialog ? getComputedStyle(dialog) : null;
      const list = (v: string | undefined) => (v ?? '').split(',').map((x) => ms(x));
      return {
        overlay: ms(root.getPropertyValue('--duration-overlay')),
        fast: ms(root.getPropertyValue('--duration-fast')),
        dialogAnimation: list(cs?.animationDuration),
        dialogTransition: list(cs?.transitionDuration),
        dialogAnimationName: cs?.animationName ?? 'none',
      };
    });

  test('the overlay tokens and an opened dialog are 250 ms or less', async ({ page }) => {
    await gotoBuilder(page);
    await page.getByRole('button', { name: 'Preview' }).click(); // nothing added yet: the "what is missing" dialog opens
    await expect(page.getByRole('dialog', { name: 'Almost ready to preview' })).toBeVisible();
    const d = await durations(page);
    expect(d.overlay).toBeLessThanOrEqual(250);
    expect(d.fast).toBeLessThanOrEqual(250);
    for (const v of [...d.dialogAnimation, ...d.dialogTransition]) expect(v, `dialog duration ${v} ms`).toBeLessThanOrEqual(250);
    expect(d.dialogAnimationName, 'the dialog does enter with motion').not.toBe('none');
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the overlay tokens and an opened dialog are instant', async ({ page }) => {
      await gotoBuilder(page);
      await page.getByRole('button', { name: 'Preview' }).click();
      await expect(page.getByRole('dialog', { name: 'Almost ready to preview' })).toBeVisible();
      const d = await durations(page);
      expect(d.overlay).toBe(0);
      expect(d.fast).toBe(0);
      for (const v of [...d.dialogAnimation, ...d.dialogTransition]) expect(v, `dialog duration ${v} ms`).toBeLessThanOrEqual(0.1);
    });
  });
});
