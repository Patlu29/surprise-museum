// Seeds a museum through the real builder UI on the production mock build, saves storage state.
// node scripts/perf/seed.mjs <baseUrl> <photoDir> <count> <outFile>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const [base, photoDir, countStr, outFile] = process.argv.slice(2);
const count = Number(countStr);
const files = fs
  .readdirSync(photoDir)
  .filter((f) => f.endsWith('.jpg'))
  .sort()
  .slice(0, count)
  .map((f) => `${photoDir}/${f}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${base}#/create`);
await page.locator('input[type=file]').setInputFiles(files);
await page.waitForFunction(
  (n) => document.querySelectorAll('.photo-list > li').length >= n,
  count,
  { timeout: 120000 },
);
// wait for uploads to finish: no progress / "Uploading" text
await page.waitForFunction(
  (n) => document.querySelectorAll('.photo-row__status--ready').length >= n,
  count,
  { timeout: 280000 },
);
console.log('rows', await page.locator('.photo-list > li').count());
await page.getByRole('button', { name: 'Next' }).click();
await page.getByLabel('Who is this museum for?').fill('Alex');
await page.getByLabel('Your name').fill('Sam');
await page.getByLabel('Closing message (optional)').fill('Thank you for visiting.');
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('checkbox').check();
const publish = page.getByRole('button', { name: /Publish museum/ });
await page.waitForFunction(
  () => {
    const b = [...document.querySelectorAll('button')].find((b) =>
      /Publish museum/.test(b.textContent),
    );
    return b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
  },
  null,
  { timeout: 240000 },
);
await publish.click();
await page
  .getByText('Your museum is ready')
  .first()
  .waitFor({ timeout: 20000 })
  .catch(async (e) => {
    await page.screenshot({ path: process.argv[6] });
    console.log((await page.locator('body').innerText()).slice(0, 1500));
    throw e;
  });
const url = await page.locator('input[readonly]').first().inputValue();
console.log('share', url);
await ctx.storageState({ path: outFile, indexedDB: true });
const sz = fs.statSync(outFile).size;
console.log('state bytes', sz);
fs.writeFileSync(outFile.replace(/\.json$/, '.url'), url);
await browser.close();
