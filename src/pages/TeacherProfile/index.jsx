import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  GraduationCap,
  MapPin,
  Play,
  RefreshCw,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { teacherPublicAudio, teacherPublicImage, teacherPublicVideo } from '../../lib/teacherMedia';
import { fetchTeacherBundle, getCachedTeacherBundle } from '../../lib/teacherProfileCache';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useStudentTeacherLock } from '../../hooks/useStudentTeacherLock';
import { getProfileCopy, languageName, specName } from './teacherLabels';
import TeacherMediaShowcase from './TeacherMediaShowcase';
import QuickBookingSidebar from './QuickBookingSidebar';
import '../../styles/public-experience.css';
import './TeacherProfile.css';

export default function TeacherProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, dir, isRTL, t } = useI18n();
  const { createTeacherSchema, createBreadcrumbSchema } = useSEO();
  const { isAuthenticated, user } = useAuth();
  const isStudent = user?.role === 'student';
  const { lock } = useStudentTeacherLock(isStudent);

  const prefetchedTeacher = location.state?.prefetchedTeacher || null;

  const [teacher, setTeacher] = useState(() => getCachedTeacherBundle(id)?.teacher || prefetchedTeacher || null);
  const [reviews, setReviews] = useState(() => getCachedTeacherBundle(id)?.reviews || []);
  const [availability, setAvailability] = useState(
    () => getCachedTeacherBundle(id)?.availability || { configured: false, teacherTimezone: '', slots: [] }
  );
  const [loading, setLoading] = useState(() => !(getCachedTeacherBundle(id)?.teacher || prefetchedTeacher));
  const [detailsLoading, setDetailsLoading] = useState(() => !getCachedTeacherBundle(id));
  const [fetchError, setFetchError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [activeSection, setActiveSection] = useState('all');
  const tabRefs = useRef([]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const warm = getCachedTeacherBundle(id);
    if (warm) {
      setTeacher(warm.teacher);
      setReviews(warm.reviews);
      setAvailability(warm.availability);
      setLoading(false);
      setDetailsLoading(false);
      setFetchError(false);
      return () => { cancelled = true; };
    }

    setTeacher(prefetchedTeacher || null);
    setReviews([]);
    setAvailability({ configured: false, teacherTimezone: '', slots: [] });
    setLoading(!prefetchedTeacher);
    setDetailsLoading(true);
    setFetchError(false);

    fetchTeacherBundle(id)
      .then((bundle) => {
        if (cancelled) return;
        setTeacher(bundle.teacher);
        setReviews(bundle.reviews);
        setAvailability(bundle.availability);
        setFetchError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setDetailsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id, prefetchedTeacher, reloadNonce]);

  const copy = useMemo(() => getProfileCopy(locale, t), [locale, t]);
  const intlLocale = resolveIntlLocale(locale);
  const isLockedToThisTeacher = Boolean(lock && String(lock.teacherId) === String(id));
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const backTarget = isStudent
    ? localizedPath(isLockedToThisTeacher ? '/student/dashboard' : '/student/dashboard?tab=discover', locale)
    : localizedPath('/teachers', locale);

  const handleBookTrial = ({ date = '', time = '' } = {}) => {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (time) query.set('time', time);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const path = `/book-trial/${id}${suffix}`;
    navigate(
      isAuthenticated
        ? localizedPath(path, locale)
        : localizedPath('/login', locale) + '?redirect=' + encodeURIComponent(path)
    );
  };

  const tabItems = useMemo(() => ([
    { id: 'all', label: copy.allSections },
    { id: 'media', label: copy.mediaSection },
    { id: 'about', label: copy.aboutSection },
    { id: 'reviews', label: `${copy.reviewsSection} (${reviews.length})` },
  ]), [copy, reviews.length]);

  const handleTabKeyDown = useCallback((event, currentIndex) => {
    const count = tabItems.length;
    if (!count) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = isRTL ? (currentIndex - 1 + count) % count : (currentIndex + 1) % count;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = isRTL ? (currentIndex + 1) % count : (currentIndex - 1 + count) % count;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = count - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const target = tabItems[nextIndex];
    setActiveSection(target.id);
    tabRefs.current[nextIndex]?.focus();
  }, [isRTL, tabItems]);

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-tp-shell py-6 md:py-8" dir={dir} role="status" aria-live="polite">
          <span className="sr-only">{copy.loadingProfile}</span>
          <div className="page-container space-y-6">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <div className="wn-tp-hero p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <Skeleton className="h-32 w-32 rounded-2xl bg-[var(--wn-surface)]/15 shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-5 w-36 bg-[var(--wn-surface)]/15" />
                  <Skeleton className="h-9 w-2/3 bg-[var(--wn-surface)]/20" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Skeleton className="h-16 rounded-xl bg-[var(--wn-surface)]/15" />
                    <Skeleton className="h-16 rounded-xl bg-[var(--wn-surface)]/15" />
                    <Skeleton className="h-16 rounded-xl bg-[var(--wn-surface)]/15" />
                    <Skeleton className="h-16 rounded-xl bg-[var(--wn-surface)]/15" />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!teacher && fetchError) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-tp-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-tp-card max-w-xl w-full p-6 sm:p-8 text-center space-y-3" role="alert">
            <AlertTriangle size={44} className="mx-auto text-[var(--wn-warning)]" aria-hidden="true" />
            <h1 className="text-xl font-black text-[var(--wn-heading)]">{copy.loadErrorTitle}</h1>
            <p className="text-sm text-[var(--wn-text-secondary)]">{copy.loadErrorHint}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="wn-btn wn-btn--primary min-h-[44px]"
              >
                <RefreshCw size={16} aria-hidden="true" />
                <span>{copy.retryBtn}</span>
              </button>
              <Link to={backTarget} className="wn-btn wn-btn--secondary min-h-[44px]">
                <BackArrow size={16} aria-hidden="true" />
                <span>{isStudent ? copy.backToDashboard : copy.backToList}</span>
              </Link>
            </div>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!teacher) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-tp-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-tp-card max-w-xl w-full p-6 sm:p-8 text-center space-y-3">
            <GraduationCap size={44} className="mx-auto text-[var(--wn-emerald)]" aria-hidden="true" />
            <h1 className="text-xl font-black text-[var(--wn-heading)]">{copy.profileUnavailable}</h1>
            <p className="text-sm text-[var(--wn-text-secondary)]">{copy.profileUnavailableHint}</p>
            <Link to={backTarget} className="wn-btn wn-btn--primary mt-2 inline-flex min-h-[44px]">
              <BackArrow size={16} aria-hidden="true" />
              <span>{isStudent ? copy.backToDashboard : copy.backToList}</span>
            </Link>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const name = teacher.user?.name || teacher.personalInfo?.fullName || copy.tutorFallback;
  const ratingAverage = Number(teacher.rating?.average ?? teacher.stats?.rating?.average ?? 0);
  const ratingCount = Number(teacher.rating?.count ?? teacher.stats?.rating?.count ?? 0);
  const specializations = Array.isArray(teacher.quranInfo?.specializations) ? teacher.quranInfo.specializations : [];
  const languages = Array.isArray(teacher.languages) ? teacher.languages : [];

  const media = teacher.media || {};
  const mediaItems = Array.from(new Map([
    { key: 'intro', title: copy.introVideoTitle, url: media.introductionVideo },
    { key: 'recitation', title: copy.recitationVideoTitle, url: media.recitationVideo },
    { key: 'method', title: copy.methodVideoTitle, url: media.teachingMethodVideo },
    ...(Array.isArray(media.additionalVideos) ? media.additionalVideos : []).filter(Boolean).map((url, index) => ({
      key: 'additional-' + index,
      title: String(copy.additionalRecitationTitle || 'Additional recitation {index}').replace('{index}', String(index + 1)),
      url,
    })),
  ]
    .map((item) => ({ ...item, url: teacherPublicVideo(item.url) }))
    .filter((item) => item.url)
    .map((item) => [item.url, item])).values());

  const audioItems = Array.from(new Set(
    (Array.isArray(media.audioRecordings) ? media.audioRecordings : [])
      .map((audio) => teacherPublicAudio(audio))
      .filter(Boolean),
  ));

  const mediaCount = mediaItems.length + audioItems.length;
  const renderedTabs = tabItems.map((tab) => (
    tab.id === 'media' ? { ...tab, label: `${copy.mediaSection} (${mediaCount})` } : tab
  ));

  const profileImage = teacherPublicImage(media.profilePhoto || teacher.user?.avatar);
  const profileDescription = teacher.user?.bio || copy.defaultBio;
  const teacherSchema = createTeacherSchema({
    name,
    url: '/teachers/' + id,
    image: profileImage,
    specialty: specializations.map((s) => specName(s, locale, t)).join(' • ') || copy.defaultSpecialty,
    bio: profileDescription,
    languages: languages.map((l) => languageName(l, locale, t)),
  });
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: copy.breadcrumbHome, url: '/' },
    { name: copy.breadcrumbTeachers, url: '/teachers' },
    { name, url: '/teachers/' + id },
  ]);

  const showMedia = activeSection === 'all' || activeSection === 'media';
  const showAbout = activeSection === 'all' || activeSection === 'about';
  const showReviews = activeSection === 'all' || activeSection === 'reviews';

  return (
    <>
      <SEOHead page={{
        title: name,
        description: profileDescription,
        image: profileImage,
        url: '/teachers/' + id,
        type: 'profile',
        schema: [teacherSchema, breadcrumbSchema],
      }} />
      <GlobalHeader />

      <main className="wn-tp-shell py-5 md:py-8" dir={dir}>
        <div className="page-container space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to={backTarget}
              className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-[var(--wn-heading)] hover:underline"
            >
              <BackArrow size={16} aria-hidden="true" />
              <span>{isStudent ? copy.backToDashboard : copy.backToList}</span>
            </Link>
            {fetchError && (
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="wn-btn wn-btn--secondary min-h-[44px] text-xs"
              >
                <RefreshCw size={14} aria-hidden="true" />
                <span>{copy.retryBtn}</span>
              </button>
            )}
          </div>

          {/* Compact Hero Card */}
          <section className="wn-tp-hero p-5 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <TeacherAvatar
                src={profileImage}
                name={name}
                alt={name}
                size="xl"
                loading="eager"
                fetchPriority="high"
                className="wn-tp-hero__avatar h-32 w-32 shrink-0 md:h-40 md:w-40"
              />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="wn-tp-eyebrow text-xs font-bold">
                    <ShieldCheck size={14} aria-hidden="true" />
                    <span>{copy.verifiedTutor}</span>
                  </span>
                  {teacher.isFeatured && (
                    <span className="wn-tp-eyebrow text-xs font-bold">
                      <Award size={14} aria-hidden="true" />
                      <span>{copy.featuredTutor}</span>
                    </span>
                  )}
                </div>

                <h1 className="wn-tp-title font-black">{name}</h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--wn-mint)]">
                  {ratingCount > 0 && ratingAverage > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-bold text-[var(--wn-gold)]">
                      <Star size={15} fill="currentColor" aria-hidden="true" />
                      <span>{ratingAverage.toFixed(1)}</span>
                      <span className="text-[var(--wn-mint)] font-normal">({ratingCount} {copy.reviewsLabel})</span>
                    </span>
                  )}
                  {teacher.personalInfo?.country && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} aria-hidden="true" />
                      <span>{teacher.personalInfo.country}</span>
                    </span>
                  )}
                  {languages.length > 0 && (
                    <span>{languages.map((lang) => languageName(lang, locale, t)).join(' · ')}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
                  {teacher.quranInfo?.teachingExperience != null && (
                    <div className="wn-tp-stat-pill p-3">
                      <div className="flex items-center gap-1.5 text-[var(--wn-gold)]"><Clock size={15} aria-hidden="true" /><strong className="text-lg font-black text-[var(--wn-white)]">{teacher.quranInfo.teachingExperience}</strong></div>
                      <small className="text-xs text-[var(--wn-mint)]">{copy.yearsExperience}</small>
                    </div>
                  )}
                  {teacher.quranInfo?.memorizedParts != null && (
                    <div className="wn-tp-stat-pill p-3">
                      <div className="flex items-center gap-1.5 text-[var(--wn-gold)]"><BookOpen size={15} aria-hidden="true" /><strong className="text-lg font-black text-[var(--wn-white)]">{teacher.quranInfo.memorizedParts}</strong></div>
                      <small className="text-xs text-[var(--wn-mint)]">{copy.juzMemorized}</small>
                    </div>
                  )}
                  {teacher.quranInfo?.numberOfIjazat != null && (
                    <div className="wn-tp-stat-pill p-3">
                      <div className="flex items-center gap-1.5 text-[var(--wn-gold)]"><Award size={15} aria-hidden="true" /><strong className="text-lg font-black text-[var(--wn-white)]">{teacher.quranInfo.numberOfIjazat}</strong></div>
                      <small className="text-xs text-[var(--wn-mint)]">{copy.listedIjazahs}</small>
                    </div>
                  )}
                  {teacher.stats?.totalStudents != null && (
                    <div className="wn-tp-stat-pill p-3">
                      <div className="flex items-center gap-1.5 text-[var(--wn-gold)]"><Users size={15} aria-hidden="true" /><strong className="text-lg font-black text-[var(--wn-white)]">{teacher.stats.totalStudents}</strong></div>
                      <small className="text-xs text-[var(--wn-mint)]">{copy.studentsCount}</small>
                    </div>
                  )}
                </div>

                {mediaCount > 0 && (
                  <div className="pt-1">
                    <a
                      href="#teacher-media-showcase"
                      onClick={() => setActiveSection('all')}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--wn-gold)] bg-[var(--wn-gold)] px-4 py-2 text-xs font-extrabold text-[var(--wn-emerald-deep)] hover:opacity-95"
                    >
                      <Play size={14} fill="currentColor" aria-hidden="true" />
                      <span>{copy.watchRecitationJump}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2-Column Main + Sticky Quick Booking */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="space-y-5 min-w-0">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={copy.tabsAria}>
                {renderedTabs.map((pill, idx) => (
                  <button
                    key={pill.id}
                    ref={(el) => { tabRefs.current[idx] = el; }}
                    id={`tp-tab-${pill.id}`}
                    type="button"
                    role="tab"
                    tabIndex={activeSection === pill.id ? 0 : -1}
                    aria-selected={activeSection === pill.id}
                    aria-controls={`tp-panel-${pill.id}`}
                    onClick={() => setActiveSection(pill.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`wn-tp-filter-pill px-4 py-2 text-xs font-extrabold ${activeSection === pill.id ? 'is-active' : ''}`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div
                id={`tp-panel-${activeSection}`}
                role="tabpanel"
                aria-labelledby={`tp-tab-${activeSection}`}
                className="space-y-5"
              >
                {showMedia && (
                  <TeacherMediaShowcase mediaItems={mediaItems} audioItems={audioItems} copy={copy} />
                )}

                {showAbout && (
                  <section className="wn-tp-card p-5 md:p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-extrabold text-[var(--wn-heading)]">{copy.bioTitle}</h2>
                      {detailsLoading && !teacher.user?.bio ? (
                        <div className="mt-3 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
                      ) : (
                        <p className="mt-2 text-sm leading-8 text-[var(--wn-text-secondary)]">
                          {teacher.user?.bio || copy.noBio}
                        </p>
                      )}
                    </div>

                    {(teacher.academicInfo?.university || teacher.academicInfo?.faculty || teacher.academicInfo?.specialization) && (
                      <div className="border-t border-[var(--wn-border)] pt-5">
                        <h3 className="text-base font-extrabold text-[var(--wn-heading)]">{copy.academicTitle}</h3>
                        <div className="mt-2 grid gap-1.5 text-sm text-[var(--wn-text-secondary)]">
                          {teacher.academicInfo?.university && (
                            <p>{teacher.academicInfo.university}{teacher.academicInfo?.faculty ? ` — ${teacher.academicInfo.faculty}` : ''}</p>
                          )}
                          {teacher.academicInfo?.specialization && (
                            <p>{copy.specializationLabel} {teacher.academicInfo.specialization}</p>
                          )}
                          {teacher.academicInfo?.graduationYear && (
                            <p>{copy.graduationLabel} {teacher.academicInfo.graduationYear}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {specializations.length > 0 && (
                      <div className="border-t border-[var(--wn-border)] pt-5">
                        <h3 className="text-base font-extrabold text-[var(--wn-heading)]">{copy.specializationsTitle}</h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {specializations.map((spec) => (
                            <span
                              key={spec}
                              className="rounded-full border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]"
                            >
                              {specName(spec, locale, t)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {languages.length > 0 && (
                      <div className="border-t border-[var(--wn-border)] pt-5">
                        <h3 className="text-base font-extrabold text-[var(--wn-heading)]">{copy.languagesTitle}</h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {languages.map((lang) => (
                            <span
                              key={lang}
                              className="rounded-full border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--wn-text-secondary)]"
                            >
                              {languageName(lang, locale, t)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {showReviews && (
                  <section className="wn-tp-card p-5 md:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-extrabold text-[var(--wn-heading)]">{copy.reviewsTitle}</h2>
                      {ratingCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-gold-soft)] px-3 py-1 text-xs font-extrabold text-[var(--wn-badge-gold-text)]">
                          <Star size={14} fill="currentColor" aria-hidden="true" />
                          {ratingAverage.toFixed(1)} ({ratingCount})
                        </span>
                      )}
                    </div>

                    {detailsLoading && !reviews.length ? (
                      <div className="space-y-3"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
                    ) : reviews.length ? (
                      <div className="divide-y divide-[var(--wn-border)]">
                        {reviews.map((review) => (
                          <article key={review._id} className="py-4 first:pt-1 last:pb-1">
                            <div className="flex items-center justify-between gap-3">
                              <strong className="text-sm font-bold text-[var(--wn-heading)]">
                                {review.student?.name || copy.studentFallback}
                              </strong>
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--wn-badge-gold-text)]">
                                <Star size={13} fill="currentColor" aria-hidden="true" /> {review.rating}
                              </span>
                            </div>
                            {review.comment && (
                              <p className="mt-2 text-sm leading-relaxed text-[var(--wn-text-secondary)]">{review.comment}</p>
                            )}
                            {review.createdAt && (
                              <p className="mt-2 text-xs text-[var(--wn-text-tertiary)]">
                                {new Date(review.createdAt).toLocaleDateString(intlLocale)}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={CheckCircle} title={copy.noReviews} />
                    )}
                  </section>
                )}
              </div>
            </div>

            <QuickBookingSidebar
              teacherId={id}
              availability={availability}
              availabilityLoading={detailsLoading}
              isLockedToThisTeacher={isLockedToThisTeacher}
              onBookTrial={handleBookTrial}
              copy={copy}
              locale={locale}
            />
          </div>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
