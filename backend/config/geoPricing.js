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
    // Lowest starting price per session (24-pack volume rate)
    pricesMinor: Object.freeze({
      focused: 1900,           // Starts at 19 EGP (24 sessions); 20 EGP on 12; 25 EGP on 8
      mini: 3500,              // Starts at 35 EGP (24 sessions); 39 EGP on 12; 45 EGP on 8
      private: 6000,           // Starts at 60 EGP (24 sessions); 69 EGP on 12; 75 EGP on 8; 85 EGP on 4
      private_intensive: 11000, // Starts at 110 EGP (24 sessions); 125 EGP on 12; 135 EGP on 8; 150 EGP on 4
      // Legacy renewal fallbacks
      community: 1000,
      group: 2000,
    }),
    // Anchor rate (smallest pack) used to compute honest volume savings %
    basePricesMinor: Object.freeze({
      focused: 2500,
      mini: 4500,
      private: 8500,
      private_intensive: 15000,
      community: 1000,
      group: 2000,
    }),
    packPricesMinor: Object.freeze({
      focused: Object.freeze({
        8: 2500,  // 25 EGP * 8 = 200 EGP/month
        12: 2000, // 20 EGP * 12 = 240 EGP/month (Save 20%)
        24: 1900, // 19 EGP * 24 = 456 EGP (Save 24%)
      }),
      mini: Object.freeze({
        8: 4500,  // 45 EGP * 8 = 360 EGP/month
        12: 3900, // 39 EGP * 12 = 468 EGP/month (Save 13%)
        24: 3500, // 35 EGP * 24 = 840 EGP (Save 22%)
      }),
      private: Object.freeze({
        4: 8500,  // 85 EGP * 4 = 340 EGP
        8: 7500,  // 75 EGP * 8 = 600 EGP/month (Save 12%)
        12: 6900, // 69 EGP * 12 = 828 EGP/month (Save 19%)
        24: 6000, // 60 EGP * 24 = 1440 EGP (Save 29%)
      }),
      private_intensive: Object.freeze({
        4: 15000, // 150 EGP * 4 = 600 EGP
        8: 13500, // 135 EGP * 8 = 1080 EGP/month (Save 10%)
        12: 12500, // 125 EGP * 12 = 1500 EGP/month (Save 17%)
        24: 11000, // 110 EGP * 24 = 2640 EGP (Save 27%)
      }),
    }),
  }),
  GCC: Object.freeze({
    region: 'GCC',
    currency: 'USD',
    label: Object.freeze({ ar: 'دول الخليج العربي', en: 'Gulf Region (GCC)' }),
    pricesMinor: Object.freeze({
      focused: 250,            // Starts at $2.50 (≈ 9.4 SAR)
      mini: 350,               // Starts at $3.50 (≈ 13.1 SAR)
      private: 375,            // Starts at $3.75 (≈ 14 SAR)
      private_intensive: 700,  // Starts at $7.00 (≈ 26 SAR)
      community: 150,
      group: 250,
    }),
    basePricesMinor: Object.freeze({
      focused: 325,
      mini: 450,
      private: 550,
      private_intensive: 1000,
      community: 150,
      group: 250,
    }),
    packPricesMinor: Object.freeze({
      focused: Object.freeze({
        8: 325,   // $26/mo (≈ 98 SAR)
        12: 275,  // $33/mo (≈ 124 SAR — Save 15%)
        24: 250,  // $60 (≈ 225 SAR — Save 23%)
      }),
      mini: Object.freeze({
        8: 450,   // $36/mo (≈ 135 SAR)
        12: 400,  // $48/mo (≈ 180 SAR — Save 11%)
        24: 350,  // $84 (≈ 315 SAR — Save 22%)
      }),
      private: Object.freeze({
        4: 550,   // $22
        8: 475,   // $38/mo (≈ 143 SAR — Save 14%)
        12: 425,  // $51/mo (≈ 191 SAR — Save 23%)
        24: 375,  // $90 (≈ 338 SAR — Save 32%)
      }),
      private_intensive: Object.freeze({
        4: 1000,  // $40
        8: 900,   // $72/mo (≈ 270 SAR — Save 10%)
        12: 800,  // $96/mo (≈ 360 SAR — Save 20%)
        24: 700,  // $168 (≈ 630 SAR — Save 30%)
      }),
    }),
  }),
  WEST: Object.freeze({
    region: 'WEST',
    currency: 'USD',
    label: Object.freeze({ ar: 'أوروبا وأمريكا وأستراليا', en: 'North America, Europe & Australia' }),
    pricesMinor: Object.freeze({
      focused: 275,            // Starts at $2.75
      mini: 425,               // Starts at $4.25
      private: 400,            // Starts at $4.00
      private_intensive: 800,  // Starts at $8.00
      community: 200,
      group: 300,
    }),
    basePricesMinor: Object.freeze({
      focused: 375,
      mini: 550,
      private: 650,
      private_intensive: 1200,
      community: 200,
      group: 300,
    }),
    packPricesMinor: Object.freeze({
      focused: Object.freeze({
        8: 375,   // $30/mo
        12: 325,  // $39/mo (Save 13%)
        24: 275,  // $66 (Save 27%)
      }),
      mini: Object.freeze({
        8: 550,   // $44/mo
        12: 475,  // $57/mo (Save 14%)
        24: 425,  // $102 (Save 23%)
      }),
      private: Object.freeze({
        4: 650,   // $26
        8: 525,   // $42/mo (Save 19%)
        12: 475,  // $57/mo (Save 27%)
        24: 400,  // $96 (Save 38%)
      }),
      private_intensive: Object.freeze({
        4: 1200,  // $48
        8: 1000,  // $80/mo (Save 17%)
        12: 900,   // $108/mo (Save 25%)
        24: 800,   // $192 (Save 33%)
      }),
    }),
  }),
  INTL: Object.freeze({
    region: 'INTL',
    currency: 'USD',
    label: Object.freeze({ ar: 'الدولي', en: 'International' }),
    pricesMinor: Object.freeze({
      focused: 175,            // Starts at $1.75
      mini: 275,               // Starts at $2.75
      private: 300,            // Starts at $3.00
      private_intensive: 550,  // Starts at $5.50
      community: 100,
      group: 150,
    }),
    basePricesMinor: Object.freeze({
      focused: 225,
      mini: 350,
      private: 450,
      private_intensive: 800,
      community: 100,
      group: 150,
    }),
    packPricesMinor: Object.freeze({
      focused: Object.freeze({
        8: 225,   // $18/mo
        12: 200,  // $24/mo (Save 11%)
        24: 175,  // $42 (Save 22%)
      }),
      mini: Object.freeze({
        8: 350,   // $28/mo
        12: 300,  // $36/mo (Save 14%)
        24: 275,  // $66 (Save 21%)
      }),
      private: Object.freeze({
        4: 450,   // $18
        8: 375,   // $30/mo (Save 17%)
        12: 325,  // $39/mo (Save 28%)
        24: 300,  // $72 (Save 33%)
      }),
      private_intensive: Object.freeze({
        4: 800,   // $32
        8: 700,   // $56/mo (Save 13%)
        12: 625,  // $75/mo (Save 22%)
        24: 550,  // $132 (Save 31%)
      }),
    }),
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
    basePricesMinor: tier.basePricesMinor || tier.pricesMinor,
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
