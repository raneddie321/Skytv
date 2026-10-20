import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5199);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'e2e', testMatch: /.*\.e2e\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'screenshots', testMatch: /screenshots\.spec\.ts/, timeout: 600_000, use: { viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    // Fixture catalog keeps screenshots and tests deterministic and independent of TMDB availability.
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { CATALOG_SOURCE: process.env.E2E_CATALOG_SOURCE ?? 'fixtures', DATA_MODE: process.env.E2E_DATA_MODE ?? 'mock' },
  },
});
