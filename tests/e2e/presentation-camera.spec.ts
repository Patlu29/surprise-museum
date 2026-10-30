import { expect, test } from './support/fixtures';
import { layout, snap, waitForSnap, type PageGlobals } from './support/app';
import {
  bottom,
  cardInfo,
  enterVisit,
  intersects,
  leavePicture,
  pc,
  readRecording,
  right,
  sceneRects,
  standAndFrame,
  startRecording,
  VIEWPORTS,
  type CamRecord,
} from './support/presentation';

/*
 * CR-2: the presentation camera (design spec 6.12, v1.3 and v1.4). Read through the documented hooks:
 * `snapshot().presentationCamera`, `data-presentation-camera`, the `surprise-museum:presentation-camera`
 * event and the scene's published rectangles. Tolerances are the tech lead's (docs/project-status.md):
 * pictureVisibleFraction at least 0.98 on 390x844, 0.99 on 360x640 and 1280x720, 0.90 on 844x390.
 * Times are wall-clock in software WebGL, so timing checks leave room for a slow frame.
 */

/**
 * Peak turning speed of an eased move, in degrees per second, derived from the hook: `--ease-camera` is
 * cubic-bezier(0.37, 0, 0.63, 1) (sine-like), whose steepest slope is about 1.57 times the average. The swing is
 * the yaw offset because the Visitor was put facing the picture with the camera behind (standAtPhoto), so the
 * follow view looks straight at the wall. This is derived from `yawOffsetDeg` and `lastMove*Ms`, not measured
 * from frames: the hook does not expose the shown yaw (see the QA report).
 */
const peakYawSpeed = (swingDeg: number, ms: number) => (Math.abs(swingDeg) / (ms / 1000)) * 1.5708;

const MOVING_MODES = ['entering', 'pending', 'returning'];

/** First sample index where `pick` is true, or -1. */
const firstIndex = (rec: CamRecord, pick: (s: CamRecord['samples'][number]) => boolean) => rec.samples.findIndex(pick);

for (const vp of VIEWPORTS) {
  test.describe(`CR-2 presentation camera at ${vp.name}`, () => {
    test.setTimeout(240_000);

    test(`CR-2 framed at ${vp.name}: all four pictures (both walls, landscape, portrait, square) are framed with the whole picture visible`, async ({
      page,
      museum,
      problems,
    }, testInfo) => {
      await enterVisit(page, museum.shareToken, vp);
      const results: Array<Record<string, unknown>> = [];
      for (let i = 0; i < 4; i++) {
        const s = await standAndFrame(page, i);
        const cam = s.presentationCamera;
        // Rectangles are published once the presentation is on (the Guide has arrived): wait for them.
        await expect.poll(async () => (await sceneRects(page)).picture !== null, { timeout: 15_000, message: 'the picture rectangle is published' }).toBe(true);
        const rects = await sceneRects(page);
        results.push({ picture: i + 1, mode: cam.mode, visible: cam.pictureVisibleFraction, yaw: cam.yawOffsetDeg, inMs: cam.lastMoveInMs, dropped: cam.guideDropped });
        expect(cam.fallback, `picture ${i + 1} fell back to the follow camera`).toBe(false);
        expect(cam.pictureVisibleFraction, `picture ${i + 1} visible fraction`).toBeGreaterThanOrEqual(vp.minVisible);
        // The picture is never cropped: its rectangle is inside the viewport.
        expect(rects.picture, 'the picture rectangle is published').not.toBeNull();
        const p = rects.picture!;
        expect(p.x, 'picture left').toBeGreaterThanOrEqual(0);
        expect(p.y, 'picture top').toBeGreaterThanOrEqual(0);
        expect(right(p), 'picture right').toBeLessThanOrEqual(vp.width);
        expect(bottom(p), 'picture bottom').toBeLessThanOrEqual(vp.height);
        // Yaw offsets are 35, 45 or 52 degrees, never more; the move is one move of 0.8 to 1.3 s.
        expect(Math.abs(cam.yawOffsetDeg)).toBeGreaterThanOrEqual(35);
        expect(Math.abs(cam.yawOffsetDeg)).toBeLessThanOrEqual(52);
        expect(cam.lastMoveInMs).toBeGreaterThanOrEqual(800);
        expect(cam.lastMoveInMs).toBeLessThanOrEqual(1300);
        // Calm rule (6.12.9): peak turning speed at most 80 degrees per second moving in.
        expect(peakYawSpeed(cam.yawOffsetDeg, cam.lastMoveInMs), 'derived peak yaw speed in').toBeLessThanOrEqual(80);
        await leavePicture(page);
      }
      testInfo.annotations.push({ type: 'framed-per-picture', description: JSON.stringify(results) });
      await testInfo.attach('framed-results.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      problems.expectClean();
    });

    test(`CR-2 card timing at ${vp.name}: absent while the camera is moving, present once settled and the Guide has arrived (within 1.5 s), and no veil on an ordinary swing`, async ({
      page,
      museum,
    }, testInfo) => {
      await enterVisit(page, museum.shareToken, vp);
      await startRecording(page);
      await standAndFrame(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(600);
      const rec = await readRecording(page);
      const modes = rec.samples.map((s) => s.mode).filter((m, i, a) => i === 0 || m !== a[i - 1]);
      expect(modes, 'camera mode sequence').toContain('entering');
      expect(modes).toContain('framed');
      const dwellIdx = firstIndex(rec, (s) => s.intent.startsWith('photo:'));
      const settledIdx = firstIndex(rec, (s) => s.mode === 'framed');
      const arrivedIdx = firstIndex(rec, (s) => s.presentation === 'photo');
      const cardIdx = firstIndex(rec, (s) => s.card);
      expect(dwellIdx).toBeGreaterThanOrEqual(0);
      expect(cardIdx).toBeGreaterThan(settledIdx);
      const t = (i: number) => rec.samples[i]!.t;
      // Never while the camera is moving (entering, pending or returning), unless the 1.5 s cap has passed.
      const early = rec.samples.filter((s) => s.card && MOVING_MODES.includes(s.mode) && s.t - t(arrivedIdx) < 1400);
      expect(early, 'the card must not show while the camera is entering').toEqual([]);
      const dwellToCard = t(cardIdx) - t(dwellIdx);
      const laterOfSettledAndArrived = Math.max(t(settledIdx), t(arrivedIdx));
      testInfo.annotations.push(
        { type: 'dwell-complete-to-card-ms', description: String(Math.round(dwellToCard)) },
        { type: 'dwell-to-camera-framed-ms', description: String(Math.round(t(settledIdx) - t(dwellIdx))) },
        { type: 'dwell-to-guide-arrived-ms', description: String(Math.round(t(arrivedIdx) - t(dwellIdx))) },
        { type: 'later-of-settled-and-arrived-to-card-ms', description: String(Math.round(t(cardIdx) - laterOfSettledAndArrived)) },
      );
      expect(t(cardIdx) - laterOfSettledAndArrived, 'the card appears within 1.5 s of the later of settled and arrived').toBeLessThanOrEqual(1500);
      // An ordinary swing uses no veil.
      expect(rec.veilMax, 'no veil on a swing of 60 degrees or less').toBe(0);
      expect(rec.veilElementSeen).toBe(false);
      // The card, once placed, does not overlap the picture (grown 8 px) or either character (spec 3.5, S5, S7).
      const card = (await cardInfo(page))!;
      const rects = await sceneRects(page);
      expect(rects.picture).not.toBeNull();
      expect(intersects(card.rect, rects.picture!, 8), `card ${JSON.stringify(card.rect)} overlaps the picture ${JSON.stringify(rects.picture)}`).toBe(false);
      for (const who of ['visitor', 'guide'] as const) {
        const r = rects[who];
        if (r) expect(intersects(card.rect, r), `card overlaps the ${who}`).toBe(false);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Release, return, reduced motion and the veil. 390x844 (phone portrait) and 1280x720 (wide).
// ---------------------------------------------------------------------------------------------

const BEHAVIOUR_VIEWPORTS = VIEWPORTS.filter((v) => v.name === '390x844' || v.name === '1280x720');

for (const vp of BEHAVIOUR_VIEWPORTS) {
  test.describe(`CR-2 input and return at ${vp.name}`, () => {
    test.setTimeout(240_000);

    test(`CR-2 release at ${vp.name}: movement releases the camera at once, the presentation carries on, and it does not frame again`, async ({
      page,
      museum,
    }) => {
      await enterVisit(page, museum.shareToken, vp);
      await startRecording(page);
      await standAndFrame(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 15_000 });
      const framedAt = await pc(page);
      expect(framedAt.mode).toBe('framed');
      const eventsBefore = (await readRecording(page)).events.length;
      // Movement past the dead zone (W).
      await page.keyboard.down('w');
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'returning' || s.presentationCamera.mode === 'follow', 5000, 'the camera to release');
      await page.waitForTimeout(400);
      await page.keyboard.up('w');
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'follow', 5000, 'the camera to be back on the follow view');
      const out = await pc(page);
      expect(out.lastMoveOutMs, 'move out is 600 ms, up to 1,000 ms for a big swing').toBeGreaterThanOrEqual(300);
      expect(out.lastMoveOutMs).toBeLessThanOrEqual(1000);
      // The presentation continues: card and Guide stay (until Close or 4.5 m).
      await expect(page.locator('.caption-card')).toBeVisible();
      // And it does not frame this presentation again, even standing still (no tug of war).
      await page.waitForTimeout(2500);
      const after = await readRecording(page);
      const later = after.events.slice(eventsBefore).map((e) => e.mode);
      expect(later, 'no further framing for this presentation').not.toContain('entering');
      expect(later).not.toContain('framed');
      expect((await pc(page)).mode).toBe('follow');
    });

    test(`CR-2 return at ${vp.name}: Escape and Close both ease the camera back, remove the card and end the presentation`, async ({ page, museum }) => {
      await enterVisit(page, museum.shareToken, vp);
      await startRecording(page);
      // Escape
      await standAndFrame(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 15_000 });
      const offset = (await pc(page)).yawOffsetDeg;
      await page.keyboard.press('Escape');
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'returning' || s.presentationCamera.mode === 'follow', 5000, 'the camera to start returning');
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'follow', 5000, 'the camera to return');
      let cam = await pc(page);
      expect(cam.lastMoveOutMs).toBeGreaterThanOrEqual(300);
      expect(cam.lastMoveOutMs).toBeLessThanOrEqual(1000);
      // Calm rule (6.12.9): peak turning speed at most 100 degrees per second moving out (tolerance 101, project-status).
      expect(peakYawSpeed(offset, cam.lastMoveOutMs), 'derived peak yaw speed out').toBeLessThanOrEqual(101);
      await expect(page.locator('.caption-card')).toHaveCount(0);
      expect((await snap(page)).intent, 'the director ended the presentation').toBe('none');
      // The same picture is not presented again while the Visitor stays close (FR-27).
      await page.waitForTimeout(2000);
      expect((await pc(page)).mode).toBe('follow');
      // Close button, on another picture.
      await leavePicture(page);
      await standAndFrame(page, 2);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Close caption' }).click();
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'follow', 6000, 'the camera to return after Close');
      cam = await pc(page);
      expect(cam.lastMoveOutMs).toBeGreaterThanOrEqual(300);
      await expect(page.locator('.caption-card')).toHaveCount(0);
      // Every mode seen on the way was a documented one.
      const rec = await readRecording(page);
      const known = new Set(['follow', 'pending', 'entering', 'framed', 'returning', 'cut']);
      expect(rec.samples.filter((s) => !known.has(s.mode))).toEqual([]);
      expect(rec.samples.some((s) => s.mode === 'returning'), 'the return is an eased move').toBe(true);
    });
  });
}

test.describe('CR-2 reduced motion: the camera cuts, with no ease and no veil', () => {
  test.use({ reducedMotion: 'reduce' });
  test.setTimeout(240_000);

  for (const vp of BEHAVIOUR_VIEWPORTS) {
    test(`CR-2 reduced motion at ${vp.name}: one-frame cut in (mode cut for about 300 ms, then framed), a cut back, no veil`, async ({ page, museum }) => {
      await enterVisit(page, museum.shareToken, vp);
      await startRecording(page);
      await standAndFrame(page, 0);
      await expect(page.locator('.caption-card')).toBeVisible({ timeout: 15_000 });
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'framed', 5000, 'cut to give way to framed');
      let rec = await readRecording(page);
      const modes = rec.samples.map((s) => s.mode).filter((m, i, a) => i === 0 || m !== a[i - 1]);
      expect(modes, 'no eased move in').not.toContain('entering');
      expect(modes).toContain('cut');
      expect(rec.events.map((e) => e.mode)).toContain('cut');
      const cam = await pc(page);
      expect(cam.mode).toBe('framed');
      expect(cam.lastMoveInMs, 'a cut has no duration').toBe(0);
      expect(cam.cutSeq).toBeGreaterThan(0);
      expect(cam.pictureVisibleFraction).toBeGreaterThanOrEqual(vp.minVisible);
      // The camera position changes in one frame: the first sample in `cut` is already at the framed pose,
      // and the sample before it is a long way from it. (An eased move has many samples in between.)
      const cutAt = rec.samples.findIndex((s) => s.mode === 'cut');
      expect(cutAt, 'a cut sample exists after a follow sample').toBeGreaterThan(0);
      const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
      const finalPose = rec.samples[rec.samples.length - 1]!;
      const jump = dist2(rec.samples[cutAt - 1]!, finalPose);
      expect(jump, 'the cut moves the camera').toBeGreaterThan(0.5);
      expect(dist2(rec.samples[cutAt]!, finalPose), 'the first cut frame is at the framed pose').toBeLessThan(0.05 * jump);
      // 'cut' lasts about 300 ms before 'framed'.
      const cutSamples = rec.samples.filter((s) => s.mode === 'cut');
      if (cutSamples.length > 1) {
        const span = cutSamples[cutSamples.length - 1]!.t - cutSamples[0]!.t;
        expect(span).toBeGreaterThan(150);
        expect(span).toBeLessThan(900);
      }
      // No veil under reduced motion.
      expect(rec.veilMax).toBe(0);
      expect(rec.veilElementSeen).toBe(false);
      // Back with a cut.
      await page.keyboard.press('Escape');
      await waitForSnap(page, (s) => s.presentationCamera.mode === 'follow', 6000, 'the camera to cut back');
      rec = await readRecording(page);
      expect(rec.samples.some((s) => s.mode === 'returning'), 'no eased move back').toBe(false);
      expect((await pc(page)).lastMoveOutMs).toBe(0);
      expect(rec.veilMax).toBe(0);
    });
  }
});

test.describe('CR-2 the veil on a big swing', () => {
  test.setTimeout(240_000);

  test('CR-2 veil at 1280x720: a swing over 60 degrees fades through night in about 400 ms, then Reset view is offered on return', async ({
    page,
    museum,
  }, testInfo) => {
    await enterVisit(page, museum.shareToken, { width: 1280, height: 720 });
    const slot = (await layout(page)).slots[0]!;
    const yaw0 = (await snap(page)).camera.yaw;
    // Turn the view well away from the picture with E held (look-around), then walk to the picture so the
    // presentation starts with the view turned. (A teleport would put the camera back behind the Visitor.)
    const turned = () => snap(page).then((x) => Math.abs((((x.camera.yaw - yaw0) * 180) / Math.PI + 540) % 360 - 180));
    await page.keyboard.down('e');
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && (await turned()) < 130) await page.waitForTimeout(100); // until turned about 130 degrees or more
    await page.keyboard.up('e');
    const yaw1 = (await snap(page)).camera.yaw;
    const turnedDeg = Math.abs((((yaw1 - yaw0) * 180) / Math.PI + 540) % 360 - 180);
    testInfo.annotations.push({ type: 'view-turned-deg', description: String(Math.round(turnedDeg)) });
    await startRecording(page);
    const arrived = await page.evaluate(([x, z]) => (globalThis as unknown as PageGlobals).__surpriseMuseum!.walkVisitorTo(x as number, z as number), [slot.standingSpot.x, slot.standingSpot.z] as const);
    expect(arrived, 'the Visitor walked to the picture').toBe(true);
    await waitForSnap(page, (s) => s.presentationCamera.mode === 'framed' && s.presentationCamera.settled, 30_000, 'the camera to frame after the veil');
    const rec = await readRecording(page);
    const cam = await pc(page);
    expect(cam.fallback).toBe(false);
    expect(cam.pictureVisibleFraction).toBeGreaterThanOrEqual(0.99);
    expect(rec.veilMax, 'the veil reached full strength').toBeGreaterThanOrEqual(0.9);
    expect(rec.veilElementSeen, 'the scene draws its own veil element').toBe(true);
    const veilSamples = rec.samples.filter((s) => s.veil > 0);
    const span = veilSamples[veilSamples.length - 1]!.t - veilSamples[0]!.t;
    testInfo.annotations.push({ type: 'veil-span-ms', description: String(Math.round(span)) });
    expect(span, 'about 400 ms in total (200 in, 200 out)').toBeGreaterThan(250);
    expect(span).toBeLessThan(1000);
    // The camera cut: no eased frames of a fast whirl between the two poses.
    expect(cam.mode).toBe('framed');
    // The veil does not intercept input.
    const veilPointer = await page.evaluate(`(() => { const v = globalThis.document.querySelector('[data-testid=camera-veil]'); return v ? { events: globalThis.getComputedStyle(v).pointerEvents, hidden: v.getAttribute('aria-hidden'), opacity: v.style.opacity } : null; })()`);
    expect(veilPointer).toMatchObject({ events: 'none', hidden: 'true' });
    expect(veilPointer && (veilPointer as { opacity: string }).opacity).toBe('0');
    // After a big swing the return does not swing back: Reset view is offered (spec 6.3).
    await expect(page.locator('.caption-card')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await waitForSnap(page, (s) => s.presentationCamera.mode === 'follow', 6000, 'the camera to return');
    await expect(page.getByRole('button', { name: /Reset view/i })).toBeVisible();
  });
});

// Keep the typed global in scope for tests that evaluate in the page.
export type { PageGlobals };
