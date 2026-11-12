#!/usr/bin/env node
/** إرسال روابط Sitemap إلى Bing IndexNow (202 = مقبول) */
const SITE = String(process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://wahywanamaa.com').replace(/\/$/, '');
const HOST = new URL(SITE).hostname;
const KEY = 'wahywanamaa2026indexnow01';
const LOCALES = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'];
const PAGES = [
  '',
  '/free-trial',
  '/teachers',
  '/courses',
  '/tracks',
  '/plans',
  '/blog',
  '/library',
  '/programs/kids',
  '/programs/reverts',
  '/women',
  '/markets',
  '/about',
  '/contact',
  '/start',
  '/faq',
];

const shouldRun =
  process.argv.includes('--force')
  || process.env.VERCEL_ENV === 'production'
  || process.env.INDEXNOW_SUBMIT === 'true';

if (!shouldRun) {
  console.log('IndexNow skipped (run with --force or INDEXNOW_SUBMIT=true in production)');
  process.exit(0);
}

const urls = [];
LOCALES.forEach((loc) => {
  PAGES.forEach((p) => urls.push(`${SITE}/${loc}${p}`));
});

let ok = 0;
let fail = 0;

const chunkSize = 10;
for (let i = 0; i < urls.length; i += chunkSize) {
  const batch = urls.slice(i, i + chunkSize);
  await Promise.all(batch.map(async (url) => {
    const api = `https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${KEY}`;
    try {
      const r = await fetch(api, { signal: AbortSignal.timeout(2000) });
      if (r.status === 200 || r.status === 202) ok++;
      else fail++;
    } catch {
      fail++;
    }
  }));
}

try {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${SITE}/${KEY}.txt`,
      urlList: urls.slice(0, 100),
    }),
  });
  console.log(`IndexNow batch POST: ${r.status}`);
} catch {
  console.log('IndexNow batch POST: skipped');
}

console.log(`Bing IndexNow (${HOST}) — ${ok} OK, ${fail} fail, ${urls.length} total URLs`);
