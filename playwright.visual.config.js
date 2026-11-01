import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

/**
 * Visual-regression harness for the Design System migration.
 *
 * Local-only on purpose: font rasterisation differs between Windows / macOS /
 * Linux, so snapshots are NOT committed (see .gitignore → e2e-visual/__snapshots__).
 *
 * Workflow:
 *   1. On the untouched code:  npm run visual:baseline   (writes snapshots)
 *   2. After a design change:  npm run visual:compare    (diffs vs. snapshots)
 *   3. Review:                 npx playwright show-report playwright-visual-report
 *
 * Only public pages are covered here (no backend / database needed). API calls
 * fail fast and pages render their empty / fallback states consistently.
 */
const PORT = 4179;

export default defineConfig({
  testDir: './e2e-visual',
  snapshotPathTemplate: '{testDir}/__snapshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 3,
  retries: 0,
  timeout: 60 * 1000,
  expect: {
    timeout: 15 * 1000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-visual-report', open: 'never' }]],
  outputDir: 'test-results-visual',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    timezoneId: 'Africa/Cairo',
    reducedMotion: 'reduce',
    // Full Chromium in "new headless" mode — no separate headless-shell download needed.
    channel: 'chromium',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/ar`,
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
});

