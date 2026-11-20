'use strict';

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getAccessSecret } = require('./auth');
const VerificationLedger = require('../models/VerificationLedger');

function resolveClientIp(req) {
  if (process.env.VERCEL) {
    const vercelIp = String(req.headers?.['x-vercel-forwarded-for'] || '').split(',')[0].trim();
    if (vercelIp) return vercelIp.slice(0, 64);
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

function extractActorKey(req) {
  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const verified = jwt.verify(token, getAccessSecret(), { algorithms: ['HS256'] });
        if (
          verified
          && typeof verified === 'object'
          && verified.typ === 'access'
          && verified.purpose === undefined
          && (verified.id || verified.sub)
        ) {
          return `user:${String(verified.id || verified.sub)}`;
        }
      } catch {
        // Fall back to IP when token signature is invalid or expired
      }
    }
  }
  return `ip:${resolveClientIp(req)}`;
}

const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.USER_RATE_LIMIT_MAX || 600),
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

function createDistributedRateLimiter({ windowMs = 15 * 60 * 1000, max = 8, scope = 'auth', message, skip } = {}) {
  const memoryFallback = rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => `${scope}:${resolveClientIp(req)}`,
    skip: (req) => process.env.DISABLE_RATE_LIMIT === 'true' || Boolean(skip?.(req)),
    message,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });

  return async function distributedLimiterMiddleware(req, res, next) {
    if (process.env.DISABLE_RATE_LIMIT === 'true' || Boolean(skip?.(req))) {
      return next();
    }
    const canUseDb = mongoose.connection?.readyState === 1 && Boolean(mongoose.connection?.db);
    if (!canUseDb) {
      return memoryFallback(req, res, next);
    }

    try {
      const now = Date.now();
      const bucket = Math.floor(now / windowMs);
      const ledgerKey = `${scope}:${bucket}:${resolveClientIp(req)}`;
      const expiresAt = new Date((bucket + 1) * windowMs + 5000);
      const doc = await VerificationLedger.findOneAndUpdate(
        { kind: 'rate_limit', key: ledgerKey },
        {
          $inc: { count: 1 },
          $setOnInsert: { windowStart: new Date(bucket * windowMs), expiresAt },
        },
        { upsert: true, new: true }
      );
      if (Number(doc?.count || 0) > max) {
        const retrySeconds = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
        res.setHeader('Retry-After', String(retrySeconds));
        return res.status(429).json(
          typeof message === 'object' && message !== null
            ? message
            : { error: String(message || 'Too many requests, please try again later.') }
        );
      }
      return next();
    } catch {
      return memoryFallback(req, res, next);
    }
  };
}

module.exports = {
  userRateLimiter,
  extractActorKey,
  resolveClientIp,
  createScopedRateLimiter,
  createDistributedRateLimiter,
};
