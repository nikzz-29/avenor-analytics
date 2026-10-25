import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
const localBrowser = '../../.data/browser-path';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    reducedMotion: 'reduce',
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath:
        process.env.PW_CHROMIUM_PATH ||
        (existsSync(localBrowser) ? readFileSync(localBrowser, 'utf8').trim() : undefined),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  },
});
