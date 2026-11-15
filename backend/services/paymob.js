'use strict';

const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://accept.paymob.com';
const ALLOWED_HOSTS = new Set([
  'accept.paymob.com',
  'oman.paymob.com',
  'ksa.paymob.com',
  'uae.paymob.com',
]);

function normalizeBaseUrl(value = process.env.PAYMOB_BASE_URL || DEFAULT_BASE_URL) {
  const parsed = new URL(String(value || DEFAULT_BASE_URL).trim());
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('Unsupported Paymob base URL');
  }
  return parsed.origin;
}

function getIntegrationIds() {
  const raw = process.env.PAYMOB_INTEGRATION_IDS
    || process.env.PAYMOB_INTEGRATION_ID_CARD
    || '';

  return [...new Set(
    String(raw)
      .split(',')
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isSafeInteger(value) && value > 0)
  )];
}

function getConfig() {
  let baseUrl = DEFAULT_BASE_URL;
  try {
    baseUrl = normalizeBaseUrl();
  } catch {
    baseUrl = '';
  }

  return {
    enabled: process.env.PAYMOB_ENABLED === 'true',
    baseUrl,
    secretKey: String(process.env.PAYMOB_SECRET_KEY || '').trim(),
    publicKey: String(process.env.PAYMOB_PUBLIC_KEY || '').trim(),
    hmacSecret: String(process.env.PAYMOB_HMAC_SECRET || '').trim(),
    integrationIds: getIntegrationIds(),
  };
}

function isConfigured() {
  const config = getConfig();
  return Boolean(
    config.enabled
    && config.baseUrl
    && config.secretKey
    && config.publicKey
    && config.hmacSecret
    && config.integrationIds.length
  );
}

function requireConfig() {
  const config = getConfig();
  if (!isConfigured()) {
    const error = new Error('Paymob is not configured');
    error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  return config;
}

function splitCustomerName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Customer', lastName: 'Customer' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function transactionHmacValues(obj) {
  return [
    obj?.amount_cents,
    obj?.created_at,
    obj?.currency,
    obj?.error_occured,
    obj?.has_parent_transaction,
    obj?.id,
    obj?.integration_id,
    obj?.is_3d_secure,
    obj?.is_auth,
    obj?.is_capture,
    obj?.is_refunded,
    obj?.is_standalone_payment,
    obj?.is_voided,
    obj?.order?.id,
    obj?.owner,
    obj?.pending,
    obj?.source_data?.pan,
    obj?.source_data?.sub_type,
    obj?.source_data?.type,
    obj?.success,
  ];
}

function computeTransactionHmac(obj, secret) {
  const values = transactionHmacValues(obj);
  if (values.some((value) => value === undefined || value === null)) {
    return '';
  }

  const signed = values.map(String).join('');
  return crypto
    .createHmac('sha512', String(secret || ''))
    .update(signed)
    .digest('hex');
}

function timingSafeHexEqual(left, right) {
  const a = String(left || '').toLowerCase();
  const b = String(right || '').toLowerCase();
  if (!/^[a-f0-9]+$/.test(a) || !/^[a-f0-9]+$/.test(b) || a.length !== b.length) {
    return false;
  }

  const aa = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function verifyTransactionPostHmac(obj, receivedHmac, secret = getConfig().hmacSecret) {
  const computed = computeTransactionHmac(obj, secret);
  return Boolean(computed && timingSafeHexEqual(computed, receivedHmac));
}

function classifyTransaction(obj) {
  if (obj?.is_refunded === true) return 'refunded';
  if (obj?.is_voided === true) return 'cancelled';
  if (obj?.pending === true) return 'pending';
  if (obj?.success === true && obj?.pending === false) return 'succeeded';
  if (obj?.success === false && obj?.pending === false) return 'failed';
  return 'ignored';
}

function checkoutUrl(clientSecret, config = requireConfig()) {
  const secret = String(clientSecret || '').trim();
  if (!secret) throw new Error('Paymob client secret is required');

  const params = new URLSearchParams({
    publicKey: config.publicKey,
    clientSecret: secret,
  });

  return `${config.baseUrl}/unifiedcheckout/?${params.toString()}`;
}

async function createIntention(input, options = {}) {
  const config = requireConfig();
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 12000));

  const payload = {
    amount: input.amountMinor,
    currency: input.currency,
    payment_methods: config.integrationIds,
    items: input.items || [],
    billing_data: {
      first_name: input.customer.firstName,
      last_name: input.customer.lastName,
      email: input.customer.email,
      phone_number: input.customer.phone,
      apartment: 'NA',
      floor: 'NA',
      street: 'NA',
      building: 'NA',
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'NA',
      state: 'NA',
      country: input.customer.country || 'EGY',
    },
    customer: {
      first_name: input.customer.firstName,
      last_name: input.customer.lastName,
      email: input.customer.email,
    },
    special_reference: input.specialReference,
    expiration: Number(input.expiration || 3600),
    notification_url: input.notificationUrl,
    redirection_url: input.redirectionUrl,
  };

  try {
    const response = await fetchImpl(`${config.baseUrl}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.id || !data?.client_secret) {
      const error = new Error('Paymob intention creation failed');
      error.code = 'PAYMENT_PROVIDER_ERROR';
      error.status = response.status;
      throw error;
    }

    const resolvedOrderId = data.intention_order_id ?? data.order_id ?? data.payment_keys?.[0]?.order_id ?? null;

    return {
      id: String(data.id),
      orderId: resolvedOrderId == null ? '' : String(resolvedOrderId),
      clientSecret: String(data.client_secret),
      checkoutUrl: checkoutUrl(String(data.client_secret), config),
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Paymob request timed out');
      timeoutError.code = 'PAYMENT_PROVIDER_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  DEFAULT_BASE_URL,
  ALLOWED_HOSTS,
  normalizeBaseUrl,
  getIntegrationIds,
  getConfig,
  isConfigured,
  requireConfig,
  splitCustomerName,
  transactionHmacValues,
  computeTransactionHmac,
  verifyTransactionPostHmac,
  classifyTransaction,
  checkoutUrl,
  createIntention,
};
