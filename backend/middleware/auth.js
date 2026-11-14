const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { getTeacherAccessDecision } = require('../utils/teacherAccess');
const { isMockMode } = require('../config/runtime');
const { findMockUserById } = require('../mockStore');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const DEFAULT_JWT_SECRET = 'wahy-namaa-dev-access-secret-change-me';
const DEFAULT_REFRESH_SECRET = 'wahy-namaa-dev-refresh-secret-change-me';

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

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      v: Number(user.refreshTokenVersion || 0),
    },
    accessSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m', algorithm: 'HS256' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      v: Number(user.refreshTokenVersion || 0),
    },
    refreshSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', algorithm: 'HS256' }
  );
};

async function loadLiveSessionState(userId) {
  if (!userId) return { mode: 'stateless', user: null };
  if (mongoose.connection.readyState === 1) {
    const User = require('../models/User');
    const query = User.findById(userId);
    let user = null;
    if (query && typeof query.select === 'function') {
      const selected = query.select('role isActive +refreshTokenVersion +sessionsRevokedAt');
      user = typeof selected?.lean === 'function' ? await selected.lean() : await selected;
    } else {
      user = await query;
    }
    return { mode: 'db', user };
  }
  if (isMockMode) {
    return { mode: 'mock', user: findMockUserById(userId) };
  }
  return { mode: 'stateless', user: null };
}

function evaluateRevocation(decoded, liveUser, mode) {
  if (mode === 'db' && !liveUser) {
    return { status: 401, body: { error: 'Invalid or revoked session', code: 'SESSION_REVOKED' } };
  }
  if (!liveUser) return null;

  if (liveUser.isActive === false) {
    return { status: 403, body: { error: 'Account is deactivated. Please contact support.', code: 'ACCOUNT_DEACTIVATED' } };
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

const verifyAccessToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = jwt.verify(token, accessSecret(), { algorithms: ['HS256'] });
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
    console.error('Access session state check failed:', error.message);
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
      console.error('Teacher approval gate failed:', error.message);
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
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], accessSecret(), { algorithms: ['HS256'] });
      const { mode, user: liveUser } = await loadLiveSessionState(decoded?.id);
      const rejection = evaluateRevocation(decoded, liveUser, mode);
      req.user = rejection ? undefined : decoded;
    } catch {
      req.user = undefined;
    }
  }
  return next();
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

function readRefreshCookie(req) {
  return readCookie(req, '__Secure-wn_refresh') || readCookie(req, 'wn_refresh') || null;
}

const verifyRefreshToken = (req, res, next) => {
  const refreshToken = readRefreshCookie(req);

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh session is required' });
  }

  try {
    req.refreshTokenRaw = refreshToken;
    req.refreshToken = jwt.verify(refreshToken, refreshSecret(), { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh session' });
  }
};

const readRefreshTokenIfValid = (req, _res, next) => {
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) return next();

  try {
    req.refreshTokenRaw = refreshToken;
    req.refreshToken = jwt.verify(refreshToken, refreshSecret(), { algorithms: ['HS256'] });
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
  getAccessSecret: accessSecret,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  readRefreshTokenIfValid,
  readAccessTokenIfValid,
  requireRole,
  attachTeacherProfile,
  protect: verifyAccessToken,
  authorize: requireRole
};
