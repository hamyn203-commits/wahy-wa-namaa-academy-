'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Blog = require('../models/Blog');
const seoRouter = require('../routes/seo');

async function requestSeoSitemap() {
  const app = express();
  app.use('/api/seo', seoRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/seo/sitemap.xml`);
    const body = await res.text();
    return { status: res.status, contentType: res.headers.get('content-type'), body };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/seo/sitemap.xml returns valid XML even when DB is disconnected', async () => {
  const originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

  try {
    const { status, contentType, body } = await requestSeoSitemap();
    assert.equal(status, 200);
    assert.match(contentType || '', /application\/xml/i);
    assert.match(body, /<urlset[^>]+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    assert.match(body, /<\/urlset>/);
  } finally {
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
  }
});

test('GET /api/seo/sitemap.xml renders dynamic course, teacher, and blog URLs with custom domain and hreflang', async () => {
  const originalReadyState = mongoose.connection.readyState;
  const originalSiteUrl = process.env.SITE_URL;
  const originalCourseFind = Course.find;
  const originalTeacherFind = Teacher.find;
  const originalBlogFind = Blog.find;

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  process.env.SITE_URL = 'https://wahywanamaa.com';

  const mockChain = (rows) => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => rows,
  });

  Course.find = () => mockChain([{ slug: 'tajweed-basics', updatedAt: '2026-11-10T10:00:00.000Z' }]);
  Teacher.find = () => mockChain([{ _id: '65f1a2b3c4d5e6f7a8b9c0d1', updatedAt: '2026-11-11T10:00:00.000Z' }]);
  Blog.find = () => mockChain([{ slug: 'hifz-guide', updatedAt: '2026-11-12T10:00:00.000Z' }]);

  try {
    const { status, body } = await requestSeoSitemap();
    assert.equal(status, 200);
    assert.match(body, /https:\/\/wahywanamaa\.com\/ar\/courses\/tajweed-basics/);
    assert.match(body, /https:\/\/wahywanamaa\.com\/en\/courses\/tajweed-basics/);
    assert.match(body, /https:\/\/wahywanamaa\.com\/ar\/teachers\/65f1a2b3c4d5e6f7a8b9c0d1/);
    assert.match(body, /https:\/\/wahywanamaa\.com\/ar\/blog\/hifz-guide/);
    assert.match(body, /hreflang="x-default" href="https:\/\/wahywanamaa\.com\/ar\/courses\/tajweed-basics"/);
    assert.match(body, /<lastmod>2026-11-10<\/lastmod>/);
  } finally {
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    if (originalSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = originalSiteUrl;
    Course.find = originalCourseFind;
    Teacher.find = originalTeacherFind;
    Blog.find = originalBlogFind;
  }
});
