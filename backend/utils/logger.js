'use strict';

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'hmac',
  'credential',
  'proofreference',
  'storagereference',
]);

function maskEmail(email) {
  return String(email).replace(
    /\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    '$1***@$2'
  );
}

function maskPhoneString(str) {
  return String(str).replace(
    /(\+?\d{2,3})[\d\s-]{4,}(\d{2})\b/g,
    '$1****$2'
  );
}

function maskJwtString(str) {
  return String(str).replace(
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    '[REDACTED_JWT]'
  );
}

function maskPII(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return maskPhoneString(maskEmail(maskJwtString(value)));
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskPII(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower) || lower.includes('secret') || lower.includes('password') || lower.includes('token')) {
        out[key] = '[REDACTED]';
      } else if (lower.includes('email') && typeof item === 'string') {
        out[key] = maskEmail(item);
      } else if (lower.includes('phone') && typeof item === 'string') {
        out[key] = maskPhoneString(item);
      } else {
        out[key] = maskPII(item, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function emit(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: maskPII(String(message || '')),
    ...maskPII(meta),
  };
  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
  return entry;
}

const logger = {
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
  maskPII,
};

module.exports = logger;
