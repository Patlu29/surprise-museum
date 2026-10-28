import { defineConfig, devices } from '@playwright/test';

/**
 * Starter configuration created by the architect with the scaffold.
 * Owner from here on: qa-engineer (team conventions).
 *
 * Tests run against the production build served by `vite preview`, under the same
 * /surprise-museum/ base path as GitHub Pages. Install browsers once with
 * `npx playwright install`.
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/surprise-museum/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
