import { upload, createMultipartUpload, uploadPart, completeMultipartUpload } from '@vercel/blob/client';
import { uploadResumableParts } from './resumableTeacherUpload.mjs';
import { apiUrl } from '../config';
import { getAccessToken } from './authSession';

const incompleteVideoUploads = new WeakMap();

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

  const accessToken = options.accessToken || currentAccessToken();
  const verificationToken = options.verificationToken || '';
  const phoneVerificationToken = options.phoneVerificationToken || '';

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

  const handleUploadUrl = apiUrl('/api/uploads/blob');
  const clientPayload = JSON.stringify({
    purpose,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    accessToken: accessToken || undefined,
    verificationToken: verificationToken || undefined,
    phoneVerificationToken: phoneVerificationToken || undefined,
  });

  // Teacher videos use explicitly checkpointed multipart uploads. The Vercel
  // automatic multipart mode retries failed parts internally, but a new call
  // cannot recover parts from the previous call after its request fails.
  let blob;
  if (options.resumable && file.size > 5 * 1024 * 1024) {
    blob = await uploadResumableParts(file, {
      pathname,
      scope: sanitizeSegment(owner) + '/' + sanitizeSegment(purpose),
      sessions: incompleteVideoUploads,
      abortSignal: options.abortSignal,
      onUploadProgress: options.onUploadProgress,
      onUploadState: options.onUploadState,
      getToken: async (activePathname, signal) => {
        const response = await fetch(handleUploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            type: 'blob.generate-client-token',
            payload: {
              pathname: activePathname,
              multipart: true,
              clientPayload,
            },
          }),
        });
        if (!response.ok) throw new Error('Upload authorization rejected (' + response.status + ')');
        const data = await response.json();
        if (!data.clientToken) throw new Error('Upload authorization missing');
        return data.clientToken;
      },
      client: {
        create: createMultipartUpload,
        uploadPart,
        complete: completeMultipartUpload,
      },
    });
  } else {
    options.onUploadState?.('uploading');
    blob = await upload(pathname, file, {
      access: 'private',
      abortSignal: options.abortSignal,
      onUploadProgress: options.onUploadProgress,
      handleUploadUrl,
      multipart: file.size > 5 * 1024 * 1024,
      clientPayload,
    });
  }

  return {
    url: blob.url,
    pathname: blob.pathname,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
  };
}