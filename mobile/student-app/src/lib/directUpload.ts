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
  if (lower === 'image/png' || uri.toLowerCase().endsWith('.png')) {
    return { mime: 'image/png', ext: '.png' };
  }
  return { mime: 'image/jpeg', ext: '.jpg' };
}

export interface DirectUploadResult {
  url: string;
  pathname: string;
  name: string;
  size: number;
  contentType: string;
}

/**
 * Uploads a private payment-proof image directly to Vercel Blob via the academy's
 * /api/uploads/blob token issuer using native binary streaming (expo-file-system).
 */
export async function uploadPaymentProofDirect(params: {
  uri: string;
  ownerId: string;
  filename?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<DirectUploadResult> {
  const accessToken = await api.hydrateToken();
  if (!accessToken || !params.ownerId) {
    throw new Error('يرجى تسجيل الدخول مجدداً قبل رفع إيصال الدفع.');
  }

  const info = await FileSystem.getInfoAsync(params.uri);
  const resolvedSize = Number(
    params.fileSize || (info.exists && 'size' in info ? info.size : 0) || 0
  );
  if (!resolvedSize || resolvedSize > 10 * 1024 * 1024) {
    throw new Error('حجم صورة الإيصال يجب أن يكون أقل من 10 ميجابايت.');
  }

  const { mime, ext } = normalizeImageMime(params.uri, params.mimeType);
  const baseName = sanitizeSegment(params.filename || `receipt-${Date.now()}${ext}`);
  const finalName = baseName.endsWith(ext) ? baseName : `${baseName.replace(/\.[^.]+$/, '')}${ext}`;
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pathname = `uploads/payment-proof/${sanitizeSegment(params.ownerId)}/${nonce}-${finalName}`;

  // Step 1: Request short-lived private client upload token from academy backend
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
          purpose: 'payment-proof',
          filename: finalName,
          contentType: mime,
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
    throw new Error(tokenData.error || 'تعذر الحصول على تصريح رفع إيصال الدفع.');
  }

  // Step 2: Stream binary image directly to Vercel Private Blob Storage
  const putUrl = `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`;
  const uploadResult = await FileSystem.uploadAsync(putUrl, params.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${tokenData.clientToken}`,
      'x-api-version': '12',
      'x-content-type': mime,
      'x-vercel-blob-access': 'private',
      'Content-Type': mime,
    },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error('تعذر رفع صورة الإيصال — حاول بصورة أوضح أو حجم أصغر.');
  }

  const blobJson = JSON.parse(uploadResult.body || '{}') as { url?: string; pathname?: string };
  if (!blobJson.url) {
    throw new Error('لم يتم تأكيد حفظ صورة الإيصال.');
  }

  return {
    url: blobJson.url,
    pathname: blobJson.pathname || pathname,
    name: finalName,
    size: resolvedSize,
    contentType: mime,
  };
}
