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

test('quoteSubscription enforces integer minor-unit pricing per regional tier', () => {
  // Egypt -> EGP: focused 8 sessions = 2500 minor (25 EGP), 12 sessions = 2000 minor (20 EGP)
  const eg8 = quoteSubscription({ planKey: 'focused', sessionCount: 8, countryCode: 'EG' });
  assert.equal(eg8.currency, 'EGP');
  assert.equal(eg8.region, 'EG');
  assert.equal(eg8.pricePerSessionMinor, 2500);
  assert.equal(eg8.totalAmountMinor, 20000);

  const eg12 = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'EG' });
  assert.equal(eg12.pricePerSessionMinor, 2000);
  assert.equal(eg12.totalAmountMinor, 24000);

  // Saudi Arabia (GCC) -> USD: focused $3.50 * 12 = $42.00; private $6.50 * 8 = $52.00; intensive $12.00 * 8 = $96.00
  const saFocused = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'SA' });
  assert.equal(saFocused.currency, 'USD');
  assert.equal(saFocused.region, 'GCC');
  assert.equal(saFocused.pricePerSessionMinor, 350);
  assert.equal(saFocused.totalAmountMinor, 4200);

  const saPrivate = quoteSubscription({ planKey: 'private', sessionCount: 8, countryCode: 'SA' });
  assert.equal(saPrivate.pricePerSessionMinor, 650);
  assert.equal(saPrivate.totalAmountMinor, 5200);

  const saIntensive = quoteSubscription({ planKey: 'private_intensive', sessionCount: 8, countryCode: 'SA' });
  assert.equal(saIntensive.pricePerSessionMinor, 1200);
  assert.equal(saIntensive.totalAmountMinor, 9600);

  // USA (WEST) -> USD: focused $4.50 * 12 = $54.00; private $8.50 * 8 = $68.00; intensive $15.00 * 8 = $120.00
  const usFocused = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'US' });
  assert.equal(usFocused.currency, 'USD');
  assert.equal(usFocused.region, 'WEST');
  assert.equal(usFocused.pricePerSessionMinor, 450);
  assert.equal(usFocused.totalAmountMinor, 5400);

  const usPrivate = quoteSubscription({ planKey: 'private', sessionCount: 8, countryCode: 'US' });
  assert.equal(usPrivate.pricePerSessionMinor, 850);
  assert.equal(usPrivate.totalAmountMinor, 6800);

  const usIntensive = quoteSubscription({ planKey: 'private_intensive', sessionCount: 8, countryCode: 'US' });
  assert.equal(usIntensive.pricePerSessionMinor, 1500);
  assert.equal(usIntensive.totalAmountMinor, 12000);

  // Turkey (INTL) -> USD: focused $2.50 * 12 = $30.00
  const trFocused = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'TR' });
  assert.equal(trFocused.currency, 'USD');
  assert.equal(trFocused.region, 'INTL');
  assert.equal(trFocused.pricePerSessionMinor, 250);
  assert.equal(trFocused.totalAmountMinor, 3000);
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
  assert.equal(egData.plans[0].pricePerSessionMinor, 2000);
  assert.deepEqual(egData.plans[0].packPricesMinor, { '8': 2500, '12': 2000, '24': 2000 });
  assert.equal(egData.localCurrencyHint, null);
  assert.match(String(egRes.headers.get('cache-control') || ''), /no-store/i);

  const saRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'SA' },
  });
  const saData = await saRes.json();
  assert.equal(saRes.status, 200);
  assert.equal(saData.currency, 'USD');
  assert.equal(saData.region, 'GCC');
  assert.equal(saData.plans[0].pricePerSessionMinor, 350);
  assert.equal(saData.localCurrencyHint.code, 'SAR');

  const usRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'US' },
  });
  const usData = await usRes.json();
  assert.equal(usRes.status, 200);
  assert.equal(usData.currency, 'USD');
  assert.equal(usData.region, 'WEST');
  assert.equal(usData.plans[0].pricePerSessionMinor, 450);
  assert.equal(usData.localCurrencyHint, null);

  const defaultCatalog = publicPlanCatalog();
  assert.equal(defaultCatalog.currency, 'EGP');
  assert.equal(getTierForCountry('AE').localCurrencyHint.code, 'AED');
});
