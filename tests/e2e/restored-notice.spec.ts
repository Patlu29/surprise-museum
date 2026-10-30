import { expect, test, type Page } from '@playwright/test';
import {
  addPhotos,
  DRAFT_KEY,
  LEGACY_GUIDE_AVATAR,
  LEGACY_VISITOR_AVATAR,
  seedDraftAndOpen,
  trackProblems,
} from './support/app';
import { makePhotos } from './support/images';

/*
 * CR-3 (design spec 5.17): the "Photos aren't kept" notice in the builder. Photos are never persisted,
 * so after a reload a draft with content has no photos; the notice says so. It is information, not an
 * error: no alert role, no focus on load, memory-only dismissal.
 */

const LINE_1 = "Photos aren't kept after a reload. Please add them again.";
const LINE_2 = 'Your names, words and characters are still here.';
const notice = (page: Page) => page.locator('.restored-notice');
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

/** Collect every message the polite live regions receive, with a timestamp, from before the app loads. */
async function recordAnnouncements(page: Page) {
  await page.addInitScript(() => {
    const g = globalThis as unknown as {
      __qaLive: Array<{ t: number; text: string }>;
      document: { querySelectorAll(s: string): Iterable<{ textContent: string | null }> };
      MutationObserver: new (cb: () => void) => { observe(n: unknown, o: unknown): void };
      performance: { now(): number };
    };
    g.__qaLive = [];
    let last = '';
    const read = () => {
      const text = Array.from(g.document.querySelectorAll('[role=status][aria-live=polite]'))
        .map((el) => el.textContent ?? '')
        .join(' | ');
      if (text !== last) {
        last = text;
        if (text.trim()) g.__qaLive.push({ t: g.performance.now(), text });
      }
    };
    new g.MutationObserver(read).observe(g.document, { subtree: true, childList: true, characterData: true });
  });
}
const liveLog = (page: Page) =>
  page.evaluate(`globalThis.__qaLive`) as Promise<Array<{ t: number; text: string }>>;

test.describe('CR-3 "Photos aren\'t kept" notice', () => {
  test('N1: after a reload with content but no photos, the notice shows with both lines, as information (no alert role, no focus taken)', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam' });
    await expect(heading(page, 'Characters')).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(LINE_1);
    await expect(notice(page)).toContainText(LINE_2);
    expect(await page.getByRole('alert').count(), 'it is not an alert').toBe(0);
    await expect(notice(page)).not.toHaveAttribute('role', /.+/);
    // No heading element inside the notice, so the step's heading outline is unchanged.
    await expect(notice(page).getByRole('heading')).toHaveCount(0);
    // The notice never takes focus on load (the step heading does, as for any step change).
    const inside = await notice(page).evaluate((el) => el.contains((el.ownerDocument as unknown as { activeElement: unknown }).activeElement as never));
    expect(inside).toBe(false);
    problems.expectClean();
  });

  test('N1: a real reload (not a seeded draft) after typing names shows it, and the saved draft holds no notice state', async ({ page }) => {
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel(/Who is this museum for/).fill('Real Reload');
    await expect(notice(page), 'not shown for a draft started in this page load').toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel(/Who is this museum for/)).toHaveValue('Real Reload', { timeout: 10_000 });
    await expect(notice(page)).toBeVisible();
    const raw = await page.evaluate((k) => (globalThis as unknown as { localStorage: { getItem(k: string): string | null } }).localStorage.getItem(k), DRAFT_KEY);
    expect(raw).not.toMatch(/notice|dismiss/i);
  });

  test('N2: not shown for a draft that holds only the defaults (including an old one with no gender), or with no draft at all', async ({
    page,
  }) => {
    // Defaults only, step 1: nothing was lost.
    await seedDraftAndOpen(page, { step: 1, guideAvatar: LEGACY_GUIDE_AVATAR, visitorAvatar: LEGACY_VISITOR_AVATAR });
    await expect(heading(page, 'Photos')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    // Whitespace-only text is not content.
    await seedDraftAndOpen(page, { step: 1, visitorName: '   ', title: ' ' });
    await expect(heading(page, 'Photos')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    // A draft with explicit Neutral genders and defaults is still only defaults.
    await seedDraftAndOpen(page, {
      step: 1,
      guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'neutral' },
      visitorAvatar: { ...LEGACY_VISITOR_AVATAR, gender: 'neutral' },
    });
    await expect(notice(page)).toHaveCount(0);
    // No draft at all.
    await page.goto('about:blank');
    await page.goto('./?e2e=1');
    await page.evaluate((k) => (globalThis as unknown as { localStorage: { removeItem(k: string): void } }).localStorage.removeItem(k), DRAFT_KEY);
    await page.goto('about:blank');
    await page.goto('./?e2e=1#/create');
    await expect(heading(page, 'Photos')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test('N2: any one thing beyond the defaults shows it: a name, a changed character choice (including a gender), or a later saved step', async ({
    page,
  }) => {
    const cases: Array<[string, Parameters<typeof seedDraftAndOpen>[1]]> = [
      ['a title', { step: 1, title: 'Our year' }],
      ['a closing message', { step: 1, closingMessage: 'Love you' }],
      ['a Guide gender', { step: 1, guideAvatar: { ...LEGACY_GUIDE_AVATAR, gender: 'feminine' } }],
      ['a Visitor beard', { step: 1, visitorAvatar: { ...LEGACY_VISITOR_AVATAR, facialHair: 'goatee' } }],
      ['a later saved step', { step: 2 }],
    ];
    for (const [label, seed] of cases) {
      await seedDraftAndOpen(page, seed);
      await expect(notice(page), label).toBeVisible();
    }
  });

  test('N3: Add photos is on steps 2 to 4 only; it goes to step 1 and moves focus to the heading; the notice stays across steps', async ({
    page,
  }) => {
    await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam' });
    await expect(heading(page, 'Characters')).toBeVisible();
    const add = notice(page).getByRole('button', { name: 'Add photos' });
    await expect(add).toBeVisible();
    // Step 3: the notice sits directly under the heading and above the preview.
    const order = await page.evaluate(`(() => {
      const d = globalThis.document;
      const h = d.querySelector('main h1');
      const n = d.querySelector('.restored-notice');
      const p = d.querySelector('.characters');
      const before = (a, b) => !!(a.compareDocumentPosition(b) & 4);
      return { headingFirst: before(h, n), noticeBeforeContent: before(n, p), adjacent: h.nextElementSibling === n };
    })()`);
    expect(order).toEqual({ headingFirst: true, noticeBeforeContent: true, adjacent: true });
    // Step 4: above the Add-a-photo issues, not replacing them.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(heading(page, 'Review and publish')).toBeVisible();
    await expect(notice(page)).toBeVisible();
    await expect(add).toBeVisible();
    // Publishing without photos shows the issues; the notice comes first and is not replaced by them.
    await page.getByRole('button', { name: /Publish museum/ }).click();
    await expect(page.getByText('Add at least one photo.').first()).toBeVisible();
    await expect(notice(page)).toBeVisible();
    const noticeFirst = await page.evaluate(`(() => { const d = globalThis.document; const n = d.querySelector('.restored-notice'); const a = d.querySelector('main .alert, main [role=alert], main .alert--danger'); return a ? !!(n.compareDocumentPosition(a) & 4) : null; })()`);
    expect(noticeFirst, 'the notice comes before the error summary').not.toBe(false);
    // Back to step 2 keeps it and does not duplicate it.
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(heading(page, 'Words')).toBeVisible();
    await expect(notice(page)).toHaveCount(1);
    // Add photos goes to step 1 and puts focus on its heading.
    await notice(page).getByRole('button', { name: 'Add photos' }).click();
    await expect(heading(page, 'Photos')).toBeVisible();
    await expect(heading(page, 'Photos')).toBeFocused();
    // On step 1 the Add photos area is right there, so the notice has no Add photos button.
    await expect(notice(page)).toBeVisible();
    await expect(notice(page).getByRole('button', { name: 'Add photos' })).toHaveCount(0);
  });

  test('N4: Dismiss is a 44 px button; it removes the notice for this page load, moves focus to the step heading and is silent', async ({ page }) => {
    await recordAnnouncements(page);
    await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam' });
    const dismiss = notice(page).getByRole('button', { name: 'Dismiss notice' });
    await expect(dismiss).toBeVisible();
    const box = (await dismiss.boundingBox())!;
    expect(box.width, 'Dismiss width').toBeGreaterThanOrEqual(44);
    expect(box.height, 'Dismiss height').toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(1500); // the one announcement has happened
    const before = (await liveLog(page)).length;
    await dismiss.click();
    await expect(notice(page)).toHaveCount(0, { timeout: 3000 });
    await expect(heading(page, 'Characters')).toBeFocused();
    await page.waitForTimeout(1000);
    expect((await liveLog(page)).length, 'dismissal makes no announcement').toBe(before);
    // It does not return when moving between steps.
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(notice(page)).toHaveCount(0);
    // Escape does not dismiss it (it is not a dialog): checked on a fresh load below.
    // Dismissal is memory-only: after a reload it is true again, so it returns.
    await page.reload();
    await expect(notice(page)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(notice(page)).toBeVisible();
  });

  test('N5: the notice is announced once, politely, after the step announcement; not again on step changes', async ({ page }) => {
    await recordAnnouncements(page);
    await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam' });
    await expect(notice(page)).toBeVisible();
    await expect.poll(async () => (await liveLog(page)).filter((e) => e.text.includes("Photos aren't kept")).length, { timeout: 5000 }).toBe(1);
    const log = await liveLog(page);
    const noticeAt = log.findIndex((e) => e.text.includes("Photos aren't kept"));
    expect(log[noticeAt]!.text).toContain(`${LINE_1} ${LINE_2}`);
    const stepAt = log.findIndex((e) => /Step 3 of 4/.test(e.text));
    expect(stepAt, 'the step announcement was made').toBeGreaterThanOrEqual(0);
    expect(stepAt, 'the notice queues behind the step announcement').toBeLessThan(noticeAt);
    expect(log[noticeAt]!.t - log[stepAt]!.t, 'about 600 ms later').toBeGreaterThanOrEqual(400);
    // The live regions that carry it are polite; nothing assertive was added.
    expect(await page.locator('[aria-live=assertive], [role=alert]').count()).toBe(0);
    await expect(page.locator('[role=status][aria-live=polite]').first()).toBeAttached();
    // Not re-announced on step changes.
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForTimeout(1500);
    expect((await liveLog(page)).filter((e) => e.text.includes("Photos aren't kept")).length).toBe(1);
  });

  test('N6: the notice disappears the moment a photo is added, silently, and does not return after the photo is removed', async ({ page }) => {
    await recordAnnouncements(page);
    await seedDraftAndOpen(page, { step: 1, visitorName: 'Alex' });
    await expect(notice(page)).toBeVisible();
    await page.waitForTimeout(1200);
    const before = (await liveLog(page)).length;
    await page.locator('input[type=file]').first().setInputFiles(makePhotos(1));
    await expect(page.locator('.photo-list > li')).toHaveCount(1, { timeout: 30_000 });
    // Gone when the row is created, without waiting for the upload to finish.
    await expect(notice(page)).toHaveCount(0, { timeout: 3000 });
    const flag = await page.evaluate(`globalThis.__APP_TEST__.useBuilderStore.getState().restoredDraftNotice`);
    expect(flag).toBe(false);
    await expect(page.locator('.photo-row__status--ready')).toHaveCount(1, { timeout: 90_000 });
    expect((await liveLog(page)).slice(before).filter((e) => e.text.includes("Photos aren't kept")), 'removal is silent').toHaveLength(0);
    await page.locator('.photo-row').first().getByRole('button', { name: /^Remove/ }).click();
    await page.getByRole('group', { name: 'Remove photo 1' }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.photo-row')).toHaveCount(0);
    await expect(notice(page)).toHaveCount(0);
  });

  test('N7: the notice wraps cleanly with no horizontal scroll at 320 px and does not cover the action bar', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await seedDraftAndOpen(page, { step: 3, visitorName: 'Alex', guideName: 'Sam' });
    await expect(notice(page)).toBeVisible();
    const overflow = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    expect(overflow).toBeLessThanOrEqual(0);
    const n = (await notice(page).boundingBox())!;
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.x + n.width).toBeLessThanOrEqual(320);
    // It scrolls with the content: it is not sticky or fixed, so it never covers a control (WCAG 2.4.11).
    const position = await notice(page).evaluate((el) => (el.ownerDocument as unknown as { defaultView: { getComputedStyle(e: unknown): { position: string } } }).defaultView.getComputedStyle(el).position);
    expect(['static', 'relative']).toContain(position);
  });
});
