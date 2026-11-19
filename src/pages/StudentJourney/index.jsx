import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, UserRound, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import { teacherPublicImage, teacherImageFallback } from '../../lib/teacherMedia';

const TRACK_SPECS = [
  { id: 'memorization', specialties: ['tajweed', 'ijaza', 'adults', 'children'] },
  { id: 'tajweed_ijazah', specialties: ['tajweed', 'ijaza'] },
  { id: 'kids_foundation', specialties: ['children'] },
];
const activeTrack = (id) => TRACK_SPECS.find((track) => track.id === id) || TRACK_SPECS[0];
const isTrackId = (value) => TRACK_SPECS.some((track) => track.id === value);

function normalizeTeacher(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const specializations = Array.isArray(raw.quranInfo?.specializations)
    ? raw.quranInfo.specializations.filter((item) => typeof item === 'string')
    : [];

  return {
    ...raw,
    _id: String(raw._id || ''),
    personalInfo: raw.personalInfo && typeof raw.personalInfo === 'object' ? raw.personalInfo : {},
    academicInfo: raw.academicInfo && typeof raw.academicInfo === 'object' ? raw.academicInfo : {},
    quranInfo: {
      ...(raw.quranInfo && typeof raw.quranInfo === 'object' ? raw.quranInfo : {}),
      specializations,
    },
    media: raw.media && typeof raw.media === 'object' ? raw.media : {},
    rating: raw.rating && typeof raw.rating === 'object' ? raw.rating : {},
    user: raw.user && typeof raw.user === 'object' ? raw.user : {},
  };
}

export default function StudentJourney() {
  const { user, isAuthenticated, isLoading, refreshUser, saveLearningTrack } = useAuth();
  const { locale, dir, isRTL, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const lp = useCallback((path) => localizedPath(path, locale), [locale]);

  const jt = t?.student?.journey || {};
  const jtSteps = jt.steps || {};
  const jtTracks = jt.tracks || {};
  const common = t?.common || {};

  const [chosen, setChosen] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preferredGender, setPreferredGender] = useState('any');
  const [profileChecking, setProfileChecking] = useState(true);
  const [retrySeq, setRetrySeq] = useState(0);

  const trackTitle = (id) => jtTracks[id] || id;
  const trackDesc = (id) => jtTracks[`${id}Desc`] || '';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate(lp('/login') + '?redirect=' + encodeURIComponent(lp('/journey')), { replace: true });
      return;
    }
    if (user?.role !== 'student') {
      navigate(lp(user?.role === 'guardian' ? '/guardian/dashboard' : user?.role === 'teacher' ? '/teacher/dashboard' : '/'), { replace: true });
      return;
    }

    if (location.state?.profileJustSaved && user?.onboarding?.completed
        && user?.name?.trim() && user?.phone?.trim()) {
      setProfileChecking(false);
      return;
    }

    let cancelled = false;
    const checkProfile = async () => {
      try {
        const current = await refreshUser();
        if (cancelled) return;
        if (!current?.name?.trim() || !current?.phone?.trim() ||
            (current?.onboarding?.required && !current.onboarding.completed)) {
          navigate(lp('/profile/setup') + '?next=' + encodeURIComponent(lp('/journey')), { replace: true });
        } else {
          setProfileChecking(false);
        }
      } catch {
        if (!cancelled) {
          setError(jt.verifyAccountError || 'Could not verify your account. Please reload.');
          setProfileChecking(false);
        }
      }
    };
    checkProfile();
    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated, user?.role, user?.onboarding?.completed, user?.name, user?.phone, location.state?.profileJustSaved, navigate, lp, jt.verifyAccountError, refreshUser]);

  useEffect(() => {
    if (profileChecking || chosen) return;
    if (user?.onboarding?.trackSelected === true && isTrackId(user?.preferredTrack)) {
      setChosen(user.preferredTrack);
    }
  }, [profileChecking, chosen, user?.onboarding?.trackSelected, user?.preferredTrack]);

  useEffect(() => {
    if (!chosen) return;
    let valid = true;
    const spec = activeTrack(chosen).specialties;
    setLoadingTeachers(true);
    setError('');
    api.get('/api/teachers?specialization=' + encodeURIComponent(spec.join(',')) + '&limit=60')
      .then((result) => {
        if (!valid) return;
        const found = new Map();
        const incoming = Array.isArray(result?.teachers) ? result.teachers : [];
        for (const rawTeacher of incoming) {
          const teacher = normalizeTeacher(rawTeacher);
          if (!teacher?._id) continue;
          found.set(teacher._id, teacher);
        }
        setTeachers(Array.from(found.values()).sort((a, b) => {
          const score = (teacher) => {
            const specialties = Array.isArray(teacher.quranInfo?.specializations)
              ? teacher.quranInfo.specializations
              : [];
            const matching = specialties.filter((item) => spec.includes(item)).length;
            const experience = Number(teacher.quranInfo?.teachingExperience) || 0;
            const rating = Number(teacher.rating?.average) || 0;
            return matching * 100 + Math.min(experience, 15) * 2 + rating * 4;
          };
          return score(b) - score(a);
        }));
      })
      .catch(() => {
        if (valid) setError(jt.loadTutorsError || 'Could not load tutors. Please retry.');
      })
      .finally(() => {
        if (valid) setLoadingTeachers(false);
      });
    return () => { valid = false; };
  }, [chosen, jt.loadTutorsError, retrySeq]);

  const choose = async (trackId) => {
    if (!isTrackId(trackId) || saving) return;
    setSaving(true);
    setError('');
    try {
      if (user?.onboarding?.trackSelected === true && user?.preferredTrack === trackId) {
        setChosen(trackId);
        return;
      }
      const updated = await saveLearningTrack(trackId);
      setChosen(isTrackId(updated?.preferredTrack) ? updated.preferredTrack : trackId);
    } catch (e) {
      setError(e.message || jt.saveTrackError || 'Could not save learning track');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || profileChecking) {
    return (
      <>
        <GlobalHeader />
        <main className="min-h-screen bg-[var(--wn-bg)] py-10 px-4" dir={dir}>
          <div className="mx-auto max-w-5xl space-y-5" role="status" aria-live="polite">
            <span className="sr-only">{common.loading || 'Loading…'}</span>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-5 w-96 max-w-full" />
            <div className="grid md:grid-cols-3 gap-4">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!user || user.role !== 'student') return null;

  const step = !chosen ? 3 : 4;
  const visibleTeachers = (Array.isArray(teachers) ? teachers : [])
    .filter((teacher) => teacher && typeof teacher === 'object')
    .filter((teacher) => preferredGender === 'any' || teacher.personalInfo?.gender === preferredGender);

  const stepsList = [
    [1, jtSteps.account || 'Account'],
    [2, jtSteps.profile || 'Profile'],
    [3, jtSteps.track || 'Track'],
    [4, jtSteps.tutor || 'Tutor'],
    [5, jtSteps.trial || 'Trial'],
  ];

  return (
    <>
      <SEOHead page={{ url: '/journey', noindex: true, canonical: false }} />
      <GlobalHeader />
      <main className="min-h-screen bg-[var(--wn-bg)] text-[var(--wn-text-primary)] py-10 px-4" dir={dir}>
        <div className="mx-auto max-w-5xl">
          <span className="text-[var(--wn-link)] font-bold text-sm">
            {jt.eyebrow || 'Wahy Wa Namaa • Your learning journey'}
          </span>
          <h1 className="text-3xl font-bold text-[var(--wn-heading)] mt-3 mb-2">
            {jt.title || 'Find your learning path'}
          </h1>
          <p className="text-[var(--wn-text-secondary)] mb-7">
            {jt.subtitle || 'Choose a path, explore verified tutors matched to it, and book a free trial lesson.'}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
            {stepsList.map(([n, label]) => (
              <div
                key={n}
                className={`rounded-xl p-3 border text-center text-xs font-bold ${
                  n < step
                    ? 'bg-[var(--wn-emerald-soft)] border-[var(--wn-border-mint)] text-[var(--wn-badge-emerald-text)]'
                    : n === step
                      ? 'bg-[var(--wn-surface)] border-[var(--wn-emerald)] text-[var(--wn-heading)]'
                      : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-tertiary)]'
                }`}
              >
                {n < step ? <CheckCircle2 className="inline-block w-4 h-4 me-1" aria-hidden="true" /> : `${n}. `}{label}
              </div>
            ))}
          </div>

          {!chosen ? (
            <>
              <h2 className="text-xl font-bold text-[var(--wn-heading)] mb-4">
                {jt.chooseTrackTitle || 'Choose your learning track'}
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {TRACK_SPECS.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => choose(track.id)}
                    disabled={saving}
                    className="text-start bg-[var(--wn-surface)] rounded-2xl border border-[var(--wn-border)] p-6 shadow-sm hover:border-[var(--wn-emerald)] hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    <BookOpen className="text-[var(--wn-link)] mb-4" size={28} aria-hidden="true" />
                    <h3 className="font-bold text-lg text-[var(--wn-text-primary)] mb-2">{trackTitle(track.id)}</h3>
                    <p className="text-[var(--wn-text-secondary)] text-sm mb-4">{trackDesc(track.id)}</p>
                    <span className="inline-flex items-center gap-1 text-[var(--wn-link)] font-bold text-sm">
                      <span>{jt.selectTrack || 'Select track'}</span>
                      {isRTL ? <ChevronLeft className="inline" size={16} aria-hidden="true" /> : <ChevronRight className="inline" size={16} aria-hidden="true" />}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-[var(--wn-heading)]">
                    {jt.recommendedFor || 'Recommended tutors for'} {trackTitle(chosen)}
                  </h2>
                  <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                    {jt.recommendedNote || 'All listed tutors are approved. Matching is based on specialization.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-[44px] inline-flex items-center px-3 rounded-lg text-sm font-bold text-[var(--wn-link)] underline hover:bg-[var(--wn-emerald-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  onClick={() => { setChosen(''); setTeachers([]); }}
                >
                  {jt.changeTrack || 'Change track'}
                </button>
              </div>

              <div className="flex flex-wrap gap-3 items-center mb-5">
                <label className="text-sm font-bold text-[var(--wn-text-primary)]" htmlFor="journey-gender">
                  {jt.preferredTutor || 'Preferred tutor'}
                </label>
                <select
                  id="journey-gender"
                  value={preferredGender}
                  onChange={(e) => setPreferredGender(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  <option value="any">{jt.noPreference || 'No preference'}</option>
                  <option value="male">{jt.maleTutor || 'Male tutor'}</option>
                  <option value="female">{jt.femaleTutor || 'Female tutor'}</option>
                </select>
                <span className="text-xs text-[var(--wn-text-secondary)]">
                  {jt.sortNote || 'Ordered by specialty match, experience, and available ratings'}
                </span>
              </div>

              {loadingTeachers && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-live="polite">
                  <span className="sr-only">{jt.findingTutors || 'Finding matching tutors…'}</span>
                  {Array.from({ length: 3 }, (_, idx) => (
                    <div key={idx} className="bg-[var(--wn-surface)] rounded-2xl border border-[var(--wn-border)] p-5 space-y-3">
                      <Skeleton className="h-20 w-20 rounded-full" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-11 w-full rounded-xl" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingTeachers && !error && !visibleTeachers.length && (
                <EmptyState
                  icon={GraduationCap}
                  title={jt.noMatchingTutors || 'No approved tutors currently match this track'}
                  description={jt.noMatchingDesc || 'You can choose another track or browse all approved tutors.'}
                  action={
                    <Link
                      className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                      to={lp('/teachers')}
                    >
                      {jt.browseAllTutors || 'Browse all tutors'}
                    </Link>
                  }
                />
              )}

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleTeachers.map((teacher) => (
                  <div key={teacher._id} className="bg-[var(--wn-surface)] rounded-2xl border border-[var(--wn-border)] p-5">
                    <img
                      src={teacherPublicImage(teacher.media?.profilePhoto || teacher.user?.avatar)}
                      alt=""
                      className="w-20 h-20 rounded-full object-cover mb-3"
                      onError={teacherImageFallback}
                    />
                    <h3 className="text-lg font-bold text-[var(--wn-text-primary)]">
                      {teacher.personalInfo?.fullName || teacher.user?.name || (jt.quranTutor || 'Quran tutor')}
                    </h3>
                    <p className="text-sm text-[var(--wn-link)] mt-2 font-semibold">
                      {jt.matchingSpecialties || 'Matching specialties:'}{' '}
                      {(Array.isArray(teacher.quranInfo?.specializations) ? teacher.quranInfo.specializations : [])
                        .filter((spec) => activeTrack(chosen).specialties.includes(spec))
                        .join(' • ') || (jt.quranStudies || 'Quran studies')}
                    </p>
                    <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                      {jt.experienceLabel || 'Teaching experience:'} {teacher.quranInfo?.teachingExperience ?? '—'}
                    </p>
                    <div className="grid gap-2 mt-5">
                      <Link
                        to={lp('/teachers/' + teacher._id)}
                        className="min-h-[44px] rounded-xl border border-[var(--wn-emerald)] text-[var(--wn-link)] text-center p-3 font-bold flex items-center justify-center gap-2 hover:bg-[var(--wn-emerald-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                      >
                        <UserRound size={18} aria-hidden="true" />
                        <span>{jt.viewTutorProfile || 'View tutor profile'}</span>
                      </Link>
                      <Link
                        to={lp('/book-trial/' + teacher._id)}
                        className="min-h-[44px] rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] text-center p-3 font-bold flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                      >
                        <CalendarDays size={18} aria-hidden="true" />
                        <span>{jt.bookTrial || 'Book a trial lesson'}</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]"
            >
              <p className="text-sm font-semibold">{error}</p>
              {chosen && (
                <button
                  type="button"
                  onClick={() => setRetrySeq((n) => n + 1)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-bold text-[var(--wn-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>{common.retry || 'Try again'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <GlobalFooter />
    </>
  );
}

