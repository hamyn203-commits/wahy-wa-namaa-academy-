import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import Skeleton from '../shared/Skeleton';
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

export default function VideoLesson({ lesson, locale: propLocale }) {
  const { locale: ctxLocale, isRTL, t, dir } = useI18n();
  const locale = propLocale || ctxLocale;
  const protectedMediaUrl = lesson?.content?.video?.protectedMediaUrl || '';
  const rawUrl = lesson?.content?.video?.url || '';
  const [signedUrl, setSignedUrl] = useState('');
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    if (!protectedMediaUrl) {
      setSignedUrl('');
      setMediaError('');
      setLoadingMedia(false);
      return undefined;
    }
    setLoadingMedia(true);
    setMediaError('');
    api.get(protectedMediaUrl, { auth: true })
      .then((res) => {
        if (active) setSignedUrl(typeof res?.url === 'string' ? res.url : '');
      })
      .catch((err) => {
        if (active) {
          setSignedUrl('');
          setMediaError(err?.message || t.lms?.videoLesson?.loadError || 'Unable to load video');
        }
      })
      .finally(() => {
        if (active) setLoadingMedia(false);
      });
    return () => {
      active = false;
    };
  }, [protectedMediaUrl, retryCount, t.lms?.videoLesson?.loadError]);

  const resolved = signedUrl
    ? { kind: 'video', url: signedUrl }
    : resolveSafeVideoSource(rawUrl);

  const videoTitle = isRTL
    ? (lesson?.title?.[locale] || lesson?.title?.ar || lesson?.title?.en || t.lms?.videoLesson?.lessonVideoTitle || 'Lesson video')
    : (lesson?.title?.[locale] || lesson?.title?.en || lesson?.title?.ar || t.lms?.videoLesson?.lessonVideoTitle || 'Lesson video');

  const description = isRTL
    ? (lesson?.description?.[locale] || lesson?.description?.ar || lesson?.description?.en || '')
    : (lesson?.description?.[locale] || lesson?.description?.en || lesson?.description?.ar || '');

  return (
    <div className="max-w-4xl mx-auto" dir={dir}>
      <div className="aspect-video bg-[var(--wn-surface-sunken)] border border-[var(--wn-border)] rounded-2xl overflow-hidden shadow-lg">
        {loadingMedia ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6" role="status" aria-live="polite">
            <Skeleton className="w-24 h-24 rounded-full" />
            <span className="text-sm text-[var(--wn-text-secondary)]">
              {t.lms?.videoLesson?.videoLoading || 'Loading video…'}
            </span>
          </div>
        ) : mediaError && resolved.kind === 'none' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-[var(--wn-text-danger)]">{mediaError}</p>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="wn-btn wn-btn--primary min-h-[44px]"
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t.common?.retry || 'Try again'}</span>
            </button>
          </div>
        ) : resolved.kind === 'video' ? (
          <video
            src={resolved.url}
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
            className="w-full h-full bg-black"
          />
        ) : resolved.kind === 'embed' ? (
          <iframe
            src={resolved.url}
            title={videoTitle}
            className="w-full h-full"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--wn-text-secondary)] p-6 text-center">
            {t.lms?.videoLesson?.noVideo || 'No video available'}
          </div>
        )}
      </div>
      {description ? (
        <p className="mt-4 text-[var(--wn-text-secondary)] leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
