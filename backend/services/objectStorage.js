const crypto = require('crypto');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { validateMagicBytes } = require('../utils/magicBytes');

let s3Client = null;

function getDriver() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  if (
    process.env.S3_BUCKET &&
    process.env.S3_REGION &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  ) return 's3';
  if (process.env.FILE_STORAGE_DRIVER === 'filesystem') return 'filesystem';
  return 'unconfigured';
}

function isConfigured() {
  return ['vercel-blob', 's3', 'filesystem'].includes(getDriver());
}

function getS3Client() {
  if (getDriver() !== 's3') throw new Error('S3-compatible object storage is not configured');
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function sanitizeSegment(value = 'file') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'file';
}

function sanitizeFilename(filename = 'file') {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = sanitizeSegment(path.basename(filename, path.extname(filename))).slice(0, 60);
  return { base, ext };
}

function createObjectKey(prefix, originalName) {
  const { base, ext } = sanitizeFilename(originalName);
  return `${String(prefix || 'uploads').replace(/^\/+|\/+$/g, '')}/${Date.now()}-${crypto.randomUUID()}-${base}${ext}`;
}

function unwrapPublicProxyReference(reference) {
  const value = String(reference || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value, 'https://wahy.invalid');
    if (parsed.pathname.endsWith('/api/uploads/public')) {
      return parsed.searchParams.get('ref') || value;
    }
  } catch {
    // Keep the original reference for downstream validation.
  }

  return value;
}

function extractPathname(reference) {
  const unwrapped = unwrapPublicProxyReference(reference);
  if (!unwrapped) return '';
  try {
    const parsed = new URL(unwrapped);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return String(unwrapped).replace(/^\/+/, '');
  }
}

function isSafeObjectPath(pathname) {
  const value = String(pathname || '');
  if (!value || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false;

  const segments = value.split('/');
  return segments.length >= 2 && segments.every((segment) => (
    segment &&
    segment !== '.' &&
    segment !== '..'
  ));
}

function referenceMatches(reference, purpose, owner) {
  const pathname = extractPathname(reference);
  if (!isSafeObjectPath(pathname)) return false;
  const expected = `uploads/${sanitizeSegment(purpose)}/${sanitizeSegment(owner)}/`;
  return pathname.startsWith(expected);
}

function getConfiguredBlobStoreId() {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  const match = token.match(/^vercel_blob_rw_([a-z0-9]+)_/i);
  return match ? match[1].toLowerCase() : null;
}

function isVercelBlobReference(reference) {
  const unwrapped = unwrapPublicProxyReference(reference);
  try {
    const parsed = new URL(unwrapped);
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== 'https:' ||
      !host.endsWith('.blob.vercel-storage.com') ||
      host === 'blob.vercel-storage.com'
    ) {
      return false;
    }
    const storeId = getConfiguredBlobStoreId();
    if (storeId && !host.startsWith(`${storeId}.`)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function publicProxyUrl(reference) {
  if (!reference) return null;
  const apiBase = String(process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (getDriver() === 'vercel-blob') {
    return `${apiBase}/api/uploads/public?ref=${encodeURIComponent(reference)}`;
  }
  if (getDriver() === 's3') {
    const base = String(process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/${extractPathname(reference)}` : reference;
  }
  return reference;
}

async function createUploadUrl({ key, contentType, size, expiresIn = 600 }) {
  if (getDriver() !== 's3') throw new Error('Presigned S3 uploads are not enabled');
  const numericSize = Number(size);
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
    ...(Number.isFinite(numericSize) && numericSize > 0 ? { ContentLength: Math.floor(numericSize) } : {}),
  });
  return getSignedUrl(getS3Client(), command, { expiresIn });
}

// Read only asset metadata from trusted private storage; never return the
// original object path, signed authorization, or video content as metadata.
async function inspectPrivateMedia(reference) {
  const stored = unwrapPublicProxyReference(reference);
  if (getDriver() === 'vercel-blob') {
    if (!isVercelBlobReference(stored)) return null;
    const { head } = await import('@vercel/blob');
    const meta = await head(stored, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return { contentType: meta.contentType || 'application/octet-stream', sizeBytes: meta.size || 0 };
  }

  if (getDriver() === 's3') {
    const pathname = extractPathname(stored);
    if (!isSafeObjectPath(pathname)) return null;
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    const meta = await getS3Client().send(new HeadObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: pathname,
    }));
    return { contentType: meta.ContentType || 'application/octet-stream', sizeBytes: meta.ContentLength || 0 };
  }
  return null;
}

// The reviewer can otherwise receive a valid-looking URL for an absent or
// inaccessible object. Probe just the first bytes; never proxy the whole video.
async function probeTemporaryMediaUrl(url) {
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-31' },
      signal: AbortSignal.timeout(7000),
      redirect: 'follow',
    });
    return { ok: response.status === 200 || response.status === 206, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    // Even if the provider ignores Range and responds with 200, we must not
    // accidentally download the entire media inside a serverless function.
    if (response?.body) await response.body.cancel().catch(() => {});
  }
}

// Grant an authenticated reviewer a short, single-object GET capability instead
// of proxying a large video through a Vercel Function. Keep this server-only.
async function createTemporaryReadUrl(reference, { expiresIn = 20 * 60 } = {}) {
  const seconds = Math.min(30 * 60, Math.max(60, Math.floor(Number(expiresIn) || 0)));
  const stored = unwrapPublicProxyReference(reference);
  if (!stored || !/^https:\/\//i.test(stored) && getDriver() !== 's3') return null;

  if (getDriver() === 'vercel-blob') {
    if (!isVercelBlobReference(stored)) return null;
    const { issueSignedToken, presignUrl } = await import('@vercel/blob');
    const pathname = extractPathname(stored);
    if (!isSafeObjectPath(pathname)) return null;
    const validUntil = Date.now() + seconds * 1000;
    const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
    const result = await presignUrl(token, { pathname, operation: 'get', validUntil });
    if (!result?.presignedUrl?.startsWith('https://')) throw new Error('Unable to sign private asset URL');
    return { url: result.presignedUrl, expiresAt: validUntil };
  }

  if (getDriver() === 's3') {
    const pathname = extractPathname(stored);
    if (!isSafeObjectPath(pathname)) return null;
    const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: pathname });
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: seconds });
    return { url, expiresAt: Date.now() + seconds * 1000 };
  }

  return null;
}

async function getPrivateObject(reference, options = {}) {
  if (getDriver() === 'vercel-blob') {
    const { get } = await import('@vercel/blob');
    const stored = unwrapPublicProxyReference(reference);
    if (!isVercelBlobReference(stored)) return null;
    const pathname = extractPathname(stored);
    if (!isSafeObjectPath(pathname)) return null;

    // @vercel/blob private GET + Range must target the store pathname.
    // Passing the full blob URL can be rejected as "Invalid URL ... Use a pathname instead".
    return get(pathname, {
      access: 'private',
      ifNoneMatch: options.ifNoneMatch,
      ...(options.headers ? { headers: options.headers } : {}),
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  }

  if (getDriver() === 's3') {
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: extractPathname(reference),
      ...(options.headers?.Range ? { Range: options.headers.Range } : {}),
    }));
    return {
      statusCode: result.ContentRange ? 206 : 200,
      stream: result.Body,
      headers: {
        get: (name) => String(name || '').toLowerCase() === 'content-range' ? (result.ContentRange || null) : null,
      },
      blob: {
        contentType: result.ContentType || 'application/octet-stream',
        etag: result.ETag,
        contentRange: result.ContentRange || null,
      },
    };
  }

  return null;
}

function isS3ReferenceAllowed(reference) {
  const unwrapped = unwrapPublicProxyReference(reference);
  if (!/^https?:\/\//i.test(unwrapped)) {
    return isSafeObjectPath(extractPathname(unwrapped));
  }
  try {
    const parsed = new URL(unwrapped);
    if (parsed.protocol !== 'https:') return false;
    const allowedHosts = new Set();
    for (const candidate of [process.env.S3_PUBLIC_BASE_URL, process.env.S3_ENDPOINT]) {
      if (candidate) {
        try {
          allowedHosts.add(new URL(candidate).hostname.toLowerCase());
        } catch {
          // ignore malformed optional env URL
        }
      }
    }
    const bucket = String(process.env.S3_BUCKET || '').trim().toLowerCase();
    const region = String(process.env.S3_REGION || '').trim().toLowerCase();
    if (bucket) {
      allowedHosts.add(`${bucket}.s3.amazonaws.com`);
      if (region) {
        allowedHosts.add(`${bucket}.s3.${region}.amazonaws.com`);
      }
    }
    if (allowedHosts.size === 0) return false;
    return allowedHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isOwnedObjectReference(reference, purpose, owner, driver = getDriver()) {
  if (!referenceMatches(reference, purpose, owner)) return false;
  if (driver === 'vercel-blob') return isVercelBlobReference(reference);
  if (driver === 's3') return isS3ReferenceAllowed(reference);
  return false;
}

async function deleteObject(reference) {
  const stored = unwrapPublicProxyReference(reference);
  if (getDriver() === 'vercel-blob') {
    const { del } = await import('@vercel/blob');
    await del(stored, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }

  if (getDriver() === 's3') {
    await getS3Client().send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: extractPathname(stored),
    }));
    return;
  }

  throw new Error('External object storage is not configured for deletion');
}

async function verifyUploadedObjectMagicBytes(reference, expectedContentType, maxBytes = 0) {
  const driver = getDriver();
  if (driver !== 'vercel-blob' && driver !== 's3') {
    return { ok: true, skipped: true };
  }
  const normalizedExpected = String(expectedContentType || '').split(';', 1)[0].trim().toLowerCase();
  try {
    if (maxBytes > 0) {
      const meta = await inspectPrivateMedia(reference);
      if (!meta || (Number(meta.sizeBytes) > maxBytes)) {
        await deleteObject(reference).catch(() => {});
        return { ok: false, code: 'FILE_TOO_LARGE', error: 'Uploaded file exceeds the maximum allowed size' };
      }
    }
    const result = await getPrivateObject(reference, { headers: { Range: 'bytes=0-63' } });
    if (!result || !result.stream) {
      return { ok: false, code: 'UPLOAD_OBJECT_NOT_FOUND', error: 'Uploaded file was not found in storage' };
    }
    const chunks = [];
    let collected = 0;
    if (typeof result.stream.getReader === 'function') {
      const reader = result.stream.getReader();
      while (collected < 64) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        chunks.push(buf);
        collected += buf.length;
      }
      await reader.cancel().catch(() => {});
    } else {
      for await (const part of result.stream) {
        const buf = Buffer.isBuffer(part) ? part : Buffer.from(part);
        chunks.push(buf);
        collected += buf.length;
        if (collected >= 64) {
          if (typeof result.stream.destroy === 'function') result.stream.destroy();
          break;
        }
      }
    }
    const header = Buffer.concat(chunks).subarray(0, 64);
    const magic = validateMagicBytes(header, normalizedExpected);
    if (!magic.valid) {
      await deleteObject(reference).catch(() => {});
      return {
        ok: false,
        code: 'INVALID_FILE_MAGIC_BYTES',
        error: 'Uploaded file content does not match declared file type',
      };
    }
    return { ok: true };
  } catch (error) {
    console.warn('Direct upload magic-byte verification failed:', error.message);
    return { ok: false, code: 'UPLOAD_VERIFICATION_FAILED', error: 'Unable to verify uploaded file signature' };
  }
}

async function deleteOwnedObject(reference, purpose, owner) {
  if (!isOwnedObjectReference(reference, purpose, owner)) {
    throw new Error('Object reference does not belong to this owner and purpose');
  }

  await deleteObject(reference);
}

module.exports = {
  getDriver,
  isConfigured,
  sanitizeSegment,
  createObjectKey,
  extractPathname,
  isSafeObjectPath,
  referenceMatches,
  isVercelBlobReference,
  isOwnedObjectReference,
  publicProxyUrl,
  unwrapPublicProxyReference,
  createUploadUrl,
  getPrivateObject,
  createTemporaryReadUrl,
  inspectPrivateMedia,
  probeTemporaryMediaUrl,
  verifyUploadedObjectMagicBytes,
  deleteObject,
  deleteOwnedObject,
};