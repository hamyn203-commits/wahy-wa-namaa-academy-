'use strict';

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { getAccessSecret } = require('./auth');

function extractActorKey(req) {
  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const verified = jwt.verify(token, getAccessSecret(), { algorithms: ['HS256'] });
        if (verified && typeof verified === 'object' && (verified.id || verified.sub)) {
          return `user:${String(verified.id || verified.sub)}`;
        }
      } catch {
        // Fall back to IP when token signature is invalid or expired
      }
    }
  }
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.USER_RATE_LIMIT_MAX || 300),
  keyGenerator: (req) => extractActorKey(req),
  skip: (req) => req.path === '/health' || req.path === '/readiness' || req.path === '/launch-readiness',
  message: {
    error: 'Too many requests from this account. Please slow down and try again shortly.',
    code: 'USER_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

function createScopedRateLimiter({ windowMs = 15 * 60 * 1000, max = 20, scope = 'scoped', message } = {}) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => `${scope}:${req.user?.id ? `user:${req.user.id}` : extractActorKey(req)}`,
    skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
    message: typeof message === 'string'
      ? { error: message, code: 'RATE_LIMIT_EXCEEDED' }
      : (message || { error: 'Too many requests. Please slow down and try again shortly.', code: 'RATE_LIMIT_EXCEEDED' }),
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });
}

module.exports = { userRateLimiter, extractActorKey, createScopedRateLimiter };
