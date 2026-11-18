const FALLBACK = '/default-teacher.png';

function unwrapPublicRef(reference) {
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

export function isFallbackTeacherImage(value) {
  const reference = String(value || '').trim();
  return !reference || reference === 'not-provided' || reference === FALLBACK || reference.endsWith(FALLBACK);
}

/**
 * Public teacher media is always fetched from this site's origin.
 * This avoids CORP/same-origin blocking on cross-origin API image responses.
 * Private assets must never be converted into public references.
 */
export function teacherPublicImage(value) {
  const reference = String(value || '').trim();
  if (!reference || reference === 'not-provided') return FALLBACK;
  if (reference.startsWith('data:image/')) return reference;
  if (reference.startsWith('blob:')) return FALLBACK;

  try {
    const url = new URL(reference, 'https://wahy.invalid');
    const pathname = url.pathname;
    if (pathname === '/api/uploads/public') {
      const original = unwrapPublicRef(reference);
      return original && original !== reference
        ? `/api/uploads/public?ref=${encodeURIComponent(original)}`
        : FALLBACK;
    }

    if (pathname.startsWith('/uploads/teachers/public/') || pathname.startsWith('/uploads/teacher-public/')) {
      return pathname;
    }

    // Old records might still contain the raw Vercel Blob URL.
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')
      && (pathname.startsWith('/uploads/teacher-public/') || pathname.startsWith('/uploads/course-media/'))) {
      return `/api/uploads/public?ref=${encodeURIComponent(reference)}`;
    }

    // Other relative app images and trusted avatar URLs retain their normal behavior.
    if (reference.startsWith('/') && !reference.startsWith('//')
      && !reference.startsWith('/private/')) return reference;
    if (url.protocol === 'https:' && url.hostname !== 'wahy.invalid') return reference;
  } catch { return FALLBACK; }

  return FALLBACK;
}

export function teacherImageFallback(event) {
  const image = event.currentTarget;
  if (image && !image.src.endsWith(FALLBACK)) {
    image.src = FALLBACK;
  }
}

/** Video files must come from the teacher's uploaded media, not demo links or image fallbacks. */
export function teacherPublicVideo(value) {
  const reference = String(value || '').trim();
  if (!reference || reference === 'not-provided' || reference.startsWith('blob:')) return '';
  if (/\.(?:jpe?g|png|gif|webp|svg)(?:[?#]|$)/i.test(reference)) return '';
  try {
    const url = new URL(reference, 'https://wahy.invalid');
    if (url.pathname === '/api/uploads/public') {
      const original = unwrapPublicRef(reference);
      return original && original !== reference ? teacherPublicVideo(original) : '';
    }
    if (url.pathname.startsWith('/uploads/teachers/public/') || url.pathname.startsWith('/uploads/teacher-public/')) {
      return url.pathname;
    }
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')
      && url.pathname.startsWith('/uploads/teacher-public/')) {
      return `/api/uploads/public?ref=${encodeURIComponent(reference)}`;
    }
  } catch { return ''; }
  return '';
}
