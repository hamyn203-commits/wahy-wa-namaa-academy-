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
  Star,
  X,
} from 'lucide-react';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import Skeleton from '../../components/shared/Skeleton';
import { teacherPublicImage, teacherPublicVideo } from '../../lib/teacherMedia';
import { fetchTeacherBundle } from '../../lib/teacherProfileCache';
import { localizedPath } from '../../lib/locale';
import { languageName, specName } from '../TeacherProfile/teacherLabels';

export default function TeacherQuickPreviewModal({
  teacher,
  locale = 'ar',
  onClose,
}) {
  const isAr = locale === 'ar';
  const lp = (path) => localizedPath(path, locale);
  const teacherId = String(teacher?._id || '');

  const [bundle, setBundle] = useState({ teacher, reviews: [], availability: { configured: false, slots: [] } });
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [playingKind, setPlayingKind] = useState('');

  useEffect(() => {
    if (!teacherId) return undefined;
    let cancelled = false;
    setLoadingDetails(true);
    setPlayingKind('');
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
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [teacherId, teacher, onClose]);

  if (!teacher) return null;

  const activeTeacher = bundle.teacher || teacher;
  const name = activeTeacher.user?.name || activeTeacher.personalInfo?.fullName || (isAr ? 'معلم قرآن' : 'Quran tutor');
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 md:p-6 shadow-2xl space-y-5">
        <button
          type="button"
          onClick={onClose}
          aria-label={isAr ? 'إغلاق' : 'Close'}
          className="absolute top-4 end-4 grid h-10 w-10 place-items-center rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] hover:text-[var(--wn-emerald-dark)]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 pe-12">
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
              <h3 className="text-xl font-black text-[var(--wn-heading)]">{name}</h3>
              {activeTeacher.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wn-emerald-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--wn-emerald-dark)]">
                  <CheckCircle2 size={12} />
                  {isAr ? 'موثق' : 'Verified'}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--wn-text-secondary)]">
              {rating > 0 && (
                <span className="inline-flex items-center gap-1 font-bold text-[var(--wn-gold-dark)]">
                  <Star size={13} fill="currentColor" /> {rating.toFixed(1)}
                  {ratingCount > 0 ? <span className="font-normal">({ratingCount})</span> : null}
                </span>
              )}
              {experience > 0 && <span className="inline-flex items-center gap-1"><Clock size={13} /> {experience} {isAr ? 'سنوات' : 'yrs'}</span>}
              {parts > 0 && <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {parts} {isAr ? 'جزءًا' : 'juz'}</span>}
              {ijazat > 0 && <span className="inline-flex items-center gap-1"><Award size={13} /> {ijazat} {isAr ? 'إجازات' : 'ijazahs'}</span>}
            </div>
          </div>
        </div>

        {(introUrl || recitationUrl) && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {introUrl && (
                <button
                  type="button"
                  onClick={() => setPlayingKind((current) => (current === 'intro' ? '' : 'intro'))}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    playingKind === 'intro'
                      ? 'border-[var(--wn-emerald-deep)] bg-[var(--wn-emerald-deep)] text-[var(--wn-white)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                  }`}
                >
                  <Play size={14} />
                  <span>{isAr ? 'شاهد التعريف' : 'Watch intro'}</span>
                </button>
              )}
              {recitationUrl && (
                <button
                  type="button"
                  onClick={() => setPlayingKind((current) => (current === 'recitation' ? '' : 'recitation'))}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    playingKind === 'recitation'
                      ? 'border-[var(--wn-emerald-deep)] bg-[var(--wn-emerald-deep)] text-[var(--wn-white)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                  }`}
                >
                  <Play size={14} />
                  <span>{isAr ? 'استمع للتلاوة' : 'Hear recitation'}</span>
                </button>
              )}
            </div>
            {activeVideoUrl && (
              <div className="overflow-hidden rounded-2xl bg-[var(--wn-emerald-deep)]">
                <video key={activeVideoUrl} controls autoPlay playsInline preload="metadata" className="aspect-video w-full">
                  <source src={activeVideoUrl} />
                </video>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 space-y-3">
          <h4 className="text-sm font-extrabold text-[var(--wn-heading)]">{isAr ? 'نبذة عن المعلم' : 'About the tutor'}</h4>
          {loadingDetails && !activeTeacher.user?.bio ? (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--wn-text-secondary)]">
              {activeTeacher.user?.bio || (isAr ? 'معلم قرآن كريم مجاز ومعتمد في أكاديمية وحي ونماء.' : 'Certified Quran tutor at Wahy Wa Namaa Academy.')}
            </p>
          )}
          {specializations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {specializations.map((spec) => (
                <span key={spec} className="rounded-full bg-[var(--wn-emerald-soft)] px-2.5 py-1 text-xs font-bold text-[var(--wn-emerald-dark)]">
                  {specName(spec, locale)}
                </span>
              ))}
              {languages.map((lang) => (
                <span key={lang} className="rounded-full border border-[var(--wn-border)] bg-[var(--wn-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--wn-text-secondary)]">
                  {languageName(lang, locale)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-extrabold text-[var(--wn-heading)] flex items-center gap-1.5">
            <Calendar size={15} className="text-[var(--wn-emerald)]" />
            <span>{isAr ? 'أقرب المواعيد المتاحة' : 'Nearest available slots'}</span>
          </h4>
          {loadingDetails ? (
            <div className="grid grid-cols-2 gap-2"><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-10 rounded-xl" /></div>
          ) : nearestSlots.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {nearestSlots.map((slot) => (
                <Link
                  key={slot.startsAt}
                  to={lp(`/book-trial/${teacherId}?time=${encodeURIComponent(slot.startsAt)}`)}
                  className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3 py-2 text-xs font-bold text-[var(--wn-emerald-dark)] hover:border-[var(--wn-emerald)]"
                >
                  {new Date(slot.startsAt).toLocaleString(isAr ? 'ar-EG' : 'en', {
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
              {isAr ? 'يمكنك اقتراح الوقت المناسب لك في صفحة الحجز.' : 'You can suggest your preferred time on the booking page.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link
            to={lp('/teachers/' + teacherId)}
            state={{ prefetchedTeacher: activeTeacher }}
            className="wn-btn wn-btn--secondary wn-btn--md wn-btn--block"
          >
            <BookOpen size={15} />
            <span>{isAr ? 'الملف الكامل' : 'Full profile'}</span>
          </Link>
          <Link
            to={lp('/book-trial/' + teacherId)}
            className="wn-btn wn-btn--primary wn-btn--md wn-btn--block"
          >
            <GraduationCap size={15} />
            <span>{isAr ? 'احجز حصة تجريبية' : 'Book trial'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
