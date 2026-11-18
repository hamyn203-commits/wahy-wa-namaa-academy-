import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Star, Users, ArrowLeft, ArrowRight, BookOpen, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function WomenPortal() {
  const { locale, isRTL, dir, t: i18nT } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ femaleTeachers: 0, studentsServed: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setFetchError('');
    Promise.all([
      api.get('/api/women/teachers?limit=12'),
      api.get('/api/women/stats'),
      api.get('/api/courses?program=women&limit=6'),
    ]).then(([tRes, sRes, cRes]) => {
      setTeachers(tRes.teachers || []);
      setStats(sRes || { femaleTeachers: 0, studentsServed: 0 });
      setCourses(cRes.courses || (Array.isArray(cRes) ? cRes : []));
    }).catch((err) => {
      setFetchError(err?.message || (isRTL ? 'تعذر تحميل بيانات قسم النساء الآن.' : 'Unable to load women section data right now.'));
    }).finally(() => setLoading(false));
  }, [isRTL]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[locale] || (isRTL ? (field.ar || field.en) : (field.en || field.ar)) || '';
  };

  return (
    <>
      <SEOHead page={{
        url: '/women',
        title: isRTL ? 'أكاديمية النساء | وَحْيٌ وَنَمَاء' : 'Women Academy | Wahy Wa Namaa',
        description: isRTL ? 'قسم مستقل — معلمات وطالبات فقط' : 'Dedicated section — female teachers and students only'
      }} />
      <GlobalHeader />
      <main className="wn-program-shell" dir={dir}>
        <section className="wn-program-hero page-container">
          <div className="wn-program-hero__icon"><ShieldCheck size={40} aria-hidden="true" /></div>
          <h1 className="text-4xl font-bold mb-3 text-[var(--wn-heading)]">{isRTL ? 'أكاديمية النساء' : 'Women Academy'}</h1>
          <p className="text-[var(--wn-text-secondary)] max-w-xl mx-auto mb-6">
            {isRTL ? 'بيئة آمنة ومستقلة — معلمات متخصصات في تعليم القرآن للنساء والبنات' : 'Safe dedicated environment — female teachers specialized in Quran for women and girls'}
          </p>
          <div className="flex justify-center gap-8 text-sm text-[var(--wn-text-primary)]">
            <span className="flex items-center gap-2">
              <Users size={18} className="text-[var(--wn-women-accent)]" aria-hidden="true" /> {stats.femaleTeachers} {isRTL ? 'معلمة' : 'teachers'}
            </span>
            <span className="flex items-center gap-2">
              <Star size={18} className="text-[var(--wn-women-accent)]" aria-hidden="true" /> {stats.studentsServed}+ {isRTL ? 'طالبة' : 'students'}
            </span>
          </div>
        </section>

        {fetchError ? (
          <section className="max-w-3xl mx-auto px-4 pb-16">
            <div className="wn-public-empty" role="alert">
              <ShieldCheck size={42} aria-hidden="true" />
              <h3>{isRTL ? 'تعذر تحميل البيانات' : 'Unable to load content'}</h3>
              <p>{fetchError}</p>
              <button type="button" onClick={loadData} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                <RefreshCw size={16} aria-hidden="true" />
                <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="max-w-6xl mx-auto px-4 pb-12">
              <h2 className="text-2xl font-bold mb-6 text-[var(--wn-heading)]">{isRTL ? 'دورات النساء' : 'Women Courses'}</h2>
              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-live="polite">
                  <span className="sr-only">{i18nT.common?.loading || (isRTL ? 'جاري تحميل الدورات...' : 'Loading courses...')}</span>
                  {Array.from({ length: 3 }, (_, idx) => (
                    <div key={idx} className="wn-program-card p-5" aria-hidden="true">
                      <Skeleton className="h-7 w-7 mb-3 rounded-lg" />
                      <Skeleton className="h-5 w-2/3 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : courses.length === 0 ? (
                <p className="text-center text-[var(--wn-text-secondary)] py-8 bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-2xl">
                  {isRTL ? 'قريباً — دورات مخصصة للنساء' : 'Coming soon — courses for women'}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((c) => (
                    <Link key={c._id} to={localizedPath(`/courses/${c.slug}`, locale)} className="wn-program-card p-5">
                      <BookOpen className="text-[var(--wn-women-accent)] mb-3" size={28} aria-hidden="true" />
                      <h3 className="font-bold mb-1 text-[var(--wn-heading)]">{pickText(c.title)}</h3>
                      <p className="text-sm text-[var(--wn-text-secondary)] line-clamp-2">{pickText(c.description)}</p>
                      <span className="min-h-[44px] inline-flex items-center gap-1 text-[var(--wn-women-accent)] text-sm mt-2 font-medium">
                        {isRTL ? 'ابدئي الآن' : 'Start now'} <ArrowIcon size={14} aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="max-w-6xl mx-auto px-4 pb-16">
              <h2 className="text-2xl font-bold mb-6 text-[var(--wn-heading)]">{isRTL ? 'معلماتنا' : 'Our Teachers'}</h2>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12" role="status" aria-live="polite">
                  <div className="spinner spinner-lg" aria-hidden="true" />
                  <span className="sr-only">{i18nT.common?.loading || (isRTL ? 'جاري تحميل المعلمات...' : 'Loading teachers...')}</span>
                </div>
              ) : teachers.length === 0 ? (
                <p className="text-center text-[var(--wn-text-secondary)] py-12">
                  {isRTL ? 'لا توجد ملفات معلمات منشورة حاليًا — يمكنك بدء التسجيل' : 'No teacher profiles are published yet'}
                </p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teachers.map((t) => (
                    <Link key={t._id} to={localizedPath(`/teachers/${t._id}`, locale)} className="wn-program-card p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-full bg-[var(--wn-women-soft)] border border-[var(--wn-women-border)] flex items-center justify-center text-[var(--wn-women-accent)] font-bold text-xl">
                          {(t.user?.name || t.personalInfo?.fullName || '?')[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-[var(--wn-heading)]">{t.user?.name || t.personalInfo?.fullName}</h3>
                          <p className="text-sm text-[var(--wn-text-secondary)] flex items-center gap-1">
                            <Star size={14} className="text-[var(--wn-gold)] fill-current" aria-hidden="true" />
                            {Number(t.rating?.count || 0) > 0 ? t.rating?.average?.toFixed(1) : (isRTL ? 'بدون تقييم بعد' : 'No ratings yet')}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--wn-text-secondary)]">{t.personalInfo?.country} · {t.quranInfo?.teachingExperience || 0} {isRTL ? 'سنوات' : 'yrs'}</p>
                      <span className="min-h-[44px] inline-flex items-center gap-1 text-[var(--wn-women-accent)] text-sm mt-2 font-medium">
                        {isRTL ? 'عرض الملف' : 'View profile'} <ArrowIcon size={14} aria-hidden="true" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="text-center mt-10">
                <Link to={localizedPath('/register/student', locale) + '?section=women'} className="btn-primary min-h-[44px] inline-flex items-center justify-center">
                  {isRTL ? 'سجّلي كطالبة' : 'Register as Student'}
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
      <GlobalFooter />
    </>
  );
}
