import {
  dist,
  layout,
  openVisit,
  snap,
  startVisit,
  teleport,
  waitForScene,
  waitForSnap,
  type PageGlobals,
} from './support/app';
import { expect, test } from './support/fixtures';

/*
 * Epic E3 (US-11, US-15), E2 (US-9, US-10), US-17. Everything runs on the demo backend in the
 * test browser's own IndexedDB. Walking uses real keyboard input; position checks read the scene
 * snapshot hook (src/scene/controllers/testHooks.ts).
 */

test.describe('US-11 open the link and start', () => {
  test('US-11 AC-1: welcome screen shows the title, For <name> and Start', async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A museum for Alex');
    await expect(page.getByText('For Alex', { exact: true })).toBeVisible();
    await expect(page.getByText('Your guide today: Sam')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test('US-11 AC-2 and US-32 AC-1: Start has focus and Enter starts', async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeFocused();
    await page.keyboard.press('Enter');
    await waitForScene(page);
    await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
    // Focus lands on the scene so the keyboard works at once.
    await expect(page.locator('.scene-root')).toBeFocused();
  });

  test('US-11 AC-3 and US-9 AC-1: after Start the Visitor is at the entrance with the Guide beside her', async ({
    page,
    museum,
  }) => {
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    const s = await snap(page);
    const l = await layout(page);
    expect(dist(s.visitor, l.spawn)).toBeLessThan(0.3);
    expect(dist(s.visitor, s.guide)).toBeLessThan(2);
    expect(s.guide.mode).toBe('follow');
    expect(s.labels.visitor || s.labels.guide).toBe(true);
    expect(l.rooms[0]?.kind).toBe('entrance');
    // She can move at once.
    await page.keyboard.down('w');
    await waitForSnap(page, (n) => n.visitor.z < s.visitor.z - 0.4, 10_000, 'the Visitor to walk forward');
    await page.keyboard.up('w');
  });

  test('US-11 AC-4: there is no Next button and no required order', async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await startVisit(page);
    await expect(page.getByRole('button', { name: /^next/i })).toHaveCount(0);
    // Picture 3 (the far one) can be approached first: the Guide presents it, not photo 1.
    const l = await layout(page);
    const third = l.slots[2]!;
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtPhoto(2));
    const s = await waitForSnap(page, (n) => n.intent === `photo:${third.photoId}`, 15_000, 'photo 3 to be presented first');
    expect(s.intent).toBe(`photo:${third.photoId}`);
    await expect(page.locator('.caption-card')).toContainText('Caption three.');
  });

  test('US-11 AC-5: no audio element exists or plays before or after Start (MVP has no sound)', async ({
    page,
    museum,
  }) => {
    await openVisit(page, museum.shareToken);
    expect(await page.locator('audio, video').count()).toBe(0);
    await startVisit(page);
    expect(await page.locator('audio, video').count()).toBe(0);
  });

  test('US-11 AC-6 (partial): the welcome screen is interactive quickly on a local server', async ({
    page,
    museum,
  }) => {
    // Not a 4G measurement: real-network timing is "not verified" in docs/qa-report.md.
    const t0 = Date.now();
    await openVisit(page, museum.shareToken);
    await expect(page.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  test('US-11 and US-17: the welcome title falls back to "A museum for <Visitor>" and shows names exactly as typed (US-4 AC-3, AC-4)', async ({
    page,
  }) => {
    const { createMuseum } = await import('./support/app');
    const made = await createMuseum(page, { photos: 1, visitorName: 'Zoë', guideName: 'Sam 🎈' });
    await openVisit(page, made.shareToken);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A museum for Zoë');
    await expect(page.getByText('Your guide today: Sam 🎈')).toBeVisible();
    await startVisit(page);
    // The names are in the scene's accessible description and the caption card (see presentation spec).
    await expect(page.locator('.scene-root')).toHaveAttribute('aria-label', /A museum for Zoë/);
  });
});

test.describe('US-15 move around the museum', () => {
  test.beforeEach(async ({ page, museum }) => {
    await openVisit(page, museum.shareToken);
    await startVisit(page);
  });

  for (const [key, axis, sign] of [
    ['w', 'z', -1],
    ['ArrowUp', 'z', -1],
    ['s', 'z', 1],
    ['ArrowDown', 'z', 1],
    ['d', 'x', 1],
    ['ArrowRight', 'x', 1],
    ['a', 'x', -1],
    ['ArrowLeft', 'x', -1],
  ] as const) {
    test(`US-15 AC-2: ${key} moves the character ${axis === 'z' ? (sign < 0 ? 'forward' : 'back') : sign > 0 ? 'right' : 'left'}`, async ({
      page,
    }) => {
      // Start mid-hall so walking backwards or sideways has room.
      await teleport(page, 0, -3.8);
      const before = await snap(page);
      await page.keyboard.down(key);
      await waitForSnap(page, (n) => (n.visitor[axis] - before.visitor[axis]) * sign > 0.4, 12_000, `${key} to move`);
      await page.keyboard.up(key);
    });
  }

  test('US-15 AC-3: walking into a partition wall stops the character', async ({ page }) => {
    // x = 3 is outside the 2.4 m doorway, so the wall at z = -7.5 blocks the way forward.
    await teleport(page, 3, -5.5);
    await page.keyboard.down('w');
    await waitForSnap(page, (n) => n.visitor.z < -6.4, 15_000, 'to reach the wall');
    await page.waitForTimeout(2500);
    const s = await snap(page);
    await page.keyboard.up('w');
    expect(s.visitor.z).toBeGreaterThan(-7.5);
    expect(s.visitor.speed).toBeLessThan(0.3);
  });

  test('US-15 AC-3: she walks through the doorway but not through the wall beside it', async ({ page }) => {
    await teleport(page, 0, -5.5);
    await page.keyboard.down('w');
    await waitForSnap(page, (n) => n.visitor.z < -8.5, 20_000, 'to pass the doorway');
    await page.keyboard.up('w');
  });

  test('US-15 AC-4: she cannot leave the museum at the side or back walls', async ({ page }) => {
    await teleport(page, 0, -4);
    await page.keyboard.down('d');
    await page.waitForTimeout(5500);
    await page.keyboard.up('d');
    let s = await snap(page);
    expect(s.visitor.x).toBeLessThan(4);
    expect(s.visitor.x).toBeGreaterThan(3);
    await page.keyboard.down('s');
    await page.waitForTimeout(4500);
    await page.keyboard.up('s');
    s = await snap(page);
    expect(s.visitor.z).toBeLessThanOrEqual(0);
    expect(s.visitor.z).toBeGreaterThan(-1);
  });

  test('US-15 AC-4: the walls hold when jumping to the last picture then walking on past the finale', async ({
    page,
  }) => {
    const l = await layout(page);
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await page.keyboard.down('w');
    await page.waitForTimeout(4000);
    await page.keyboard.up('w');
    const s = await snap(page);
    const finaleRoom = l.rooms[l.rooms.length - 1]!;
    expect(s.visitor.z).toBeGreaterThan(finaleRoom.minZ);
  });

  test('US-15 AC-5: dragging with the mouse rotates the camera, Reset view restores it', async ({ page }) => {
    const before = await snap(page);
    const box = (await page.locator('.scene-root').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.4;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 220, cy, { steps: 12 });
    await page.mouse.up();
    const after = await waitForSnap(page, (n) => Math.abs(n.camera.yaw - before.camera.yaw) > 0.2, 8_000, 'camera yaw to change');
    // The Visitor did not walk: dragging only turns the camera.
    expect(dist(after.visitor, before.visitor)).toBeLessThan(0.2);
    expect(after.camera.offDefault).toBe(true);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await waitForSnap(page, (n) => !n.camera.offDefault, 8_000, 'the view to reset');
  });

  test('US-15 AC-5: Q and E turn the view from the keyboard', async ({ page }) => {
    const before = await snap(page);
    await page.keyboard.down('e');
    await page.waitForTimeout(700);
    await page.keyboard.up('e');
    const after = await snap(page);
    expect(Math.abs(after.camera.yaw - before.camera.yaw)).toBeGreaterThan(0.1);
  });

  test('US-10 AC-1: both characters carry a name label while on screen', async ({ page }) => {
    const s = await waitForSnap(page, (n) => n.labels.visitor && n.labels.guide, 10_000, 'both labels visible');
    expect(s.labels).toEqual({ visitor: true, guide: true });
    await expect(page.locator('.scene-root').getByText('Alex', { exact: true })).toBeVisible();
    await expect(page.locator('.scene-root').getByText('Sam', { exact: true })).toBeVisible();
  });

  test('US-10 AC-5: walking plays the walk animation, standing still plays idle', async ({ page }) => {
    await page.keyboard.down('w');
    await waitForSnap(page, (n) => n.visitor.locomotion === 'walk', 10_000, 'walk animation');
    await page.keyboard.up('w');
    await waitForSnap(page, (n) => n.visitor.locomotion === 'idle', 10_000, 'idle animation');
  });
});

test('US-17 AC-1: the generated museum has an entrance, a gallery and a finale, with pictures in order', async ({
  page,
  museum,
}) => {
  await openVisit(page, museum.shareToken);
  await startVisit(page);
  const l = await layout(page);
  expect(l.rooms.map((r) => r.kind)).toEqual(['entrance', 'gallery', 'finale']);
  expect(l.slots).toHaveLength(4);
  // Order runs from the entrance to the finale: z decreases (or stays within a row) along the route.
  const zs = l.slots.map((s) => s.zone.z);
  expect([...zs].sort((a, b) => b - a)).toEqual(zs);
  // No two pictures share a zone.
  const keys = new Set(l.slots.map((s) => `${s.zone.x},${s.zone.z}`));
  expect(keys.size).toBe(4);
  // Left and right walls alternate.
  expect(l.slots.map((s) => s.wall)).toEqual(['left', 'right', 'left', 'right']);
  // Every picture has loaded or has a placeholder status (never missing).
  const s = await waitForSnap(page, (n) => Object.values(n.photoStatus).every((v) => v === 'loaded'), 20_000, 'photos to load');
  expect(Object.keys(s.photoStatus)).toHaveLength(4);
});
