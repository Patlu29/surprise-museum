import { defineConfig, devices } from '@playwright/test';

/**
 * Owner: qa-engineer (team conventions). Started by the architect as a scaffold.
 *
 * Tests run against a production build served by `vite preview`, under the same /surprise-museum/
 * base path as GitHub Pages, so the production Content-Security-Policy is in force.
 *
 * `npm run build` builds in live mode (ADR 0015), so the web server command sets
 * VITE_API_MODE=mock. Every test therefore uses the in-browser demo backend (IndexedDB) and
 * never calls Supabase. Do not point these tests at a live build.
 *
 * The build uses `--mode test` (and only that), so `window.__APP_TEST__` (the stores) exists, as the
 * frontend-developer's handoff describes. The CSP, minification, base path and chunking are the
 * same as a deploy build.
 *
 * Install browsers once with `npx playwright install chromium firefox webkit`.
 *
 * Environment switches:
 *   PW_REUSE_SERVER=1  reuse a server already on port 4173 (it must be a VITE_API_MODE=mock build)
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/surprise-museum/`;

// Software WebGL so headless runs render the real scene. These numbers are never performance data.
const SWIFTSHADER_ARGS = [
  '--use-angle=swiftshader',
  '--use-gl=angle',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.02 },
  },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}-{platform}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Photos are captured by the app as blob: URLs; keep service workers off so nothing is cached.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: SWIFTSHADER_ARGS } },
    },
    {
      name: 'desktop-firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], launchOptions: { args: SWIFTSHADER_ARGS } },
    },
  ],
  webServer: {
    command: `npm run build -- --mode test && npm run preview -- --port ${PORT}`,
    url: BASE_URL,
    env: { VITE_API_MODE: 'mock' },
    reuseExistingServer: Boolean(process.env.PW_REUSE_SERVER),
    timeout: 180_000,
  },
});
