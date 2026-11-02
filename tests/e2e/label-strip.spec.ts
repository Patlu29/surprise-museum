import { expect, test, type Page } from '@playwright/test';
import { createMuseum } from './support/app';
import { enterVisit, intersects, leavePicture, sceneRects, standAndFrame, type Rect } from './support/presentation';

/*
 * Design spec 5.5 "Framed view, portrait: below the caption strip" (v1.5, BUG-10).
 *   - A label never sits above the strip's bottom edge: 68 px plus the strip height (172, 180, 192).
 *   - It never overlaps the picture.
 *   - It only moves down as far as the edge (no needless shift).
 *   - Landscape and wide are unaffected.
 *   - Eased over --duration-fast, instant under reduced motion (checked through the computed transition).
 */

const LONG_GUIDE_NAME = 'Alexandra Montgomery-Ray'; // 24 characters
const CAPTIONS = ['Short caption here.', 'A medium caption about the quiet light on the water, a long afternoon.', 'Another one.'];
const STRIP_BOTTOM = { normal: 172, large: 180, xlarge: 192 } as const;

interface LabelInfo {
  role: 'guide' | 'visitor';
  rect: Rect;
  opacity: number;
  /** The offset the layout wrote (px), 0 when none. */
  dx: number;
  dy: number;
  transition: string;
}

async function labels(page: Page): Promise<LabelInfo[]> {
  return page.evaluate(`(() => {
    const out = [];
    for (const role of ['guide', 'visitor']) {
      const e = document.querySelector('[data-testid="name-label-' + role + '"]');
      if (!e) continue;
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const m = (e.dataset.offset || '').match(/(-?\\d+)px (-?\\d+)px/);
      out.push({ role, rect: { x: b.x, y: b.y, width: b.width, height: b.height }, opacity: Number(cs.opacity),
        dx: m ? Number(m[1]) : 0, dy: m ? Number(m[2]) : 0, transition: cs.transitionProperty + ' ' + cs.transitionDuration });
    }
    return out;
  })()`) as Promise<LabelInfo[]>;
}

async function settle(page: Page): Promise<void> {
  await page.locator('.caption-card').waitFor({ timeout: 20_000 });
  // The layout runs about every 100 ms and the shift is eased over 150 ms.
  await page.waitForTimeout(1500);
}

test.describe('label strip rule, spec 5.5 v1.5', () => {
  test.setTimeout(300_000);

  test('BUG-10 / 5.5 QA check: 360x640, caption size 1.5, 24-character Guide name: label top is at least 192 px and clear of the picture', async ({ page }) => {
    const m = await createMuseum(page, { photos: 3, captions: CAPTIONS, guideName: LONG_GUIDE_NAME, closingMessage: 'Thanks.' });
    expect(LONG_GUIDE_NAME).toHaveLength(24);
    await enterVisit(page, m.shareToken, { width: 360, height: 640 });
    await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('xlarge')`);
    for (const i of [0, 1, 2]) {
      await standAndFrame(page, i);
      await settle(page);
      const rects = await sceneRects(page);
      const ls = await labels(page);
      const guide = ls.find((l) => l.role === 'guide');
      expect(guide, `picture ${i + 1}: the Guide's label exists`).toBeTruthy();
      expect(rects.picture, `picture ${i + 1}: picture rect`).not.toBeNull();
      for (const l of ls) {
        if (l.opacity < 0.5) continue; // hidden by the wall line of sight
        expect(l.rect.y, `picture ${i + 1}: ${l.role} label top ${l.rect.y}`).toBeGreaterThanOrEqual(STRIP_BOTTOM.xlarge - 0.5);
        expect(intersects(l.rect, rects.picture!), `picture ${i + 1}: ${l.role} label ${JSON.stringify(l.rect)} against picture ${JSON.stringify(rects.picture)}`).toBe(false);
      }
      await leavePicture(page);
    }
  });

  for (const scale of ['normal', 'large', 'xlarge'] as const) {
    test(`5.5 rules (a) (d): 360x640 and 390x844 at caption scale ${scale}: labels at or below the strip edge, and pushed down no further than the edge`, async ({ page }, testInfo) => {
      const seen: string[] = [];
      for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
        const m = await createMuseum(page, { photos: 3, captions: CAPTIONS, guideName: 'Sam', closingMessage: 'Thanks.' });
        await enterVisit(page, m.shareToken, vp);
        await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('${scale}')`);
        for (const i of [0, 2]) {
          await standAndFrame(page, i);
          await settle(page);
          const rects = await sceneRects(page);
          for (const l of await labels(page)) {
            if (l.opacity < 0.5) continue;
            const where = `${vp.width}x${vp.height} ${scale} picture ${i + 1} ${l.role}`;
            expect(l.rect.y, `${where}: top ${l.rect.y}`).toBeGreaterThanOrEqual(STRIP_BOTTOM[scale] - 0.5);
            if (rects.picture) expect(intersects(l.rect, rects.picture), `${where}: touches the picture`).toBe(false);
            // A downward offset is only ever the strip clamp (the picture rule is sideways, the collision rule is upward),
            // so a pushed-down label must sit exactly on the edge.
            if (l.dy > 0) expect(Math.abs(l.rect.y - STRIP_BOTTOM[scale]), `${where}: pushed down ${l.dy} px but top is ${l.rect.y}`).toBeLessThanOrEqual(1.5);
            seen.push(`${where}: top ${Math.round(l.rect.y)}, dx ${l.dx}, dy ${l.dy}`);
          }
          await leavePicture(page);
        }
      }
      testInfo.annotations.push({ type: 'labels', description: seen.join(' | ') });
    });
  }

  test('5.5 rule (f): landscape and wide layouts are not pushed down (no positive offset)', async ({ page }, testInfo) => {
    const seen: string[] = [];
    for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 720 }]) {
      const m = await createMuseum(page, { photos: 3, captions: CAPTIONS, guideName: LONG_GUIDE_NAME, closingMessage: 'Thanks.' });
      await enterVisit(page, m.shareToken, vp);
      await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('xlarge')`);
      for (const i of [0, 2]) {
        await standAndFrame(page, i);
        await settle(page);
        for (const l of await labels(page)) {
          expect(l.dy, `${vp.width}x${vp.height} picture ${i + 1} ${l.role}: dy ${l.dy}`).toBeLessThanOrEqual(0);
          seen.push(`${vp.width}x${vp.height} p${i + 1} ${l.role}: top ${Math.round(l.rect.y)} dx ${l.dx} dy ${l.dy}`);
        }
        await leavePicture(page);
      }
    }
    testInfo.annotations.push({ type: 'labels', description: seen.join(' | ') });
  });

  test('5.5 rule (e): the label shift is eased over --duration-fast (150 ms); frames are sampled', async ({ page }, testInfo) => {
    const m = await createMuseum(page, { photos: 3, captions: CAPTIONS, guideName: LONG_GUIDE_NAME, closingMessage: 'Thanks.' });
    await enterVisit(page, m.shareToken, { width: 360, height: 640 });
    await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('xlarge')`);
    // Sample the Guide label's computed `translate` and its time every frame while the presentation starts.
    await page.evaluate(`(() => {
      const s = (globalThis.__labelSamples = []);
      const t0 = performance.now();
      const tick = () => {
        const e = document.querySelector('[data-testid="name-label-guide"]');
        if (e) s.push([Math.round(performance.now() - t0), getComputedStyle(e).translate]);
        globalThis.__labelRaf = requestAnimationFrame(tick);
      };
      tick();
    })()`);
    await standAndFrame(page, 0);
    await settle(page);
    const samples = (await page.evaluate(`(cancelAnimationFrame(globalThis.__labelRaf), globalThis.__labelSamples)`)) as [number, string][];
    const ls = await labels(page);
    const guide = ls.find((l) => l.role === 'guide')!;
    expect(guide.transition, 'computed transition on the label').toContain('translate');
    const dur = guide.transition.split(' ').pop() ?? '';
    expect(dur, `computed transition duration: ${guide.transition}`).toContain('0.15s');
    // Distinct translate values in order, with the frame time they first appear.
    const steps: string[] = [];
    let prev = '';
    for (const [t, v] of samples) {
      if (v !== prev) {
        steps.push(`${t}ms ${v}`);
        prev = v;
      }
    }
    testInfo.annotations.push({ type: 'translate-steps', description: steps.join(' > ') });
    testInfo.annotations.push({ type: 'frames', description: `${samples.length} frames sampled` });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('5.5 rule (e): under reduced motion the label transition duration is 0', async ({ page }, testInfo) => {
      const m = await createMuseum(page, { photos: 3, captions: CAPTIONS, guideName: LONG_GUIDE_NAME, closingMessage: 'Thanks.' });
      await enterVisit(page, m.shareToken, { width: 360, height: 640 });
      await page.evaluate(`globalThis.__APP_TEST__.useSettingsStore.getState().setCaptionSize('xlarge')`);
      await standAndFrame(page, 0);
      await settle(page);
      const guide = (await labels(page)).find((l) => l.role === 'guide')!;
      testInfo.annotations.push({ type: 'transition', description: guide.transition });
      expect(guide.transition, 'computed transition on the label').toContain('translate');
      expect(guide.transition.split(' ').pop(), guide.transition).toMatch(/^0(\.0+)?m?s$/);
      expect(guide.rect.y).toBeGreaterThanOrEqual(STRIP_BOTTOM.xlarge - 0.5);
    });
  });
});
