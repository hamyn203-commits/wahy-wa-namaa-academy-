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
  // Egypt -> EGP
  const eg = quoteSubscription({ planKey: 'community', sessionCount: 8, countryCode: 'EG' });
  assert.equal(eg.currency, 'EGP');
  assert.equal(eg.region, 'EG');
  assert.equal(eg.pricePerSessionMinor, 1000);
  assert.equal(eg.totalAmountMinor, 8000);

  // Saudi Arabia (GCC) -> USD ($1.50 * 8 = $12.00; private $8.50 * 8 = $68.00)
  const saCommunity = quoteSubscription({ planKey: 'community', sessionCount: 8, countryCode: 'SA' });
  assert.equal(saCommunity.currency, 'USD');
  assert.equal(saCommunity.region, 'GCC');
  assert.equal(saCommunity.pricePerSessionMinor, 150);
  assert.equal(saCommunity.totalAmountMinor, 1200);

  const saPrivate = quoteSubscription({ planKey: 'private', sessionCount: 8, countryCode: 'SA' });
  assert.equal(saPrivate.pricePerSessionMinor, 850);
  assert.equal(saPrivate.totalAmountMinor, 6800);

  // USA (WEST) -> USD ($2.00 * 8 = $16.00; private $10.00 * 8 = $80.00)
  const usCommunity = quoteSubscription({ planKey: 'community', sessionCount: 8, countryCode: 'US' });
  assert.equal(usCommunity.currency, 'USD');
  assert.equal(usCommunity.region, 'WEST');
  assert.equal(usCommunity.pricePerSessionMinor, 200);
  assert.equal(usCommunity.totalAmountMinor, 1600);

  const usPrivate = quoteSubscription({ planKey: 'private', sessionCount: 8, countryCode: 'US' });
  assert.equal(usPrivate.pricePerSessionMinor, 1000);
  assert.equal(usPrivate.totalAmountMinor, 8000);

  // Turkey (INTL) -> USD ($1.00 * 8 = $8.00; private $6.00 * 8 = $48.00)
  const trCommunity = quoteSubscription({ planKey: 'community', sessionCount: 8, countryCode: 'TR' });
  assert.equal(trCommunity.currency, 'USD');
  assert.equal(trCommunity.region, 'INTL');
  assert.equal(trCommunity.pricePerSessionMinor, 100);
  assert.equal(trCommunity.totalAmountMinor, 800);
});

test('Production detectCountryFromRequest ignores client query/mock spoofing and trusts only edge IP headers', () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    // Visitor from Saudi Arabia trying to spoof ?country=EG or x-mock-country: EG
    const spoofedReq = {
      query: { country: 'EG' },
      headers: {
        'x-mock-country': 'EG',
        'x-vercel-ip-country': 'SA',
      },
    };
    assert.equal(detectCountryFromRequest(spoofedReq), 'SA');

    // Cloudflare header fallback
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
  assert.equal(egData.plans[0].pricePerSessionMinor, 1000);
  assert.equal(egData.localCurrencyHint, null);
  assert.match(String(egRes.headers.get('cache-control') || ''), /no-store/i);

  const saRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'SA' },
  });
  const saData = await saRes.json();
  assert.equal(saRes.status, 200);
  assert.equal(saData.currency, 'USD');
  assert.equal(saData.region, 'GCC');
  assert.equal(saData.plans[0].pricePerSessionMinor, 150);
  assert.equal(saData.localCurrencyHint.code, 'SAR');

  const usRes = await fetch(`${baseUrl}/api/subscriptions/plans`, {
    headers: { 'x-vercel-ip-country': 'US' },
  });
  const usData = await usRes.json();
  assert.equal(usRes.status, 200);
  assert.equal(usData.currency, 'USD');
  assert.equal(usData.region, 'WEST');
  assert.equal(usData.plans[0].pricePerSessionMinor, 200);
  assert.equal(usData.localCurrencyHint, null);

  // Verify publicPlanCatalog default backward compatibility
  const defaultCatalog = publicPlanCatalog();
  assert.equal(defaultCatalog.currency, 'EGP');
  assert.equal(getTierForCountry('AE').localCurrencyHint.code, 'AED');
});
