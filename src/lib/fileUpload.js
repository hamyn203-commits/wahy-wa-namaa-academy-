import { upload } from '@vercel/blob/client';
import { apiUrl } from '../config';
import { getAccessToken, refreshAccessToken } from './authSession';

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

function sanitizeSegment(value = 'file') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'file';
}

function currentAccessToken() {
  return getAccessToken() || '';
}

export async function uploadFileDirect(file, purpose, options = {}) {
  if (!file) throw new Error('No file selected');

  let accessToken = options.accessToken || currentAccessToken();
  const verificationToken = options.verificationToken || '';
  const phoneVerificationToken = options.phoneVerificationToken || '';

  if (accessToken && !options.accessToken) {
    const claims = decodeJwt(accessToken);
    if (!claims.exp || claims.exp * 1000 < Date.now() + 60 * 1000) {
      try {
        accessToken = await refreshAccessToken();
      } catch {
        // Keep existing token if refresh is unavailable; server will validate.
      }
    }
  }

  let owner = '';
  if (accessToken) owner = decodeJwt(accessToken).id || '';
  if (!owner && verificationToken) {
    const proof = decodeJwt(verificationToken);
    owner = proof.email || proof.phone || '';
  }
  if (!owner && phoneVerificationToken) owner = decodeJwt(phoneVerificationToken).phone || '';
  if (!owner) throw new Error('Upload authorization is missing');

  // Parallel uploads can share the same millisecond and filename (for example
  // intro/recitation/method videos). Include an explicit nonce so each object
  // gets a unique key even when uploads start at the same time.
  const nonce = globalThis.crypto?.randomUUID?.()
    || `${Math.random().toString(36).slice(2)}-${performance.now?.().toString().replace('.', '-') || '0'}`;
  const pathname = `uploads/${sanitizeSegment(purpose)}/${sanitizeSegment(owner)}/${Date.now()}-${sanitizeSegment(nonce)}-${sanitizeSegment(file.name || 'file')}`;

  const blob = await upload(pathname, file, {
    access: 'private',
    abortSignal: options.abortSignal,
    onUploadProgress: options.onUploadProgress,
    handleUploadUrl: apiUrl('/api/uploads/blob'),
    multipart: file.size > 5 * 1024 * 1024,
    clientPayload: JSON.stringify({
      purpose,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      accessToken: accessToken || undefined,
      verificationToken: verificationToken || undefined,
      phoneVerificationToken: phoneVerificationToken || undefined,
    }),
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
  };
}