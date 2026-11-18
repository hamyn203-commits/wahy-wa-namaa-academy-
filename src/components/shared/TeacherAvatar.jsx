import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import {
  isFallbackTeacherImage,
  teacherImageFallback,
  teacherPublicImage,
} from '../../lib/teacherMedia';

function extractInitials(name) {
  const cleaned = String(name || '')
    .trim()
    .replace(/^(?:الشيخ|الشيخة|المعلم|المعلمة|الأستاذ|الأستاذة|د\.|أ\.|Sheikh|Ustadh|Ustadha|Dr\.)\s+/i, '')
    .trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  const first = parts[0].charAt(0);
  const second = parts[1].charAt(0);
  return /[\u0600-\u06FF]/.test(`${first}${second}`) ? `${first} ${second}` : `${first}${second}`;
}

export default function TeacherAvatar({
  src,
  name = '',
  alt,
  className = '',
  imgClassName = 'h-full w-full object-cover',
  loading = 'lazy',
  fetchPriority,
  size = 'md',
}) {
  const resolvedSrc = teacherPublicImage(src);
  const [failedSrc, setFailedSrc] = useState('');
  const [loadedSrc, setLoadedSrc] = useState('');

  const isFallback = isFallbackTeacherImage(resolvedSrc) || failedSrc === resolvedSrc;
  const isLoaded = !isFallback && loadedSrc === resolvedSrc;
  const initials = extractInitials(name);

  const textSizeClass = size === 'xl'
    ? 'text-4xl'
    : size === 'lg'
      ? 'text-2xl'
      : size === 'sm'
        ? 'text-sm'
        : 'text-xl';

  return (
    <div
      className={`relative overflow-hidden select-none bg-gradient-to-br from-[var(--wn-emerald-deep)] via-[var(--wn-emerald-dark)] to-[var(--wn-emerald)] ${className}`}
    >
      {isFallback ? (
        <div
          className="grid h-full w-full place-items-center text-[var(--wn-gold-soft)]"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            {initials ? (
              <span className={`font-display font-black tracking-tight ${textSizeClass}`}>
                {initials}
              </span>
            ) : (
              <GraduationCap size={size === 'xl' ? 42 : size === 'sm' ? 18 : 28} strokeWidth={1.5} />
            )}
          </div>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-[var(--wn-emerald-soft)] to-[var(--wn-gold-soft)]"
              aria-hidden="true"
            />
          )}
          <img
            src={resolvedSrc}
            alt={alt || name || 'Teacher'}
            loading={loading}
            decoding="async"
            fetchPriority={fetchPriority}
            onLoad={() => setLoadedSrc(resolvedSrc)}
            onError={(event) => {
              setFailedSrc(resolvedSrc);
              teacherImageFallback(event);
            }}
            className={`${imgClassName} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
    </div>
  );
}
