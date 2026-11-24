export const DEFAULT_REGIONAL_PRICING = {
  loaded: false,
  countryCode: 'EG',
  region: 'EG',
  regionLabel: { ar: 'مصر', en: 'Egypt' },
  currency: 'EGP',
  localCurrencyHint: null,
  pricesMinor: {
    focused: 2000,
    mini: 4500,
    private: 8000,
    private_intensive: 15000,
    // Legacy renewal fallbacks
    community: 1000,
    group: 2000,
  },
  packPricesMinor: {
    focused: {
      8: 2500,
      12: 2000,
      24: 2000,
    },
  },
  minPriceMinor: 2000,
};

export function resolveRegionalPlanPriceMinor(regionalPricing, planKey, sessionCount, fallbackMajor = 0) {
  const packOverride = regionalPricing?.packPricesMinor?.[planKey]?.[sessionCount];
  if (packOverride != null && Number.isFinite(Number(packOverride)) && Number(packOverride) > 0) {
    return Number(packOverride);
  }
  const baseMinor = regionalPricing?.pricesMinor?.[planKey];
  if (baseMinor != null && Number.isFinite(Number(baseMinor)) && Number(baseMinor) > 0) {
    return Number(baseMinor);
  }
  return Math.round(Number(fallbackMajor || 0) * 100);
}

export function formatMajorNumber(minorUnits) {
  const major = Number(minorUnits || 0) / 100;
  if (!Number.isFinite(major)) return '0';
  if (Number.isInteger(major)) return String(major);
  return major.toFixed(2).replace(/0$/, '');
}

export function formatRegionalMoney(minorUnits, currency = 'EGP', locale = 'ar') {
  const major = Number(minorUnits || 0) / 100;
  if (!Number.isFinite(major)) return '';
  const isAr = locale === 'ar';
  const numStr = formatMajorNumber(minorUnits);

  if (currency === 'USD') {
    return `$${numStr}`;
  }

  return isAr ? `${numStr} ج.م` : `${numStr} EGP`;
}

export function currencyLabelsFor(currency = 'EGP', isRTL = true) {
  if (currency === 'USD') {
    return isRTL
      ? { long: 'دولار', short: '$' }
      : { long: 'USD', short: 'USD' };
  }
  return isRTL
    ? { long: 'جنيه', short: 'ج.م' }
    : { long: 'EGP', short: 'EGP' };
}

export function usdLocalEquivalentNote(isRTL = true) {
  return isRTL
    ? 'السعر بالدولار الأمريكي أو ما يعادله بالعملة المحلية'
    : 'Price is in USD or its equivalent in your local currency';
}

export function formatLocalEquivalent(minorUnits, currency, hint, isRTL = true) {
  if (currency !== 'USD' || !hint || !hint.ratePerUsd) return '';
  const usd = Number(minorUnits || 0) / 100;
  if (!Number.isFinite(usd) || usd <= 0) return '';
  const localRaw = usd * Number(hint.ratePerUsd);
  const rounded = localRaw >= 100
    ? Math.round(localRaw).toLocaleString(isRTL ? 'ar-EG' : 'en-US')
    : (Math.round(localRaw * 10) / 10).toString();
  const symbol = isRTL ? (hint.symbolAr || hint.code) : (hint.symbolEn || hint.code);
  return `≈ ${rounded} ${symbol}`;
}

export function normalizeCatalogToRegionalPricing(catalog) {
  if (!catalog || !Array.isArray(catalog.plans) || catalog.plans.length === 0) {
    return DEFAULT_REGIONAL_PRICING;
  }

  const pricesMinor = { ...DEFAULT_REGIONAL_PRICING.pricesMinor };
  const packPricesMinor = {};
  let minPriceMinor = Infinity;
  for (const plan of catalog.plans) {
    if (plan?.key && Number.isFinite(Number(plan.pricePerSessionMinor))) {
      const val = Number(plan.pricePerSessionMinor);
      pricesMinor[plan.key] = val;
      if (val < minPriceMinor) minPriceMinor = val;
      if (plan.packPricesMinor && typeof plan.packPricesMinor === 'object') {
        packPricesMinor[plan.key] = { ...plan.packPricesMinor };
      }
    }
  }

  return {
    loaded: true,
    countryCode: catalog.countryCode || 'EG',
    region: catalog.region || 'EG',
    regionLabel: catalog.regionLabel || DEFAULT_REGIONAL_PRICING.regionLabel,
    currency: catalog.currency === 'USD' ? 'USD' : 'EGP',
    localCurrencyHint: catalog.localCurrencyHint || null,
    pricesMinor,
    packPricesMinor,
    minPriceMinor: Number.isFinite(minPriceMinor) ? minPriceMinor : DEFAULT_REGIONAL_PRICING.minPriceMinor,
  };
}
