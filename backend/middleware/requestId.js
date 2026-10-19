/**
 * Request ID Middleware — Wahy Wa Namaa Academy
 *
 * Assigns a unique correlation ID to every incoming request for end-to-end
 * tracing across logs, errors, and responses. An incoming `X-Request-ID`
 * header is honoured only when it matches a strict safe format (length and
 * charset), so a client cannot inject arbitrary text into logs or response
 * headers; anything else is replaced with a generated ID.
 *
 * The ID is:
 * - Available as `req.requestId`
 * - Returned in the `X-Request-ID` response header
 * - Attached to `req.log` as a child logger with the request context
 */

const { generateRequestId } = require('../utils/logger');
const logger = require('../utils/logger');

// Hex/UUID-like identifiers only: 8-64 chars of [0-9a-fA-F-]
const SAFE_REQUEST_ID = /^[0-9a-fA-F-]{8,64}$/;

function requestId(req, res, next) {
  const incoming = String(req.headers['x-request-id'] || '');
  const id = SAFE_REQUEST_ID.test(incoming) ? incoming : generateRequestId();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);

  // Create a child logger scoped to this request
  req.log = logger.child({
    requestId: id,
    method: req.method,
    path: req.path,
  });

  next();
}

module.exports = { requestId };
