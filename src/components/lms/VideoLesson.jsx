import { useEffect, useState } from 'react';
import api from '../../lib/api';

function resolveSafeVideoSource(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return { kind: 'none', url: '' };

  if (trimmed.startsWith('/uploads/') && /\.(mp4|webm|ogg)(?:$|[?#])/i.test(trimmed)) {
    return { kind: 'video', url: trimmed };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { kind: 'none', url: '' };
  }

  if (parsed.protocol !== 'https:') {
    return { kind: 'none', url: '' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    if (/^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
      return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    return { kind: 'none', url: '' };
  }

  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'www.youtube-nocookie.com') {
    if (parsed.pathname.startsWith('/embed/')) {
      const id = parsed.pathname.slice('/embed/'.length).split('/')[0];
      if (/^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
        return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` };
      }
      return { kind: 'none', url: '' };
    }
    const id = parsed.searchParams.get('v') || '';
    if (/^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
      return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    return { kind: 'none', url: '' };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/\/(?:video\/)?(\d{5,15})/);
    if (match) {
      return { kind: 'embed', url: `https://player.vimeo.com/video/${match[1]}` };
    }
    return { kind: 'none', url: '' };
  }

  if (/\.(mp4|webm|ogg)(?:$|[?#])/i.test(parsed.pathname)) {
    return { kind: 'video', url: parsed.href };
  }

  return { kind: 'none', url: '' };
}

export default function VideoLesson({ lesson, locale }) {
  const protectedMediaUrl = lesson?.content?.video?.protectedMediaUrl || '';
  const rawUrl = lesson?.content?.video?.url || '';
  const [signedUrl, setSignedUrl] = useState('');
  const [loadingMedia, setLoadingMedia] = useState(false);

  useEffect(() => {
    let active = true;
    if (!protectedMediaUrl) {
      setSignedUrl('');
      setLoadingMedia(false);
      return undefined;
    }
    setLoadingMedia(true);
    api.get(protectedMediaUrl, { auth: true })
      .then((res) => {
        if (active) setSignedUrl(typeof res?.url === 'string' ? res.url : '');
      })
      .catch(() => {
        if (active) setSignedUrl('');
      })
      .finally(() => {
        if (active) setLoadingMedia(false);
      });
    return () => {
      active = false;
    };
  }, [protectedMediaUrl]);

  const resolved = signedUrl
    ? { kind: 'video', url: signedUrl }
    : resolveSafeVideoSource(rawUrl);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
        {loadingMedia ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {locale === 'ar' ? 'جاري تجهيز الفيديو...' : 'Loading video...'}
          </div>
        ) : resolved.kind === 'video' ? (
          <video
            src={resolved.url}
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
            className="w-full h-full"
          />
        ) : resolved.kind === 'embed' ? (
          <iframe
            src={resolved.url}
            title={lesson?.title?.[locale] || lesson?.title?.ar || 'Lesson video'}
            className="w-full h-full"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {locale === 'ar' ? 'لا يوجد فيديو' : 'No video available'}
          </div>
        )}
      </div>
      {lesson?.description?.[locale] && (
        <p className="mt-4 text-gray-300 leading-relaxed">{lesson.description[locale]}</p>
      )}
    </div>
  );
}
