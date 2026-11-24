const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const { protect, getAccessSecret, verifyAccessTokenString } = require('../middleware/auth');
const { getTeacherAccessDecision } = require('../utils/teacherAccess');
const storage = require('../services/objectStorage');
const { validateUploadMetadata } = require('../config/uploadPolicy');
const { registerVerificationTokenUpload } = require('./verification');
const { validateTeacherInvite, extractClientIp } = require('../services/teacherInvite');
const { syntheticPhoneEmail } = require('../utils/phone');
const { boundedMediaRange } = require('../utils/mediaByteRange');

function escapeRegexLiteral(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPublicMediaLookupCandidates(rawReference, reference, pathname) {
  const unwrapped = storage.unwrapPublicProxyReference(reference || rawReference);
  const encodedUnwrapped = unwrapped ? encodeURIComponent(unwrapped) : '';
  const exactValues = Array.from(new Set([
    rawReference,
    reference,
    unwrapped,
    storage.publicProxyUrl(unwrapped),
    encodedUnwrapped ? `/api/uploads/public?ref=${encodedUnwrapped}` : '',
    pathname,
    pathname ? `/${pathname}` : '',
  ].filter(Boolean)));

  const patternValues = [];
  if (encodedUnwrapped) {
    patternValues.push(new RegExp(`/api/uploads/public\\?ref=${escapeRegexLiteral(encodedUnwrapped)}(?:&|$)`));
  }
  if (pathname) {
    patternValues.push(new RegExp(`/${escapeRegexLiteral(pathname)}$`));
  }

  return [...exactValues, ...patternValues];
}

const blobUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  skip: (req) => Boolean(req.headers?.['x-vercel-signature']) && req.body?.type === 'blob.upload-completed',
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
  'audio/mp4',
  'application/pdf',
]);

const EXTENSION_MIME_FALLBACKS = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
});

function resolveSafePublicMime(rawContentType, pathname = '') {
  const normalized = String(rawContentType || '').split(';', 1)[0].trim().toLowerCase();
  const mapped = normalized === 'image/jpg'
    ? 'image/jpeg'
    : (normalized === 'audio/x-m4a' || normalized === 'audio/m4a')
      ? 'audio/mp4'
      : normalized === 'video/x-m4v'
        ? 'video/mp4'
        : normalized;
  if (SAFE_PUBLIC_CONTENT_TYPES.has(mapped)) return mapped;
  const ext = path.posix.extname(String(pathname || '')).toLowerCase();
  return EXTENSION_MIME_FALLBACKS[ext] || 'application/octet-stream';
}

async function verifyClientIdentity(payload = {}, req = null) {
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

  const teacherInviteToken = String(payload.inviteToken || '').trim();
  if (teacherInviteToken) {
    const rawEmail = String(payload.email || '').trim().toLowerCase();
    const validEmail = rawEmail && rawEmail.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$/.test(rawEmail)
      ? rawEmail
      : '';
    const derivedPhoneEmail = !validEmail ? syntheticPhoneEmail(payload.phone) : '';
    const ownerIdentity = validEmail || derivedPhoneEmail;
    if (!ownerIdentity) {
      throw new Error('Valid email or phone number is required for invited teacher upload');
    }
    const inviteCheck = await validateTeacherInvite(teacherInviteToken, {
      clientIp: extractClientIp(req),
      bindIfUnbound: false,
    });
    if (!inviteCheck.valid) {
      throw new Error(inviteCheck.error || 'Invalid teacher invitation link');
    }
    const inviteExpSeconds = inviteCheck.invite?.expiresAt
      ? Math.floor(new Date(inviteCheck.invite.expiresAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 3600;
    const quotaKey = `invite-upload:${inviteCheck.invite.id}:${ownerIdentity}`;
    const allowedQuota = await registerVerificationTokenUpload(quotaKey, inviteExpSeconds);
    if (!allowedQuota) {
      throw new Error('Invitation upload quota exceeded');
    }
    return { role: 'teacher-registration', owner: ownerIdentity };
  }

  throw new Error('Authentication required');
}

function assertUploadPath(pathname, purpose, owner) {
  storage.assertUploadPath(pathname, purpose, owner);
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
        const identity = await verifyClientIdentity(payload, req);
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
          // Short-lived client token (SDK default is one hour).
          validUntil: Date.now() + 10 * 60 * 1000,
          tokenPayload: JSON.stringify({
            purpose: payload.purpose,
            owner: String(identity.owner),
            role: identity.role,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const meta = JSON.parse(tokenPayload || '{}');
        // Academy uploads must be private. If a client forced a public object
        // (or any unexpected store), remove it immediately so KYC documents,
        // payment receipts and minors' audio are never world-readable.
        if (blob?.url && !storage.isVercelBlobReference(blob.url)) {
          console.error('Security: non-private blob upload rejected and deleted', {
            pathname: blob.pathname,
            purpose: meta.purpose,
          });
          try {
            const { del } = await import('@vercel/blob');
            await del(blob.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
          } catch (deleteError) {
            console.error('Security: failed to delete non-private blob', { reason: deleteError?.message });
          }
          return;
        }
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
    const rawReference = String(req.query.ref || '').trim();
    if (!rawReference) return res.status(400).json({ error: 'Missing file reference' });
    const reference = storage.unwrapPublicProxyReference(rawReference) || rawReference;

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

    if (Boolean(mongoose.connection?.db) || Teacher.exists !== mongoose.Model.exists || User.exists !== mongoose.Model.exists) {
      const candidateRefs = buildPublicMediaLookupCandidates(rawReference, reference, pathname);

      if (pathname.startsWith('uploads/teacher-public/')) {
        const isPublishedTeacherMedia = await Teacher.exists({
          status: 'approved',
          isVerified: true,
          $or: [
            { 'media.profilePhoto': { $in: candidateRefs } },
            { 'media.introductionVideo': { $in: candidateRefs } },
            { 'media.recitationVideo': { $in: candidateRefs } },
            { 'media.teachingMethodVideo': { $in: candidateRefs } },
            { 'media.additionalVideos': { $in: candidateRefs } },
            { 'media.audioRecordings': { $in: candidateRefs } },
          ],
        });
        if (!isPublishedTeacherMedia) {
          return res.status(404).end();
        }
      } else if (pathname.startsWith('uploads/student-avatar/')) {
        const isActiveAvatar = await User.exists({
          isActive: true,
          avatar: { $in: candidateRefs },
        });
        if (!isActiveAvatar) {
          return res.status(404).end();
        }
      }
    }

    // Streamable public videos/audio must NEVER 302-redirect to *.private.blob.vercel-storage.com
    // (browser CORP blocks private Blob responses) and must NEVER stream unbounded full files
    // (> 4.5 MB crashes Vercel Serverless Functions). Stream bounded 2 MiB HTTP 206 byte ranges
    // directly from same-origin /api/uploads/public with Cache-Control: no-store + Vary: Range.
    const isStreamableMedia = /\.(?:mp4|m4v|mov|webm|mp3|wav|m4a|ogg)$/i.test(pathname);
    const rawRange = String(req.headers.range || '').trim();

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox");
    res.setHeader('Vary', 'Range');

    if ((isStreamableMedia || Boolean(rawRange)) && (storage.getDriver() === 'vercel-blob' || storage.getDriver() === 's3')) {
      res.setHeader('Cache-Control', 'no-store');

      const meta = await storage.inspectPrivateMedia(reference);
      const totalSize = Number(meta?.sizeBytes);
      if (!meta || !Number.isSafeInteger(totalSize) || totalSize <= 0) {
        return res.status(404).end();
      }

      let selection;
      try {
        selection = boundedMediaRange(rawRange, totalSize);
      } catch {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      const { start, end, size } = selection;
      const expectedBytes = end - start + 1;
      const expectedRange = `bytes ${start}-${end}/${size}`;

      const result = await storage.getPrivateObject(reference, {
        headers: { Range: `bytes=${start}-${end}` },
      });
      if (!result?.stream) return res.status(404).end();

      // @vercel/blob get() always reports statusCode: 200 even for 206 range responses,
      // while preserving the upstream content-range header.
      const actualRange = result.headers?.get?.('content-range') || result.blob?.contentRange || '';
      if (actualRange && actualRange !== expectedRange) {
        if (typeof result.stream.cancel === 'function') await result.stream.cancel().catch(() => {});
        else result.stream.destroy?.();
        return res.status(502).end();
      }

      const safeContentType = resolveSafePublicMime(meta.contentType || result.blob?.contentType, pathname);
      res.setHeader('Content-Type', safeContentType);
      res.setHeader('Content-Length', String(expectedBytes));
      if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

      const isPartial = Boolean(rawRange) || start > 0 || end < size - 1;
      if (isPartial) {
        res.status(206);
        res.setHeader('Content-Range', expectedRange);
      } else {
        res.status(200);
      }

      if (typeof result.stream.pipe === 'function') {
        const abortStream = () => {
          result.stream.destroy?.();
        };
        req.on('close', abortStream);
        res.on('finish', () => req.off('close', abortStream));
        return result.stream.pipe(res);
      }

      const reader = result.stream.getReader?.();
      if (!reader) return res.status(500).end();

      const cancelOnClose = () => {
        reader.cancel().catch(() => {});
      };
      req.on('close', cancelOnClose);

      try {
        let remaining = expectedBytes;
        while (remaining > 0) {
          const { done, value } = await reader.read();
          if (done || res.writableEnded || res.destroyed) break;
          const part = Buffer.from(value);
          const slice = part.subarray(0, remaining);
          res.write(slice);
          remaining -= slice.length;
        }
      } finally {
        req.off('close', cancelOnClose);
        await reader.cancel().catch(() => {});
      }
      return res.writableEnded ? undefined : res.end();
    }

    const result = await storage.getPrivateObject(reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });

    if (!result) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);
    if (result.statusCode === 304) return res.status(304).end();

    const safeContentType = resolveSafePublicMime(result.blob?.contentType, pathname);
    res.setHeader('Content-Type', safeContentType);
    if (Number.isSafeInteger(result.blob?.size) && result.blob.size > 0) {
      res.setHeader('Content-Length', String(result.blob.size));
    }

    if (result.stream?.pipe) {
      return result.stream.pipe(res);
    }

    const reader = result.stream?.getReader?.();
    if (!reader) return res.status(500).end();

    const cancelOnClose = () => {
      reader.cancel().catch(() => {});
    };
    req.on('close', cancelOnClose);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || res.writableEnded || res.destroyed) break;
        res.write(Buffer.from(value));
      }
    } finally {
      req.off('close', cancelOnClose);
    }
    return res.writableEnded ? undefined : res.end();
  } catch (error) {
    console.error('Public media stream failed:', error.message);
    if (!res.headersSent) return res.status(404).end();
    return res.destroy();
  }
});

module.exports = router;