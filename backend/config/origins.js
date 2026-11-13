function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function configuredOrigins() {
  const origins = new Set();

  for (const value of String(process.env.ALLOWED_ORIGINS || '').split(',')) {
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  }

  for (const name of ['FRONTEND_URL', 'SITE_URL']) {
    const origin = normalizeOrigin(process.env[name]);
    if (origin) origins.add(origin);
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://localhost:5174');
    origins.add('http://localhost:5175');
  }

  return origins;
}

function isTrustedOrigin(origin) {
  if (!origin) return process.env.NODE_ENV !== 'production';

  const normalized = normalizeOrigin(origin);
  if (configuredOrigins().has(normalized)) return true;

  if (
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/i.test(normalized)
  ) {
    return true;
  }

  if (
    process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true' &&
    /^https:\/\/wahy-wa-namaa-academy(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

function requireTrustedOrigin(req, res, next) {
  if (isTrustedOrigin(req.headers.origin)) return next();

  return res.status(403).json({
    error: 'Request origin is not allowed',
    code: 'UNTRUSTED_ORIGIN',
  });
}

module.exports = {
  configuredOrigins,
  isTrustedOrigin,
  requireTrustedOrigin,
};
