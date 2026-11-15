const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../models/User');
const { protect, getAccessSecret, verifyAccessTokenString } = require('../middleware/auth');
const { getTeacherAccessDecision } = require('../utils/teacherAccess');
const storage = require('../services/objectStorage');
const { validateUploadMetadata } = require('../config/uploadPolicy');
const { registerVerificationTokenUpload } = require('./verification');

const blobUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  skip: (req) => Boolean(req.headers?.['x-vercel-signature']),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload token requests, please try again later.' },
});

const SAFE_PUBLIC_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
]);

async function verifyClientIdentity(payload = {}) {
  const secret = getAccessSecret();

  if (payload.accessToken) {
    const { decoded: user } = await verifyAccessTokenString(payload.accessToken);
    if (mongoose.connection.readyState === 1) {
      const account = await User.findById(user.id).select('role email isActive').lean();
      if (!account || account.isActive !== true) {
        throw new Error('Account is inactive or unavailable');
      }
      if (account.role === 'teacher') {
        const decision = await getTeacherAccessDecision(account._id);
        if (!decision.allowed) {
          throw new Error('Teacher account is not approved for uploads');
        }
      }
      return { role: account.role, owner: String(account._id) };
    }
    return { role: user.role, owner: user.id };
  }

  const teacherVerificationToken = payload.verificationToken;
  if (teacherVerificationToken) {
    const verification = jwt.verify(teacherVerificationToken, secret, { algorithms: ['HS256'] });

    if (verification.purpose === 'teacher-email-verification' && verification.email && verification.jti) {
      const allowedQuota = await registerVerificationTokenUpload(verification.jti, verification.exp);
      if (!allowedQuota) {
        throw new Error('Verification upload quota exceeded or token already consumed');
      }
      return { role: 'teacher-registration', owner: verification.email };
    }

    throw new Error('Invalid teacher verification proof');
  }

  throw new Error('Authentication required');
}

function assertUploadPath(pathname, purpose, owner) {
  const prefix = `uploads/${storage.sanitizeSegment(purpose)}/${storage.sanitizeSegment(owner)}/`;
  if (!String(pathname || '').startsWith(prefix)) {
    throw new Error('Invalid upload path');
  }
}

router.get('/status', (_req, res) => {
  res.json({
    driver: storage.getDriver(),
    configured: storage.isConfigured(),
    directUpload: true,
    privateByDefault: storage.getDriver() === 'vercel-blob',
  });
});

router.post('/blob', blobUploadLimiter, async (req, res) => {
  if (storage.getDriver() !== 'vercel-blob') {
    return res.status(409).json({ error: 'Vercel Blob is not the active storage driver' });
  }

  try {
    const { handleUpload } = await import('@vercel/blob/client');
    const configuredApiBase = String(process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
    const fallbackOrigin = process.env.NODE_ENV === 'production'
      ? 'https://api.wahywanamaa.com'
      : `http://${String(req.headers.host || 'localhost:5000').replace(/[^a-zA-Z0-9.:-]/g, '')}`;
    const baseOrigin = configuredApiBase || fallbackOrigin;
    const request = new Request(`${baseOrigin}${req.originalUrl}`, {
      method: 'POST',
      headers: new Headers(Object.entries(req.headers).filter(([, value]) => typeof value === 'string')),
      body: JSON.stringify(req.body || {}),
    });

    const jsonResponse = await handleUpload({
      body: req.body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || '{}');
        const identity = await verifyClientIdentity(payload);
        const metadata = validateUploadMetadata({
          purpose: payload.purpose,
          role: identity.role,
          filename: payload.filename,
          contentType: payload.contentType,
          size: payload.size,
        });

        assertUploadPath(pathname, payload.purpose, identity.owner);

        const pathnameExtension = path.posix.extname(String(pathname || '')).toLowerCase();
        if (pathnameExtension !== metadata.extension) {
          throw new Error('Upload path does not match file extension');
        }

        return {
          allowedContentTypes: [metadata.contentType],
          maximumSizeInBytes: metadata.rule.maxBytes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            purpose: payload.purpose,
            owner: String(identity.owner),
            role: identity.role,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const meta = JSON.parse(tokenPayload || '{}');
        console.log('Blob upload completed', {
          pathname: blob.pathname,
          purpose: meta.purpose,
          role: meta.role,
        });
      },
    });

    return res.json(jsonResponse);
  } catch (error) {
    const message = error?.message || 'Upload authorization failed';
    console.warn('Blob upload authorization rejected', {
      reason: message,
      contentLength: req.headers['content-length'] || null,
    });

    const status = message === 'Invalid file size' ? 413 : 400;
    return res.status(status).json({
      error: message,
      code: message === 'Invalid file size'
        ? 'UPLOAD_FILE_TOO_LARGE'
        : 'UPLOAD_AUTHORIZATION_REJECTED',
    });
  }
});

router.post('/presign', protect, async (req, res) => {
  if (storage.getDriver() !== 's3') {
    return res.status(409).json({ error: 'S3 storage is not active' });
  }

  const { purpose, filename, contentType, size } = req.body || {};

  let metadata;
  try {
    metadata = validateUploadMetadata({
      purpose,
      role: req.user.role,
      filename,
      contentType,
      size,
    });
  } catch (error) {
    const status = error.message === 'Not allowed for this upload purpose' ? 403 : 400;
    return res.status(status).json({ error: error.message });
  }

  const key = storage.createObjectKey(
    `uploads/${purpose}/${storage.sanitizeSegment(req.user.id)}`,
    filename
  );
  const uploadUrl = await storage.createUploadUrl({ key, contentType: metadata.contentType, size: metadata.size });

  return res.json({
    key,
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': metadata.contentType },
    expiresIn: 600,
  });
});

router.get('/public', async (req, res) => {
  try {
    const reference = String(req.query.ref || '');
    if (!reference) return res.status(400).json({ error: 'Missing file reference' });

    const pathname = storage.extractPathname(reference);
    if (!storage.isSafeObjectPath(pathname)) {
      return res.status(400).json({ error: 'Invalid media reference' });
    }

    const publicPurpose =
      pathname.startsWith('uploads/teacher-public/') ||
      pathname.startsWith('uploads/student-avatar/');

    if (!publicPurpose) {
      return res.status(403).json({ error: 'This file is not public media' });
    }

    if (storage.getDriver() === 'vercel-blob' && !storage.isVercelBlobReference(reference)) {
      return res.status(400).json({ error: 'Invalid media reference' });
    }
    if (storage.getDriver() === 's3' && !storage.isS3ReferenceAllowed(reference)) {
      return res.status(400).json({ error: 'Invalid media reference' });
    }

    const result = await storage.getPrivateObject(reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });

    if (!result) return res.status(404).end();
    if (result.statusCode === 304) return res.status(304).end();

    const rawType = String(result.blob?.contentType || '').split(';', 1)[0].trim().toLowerCase();
    const safeContentType = SAFE_PUBLIC_CONTENT_TYPES.has(rawType)
      ? rawType
      : 'application/octet-stream';
    res.setHeader('Content-Type', safeContentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox");
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

    if (result.stream?.pipe) {
      return result.stream.pipe(res);
    }

    const reader = result.stream?.getReader?.();
    if (!reader) return res.status(500).end();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (error) {
    console.error('Public media stream failed:', error.message);
    return res.status(404).end();
  }
});

module.exports = router;