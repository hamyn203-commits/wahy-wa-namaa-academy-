import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Play,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import Modal from '../../components/shared/Modal';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import Skeleton from '../../components/shared/Skeleton';
import { teacherPublicImage, teacherPublicVideo } from '../../lib/teacherMedia';
import { fetchTeacherBundle } from '../../lib/teacherProfileCache';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { languageName, specName } from '../TeacherProfile/teacherLabels';

export default function TeacherQuickPreviewModal({
  teacher,
  locale: propLocale,
  onClose,
}) {
  const { locale: ctxLocale, t } = useI18n();
  const activeLocale = propLocale || ctxLocale || 'ar';
  const lp = (path) => localizedPath(path, activeLocale);
  const teacherId = String(teacher?._id || '');

  const mp = t?.student?.marketplace || {};
  const mpSpecs = mp.specs || {};
  const mpLangs = mp.languages || {};
  const common = t?.common || {};

  const [bundle, setBundle] = useState({ teacher, reviews: [], availability: { configured: false, slots: [] } });
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retrySeq, setRetrySeq] = useState(0);
  const [playingKind, setPlayingKind] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [videoRetryNonce, setVideoRetryNonce] = useState(0);

  useEffect(() => {
    if (!teacherId) return undefined;
    let cancelled = false;
    setLoadingDetails(true);
    setLoadError(false);
    setPlayingKind('');
    setVideoError(false);
    setBundle({ teacher, reviews: [], availability: { configured: false, slots: [] } });

    fetchTeacherBundle(teacherId)
      .then((result) => {
        if (cancelled) return;
        setBundle({
          teacher: result.teacher || teacher,
          reviews: result.reviews || [],
          availability: result.availability || { configured: false, slots: [] },
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teacherId, teacher, retrySeq]);

  if (!teacher) return null;

  const activeTeacher = bundle.teacher || teacher;
  const name = activeTeacher.user?.name || activeTeacher.personalInfo?.fullName || (t?.student?.booking?.quranTeacher || 'Quran tutor');
  const rating = Number(activeTeacher.rating?.average || 0);
  const ratingCount = Number(activeTeacher.rating?.count || 0);
  const experience = Number(activeTeacher.quranInfo?.teachingExperience || 0);
  const ijazat = Number(activeTeacher.quranInfo?.numberOfIjazat || 0);
  const parts = Number(activeTeacher.quranInfo?.memorizedParts || 0);
  const specializations = Array.isArray(activeTeacher.quranInfo?.specializations)
    ? activeTeacher.quranInfo.specializations
    : [];
  const languages = Array.isArray(activeTeacher.languages) ? activeTeacher.languages : [];

  const introUrl = teacherPublicVideo(activeTeacher.media?.introductionVideo);
  const recitationUrl = teacherPublicVideo(activeTeacher.media?.recitationVideo);
  const activeVideoUrl = playingKind === 'intro' ? introUrl : playingKind === 'recitation' ? recitationUrl : '';
  const nearestSlots = Array.isArray(bundle.availability?.slots) ? bundle.availability.slots.slice(0, 4) : [];
  const intlLocale = resolveIntlLocale(activeLocale);

  const resolveSpecLabel = (spec) => {
    const keyMap = { 'non-arabic': 'nonArabic', 'arabic-language': 'arabicLanguage' };
    return mpSpecs[keyMap[spec] || spec] || specName(spec, activeLocale);
  };

  const resolveLangLabel = (lang) => {
    const k = String(lang || '').toLowerCase();
    return mpLangs[k] || languageName(lang, activeLocale);
  };

  return (
    <Modal isOpen={Boolean(teacher)} onClose={onClose} title={name} maxWidth="42rem">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <TeacherAvatar
            src={teacherPublicImage(activeTeacher.media?.profilePhoto || activeTeacher.user?.avatar)}
            name={name}
            alt={name}
            size="lg"
            loading="eager"
            className="h-20 w-20 shrink-0 rounded-2xl border border-[var(--wn-border-mint)]"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {activeTeacher.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wn-emerald-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  {mp.verified || 'Verified'}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--wn-text-secondary)]">
              {rating > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-[var(--wn-text-gold)]">
                  <Star size={13} fill="currentColor" aria-hidden="true" /> {rating.toFixed(1)}
                  {ratingCount > 0 ? <span className="font-normal">({ratingCount})</span> : null}
                </span>
              )}
              {experience > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} aria-hidden="true" /> {experience} {mp.yearsUnit || 'years'}
                </span>
              )}
              {parts > 0 && (
                <span className="inline-flex items-center gap-1">
                  <BookOpen size={13} aria-hidden="true" /> {parts} {mp.juzUnit || 'juz'}
                </span>
              )}
              {ijazat > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Award size={13} aria-hidden="true" /> {ijazat} {mp.ijazahsUnit || 'ijazahs'}
                </span>
              )}
            </div>
          </div>
        </div>

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-3 text-xs text-[var(--wn-text-danger)]">
            <span>{t?.student?.errors?.loadFailed || 'Could not load data. Please try again.'}</span>
            <button
              type="button"
              onClick={() => setRetrySeq((n) => n + 1)}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-1.5 font-bold text-[var(--wn-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>{common.retry || 'Try again'}</span>
            </button>
          </div>
        )}

        {(introUrl || recitationUrl) && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {introUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setVideoError(false);
                    setPlayingKind((current) => (current === 'intro' ? '' : 'intro'));
                  }}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                    playingKind === 'intro'
                      ? 'border-[var(--wn-emerald-deep)] bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                  }`}
                >
                  <Play size={14} aria-hidden="true" />
                  <span>{mp.watchIntro || 'Watch intro'}</span>
                </button>
              )}
              {recitationUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setVideoError(false);
                    setPlayingKind((current) => (current === 'recitation' ? '' : 'recitation'));
                  }}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                    playingKind === 'recitation'
                      ? 'border-[var(--wn-emerald-deep)] bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                  }`}
                >
                  <Play size={14} aria-hidden="true" />
                  <span>{mp.hearRecitation || 'Hear recitation'}</span>
                </button>
              )}
            </div>
            {activeVideoUrl && (
              <div className="overflow-hidden rounded-2xl bg-[var(--wn-emerald-deep)]">
                <video
                  key={`${activeVideoUrl}-${videoRetryNonce}`}
                  src={activeVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setVideoError(false)}
                  onError={() => setVideoError(true)}
                  className="aspect-video w-full"
                />
                {videoError && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-2 bg-[var(--wn-danger-soft)] px-3.5 py-2 text-xs text-[var(--wn-text-danger)]">
                    <span>{t?.student?.errors?.loadFailed || (activeLocale === 'ar' ? 'تعذر تشغيل الفيديو حاليًا.' : 'Could not play this video right now.')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoError(false);
                        setVideoRetryNonce((n) => n + 1);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2.5 py-1 font-bold text-[var(--wn-text-primary)]"
                    >
                      <RefreshCw size={13} aria-hidden="true" />
                      <span>{common.retry || (activeLocale === 'ar' ? 'إعادة المحاولة' : 'Try again')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 space-y-3">
          <h4 className="text-sm font-extrabold text-[var(--wn-heading)]">{mp.aboutTutor || 'About the tutor'}</h4>
          {loadingDetails && !activeTeacher.user?.bio ? (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--wn-text-secondary)]">
              {activeTeacher.user?.bio || (mp.defaultBio || 'Certified Quran tutor at Wahy Wa Namaa Academy.')}
            </p>
          )}
          {specializations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {specializations.map((spec) => (
                <span key={spec} className="rounded-full bg-[var(--wn-emerald-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                  {resolveSpecLabel(spec)}
                </span>
              ))}
              {languages.map((lang) => (
                <span key={lang} className="rounded-full border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--wn-text-secondary)]">
                  {resolveLangLabel(lang)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-extrabold text-[var(--wn-heading)] flex items-center gap-1.5">
            <Calendar size={15} className="text-[var(--wn-link)]" aria-hidden="true" />
            <span>{mp.nearestSlots || 'Nearest available slots'}</span>
          </h4>
          {loadingDetails ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Skeleton className="h-11 rounded-xl" /><Skeleton className="h-11 rounded-xl" /></div>
          ) : nearestSlots.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {nearestSlots.map((slot) => (
                <Link
                  key={slot.startsAt}
                  to={lp(`/book-trial/${teacherId}?time=${encodeURIComponent(slot.startsAt)}`)}
                  onClick={onClose}
                  className="min-h-[44px] flex items-center rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3 py-2 text-xs font-bold text-[var(--wn-badge-emerald-text)] hover:border-[var(--wn-emerald)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  {new Date(slot.startsAt).toLocaleString(intlLocale, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--wn-text-secondary)]">
              {mp.suggestTimeNote || 'You can suggest your preferred time on the booking page.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Link
            to={lp('/teachers/' + teacherId)}
            state={{ prefetchedTeacher: activeTeacher }}
            onClick={onClose}
            className="wn-btn wn-btn--secondary wn-btn--md wn-btn--block min-h-[44px]"
          >
            <BookOpen size={15} aria-hidden="true" />
            <span>{mp.fullProfile || 'Full profile'}</span>
          </Link>
          <Link
            to={lp('/book-trial/' + teacherId)}
            onClick={onClose}
            className="wn-btn wn-btn--primary wn-btn--md wn-btn--block min-h-[44px]"
          >
            <GraduationCap size={15} aria-hidden="true" />
            <span>{mp.bookTrial || 'Book trial'}</span>
          </Link>
        </div>
      </div>
    </Modal>
  );
}

