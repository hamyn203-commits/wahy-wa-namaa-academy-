'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-with-at-least-32-chars-123456';

const app = require('../app');
const {
  resolveCoursePricing,
  buildRegionalCoursePrices,
  OFFICIAL_ACADEMY_COURSES,
} = require('../config/coursePricing');

const server = http.createServer(app);
let baseUrl = '';
const serverReady = new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('resolveCoursePricing computes regional EGP/USD prices, savings %, and preserves legacy fallback', () => {
  const tajweedCourse = OFFICIAL_ACADEMY_COURSES.find((c) => c.slug === 'applied-tajweed-tuhfat-al-atfal');
  assert.ok(tajweedCourse);

  const eg = resolveCoursePricing(tajweedCourse, 'EG');
  assert.equal(eg.region, 'EG');
  assert.equal(eg.currency, 'EGP');
  assert.equal(eg.price, 179);
  assert.equal(eg.amountMinor, 17900);
  assert.equal(eg.compareAtPrice, 320);
  assert.equal(eg.discountPercent, 44);
  assert.equal(eg.isFree, false);
  assert.equal(eg.hasRegionalOverride, true);
  assert.equal(eg.localCurrencyHint, null);

  const sa = resolveCoursePricing(tajweedCourse, 'SA');
  assert.equal(sa.region, 'GCC');
  assert.equal(sa.currency, 'USD');
  assert.equal(sa.price, 15);
  assert.equal(sa.amountMinor, 1500);
  assert.equal(sa.compareAtPrice, 28);
  assert.equal(sa.discountPercent, 46);
  assert.equal(sa.localCurrencyHint.code, 'SAR');

  const us = resolveCoursePricing(tajweedCourse, 'US');
  assert.equal(us.region, 'WEST');
  assert.equal(us.currency, 'USD');
  assert.equal(us.price, 19);
  assert.equal(us.amountMinor, 1900);

  const tr = resolveCoursePricing(tajweedCourse, 'TR');
  assert.equal(tr.region, 'INTL');
  assert.equal(tr.currency, 'USD');
  assert.equal(tr.price, 12);
  assert.equal(tr.amountMinor, 1200);

  // Free lead-magnet course
  const freeCourse = OFFICIAL_ACADEMY_COURSES.find((c) => c.slug === 'fatiha-short-surahs-starter');
  const egFree = resolveCoursePricing(freeCourse, 'EG');
  assert.equal(egFree.isFree, true);
  assert.equal(egFree.price, 0);
  assert.equal(egFree.amountMinor, 0);
  assert.equal(egFree.discountPercent, 0);

  // Legacy course without regionalPrices stays 100% unchanged
  const legacyCourse = { slug: 'legacy-course', price: 25, currency: 'USD' };
  const legacyResolved = resolveCoursePricing(legacyCourse, 'EG');
  assert.equal(legacyResolved.hasRegionalOverride, false);
  assert.equal(legacyResolved.price, 25);
  assert.equal(legacyResolved.currency, 'USD');
  assert.equal(legacyResolved.amountMinor, 2500);
});

test('buildRegionalCoursePrices calibrates regional USD tiers from Admin EGP + USD inputs', () => {
  const built = buildRegionalCoursePrices({ priceUsd: 20, priceEgp: 180 });
  assert.deepEqual(built.regionalPrices, {
    EG: 180,
    GCC: 16,
    WEST: 20,
    INTL: 13,
  });
  assert.equal(built.compareAtPrices, undefined);

  const legacyOnly = buildRegionalCoursePrices({ priceUsd: 20 });
  assert.equal(legacyOnly.regionalPrices, undefined);
});

test('OFFICIAL_ACADEMY_COURSES defines 5 honest, high-converting courses (1 free lead-magnet + 4 paid)', () => {
  assert.equal(OFFICIAL_ACADEMY_COURSES.length, 5);
  const slugs = new Set(OFFICIAL_ACADEMY_COURSES.map((c) => c.slug));
  assert.equal(slugs.size, 5);

  const freeCourses = OFFICIAL_ACADEMY_COURSES.filter((c) => c.regionalPrices.EG === 0);
  assert.equal(freeCourses.length, 1);

  for (const spec of OFFICIAL_ACADEMY_COURSES) {
    assert.ok(spec.title.ar && spec.title.en);
    assert.ok(spec.description.ar && spec.description.en);
    assert.ok(Array.isArray(spec.starterLessons) && spec.starterLessons.length >= 2);
    assert.equal(spec.starterLessons[0].isFree, true);
    // Honesty rule: no fabricated student/review stats baked into catalog specs
    assert.equal(spec.stats, undefined);
  }
});

test('POST /api/admin/courses/seed-official-catalog enforces strict admin RBAC', async () => {
  await serverReady;

  const unauthRes = await fetch(`${baseUrl}/api/admin/courses/seed-official-catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(unauthRes.status, 401);

  const studentToken = jwt.sign(
    { id: String(new mongoose.Types.ObjectId()), role: 'student', tokenVersion: 0 },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  const studentRes = await fetch(`${baseUrl}/api/admin/courses/seed-official-catalog`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.ok([401, 403].includes(studentRes.status));
});
