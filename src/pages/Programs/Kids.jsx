import { Link } from 'react-router-dom';
import { Gamepad2, Trophy, Medal, ArrowLeft, ArrowRight, ShieldCheck, BookOpen, RefreshCw } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';
import KidsQuizGame from '../../components/games/KidsQuizGame';
import KidsLettersGame from '../../components/games/KidsLettersGame';
import KidsCompetitionsAndAwards from '../../components/kids/KidsCompetitionsAndAwards';

const FEATURES = [
  { icon: Gamepad2, ar: 'ألعاب تعليمية ممتعة', en: 'Fun educational games' },
  { icon: Trophy, ar: 'مكافآت ونقاط', en: 'Rewards & points' },
  { icon: Medal, ar: 'مسابقات شهرية', en: 'Monthly competitions' },
  { icon: ShieldCheck, ar: 'بيئة آمنة للأطفال', en: 'Safe environment for kids' },
];

export default function KidsProgram() {
  const { locale, isRTL, dir, t } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const loadCourses = useCallback(() => {
    setCoursesLoading(true);
    setCoursesError('');
    api.get('/api/courses?program=kids&limit=6')
      .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
      .catch(() =>
        api.get('/api/courses?category=children&limit=6')
          .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
          .catch((err) => {
            setCourses([]);
            setCoursesError(err?.message || (isRTL ? 'تعذر تحميل دورات الأطفال.' : 'Could not load kids courses.'));
          })
      )
      .finally(() => setCoursesLoading(false));
  }, [isRTL]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const pickText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[locale] || (isRTL ? (field.ar || field.en) : (field.en || field.ar)) || '';
  };

  return (
    <>
      <SEOHead page={{ url: '/programs/kids', title: isRTL ? 'برنامج الأطفال' : 'Kids Program', description: isRTL ? 'تعليم القرآن للأطفال بطريقة ممتعة' : 'Fun Quran learning for children' }} />
      <GlobalHeader />
      <main className="wn-program-shell" dir={dir}>
        <section className="wn-program-hero page-container max-w-3xl">
          <div className="wn-program-hero__icon"><Gamepad2 size={42} aria-hidden="true" /></div>
          <h1 className="text-4xl font-bold mb-4 text-[var(--wn-heading)]">{isRTL ? 'برنامج الأطفال' : 'Kids Program'}</h1>
          <p className="text-[var(--wn-text-secondary)] text-lg mb-8">{isRTL ? 'حفظ القرآن والتجويد للأطفال — ألعاب ومكافآت ومسابقات' : 'Quran memorization for kids — games, rewards, and competitions'}</p>
          <Link to={localizedPath('/register/student', locale)} className="btn-primary min-h-[44px] inline-flex items-center gap-2">
            {isRTL ? 'سجّل طفلك' : 'Register Your Child'} <ArrowIcon size={18} aria-hidden="true" />
          </Link>
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-20 grid md:grid-cols-2 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.ar} className="wn-program-card p-6">
                <Icon className="text-[var(--wn-text-gold)] mb-3" size={32} aria-hidden="true" />
                <h2 className="font-bold text-lg text-[var(--wn-heading)]">{isRTL ? f.ar : f.en}</h2>
              </div>
            );
          })}
        </section>

        <div className="max-w-6xl mx-auto px-4 pb-16">
          <KidsCompetitionsAndAwards />
        </div>

        <section className="max-w-4xl mx-auto px-4 pb-16">
          <div className="bg-[var(--wn-emerald-deep)] text-[var(--wn-text-inverse)] rounded-3xl p-8 shadow-xl border border-[var(--wn-border-mint)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-start">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[var(--wn-gold)]/20 text-[var(--wn-gold)]">
                {isRTL ? 'المسار المنهجي التأسيسي' : 'Foundational Track'}
              </span>
              <h2 className="text-2xl font-bold">
                {isRTL ? 'مسار تأسيس الأطفال: القاعدة النورانية ونور البيان' : 'Kids Foundation: Noorania & Noor Al-Bayan'}
              </h2>
              <p className="text-[var(--wn-text-inverse)]/85 text-sm max-w-xl">
                {isRTL
                  ? 'منهج متكامل لضبط مخارج الحروف، التلقين بالصوت والصورة، والتهجئة بالرسم العثماني مع كبار المعلمين المتخصصين.'
                  : 'Complete program for phonetics, interactive pronunciation, and reading directly from the Mushaf.'}
              </p>
            </div>
            <Link
              to={localizedPath('/tracks', locale)}
              className="min-h-[44px] inline-flex items-center shrink-0 px-6 py-3 rounded-xl font-bold text-sm bg-[var(--wn-gold)] hover:bg-[var(--wn-sand)] text-[var(--wn-emerald-deep)] shadow-md transition"
            >
              {isRTL ? 'استكشف مسار الأطفال' : 'Explore Kids Track'}
            </Link>
          </div>
        </section>

        <section className="max-w-xl mx-auto px-4 pb-8">
          <h2 className="font-bold text-xl mb-4 text-center text-[var(--wn-heading)]">{isRTL ? 'لعبة التجويد السريعة' : 'Quick Tajweed Quiz'}</h2>
          <KidsQuizGame locale={locale} />
        </section>

        <section className="max-w-xl mx-auto px-4 pb-12">
          <h2 className="font-bold text-xl mb-4 text-center text-[var(--wn-heading)]">{isRTL ? 'لعبة حروف الهجاء' : 'Arabic Letters Game'}</h2>
          <KidsLettersGame locale={locale} />
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-16">
          {coursesLoading ? (
            <div className="grid md:grid-cols-2 gap-4" role="status" aria-live="polite">
              <span className="sr-only">{t.common?.loading || (isRTL ? 'جاري تحميل دورات الأطفال...' : 'Loading kids courses...')}</span>
              {Array.from({ length: 2 }, (_, idx) => (
                <div key={idx} className="wn-program-card p-4" aria-hidden="true">
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : coursesError ? (
            <div className="wn-public-empty" role="alert">
              <BookOpen size={36} aria-hidden="true" />
              <p>{coursesError}</p>
              <button type="button" onClick={loadCourses} className="wn-btn wn-btn--primary mt-3 min-h-[44px]">
                <RefreshCw size={15} aria-hidden="true" />
                <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          ) : courses.length > 0 ? (
            <>
              <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-[var(--wn-heading)]">
                <BookOpen size={22} aria-hidden="true" /> {isRTL ? 'دورات الأطفال' : 'Kids Courses'}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {courses.map((c) => (
                  <Link key={c._id} to={localizedPath(`/courses/${c.slug}`, locale)} className="wn-program-card p-4">
                    <p className="font-bold text-[var(--wn-heading)]">{pickText(c.title)}</p>
                    <p className="text-sm text-[var(--wn-link)] mt-1">{c.price} {c.currency}</p>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
