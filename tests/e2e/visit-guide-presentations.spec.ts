import {
  dist,
  FACE_LEFT_WALL,
  FACE_RIGHT_WALL,
  layout,
  openVisit,
  snap,
  startVisit,
  teleport,
  waitForSnap,
  type Layout,
  type PageGlobals,
  type Snap,
} from './support/app';
import { expect, test } from './support/fixtures';

/*
 * Epic E4: US-12, US-13, US-14, US-42. Distances are the PM's starting values (3 m, 4.5 m, 1 s),
 * measured in the scene's simulation time (`snapshot().time`), not wall-clock time, so a slow
 * software renderer does not change the result.
 */

/** Somewhere in the entrance hall, more than 4.5 m from every picture and not behind its wall. */
const AWAY = { x: 0, z: -3.5 };

const photoIntent = (l: Layout, index: number) => `photo:${l.slots[index]!.photoId}`;

/** Stand at the picture's standing spot facing its wall. */
async function standBeside(page: Parameters<typeof teleport>[0], l: Layout, index: number) {
  const slot = l.slots[index]!;
  await teleport(page, slot.standingSpot.x, slot.standingSpot.z, slot.wall === 'left' ? FACE_LEFT_WALL : FACE_RIGHT_WALL);
}

/** Open the shared 4-photo museum and press Start. */
const enter = async (page: Parameters<typeof teleport>[0], token: string) => {
  await openVisit(page, token);
  await startVisit(page);
};

test.describe('US-12 the Guide presents a picture', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-12 AC-1: stay within 3 m for 1 s, the Guide walks beside her and the caption panel opens under the Guide name', async ({
    page,
  }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    const t0 = (await snap(page)).time;
    const s = await waitForSnap(page, (n) => n.intent === photoIntent(l, 0), 15_000, 'presentation to start');
    // Not before about a second of dwell, and not long after.
    expect(s.time - t0).toBeGreaterThan(0.85);
    expect(s.time - t0).toBeLessThan(2.6);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 20_000, 'the Guide to arrive');
    const card = page.locator('.caption-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { level: 2 })).toHaveText('Sam');
    await expect(card).toContainText('Photo 1 of 4');
    await expect(card).toContainText('Caption one: a day at the beach.');
    // The Guide stands beside her, near the picture, and within a few metres of the Visitor.
    const g = await snap(page);
    expect(dist(g.guide, g.visitor)).toBeLessThan(3.2);
  });

  test('US-12 AC-1: nothing is presented while she is outside 3 m', async ({ page }) => {
    const l = await layout(page);
    const slot = l.slots[0]!;
    // 3.6 m from the picture's zone point, facing the wall.
    await teleport(page, slot.zone.x + 3.6, slot.zone.z, FACE_LEFT_WALL);
    const t0 = (await snap(page)).time;
    await waitForSnap(page, (n) => n.time - t0 > 3, 15_000, 'three simulated seconds');
    expect((await snap(page)).intent).toBe('none');
    await expect(page.locator('.caption-card')).toHaveCount(0);
  });

  test('US-12 AC-2: moving more than 4.5 m away closes the panel and the Guide follows again', async ({ page }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'to be presenting');
    await expect(page.locator('.caption-card')).toBeVisible();
    await teleport(page, AWAY.x, AWAY.z, FACE_LEFT_WALL);
    await waitForSnap(page, (n) => n.intent === 'none', 8_000, 'the presentation to end');
    await expect(page.locator('.caption-card')).toHaveCount(0);
    await waitForSnap(page, (n) => n.guide.mode === 'follow', 10_000, 'the Guide to follow again');
  });

  test('US-12 AC-2: dismissing the panel closes it and the Guide follows again', async ({ page }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'to be presenting');
    await page.getByRole('button', { name: 'Close caption' }).click();
    await expect(page.locator('.caption-card')).toHaveCount(0);
    await waitForSnap(page, (n) => n.guide.mode === 'follow', 10_000, 'the Guide to follow again');
    // It does not re-open at once while she stays in the zone.
    const t0 = (await snap(page)).time;
    await waitForSnap(page, (n) => n.time - t0 > 3, 15_000, 'three simulated seconds');
    await expect(page.locator('.caption-card')).toHaveCount(0);
  });

  test('US-12 AC-2 (keyboard): Escape dismisses the presentation', async ({ page }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'to be presenting');
    await page.locator('.scene-root').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.caption-card')).toHaveCount(0);
  });

  test('US-12 AC-3: between 3 m and 4.5 m the presentation stays open (no flicker), and closes beyond 4.5 m', async ({
    page,
  }) => {
    const l = await layout(page);
    const slot = l.slots[0]!;
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'to be presenting');
    // Teleporting resets the director, so walk (real movement) to 3.8 m from the picture: outside
    // the 3 m start radius, inside the 4.5 m end radius.
    const walking = page.evaluate(
      ([x, z]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.walkVisitorTo(x as number, z as number, 30_000),
      [slot.zone.x + 3.8, slot.standingSpot.z] as const,
    );
    let arrived = false;
    void walking.then(() => (arrived = true));
    const seen = new Set<string>();
    while (!arrived) {
      seen.add((await snap(page)).intent);
      await page.waitForTimeout(100);
    }
    const t0 = (await snap(page)).time;
    while ((await snap(page)).time - t0 < 3) {
      seen.add((await snap(page)).intent);
      await page.waitForTimeout(100);
    }
    expect([...seen], 'intents seen between 3 m and 4.5 m').toEqual([photoIntent(l, 0)]);
    await expect(page.locator('.caption-card')).toBeVisible();
    // Further out than 4.5 m it closes.
    await page.evaluate(
      ([x, z]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.walkVisitorTo(x as number, z as number, 30_000),
      [slot.zone.x + 5.2, slot.standingSpot.z] as const,
    );
    await waitForSnap(page, (n) => n.intent === 'none', 8_000, 'the presentation to close');
  });

  test('US-12 AC-4: a picture with no caption still gets the Guide beside her but no panel', async ({ page }) => {
    const l = await layout(page);
    await standBeside(page, l, 1); // photo 2 has no caption
    await waitForSnap(page, (n) => n.intent === photoIntent(l, 1), 20_000, 'a presentation');
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'the Guide to arrive');
    await expect(page.locator('.caption-card')).toHaveCount(0);
    const s = await snap(page);
    expect(dist(s.guide, s.visitor)).toBeLessThan(3.2);
  });

  test('US-12 AC-6: no presentation starts for a picture on the far side of a wall, even within 3 m', async ({
    page,
  }) => {
    const l = await layout(page);
    const slot = l.slots[0]!; // left wall, 2.5 m into the gallery
    // In the entrance hall, against the partition: under 3 m from the zone point but behind the wall.
    const px = slot.zone.x + 0.3;
    const pz = -7.2;
    expect(Math.hypot(px - slot.zone.x, pz - slot.zone.z)).toBeLessThan(3);
    await teleport(page, px, pz, FACE_LEFT_WALL);
    const t0 = (await snap(page)).time;
    await waitForSnap(page, (n) => n.time - t0 > 3, 15_000, 'three simulated seconds');
    expect((await snap(page)).intent).toBe('none');
    await expect(page.locator('.caption-card')).toHaveCount(0);
  });
});

test.describe('US-13 moving between pictures quickly', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-13 AC-1: walking past and leaving in under 1 s starts nothing', async ({ page }) => {
    const l = await layout(page);
    const slot = l.slots[0]!;
    // Enter the zone and leave again about 0.4 s later, inside one page call so the timing is exact.
    await page.evaluate(
      async ([ix, iz, ox, oz, h]) => {
        const hooks = (globalThis as unknown as PageGlobals).__surpriseMuseum!;
        hooks.teleportVisitor(ix as number, iz as number, h as number);
        await new Promise((resolve) => setTimeout(resolve, 400));
        hooks.teleportVisitor(ox as number, oz as number, h as number);
      },
      [slot.standingSpot.x, slot.standingSpot.z, AWAY.x, AWAY.z, FACE_LEFT_WALL] as const,
    );
    const t0 = (await snap(page)).time;
    const seen = new Set<string>();
    const modes = new Set<string>();
    while ((await snap(page)).time - t0 < 2.5) {
      const s = await snap(page);
      seen.add(s.intent);
      modes.add(s.guide.mode);
      await page.waitForTimeout(100);
    }
    expect([...seen]).toEqual(['none']);
    expect(modes.has('approach')).toBe(false);
    expect(modes.has('present')).toBe(false);
  });

  test('US-13 AC-2: presenting A, then staying 1 s at B, switches to B', async ({ page }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'A to be presenting');
    await expect(page.locator('.caption-card')).toContainText('Caption one');
    await standBeside(page, l, 2);
    await waitForSnap(page, (n) => n.intent === photoIntent(l, 2), 15_000, 'B to be presented');
    await expect(page.locator('.caption-card')).toHaveCount(1);
    await expect(page.locator('.caption-card')).toContainText('Caption three.');
  });

  test('US-13 AC-3: within two zones, only the nearest picture is presented and there is one panel', async ({
    page,
  }) => {
    const l = await layout(page);
    const a = l.slots[0]!.zone;
    const c = l.slots[2]!.zone; // same wall, 5 m further on
    // 2.2 m from A's zone point and about 3 m from C's: inside both 3 m radii only if close; nudge towards A.
    const x = a.x + 1.0;
    const z = a.z - 2.0;
    const toA = Math.hypot(x - a.x, z - a.z);
    const toC = Math.hypot(x - c.x, z - c.z);
    expect(toA).toBeLessThan(toC);
    expect(toC).toBeLessThan(3.6);
    await teleport(page, x, z, FACE_LEFT_WALL);
    await waitForSnap(page, (n) => n.intent !== 'none', 15_000, 'a presentation');
    expect((await snap(page)).intent).toBe(photoIntent(l, 0));
    await page.waitForTimeout(1500);
    expect((await snap(page)).intent).toBe(photoIntent(l, 0));
    await expect(page.locator('.caption-card')).toHaveCount(1);
  });

  test('US-13 AC-4: leave and return, the picture is presented again', async ({ page }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'first presentation');
    await teleport(page, AWAY.x, AWAY.z, FACE_LEFT_WALL);
    await waitForSnap(page, (n) => n.intent === 'none', 8_000, 'it to close');
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.intent === photoIntent(l, 0), 15_000, 'second presentation');
    await expect(page.locator('.caption-card')).toBeVisible();
  });
});

test.describe('US-14 the finale and the closing message', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-14 AC-1 and US-5 AC-3: stepping on the podium shows the closing message, line breaks kept', async ({
    page,
  }) => {
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    const card = page.locator('.finale-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { level: 2 })).toHaveText('A note from Sam');
    const text = card.locator('.finale-card__text');
    // Text and line breaks exactly as written (including the blank line).
    expect(await text.textContent()).toBe('Dear Alex,\nThank you for visiting.\n\nLove, Sam');
    await expect(text).toHaveCSS('white-space', /^pre/);
    await expect(page.getByRole('button', { name: 'Keep exploring' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replay from the start' })).toBeVisible();
    // The Guide stands beside her.
    const s = await waitForSnap(page, (n) => n.finaleReached, 10_000, 'the finale signal');
    expect(dist(s.guide, s.visitor)).toBeLessThan(4);
  });

  test('US-14 AC-3: Keep exploring closes the panel and she can move freely', async ({ page }) => {
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await page.getByRole('button', { name: 'Keep exploring' }).click();
    await expect(page.locator('.finale-card')).toHaveCount(0);
    const before = await snap(page);
    await page.locator('.scene-root').focus();
    await page.keyboard.down('d');
    await waitForSnap(page, (n) => Math.abs(n.visitor.x - before.visitor.x) > 0.3, 12_000, 'her to move');
    await page.keyboard.up('d');
    await expect(page.locator('.finale-card')).toHaveCount(0);
  });

  test('US-14 AC-4: after Keep exploring it stays closed; leaving the podium zone and stepping in again presents it again', async ({
    page,
  }) => {
    const l = await layout(page);
    const walk = (x: number, z: number) =>
      page.evaluate(
        ([px, pz]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.walkVisitorTo(px as number, pz as number, 40_000),
        [x, z] as const,
      );
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await page.getByRole('button', { name: 'Keep exploring' }).click();
    await expect(page.locator('.finale-card')).toHaveCount(0);
    // Still on the podium: it must not re-open on its own.
    const t0 = (await snap(page)).time;
    await waitForSnap(page, (n) => n.time - t0 > 2.5, 15_000, 'a few simulated seconds');
    await expect(page.locator('.finale-card')).toHaveCount(0);
    // Out past radius + 1 m, then back in.
    expect(await walk(l.finale.x, l.finale.z + l.finale.triggerRadius + 1.6)).toBe(true);
    await expect(page.locator('.finale-card')).toHaveCount(0);
    expect(await walk(l.finale.x, l.finale.z + 0.3)).toBe(true);
    await expect(page.locator('.finale-card')).toBeVisible({ timeout: 10_000 });
  });

  test('US-14 AC-2 and US-35 AC-3: Replay returns both to the entrance and clears the viewed count', async ({
    page,
  }) => {
    const l = await layout(page);
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'a presentation');
    await expect(page.getByText('1 of 4 pictures viewed')).toBeAttached();
    await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
    await page.getByRole('button', { name: 'Replay from the start' }).click();
    await expect(page.locator('.finale-card')).toHaveCount(0);
    const s = await waitForSnap(page, (n) => dist(n.visitor, l.spawn) < 0.6, 10_000, 'her to be at the entrance');
    expect(dist(s.guide, s.visitor)).toBeLessThan(2.5);
    await expect(page.getByText('0 of 4 pictures viewed')).toBeAttached();
  });
});

test('US-14 AC-5 and US-5 AC-2: a blank closing message shows "The end" with the same options', async ({ page }) => {
  const { createMuseum } = await import('./support/app');
  const made = await createMuseum(page, { photos: 1, closingMessage: '' });
  await enter(page, made.shareToken);
  await page.evaluate(() => (globalThis as unknown as PageGlobals).__surpriseMuseum!.standAtFinale());
  const card = page.locator('.finale-card');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('The end');
  await expect(card).toContainText('Thanks for visiting, Alex.');
  await expect(page.getByRole('button', { name: 'Keep exploring' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay from the start' })).toBeVisible();
});

test.describe('US-42 the Guide follows and stays out of the way', () => {
  test.beforeEach(async ({ page, museum }) => enter(page, museum.shareToken));

  test('US-42 AC-1: while she walks the Guide stays within about 5 m, and when she stops it idles nearby', async ({
    page,
  }) => {
    await page.locator('.scene-root').focus();
    await page.keyboard.down('w');
    let worst = 0;
    const t0 = (await snap(page)).time;
    while ((await snap(page)).time - t0 < 4) {
      const s = await snap(page);
      worst = Math.max(worst, dist(s.guide, s.visitor));
      await page.waitForTimeout(200);
    }
    await page.keyboard.up('w');
    expect(worst).toBeLessThan(5.2);
    const idle = await waitForSnap(page, (n) => n.guide.locomotion === 'idle', 15_000, 'the Guide to idle');
    expect(dist(idle.guide, idle.visitor)).toBeLessThan(5.2);
  });

  test('US-42 AC-2: while presenting the Guide is not between the Visitor and the picture', async ({ page }) => {
    const l = await layout(page);
    const slot = l.slots[0]!;
    await standBeside(page, l, 0);
    await waitForSnap(page, (n) => n.guide.mode === 'present', 25_000, 'the Guide to arrive');
    const s = await snap(page);
    // The picture is on the left wall (x = zone.x). The Guide must not sit on the segment from the
    // Visitor to the picture: compare the Guide's distance to that segment.
    const ax = s.visitor.x;
    const az = s.visitor.z;
    const bx = slot.zone.x;
    const bz = slot.zone.z;
    const t = Math.max(0, Math.min(1, ((s.guide.x - ax) * (bx - ax) + (s.guide.z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    const d = Math.hypot(s.guide.x - (ax + t * (bx - ax)), s.guide.z - (az + t * (bz - az)));
    expect(d).toBeGreaterThan(0.45);
  });

  test('US-42 AC-4: if the Guide is more than 8 m away it reappears beside her', async ({ page }) => {
    const l = await layout(page);
    await teleport(page, l.finale.x, l.finale.z + 2.5, Math.PI);
    const s = await waitForSnap(page, (n) => dist(n.guide, n.visitor) < 5.5, 15_000, 'the Guide to catch up or reappear');
    expect(dist(s.guide, s.visitor)).toBeLessThan(5.5);
  });

  test('US-42 AC-5: the Guide never ends inside a wall while following a long walk', async ({ page }) => {
    const l = await layout(page);
    const samples: Snap[] = [];
    const walk = page.evaluate(
      ([x, z]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.walkVisitorTo(x as number, z as number, 60_000),
      [l.slots[3]!.standingSpot.x, l.slots[3]!.standingSpot.z] as const,
    );
    let done = false;
    void walk.then(() => (done = true));
    while (!done) {
      samples.push(await snap(page));
      await page.waitForTimeout(250);
    }
    expect(samples.length).toBeGreaterThan(5);
    for (const s of samples) {
      // Outer walls at +/-4 (inner face 3.9), back wall at z = 0 and the far wall of the finale room.
      expect(Math.abs(s.guide.x)).toBeLessThan(3.95);
      expect(s.guide.z).toBeLessThanOrEqual(0.05);
    }
  });
});

test('US-42 AC-6 and US-32 AC-2: with reduced motion the Guide fades in beside her instead of walking across', async ({
  page,
  museum,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page, museum.shareToken);
  const l = await layout(page);
  await standBeside(page, l, 0);
  const samples: Snap[] = [];
  const t0 = (await snap(page)).time;
  let last = await snap(page);
  while (last.time - t0 < 4) {
    samples.push(last);
    await page.waitForTimeout(50);
    last = await snap(page);
  }
  expect(last.guide.mode).toBe('present');
  // While approaching, the Guide never plays the walk animation, and it fades (opacity dips).
  const approaching = samples.filter((s) => s.guide.mode === 'approach');
  expect(approaching.some((s) => s.guide.locomotion === 'walk')).toBe(false);
  expect(Math.min(...samples.map((s) => s.guide.opacity))).toBeLessThan(0.9);
  expect(dist(last.guide, last.visitor)).toBeLessThan(3.2);
  // The camera never moved on its own.
  expect(last.camera.offDefault).toBe(false);
});
