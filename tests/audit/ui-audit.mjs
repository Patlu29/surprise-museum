/* UI audit: screens, tap targets (FR-81), text sizes (FR-83), overflow and thumb reach (FR-82). See lib.mjs. First written for CR-4, still repeatable. */
import { launch, newContext, measure, shot, save, VIEWPORTS } from './lib.mjs';
import { makePhotos } from '../e2e/support/images.ts';

const browserName = process.argv[2] ?? 'chromium';
const vpIds = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(VIEWPORTS);

const browser = await launch(browserName);
for (const vpId of vpIds) {
  const id = `${browserName}-${vpId}`;
  const ctx = await newContext(browser, browserName, vpId);
  const page = await ctx.newPage();
  const consoleProblems = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/THREE\.Clock|GPU stall|favicon/.test(m.text())) consoleProblems.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => consoleProblems.push('pageerror: ' + e.message));
  const result = { id, screens: {}, notes: [] };
  const snap = async (name, opts = {}) => {
    try {
      await page.evaluate('document.fonts.ready');
      await page.waitForTimeout(opts.wait ?? 500);
      const m = await measure(page, { cover: opts.cover });
      m.shot = await shot(page, id, name, { full: opts.full });
      result.screens[name] = m;
      console.log(id, name, 'targets', m.targets.length, 'small', m.small.length, 'gaps', m.gaps.length, 'hOverflow', m.doc.hOverflow);
    } catch (e) {
      result.notes.push(`${name}: ${e.message.slice(0, 200)}`);
      console.log(id, name, 'FAILED', e.message.slice(0, 120));
    }
  };
  const tryStep = async (name, fn) => {
    try { await fn(); } catch (e) { result.notes.push(`${name}: ${e.message.slice(0, 200)}`); console.log(id, name, 'STEP FAILED', e.message.slice(0, 120)); }
  };

  // ---- Landing
  await page.goto('./?e2e=1');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await snap('landing');
  await tryStep('landing-fold', async () => {
    result.landingFold = await page.evaluate(() => {
      const vh = innerHeight;
      const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
      const cta = [...document.querySelectorAll('a,button')].find((e) => /Create a museum/.test(e.textContent));
      const r = cta.getBoundingClientRect();
      const h1 = document.querySelector('h1').getBoundingClientRect();
      const lead = [...document.querySelectorAll('p')].find((p) => /Add your photos/.test(p.textContent));
      const lr = lead.getBoundingClientRect();
      return { vh, h1Bottom: Math.round(h1.bottom), leadBottom: Math.round(lr.bottom), ctaTop: Math.round(r.top), ctaBottom: Math.round(r.bottom), ctaFullyVisible: r.bottom <= vh, scrollH: document.documentElement.scrollHeight, brand: q('.home__brand') };
    });
  });
  await snap('landing-full', { full: true, wait: 100 });

  // ---- Builder step 1
  await page.goto('./?e2e=1#/create');
  await page.getByRole('heading', { level: 1, name: 'Photos' }).waitFor();
  await snap('create-1-empty');
  await page.locator('input[type=file]').first().setInputFiles(makePhotos(3));
  await page.locator('.photo-row__status--ready').nth(2).waitFor({ timeout: 60000 });
  const caps = ['The day we got lost on the way to the beach and found the best chips in town.', 'Grandma teaching everyone to dance in the kitchen.', 'Our first night in the new house.'];
  for (let i = 0; i < 3; i++) await page.getByLabel('Caption (optional)').nth(i).fill(caps[i]);
  await snap('create-1-photos');
  await tryStep('photos-full', async () => { await shot(page, id, 'create-1-photos-full', { full: true }); });
  // Preview with things missing (US-8 dialog)
  await tryStep('preview-missing', async () => {
    await page.getByRole('button', { name: 'Preview' }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 4000 });
    await snap('create-preview-missing-dialog', { wait: 600 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });

  // ---- Step 2
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Who is this museum for?').waitFor();
  await snap('create-2-words-empty');
  await tryStep('validation', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);
    await snap('create-2-words-after-next-empty');
  });
  await page.getByLabel('Who is this museum for?').fill('Alex');
  await page.getByLabel('Your name').fill('Sam');
  await snap('create-2-words-filled');

  // ---- Step 3
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('heading', { level: 1, name: 'Characters' }).waitFor();
  await page.locator('.preview-slot__loading').waitFor({ state: 'hidden', timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await snap('create-3-characters', { wait: 800 });
  await tryStep('characters-tabs', async () => {
    await page.getByRole('tab', { name: 'Hair' }).click();
    await snap('create-3-characters-hair');
    await page.getByRole('tab', { name: /^Visitor/ }).click();
    await page.getByRole('tab', { name: 'Outfit' }).click();
    await snap('create-3-characters-visitor-outfit');
    await page.getByRole('tab', { name: 'Body' }).click();
    await snap('create-3-characters-visitor-body');
  });

  // ---- Step 4
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('checkbox', { name: /I have the right to share/ }).waitFor();
  await snap('create-4-review');
  await page.getByRole('checkbox', { name: /I have the right to share/ }).check();
  await snap('create-4-review-consented');
  const publish = page.getByRole('button', { name: /Publish museum/ });
  await publish.click();
  await page.getByRole('heading', { name: 'Your museum is ready' }).waitFor({ timeout: 60000 });
  await snap('published');
  const share = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  const token = share.split('/').pop();

  // ---- Visit
  await page.goto('about:blank');
  await page.goto(`./?e2e=1#/m/${token}`);
  await page.getByRole('button', { name: 'Start' }).waitFor({ timeout: 30000 });
  await snap('visit-welcome');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => globalThis.__surpriseMuseum && globalThis.__surpriseMuseum.snapshot().ready, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await snap('visit-roaming', { cover: true, wait: 800 });
  const openSheet = async (name, shotName) => tryStep(shotName, async () => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('dialog').waitFor({ timeout: 4000 });
    await snap(shotName, { cover: true });
    const close = page.getByRole('dialog').getByRole('button', { name: /Close|Done|Got it|Back to the museum/ }).first();
    if (await close.count()) await close.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });
  await openSheet('Pictures', 'visit-pictures');
  await openSheet('Settings', 'visit-settings');
  await openSheet('Help', 'visit-help');
  await tryStep('caption-card', async () => {
    await page.evaluate(() => globalThis.__surpriseMuseum.standAtPhoto(0));
    await page.waitForFunction(() => { const s = globalThis.__surpriseMuseum.snapshot(); return s.guide.mode === 'present' && s.guide.opacity >= 1; }, null, { timeout: 60000 });
    await page.locator('.caption-card').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await snap('visit-caption-card', { cover: true });
    await page.getByRole('button', { name: /Look closer/i }).first().click();
    await page.locator('.viewer__image.is-loaded').waitFor({ timeout: 20000 });
    await snap('visit-viewer');
    await page.getByRole('button', { name: 'Close photo' }).click();
    await page.waitForTimeout(600);
  });
  await tryStep('finale', async () => {
    await page.evaluate(() => globalThis.__surpriseMuseum.standAtFinale());
    await page.locator('.finale-card').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await snap('visit-finale', { cover: true });
  });

  // ---- Error screens
  await page.goto('./#/m/doesnotexist0000');
  await page.waitForTimeout(1500);
  await snap('visit-notfound');

  result.consoleProblems = consoleProblems;
  save(id, result);
  await ctx.close();
}
await browser.close();
