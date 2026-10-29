import { expect, test } from './support/fixtures';
import { openVisit, startVisit, type PageGlobals } from './support/app';

/*
 * Epic E6: US-23 (link is private), US-24 (delete), US-25 (edit page, MVP is view and delete) and
 * US-30 AC-4 (retry after a failed open). All against the in-browser demo backend.
 */

/** Flip the last character of a token to another valid base64url character. */
function mutate(token: string): string {
  const last = token.slice(-1);
  return token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
}

test.describe('US-23 the link is private', () => {
  test('US-23 AC-1: every page tells search engines not to index it', async ({ page, museum }) => {
    for (const hash of ['#/', `#/m/${museum.shareToken}`, `#/edit/${museum.editToken}`, '#/create']) {
      await page.goto(`./${hash}`);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /nofollow/);
      await expect(page.locator('meta[name=referrer]')).toHaveAttribute('content', 'no-referrer');
    }
  });

  test('US-23 AC-1: link previews expose only generic tags, never museum content', async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Surprise Museum');
    const description = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(description).not.toContain(museum.visitorName);
    expect(description).not.toContain(museum.guideName);
  });

  test('US-23 AC-2 and AC-3: a one-character change shows the friendly "not found" screen and reveals nothing', async ({
    page,
    museum,
  }) => {
    await page.goto(`./#/m/${mutate(museum.shareToken)}`);
    await expect(page.getByRole('heading', { name: "We can't find that museum" })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(museum.visitorName);
    expect(body).not.toContain('Caption');
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
    // No list of other museums, no way to browse.
    await expect(page.locator('li')).toHaveCount(0);
  });

  test('US-23 AC-3: malformed share tokens, an unknown edit token and an unknown route all say "not found"', async ({
    page,
  }) => {
    for (const hash of ['#/m/short', '#/m/%20%20', '#/edit/not-a-real-edit-token', '#/nowhere/at/all']) {
      await page.goto(`./${hash}`);
      await expect(page.getByRole('heading', { name: "We can't find that museum" }), hash).toBeVisible();
    }
  });

  test('US-23 AC-2: the share link never contains the edit token and the edit link is not stored', async ({
    page,
    museum,
  }) => {
    expect(museum.shareUrl).not.toContain(museum.editToken);
    // The edit token lives only in memory: nothing in web storage mentions it.
    await page.goto('./#/');
    const stored = await page.evaluate(
      `JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])`,
    );
    expect(stored as string).not.toContain(museum.editToken);
  });
});

test.describe('US-24 delete my museum, US-25 edit page', () => {
  test('US-25 AC-1 (MVP: view) and AC-3: the edit page shows the museum and the share page has no controls', async ({
    page,
    museum,
  }) => {
    await page.goto(`./#/edit/${museum.editToken}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A museum for Alex');
    await expect(page.getByText('For Alex, guided by Sam. 4 photos.')).toBeVisible();
    await expect(page.locator('.edit-photos img')).toHaveCount(4);
    await expect(page.locator('.edit-photos img').first()).toHaveAttribute('alt', 'Caption one: a day at the beach.');
    // The photo with no caption falls back to "Photo n of N".
    await expect(page.locator('.edit-photos img').nth(1)).toHaveAttribute('alt', 'Photo 2 of 4');
    await expect(page.getByRole('textbox', { name: 'Share link' })).toHaveValue(museum.shareUrl);
    // Visitor view: no editing or deleting controls anywhere.
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await expect(page.getByRole('button', { name: /delete|edit|remove|publish/i })).toHaveCount(0);
  });

  test('US-24 AC-1 and AC-2: Delete needs a second confirmation, then the share link shows "not found"', async ({
    page,
    museum,
  }) => {
    await page.goto(`./#/edit/${museum.editToken}`);
    await page.getByRole('button', { name: 'Delete museum' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this museum for good?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("can't be undone");
    // Safe default: Cancel has focus, and cancelling keeps the museum.
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    // Now delete for real.
    await page.goto(`./#/edit/${museum.editToken}`);
    await page.getByRole('button', { name: 'Delete museum' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete museum' }).click();
    await expect(page.getByRole('heading', { name: 'Your museum has been deleted' })).toBeVisible();
    // The share link now shows the friendly not-found screen at once, and so does the edit link.
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('heading', { name: "We can't find that museum" })).toBeVisible();
    await page.goto(`./#/edit/${museum.editToken}`);
    await expect(page.getByRole('heading', { name: "We can't find that museum" })).toBeVisible();
  });

  test('US-24 AC-1 (keyboard): Escape closes the delete confirmation without deleting', async ({ page, museum }) => {
    await page.goto(`./#/edit/${museum.editToken}`);
    await page.getByRole('button', { name: 'Delete museum' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A museum for Alex');
  });
});

test.describe('US-30 AC-4 a failed open can be retried without reloading', () => {
  test('the "couldn\'t open" screen offers Try again, which recovers in place', async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    await page.evaluate(`window.__noReload = 'still here'`);
    // Put the museum store into the state a dropped connection leaves it in.
    await page.evaluate(
      `globalThis.__APP_TEST__.useMuseumStore.setState({ status: 'error', errorCode: 'network' })`,
    );
    await expect(page.getByRole('heading', { name: "We couldn't open your surprise" })).toBeVisible();
    await expect(page.getByText('connection dropped')).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    expect(await page.evaluate(`window.__noReload`)).toBe('still here');
  });

  test('rate limiting shows its own message', async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
    await page.evaluate(
      `globalThis.__APP_TEST__.useMuseumStore.setState({ status: 'error', errorCode: 'rate_limited' })`,
    );
    await expect(page.getByText(/a lot of tries in a short time/)).toBeVisible();
  });
});

// Keep the typed global in scope for tests that evaluate in the page.
export type { PageGlobals };
