/** أسعار صرف ثابتة نسبةً إلى USD — مرحلة V4.1 */
export const FX_TO_USD = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  SAR: 3.75,
  AED: 3.67,
  EGP: 48.5,
  TRY: 32.5,
  PKR: 278,
  IDR: 15800,
};

export const CURRENCY_LOCALE = {
  USD: 'en-US',
  EUR: 'fr-FR',
  GBP: 'en-GB',
  SAR: 'ar-SA',
  AED: 'ar-AE',
  EGP: 'ar-EG',
  TRY: 'tr-TR',
  PKR: 'ur-PK',
  IDR: 'id-ID',
};

export function convertPrice(amount, fromCurrency = 'USD', toCurrency = 'USD') {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  const usd = numeric / (FX_TO_USD[fromCurrency] || 1);
  const raw = usd * (FX_TO_USD[toCurrency] || 1);
  if (raw < 1) return Math.max(0.01, Math.round(raw * 100) / 100);
  return Math.round(raw);
}

export function formatPrice(amount, currency = 'USD', locale) {
  const loc = locale || CURRENCY_LOCALE[currency] || 'en-US';
  const hasFraction = !Number.isInteger(amount) && amount > 0 && amount < 10;
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(amount);
}
