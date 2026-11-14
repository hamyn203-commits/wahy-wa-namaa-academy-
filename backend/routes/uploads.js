const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { protect, getAccessSecret } = require('../middleware/auth');
const storage = require('../services/objectStorage');
const { PURPOSES, validateUploadMetadata } = require('../config/uploadPolicy');

function verifyClientIdentity(payload = {}) {
  const secret = getAccessSecret();

  if (payload.accessToken) {
    const user = jwt.verify(payload.accessToken, secret);
    return { role: user.role, owner: user.id };
  }

  const teacherVerificationToken = payload.verificationToken || payload.phoneVerificationToken;
  if (teacherVerificationToken) {
    const verification = jwt.verify(teacherVerificationToken, secret);

    if (verification.purpose === 'teacher-email-verification' && verification.email) {
      return { role: 'teacher-registration', owner: verification.email };
    }

    // Transitional support for verification tokens issued shortly before the email-OTP rollout.
    if (
      payload.phoneVerificationToken &&
      verification.purpose === 'teacher-phone-verification' &&
      verification.phone
    ) {
      return { role: 'teacher-registration', owner: verification.phone };
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

router.post('/blob', async (req, res) => {
  if (storage.getDriver() !== 'vercel-blob') {
    return res.status(409).json({ error: 'Vercel Blob is not the active storage driver' });
  }

  try {
    const { handleUpload } = await import('@vercel/blob/client');
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const request = new Request(`${protocol}://${host}${req.originalUrl}`, {
      method: 'POST',
      headers: new Headers(Object.entries(req.headers).filter(([, value]) => typeof value === 'string')),
      body: JSON.stringify(req.body || {}),
    });

    const jsonResponse = await handleUpload({
      body: req.body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || '{}');
        const identity = verifyClientIdentity(payload);
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
  const uploadUrl = await storage.createUploadUrl({ key, contentType: metadata.contentType });

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
      pathname.startsWith('uploads/student-avatar/') ||
      pathname.startsWith('uploads/course-media/');

    if (!publicPurpose) {
      return res.status(403).json({ error: 'This file is not public media' });
    }

    if (storage.getDriver() === 'vercel-blob' && !storage.isVercelBlobReference(reference)) {
      return res.status(400).json({ error: 'Invalid media reference' });
    }

    const result = await storage.getPrivateObject(reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });

    if (!result) return res.status(404).end();
    if (result.statusCode === 304) return res.status(304).end();

    res.setHeader('Content-Type', result.blob?.contentType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
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