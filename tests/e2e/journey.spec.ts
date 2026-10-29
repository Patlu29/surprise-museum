import { expect, test } from '@playwright/test';
import {
  addPhotos,
  fillWords,
  layout,
  openVisit,
  snap,
  tokenFrom,
  trackProblems,
  waitForScene,
  waitForSnap,
  type PageGlobals,
} from './support/app';
import { makePhotos } from './support/images';

/*
 * The whole gift, end to end, in one browser session, with the console, page errors, failed
 * requests and WebGL warnings checked at the end (no console errors, NFR-11):
 * Creator builds (photos, captions, words, characters) -> previews -> publishes -> opens the edit
 * page -> Visitor opens the share link -> Start -> roams -> the Guide presents -> full-screen
 * viewer -> Pictures list jump -> finale -> Replay. Then the Creator deletes it and the link dies.
 */

test('the full journey: build, preview, publish, visit, roam, present, view, jump, finale, replay, delete', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems = trackProblems(page);
  // No real-time connection of any kind (US-45 AC-3).
  const sockets: string[] = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));

  // ---- Creator -------------------------------------------------------------------------------
  await page.goto('./?e2e=1');
  await page.getByRole('link', { name: 'Create a museum' }).click();
  await addPhotos(page, makePhotos(3));
  const captions = page.getByLabel('Caption (optional)');
  await captions.nth(0).fill('The beach, last summer.');
  await captions.nth(1).fill('Your first bike.');
  await captions.nth(2).fill('Dinner at Nonna’s.');
  await fillWords(page, {
    visitorName: 'Mia',
    guideName: 'Dad',
    title: 'Mia’s 30th',
    closingMessage: 'Happy birthday, Mia.\nLove, Dad',
  });
  // Preview first: the whole visitor experience from the draft.
  await page.getByRole('button', { name: 'Preview' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mia’s 30th');
  await page.getByRole('button', { name: 'Start' }).click();
  await waitForScene(page);
  await page.getByRole('button', { name: 'Exit preview' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Review and publish' })).toBeVisible();
  // Publish.
  await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
  await page.getByRole('button', { name: /Publish museum/ }).click();
  await expect(page.getByRole('heading', { name: 'Your museum is ready' })).toBeVisible({ timeout: 60_000 });
  const share = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  const edit = await page.getByRole('textbox', { name: 'Private edit link' }).inputValue();
  await page.getByRole('checkbox', { name: /saved my edit link/ }).check();
  await page.getByRole('button', { name: 'Finish' }).click();

  // ---- Visitor -------------------------------------------------------------------------------
  await openVisit(page, tokenFrom(share));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mia’s 30th');
  await expect(page.getByText('For Mia', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await waitForScene(page);
  const l = await layout(page);
  // Roam: walk forward through the doorway into the gallery.
  await page.locator('.scene-root').focus();
  await page.keyboard.down('w');
  await waitForSnap(page, (n) => n.visitor.z < -8.2, 30_000, 'her to enter the gallery');
  await page.keyboard.up('w');
  // Walk to the first picture; the Guide comes and presents it.
  await page.evaluate(
    ([x, z]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.walkVisitorTo(x as number, z as number, 60_000),
    [l.slots[0]!.standingSpot.x, l.slots[0]!.standingSpot.z] as const,
  );
  await waitForSnap(page, (n) => n.guide.mode === 'present', 40_000, 'the Guide to present');
  const card = page.locator('.caption-card');
  await expect(card).toContainText('Dad');
  await expect(card).toContainText('The beach, last summer.');
  // Full-screen viewer, then back.
  await page.getByRole('button', { name: /Look closer/i }).click();
  const viewer = page.getByRole('dialog', { name: 'Photo 1 of 3' });
  await expect(viewer).toContainText('The beach, last summer.');
  await expect(page.locator('.viewer__image')).toHaveClass(/is-loaded/);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  // Pictures list: jump to photo 3.
  await page.getByRole('button', { name: 'Pictures' }).click();
  await page.getByRole('dialog', { name: 'Pictures' }).getByRole('button', { name: /Photo 3/ }).click();
  await waitForSnap(page, (n) => n.intent === `photo:${l.slots[2]!.photoId}`, 30_000, 'photo 3 to be presented');
  await expect(card).toContainText('Dinner at Nonna’s.');
  expect((await snap(page)).guide.presentation).toBeDefined();
  // Finale and Replay.
  await page.getByRole('button', { name: 'Pictures' }).click();
  await page.getByRole('dialog', { name: 'Pictures' }).getByRole('button', { name: /Finale/ }).click();
  const finale = page.locator('.finale-card');
  await expect(finale).toContainText('Happy birthday, Mia.');
  await expect(finale).toContainText('Love, Dad');
  await page.getByRole('button', { name: 'Replay from the start' }).click();
  await expect(finale).toHaveCount(0);
  await expect(page.getByText('0 of 3 pictures viewed')).toBeAttached();

  // ---- Creator deletes it --------------------------------------------------------------------
  await page.goto('about:blank');
  await page.goto(`./#/edit/${tokenFrom(edit)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mia’s 30th');
  await page.getByRole('button', { name: 'Delete museum' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete museum' }).click();
  await expect(page.getByRole('heading', { name: 'Your museum has been deleted' })).toBeVisible();
  await openVisit(page, tokenFrom(share));
  await expect(page.getByRole('heading', { name: "We can't find that museum" })).toBeVisible();

  expect(sockets, 'no WebSocket or real-time connection').toEqual([]);
  problems.expectClean();
});
