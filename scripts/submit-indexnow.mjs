#!/usr/bin/env node
/** إرسال جميع الروابط الثابتة العامة إلى IndexNow في طلب دفعي واحد */
import { DEFAULT_SITE_URL, SEO_LOCALES, STATIC_SEO_ROUTES } from '../src/seo/staticRoutes.js';

const SITE = String(process.env.VITE_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
const HOST = new URL(SITE).hostname;
const KEY = 'wahywanamaa2026indexnow01';

const shouldRun =
  process.argv.includes('--force')
  || process.env.VERCEL_ENV === 'production'
  || process.env.INDEXNOW_SUBMIT === 'true';

if (!shouldRun) {
  console.log('IndexNow skipped (run with --force or INDEXNOW_SUBMIT=true in production)');
  process.exit(0);
}

const urls = [];
for (const route of STATIC_SEO_ROUTES) {
  const suffix = route.path === '/' ? '' : route.path;
  for (const locale of SEO_LOCALES) {
    urls.push(`${SITE}/${locale}${suffix}`);
  }
}

try {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${SITE}/${KEY}.txt`,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(10000),
  });
  console.log(`IndexNow batch POST (${HOST}): HTTP ${response.status} for ${urls.length} URLs`);
} catch (error) {
  console.log(`IndexNow batch POST (${HOST}): skipped (${error?.message || 'network error'})`);
}
