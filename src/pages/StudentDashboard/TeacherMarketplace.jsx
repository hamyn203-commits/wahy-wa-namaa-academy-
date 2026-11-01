import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Heart,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';

function specializationLabel(value, locale) {
  const ar = {
    children: 'تعليم الأطفال',
    adults: 'تعليم الكبار',
    women: 'تعليم النساء',
    'non-arabic': 'غير الناطقين بالعربية',
    tajweed: 'التجويد',
    ijaza: 'الإجازة',
    'arabic-language': 'اللغة العربية',
  };

  const en = {
    children: 'Children',
    adults: 'Adults',
    women: 'Women',
    'non-arabic': 'Non-Arabic speakers',
    tajweed: 'Tajweed',
    ijaza: 'Ijazah',
    'arabic-language': 'Arabic language',
  };

  return (locale === 'ar' ? ar : en)[value] || value;
}

const MATCH_GOALS = [
  ['tajweed', 'التجويد', 'Tajweed'],
  ['ijaza', 'الإجازة', 'Ijazah'],
  ['children', 'تعليم الأطفال', 'Children'],
  ['adults', 'تعليم الكبار', 'Adults'],
  ['arabic-language', 'اللغة العربية', 'Arabic'],
  ['non-arabic', 'غير الناطقين بالعربية', 'Non-Arabic speakers'],
];

export default function StudentTeacherMarketplace({ teachers = [], locale = 'ar', loadFailed = false, onRetry }) {
  const isAr = locale === 'ar';
  const lp = (path) => localizedPath(path, locale);
  const [preview, setPreview] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [compare, setCompare] = useState([]);
  const [matching, setMatching] = useState({ goals: [], preferredGender: 'any', language: '' });
  const [matchMap, setMatchMap] = useState(new Map());
  const [showMatching, setShowMatching] = useState(false);
  const [savingMatching, setSavingMatching] = useState(false);
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
      setError(isAr ? 'تعذر تحديث المفضلة' : 'Could not update favorites');
    }
  };

  const toggleCompare = (teacherId) => {
    const id = String(teacherId);
    setError('');
    setCompare((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 3) {
        setError(isAr ? 'يمكن مقارنة 3 معلمين كحد أقصى.' : 'You can compare up to 3 tutors.');
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
    setSavingMatching(true);
    setError('');
    try {
      await api.put('/api/students/dashboard/tutor-preferences', { matching }, { auth: true });
      const result = await api.get('/api/students/dashboard/matches', { auth: true });
      setMatchMap(new Map((result.matches || []).map((item) => [String(item.teacherId), item])));
      setShowMatching(false);
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر حفظ تفضيلاتك' : 'Could not save matching preferences'));
    } finally {
      setSavingMatching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-6 md:p-8 text-white overflow-hidden relative">
        <div className="absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/10 px-3 py-1 text-xs font-bold text-emerald-100">
              <Sparkles size={14} />
              {isAr ? 'اختيار المعلم المناسب لك' : 'Find the right Quran tutor'}
            </span>
            <h2 className="mt-4 text-2xl md:text-3xl font-black">
              {isAr ? 'شاهد، استمع، قارن، ثم اختر الشيخ الذي ترتاح لطريقته' : 'Watch, listen, compare, then choose your tutor'}
            </h2>
            <p className="mt-2 text-sm leading-7 text-emerald-100/80">
              {isAr
                ? 'استعرض المعلمين المعتمدين، شاهد التعريف، استمع إلى التلاوة، واحصل على ترشيحات حسب هدفك.'
                : 'Browse approved tutors, preview their media, compare profiles, and get matches based on your goals.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMatching((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
            >
              <SlidersHorizontal size={17} />
              {isAr ? 'خصص ترشيحاتي' : 'Personalize matches'}
            </button>
            <Link
              to={lp('/teachers')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-stone-950 hover:bg-amber-300 transition"
            >
              <Search size={17} />
              {isAr ? 'بحث وفلاتر متقدمة' : 'Search all tutors'}
            </Link>
          </div>
        </div>
      </div>

      {showMatching && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-emerald-950">{isAr ? 'ما الذي تبحث عنه؟' : 'What are you looking for?'}</h3>
              <p className="text-xs text-emerald-800/70 mt-1">{isAr ? 'نستخدم هذه التفضيلات لترتيب المعلمين فقط، والقرار النهائي لك.' : 'These preferences only rank tutors. You remain in control.'}</p>
            </div>
            <button type="button" onClick={() => setShowMatching(false)} className="p-2 text-slate-500"><X size={18} /></button>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-slate-600 mb-2">{isAr ? 'الهدف' : 'Goal'}</p>
            <div className="flex flex-wrap gap-2">
              {MATCH_GOALS.map(([id, ar, en]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleGoal(id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    matching.goals.includes(id)
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {isAr ? ar : en}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-600">
              {isAr ? 'أفضل' : 'Preferred tutor'}
              <select
                value={matching.preferredGender}
                onChange={(event) => setMatching((current) => ({ ...current, preferredGender: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="any">{isAr ? 'لا فرق' : 'No preference'}</option>
                <option value="male">{isAr ? 'شيخ' : 'Male tutor'}</option>
                <option value="female">{isAr ? 'شيخة' : 'Female tutor'}</option>
              </select>
            </label>

            <label className="text-xs font-bold text-slate-600">
              {isAr ? 'اللغة' : 'Language'}
              <select
                value={matching.language}
                onChange={(event) => setMatching((current) => ({ ...current, language: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">{isAr ? 'أي لغة' : 'Any language'}</option>
                <option value="arabic">{isAr ? 'العربية' : 'Arabic'}</option>
                <option value="english">{isAr ? 'الإنجليزية' : 'English'}</option>
                <option value="french">{isAr ? 'الفرنسية' : 'French'}</option>
                <option value="turkish">{isAr ? 'التركية' : 'Turkish'}</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={saveMatching}
            disabled={savingMatching}
            className="mt-4 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {savingMatching ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'رتب المعلمين حسب تفضيلاتي' : 'Rank tutors for me')}
          </button>
        </section>
      )}

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {comparedTeachers.length >= 2 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-black text-amber-950">{isAr ? 'مقارنة المعلمين' : 'Tutor comparison'}</h3>
            <button type="button" onClick={() => setCompare([])} className="text-xs font-bold text-amber-800">{isAr ? 'مسح المقارنة' : 'Clear'}</button>
          </div>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="text-start p-2">{isAr ? 'المعلم' : 'Tutor'}</th>
                <th className="text-start p-2">{isAr ? 'التوافق' : 'Match'}</th>
                <th className="text-start p-2">{isAr ? 'التقييم' : 'Rating'}</th>
                <th className="text-start p-2">{isAr ? 'الخبرة' : 'Experience'}</th>
                <th className="text-start p-2">{isAr ? 'الإجازات' : 'Ijazahs'}</th>
              </tr>
            </thead>
            <tbody>
              {comparedTeachers.map((teacher) => (
                <tr key={teacher._id} className="border-t border-amber-100">
                  <td className="p-2 font-bold">{teacher.user?.name || teacher.personalInfo?.fullName || '—'}</td>
                  <td className="p-2">{matchMap.get(String(teacher._id))?.matchScore ?? '—'}%</td>
                  <td className="p-2">{Number(teacher.rating?.average || 0).toFixed(1)}</td>
                  <td className="p-2">{teacher.quranInfo?.teachingExperience || 0} {isAr ? 'سنوات' : 'years'}</td>
                  <td className="p-2">{teacher.quranInfo?.numberOfIjazat || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rankedTeachers.length === 0 && loadFailed ? (
        <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-10 text-center">
          <GraduationCap size={40} className="mx-auto text-red-300 mb-3" />
          <h3 className="font-bold text-red-800">{isAr ? 'تعذر تحميل قائمة المعلمين' : 'We could not load the tutor list'}</h3>
          <p className="text-sm text-red-700 mt-1">{isAr ? 'المشكلة مؤقتة من جهتنا وليست في حسابك. أعد المحاولة بعد لحظات.' : 'This is a temporary problem on our side, not your account. Please try again shortly.'}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-primary mt-4 inline-block text-sm">
              {isAr ? 'إعادة المحاولة' : 'Try again'}
            </button>
          )}
        </div>
      ) : rankedTeachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <GraduationCap size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-800">{isAr ? 'لا يوجد معلمون متاحون حاليًا' : 'No tutors are available yet'}</h3>
          <p className="text-sm text-slate-500 mt-1">{isAr ? 'سيظهر هنا المعلمون المعتمدون فور نشر ملفاتهم. يمكنك التواصل معنا لترشيح معلم مناسب.' : 'Approved tutors will appear here once their profiles are published. Contact us for a recommendation.'}</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          {rankedTeachers.map((teacher) => {
            const id = String(teacher._id);
            const name = teacher.user?.name || teacher.personalInfo?.fullName || (isAr ? 'معلم قرآن' : 'Quran tutor');
            const rating = Number(teacher.rating?.average || 0);
            const ratingCount = Number(teacher.rating?.count || 0);
            const experience = Number(teacher.quranInfo?.teachingExperience || 0);
            const ijazat = Number(teacher.quranInfo?.numberOfIjazat || 0);
            const specializations = Array.isArray(teacher.quranInfo?.specializations)
              ? teacher.quranInfo.specializations.slice(0, 4)
              : [];
            const intro = teacher.media?.introductionVideo;
            const recitation = teacher.media?.recitationVideo;
            const activePreview = preview?.teacherId === teacher._id ? preview.mode : null;
            const previewUrl = activePreview === 'intro' ? intro : activePreview === 'recitation' ? recitation : null;
            const match = matchMap.get(id);
            const isFavorite = favorites.has(id);
            const isCompared = compare.includes(id);

            return (
              <article key={teacher._id} className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                <div className="flex gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={teacher.media?.profilePhoto || teacher.user?.avatar || '/default-teacher.png'}
                      alt={name}
                      className="h-24 w-24 rounded-2xl object-cover border border-slate-100"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => toggleFavorite(id)}
                      className={`absolute -top-2 -right-2 grid h-8 w-8 place-items-center rounded-full border shadow-sm ${
                        isFavorite ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-slate-200 text-slate-400'
                      }`}
                      title={isAr ? 'المفضلة' : 'Favorite'}
                    >
                      <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-slate-900 text-lg">{name}</h3>
                      {teacher.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 size={12} />
                          {isAr ? 'موثق' : 'Verified'}
                        </span>
                      )}
                      {match && (
                        <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-black text-teal-700">
                          {isAr ? `توافق ${match.matchScore}%` : `${match.matchScore}% match`}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Star size={13} fill="currentColor" /> {rating.toFixed(1)}
                          {ratingCount > 0 ? <span className="text-slate-400">({ratingCount})</span> : null}
                        </span>
                      )}
                      {experience > 0 && <span className="inline-flex items-center gap-1"><Clock size={13} /> {experience} {isAr ? 'سنوات خبرة' : 'years'}</span>}
                      {ijazat > 0 && <span className="inline-flex items-center gap-1"><Award size={13} /> {ijazat} {isAr ? 'إجازات' : 'ijazahs'}</span>}
                    </div>

                    {match?.reasons?.length ? (
                      <p className="mt-2 text-[11px] text-teal-700">{match.reasons.join(' · ')}</p>
                    ) : null}

                    {specializations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {specializations.map((item) => (
                          <span key={item} className="rounded-full bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] text-slate-600">
                            {specializationLabel(item, locale)}
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
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <Play size={15} />
                      {isAr ? 'شاهد التعريف' : 'Watch introduction'}
                    </button>
                  )}
                  {recitation && (
                    <button
                      type="button"
                      onClick={() => togglePreview(teacher._id, 'recitation')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <Volume2 size={15} />
                      {isAr ? 'استمع للتلاوة' : 'Hear recitation'}
                    </button>
                  )}
                </div>

                {previewUrl && (
                  <div className="mt-3 rounded-xl overflow-hidden bg-slate-950">
                    <video key={previewUrl} controls preload="metadata" className="w-full max-h-64">
                      <source src={previewUrl} />
                    </video>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCompared}
                      onChange={() => toggleCompare(id)}
                    />
                    {isAr ? 'أضف للمقارنة' : 'Compare'}
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to={lp('/teachers/' + teacher._id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-50"
                  >
                    <BookOpen size={15} />
                    {isAr ? 'عرض الملف' : 'View profile'}
                  </Link>
                  <Link
                    to={lp('/book-trial/' + teacher._id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                  >
                    <GraduationCap size={15} />
                    {isAr ? 'احجز حصة تجريبية' : 'Book trial'}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
