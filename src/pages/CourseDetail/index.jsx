import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Users, Star, CheckCircle, Play, Sparkles, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import LocalizedLink from '../../components/LocalizedLink';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import { localizedPath } from '../../lib/locale';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import '../../styles/public-experience.css';

function textValue(value, locale, isRTL) {
  if (typeof value === 'string') return value;
  return value?.[locale] || (isRTL ? (value?.ar || value?.en) : (value?.en || value?.ar)) || '';
}

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, isRTL, dir, t } = useI18n();
  const { createCourseSchema, createBreadcrumbSchema } = useSEO();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({ loaded: false, configured: false });

  const loadCourse = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.get('/api/courses/' + slug)
      .then(async (data) => {
        setCourse(data);
        if (!authLoading && isAuthenticated) {
          try {
            const lms = await api.get('/api/lms/course/' + slug, { auth: true });
            setEnrollment(lms.enrollment);
          } catch {
            setEnrollment(null);
          }
        } else if (!authLoading) {
          setEnrollment(null);
        }
      })
      .catch((err) => {
        setCourse(null);
        if (err?.status && err.status !== 404) {
          setFetchError(err.message || (isRTL ? 'تعذر تحميل تفاصيل الدورة.' : 'Could not load course details.'));
        } else if (!err?.status) {
          setFetchError(err?.message || (isRTL ? 'تعذر الاتصال بالخادم.' : 'Could not reach the server.'));
        }
      })
      .finally(() => setLoading(false));
  }, [slug, authLoading, isAuthenticated, isRTL]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  useEffect(() => {
    api.get('/api/payments/config')
      .then((data) => setPaymentConfig({
        loaded: true,
        configured: Boolean(data?.configured),
        provider: data?.provider || null,
      }))
      .catch(() => setPaymentConfig({ loaded: true, configured: false }));
  }, []);

  const redirectTarget = (location.pathname || localizedPath('/courses/' + slug, locale)) + (location.search || '');
  const loginWithRedirect = localizedPath('/login', locale) + '?redirect=' + encodeURIComponent(redirectTarget);

  const handleEnroll = async () => {
    if (enrolling) return;
    if (!isAuthenticated) {
      navigate(loginWithRedirect);
      return;
    }

    const paidCourse = Number(course?.price || 0) > 0;

    if (paidCourse && paymentConfig.loaded && !paymentConfig.configured) {
      toast.error(
        isRTL
          ? 'طرق التحويل قيد الإعداد حاليًا. تواصل معنا للمساعدة.'
          : 'Transfer methods are currently being configured. Contact us for help.'
      );
      return;
    }

    setEnrolling(true);
    try {
      if (paidCourse) {
        navigate(
          localizedPath('/payment/manual', locale)
            + '?course=' + encodeURIComponent(slug)
        );
        return;
      }

      const data = await api.post('/api/lms/course/' + slug + '/enroll', {}, { auth: true });
      setEnrollment(data.enrollment);
      toast.success(isRTL ? 'تم التسجيل بنجاح' : 'Enrollment completed');
    } catch (err) {
      const message = err.code === 'PAYMENT_PROFILE_INCOMPLETE'
        ? (isRTL ? 'أضف رقم هاتف صالح إلى حسابك قبل الدفع.' : 'Add a valid phone number to your account before payment.')
        : err.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
          ? (isRTL ? 'طرق التحويل غير مفعّلة بعد.' : 'Transfer methods are not enabled yet.')
          : err.message || (isRTL ? 'تعذر التسجيل' : 'Enrollment failed');

      toast.error(message);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell" dir={dir} role="status" aria-live="polite">
          <span className="sr-only">{t.common?.loading || (isRTL ? 'جاري تحميل تفاصيل الدورة...' : 'Loading course details...')}</span>
          <section className="wn-detail-hero">
            <div className="page-container">
              <Skeleton className="mb-3 h-4 w-28" />
              <Skeleton className="mb-4 h-10 w-2/3" />
              <Skeleton className="mb-5 h-4 w-1/2" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </section>
          <div className="page-container wn-detail-layout">
            <section className="wn-detail-card">
              <div className="wn-detail-card__body grid gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-48" />
                {Array.from({ length: 4 }, (_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </section>
            <aside className="wn-detail-card wn-detail-aside grid gap-4">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </aside>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-public-empty max-w-xl w-full" role="alert">
            <BookOpen size={48} aria-hidden="true" />
            <h3>{isRTL ? 'تعذر تحميل الدورة' : 'Unable to load course'}</h3>
            <p>{fetchError}</p>
            <button type="button" onClick={loadCourse} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              <RefreshCw size={16} aria-hidden="true" />
              <span>{isRTL ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!course) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-public-empty max-w-xl w-full">
            <BookOpen size={48} aria-hidden="true" />
            <h3>{isRTL ? 'الدورة غير موجودة' : 'Course not found'}</h3>
            <LocalizedLink to="/courses" locale={locale} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
              {isRTL ? 'عرض جميع الدورات' : 'Browse courses'}
            </LocalizedLink>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const title = textValue(course.title, locale, isRTL) || slug;
  const description = textValue(course.description, locale, isRTL);
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  const ratingCount = Number(course.stats?.rating?.count || 0);
  const ratingAverage = Number(course.stats?.rating?.average || 0);
  const enrolled = Number(course.stats?.enrolled || 0);
  const progress = Number(enrollment?.progress?.percentage || 0);

  const isDone = (lessonId) => enrollment?.progress?.completedLessons?.some(
    (completed) => completed.lesson?.toString?.() === lessonId || completed.lesson === lessonId
  );

  const courseSchema = createCourseSchema({
    name: title,
    description,
    url: '/courses/' + slug,
    image: course.thumbnail || course.coverImage,
    level: course.level,
    price: course.price,
    currency: course.currency || 'USD',
    ratingValue: ratingAverage,
    ratingCount,
  });

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: t.common?.home || (isRTL ? 'الرئيسية' : 'Home'), url: '/' },
    { name: t.courses?.title || (isRTL ? 'الدورات' : 'Courses'), url: '/courses' },
    { name: title, url: '/courses/' + slug },
  ]);

  return (
    <>
      <SEOHead page={{
        title,
        description,
        image: course.thumbnail || course.coverImage,
        url: '/courses/' + slug,
        type: 'course',
        schema: [courseSchema, breadcrumbSchema],
      }} />
      <GlobalHeader />

      <main className="wn-detail-shell" dir={dir}>
        <section className="wn-detail-hero">
          <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {course.category || (isRTL ? 'برنامج قرآني' : 'Quran program')}</span>
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}

              <div className="wn-detail-meta">
                {course.durationInHours || course.duration ? <span><Clock size={14} aria-hidden="true" /> {course.durationInHours || course.duration} {course.durationInHours ? (isRTL ? 'ساعة' : 'hours') : ''}</span> : null}
                <span><BookOpen size={14} aria-hidden="true" /> {lessons.length} {isRTL ? 'درس' : 'lessons'}</span>
                {enrolled > 0 ? <span><Users size={14} aria-hidden="true" /> {enrolled} {isRTL ? 'ملتحق' : 'enrolled'}</span> : null}
                {ratingCount > 0 && ratingAverage > 0 ? <span><Star size={14} aria-hidden="true" /> {ratingAverage.toFixed(1)} ({ratingCount})</span> : null}
              </div>
            </motion.div>
          </div>
        </section>

        <div className="page-container wn-detail-layout">
          <section className="wn-detail-card">
            <div className="wn-detail-card__body">
              <span className="wn-public-eyebrow">{isRTL ? 'محتوى الدورة' : 'COURSE CONTENT'}</span>
              <h2>{isRTL ? 'رحلة التعلم' : 'Learning journey'}</h2>

              <div className="wn-lesson-list">
                {lessons.length ? lessons.map((lesson, index) => (
                  <div key={lesson._id || index} className="wn-lesson-row">
                    <span className="wn-lesson-row__status">
                      {isDone(lesson._id) ? <CheckCircle size={15} aria-hidden="true" /> : <span className="text-xs font-bold">{index + 1}</span>}
                    </span>
                    <span className="wn-lesson-row__title">{textValue(lesson.title, locale, isRTL) || (isRTL ? 'الدرس ' : 'Lesson ') + (index + 1)}</span>
                    {lesson.isFree ? <span className="wn-lesson-row__tag">{isRTL ? 'معاينة' : 'Preview'}</span> : enrollment && lesson.type ? <span className="text-xs text-[var(--wn-text-tertiary)]">{lesson.type}</span> : <span />}
                  </div>
                )) : (
                  <div className="wn-public-empty !py-10">
                    <BookOpen size={38} aria-hidden="true" />
                    <h3>{isRTL ? 'المحتوى قيد التجهيز' : 'Content is being prepared'}</h3>
                    <p>{isRTL ? 'سيظهر محتوى الدورة هنا عند نشر الدروس.' : 'Course lessons will appear here once they are published.'}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="wn-detail-card wn-detail-aside">
            {enrollment ? (
              <div className="wn-detail-progress">
                <div className="wn-detail-progress__head">
                  <span>{isRTL ? 'تقدمك في الدورة' : 'Your progress'}</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="wn-detail-progress__bar"><i style={{ width: Math.min(100, Math.max(0, progress)) + '%' }} /></div>
              </div>
            ) : null}

            <div className="wn-detail-price">
              {Number(course.price) > 0 ? course.price + ' ' + (course.currency || 'USD') : (t.courses?.free || (isRTL ? 'مجاني' : 'Free'))}
            </div>

            <div className="grid gap-2 mt-4">
              {enrollment ? (
                <button type="button" onClick={() => navigate(localizedPath('/courses/' + slug + '/learn', locale))} className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px]">
                  <Play size={17} aria-hidden="true" />
                  {progress > 0 ? (isRTL ? 'متابعة التعلم' : 'Continue learning') : (isRTL ? 'ابدأ التعلم' : 'Start learning')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnroll}
                  disabled={enrolling || (Number(course.price) > 0 && paymentConfig.loaded && !paymentConfig.configured)}
                  aria-busy={enrolling}
                  className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px] disabled:opacity-60"
                >
                  {enrolling
                    ? (isRTL ? 'جاري التحضير...' : 'Preparing...')
                    : Number(course.price) > 0
                      ? paymentConfig.loaded && !paymentConfig.configured
                        ? (isRTL ? 'طرق التحويل قيد الإعداد' : 'Transfer methods are being configured')
                        : (isRTL ? 'التحويل وإرسال الإثبات' : 'Transfer and submit proof')
                      : (isRTL ? 'الالتحاق بالدورة' : 'Enroll in course')}
                  {!enrolling ? <ArrowIcon size={16} aria-hidden="true" /> : null}
                </button>
              )}

              {!isAuthenticated ? (
                <LocalizedLink to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} locale={locale} className="wn-btn wn-btn--secondary wn-btn--block min-h-[44px]">
                  {isRTL ? 'تسجيل الدخول أولًا' : 'Sign in first'}
                </LocalizedLink>
              ) : null}
              <LocalizedLink to="/contact" locale={locale} className="min-h-[44px] inline-flex items-center justify-center text-center text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] py-2">
                {isRTL ? 'لديك سؤال عن هذه الدورة؟' : 'Have a question about this course?'}
              </LocalizedLink>
            </div>
          </aside>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
