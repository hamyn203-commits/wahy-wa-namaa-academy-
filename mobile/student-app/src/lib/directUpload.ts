import * as FileSystem from 'expo-file-system';
import { api } from './api';
import { API_BASE_URL, SITE_URL } from './config';

function sanitizeSegment(value = 'file'): string {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'file'
  );
}

function normalizeImageMime(uri: string, provided?: string | null): { mime: string; ext: string } {
  const lower = String(provided || '').toLowerCase();
  const lowerUri = uri.toLowerCase();
  if (lower === 'image/png' || lowerUri.endsWith('.png')) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (lower === 'image/webp' || lowerUri.endsWith('.webp')) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return { mime: 'image/jpeg', ext: '.jpg' };
}

function normalizeSupportMediaMime(uri: string, provided?: string | null): { mime: string; ext: string; kind: 'image' | 'video' } {
  const lower = String(provided || '').toLowerCase();
  const lowerUri = uri.toLowerCase();
  if (lower.startsWith('video/') || /\.(mp4|mov|webm)(?:$|\?)/i.test(lowerUri)) {
    if (lower === 'video/quicktime' || lowerUri.endsWith('.mov')) {
      return { mime: 'video/quicktime', ext: '.mov', kind: 'video' };
    }
    if (lower === 'video/webm' || lowerUri.endsWith('.webm')) {
      return { mime: 'video/webm', ext: '.webm', kind: 'video' };
    }
    return { mime: 'video/mp4', ext: '.mp4', kind: 'video' };
  }
  const img = normalizeImageMime(uri, provided);
  return { ...img, kind: 'image' };
}

export interface DirectUploadResult {
  url: string;
  pathname: string;
  name: string;
  size: number;
  contentType: string;
}

async function uploadPrivateBlobDirect(params: {
  purpose: 'payment-proof' | 'support-media';
  uri: string;
  ownerId: string;
  filename: string;
  mime: string;
  ext: string;
  fileSize?: number | null;
  maxBytes: number;
  sizeErrorAr: string;
}): Promise<DirectUploadResult> {
  const accessToken = await api.hydrateToken();
  if (!accessToken || !params.ownerId) {
    throw new Error('يرجى تسجيل الدخول مجدداً قبل رفع الملف.');
  }

  const info = await FileSystem.getInfoAsync(params.uri);
  const resolvedSize = Number(
    params.fileSize || (info.exists && 'size' in info ? info.size : 0) || 0
  );
  if (!resolvedSize || resolvedSize > params.maxBytes) {
    throw new Error(params.sizeErrorAr);
  }

  const baseName = sanitizeSegment(params.filename || `file-${Date.now()}${params.ext}`);
  const finalName = baseName.endsWith(params.ext)
    ? baseName
    : `${baseName.replace(/\.[^.]+$/, '')}${params.ext}`;
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pathname = `uploads/${params.purpose}/${sanitizeSegment(params.ownerId)}/${nonce}-${finalName}`;

  const tokenResp = await fetch(`${API_BASE_URL}/api/uploads/blob`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: SITE_URL,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: {
        pathname,
        multipart: false,
        clientPayload: JSON.stringify({
          purpose: params.purpose,
          filename: finalName,
          contentType: params.mime,
          size: resolvedSize,
          accessToken,
        }),
      },
    }),
  });

  const tokenData = (await tokenResp.json().catch(() => ({}))) as {
    clientToken?: string;
    error?: string;
  };
  if (!tokenResp.ok || !tokenData.clientToken) {
    throw new Error(tokenData.error || 'تعذر الحصول على تصريح رفع الملف.');
  }

  const putUrl = `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`;
  const uploadResult = await FileSystem.uploadAsync(putUrl, params.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${tokenData.clientToken}`,
      'x-api-version': '12',
      'x-content-type': params.mime,
      'x-vercel-blob-access': 'private',
      'Content-Type': params.mime,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error('تعذر رفع الملف — حاول مرة أخرى أو بحجم أصغر.');
  }

  const blobJson = JSON.parse(uploadResult.body || '{}') as { url?: string; pathname?: string };
  if (!blobJson.url) {
    throw new Error('لم يتم تأكيد حفظ الملف.');
  }

  return {
    url: blobJson.url,
    pathname: blobJson.pathname || pathname,
    name: finalName,
    size: resolvedSize,
    contentType: params.mime,
  };
}

/**
 * Uploads a private payment-proof image directly to Vercel Blob via /api/uploads/blob.
 */
export async function uploadPaymentProofDirect(params: {
  uri: string;
  ownerId: string;
  filename?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<DirectUploadResult> {
  const { mime, ext } = normalizeImageMime(params.uri, params.mimeType);
  return uploadPrivateBlobDirect({
    purpose: 'payment-proof',
    uri: params.uri,
    ownerId: params.ownerId,
    filename: params.filename || `receipt-${Date.now()}${ext}`,
    mime: mime === 'image/webp' ? 'image/jpeg' : mime,
    ext: ext === '.webp' ? '.jpg' : ext,
    fileSize: params.fileSize,
    maxBytes: 10 * 1024 * 1024,
    sizeErrorAr: 'حجم صورة الإيصال يجب أن يكون أقل من 10 ميجابايت.',
  });
}

/**
 * Uploads a private support-chat image or video (up to 25 MB) directly to Vercel Blob.
 */
export async function uploadSupportMediaDirect(params: {
  uri: string;
  ownerId: string;
  filename?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<DirectUploadResult & { kind: 'image' | 'video' }> {
  const { mime, ext, kind } = normalizeSupportMediaMime(params.uri, params.mimeType);
  const uploaded = await uploadPrivateBlobDirect({
    purpose: 'support-media',
    uri: params.uri,
    ownerId: params.ownerId,
    filename: params.filename || `support-${kind}-${Date.now()}${ext}`,
    mime,
    ext,
    fileSize: params.fileSize,
    maxBytes: 25 * 1024 * 1024,
    sizeErrorAr: 'حجم الصورة أو الفيديو يجب أن يكون أقل من 25 ميجابايت.',
  });
  return { ...uploaded, kind };
}
