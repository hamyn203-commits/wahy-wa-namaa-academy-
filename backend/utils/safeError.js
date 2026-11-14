'use strict';

const INTERNAL_LEAK_PATTERN = /(?:Mongo|E11000|Cast to ObjectId|BSON|ENOENT|EACCES|EPERM|ECONN|ETIMEDOUT|node_modules|[A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|at\s+\S+\s*\()/i;

function safeErrorMessage(error, status = 500, fallback) {
  const code = Number(status) || 500;
  const defaultMsg = fallback || (code >= 500 ? 'Internal server error' : 'Request could not be processed');

  if (!error) return defaultMsg;

  if (code >= 500 && error.expose !== true) {
    return defaultMsg;
  }

  const raw = typeof error.message === 'string' ? error.message.trim() : '';
  if (!raw || INTERNAL_LEAK_PATTERN.test(raw)) {
    return defaultMsg;
  }

  return raw.slice(0, 200);
}

module.exports = { safeErrorMessage };
