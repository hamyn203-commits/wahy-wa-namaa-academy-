const express = require('express');
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Blog = require('../models/Blog');

const router = express.Router();

const SEO_LOCALES = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'];

function resolveSiteUrl() {
  return String(
    process.env.SITE_URL
      || process.env.FRONTEND_URL
      || 'https://wahywanamaa.com'
  ).trim().replace(/\/$/, '');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatLastMod(dateValue) {
  try {
    const date = dateValue ? new Date(dateValue) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function renderLocalizedUrlEntries(siteUrl, pathSuffix, { lastmod, changefreq = 'weekly', priority = '0.8' }) {
  const safeSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  const alternates = SEO_LOCALES
    .map((loc) => `    <xhtml:link rel="alternate" hreflang="${loc}" href="${escapeXml(`${siteUrl}/${loc}${safeSuffix}`)}" />`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${siteUrl}/ar${safeSuffix}`)}" />`)
    .join('\n');

  return SEO_LOCALES.map((loc) => `  <url>
    <loc>${escapeXml(`${siteUrl}/${loc}${safeSuffix}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`).join('\n');
}

/**
 * Serves a dynamic XML sitemap for published courses, approved teachers, and published blog posts.
 */
router.get('/sitemap.xml', async (_req, res) => {
  const siteUrl = resolveSiteUrl();
  let courses = [];
  let teachers = [];
  let posts = [];

  if (mongoose.connection.readyState === 1) {
    try {
      [courses, teachers, posts] = await Promise.all([
        Course.find({ status: 'published', slug: { $exists: true, $ne: '' } })
          .select('slug updatedAt')
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean(),
        Teacher.find({ status: 'approved', isActive: { $ne: false } })
          .select('_id updatedAt')
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean(),
        Blog.find({ status: 'published', slug: { $exists: true, $ne: '' } })
          .select('slug updatedAt')
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean(),
      ]);
    } catch {
      courses = [];
      teachers = [];
      posts = [];
    }
  }

  const entries = [
    ...courses.map((course) => renderLocalizedUrlEntries(siteUrl, `/courses/${encodeURIComponent(course.slug)}`, {
      lastmod: formatLastMod(course.updatedAt),
      changefreq: 'weekly',
      priority: '0.85',
    })),
    ...teachers.map((teacher) => renderLocalizedUrlEntries(siteUrl, `/teachers/${encodeURIComponent(String(teacher._id))}`, {
      lastmod: formatLastMod(teacher.updatedAt),
      changefreq: 'weekly',
      priority: '0.8',
    })),
    ...posts.map((post) => renderLocalizedUrlEntries(siteUrl, `/blog/${encodeURIComponent(post.slug)}`, {
      lastmod: formatLastMod(post.updatedAt),
      changefreq: 'weekly',
      priority: '0.8',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
});

module.exports = router;
