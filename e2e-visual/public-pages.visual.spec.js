import { test, expect } from '@playwright/test';

/**
 * Public-page visual baseline: every page × locale (ar/en) × theme (light/dark).
 * Viewports come from the projects in playwright.visual.config.js.
 */
const PAGES = [
  ['home', ''],
  ['about', '/about'],
  ['courses', '/courses'],
  ['teachers', '/teachers'],
  ['plans', '/plans'],
  ['free-trial', '/free-trial'],
  ['start', '/start'],
  ['faq', '/faq'],
  ['contact', '/contact'],
  ['login', '/login'],
  ['register', '/register'],
  ['kids', '/programs/kids'],
  ['women', '/women'],
  ['not-found', '/this-page-does-not-exist'],
];

const LOCALES = ['ar', 'en'];
const THEMES = ['light', 'dark'];

/** Block anything outside the preview server (fonts excepted) for stable shots. */
async function isolateNetwork(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    const fonts = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
    if (local && url.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false}' });
    }
    return local || fonts ? route.continue() : route.abort();
  });
}

/** Scroll through the page so reveal-on-scroll sections render, then reset. */
async function revealAll(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

for (const locale of LOCALES) {
  for (const theme of THEMES) {
    for (const [name, path] of PAGES) {
      test(`${name} · ${locale} · ${theme}`, async ({ page }) => {
        await isolateNetwork(page);
        await page.addInitScript((t) => {
          try { localStorage.setItem('academy_theme', t); } catch { /* ignore */ }
        }, theme);
        await page.goto(`/${locale}${path}`, { waitUntil: 'networkidle' });
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await revealAll(page);
        await expect(page).toHaveScreenshot(`${name}-${locale}-${theme}.png`, {
          fullPage: true,
          // Live counters, clocks and rotating testimonials are masked out.
          mask: [page.locator('[data-visual-mask], time, [aria-live]')],
        });
      });
    }
  }
}

