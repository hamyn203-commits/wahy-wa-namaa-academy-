import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_SITE_URL,
  LOCALE_BRAND,
  OG_LOCALE,
  RTL_LOCALES,
  SEO_LOCALES,
  STATIC_SEO_ROUTES,
  resolveRouteMeta,
} from './staticRoutes.js';

export function resolveBaseSiteUrl(explicitUrl) {
  return String(
    explicitUrl
      || globalThis.process?.env?.VITE_SITE_URL
      || globalThis.process?.env?.SITE_URL
      || DEFAULT_SITE_URL
  ).trim().replace(/\/$/, '');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function generateStaticSitemap(siteUrl) {
  const baseUrl = resolveBaseSiteUrl(siteUrl);
  const currentDate = new Date().toISOString().split('T')[0];

  const blocks = [];
  for (const route of STATIC_SEO_ROUTES) {
    const pathSuffix = route.path === '/' ? '' : route.path;
    const alternates = SEO_LOCALES
      .map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${escapeXml(`${baseUrl}/${alt}${pathSuffix}`)}" />`)
      .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${baseUrl}/ar${pathSuffix}`)}" />`)
      .join('\n');

    for (const locale of SEO_LOCALES) {
      blocks.push(`  <url>
    <loc>${escapeXml(`${baseUrl}/${locale}${pathSuffix}`)}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
${alternates}
  </url>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>
`;
}

export function generateSitemapIndex(siteUrl) {
  const baseUrl = resolveBaseSiteUrl(siteUrl);
  const currentDate = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap-static.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap-dynamic.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

function buildRouteSchemas({ baseUrl, locale, pathSuffix, canonicalUrl, title, description, brand, schemaType }) {
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: brand.appNameFull,
    alternateName: ['وَحْيٌ وَنَمَاء', 'WAHY WA NAMAA', 'Wahy Wa Namaa Academy'],
    description: brand.seoDescription,
    slogan: brand.slogan,
    url: baseUrl,
    logo: `${baseUrl}/assets/logo.png`,
    image: `${baseUrl}/images/hero-wahy-namaa.jpg`,
    inLanguage: SEO_LOCALES,
    address: { '@type': 'PostalAddress', addressCountry: 'EG' },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.appName,
    alternateName: ['WAHY WA NAMAA', 'Wahy Wa Namaa Academy', 'وَحْيٌ وَنَمَاء'],
    url: baseUrl,
    inLanguage: SEO_LOCALES,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/${locale}/teachers?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': schemaType || 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', url: baseUrl, name: brand.appNameFull },
  };

  const schemas = [orgSchema, websiteSchema, webPageSchema];

  if (pathSuffix) {
    const homeLabel = locale === 'ar' ? 'الرئيسية' : 'Home';
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: homeLabel, item: `${baseUrl}/${locale}` },
        { '@type': 'ListItem', position: 2, name: title.split(' | ')[0], item: canonicalUrl },
      ],
    });
  }

  return schemas
    .map((schema) => `    <script type="application/ld+json">${safeJsonLd(schema)}</script>`)
    .join('\n');
}

function replaceOrInsertMeta(html, attrName, attrValue, content) {
  const escapedAttr = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = `<meta ${attrName}="${attrValue}" content="${escapeHtml(content)}" />`;
  const re = new RegExp(`<meta\\s+[^>]*${attrName}=["']${escapedAttr}["'][^>]*>`, 'i');
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

export function renderStaticRouteHtml(templateHtml, route, locale, siteUrl) {
  const baseUrl = resolveBaseSiteUrl(siteUrl);
  const pathSuffix = route.path === '/' ? '' : route.path;
  const canonicalUrl = `${baseUrl}/${locale}${pathSuffix}`;
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  const { brand, title, description } = resolveRouteMeta(route, locale);
  const ogImage = `${baseUrl}/images/hero-wahy-namaa.jpg`;

  let html = templateHtml;

  html = html.replace(/<html\b[^>]*>/i, `<html lang="${locale}" dir="${dir}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  html = html.replace(/<script\s+data-seo-bootstrap[^>]*>[\s\S]*?<\/script>\s*/gi, '');
  html = html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\b[^>]*rel=["']alternate["'][^>]*hreflang=["'][^"']*["'][^>]*>\s*/gi, '');
  html = html.replace(/<meta\b[^>]*property=["']og:locale:alternate["'][^>]*>\s*/gi, '');
  html = html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
  html = html.replace(/<link\b[^>]*rel=["']preload["'][^>]*href=["']\/images\/hero-wahy-namaa\.jpg["'][^>]*>\s*/gi, '');

  html = replaceOrInsertMeta(html, 'name', 'description', description);
  html = replaceOrInsertMeta(html, 'name', 'keywords', brand.seoKeywords);
  html = replaceOrInsertMeta(html, 'name', 'author', brand.appNameFull);
  html = replaceOrInsertMeta(html, 'name', 'application-name', brand.appName);
  html = replaceOrInsertMeta(html, 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  html = replaceOrInsertMeta(html, 'name', 'googlebot', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  html = replaceOrInsertMeta(html, 'property', 'og:title', title);
  html = replaceOrInsertMeta(html, 'property', 'og:description', description);
  html = replaceOrInsertMeta(html, 'property', 'og:url', canonicalUrl);
  html = replaceOrInsertMeta(html, 'property', 'og:site_name', `${brand.appName} | WAHY WA NAMAA`);
  html = replaceOrInsertMeta(html, 'property', 'og:locale', OG_LOCALE[locale] || locale);
  html = replaceOrInsertMeta(html, 'property', 'og:image', ogImage);
  html = replaceOrInsertMeta(html, 'property', 'og:image:alt', title);

  html = replaceOrInsertMeta(html, 'name', 'twitter:title', title);
  html = replaceOrInsertMeta(html, 'name', 'twitter:description', description);
  html = replaceOrInsertMeta(html, 'name', 'twitter:image', ogImage);
  html = replaceOrInsertMeta(html, 'name', 'twitter:image:alt', title);

  const ogAlternates = SEO_LOCALES
    .filter((alt) => alt !== locale)
    .map((alt) => `    <meta property="og:locale:alternate" content="${OG_LOCALE[alt] || alt}" />`)
    .join('\n');

  const hreflangs = SEO_LOCALES
    .map((alt) => `    <link rel="alternate" hreflang="${alt}" href="${escapeHtml(`${baseUrl}/${alt}${pathSuffix}`)}" />`)
    .concat(`    <link rel="alternate" hreflang="x-default" href="${escapeHtml(`${baseUrl}/ar${pathSuffix}`)}" />`)
    .join('\n');

  const preloadHero = route.path === '/'
    ? `    <link rel="preload" as="image" href="/images/hero-wahy-namaa.jpg" fetchpriority="high" />\n`
    : '';

  const jsonLd = buildRouteSchemas({
    baseUrl,
    locale,
    pathSuffix,
    canonicalUrl,
    title,
    description,
    brand,
    schemaType: route.schemaType,
  });

  const headInject = `${preloadHero}    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />\n${ogAlternates}\n${hreflangs}\n${jsonLd}\n`;
  html = html.replace('</head>', `${headInject}  </head>`);

  const heading = escapeHtml(title.split(' | ')[0]);
  const noscriptBlock = `    <noscript>
      <main lang="${locale}" dir="${dir}" style="max-width:760px;margin:2rem auto;padding:1.5rem;font-family:sans-serif">
        <h1>${heading}</h1>
        <p>${escapeHtml(description)}</p>
        <nav aria-label="Primary">
          <a href="/${locale}">${escapeHtml(brand.appName)}</a> ·
          <a href="/${locale}/courses">${locale === 'ar' ? 'الدورات' : 'Courses'}</a> ·
          <a href="/${locale}/teachers">${locale === 'ar' ? 'المعلمون' : 'Teachers'}</a> ·
          <a href="/${locale}/plans">${locale === 'ar' ? 'الخطط' : 'Plans'}</a> ·
          <a href="/${locale}/free-trial">${locale === 'ar' ? 'حصة مجانية' : 'Free Trial'}</a>
        </nav>
      </main>
    </noscript>\n`;

  html = html.replace(/<div\s+id=["']root["']\s*><\/div>/i, (rootTag) => `${noscriptBlock}    ${rootTag}`);
  return html;
}

export function emitStaticSeoAssets(distPath, templateHtml, siteUrl) {
  const baseUrl = resolveBaseSiteUrl(siteUrl);
  mkdirSync(distPath, { recursive: true });
  writeFileSync(resolve(distPath, 'sitemap-static.xml'), generateStaticSitemap(baseUrl), 'utf8');
  writeFileSync(resolve(distPath, 'sitemap.xml'), generateSitemapIndex(baseUrl), 'utf8');

  let count = 0;
  for (const route of STATIC_SEO_ROUTES) {
    for (const locale of SEO_LOCALES) {
      const relFile = route.path === '/'
        ? `${locale}.html`
        : `${locale}${route.path}.html`;
      const outPath = resolve(distPath, relFile);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, renderStaticRouteHtml(templateHtml, route, locale, baseUrl), 'utf8');
      count++;
    }
  }

  return { generatedPages: count, baseUrl };
}

export { LOCALE_BRAND, SEO_LOCALES, STATIC_SEO_ROUTES };
