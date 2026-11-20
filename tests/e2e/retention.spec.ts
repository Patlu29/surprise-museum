import { expect, test, type Page } from '@playwright/test';
import {
  addPhotos,
  createMuseum,
  openVisit,
  readDemoState,
  trackProblems,
  type Published,
} from './support/app';
import { makePhotos } from './support/images';

/*
 * Iteration 4 (requirements v0.7): US-68 (7-day life, NFR-16), US-71 (availability notice, FR-105),
 * Q-33 (a) (the shared not-found screen) and the privacy sentence (design spec 5.18, 7.5, 10).
 *
 * Everything runs against the in-browser demo backend, which reads `Date.now()`. `page.clock.setFixedTime`
 * pins `Date` (timers keep running), so the moment of publish, the end date and the 7-day boundary are exact
 * and no assertion has to allow for jitter. The time zone is fixed per describe block with `timezoneId`, so
 * the DD/MM/YYYY HH:mm text is the same on every machine.
 *
 * Not covered here, because it needs a deployed project: the hourly purge and "gone from live storage
 * within 24 hours" (US-68 AC-5 and AC-6, US-24 AC-3, NFR-16(e)). See docs/qa-report.md, round 8.
 */

const DAY_MS = 86_400_000;
const SECOND_MS = 1000;
const RETENTION_DAYS = 7;

/** 12:30 on 19/11/2026 in Sydney (UTC+11, daylight saving; no change falls inside the next 7 days). */
const T0 = '2026-11-19T01:30:00.000Z';

const NOT_FOUND_HEADING = "We can't find that museum";
const NOT_FOUND_BODY =
  'The link might have a typo, or the museum may have been deleted. Museums are only kept for 7 days, so it may have ended. Check the link, or ask the person who sent it for a new link.';
const PRIVACY_RETENTION =
  'A published museum stays available for 7 days. An unpublished draft is removed after 7 days. You can delete a museum at any time with its private edit link, and its link stops working straight away.';
const PRIVACY_NO_BACKUPS =
  'Our free plan keeps no backups, and deleted or expired content is removed within 24 hours.';
const LINE_2_PUBLISHED = 'Deleting it with your edit link ends it sooner.';
const LINE_2_EDIT = 'You can end it sooner by deleting it below.';

const notice = (page: Page) => page.locator('.availability');
const noticeLine1 = (page: Page) => page.locator('.availability__line');
const noticeLine2 = (page: Page) => page.locator('.availability__more');

function plus(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

/** Publish a one-photo museum with `Date` pinned to `iso`. Returns the links and the store's `expiresAt`. */
async function publishAt(page: Page, iso: string): Promise<Published & { expiresAt: string }> {
  await page.clock.setFixedTime(iso);
  const museum = await createMuseum(page, { photos: 1 });
  const expiresAt = await storeExpiresAt(page);
  return { ...museum, expiresAt };
}

async function storeExpiresAt(page: Page): Promise<string> {
  const value = (await page.evaluate(
    `globalThis.__APP_TEST__.useBuilderStore.getState().publish.expiresAt`,
  )) as string | null;
  expect(value, 'publish.expiresAt in the builder store').toEqual(expect.any(String));
  return value as string;
}

/**
 * Publish again through the real publish call. The MVP has no re-publish screen (editing is Release 2), so
 * the store's phase is reset to 'idle' to bring back the Review step; its Publish button then calls the same
 * `publishDraft` with the same edit token. Returns the store's `expiresAt` after the second publish.
 */
async function republish(page: Page): Promise<string> {
  await page.evaluate(
    `globalThis.__APP_TEST__.useBuilderStore.getState().setPublish({ phase: 'idle', error: null, shareToken: null, expiresAt: null })`,
  );
  await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeHidden();
  await page.getByRole('button', { name: 'Publish museum' }).click();
  await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({
    timeout: 60_000,
  });
  return storeExpiresAt(page);
}

async function expectNotFound(page: Page, hash: string): Promise<void> {
  await page.goto('about:blank');
  await page.goto(`./?e2e=1${hash}`);
  await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_HEADING })).toBeVisible();
}

test.describe('US-71 the availability notice (Sydney, UTC+11)', () => {
  test.use({ timezoneId: 'Australia/Sydney' });

  test('US-71 AC-1 and AC-2: the published screen says "Available for 7 days, until DD/MM/YYYY HH:mm." and the date is first publish + 168 hours', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    const museum = await publishAt(page, T0);
    await expect(noticeLine1(page)).toHaveText('Available for 7 days, until 26/11/2026 12:30.');
    await expect(noticeLine2(page)).toHaveText(LINE_2_PUBLISHED);
    // The server value is exactly publish + 168 hours (the clock is pinned, so no tolerance is needed).
    expect(Date.parse(museum.expiresAt) - Date.parse(T0)).toBe(RETENTION_DAYS * DAY_MS);
    // <time dateTime> holds the store's expiresAt, and its text is the visible date.
    const time = notice(page).locator('time');
    await expect(time).toHaveCount(1);
    await expect(time).toHaveAttribute('datetime', museum.expiresAt);
    await expect(time).toHaveText('26/11/2026 12:30');
    problems.expectClean();
  });

  test('US-71 AC-1 (placement, spec 5.18): inside the Share link card, below the link field and above "Open my museum"; plain text with no control, role or live region', async ({
    page,
  }) => {
    await publishAt(page, T0);
    const card = page.locator('section[aria-labelledby="share-heading"]');
    await expect(card.locator('.availability')).toHaveCount(1);
    const field = await card.getByRole('textbox', { name: 'Share link' }).boundingBox();
    const open = await card.getByRole('link', { name: /Open my museum/ }).boundingBox();
    const box = await notice(page).boundingBox();
    expect(field && open && box, 'all three are laid out').toBeTruthy();
    expect(box!.y, 'below the link field').toBeGreaterThanOrEqual(field!.y + field!.height - 1);
    expect(box!.y + box!.height, 'above Open my museum').toBeLessThanOrEqual(open!.y + 1);
    // Copy stays the first control after the field: nothing focusable sits between them.
    expect(
      await notice(page).locator('a, button, input, [tabindex], [role], [aria-live]').count(),
    ).toBe(0);
    await expect(notice(page).locator('time')).not.toHaveAttribute('aria-label', /.+/);
  });

  test('US-71 AC-3: after a re-publish three days later the published screen shows the same end date', async ({
    page,
  }) => {
    const first = await publishAt(page, T0);
    await page.clock.setFixedTime(plus(T0, 3 * DAY_MS));
    const second = await republish(page);
    expect(second).toBe(first.expiresAt);
    await expect(noticeLine1(page)).toHaveText('Available for 7 days, until 26/11/2026 12:30.');
    await expect(notice(page).locator('time')).toHaveAttribute('datetime', first.expiresAt);
  });

  test('US-71 AC-2 and AC-3 (edit page): the edit page shows the same notice, date and server instant, with its own second line', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    const museum = await publishAt(page, T0);
    await page.goto(`./#/edit/${museum.editToken}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A museum for Alex');
    const section = page.locator('section[aria-labelledby="share-heading"]');
    await expect(section.locator('.availability')).toHaveCount(1);
    await expect(noticeLine1(page)).toHaveText('Available for 7 days, until 26/11/2026 12:30.');
    await expect(noticeLine2(page)).toHaveText(LINE_2_EDIT);
    await expect(notice(page).locator('time')).toHaveAttribute('datetime', museum.expiresAt);
    // Directly under the link field, above the delete section.
    const field = await section.getByRole('textbox', { name: 'Share link' }).boundingBox();
    const box = await notice(page).boundingBox();
    const del = await page.getByRole('heading', { name: 'Delete this museum' }).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(field!.y + field!.height - 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(del!.y);
    // A re-publish three days later changes nothing on the edit page either.
    await page.goto('about:blank');
    await page.clock.setFixedTime(plus(T0, 3 * DAY_MS));
    await page.goto(`./#/edit/${museum.editToken}`);
    await expect(notice(page).locator('time')).toHaveAttribute('datetime', museum.expiresAt);
    problems.expectClean();
  });

  test('US-71 (spec 5.18): the notice is not shown on the edit page of an unpublished draft', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await page.clock.setFixedTime(T0);
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    const editToken = (await page.evaluate(
      `globalThis.__APP_TEST__.useBuilderStore.getState().editToken`,
    )) as string;
    expect(editToken).toEqual(expect.any(String));
    await page.goto(`./#/edit/${editToken}`);
    await expect(page.getByText('Not published yet')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delete this museum' })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByText(/Available for/)).toHaveCount(0);
    problems.expectClean();
  });

  for (const [label, value] of [
    ['an unparseable date', 'not a date'],
    ['an empty string', ''],
    ['no value', null],
  ] as const) {
    test(`US-71 (spec 5.18 fallback): with ${label} the published screen says "Available for 7 days." with no date, no <time> and no "Invalid Date"`, async ({
      page,
    }) => {
      await publishAt(page, T0);
      await page.evaluate(
        `globalThis.__APP_TEST__.useBuilderStore.getState().setPublish({ expiresAt: ${JSON.stringify(value)} })`,
      );
      await expect(noticeLine1(page)).toHaveText('Available for 7 days.');
      await expect(noticeLine2(page)).toHaveText(LINE_2_PUBLISHED);
      await expect(notice(page).locator('time')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toMatch(/Invalid Date|NaN|undefined|null/);
    });
  }

  for (const width of [320, 360]) {
    test(`US-71 AC-4: at ${width} px with text at 200% the notice is fully visible with no horizontal scrolling (published screen and edit page)`, async ({
      page,
    }) => {
      const museum = await publishAt(page, T0);
      await page.setViewportSize({ width, height: 640 });
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      for (const where of ['published', 'edit'] as const) {
        if (where === 'edit') {
          await page.goto(`./#/edit/${museum.editToken}`);
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await expect(notice(page)).toBeVisible();
        }
        await notice(page).scrollIntoViewIfNeeded();
        const fit = (await page.evaluate(`(() => {
          const root = document.documentElement;
          const n = document.querySelector('.availability');
          const text = document.querySelector('.availability__text');
          const nr = n.getBoundingClientRect();
          const reach = Math.max(...Array.from(n.querySelectorAll('*')).map((e) => e.getBoundingClientRect().right));
          return {
            rootFont: parseFloat(getComputedStyle(root).fontSize),
            scrollWidth: root.scrollWidth, clientWidth: root.clientWidth,
            noticeRight: nr.right, noticeLeft: nr.left, reach,
            textScrollWidth: text.scrollWidth, textClientWidth: text.clientWidth,
            line1Height: document.querySelector('.availability__line').getBoundingClientRect().height,
            line1Font: parseFloat(getComputedStyle(document.querySelector('.availability__line')).fontSize),
          };
        })()`)) as Record<string, number>;
        const label = `${where} at ${width}px`;
        expect(fit.rootFont, `${label}: the text really is at 200%`).toBe(32);
        expect(fit.scrollWidth, `${label}: no horizontal scroll`).toBeLessThanOrEqual(
          fit.clientWidth,
        );
        expect(fit.noticeLeft, label).toBeGreaterThanOrEqual(0);
        expect(fit.noticeRight, `${label}: notice inside the viewport`).toBeLessThanOrEqual(width);
        expect(
          fit.reach,
          `${label}: nothing inside the notice runs past the viewport`,
        ).toBeLessThanOrEqual(width);
        expect(fit.textScrollWidth, `${label}: text is not clipped`).toBeLessThanOrEqual(
          fit.textClientWidth,
        );
        // The line wraps onto several lines (grows), it is not truncated to one.
        expect(fit.line1Height, `${label}: line 1 wraps instead of clipping`).toBeGreaterThan(
          fit.line1Font * 2,
        );
        await expect(noticeLine1(page)).toHaveText('Available for 7 days, until 26/11/2026 12:30.');
        await expect(noticeLine2(page)).toBeVisible();
      }
    });
  }
});

// One published screen per zone: the date is the viewer's local time, 24-hour and zero-padded (spec 5.18).
const ZONES = [
  {
    zone: 'America/New_York',
    now: T0,
    text: '25/11/2026 20:30',
    note: 'the local date differs from the UTC date',
  },
  {
    zone: 'UTC',
    now: '2026-01-02T03:04:00.000Z',
    text: '09/01/2026 03:04',
    note: 'single digits are zero-padded',
  },
  {
    zone: 'Pacific/Auckland',
    now: '2026-12-25T11:05:00.000Z',
    text: '02/01/2027 00:05',
    note: 'midnight is 00:05 not 12:05 and the year rolls over',
  },
] as const;
for (const { zone, now, text, note } of ZONES) {
  test.describe(`US-71 AC-2 local time, ${zone}`, () => {
    test.use({ timezoneId: zone });
    test(`US-71 AC-2: ${note}`, async ({ page }) => {
      const museum = await publishAt(page, now);
      expect(Date.parse(museum.expiresAt)).toBe(Date.parse(now) + RETENTION_DAYS * DAY_MS);
      await expect(noticeLine1(page)).toHaveText(`Available for 7 days, until ${text}.`);
      await expect(notice(page).locator('time')).toHaveAttribute('datetime', museum.expiresAt);
    });
  });
}

test.describe('US-68 a museum lasts 7 days (mock backend, pinned clock)', () => {
  test.use({ timezoneId: 'Australia/Sydney' });

  test('US-68 AC-1 and AC-3, NFR-16(a): expiresAt is first publish + 7 days to the millisecond, and the first value is returned on every later read', async ({
    page,
  }) => {
    const museum = await publishAt(page, T0);
    expect(museum.expiresAt).toBe(plus(T0, RETENTION_DAYS * DAY_MS));
    // The edit page reads it back from the backend, not from the store.
    await page.goto(`./#/edit/${museum.editToken}`);
    await expect(notice(page).locator('time')).toHaveAttribute('datetime', museum.expiresAt);
  });

  test('US-68 AC-3, NFR-16(b): re-publishing on day 3 does not extend it (168 hours from the first publish)', async ({
    page,
  }) => {
    const museum = await publishAt(page, T0);
    await page.clock.setFixedTime(plus(T0, 3 * DAY_MS));
    const again = await republish(page);
    expect(again).toBe(museum.expiresAt);
    // A reader after the re-publish still sees the first end date.
    await page.goto(`./#/edit/${museum.editToken}`);
    await expect(notice(page).locator('time')).toHaveAttribute('datetime', museum.expiresAt);
  });

  test('US-68 AC-1: the share link opens with its photos and captions the day before, and one second before, the end', async ({
    page,
  }) => {
    const museum = await publishAt(page, T0);
    for (const at of [plus(T0, DAY_MS), plus(T0, RETENTION_DAYS * DAY_MS - SECOND_MS)]) {
      await page.clock.setFixedTime(at);
      await openVisit(page, museum.shareToken);
      await expect(page.getByRole('button', { name: 'Start' }), at).toBeVisible();
      await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
    }
  });

  test('US-68 AC-2, NFR-16(d): 7 days and 1 second after first publish the share link shows the not-found screen, with no name, caption or photo', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    const museum = await publishAt(page, T0);
    await page.clock.setFixedTime(plus(T0, RETENTION_DAYS * DAY_MS + SECOND_MS));
    await expectNotFound(page, `#/m/${museum.shareToken}`);
    await expect(page.getByText(NOT_FOUND_BODY, { exact: true })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(museum.visitorName);
    expect(body).not.toContain(museum.guideName);
    expect(body).not.toContain('Caption for photo 1');
    await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
    // No scene and no photo: the only image is the decorative illustration (an svg, aria-hidden).
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('img:not(.illustration)')).toHaveCount(0);
    await expect(page.locator('img.illustration')).toHaveAttribute(
      'src',
      /illustrations\/not-found\.svg$/,
    );
    problems.expectClean();
  });

  test('US-68 AC-2: the edit link of an ended museum also shows the not-found screen', async ({
    page,
  }) => {
    const museum = await publishAt(page, T0);
    await page.clock.setFixedTime(plus(T0, RETENTION_DAYS * DAY_MS + SECOND_MS));
    await expectNotFound(page, `#/edit/${museum.editToken}`);
  });

  test('US-68 AC-4, NFR-16(c): a draft ends 7 days after it was created; editing it does not move that, and a publish on day 6 gives 7 days from that publish', async ({
    page,
  }) => {
    await page.clock.setFixedTime(T0);
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    const editToken = (await page.evaluate(
      `globalThis.__APP_TEST__.useBuilderStore.getState().editToken`,
    )) as string;
    const stored = async () =>
      Object.values((await readDemoState(page)).museums) as unknown as Array<{
        status: string;
        expiresAt: number;
      }>;
    let drafts = await stored();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.status).toBe('draft');
    expect(drafts[0]!.expiresAt).toBe(Date.parse(T0) + RETENTION_DAYS * DAY_MS);

    // Working on the draft three days later (a second upload) leaves the draft's end unchanged.
    await page.clock.setFixedTime(plus(T0, 3 * DAY_MS));
    await page.locator('input[type=file]').first().setInputFiles(makePhotos(2).slice(1));
    await expect(page.locator('.photo-row__status--ready')).toHaveCount(2, { timeout: 90_000 });
    drafts = await stored();
    expect(drafts[0]!.expiresAt).toBe(Date.parse(T0) + RETENTION_DAYS * DAY_MS);

    // Still open one second before the end.
    await page.clock.setFixedTime(plus(T0, RETENTION_DAYS * DAY_MS - SECOND_MS));
    await page.goto(`./#/edit/${editToken}`);
    await expect(page.getByText('Not published yet')).toBeVisible();
    // Gone one second after.
    await page.clock.setFixedTime(plus(T0, RETENTION_DAYS * DAY_MS + SECOND_MS));
    await expectNotFound(page, `#/edit/${editToken}`);
  });

  test('US-68 (draft published on day 6): the 7 days run from that publish, and the draft end is replaced, not added to', async ({
    page,
  }) => {
    await page.clock.setFixedTime(T0);
    const day6 = plus(T0, 6 * DAY_MS);
    await page.goto('./?e2e=1#/create');
    await addPhotos(page, makePhotos(1));
    await page.clock.setFixedTime(day6);
    // Continue through the real builder with the clock on day 6.
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Who is this museum for?').fill('Alex');
    await page.getByLabel('Your name').fill('Sam');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
    const publish = page.getByRole('button', { name: /Publish museum/ });
    await expect(publish).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    await publish.click();
    await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({
      timeout: 60_000,
    });
    expect(await storeExpiresAt(page)).toBe(plus(day6, RETENTION_DAYS * DAY_MS));
  });
});

test.describe('Q-33 (a) the not-found screen', () => {
  test.use({ timezoneId: 'Australia/Sydney' });

  test('Q-33 (a): heading unchanged, body exactly as design spec 7.5, action present, for a wrong token', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await page.goto('./#/m/abcdefghijklmnopqrstuvwx');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOT_FOUND_HEADING);
    await expect(page.locator('.message-screen__card .stack p')).toHaveText([NOT_FOUND_BODY]);
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/90|taken down/);
    problems.expectClean();
  });

  test('Q-33 (a): a wrong token and an expired museum show exactly the same screen', async ({
    page,
  }) => {
    const museum = await publishAt(page, T0);
    // Wrong token: the real token with its last character changed.
    const last = museum.shareToken.slice(-1);
    const wrong = museum.shareToken.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    await expectNotFound(page, `#/m/${wrong}`);
    const wrongText = await page.locator('body').innerText();
    const wrongHtml = await page.locator('#root').innerHTML();
    const wrongTitle = await page.title();

    await page.clock.setFixedTime(plus(T0, RETENTION_DAYS * DAY_MS + SECOND_MS));
    await expectNotFound(page, `#/m/${museum.shareToken}`);
    expect(await page.locator('body').innerText()).toBe(wrongText);
    expect(await page.locator('#root').innerHTML()).toBe(wrongHtml);
    expect(await page.title()).toBe(wrongTitle);
    await expect(page.getByText(NOT_FOUND_BODY, { exact: true })).toBeVisible();
  });
});

test.describe('Privacy page (design spec 10, v2.1)', () => {
  test('NFR-16: the retention paragraph says 7 days and a new paragraph straight after it says there are no backups and removal within 24 hours', async ({
    page,
  }) => {
    const problems = trackProblems(page);
    await page.goto('./#/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/privacy/i);
    const retention = page.getByText(PRIVACY_RETENTION, { exact: true });
    await expect(retention).toBeVisible();
    const sentence = page.getByText(PRIVACY_NO_BACKUPS, { exact: true });
    await expect(sentence).toBeVisible();
    // Its own paragraph, immediately after the retention paragraph, under "How long we keep it".
    await expect(retention.locator('xpath=following-sibling::p[1]')).toHaveText(PRIVACY_NO_BACKUPS);
    await expect(retention.locator('xpath=preceding-sibling::h2[1]')).toHaveText(
      'How long we keep it',
    );
    expect(await page.locator('main').innerText()).not.toMatch(/\b90\b/);
    problems.expectClean();
  });
});

test.describe('NFR-16 no 90-day wording is left in the screens a user reads', () => {
  test('home, builder, privacy and not-found show no "90"', async ({ page }) => {
    for (const hash of ['#/', '#/create', '#/privacy', '#/m/abcdefghijklmnopqrstuvwx']) {
      await page.goto(`./${hash}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.locator('body').innerText(), hash).not.toMatch(/\b90[- ]?days?\b|\b90\b/);
    }
  });
});
