import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEO_LOCALES,
  RTL_LOCALES,
  STATIC_SEO_ROUTES,
  isNoIndexPath,
} from '../src/seo/staticRoutes.js';
import { emitStaticSeoAssets } from '../src/seo/staticHtmlGenerator.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('STATIC_SEO_ROUTES covers 29 public routes x 9 locales without any noindex collision', () => {
  assert.equal(SEO_LOCALES.length, 9);
  assert.equal(STATIC_SEO_ROUTES.length, 29);

  for (const route of STATIC_SEO_ROUTES) {
    assert.ok(route.path.startsWith('/'), `Route path must start with /: ${route.path}`);
    assert.ok(route.priority, `Route missing priority: ${route.path}`);
    assert.ok(route.changefreq, `Route missing changefreq: ${route.path}`);
    for (const locale of SEO_LOCALES) {
      const fullPath = route.path === '/' ? `/${locale}` : `/${locale}${route.path}`;
      assert.equal(isNoIndexPath(fullPath), false, `Public static route matched noindex: ${fullPath}`);
    }
  }
});

test('isNoIndexPath marks private/member routes noindex while keeping public teacher recruitment indexable', () => {
  const privatePaths = [
    '/ar/login',
    '/en/register',
    '/fr/register/student',
    '/de/register/guardian',
    '/ar/forgot-password',
    '/ar/reset-password',
    '/ar/admin',
    '/ar/admin/users',
    '/ar/student/dashboard',
    '/en/teacher/dashboard',
    '/ur/guardian/dashboard',
    '/ar/live/room-1',
    '/ar/meeting/abc',
    '/ar/payment/checkout',
    '/ar/profile/setup',
    '/ar/notifications',
    '/ar/settings',
    '/ar/ai',
    '/ar/journey',
    '/ar/verify-certificate/CERT-001',
    '/en/book-trial/123',
    '/ar/courses/tajweed-101/learn',
  ];

  for (const pathname of privatePaths) {
    assert.equal(isNoIndexPath(pathname), true, `Expected noindex=true for ${pathname}`);
  }

  const publicPaths = [
    '/ar',
    '/en/courses',
    '/en/courses/tajweed-101',
    '/ar/teachers',
    '/ar/teachers/sheikh-ahmad',
    '/fr/register/teacher',
    '/de/markets/europe',
    '/ar/free-trial',
    '/ar/plans',
  ];

  for (const pathname of publicPaths) {
    assert.equal(isNoIndexPath(pathname), false, `Expected noindex=false for ${pathname}`);
  }
});

test('emitStaticSeoAssets generates 261 localized HTML shells, sitemaps, valid JSON-LD, and hreflang sets', () => {
  const templateHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const distTmp = mkdtempSync(join(tmpdir(), 'wn-seo-static-'));

  try {
    const result = emitStaticSeoAssets(distTmp, templateHtml, 'https://wahywanamaa.com');
    assert.equal(result.baseUrl, 'https://wahywanamaa.com');
    assert.equal(result.generatedPages, 261);

    const sitemapStatic = readFileSync(resolve(distTmp, 'sitemap-static.xml'), 'utf8');
    const sitemapIndex = readFileSync(resolve(distTmp, 'sitemap.xml'), 'utf8');

    assert.match(sitemapStatic, /<urlset\b/);
    const locMatches = sitemapStatic.match(/<loc>/g) || [];
    assert.equal(locMatches.length, 261);
    assert.match(sitemapStatic, /hreflang="x-default"/);

    assert.match(sitemapIndex, /<sitemapindex\b/);
    assert.match(sitemapIndex, /https:\/\/wahywanamaa\.com\/sitemap-static\.xml/);
    assert.match(sitemapIndex, /https:\/\/wahywanamaa\.com\/sitemap-dynamic\.xml/);
    assert.equal(/<link[^>]+rel=["']canonical["']/.test(templateHtml), false);

    const samples = [
      { file: 'ar.html', locale: 'ar', expectedUrl: 'https://wahywanamaa.com/ar', isHome: true },
      { file: 'en.html', locale: 'en', expectedUrl: 'https://wahywanamaa.com/en', isHome: true },
      { file: 'en/courses.html', locale: 'en', expectedUrl: 'https://wahywanamaa.com/en/courses', isHome: false },
      { file: 'fr/register/teacher.html', locale: 'fr', expectedUrl: 'https://wahywanamaa.com/fr/register/teacher', isHome: false },
      { file: 'de/markets/europe.html', locale: 'de', expectedUrl: 'https://wahywanamaa.com/de/markets/europe', isHome: false },
    ];

    for (const sample of samples) {
      const filePath = resolve(distTmp, sample.file);
      assert.ok(existsSync(filePath), `Missing generated static shell: ${sample.file}`);
      const html = readFileSync(filePath, 'utf8');
      const expectedDir = RTL_LOCALES.includes(sample.locale) ? 'rtl' : 'ltr';

      assert.match(html, new RegExp(`<html lang="${sample.locale}" dir="${expectedDir}">`));
      assert.equal(html.includes('data-seo-bootstrap'), false);

      const canonicalMatches = html.match(/<link rel="canonical" href="([^"]+)"/g) || [];
      assert.equal(canonicalMatches.length, 1, `Expected 1 canonical link in ${sample.file}`);
      assert.ok(html.includes(`<link rel="canonical" href="${sample.expectedUrl}" />`));

      const hreflangMatches = html.match(/<link rel="alternate" hreflang="/g) || [];
      assert.equal(hreflangMatches.length, SEO_LOCALES.length + 1);

      const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      assert.ok(ldMatches.length >= (sample.isHome ? 3 : 4));
      for (const [, rawJson] of ldMatches) {
        const parsed = JSON.parse(rawJson);
        assert.ok(parsed['@context'] === 'https://schema.org');
        assert.ok(parsed['@type']);
      }

      if (sample.isHome) {
        assert.match(html, /<link rel="preload" as="image" href="\/images\/hero-wahy-namaa\.jpg"/);
      } else {
        assert.match(html, /"@type":"BreadcrumbList"/);
        assert.match(html, /<noscript>/);
      }
    }
  } finally {
    rmSync(distTmp, { recursive: true, force: true });
  }
});

test('vercel.json, manifest.json, and robots.txt satisfy launch SEO configuration checks', () => {
  const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(vercel.cleanUrls, true);
  assert.equal(vercel.trailingSlash, false);
  const spaRewrite = vercel.rewrites.find((r) => r.destination === '/index');
  assert.ok(spaRewrite, 'vercel.json SPA fallback must target extensionless /index when cleanUrls is true');
  assert.ok(vercel.rewrites.some((r) => r.source === '/sitemap-dynamic.xml' && r.destination === 'https://api.wahywanamaa.com/api/seo/sitemap.xml'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/api/:path*' && r.destination === 'https://api.wahywanamaa.com/api/:path*'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/uploads/:path*' && r.destination === 'https://api.wahywanamaa.com/uploads/:path*'));

  const noindexSources = vercel.headers
    .filter((h) => h.headers?.some((kv) => kv.key === 'X-Robots-Tag' && kv.value.includes('noindex')))
    .map((h) => h.source);
  assert.ok(noindexSources.includes('/api/((?!seo/).*)'));
  assert.ok(!noindexSources.includes('/api/(.*)'));
  assert.ok(!noindexSources.some((src) => src.includes('register/teacher')));

  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/manifest.json'), 'utf8'));
  const iconPaths = [
    ...manifest.icons.map((i) => i.src),
    ...(manifest.shortcuts || []).flatMap((s) => (s.icons || []).map((i) => i.src)),
  ];
  assert.ok(iconPaths.length > 0);
  for (const iconSrc of iconPaths) {
    const diskPath = resolve(ROOT, 'public', iconSrc.replace(/^\//, ''));
    assert.ok(existsSync(diskPath), `Manifest icon missing on disk: ${iconSrc}`);
  }

  const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8');
  assert.match(robots, /Allow:\s*\/api\/seo\/sitemap\.xml/);
  assert.match(robots, /Allow:\s*\/\*\/register\/teacher/);
  assert.match(robots, /Disallow:\s*\/register\$/);
  assert.match(robots, /User-agent:\s*OAI-SearchBot/);
  assert.match(robots, /User-agent:\s*PerplexityBot/);
  assert.match(robots, /User-agent:\s*CCBot[\s\S]*Disallow:\s*\//);
  assert.match(robots, /Sitemap:\s*https:\/\/wahywanamaa\.com\/sitemap\.xml/);
});
