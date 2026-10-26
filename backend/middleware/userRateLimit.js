'use strict';

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

function extractActorKey(req) {
  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && typeof decoded === 'object' && (decoded.id || decoded.sub)) {
          return `user:${String(decoded.id || decoded.sub)}`;
        }
      } catch {
        // Fall back to IP when token cannot be decoded
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

module.exports = { userRateLimiter, extractActorKey };
