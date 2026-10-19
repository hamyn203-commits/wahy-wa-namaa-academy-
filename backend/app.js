const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('./config/database');
const { getConfigurationReadiness } = require('./config/readiness');
const { getLaunchReadiness } = require('./config/launchReadiness');
const { getEmailProviderStatus } = require('./config/emailProvider');
const { isTrustedOrigin, requireTrustedOrigin } = require('./config/origins');
const { version: APP_VERSION } = require('./package.json');
const log = require('./utils/logger');
const { requestId } = require('./middleware/requestId');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// --- Request correlation ID (earliest possible middleware) ---
app.use(requestId);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.googletagmanager.com", "https://www.clarity.ms"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:"],
      mediaSrc: ["'self'", "blob:", "https:"],
      frameSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 150),
  // Authenticated background synchronization has a separate per-account budget.
  skip: (req) => req.method === 'GET' && /^\/(?:support\/(?:inbox|me\/unread|[^/]+\/messages)|notifications(?:\/unread-count)?)\/?$/.test(req.path),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 8),
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.REGISTRATION_RATE_LIMIT_MAX || 6),
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OTP_SEND_RATE_LIMIT_MAX || 4),
  message: { error: 'Too many verification code requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OTP_VERIFY_RATE_LIMIT_MAX || 10),
  message: { error: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 5),
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.REFRESH_RATE_LIMIT_MAX || 60),
  message: { error: 'Too many token refresh requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bootstrapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.ADMIN_BOOTSTRAP_RATE_LIMIT_MAX || 3),
  message: { error: 'Too many bootstrap attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PUBLIC_SUBMISSION_RATE_LIMIT_MAX || 12),
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isTrustedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Cookie-backed auth endpoints mutate/refresh session state. Require an
// explicitly trusted browser Origin in production to prevent cross-site use.
app.use('/api/auth/refresh', requireTrustedOrigin);
app.use('/api/auth/logout', requireTrustedOrigin);

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

if (process.env.DISABLE_RATE_LIMIT !== 'true') {
  app.use('/api/', generalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', registrationLimiter);
  app.use('/api/auth/send-verification', otpSendLimiter);
  app.use('/api/auth/verify-code', otpVerifyLimiter);
  app.use('/api/auth/forgot-password', passwordResetLimiter);
  app.use('/api/auth/reset-password', passwordResetLimiter);
  app.use('/api/auth/refresh', refreshLimiter);
  app.use('/api/setup', bootstrapLimiter);
  app.use('/api/contact', publicSubmissionLimiter);
  app.use('/api/careers/apply', publicSubmissionLimiter);
  app.use('/api/donations', publicSubmissionLimiter);
}

app.use(require('./middleware/detectMarket'));

function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const sanitized = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    sanitized[key.replace(/[.$]/g, '_')] = sanitizeObject(obj[key]);
  }
  return sanitized;
}

app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) Object.assign(req.query, sanitizeObject(req.query));
  if (req.params) Object.assign(req.params, sanitizeObject(req.params));
  next();
});

// A private-video Range URL contains a 30-minute bearer ticket. Never log
// the raw query string; production access logs would expose the credential.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => String(req.originalUrl || req.url || '').startsWith('/api/teachers/admin-media-range/'),
}));

// Ensure database connectivity before business API requests. Health remains available
// even when the database is unavailable so deployment diagnostics still work.
app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || req.path === '/readiness' || req.path === '/launch-readiness') return next();

  if (!(process.env.MONGODB_URI || process.env.MONGODB_URL)) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'API not ready',
        code: 'DATABASE_NOT_CONFIGURED'
      });
    }
    return next();
  }

  try {
    await connectDB();
    return next();
  } catch {
    return res.status(503).json({ error: 'Database temporarily unavailable' });
  }
});

// Filesystem uploads are supported for local/VPS deployments only. Serverless
// deployments use external object storage in the migration phase.
if (process.env.FILE_STORAGE_DRIVER !== 'external') {
  app.use('/uploads/teachers/public', express.static(path.join(__dirname, 'uploads', 'teachers', 'public')));
  app.use('/uploads/courses', express.static(path.join(__dirname, 'uploads', 'courses')));
}
app.use('/uploads/teachers', (_req, res) => res.status(404).end());

app.get('/', (_req, res) => {
  res.json({
    service: 'Wahy Wa Namaa Academy API',
    version: APP_VERSION,
    status: 'ok',
    runtime: process.env.VERCEL ? 'serverless' : 'node',
    health: '/api/health',
    frontend: process.env.FRONTEND_URL || 'https://wahy-wa-namaa-academy.vercel.app',
  });
});

app.get('/api', (_req, res) => res.redirect(301, '/api/health'));

app.get('/api/health', (_req, res) => {
  const readiness = getConfigurationReadiness();
  res.status(200).json({
    status: 'ok',
    service: 'wahy-wa-namaa-api',
    version: APP_VERSION,
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1,
    databaseConfigured: readiness.databaseConfigured,
    configurationReady: readiness.configurationReady,
    missingConfiguration: readiness.missingConfiguration,
    storageDriver: readiness.storageDriver,
    storageConfigured: readiness.storageConfigured,
    features: {
      ai: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK),
      email: getEmailProviderStatus().configured,
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      whatsapp: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      livekit: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_URL),
      manualPayment: process.env.MANUAL_PAYMENT_ENABLED === 'true' && Boolean(
        process.env.MANUAL_PAYMENT_INSTAPAY
        || process.env.MANUAL_PAYMENT_VODAFONE_CASH
        || process.env.MANUAL_PAYMENT_BANK_DETAILS
      ),
      paymob: process.env.PAYMOB_ENABLED === 'true' && Boolean(
        process.env.PAYMOB_SECRET_KEY
        && process.env.PAYMOB_PUBLIC_KEY
        && process.env.PAYMOB_HMAC_SECRET
        && (process.env.PAYMOB_INTEGRATION_IDS || process.env.PAYMOB_INTEGRATION_ID_CARD)
      ),
    },
  });
});

app.get('/api/readiness', async (_req, res) => {
  const configuration = getConfigurationReadiness();
  let databaseConnected = mongoose.connection.readyState === 1;
  let databaseError = null;

  if (configuration.databaseConfigured && !databaseConnected) {
    try {
      await connectDB();
      databaseConnected = mongoose.connection.readyState === 1;
    } catch {
      databaseError = 'Database connection failed';
    }
  }

  const ready = configuration.configurationReady && databaseConnected;

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    ready,
    ...configuration,
    databaseConnected,
    ...(databaseError ? { databaseError } : {}),
    optionalFeatures: {
      ai: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK),
      email: getEmailProviderStatus().configured,
      whatsapp: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      livekit: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_URL),
    },
  });
});

app.get('/api/launch-readiness', async (_req, res) => {
  const configuration = getConfigurationReadiness();
  let databaseConnected = mongoose.connection.readyState === 1;

  if (configuration.databaseConfigured && !databaseConnected) {
    try {
      await connectDB();
      databaseConnected = mongoose.connection.readyState === 1;
    } catch {
      databaseConnected = false;
    }
  }

  const launch = getLaunchReadiness({ databaseConnected });

  return res.status(launch.ready ? 200 : 503).json({
    status: launch.ready ? 'ready' : 'not-ready',
    ...launch,
  });
});

app.use('/api/markets', require('./routes/markets'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/verification'));
app.use('/api/students/dashboard', require('./routes/studentDashboard'));
app.use('/api/student-dashboard', require('./routes/studentDashboard'));
app.use('/api/students', require('./routes/students'));
app.use('/api/teachers/dashboard', require('./routes/teacherDashboard'));
app.use('/api/teacher-updates', require('./routes/teacherUpdates'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/translate', require('./routes/translate'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/sessions/:id/translate', require('./routes/sessionTranslate'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/guardians', require('./routes/guardians'));
app.use('/api/guardian', require('./routes/guardian'));
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/audio', require('./routes/audio'));
app.use('/api/live', require('./routes/live'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/setup', require('./routes/setup'));
app.use('/api/admin/people', require('./routes/adminPeople'));
app.use('/api/admin/growth', require('./routes/adminGrowth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/lms', require('./routes/lms'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/careers', require('./routes/careers'));
app.use('/api/women', require('./routes/women'));
app.use('/api/system', require('./routes/system'));
app.use('/api/circles', require('./routes/circles'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/trials', require('./routes/trials'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/cron', require('./routes/cron'));

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, _next) => {
  const errLog = req.log || log;
  errLog.error('API error', {
    error: err.message,
    name: err.name,
    code: err.code,
    status: err.status,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Validation error', details: err.message });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID format' });
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate entry' });
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'Origin not allowed' });

  return res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
