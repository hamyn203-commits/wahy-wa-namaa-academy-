'use strict';

const SUPPORTED_CURRENCIES = Object.freeze(['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP']);
const ZERO_DECIMAL_CURRENCIES = new Set([]);

const PAYMENT_STATUSES = Object.freeze([
  'created',
  'pending',
  'succeeded',
  'partially_refunded',
  'failed',
  'cancelled',
  'refunded',
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  created: new Set(['pending', 'failed', 'cancelled']),
  pending: new Set(['succeeded', 'failed', 'cancelled']),
  succeeded: new Set(['partially_refunded', 'refunded']),
  partially_refunded: new Set(['partially_refunded', 'refunded']),
  failed: new Set(['succeeded']),
  cancelled: new Set([]),
  refunded: new Set([]),
});

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error('Unsupported payment currency');
  }
  return currency;
}

function toMinorUnits(amount, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const exponent = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 0 : 2;
  const factor = 10 ** exponent;
  const minor = Math.round((numericAmount + Number.EPSILON) * factor);

  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new Error('Payment amount is outside the supported range');
  }

  return minor;
}

function canTransitionPayment(currentStatus, nextStatus) {
  const current = String(currentStatus || '');
  const next = String(nextStatus || '');
  return Boolean(ALLOWED_TRANSITIONS[current]?.has(next));
}

function assertPaymentTransition(currentStatus, nextStatus) {
  if (!PAYMENT_STATUSES.includes(String(currentStatus || ''))) {
    throw new Error('Unknown current payment status');
  }
  if (!PAYMENT_STATUSES.includes(String(nextStatus || ''))) {
    throw new Error('Unknown target payment status');
  }
  if (!canTransitionPayment(currentStatus, nextStatus)) {
    const error = new Error(`Invalid payment transition: ${currentStatus} -> ${nextStatus}`);
    error.code = 'INVALID_PAYMENT_TRANSITION';
    throw error;
  }
  return true;
}

function providerEventKey(provider, eventId) {
  const cleanProvider = String(provider || '').trim().toLowerCase();
  const cleanEventId = String(eventId || '').trim();

  if (!cleanProvider || !cleanEventId) {
    throw new Error('Provider and event id are required');
  }

  return `${cleanProvider}:${cleanEventId}`;
}

module.exports = {
  SUPPORTED_CURRENCIES,
  PAYMENT_STATUSES,
  ALLOWED_TRANSITIONS,
  normalizeCurrency,
  toMinorUnits,
  canTransitionPayment,
  assertPaymentTransition,
  providerEventKey,
};