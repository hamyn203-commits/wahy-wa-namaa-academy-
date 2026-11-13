import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Users, Star, CheckCircle, Play, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
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

function textValue(value, locale) {
  if (typeof value === 'string') return value;
  return value?.[locale] || value?.ar || value?.en || '';
}

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { createCourseSchema, createBreadcrumbSchema } = useSEO();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({ loaded: false, configured: false });

  useEffect(() => {
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
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [slug, authLoading, isAuthenticated]);

  useEffect(() => {
    api.get('/api/payments/config')
      .then((data) => setPaymentConfig({
        loaded: true,
        configured: Boolean(data?.configured),
        provider: data?.provider || null,
      }))
      .catch(() => setPaymentConfig({ loaded: true, configured: false }));
  }, []);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale));
      return;
    }

    const paidCourse = Number(course?.price || 0) > 0;

    if (paidCourse && paymentConfig.loaded && !paymentConfig.configured) {
      toast.error(
        isAr
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
      toast.success(isAr ? 'تم التسجيل بنجاح' : 'Enrollment completed');
    } catch (err) {
      const message = err.code === 'PAYMENT_PROFILE_INCOMPLETE'
        ? (isAr ? 'أضف رقم هاتف صالح إلى حسابك قبل الدفع.' : 'Add a valid phone number to your account before payment.')
        : err.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
          ? (isAr ? 'طرق التحويل غير مفعّلة بعد.' : 'Transfer methods are not enabled yet.')
          : err.message || (isAr ? 'تعذر التسجيل' : 'Enrollment failed');

      toast.error(message);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell" role="status" aria-live="polite">
          <span className="sr-only">{isAr ? 'جاري تحميل تفاصيل الدورة...' : 'Loading course details...'}</span>
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

  if (!course) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4">
          <div className="wn-public-empty max-w-xl w-full">
            <BookOpen size={48} />
            <h3>{isAr ? 'الدورة غير موجودة' : 'Course not found'}</h3>
            <LocalizedLink to="/courses" locale={locale} className="wn-btn wn-btn--primary mt-4">
              {isAr ? 'عرض جميع الدورات' : 'Browse courses'}
            </LocalizedLink>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const title = textValue(course.title, locale) || slug;
  const description = textValue(course.description, locale);
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
    { name: isAr ? 'الرئيسية' : 'Home', url: '/' },
    { name: isAr ? 'الدورات' : 'Courses', url: '/courses' },
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

      <main className="wn-detail-shell">
        <section className="wn-detail-hero">
          <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} /> {course.category || (isAr ? 'برنامج قرآني' : 'Quran program')}</span>
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}

              <div className="wn-detail-meta">
                {course.durationInHours || course.duration ? <span><Clock size={14} /> {course.durationInHours || course.duration} {course.durationInHours ? (isAr ? 'ساعة' : 'hours') : ''}</span> : null}
                <span><BookOpen size={14} /> {lessons.length} {isAr ? 'درس' : 'lessons'}</span>
                {enrolled > 0 ? <span><Users size={14} /> {enrolled} {isAr ? 'ملتحق' : 'enrolled'}</span> : null}
                {ratingCount > 0 && ratingAverage > 0 ? <span><Star size={14} /> {ratingAverage.toFixed(1)} ({ratingCount})</span> : null}
              </div>
            </motion.div>
          </div>
        </section>

        <div className="page-container wn-detail-layout">
          <section className="wn-detail-card">
            <div className="wn-detail-card__body">
              <span className="wn-public-eyebrow">{isAr ? 'محتوى الدورة' : 'COURSE CONTENT'}</span>
              <h2>{isAr ? 'رحلة التعلم' : 'Learning journey'}</h2>

              <div className="wn-lesson-list">
                {lessons.length ? lessons.map((lesson, index) => (
                  <div key={lesson._id || index} className="wn-lesson-row">
                    <span className="wn-lesson-row__status">
                      {isDone(lesson._id) ? <CheckCircle size={15} /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                    </span>
                    <span className="wn-lesson-row__title">{textValue(lesson.title, locale) || (isAr ? 'الدرس ' : 'Lesson ') + (index + 1)}</span>
                    {lesson.isFree ? <span className="wn-lesson-row__tag">{isAr ? 'معاينة' : 'Preview'}</span> : enrollment && lesson.type ? <span className="text-[10px] text-[var(--wn-text-tertiary)]">{lesson.type}</span> : <span />}
                  </div>
                )) : (
                  <div className="wn-public-empty !py-10">
                    <BookOpen size={38} />
                    <h3>{isAr ? 'المحتوى قيد التجهيز' : 'Content is being prepared'}</h3>
                    <p>{isAr ? 'سيظهر محتوى الدورة هنا عند نشر الدروس.' : 'Course lessons will appear here once they are published.'}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="wn-detail-card wn-detail-aside">
            {enrollment ? (
              <div className="wn-detail-progress">
                <div className="wn-detail-progress__head">
                  <span>{isAr ? 'تقدمك في الدورة' : 'Your progress'}</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="wn-detail-progress__bar"><i style={{ width: Math.min(100, Math.max(0, progress)) + '%' }} /></div>
              </div>
            ) : null}

            <div className="wn-detail-price">
              {Number(course.price) > 0 ? course.price + ' ' + (course.currency || 'USD') : (isAr ? 'مجاني' : 'Free')}
            </div>

            <div className="grid gap-2 mt-4">
              {enrollment ? (
                <button onClick={() => navigate(localizedPath('/courses/' + slug + '/learn', locale))} className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg">
                  <Play size={17} />
                  {progress > 0 ? (isAr ? 'متابعة التعلم' : 'Continue learning') : (isAr ? 'ابدأ التعلم' : 'Start learning')}
                </button>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling || (Number(course.price) > 0 && paymentConfig.loaded && !paymentConfig.configured)}
                  className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg disabled:opacity-60"
                >
                  {enrolling
                    ? (isAr ? 'جاري التحضير...' : 'Preparing...')
                    : Number(course.price) > 0
                      ? paymentConfig.loaded && !paymentConfig.configured
                        ? (isAr ? 'طرق التحويل قيد الإعداد' : 'Transfer methods are being configured')
                        : (isAr ? 'التحويل وإرسال الإثبات' : 'Transfer and submit proof')
                      : (isAr ? 'الالتحاق بالدورة' : 'Enroll in course')}
                  {!enrolling ? <ArrowIcon size={16} /> : null}
                </button>
              )}

              {!isAuthenticated ? <LocalizedLink to="/login" locale={locale} className="wn-btn wn-btn--secondary wn-btn--block">{isAr ? 'تسجيل الدخول أولًا' : 'Sign in first'}</LocalizedLink> : null}
              <LocalizedLink to="/contact" locale={locale} className="text-center text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-emerald-dark)] py-2">
                {isAr ? 'لديك سؤال عن هذه الدورة؟' : 'Have a question about this course?'}
              </LocalizedLink>
            </div>
          </aside>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
