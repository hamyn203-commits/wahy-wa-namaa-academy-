import { API_BASE_URL, SITE_URL } from './config';
import { PublicTeacher } from '../types/academy';

const DEFAULT_FALLBACK_MARKER = '/default-teacher.png';

function unwrapPublicRef(reference: string): string {
  let current = String(reference || '').trim();
  for (let hop = 0; hop < 3; hop += 1) {
    try {
      const parsed = new URL(current, 'https://wahy.invalid');
      if (parsed.pathname === '/api/uploads/public') {
        const inner = parsed.searchParams.get('ref');
        if (inner && inner.trim() && inner.trim() !== current) {
          current = inner.trim();
          continue;
        }
      }
    } catch {
      return current;
    }
    break;
  }
  return current;
}

export function resolvePublicMediaUrl(raw?: string | null, kind: 'image' | 'video' = 'image'): string | null {
  const reference = String(raw || '').trim();
  if (!reference || reference === 'not-provided' || reference.startsWith('blob:')) return null;
  if (reference === DEFAULT_FALLBACK_MARKER || reference.endsWith(DEFAULT_FALLBACK_MARKER)) return null;
  if (kind === 'image' && reference.startsWith('data:image/')) return reference;
  if (kind === 'video' && /\.(?:jpe?g|png|gif|webp|svg)(?:[?#]|$)/i.test(reference)) return null;

  try {
    const parsed = new URL(reference, 'https://wahy.invalid');
    const pathname = parsed.pathname;

    // Normalize public proxy refs onto our primary API_BASE_URL
    if (pathname === '/api/uploads/public') {
      const original = unwrapPublicRef(reference);
      if (!original || original === reference) return null;
      return `${API_BASE_URL}/api/uploads/public?ref=${encodeURIComponent(original)}`;
    }

    // Legacy raw Vercel Blob URLs must be proxied via /api/uploads/public
    if (
      parsed.protocol === 'https:'
      && parsed.hostname.endsWith('.blob.vercel-storage.com')
      && (pathname.startsWith('/uploads/teacher-public/') || pathname.startsWith('/uploads/course-media/'))
    ) {
      return `${API_BASE_URL}/api/uploads/public?ref=${encodeURIComponent(reference)}`;
    }

    if (pathname.startsWith('/uploads/teachers/public/') || pathname.startsWith('/uploads/teacher-public/')) {
      return `${API_BASE_URL}${pathname}`;
    }

    if (reference.startsWith('/') && !reference.startsWith('//') && !reference.startsWith('/private/')) {
      return `${SITE_URL}${reference}`;
    }

    if (parsed.protocol === 'https:' && parsed.hostname !== 'wahy.invalid') {
      return reference;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveTeacherPhotoUrl(teacher?: PublicTeacher | null): string | null {
  if (!teacher) return null;
  const fromProfile = resolvePublicMediaUrl(teacher.media?.profilePhoto, 'image');
  if (fromProfile) return fromProfile;
  return resolvePublicMediaUrl(teacher.user?.avatar, 'image');
}

export interface TeacherVideoItem {
  id: string;
  labelAr: string;
  labelEn: string;
  url: string;
}

export function resolveTeacherVideos(teacher?: PublicTeacher | null): TeacherVideoItem[] {
  if (!teacher?.media) return [];
  const items: TeacherVideoItem[] = [];
  const seen = new Set<string>();

  const pushVideo = (id: string, labelAr: string, labelEn: string, raw?: string) => {
    const url = resolvePublicMediaUrl(raw, 'video');
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({ id, labelAr, labelEn, url });
  };

  pushVideo('recitation', 'تلاوة المعلم', 'Recitation', teacher.media.recitationVideo);
  pushVideo('intro', 'فيديو تعريفي', 'Introduction', teacher.media.introductionVideo);
  pushVideo('teaching', 'أسلوب التدريس', 'Teaching Style', teacher.media.teachingMethodVideo);

  const extras = Array.isArray(teacher.media.additionalVideos) ? teacher.media.additionalVideos : [];
  extras.forEach((raw, idx) => {
    pushVideo(`extra-${idx}`, `فيديو إضافي ${idx + 1}`, `Video ${idx + 1}`, raw);
  });

  return items;
}
