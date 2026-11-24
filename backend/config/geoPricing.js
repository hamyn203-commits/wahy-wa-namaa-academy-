'use strict';

const GCC_COUNTRIES = new Set(['SA', 'AE', 'KW', 'QA', 'BH', 'OM']);

const WEST_COUNTRIES = new Set([
  'US', 'CA', 'GB', 'AU', 'NZ', 'IE',
  'DE', 'FR', 'NL', 'BE', 'AT', 'CH', 'LU',
  'SE', 'NO', 'DK', 'FI', 'IS',
  'ES', 'IT', 'PT', 'GR', 'MT', 'CY',
  'SG', 'JP', 'KR',
]);

// All amounts stored strictly in integer minor units (piastres for EGP, cents for USD).
const REGIONAL_TIERS = Object.freeze({
  EG: Object.freeze({
    region: 'EG',
    currency: 'EGP',
    label: Object.freeze({ ar: 'مصر', en: 'Egypt' }),
    pricesMinor: Object.freeze({
      focused: 2000,           // Starts at 20 EGP (12/24 sessions); 25 EGP on 8 sessions
      mini: 4500,              // 45 EGP (2–3 students, 45 min)
      private: 8000,           // 80 EGP (1-on-1, 30 min)
      private_intensive: 15000, // 150 EGP (1-on-1, 60 min)
      // Legacy renewal fallbacks
      community: 1000,
      group: 2000,
    }),
    packPricesMinor: Object.freeze({
      focused: Object.freeze({
        8: 2500,  // 25 EGP * 8 = 200 EGP/month
        12: 2000, // 20 EGP * 12 = 240 EGP/month
        24: 2000, // 20 EGP * 24 = 480 EGP/month
      }),
    }),
  }),
  GCC: Object.freeze({
    region: 'GCC',
    currency: 'USD',
    label: Object.freeze({ ar: 'دول الخليج العربي', en: 'Gulf Region (GCC)' }),
    pricesMinor: Object.freeze({
      focused: 350,            // $3.50
      mini: 550,               // $5.50
      private: 650,            // $6.50
      private_intensive: 1200, // $12.00
      community: 150,
      group: 250,
    }),
    packPricesMinor: Object.freeze({}),
  }),
  WEST: Object.freeze({
    region: 'WEST',
    currency: 'USD',
    label: Object.freeze({ ar: 'أوروبا وأمريكا وأستراليا', en: 'North America, Europe & Australia' }),
    pricesMinor: Object.freeze({
      focused: 450,            // $4.50
      mini: 700,               // $7.00
      private: 850,            // $8.50
      private_intensive: 1500, // $15.00
      community: 200,
      group: 300,
    }),
    packPricesMinor: Object.freeze({}),
  }),
  INTL: Object.freeze({
    region: 'INTL',
    currency: 'USD',
    label: Object.freeze({ ar: 'الدولي', en: 'International' }),
    pricesMinor: Object.freeze({
      focused: 250,            // $2.50
      mini: 400,               // $4.00
      private: 500,            // $5.00
      private_intensive: 900,  // $9.00
      community: 100,
      group: 150,
    }),
    packPricesMinor: Object.freeze({}),
  }),
});

// Display-only approximate local currency hints for USD-billed visitors.
const LOCAL_CURRENCY_HINTS = Object.freeze({
  SA: Object.freeze({ code: 'SAR', ratePerUsd: 3.75, symbolAr: 'ر.س', symbolEn: 'SAR' }),
  AE: Object.freeze({ code: 'AED', ratePerUsd: 3.67, symbolAr: 'د.إ', symbolEn: 'AED' }),
  KW: Object.freeze({ code: 'KWD', ratePerUsd: 0.31, symbolAr: 'د.ك', symbolEn: 'KWD' }),
  QA: Object.freeze({ code: 'QAR', ratePerUsd: 3.64, symbolAr: 'ر.ق', symbolEn: 'QAR' }),
  BH: Object.freeze({ code: 'BHD', ratePerUsd: 0.38, symbolAr: 'د.ب', symbolEn: 'BHD' }),
  OM: Object.freeze({ code: 'OMR', ratePerUsd: 0.385, symbolAr: 'ر.ع', symbolEn: 'OMR' }),
  GB: Object.freeze({ code: 'GBP', ratePerUsd: 0.79, symbolAr: '£', symbolEn: '£' }),
  DE: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  FR: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  NL: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  BE: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  AT: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  ES: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  IT: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  PT: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  IE: Object.freeze({ code: 'EUR', ratePerUsd: 0.92, symbolAr: '€', symbolEn: '€' }),
  CA: Object.freeze({ code: 'CAD', ratePerUsd: 1.38, symbolAr: 'C$', symbolEn: 'CAD' }),
  AU: Object.freeze({ code: 'AUD', ratePerUsd: 1.53, symbolAr: 'A$', symbolEn: 'AUD' }),
  TR: Object.freeze({ code: 'TRY', ratePerUsd: 34, symbolAr: '₺', symbolEn: 'TRY' }),
  MY: Object.freeze({ code: 'MYR', ratePerUsd: 4.4, symbolAr: 'RM', symbolEn: 'MYR' }),
  ID: Object.freeze({ code: 'IDR', ratePerUsd: 15800, symbolAr: 'Rp', symbolEn: 'IDR' }),
  PK: Object.freeze({ code: 'PKR', ratePerUsd: 278, symbolAr: 'PKR', symbolEn: 'PKR' }),
  JO: Object.freeze({ code: 'JOD', ratePerUsd: 0.71, symbolAr: 'د.أ', symbolEn: 'JOD' }),
  MA: Object.freeze({ code: 'MAD', ratePerUsd: 10, symbolAr: 'د.م', symbolEn: 'MAD' }),
});

function normalizeCountryCode(raw) {
  const clean = String(raw || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean) && clean !== 'XX' && clean !== 'T1') {
    return clean;
  }
  return '';
}

function resolveRegionForCountry(countryCode) {
  const code = normalizeCountryCode(countryCode) || 'EG';
  if (code === 'EG') return 'EG';
  if (GCC_COUNTRIES.has(code)) return 'GCC';
  if (WEST_COUNTRIES.has(code)) return 'WEST';
  return 'INTL';
}

function getTierForCountry(countryCode) {
  const normalizedCode = normalizeCountryCode(countryCode) || 'EG';
  const region = resolveRegionForCountry(normalizedCode);
  const tier = REGIONAL_TIERS[region] || REGIONAL_TIERS.EG;
  return {
    countryCode: normalizedCode,
    region: tier.region,
    currency: tier.currency,
    regionLabel: tier.label,
    pricesMinor: tier.pricesMinor,
    packPricesMinor: tier.packPricesMinor || {},
    localCurrencyHint: tier.currency === 'USD' ? (LOCAL_CURRENCY_HINTS[normalizedCode] || null) : null,
  };
}

/**
 * Server-enforced Geo-IP country resolution:
 * - Production trusts ONLY platform edge headers (Vercel / Cloudflare) so users cannot
 *   spoof Egypt pricing via query strings or custom browser headers.
 * - Development/test allows ?country=SA or x-mock-country for local QA testing.
 */
function detectCountryFromRequest(req) {
  const headers = req?.headers || {};
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const queryCountry = normalizeCountryCode(req?.query?.country);
    if (queryCountry) return queryCountry;
    const mockHeader = normalizeCountryCode(headers['x-mock-country']);
    if (mockHeader) return mockHeader;
  }

  const vercelCountry = normalizeCountryCode(headers['x-vercel-ip-country']);
  if (vercelCountry) return vercelCountry;

  const cfCountry = normalizeCountryCode(headers['cf-ipcountry']);
  if (cfCountry) return cfCountry;

  if (process.env.TRUST_PROXY_COUNTRY_HEADER === 'true') {
    const proxyCountry = normalizeCountryCode(headers['x-country-code']);
    if (proxyCountry) return proxyCountry;
  }

  return normalizeCountryCode(process.env.DEFAULT_PRICING_COUNTRY) || 'EG';
}

module.exports = {
  GCC_COUNTRIES,
  WEST_COUNTRIES,
  REGIONAL_TIERS,
  LOCAL_CURRENCY_HINTS,
  normalizeCountryCode,
  resolveRegionForCountry,
  getTierForCountry,
  detectCountryFromRequest,
};
