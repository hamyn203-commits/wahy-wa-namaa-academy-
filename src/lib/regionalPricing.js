export const DEFAULT_REGIONAL_PRICING = {
  loaded: false,
  countryCode: 'EG',
  region: 'EG',
  regionLabel: { ar: 'مصر', en: 'Egypt' },
  currency: 'EGP',
  localCurrencyHint: null,
  pricesMinor: {
    focused: 1900,
    mini: 3500,
    private: 6000,
    private_intensive: 11000,
    // Legacy renewal fallbacks
    community: 1000,
    group: 2000,
  },
  basePricesMinor: {
    focused: 2500,
    mini: 4500,
    private: 8500,
    private_intensive: 15000,
    community: 1000,
    group: 2000,
  },
  packPricesMinor: {
    focused: {
      8: 2500,
      12: 2000,
      24: 1900,
    },
    mini: {
      8: 4500,
      12: 3900,
      24: 3500,
    },
    private: {
      4: 8500,
      8: 7500,
      12: 6900,
      24: 6000,
    },
    private_intensive: {
      4: 15000,
      8: 13500,
      12: 12500,
      24: 11000,
    },
  },
  minPriceMinor: 1900,
};

function isPositiveFinite(val) {
  return val != null && Number.isFinite(Number(val)) && Number(val) > 0;
}

export function resolveRegionalPlanPriceMinor(regionalPricing, planKey, sessionCount, fallbackMajor = 0) {
  const packOverride = regionalPricing?.packPricesMinor?.[planKey]?.[sessionCount];
  if (isPositiveFinite(packOverride)) {
    return Number(packOverride);
  }
  const baseMinor = regionalPricing?.pricesMinor?.[planKey];
  if (isPositiveFinite(baseMinor)) {
    return Number(baseMinor);
  }
  return Math.round(Number(fallbackMajor || 0) * 100);
}

export function resolveRegionalAnchorPriceMinor(regionalPricing, planKey, fallbackAnchorMajor = 0) {
  const anchorMinor = regionalPricing?.basePricesMinor?.[planKey];
  if (isPositiveFinite(anchorMinor)) {
    return Number(anchorMinor);
  }
  const packs = regionalPricing?.packPricesMinor?.[planKey];
  if (packs && typeof packs === 'object') {
    const vals = Object.values(packs).map(Number).filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length > 0) return Math.max(...vals);
  }
  if (isPositiveFinite(fallbackAnchorMajor)) {
    return Math.round(Number(fallbackAnchorMajor) * 100);
  }
  return resolveRegionalPlanPriceMinor(regionalPricing, planKey, 4, 0);
}

export function resolveRegionalPlanSavings(
  regionalPricing,
  planKey,
  sessionCount,
  fallbackMajor = 0,
  fallbackAnchorMajor = 0
) {
  const priceMinor = resolveRegionalPlanPriceMinor(regionalPricing, planKey, sessionCount, fallbackMajor);
  const anchorMinor = Math.max(
    priceMinor,
    resolveRegionalAnchorPriceMinor(regionalPricing, planKey, fallbackAnchorMajor || fallbackMajor)
  );
  const savingsPerSessionMinor = Math.max(0, anchorMinor - priceMinor);
  const count = Math.max(1, Number(sessionCount || 1));
  const totalSavingsMinor = savingsPerSessionMinor * count;
  const savingsPercent = anchorMinor > priceMinor
    ? Math.round((savingsPerSessionMinor / anchorMinor) * 100)
    : 0;

  return {
    priceMinor,
    anchorMinor,
    savingsPerSessionMinor,
    totalSavingsMinor,
    savingsPercent,
  };
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

export function formatCourseRegionalDisplay(course, locale = 'ar', isRTL = true) {
  const rp = course?.regionalPricing;
  const currency = rp?.currency
    ? (rp.currency === 'USD' ? 'USD' : 'EGP')
    : (String(course?.currency || 'USD').toUpperCase() === 'EGP' ? 'EGP' : 'USD');

  const rawPrice = rp && rp.price !== undefined && rp.price !== null
    ? Number(rp.price)
    : Number(course?.price ?? 0);
  const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  const amountMinor = Math.round(price * 100);
  const isFree = amountMinor === 0;

  const rawCompare = rp?.compareAtPrice != null ? Number(rp.compareAtPrice) : null;
  const compareAtPrice = rawCompare != null && Number.isFinite(rawCompare) && rawCompare > price
    ? rawCompare
    : null;
  const discountPercent = compareAtPrice
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0;

  const localHint = !isFree && currency === 'USD'
    ? formatLocalEquivalent(amountMinor, currency, rp?.localCurrencyHint || null, isRTL)
    : '';

  return {
    price,
    currency,
    amountMinor,
    isFree,
    compareAtPrice,
    discountPercent,
    formattedPrice: isFree ? '' : formatRegionalMoney(amountMinor, currency, locale),
    formattedCompareAt: compareAtPrice ? formatRegionalMoney(Math.round(compareAtPrice * 100), currency, locale) : '',
    localHint,
  };
}

export function normalizeCatalogToRegionalPricing(catalog) {
  if (!catalog || !Array.isArray(catalog.plans) || catalog.plans.length === 0) {
    return DEFAULT_REGIONAL_PRICING;
  }

  const pricesMinor = { ...DEFAULT_REGIONAL_PRICING.pricesMinor };
  const basePricesMinor = { ...DEFAULT_REGIONAL_PRICING.basePricesMinor };
  const packPricesMinor = {};
  let minPriceMinor = Infinity;
  for (const plan of catalog.plans) {
    if (plan?.key && Number.isFinite(Number(plan.pricePerSessionMinor))) {
      const val = Number(plan.pricePerSessionMinor);
      pricesMinor[plan.key] = val;
      if (isPositiveFinite(plan.basePricePerSessionMinor)) {
        basePricesMinor[plan.key] = Number(plan.basePricePerSessionMinor);
      } else {
        basePricesMinor[plan.key] = val;
      }
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
    basePricesMinor,
    packPricesMinor,
    minPriceMinor: Number.isFinite(minPriceMinor) ? minPriceMinor : DEFAULT_REGIONAL_PRICING.minPriceMinor,
  };
}
