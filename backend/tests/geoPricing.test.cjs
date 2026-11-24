'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

const app = require('../app');
const {
  detectCountryFromRequest,
  resolveRegionForCountry,
  getTierForCountry,
} = require('../config/geoPricing');
const {
  publicPlanCatalog,
  quoteSubscription,
} = require('../config/subscriptionPlans');

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

test('Geo-IP region resolution maps Egypt, GCC, West, and International tiers accurately', () => {
  assert.equal(resolveRegionForCountry('EG'), 'EG');
  assert.equal(resolveRegionForCountry('eg'), 'EG');
  assert.equal(resolveRegionForCountry('SA'), 'GCC');
  assert.equal(resolveRegionForCountry('AE'), 'GCC');
  assert.equal(resolveRegionForCountry('KW'), 'GCC');
  assert.equal(resolveRegionForCountry('US'), 'WEST');
  assert.equal(resolveRegionForCountry('GB'), 'WEST');
  assert.equal(resolveRegionForCountry('DE'), 'WEST');
  assert.equal(resolveRegionForCountry('CA'), 'WEST');
  assert.equal(resolveRegionForCountry('TR'), 'INTL');
  assert.equal(resolveRegionForCountry('ID'), 'INTL');
  assert.equal(resolveRegionForCountry('JO'), 'INTL');
  assert.equal(resolveRegionForCountry(''), 'EG');
});

test('quoteSubscription enforces progressive integer minor-unit pricing per regional tier', () => {
  // Egypt -> EGP: focused 8 = 2500, 12 = 2000, 24 = 1900; private 12 = 6900
  const eg8 = quoteSubscription({ planKey: 'focused', sessionCount: 8, countryCode: 'EG' });
  assert.equal(eg8.currency, 'EGP');
  assert.equal(eg8.region, 'EG');
  assert.equal(eg8.pricePerSessionMinor, 2500);
  assert.equal(eg8.totalAmountMinor, 20000);

  const eg24 = quoteSubscription({ planKey: 'focused', sessionCount: 24, countryCode: 'EG' });
  assert.equal(eg24.pricePerSessionMinor, 1900);
  assert.equal(eg24.totalAmountMinor, 45600);

  const egPriv12 = quoteSubscription({ planKey: 'private', sessionCount: 12, countryCode: 'EG' });
  assert.equal(egPriv12.pricePerSessionMinor, 6900);
  assert.equal(egPriv12.totalAmountMinor, 82800);

  // Saudi Arabia (GCC) -> USD: focused 12 = $2.75 ($33); private 8 = $4.75 ($38 ≈ 143 SAR); intensive 8 = $9.00 ($72)
  const saFocused = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'SA' });
  assert.equal(saFocused.currency, 'USD');
  assert.equal(saFocused.region, 'GCC');
  assert.equal(saFocused.pricePerSessionMinor, 275);
  assert.equal(saFocused.totalAmountMinor, 3300);

  const saPrivate = quoteSubscription({ planKey: 'private', sessionCount: 8, countryCode: 'SA' });
  assert.equal(saPrivate.pricePerSessionMinor, 475);
  assert.equal(saPrivate.totalAmountMinor, 3800);

  const saIntensive = quoteSubscription({ planKey: 'private_intensive', sessionCount: 8, countryCode: 'SA' });
  assert.equal(saIntensive.pricePerSessionMinor, 900);
  assert.equal(saIntensive.totalAmountMinor, 7200);

  // USA (WEST) -> USD: focused 12 = $3.25 ($39); private 8 = $5.25 ($42); intensive 8 = $10.00 ($80)
  const usFocused = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'US' });
  assert.equal(usFocused.currency, 'USD');
  assert.equal(usFocused.region, 'WEST');
  assert.equal(usFocused.pricePerSessionMinor, 325);
  assert.equal(usFocused.totalAmountMinor, 3900);

  const usPrivate = quoteSubscription({ planKey: 'private', sessionCount: 8, countryCode: 'US' });
  assert.equal(usPrivate.pricePerSessionMinor, 525);
  assert.equal(usPrivate.totalAmountMinor, 4200);

  const usIntensive = quoteSubscription({ planKey: 'private_intensive', sessionCount: 8, countryCode: 'US' });
  assert.equal(usIntensive.pricePerSessionMinor, 1000);
  assert.equal(usIntensive.totalAmountMinor, 8000);

  // Turkey (INTL) -> USD: focused 12 = $2.00 ($24)
  const trFocused = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'TR' });
  assert.equal(trFocused.currency, 'USD');
  assert.equal(trFocused.region, 'INTL');
  assert.equal(trFocused.pricePerSessionMinor, 200);
  assert.equal(trFocused.totalAmountMinor, 2400);
});

test('Production detectCountryFromRequest ignores client query/mock spoofing and trusts only edge IP headers', () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const spoofedReq = {
      query: { country: 'EG' },
      headers: {
        'x-mock-country': 'EG',
        'x-vercel-ip-country': 'SA',
      },
    };
    assert.equal(detectCountryFromRequest(spoofedReq), 'SA');

    const cfReq = {
      query: { country: 'EG' },
      headers: { 'cf-ipcountry': 'GB' },
    };
    assert.equal(detectCountryFromRequest(cfReq), 'GB');
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('GET /api/subscriptions/plans returns dynamic regional pricing with Vary & private Cache-Control', async () => {
  await serverReady;

  const egRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'EG' },
  });
  const egData = await egRes.json();
  assert.equal(egRes.status, 200);
  assert.equal(egData.currency, 'EGP');
  assert.equal(egData.region, 'EG');
  assert.equal(egData.plans[0].key, 'focused');
  assert.equal(egData.plans[0].pricePerSessionMinor, 1900);
  assert.equal(egData.plans[0].basePricePerSessionMinor, 2500);
  assert.deepEqual(egData.plans[0].packPricesMinor, { '8': 2500, '12': 2000, '24': 1900 });
  assert.equal(egData.localCurrencyHint, null);
  assert.match(String(egRes.headers.get('cache-control') || ''), /no-store/i);

  const saRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'SA' },
  });
  const saData = await saRes.json();
  assert.equal(saRes.status, 200);
  assert.equal(saData.currency, 'USD');
  assert.equal(saData.region, 'GCC');
  assert.equal(saData.plans[0].pricePerSessionMinor, 250);
  assert.equal(saData.plans[0].basePricePerSessionMinor, 325);
  assert.equal(saData.localCurrencyHint.code, 'SAR');

  const usRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'US' },
  });
  const usData = await usRes.json();
  assert.equal(usRes.status, 200);
  assert.equal(usData.currency, 'USD');
  assert.equal(usData.region, 'WEST');
  assert.equal(usData.plans[0].pricePerSessionMinor, 275);
  assert.equal(usData.plans[0].basePricePerSessionMinor, 375);
  assert.equal(usData.localCurrencyHint, null);

  const defaultCatalog = publicPlanCatalog();
  assert.equal(defaultCatalog.currency, 'EGP');
  assert.equal(getTierForCountry('AE').localCurrencyHint.code, 'AED');
});
