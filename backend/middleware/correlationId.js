'use strict';

const crypto = require('crypto');

const SAFE_ID_PATTERN = /^[a-zA-Z0-9._-]{8,64}$/;

function correlationId(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || req.headers['x-correlation-id'] || '').trim();
  const requestId = SAFE_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = correlationId;
