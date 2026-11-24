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

function normalizeAudioMime(uri: string, provided?: string | null): { mime: string; ext: string } {
  const lower = String(provided || '').toLowerCase();
  const lowerUri = uri.toLowerCase();
  if (lower.includes('mpeg') || lowerUri.endsWith('.mp3')) {
    return { mime: 'audio/mpeg', ext: '.mp3' };
  }
  if (lower.includes('wav') || lowerUri.endsWith('.wav')) {
    return { mime: 'audio/wav', ext: '.wav' };
  }
  if (lower.includes('ogg') || lowerUri.endsWith('.ogg')) {
    return { mime: 'audio/ogg', ext: '.ogg' };
  }
  if (lower.includes('webm') || lowerUri.endsWith('.webm')) {
    return { mime: 'audio/webm', ext: '.webm' };
  }
  return { mime: 'audio/mp4', ext: '.m4a' };
}

export interface DirectUploadResult {
  url: string;
  pathname: string;
  name: string;
  size: number;
  contentType: string;
}

async function uploadBlobDirect(params: {
  purpose: 'teacher-feedback-audio' | 'teacher-public' | 'session-chat-audio';
  access: 'private' | 'public';
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
      'x-vercel-blob-access': params.access,
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
 * Uploads teacher voice feedback for homework review.
 * Tries direct Vercel Blob upload first; falls back cleanly to multipart endpoint on local/dev servers.
 */
export async function uploadTeacherFeedbackAudio(params: {
  taskId: string;
  uri: string;
  ownerId: string;
  durationSeconds: number;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<{ mode: 'direct'; feedbackAudio: DirectUploadResult & { durationSeconds: number } } | { mode: 'multipart' }> {
  const { mime, ext } = normalizeAudioMime(params.uri, params.mimeType);
  try {
    const uploaded = await uploadBlobDirect({
      purpose: 'teacher-feedback-audio',
      access: 'private',
      uri: params.uri,
      ownerId: params.ownerId,
      filename: `feedback-${Date.now()}${ext}`,
      mime,
      ext,
      fileSize: params.fileSize,
      maxBytes: 10 * 1024 * 1024,
      sizeErrorAr: 'حجم التسجيل الصوتي يجب ألا يتجاوز 10 ميجابايت.',
    });
    return {
      mode: 'direct',
      feedbackAudio: {
        ...uploaded,
        durationSeconds: Math.max(1, Math.round(params.durationSeconds || 1)),
      },
    };
  } catch {
    // Fallback to multipart endpoint (works in local/mock or non-Vercel-Blob environments).
    const formData = new FormData();
    formData.append('audio', {
      uri: params.uri,
      name: `feedback-${Date.now()}${ext}`,
      type: mime,
    } as unknown as Blob);
    formData.append('durationSeconds', String(Math.max(1, Math.round(params.durationSeconds || 1))));
    await api.uploadMultipart(`/api/homework/tasks/${params.taskId}/feedback-audio`, formData, { auth: true });
    return { mode: 'multipart' };
  }
}

/**
 * Uploads a private voice note for session chat (/api/sessions/:id/translate/messages).
 */
export async function uploadSessionChatAudioDirect(params: {
  uri: string;
  ownerId: string;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<DirectUploadResult> {
  const { mime, ext } = normalizeAudioMime(params.uri, params.mimeType);
  return uploadBlobDirect({
    purpose: 'session-chat-audio',
    access: 'private',
    uri: params.uri,
    ownerId: params.ownerId,
    filename: `chat-voice-${Date.now()}${ext}`,
    mime,
    ext,
    fileSize: params.fileSize,
    maxBytes: 10 * 1024 * 1024,
    sizeErrorAr: 'حجم الرسالة الصوتية يجب ألا يتجاوز 10 ميجابايت.',
  });
}

/**
 * Uploads teacher public profile photo for /api/teachers/dashboard/profile-change.
 */
export async function uploadTeacherProfilePhotoDirect(params: {
  uri: string;
  ownerId: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<DirectUploadResult> {
  const { mime, ext } = normalizeImageMime(params.uri, params.mimeType);
  return uploadBlobDirect({
    purpose: 'teacher-public',
    access: 'public',
    uri: params.uri,
    ownerId: params.ownerId,
    filename: params.fileName || `profile-photo-${Date.now()}${ext}`,
    mime,
    ext,
    fileSize: params.fileSize,
    maxBytes: 5 * 1024 * 1024,
    sizeErrorAr: 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت.',
  });
}
