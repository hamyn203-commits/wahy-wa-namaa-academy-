import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Heart,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { teacherPublicImage, teacherPublicVideo } from '../../lib/teacherMedia';
import { prefetchTeacherBundle } from '../../lib/teacherProfileCache';
import EmptyState from '../../components/shared/EmptyState';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import TeacherQuickPreviewModal from './TeacherQuickPreviewModal';
import api from '../../lib/api';

function specializationLabel(value, specs = {}) {
  const map = {
    children: specs.children || 'Children',
    adults: specs.adults || 'Adults',
    women: specs.women || 'Women',
    'non-arabic': specs.nonArabic || 'Non-Arabic speakers',
    tajweed: specs.tajweed || 'Tajweed',
    ijaza: specs.ijaza || 'Ijazah',
    'arabic-language': specs.arabicLanguage || 'Arabic language',
  };
  return map[value] || value;
}

export default function StudentTeacherMarketplace({ teachers = [], locale: propLocale, loadFailed = false, onRetry }) {
  const { locale: ctxLocale, t } = useI18n();
  const activeLocale = propLocale || ctxLocale || 'ar';
  const lp = (path) => localizedPath(path, activeLocale);

  const mp = t?.student?.marketplace || {};
  const mpSpecs = mp.specs || {};
  const mpLangs = mp.languages || {};
  const common = t?.common || {};

  const matchGoals = [
    ['tajweed', mpSpecs.tajweed || 'Tajweed'],
    ['ijaza', mpSpecs.ijaza || 'Ijazah'],
    ['children', mpSpecs.children || 'Children'],
    ['adults', mpSpecs.adults || 'Adults'],
    ['arabic-language', mpSpecs.arabicLanguage || 'Arabic language'],
    ['non-arabic', mpSpecs.nonArabic || 'Non-Arabic speakers'],
  ];

  const [preview, setPreview] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [togglingFavId, setTogglingFavId] = useState('');
  const [compare, setCompare] = useState([]);
  const [matching, setMatching] = useState({ goals: [], preferredGender: 'any', language: '' });
  const [matchMap, setMatchMap] = useState(new Map());
  const [showMatching, setShowMatching] = useState(false);
  const [savingMatching, setSavingMatching] = useState(false);
  const [quickPreviewTeacher, setQuickPreviewTeacher] = useState(null);
  const [error, setError] = useState('');

  const loadPersonalization = async () => {
    try {
      const [prefs, matches] = await Promise.all([
        api.get('/api/students/dashboard/tutor-preferences', { auth: true }),
        api.get('/api/students/dashboard/matches', { auth: true }),
      ]);
      setFavorites(new Set(prefs.favoriteTeachers || []));
      setMatching({
        goals: prefs.matching?.goals || [],
        preferredGender: prefs.matching?.preferredGender || 'any',
        language: prefs.matching?.language || '',
      });
      setMatchMap(new Map((matches.matches || []).map((item) => [String(item.teacherId), item])));
    } catch {
      // Teacher browsing must remain available even if personalization is unavailable.
    }
  };

  useEffect(() => {
    loadPersonalization();
  }, []);

  const rankedTeachers = useMemo(() => (
    [...teachers].sort((a, b) => (
      (matchMap.get(String(b._id))?.matchScore || 0) -
      (matchMap.get(String(a._id))?.matchScore || 0)
    ))
  ), [teachers, matchMap]);

  const comparedTeachers = useMemo(
    () => compare.map((id) => teachers.find((teacher) => String(teacher._id) === String(id))).filter(Boolean),
    [compare, teachers]
  );

  const togglePreview = (teacherId, mode) => {
    setPreview((current) => (
      current?.teacherId === teacherId && current?.mode === mode
        ? null
        : { teacherId, mode }
    ));
  };

  const toggleFavorite = async (teacherId) => {
    const id = String(teacherId);
    if (togglingFavId === id) return;
    setTogglingFavId(id);
    const nextFavorite = !favorites.has(id);
    setFavorites((current) => {
      const next = new Set(current);
      if (nextFavorite) next.add(id);
      else next.delete(id);
      return next;
    });

    try {
      await api.post(
        `/api/students/dashboard/favorites/${id}`,
        { favorite: nextFavorite },
        { auth: true }
      );
    } catch {
      setFavorites((current) => {
        const next = new Set(current);
        if (nextFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
      setError(mp.favoritesError || 'Could not update favorites');
    } finally {
      setTogglingFavId('');
    }
  };

  const toggleCompare = (teacherId) => {
    const id = String(teacherId);
    setError('');
    setCompare((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 3) {
        setError(mp.compareMaxError || 'You can compare up to 3 tutors.');
        return current;
      }
      return [...current, id];
    });
  };

  const toggleGoal = (goal) => {
    setMatching((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((value) => value !== goal)
        : [...current.goals, goal].slice(0, 5),
    }));
  };

  const saveMatching = async () => {
    if (savingMatching) return;
    setSavingMatching(true);
    setError('');
    try {
      await api.put('/api/students/dashboard/tutor-preferences', { matching }, { auth: true });
      const result = await api.get('/api/students/dashboard/matches', { auth: true });
      setMatchMap(new Map((result.matches || []).map((item) => [String(item.teacherId), item])));
      setShowMatching(false);
    } catch (err) {
      setError(err.message || mp.saveFailed || 'Could not save matching preferences');
    } finally {
      setSavingMatching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--wn-border-mint)] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-6 md:p-8 text-white overflow-hidden relative">
        <div className="absolute -start-16 -bottom-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-100">
              <Sparkles size={14} aria-hidden="true" />
              {mp.eyebrow || 'Find the right Quran tutor'}
            </span>
            <h2 className="mt-4 text-2xl md:text-3xl font-black">
              {mp.title || 'Watch, listen, compare, then choose your tutor'}
            </h2>
            <p className="mt-2 text-sm leading-7 text-emerald-100/80">
              {mp.subtitle || 'Browse approved tutors, preview their media, compare profiles, and get matches based on your goals.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMatching((value) => !value)}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-gold)]"
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              {mp.personalizeBtn || 'Personalize matches'}
            </button>
            <Link
              to={lp('/teachers')}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-stone-950 hover:bg-amber-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Search size={17} aria-hidden="true" />
              {mp.searchAllBtn || 'Search all tutors'}
            </Link>
          </div>
        </div>
      </div>

      {showMatching && (
        <section className="rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-[var(--wn-heading)]">{mp.matchingTitle || 'What are you looking for?'}</h3>
              <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                {mp.matchingSubtitle || 'These preferences only rank tutors. You remain in control.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMatching(false)}
              aria-label={common.close || 'Close'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-[var(--wn-text-secondary)] mb-2">{mp.goalLabel || 'Goal'}</p>
            <div className="flex flex-wrap gap-2">
              {matchGoals.map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={matching.goals.includes(id)}
                  onClick={() => toggleGoal(id)}
                  className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                    matching.goals.includes(id)
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <label htmlFor="mp-pref-gender" className="text-xs font-bold text-[var(--wn-text-secondary)]">
              {mp.preferredLabel || 'Preferred tutor'}
              <select
                id="mp-pref-gender"
                value={matching.preferredGender}
                onChange={(event) => setMatching((current) => ({ ...current, preferredGender: event.target.value }))}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                <option value="any">{mp.noPreference || 'No preference'}</option>
                <option value="male">{mp.maleTutor || 'Male tutor'}</option>
                <option value="female">{mp.femaleTutor || 'Female tutor'}</option>
              </select>
            </label>

            <label htmlFor="mp-pref-lang" className="text-xs font-bold text-[var(--wn-text-secondary)]">
              {mp.languageLabel || 'Language'}
              <select
                id="mp-pref-lang"
                value={matching.language}
                onChange={(event) => setMatching((current) => ({ ...current, language: event.target.value }))}
                className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                <option value="">{mp.anyLanguage || 'Any language'}</option>
                <option value="arabic">{mpLangs.arabic || 'Arabic'}</option>
                <option value="english">{mpLangs.english || 'English'}</option>
                <option value="french">{mpLangs.french || 'French'}</option>
                <option value="turkish">{mpLangs.turkish || 'Turkish'}</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={saveMatching}
            disabled={savingMatching}
            className="mt-4 min-h-[44px] rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] px-5 py-2.5 text-sm font-bold text-[var(--wn-text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-50"
          >
            {savingMatching ? (mp.saving || 'Saving…') : (mp.rankTutorsBtn || 'Rank tutors for me')}
          </button>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-text-danger)]">
          {error}
        </div>
      )}

      {comparedTeachers.length >= 2 && (
        <section className="rounded-2xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-5 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-black text-[var(--wn-heading)]">{mp.comparisonTitle || 'Tutor comparison'}</h3>
            <button
              type="button"
              onClick={() => setCompare([])}
              className="min-h-[44px] px-3 rounded-lg text-xs font-bold text-[var(--wn-text-gold)] hover:bg-[var(--wn-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              {mp.clearCompare || 'Clear'}
            </button>
          </div>
          <table className="w-full min-w-[560px] text-sm text-[var(--wn-text-primary)]">
            <thead>
              <tr className="text-[var(--wn-text-secondary)]">
                <th className="text-start p-2">{mp.colTutor || 'Tutor'}</th>
                <th className="text-start p-2">{mp.colMatch || 'Match'}</th>
                <th className="text-start p-2">{mp.colRating || 'Rating'}</th>
                <th className="text-start p-2">{mp.colExperience || 'Experience'}</th>
                <th className="text-start p-2">{mp.colIjazahs || 'Ijazahs'}</th>
              </tr>
            </thead>
            <tbody>
              {comparedTeachers.map((teacher) => (
                <tr key={teacher._id} className="border-t border-[var(--wn-border)]">
                  <td className="p-2 font-bold">{teacher.user?.name || teacher.personalInfo?.fullName || '—'}</td>
                  <td className="p-2">{matchMap.get(String(teacher._id))?.matchScore ?? '—'}%</td>
                  <td className="p-2">{Number(teacher.rating?.average || 0).toFixed(1)}</td>
                  <td className="p-2">{teacher.quranInfo?.teachingExperience || 0} {mp.yearsUnit || 'years'}</td>
                  <td className="p-2">{teacher.quranInfo?.numberOfIjazat || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rankedTeachers.length === 0 && loadFailed ? (
        <div role="alert" className="rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] p-10 text-center space-y-3">
          <GraduationCap size={40} className="mx-auto text-[var(--wn-text-danger)]" aria-hidden="true" />
          <h3 className="font-bold text-[var(--wn-text-danger)]">{mp.loadErrorTitle || 'We could not load the tutor list'}</h3>
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {mp.loadErrorDesc || 'This is a temporary problem on our side, not your account. Please try again shortly.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-primary mt-2 min-h-[44px] inline-flex items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>{common.retry || 'Try again'}</span>
            </button>
          )}
        </div>
      ) : rankedTeachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={mp.emptyTitle || 'No tutors are available yet'}
          description={mp.emptyDesc || 'Approved tutors will appear here once their profiles are published. Contact us for a recommendation.'}
        />
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          {rankedTeachers.map((teacher) => {
            const id = String(teacher._id);
            const name = teacher.user?.name || teacher.personalInfo?.fullName || (t?.student?.booking?.quranTeacher || 'Quran tutor');
            const rating = Number(teacher.rating?.average || 0);
            const ratingCount = Number(teacher.rating?.count || 0);
            const experience = Number(teacher.quranInfo?.teachingExperience || 0);
            const ijazat = Number(teacher.quranInfo?.numberOfIjazat || 0);
            const specializations = Array.isArray(teacher.quranInfo?.specializations)
              ? teacher.quranInfo.specializations.slice(0, 4)
              : [];
            const intro = teacherPublicVideo(teacher.media?.introductionVideo);
            const recitation = teacherPublicVideo(teacher.media?.recitationVideo);
            const activePreview = preview?.teacherId === teacher._id ? preview.mode : null;
            const previewUrl = activePreview === 'intro' ? intro : activePreview === 'recitation' ? recitation : null;
            const match = matchMap.get(id);
            const isFavorite = favorites.has(id);
            const isCompared = compare.includes(id);

            return (
              <article
                key={teacher._id}
                onMouseEnter={() => prefetchTeacherBundle(teacher._id)}
                onFocus={() => prefetchTeacherBundle(teacher._id)}
                className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 md:p-5 shadow-sm transition hover:border-[var(--wn-emerald)] hover:shadow-md"
              >
                <div className="flex gap-4">
                  <div className="relative shrink-0">
                    <TeacherAvatar
                      src={teacherPublicImage(teacher.media?.profilePhoto || teacher.user?.avatar)}
                      name={name}
                      alt={name}
                      size="lg"
                      loading="lazy"
                      className="h-24 w-24 rounded-2xl border border-[var(--wn-border)]"
                    />
                    <button
                      type="button"
                      disabled={togglingFavId === id}
                      aria-pressed={isFavorite}
                      onClick={() => toggleFavorite(id)}
                      className={`absolute -top-2 -end-2 grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-full border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-60 ${
                        isFavorite
                          ? 'bg-[var(--wn-danger-soft)] border-[var(--wn-danger)] text-[var(--wn-text-danger)]'
                          : 'bg-[var(--wn-surface)] border-[var(--wn-border)] text-[var(--wn-text-tertiary)]'
                      }`}
                      title={mp.favoriteAria || 'Toggle favorite'}
                      aria-label={mp.favoriteAria || 'Toggle favorite'}
                    >
                      <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-[var(--wn-heading)] text-lg">{name}</h3>
                      {teacher.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wn-emerald-soft)] px-2 py-1 text-[11px] font-bold text-[var(--wn-badge-emerald-text)]">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          {mp.verified || 'Verified'}
                        </span>
                      )}
                      {match && (
                        <span className="rounded-full bg-[var(--wn-mint-soft)] px-2 py-1 text-[11px] font-black text-[var(--wn-teal-dark)]">
                          {match.matchScore}% {mp.matchBadge || 'match'}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--wn-text-secondary)]">
                      {rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--wn-text-gold)]">
                          <Star size={13} fill="currentColor" aria-hidden="true" /> {rating.toFixed(1)}
                          {ratingCount > 0 ? <span className="text-[var(--wn-text-tertiary)]">({ratingCount})</span> : null}
                        </span>
                      )}
                      {experience > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} aria-hidden="true" /> {experience} {mp.yearsUnit || 'years'}
                        </span>
                      )}
                      {ijazat > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Award size={13} aria-hidden="true" /> {ijazat} {mp.ijazahsUnit || 'ijazahs'}
                        </span>
                      )}
                    </div>

                    {match?.reasons?.length ? (
                      <p className="mt-2 text-[11px] text-[var(--wn-link)]">{match.reasons.join(' · ')}</p>
                    ) : null}

                    {specializations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {specializations.map((item) => (
                          <span key={item} className="rounded-full bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] px-2 py-1 text-[11px] text-[var(--wn-text-secondary)]">
                            {specializationLabel(item, mpSpecs)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-2">
                  {intro && (
                    <button
                      type="button"
                      onClick={() => togglePreview(teacher._id, 'intro')}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--wn-border)] px-3 py-2 text-sm font-semibold text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    >
                      <Play size={15} aria-hidden="true" />
                      {mp.watchIntro || 'Watch intro'}
                    </button>
                  )}
                  {recitation && (
                    <button
                      type="button"
                      onClick={() => togglePreview(teacher._id, 'recitation')}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--wn-border)] px-3 py-2 text-sm font-semibold text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    >
                      <Volume2 size={15} aria-hidden="true" />
                      {mp.hearRecitation || 'Hear recitation'}
                    </button>
                  )}
                </div>

                {previewUrl && (
                  <div className="mt-3 rounded-xl overflow-hidden bg-[var(--wn-surface-dark)]">
                    <video key={previewUrl} controls preload="metadata" className="w-full max-h-64">
                      <source src={previewUrl} />
                    </video>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex min-h-[44px] items-center gap-2 text-xs text-[var(--wn-text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCompared}
                      onChange={() => toggleCompare(id)}
                      className="h-4 w-4 accent-[var(--wn-emerald)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    />
                    {mp.addCompare || 'Compare'}
                  </label>

                  <button
                    type="button"
                    onClick={() => setQuickPreviewTeacher(teacher)}
                    className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded-lg"
                  >
                    <Eye size={14} aria-hidden="true" />
                    <span>{mp.quickPreview || 'Quick preview'}</span>
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Link
                    to={lp('/teachers/' + teacher._id)}
                    state={{ prefetchedTeacher: teacher }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--wn-border-mint)] px-3 py-2 text-sm font-bold text-[var(--wn-link)] hover:bg-[var(--wn-emerald-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <BookOpen size={15} aria-hidden="true" />
                    {mp.viewProfile || 'View profile'}
                  </Link>
                  <Link
                    to={lp('/book-trial/' + teacher._id)}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] px-3 py-2 text-sm font-bold text-[var(--wn-text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <GraduationCap size={15} aria-hidden="true" />
                    {mp.bookTrial || 'Book trial'}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {quickPreviewTeacher && (
        <TeacherQuickPreviewModal
          teacher={quickPreviewTeacher}
          locale={activeLocale}
          onClose={() => setQuickPreviewTeacher(null)}
        />
      )}
    </div>
  );
}

