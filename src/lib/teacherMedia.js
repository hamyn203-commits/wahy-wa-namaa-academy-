const FALLBACK = '/default-teacher.png';

function unwrapPublicRef(reference) {
  let current = String(reference || '').trim();
  for (let hop = 0; hop < 3; hop += 1) {
    try {
      const parsed = new URL(current, 'https://wahy.invalid');
      if (parsed.pathname === '/api/uploads/public' || parsed.pathname.endsWith('/api/uploads/public')) {
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

function isAllowedPublicStoragePath(pathname, { allowStudentAvatar = false } = {}) {
  if (!pathname || pathname.includes('..') || pathname.includes('\\')) return false;
  if (pathname.startsWith('/uploads/teacher-public/')) return true;
  if (allowStudentAvatar && pathname.startsWith('/uploads/student-avatar/')) return true;
  return false;
}

export function isFallbackTeacherImage(value) {
  const reference = String(value || '').trim();
  return !reference || reference === 'not-provided' || reference === FALLBACK || reference.endsWith(FALLBACK);
}

/**
 * Public teacher media is always fetched from this site's origin.
 * This avoids CORP/same-origin blocking on cross-origin API image responses.
 * Private assets and paid course media must never be converted into public references.
 */
export function teacherPublicImage(value) {
  const reference = String(value || '').trim();
  if (!reference || reference === 'not-provided') return FALLBACK;
  if (reference.startsWith('data:image/')) return reference;
  if (reference.startsWith('blob:')) return FALLBACK;
  if (/\.(?:mp4|webm|mov|m4v|ogv|mp3|wav|ogg|m4a|pdf)(?:[?#]|$)/i.test(reference)) return FALLBACK;

  try {
    const url = new URL(reference, 'https://wahy.invalid');
    const pathname = url.pathname;

    if (pathname === '/api/uploads/public' || pathname.endsWith('/api/uploads/public')) {
      const original = unwrapPublicRef(reference);
      if (!original || original === reference) return FALLBACK;
      const innerUrl = new URL(original, 'https://wahy.invalid');
      if (
        isAllowedPublicStoragePath(innerUrl.pathname, { allowStudentAvatar: true })
        || innerUrl.pathname.startsWith('/uploads/teachers/public/')
      ) {
        return `/api/uploads/public?ref=${encodeURIComponent(original)}`;
      }
      return FALLBACK;
    }

    // Check Vercel Blob URLs BEFORE local /uploads/... path checks so blob hostnames are never stripped!
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')) {
      return isAllowedPublicStoragePath(pathname, { allowStudentAvatar: true })
        ? `/api/uploads/public?ref=${encodeURIComponent(reference)}`
        : FALLBACK;
    }

    // Relative paths on this site
    if (url.hostname === 'wahy.invalid') {
      if (pathname.startsWith('/uploads/teachers/public/') || pathname.startsWith('/uploads/teacher-public/')) {
        return pathname;
      }
      if (reference.startsWith('/') && !reference.startsWith('//') && !reference.startsWith('/private/')) {
        return reference;
      }
      return FALLBACK;
    }

    // Legacy public disk uploads hosted on the API origin rewrite cleanly via /uploads/:path*
    if (url.protocol === 'https:' && pathname.startsWith('/uploads/teachers/public/')) {
      return pathname;
    }

    // Other trusted HTTPS avatar URLs (e.g. OAuth provider avatars)
    if (url.protocol === 'https:' && !pathname.startsWith('/private/') && !pathname.startsWith('/uploads/teacher-private/') && !pathname.startsWith('/uploads/course-media/')) {
      return reference;
    }
  } catch {
    return FALLBACK;
  }

  return FALLBACK;
}

export function teacherImageFallback(event) {
  const image = event?.currentTarget;
  if (image && !image.src.endsWith(FALLBACK)) {
    image.src = FALLBACK;
  }
}

/** Video files must come from the teacher's uploaded media, not demo links or image fallbacks. */
export function teacherPublicVideo(value) {
  const reference = String(value || '').trim();
  if (!reference || reference === 'not-provided' || reference.startsWith('blob:')) return '';
  if (reference === FALLBACK || reference.endsWith(FALLBACK)) return '';
  if (/\.(?:jpe?g|png|gif|webp|svg|pdf|mp3|wav|ogg|m4a)(?:[?#]|$)/i.test(reference)) return '';

  try {
    const url = new URL(reference, 'https://wahy.invalid');
    const pathname = url.pathname;

    if (pathname === '/api/uploads/public' || pathname.endsWith('/api/uploads/public')) {
      const original = unwrapPublicRef(reference);
      return original && original !== reference ? teacherPublicVideo(original) : '';
    }

    // Must check Vercel Blob BEFORE checking pathname prefixes, otherwise the blob hostname is stripped to a 404!
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')) {
      return isAllowedPublicStoragePath(pathname)
        ? `/api/uploads/public?ref=${encodeURIComponent(reference)}`
        : '';
    }

    // Relative site/E2E/legacy video paths
    if (url.hostname === 'wahy.invalid') {
      if (pathname.startsWith('/uploads/teachers/public/') || pathname.startsWith('/uploads/teacher-public/')) {
        return pathname;
      }
      if (
        reference.startsWith('/')
        && !reference.startsWith('//')
        && !reference.startsWith('/private/')
        && /\.(?:mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(pathname)
      ) {
        return pathname;
      }
      return '';
    }

    // Legacy disk uploads on API host
    if (url.protocol === 'https:' && pathname.startsWith('/uploads/teachers/public/')) {
      return pathname;
    }

    // S3 or external object storage under uploads/teacher-public/
    if (url.protocol === 'https:' && isAllowedPublicStoragePath(pathname)) {
      return `/api/uploads/public?ref=${encodeURIComponent(reference)}`;
    }
  } catch {
    return '';
  }
  return '';
}

/** Audio recordings must also route through the same-origin /api/uploads/public proxy when stored in private object storage. */
export function teacherPublicAudio(value) {
  const reference = String(value || '').trim();
  if (!reference || reference === 'not-provided' || reference.startsWith('blob:')) return '';
  if (reference === FALLBACK || reference.endsWith(FALLBACK)) return '';
  if (/\.(?:jpe?g|png|gif|webp|svg|pdf|mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(reference)) return '';

  try {
    const url = new URL(reference, 'https://wahy.invalid');
    const pathname = url.pathname;

    if (pathname === '/api/uploads/public' || pathname.endsWith('/api/uploads/public')) {
      const original = unwrapPublicRef(reference);
      return original && original !== reference ? teacherPublicAudio(original) : '';
    }

    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')) {
      return isAllowedPublicStoragePath(pathname)
        ? `/api/uploads/public?ref=${encodeURIComponent(reference)}`
        : '';
    }

    if (url.hostname === 'wahy.invalid') {
      if (pathname.startsWith('/uploads/teachers/public/') || pathname.startsWith('/uploads/teacher-public/')) {
        return pathname;
      }
      if (
        reference.startsWith('/')
        && !reference.startsWith('//')
        && !reference.startsWith('/private/')
        && /\.(?:mp3|wav|ogg|m4a)(?:[?#]|$)/i.test(pathname)
      ) {
        return pathname;
      }
      return '';
    }

    if (url.protocol === 'https:' && pathname.startsWith('/uploads/teachers/public/')) {
      return pathname;
    }

    if (url.protocol === 'https:' && isAllowedPublicStoragePath(pathname)) {
      return `/api/uploads/public?ref=${encodeURIComponent(reference)}`;
    }
  } catch {
    return '';
  }
  return '';
}
