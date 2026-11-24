const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getTeacherAccessDecision } = require('../utils/teacherAccess');
const { isMockMode } = require('../config/runtime');
const { findMockUserById } = require('../mockStore');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const DEFAULT_JWT_SECRET = 'wahy-namaa-dev-access-secret-change-me';
const DEFAULT_REFRESH_SECRET = 'wahy-namaa-dev-refresh-secret-change-me';
const VALID_SESSION_ROLES = new Set(['student', 'teacher', 'admin', 'guardian', 'supervisor']);
const loggedOutAccessJtisFallback = new Map();

function markAccessJtiRevokedInMemory(jti, expSeconds) {
  if (!jti) return;
  const now = Date.now();
  if (loggedOutAccessJtisFallback.size > 5000) {
    for (const [key, expiresAt] of loggedOutAccessJtisFallback.entries()) {
      if (expiresAt <= now) loggedOutAccessJtisFallback.delete(key);
    }
  }
  const ttlMs = expSeconds ? Math.max(1000, expSeconds * 1000 - now) : 2 * 60 * 60 * 1000;
  loggedOutAccessJtisFallback.set(jti, now + ttlMs);
}

function isAccessJtiRevokedInMemory(jti) {
  if (!jti) return false;
  const expiresAt = loggedOutAccessJtisFallback.get(jti);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    loggedOutAccessJtisFallback.delete(jti);
    return false;
  }
  return true;
}

function isWeakProductionSecret(value) {
  const secret = String(value || '');
  if (secret.length < 32) return true;

  const normalized = secret.toLowerCase();
  return [
    'change-me',
    'changeme',
    'example',
    'dev-access',
    'dev-refresh',
    'development-secret',
    'al-athar',
    'super-secret',
    'placeholder',
    'your_',
  ].some((marker) => normalized.includes(marker));
}

function assertProductionSecretsValid() {
  const currentAccess = process.env.JWT_SECRET || JWT_SECRET;
  const currentRefresh = process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET;
  const invalidAccess = isWeakProductionSecret(currentAccess);
  const invalidRefresh = isWeakProductionSecret(currentRefresh);
  const sameSecret = Boolean(currentAccess && currentRefresh && currentAccess === currentRefresh);
  if (invalidAccess || invalidRefresh || sameSecret) {
    throw new Error('JWT access/refresh secrets must be unique, non-placeholder values of at least 32 characters.');
  }
}

if (process.env.NODE_ENV === 'production') {
  const invalidAccess = isWeakProductionSecret(JWT_SECRET);
  const invalidRefresh = isWeakProductionSecret(JWT_REFRESH_SECRET);
  const sameSecret = Boolean(JWT_SECRET && JWT_REFRESH_SECRET && JWT_SECRET === JWT_REFRESH_SECRET);

  if (invalidAccess || invalidRefresh || sameSecret) {
    console.error('❌ FATAL: JWT access/refresh secrets must be unique, non-placeholder values of at least 32 characters.');
    process.exit(1);
  }
}

const accessSecret = () => {
  if (process.env.NODE_ENV === 'production') assertProductionSecretsValid();
  return process.env.JWT_SECRET || JWT_SECRET || DEFAULT_JWT_SECRET;
};
const refreshSecret = () => {
  if (process.env.NODE_ENV === 'production') assertProductionSecretsValid();
  return process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET;
};

function isValidAccessPayload(decoded) {
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return false;
  if (decoded.typ !== 'access') return false;
  if (decoded.purpose !== undefined) return false;
  const rawId = String(decoded.id || '').trim();
  if (!rawId) return false;
  if (!VALID_SESSION_ROLES.has(String(decoded.role || ''))) return false;
  return true;
}

function isValidRefreshPayload(decoded) {
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return false;
  if (decoded.typ !== 'refresh') return false;
  if (decoded.purpose !== undefined) return false;
  const rawId = String(decoded.id || '').trim();
  if (!rawId) return false;
  return true;
}

const generateAccessToken = (user, options = {}) => {
  const expiresIn = options && options.mobile
    ? (process.env.JWT_MOBILE_ACCESS_EXPIRES_IN || '2h')
    : (process.env.JWT_EXPIRES_IN || '15m');
  return jwt.sign(
    {
      typ: 'access',
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      v: Number(user.refreshTokenVersion || 0),
      jti: crypto.randomUUID(),
    },
    accessSecret(),
    { expiresIn, algorithm: 'HS256' }
  );
};

const generateRefreshToken = (user, options = {}) => {
  const expiresIn = options && options.mobile
    ? (process.env.JWT_MOBILE_REFRESH_EXPIRES_IN || '90d')
    : (process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  return jwt.sign(
    {
      typ: 'refresh',
      id: user._id || user.id,
      role: user.role,
      v: Number(user.refreshTokenVersion || 0),
      jti: crypto.randomUUID(),
    },
    refreshSecret(),
    { expiresIn, algorithm: 'HS256' }
  );
};

async function loadLiveSessionState(userId) {
  if (!userId || !String(userId).trim()) return { mode: 'invalid', user: null };
  if (mongoose.connection.readyState === 1) {
    const User = require('../models/User');
    const query = User.findById(userId);
    let user = null;
    if (query && typeof query.select === 'function') {
      const selected = query.select('role isActive +refreshTokenVersion +sessionsRevokedAt +lockUntil +revokedAccessJtis');
      user = typeof selected?.lean === 'function' ? await selected.lean() : await selected;
    } else {
      user = await query;
    }
    return { mode: 'db', user };
  }
  if (isMockMode) {
    return { mode: 'mock', user: findMockUserById(userId) };
  }
  if (process.env.NODE_ENV === 'production') {
    return { mode: 'unavailable', user: null };
  }
  return { mode: 'stateless', user: null };
}

function evaluateRevocation(decoded, liveUser, mode) {
  if (mode === 'invalid') {
    return { status: 401, body: { error: 'Invalid token', code: 'INVALID_ACCESS_TOKEN' } };
  }
  if (mode === 'unavailable') {
    return {
      status: 503,
      body: {
        error: 'Authentication verification is temporarily unavailable',
        code: 'AUTH_CHECK_UNAVAILABLE',
      },
    };
  }
  if (mode === 'db' && !liveUser) {
    return { status: 401, body: { error: 'Invalid or revoked session', code: 'SESSION_REVOKED' } };
  }
  if (decoded?.jti && isAccessJtiRevokedInMemory(decoded.jti)) {
    return { status: 401, body: { error: 'Session has been revoked', code: 'SESSION_REVOKED' } };
  }
  if (!liveUser) return null;

  if (decoded?.jti && Array.isArray(liveUser.revokedAccessJtis) && liveUser.revokedAccessJtis.includes(decoded.jti)) {
    return { status: 401, body: { error: 'Session has been revoked', code: 'SESSION_REVOKED' } };
  }

  if (liveUser.isActive === false) {
    return { status: 403, body: { error: 'Account is deactivated. Please contact support.', code: 'ACCOUNT_DEACTIVATED' } };
  }
  if (liveUser.lockUntil && new Date(liveUser.lockUntil).getTime() > Date.now()) {
    return { status: 423, body: { error: 'Account is temporarily locked', code: 'ACCOUNT_LOCKED' } };
  }
  if (liveUser.role && decoded.role && liveUser.role !== decoded.role) {
    return { status: 401, body: { error: 'Session role invalidated', code: 'SESSION_REVOKED' } };
  }
  if (liveUser.refreshTokenVersion !== undefined && decoded.v !== undefined) {
    if (Number(liveUser.refreshTokenVersion || 0) !== Number(decoded.v || 0)) {
      return { status: 401, body: { error: 'Session has been revoked', code: 'SESSION_REVOKED' } };
    }
  }
  if (liveUser.sessionsRevokedAt && decoded.iat) {
    const revokedMs = new Date(liveUser.sessionsRevokedAt).getTime();
    if (Number.isFinite(revokedMs) && decoded.iat * 1000 < revokedMs - 1000) {
      return { status: 401, body: { error: 'Session has been revoked', code: 'SESSION_REVOKED' } };
    }
  }
  return null;
}

async function verifyAccessTokenString(token) {
  const decoded = jwt.verify(String(token || ''), accessSecret(), { algorithms: ['HS256'] });
  if (!isValidAccessPayload(decoded)) {
    const err = new Error('Invalid access token');
    err.status = 401;
    err.code = 'INVALID_ACCESS_TOKEN';
    throw err;
  }
  const { mode, user: liveUser } = await loadLiveSessionState(decoded?.id);
  const rejection = evaluateRevocation(decoded, liveUser, mode);
  if (rejection) {
    const err = new Error(rejection.body.error || 'Session revoked');
    err.status = rejection.status;
    err.code = rejection.body.code;
    throw err;
  }
  return { decoded, liveUser };
}

async function verifyLiveSessionPrincipal(userId, expectedRole, tokenIat, tokenVersion) {
  if (!userId || !String(userId).trim()) return false;
  const { mode, user: liveUser } = await loadLiveSessionState(userId);
  if (mode === 'invalid' || mode === 'unavailable') return false;
  if (mode === 'db' && !liveUser) return false;
  if (!liveUser) return process.env.NODE_ENV !== 'production';
  if (liveUser.isActive === false) return false;
  if (liveUser.lockUntil && new Date(liveUser.lockUntil).getTime() > Date.now()) return false;
  if (expectedRole && liveUser.role && liveUser.role !== expectedRole) return false;
  if (tokenVersion !== undefined && liveUser.refreshTokenVersion !== undefined) {
    if (Number(liveUser.refreshTokenVersion || 0) !== Number(tokenVersion || 0)) return false;
  }
  if (liveUser.sessionsRevokedAt && tokenIat) {
    const revokedMs = new Date(liveUser.sessionsRevokedAt).getTime();
    if (Number.isFinite(revokedMs) && tokenIat * 1000 < revokedMs - 1000) return false;
  }
  return true;
}

const verifyAccessToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, accessSecret(), { algorithms: ['HS256'] });
    if (!isValidAccessPayload(decoded)) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const { mode, user: liveUser } = await loadLiveSessionState(req.user?.id);
    const rejection = evaluateRevocation(req.user, liveUser, mode);
    if (rejection) {
      return res.status(rejection.status).json(rejection.body);
    }
  } catch (error) {
    logger.error('Access session state check failed', { error: error?.message });
    return res.status(503).json({
      error: 'Authentication verification is temporarily unavailable',
      code: 'AUTH_CHECK_UNAVAILABLE',
    });
  }

  const isProfileRoute = /^\/api\/auth\/(?:me|onboarding)(?:\/|\?|$)/.test(String(req.originalUrl || '')) && ['GET', 'PATCH'].includes(req.method);
  if (req.user.role === 'teacher' && !isProfileRoute) {
    try {
      const decision = await getTeacherAccessDecision(req.user.id);
      if (!decision.allowed) {
        return res.status(403).json({
          error: decision.error,
          code: decision.code,
          applicationStatus: decision.status,
        });
      }
    } catch (error) {
      logger.error('Teacher approval gate failed', { error: error?.message });
      return res.status(503).json({
        error: 'Teacher access verification is temporarily unavailable',
        code: 'TEACHER_ACCESS_CHECK_UNAVAILABLE',
      });
    }
  }

  return next();
};

// Optional authentication for public endpoints: attaches req.user when a valid
// access token is present, otherwise continues anonymously (never rejects).
const readAccessTokenIfValid = async (req, _res, next) => {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], accessSecret(), { algorithms: ['HS256'] });
      if (isValidAccessPayload(decoded)) {
        const { mode, user: liveUser } = await loadLiveSessionState(decoded?.id);
        const rejection = evaluateRevocation(decoded, liveUser, mode);
        req.user = rejection ? undefined : decoded;
      } else {
        req.user = undefined;
      }
    } catch {
      req.user = undefined;
    }
  }
  if (typeof next === 'function') {
    return next();
  }
  return req.user || null;
};

function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join('='));
      } catch {
        return valueParts.join('=');
      }
    }
  }
  return null;
}

const NATIVE_MOBILE_PLATFORMS = new Set(['android', 'ios']);

function isNativeMobileClient(req) {
  const platform = String(req?.headers?.['x-client-platform'] || '').trim().toLowerCase();
  if (!NATIVE_MOBILE_PLATFORMS.has(platform)) return false;
  // Browsers attach forbidden Sec-Fetch-* headers that JS cannot strip; prevent browser
  // contexts from receiving or submitting non-cookie refresh tokens.
  if (req?.headers?.['sec-fetch-mode'] || req?.headers?.['sec-fetch-site'] || req?.headers?.['sec-fetch-dest']) {
    return false;
  }
  return true;
}

function readRefreshCookie(req) {
  if (process.env.NODE_ENV === 'production') {
    return readCookie(req, '__Secure-wn_refresh') || null;
  }
  return readCookie(req, '__Secure-wn_refresh') || readCookie(req, 'wn_refresh') || null;
}

function readRefreshTokenFromRequest(req) {
  if (isNativeMobileClient(req)) {
    const bodyToken = typeof req?.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    if (bodyToken) return bodyToken;
    const headerToken = typeof req?.headers?.['x-refresh-token'] === 'string' ? req.headers['x-refresh-token'].trim() : '';
    if (headerToken) return headerToken;
  }
  return readRefreshCookie(req);
}

const verifyRefreshToken = (req, res, next) => {
  const refreshToken = readRefreshTokenFromRequest(req);

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh session is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, refreshSecret(), { algorithms: ['HS256'] });
    if (!isValidRefreshPayload(decoded)) {
      return res.status(401).json({ error: 'Invalid or expired refresh session' });
    }
    req.refreshTokenRaw = refreshToken;
    req.refreshToken = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh session' });
  }
};

const readRefreshTokenIfValid = (req, _res, next) => {
  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) return next();

  try {
    const decoded = jwt.verify(refreshToken, refreshSecret(), { algorithms: ['HS256'] });
    if (isValidRefreshPayload(decoded)) {
      req.refreshTokenRaw = refreshToken;
      req.refreshToken = decoded;
    } else {
      req.refreshToken = null;
    }
  } catch {
    req.refreshToken = null;
  }
  return next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const attachTeacherProfile = async (req, res, next) => {
  if (req.user && req.user.role === 'teacher') {
    const Teacher = require('../models/Teacher');
    const teacher = await Teacher.findOne({ user: req.user.id });
    if (teacher) req.user.teacherProfile = teacher._id;
  }
  next();
};

module.exports = {
  isWeakProductionSecret,
  isNativeMobileClient,
  markAccessJtiRevokedInMemory,
  isAccessJtiRevokedInMemory,
  getAccessSecret: accessSecret,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyAccessTokenString,
  verifyLiveSessionPrincipal,
  verifyRefreshToken,
  readRefreshTokenIfValid,
  readAccessTokenIfValid,
  requireRole,
  attachTeacherProfile,
  protect: verifyAccessToken,
  authorize: requireRole
};
