/**
 * Structured Logger — Wahy Wa Namaa Academy
 *
 * Production-grade structured logging utility that outputs JSON log entries
 * for easy parsing by log aggregation services (LogDNA, Papertrail, Datadog).
 *
 * Features:
 * - Log levels: debug, info, warn, error, fatal
 * - Automatic PII masking (emails, phones, tokens, passwords)
 * - Request correlation IDs for tracing
 * - Child loggers with persistent context
 * - Environment-aware (JSON in production, pretty in development)
 * - Performance-safe (no-op for levels below threshold)
 */

const crypto = require('crypto');

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

const LEVEL_THRESHOLD = LOG_LEVELS[process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')];

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Patterns that should never appear in logs
const PII_PATTERNS = [
  { regex: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, replacement: '[EMAIL]' },
  { regex: /(\+?\d[\d\s-]{8,}\d)/g, replacement: '[PHONE]' },
  { regex: /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, replacement: '[JWT]' },
  { regex: /(Bearer\s+)\S+/gi, replacement: '$1[REDACTED]' },
  { regex: /"(password|secret|token|apiKey|api_key|authorization)":\s*"[^"]*"/gi, replacement: '"$1":"[REDACTED]"' },
];

function maskPII(value) {
  if (typeof value !== 'string') return value;
  let masked = value;
  for (const { regex, replacement } of PII_PATTERNS) {
    // Reset regex lastIndex for global patterns
    regex.lastIndex = 0;
    masked = masked.replace(regex, replacement);
  }
  return masked;
}

function deepMask(obj, depth = 0) {
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskPII(obj);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: maskPII(obj.message),
      stack: IS_PRODUCTION ? undefined : maskPII(obj.stack),
      ...(obj.code ? { code: obj.code } : {}),
    };
  }
  if (Array.isArray(obj)) return obj.slice(0, 20).map(item => deepMask(item, depth + 1));

  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (lk.includes('password') || lk.includes('secret') || lk.includes('token') || lk.includes('apikey') || lk === 'authorization') {
      result[key] = '[REDACTED]';
    } else {
      result[key] = deepMask(val, depth + 1);
    }
  }
  return result;
}

function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

class Logger {
  constructor(context = {}) {
    this._context = context;
    this._service = context.service || 'wahy-api';
  }

  /**
   * Create a child logger with additional persistent context.
   * @param {Object} childContext - Additional context fields
   * @returns {Logger}
   */
  child(childContext) {
    return new Logger({ ...this._context, ...childContext });
  }

  _log(level, message, data = {}) {
    if (LOG_LEVELS[level] < LEVEL_THRESHOLD) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this._service,
      message: typeof message === 'string' ? maskPII(message) : message,
      ...this._context,
      ...(Object.keys(data).length > 0 ? { data: deepMask(data) } : {}),
    };

    // Remove undefined values
    for (const key of Object.keys(entry)) {
      if (entry[key] === undefined) delete entry[key];
    }

    const output = IS_PRODUCTION ? JSON.stringify(entry) : this._pretty(entry);

    if (LOG_LEVELS[level] >= LOG_LEVELS.error) {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  _pretty(entry) {
    const colors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      fatal: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';

    const color = colors[entry.level] || '';
    const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
    const ctx = entry.requestId ? ` ${dim}[${entry.requestId}]${reset}` : '';
    const module = entry.module ? ` ${dim}(${entry.module})${reset}` : '';

    let line = `${dim}${time}${reset} ${color}${entry.level.toUpperCase().padEnd(5)}${reset}${ctx}${module} ${entry.message}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      line += ` ${dim}${JSON.stringify(entry.data)}${reset}`;
    }

    return line;
  }

  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }
  fatal(message, data) { this._log('fatal', message, data); }
}

// Singleton root logger
const rootLogger = new Logger({ service: 'wahy-api' });

module.exports = rootLogger;
module.exports.Logger = Logger;
module.exports.generateRequestId = generateRequestId;
module.exports.maskPII = maskPII;
