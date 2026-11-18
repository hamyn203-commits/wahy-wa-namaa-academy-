import { Link } from 'react-router-dom';
import { HeartHandshake, Globe2, Users, ArrowLeft, ArrowRight, BookOpen, RefreshCw } from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const FEATURES = [
  { icon: Globe2, ar: 'دعم بالإنجليزية والفرنسية', en: 'Support in English & French' },
  { icon: BookOpen, ar: 'مسارات تعليمية مخصصة', en: 'Custom learning paths' },
  { icon: Users, ar: 'مرافقة فردية', en: 'One-on-one mentoring' },
  { icon: HeartHandshake, ar: 'مجتمع داعم', en: 'Supportive community' },
];

export default function RevertsProgram() {
  const { locale, isRTL, dir, t } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadCourses = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/courses?program=reverts&limit=6')
      .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
      .catch(() =>
        api.get('/api/courses?category=islamic&level=beginner&limit=6')
          .then((d) => setCourses(d.courses || (Array.isArray(d) ? d : [])))
          .catch((err) => {
            setCourses([]);
            setFetchError(err?.message || (isRTL ? 'تعذر تحميل المسارات حالياً.' : 'Could not load paths right now.'));
          })
      )
      .finally(() => setLoading(false));
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
      <SEOHead page={{ url: '/programs/reverts', title: isRTL ? 'برنامج المسلمين الجدد' : 'New Muslims Program', description: isRTL ? 'مسار تعليمي للمسلمين الجدد' : 'Learning path for new Muslims' }} />
      <GlobalHeader />
      <main className="wn-program-shell" dir={dir}>
        <section className="wn-program-hero page-container max-w-3xl">
          <div className="wn-program-hero__icon"><HeartHandshake size={42} aria-hidden="true" /></div>
          <h1 className="text-4xl font-bold mb-4 text-[var(--wn-heading)]">{isRTL ? 'برنامج المسلمين الجدد' : 'New Muslims Program'}</h1>
          <p className="text-[var(--wn-text-secondary)] text-lg mb-8">{isRTL ? 'رحلة تعليمية لطيفة من الأساسيات إلى إتقان القرآن — بلغتك' : 'A gentle journey from basics to Quran mastery — in your language'}</p>
          <Link to={localizedPath('/register/student', locale)} className="btn-primary min-h-[44px] inline-flex items-center gap-2">
            {isRTL ? 'ابدأ الآن' : 'Start Now'} <ArrowIcon size={18} aria-hidden="true" />
          </Link>
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-20 grid md:grid-cols-2 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.ar} className="wn-program-card p-6">
                <Icon className="text-[var(--wn-link)] mb-3" size={32} aria-hidden="true" />
                <h2 className="font-bold text-lg text-[var(--wn-heading)]">{isRTL ? f.ar : f.en}</h2>
              </div>
            );
          })}
        </section>

        <section className="max-w-4xl mx-auto px-4 pb-16">
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4" role="status" aria-live="polite">
              <span className="sr-only">{t.common?.loading || (isRTL ? 'جاري تحميل المسارات...' : 'Loading paths...')}</span>
              {Array.from({ length: 2 }, (_, idx) => (
                <div key={idx} className="wn-program-card p-4" aria-hidden="true">
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="wn-public-empty" role="alert">
              <BookOpen size={36} aria-hidden="true" />
              <p>{fetchError}</p>
              <button type="button" onClick={loadCourses} className="wn-btn wn-btn--primary mt-3 min-h-[44px]">
                <RefreshCw size={15} aria-hidden="true" />
                <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          ) : courses.length > 0 ? (
            <>
              <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-[var(--wn-heading)]">
                <BookOpen size={22} aria-hidden="true" /> {isRTL ? 'مسارات للمسلمين الجدد' : 'New Muslim Paths'}
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
