import { expect, test as base, type Page } from '@playwright/test';
import { addPhotos, chooseGender, createMuseum, fillWords, layout, openVisit, seedDraftAndOpen, startVisit, waitForSnap, type PageGlobals } from './support/app';
import { enterVisit, standAndFrame } from './support/presentation';
import { makePhotos } from './support/images';

/*
 * NFR-12 and US-32: automated WCAG 2.2 AA checks with axe-core, plus keyboard and focus checks.
 * @axe-core/playwright is a devDependency (package.json), so after `npm ci` these tests run. The
 * skip below is only a safety net for an install that omitted dev dependencies; if the axe tests
 * show as skipped in CI, treat that as a failed setup, not a pass.
 * Automated checks find about a third of WCAG issues, so a manual screen reader pass is still
 * listed as "not verified" in docs/qa-report.md.
 */

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  nodes: Array<{ target: unknown[]; failureSummary?: string }>;
}
interface AxeBuilderLike {
  withTags(tags: string[]): AxeBuilderLike;
  withRules(rules: string[]): AxeBuilderLike;
  exclude(selector: string): AxeBuilderLike;
  analyze(): Promise<{ violations: AxeViolation[] }>;
}
type AxeBuilderCtor = new (options: { page: Page }) => AxeBuilderLike;

let AxeBuilder: AxeBuilderCtor | null = null;
try {
  const specifier = '@axe-core/playwright';
  AxeBuilder = ((await import(/* @vite-ignore */ specifier)) as { default: AxeBuilderCtor }).default;
} catch {
  AxeBuilder = null;
}

const test = base.extend<{ axe: (page: Page, label: string, exclude?: string[]) => Promise<void> }>({
  axe: async ({ browserName }, use, testInfo) => {
    void browserName;
    await use(async (page, label, exclude = []) => {
      const Builder = AxeBuilder;
      if (!Builder) return;
      let builder = new Builder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
      for (const selector of exclude) builder = builder.exclude(selector);
      const results = await builder.analyze();
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target, why: n.failureSummary?.slice(0, 240) })),
      }));
      if (summary.length > 0) {
        await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
      }
      expect(summary, `axe violations on ${label}`).toEqual([]);
    });
  },
});

test.skip(AxeBuilder === null, '@axe-core/playwright is not installed');

test.describe('axe: Creator side', () => {
  test('home, legal pages and not-found', async ({ page, axe }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page, 'home');
    await page.goto('./#/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page, 'privacy');
    await page.goto('./#/terms');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page, 'terms');
    await page.goto('./#/m/not-a-museum');
    await expect(page.getByRole('heading', { name: "We can't find that museum" })).toBeVisible();
    await axe(page, 'not-found');
  });

  test('builder: all four steps, with errors showing, and the published screen', async ({ page, axe }) => {
    await page.goto('./#/create');
    await expect(page.getByRole('button', { name: 'Add photos' })).toBeVisible();
    await axe(page, 'builder-1-empty');
    await addPhotos(page, makePhotos(2));
    await axe(page, 'builder-1-photos');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click(); // blocked: shows the error summary
    await expect(page.getByRole('alert').filter({ hasText: 'things need fixing' })).toBeVisible();
    await axe(page, 'builder-2-errors');
    await page.getByLabel(/Who is this museum for/).fill('Alex');
    await page.getByLabel(/Your name/).fill('Sam');
    await axe(page, 'builder-2-words');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await expect(page.getByText('Getting your characters ready')).toBeHidden({ timeout: 30_000 });
    // BUG-3 (fixed): the character tabs now point aria-controls at #character-panel, so nothing
    // is excluded from axe any more.
    await axe(page, 'builder-3-characters');
    await page.getByRole('tab', { name: 'Hair' }).click();
    await axe(page, 'builder-3-hair');
    await page.getByRole('button', { name: 'Next' }).click();
    await axe(page, 'builder-4-review');
    await page.getByRole('button', { name: /Publish museum/ }).click(); // consent error
    await axe(page, 'builder-4-consent-error');
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    await page.getByRole('button', { name: /Publish museum/ }).click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
    await axe(page, 'published');
  });

  test('BUG-3 (fixed): the Guide and Visitor tabs point aria-controls at an element that exists', async ({ page }) => {
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {});
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    for (const id of ['guide', 'visitor']) {
      const target = await page.locator(`#character-tab-${id}`).getAttribute('aria-controls');
      expect(await page.locator(`#${target}`).count(), `${id} tab aria-controls="${target}"`).toBe(1);
    }
  });

  test('edit page and delete confirmation', async ({ page, axe }) => {
    const made = await createMuseum(page, { photos: 2 });
    await page.goto(`./#/edit/${made.editToken}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page, 'edit');
    await page.getByRole('button', { name: 'Delete museum' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await axe(page, 'edit-delete-dialog');
  });
});

test.describe('axe: Visitor side', () => {
  // Reduced motion removes fades, so axe never samples a half-transparent button (a false contrast hit).
  test.use({ reducedMotion: 'reduce' });
  test('welcome, roaming HUD, caption card, sheets, viewer and finale', async ({ page, axe }) => {
    const made = await createMuseum(page, { photos: 3, captions: ['First caption here.', 'Second.', 'Third.'], closingMessage: 'A note.\nWith two lines.' });
    await openVisit(page, made.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    await axe(page, 'welcome');
    await startVisit(page);
    await page.waitForTimeout(700); // the welcome card fades out
    await axe(page, 'roaming-hud');
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(0));
    await waitForSnap(page, (n) => n.guide.mode === 'present', 30_000, 'a presentation');
    await expect(page.locator('.caption-card')).toBeVisible();
    await axe(page, 'caption-card');
    await page.getByRole('button', { name: 'Pictures' }).click();
    await expect(page.getByRole('dialog', { name: 'Pictures' })).toBeVisible();
    await axe(page, 'pictures-sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await axe(page, 'settings-sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Help' }).click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await axe(page, 'help-sheet');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Photo 1 of 3/ })).toBeVisible();
    await expect(page.locator('.viewer__image')).toHaveClass(/is-loaded/);
    await axe(page, 'viewer');
    await page.keyboard.press('Escape');
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await expect(page.locator('.finale-card')).toBeVisible();
    await axe(page, 'finale-card');
  });
});

test.describe('keyboard and focus (US-32 AC-1)', () => {
  test('the whole visit can be done with the keyboard: Start, move, present, Look closer, Close, finale, Replay', async ({
    page,
  }) => {
    const made = await createMuseum(page, { photos: 2, captions: ['One.', 'Two.'], closingMessage: 'Bye.' });
    await openVisit(page, made.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.scene-root')).toBeFocused({ timeout: 30_000 });
    // Move with keys.
    const l = await layout(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(800);
    await page.keyboard.up('w');
    // Open the Pictures list with P and choose photo 1 with Enter.
    await page.keyboard.press('p');
    await page.keyboard.press('Enter');
    await waitForSnap(page, (n) => n.intent === `photo:${l.slots[0]!.photoId}`, 25_000, 'a presentation');
    await waitForSnap(page, (n) => n.guide.mode === 'present', 30_000, 'the Guide to arrive');
    // Tab to Look closer, open the viewer, close it with Escape.
    await page.getByRole('button', { name: /Look closer/i }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /Photo 1/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Dismiss with the keyboard, jump to the finale through the list, then Replay.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pictures' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Pictures' }).getByRole('button', { name: /Finale/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.finale-card')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Replay from the start' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.finale-card')).toHaveCount(0);
    await expect(page.getByText('0 of 2 pictures viewed')).toBeAttached();
  });

  test('every interactive control shows a visible focus indicator', async ({ page }) => {
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {});
    const failures: string[] = [];
    // Tab through the review step and check each focused element has an outline or ring.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = (await page.evaluate(`(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const ring = s.boxShadow && s.boxShadow !== 'none';
        return { name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), ok: outline || ring };
      })()`)) as { name: string; ok: boolean } | null;
      if (info && !info.ok) failures.push(info.name);
    }
    expect(failures).toEqual([]);
  });
});

test.describe('reflow and zoom (WCAG 1.4.10)', () => {
  test('home and builder reflow at 320 px wide without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const hash of ['#/', '#/create', '#/privacy']) {
      await page.goto(`./${hash}`);
      await expect(page.locator('h1').first()).toBeVisible();
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number;
      expect(overflow, hash).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('axe: CR-1, CR-2 and CR-3 additions (v0.3 and spec v1.4)', () => {
  test('builder Body tab with the Gender group (Woman and Man chosen), and the Face tab with the Visitor facial hair group', async ({ page, axe }) => {
    await page.goto('./#/create');
    await addPhotos(page, makePhotos(1));
    await fillWords(page, {});
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await expect(page.getByText('Getting your characters ready')).toBeHidden({ timeout: 30_000 });
    await axe(page, 'builder-3-body-gender-neutral');
    await chooseGender(page, 'Guide', 'Woman');
    await axe(page, 'builder-3-body-gender-woman');
    await chooseGender(page, 'Visitor', 'Man');
    await axe(page, 'builder-3-body-gender-man-visitor');
    await page.getByRole('tab', { name: 'Face' }).click();
    await axe(page, 'builder-3-face-visitor-facial-hair');
  });

  test('the "Photos aren\'t kept" notice on steps 1, 3 and 4 (contrast and structure)', async ({ page, axe }) => {
    await seedDraftAndOpen(page, { step: 1, visitorName: 'Alex', guideName: 'Sam' });
    await expect(page.locator('.restored-notice')).toBeVisible();
    await axe(page, 'notice-step-1');
    // Next needs a photo, so open the draft again on step 3 (a reload does the same).
    await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam' });
    await expect(page.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible();
    await expect(page.locator('.restored-notice')).toBeVisible();
    await expect(page.getByText('Getting your characters ready')).toBeHidden({ timeout: 30_000 });
    await axe(page, 'notice-step-3');
    await page.getByRole('button', { name: 'Next' }).click();
    await axe(page, 'notice-step-4');
  });

  test.describe('the caption card at the framed pose', () => {
    test.use({ reducedMotion: 'reduce' });
    for (const vp of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1280, height: 720 },
    ]) {
      test(`caption card, strip expanded with Read more, at ${vp.width}x${vp.height}`, async ({ page, axe }) => {
        test.setTimeout(240_000);
        const long = 'A long caption that runs over several lines so that the strip has to cut it off and offer Read more. '.repeat(3).trim();
        const made = await createMuseum(page, { photos: 1, captions: [long] });
        await enterVisit(page, made.shareToken, vp);
        await standAndFrame(page, 0);
        await expect(page.locator('.caption-card')).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(800);
        await axe(page, `caption-card-${vp.width}x${vp.height}`);
        const toggle = page.locator('.caption-card__toggle');
        if (await toggle.count()) {
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await axe(page, `caption-card-expanded-${vp.width}x${vp.height}`);
        }
      });
    }
  });
});
