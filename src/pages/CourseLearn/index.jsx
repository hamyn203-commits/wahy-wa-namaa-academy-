import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, CheckCircle, Circle, Award, Menu, X, Home } from 'lucide-react';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import SEOHead from '../../components/SEOHead';
import api from '../../lib/api';
import VideoLesson from '../../components/lms/VideoLesson';
import TextLesson from '../../components/lms/TextLesson';
import QuizLesson from '../../components/lms/QuizLesson';
import '../../styles/learning-experience.css';

export default function CourseLearn() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const { ready, logout } = useRequireAuth(['student', 'admin', 'teacher']);
  const toast = useToast();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const t = (obj) => obj?.[locale] || obj?.ar || obj?.en || '';

  const loadCourse = useCallback(async () => {
    const data = await api.get('/api/lms/course/' + slug, { auth: true });
    setCourse(data.course);
    setLessons(data.lessons || []);
    setEnrollment(data.enrollment);
    return data;
  }, [slug]);

  const loadLesson = useCallback(async (id) => {
    const data = await api.get('/api/lms/course/' + slug + '/lesson/' + id, { auth: true });
    setCurrentLesson(data.lesson);
    setCompleted(data.completed);
    setEnrollment(data.enrollment);
    return data;
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const data = await loadCourse();
        if (!data.enrollment) {
          toast.error(isAr ? 'يجب التسجيل في الدورة أولًا' : 'Enroll in the course first');
          navigate(localizedPath('/courses/' + slug, locale));
          return;
        }
      } catch {
        toast.error(isAr ? 'تعذر تحميل الدورة' : 'Unable to load course');
        navigate(localizedPath('/courses/' + slug, locale));
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, loadCourse, navigate, toast, slug, locale, isAr]);

  useEffect(() => {
    if (!ready || !lessons.length) return;
    const targetId = lessonId || lessons[0]?._id;
    if (targetId) loadLesson(targetId).catch(() => toast.error(isAr ? 'تعذر تحميل الدرس' : 'Unable to load lesson'));
  }, [ready, lessonId, lessons, loadLesson, toast, isAr]);

  const goToLesson = (id) => {
    navigate(localizedPath('/courses/' + slug + '/learn/' + id, locale));
    loadLesson(id);
  };

  const markComplete = async () => {
    if (!currentLesson) return;
    try {
      const result = await api.post(
        '/api/lms/course/' + slug + '/lesson/' + currentLesson._id + '/complete',
        { score: 100 },
        { auth: true }
      );
      setEnrollment(result.enrollment);
      setCompleted(true);
      toast.success(isAr ? 'تم حفظ إكمال الدرس' : 'Lesson completion saved');
      if (result.certificate) toast.success(isAr ? 'تم إصدار شهادة إتمام للدورة' : 'Course certificate issued');
      await loadCourse();
    } catch {
      toast.error(isAr ? 'فشل حفظ التقدم' : 'Could not save progress');
    }
  };

  const currentIndex = lessons.findIndex((lesson) => lesson._id === currentLesson?._id);
  const isLessonDone = (id) => enrollment?.progress?.completedLessons?.some((item) => item.lesson?.toString?.() === id || item.lesson === id);
  const progress = Number(enrollment?.progress?.percentage || 0);

  if (!ready || loading) {
    return <div className="min-h-screen grid place-items-center bg-[#f5f2e9]"><span className="w-9 h-9 rounded-full border-2 border-emerald-900/15 border-t-emerald-800 animate-spin" /></div>;
  }

  return (
    <div className="wn-learn-shell">
      <SEOHead page={{ url: '/courses', noindex: true, canonical: false }} />
      <aside className={'wn-learn-sidebar ' + (sidebarOpen ? '' : 'is-closed')}>
        <div className="wn-learn-sidebar__head">
          <Link to={localizedPath('/courses/' + slug, locale)} className="wn-learn-back">
            <ChevronRight size={14} />
            {isAr ? 'العودة إلى صفحة الدورة' : 'Back to course'}
          </Link>
          <h2 className="wn-learn-course-title line-clamp-2">{t(course?.title)}</h2>
          <div className="wn-learn-progress">
            <div className="wn-learn-progress__bar"><i style={{ width: Math.min(100, Math.max(0, progress)) + '%' }} /></div>
            <p>{progress}% {isAr ? 'مكتمل' : 'complete'}</p>
          </div>
        </div>

        <div className="wn-learn-lessons">
          {lessons.map((lesson, index) => (
            <button
              type="button"
              key={lesson._id}
              onClick={() => goToLesson(lesson._id)}
              className={'wn-learn-lesson ' + (currentLesson?._id === lesson._id ? 'is-active ' : '') + (isLessonDone(lesson._id) ? 'is-done' : '')}
            >
              {isLessonDone(lesson._id) ? <CheckCircle size={15} className="shrink-0" /> : <Circle size={15} className="shrink-0 opacity-40" />}
              <span className="line-clamp-2">{index + 1}. {t(lesson.title)}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="wn-learn-main">
        <header className="wn-learn-header">
          <button type="button" onClick={() => setSidebarOpen((open) => !open)} className="wn-learn-icon-btn" aria-label={isAr ? 'فتح أو إغلاق قائمة الدروس' : 'Toggle lessons'}>
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <h1 className="truncate">{t(currentLesson?.title) || (isAr ? 'مساحة التعلم' : 'Learning studio')}</h1>

          <div className="wn-learn-header__secondary flex items-center gap-2">
            <Link to={localizedPath('/student/dashboard', locale)} className="wn-learn-icon-btn" title={isAr ? 'لوحتي' : 'Dashboard'}><Home size={16} /></Link>
            <button type="button" onClick={logout} className="text-[11px] font-semibold text-[var(--wn-text-secondary)] hover:text-red-700">
              {isAr ? 'خروج' : 'Logout'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="wn-learn-content">
            <section className="wn-learn-stage">
              {currentLesson?.type === 'video' ? <VideoLesson lesson={currentLesson} locale={locale} /> : null}
              {currentLesson?.type === 'text' ? <TextLesson lesson={currentLesson} locale={locale} /> : null}
              {currentLesson?.type === 'quiz' ? <QuizLesson lesson={currentLesson} locale={locale} onComplete={markComplete} /> : null}
              {!currentLesson ? <div className="grid min-h-[240px] place-items-center text-sm text-[var(--wn-text-secondary)]">{isAr ? 'اختر درسًا من القائمة' : 'Choose a lesson from the list'}</div> : null}
            </section>

            {currentLesson?.type !== 'quiz' && currentLesson ? (
              <div className="wn-learn-nav">
                <div className="wn-learn-nav__group">
                  {currentIndex > 0 ? (
                    <button type="button" onClick={() => goToLesson(lessons[currentIndex - 1]._id)} className="wn-learn-nav-btn">
                      <ChevronRight size={15} /> {isAr ? 'السابق' : 'Previous'}
                    </button>
                  ) : null}
                  {currentIndex < lessons.length - 1 ? (
                    <button type="button" onClick={() => goToLesson(lessons[currentIndex + 1]._id)} className="wn-learn-nav-btn">
                      {isAr ? 'التالي' : 'Next'} <ChevronLeft size={15} />
                    </button>
                  ) : null}
                </div>

                {!completed ? (
                  <button type="button" onClick={markComplete} className="wn-btn wn-btn--primary">
                    <CheckCircle size={16} /> {isAr ? 'إكمال الدرس' : 'Mark complete'}
                  </button>
                ) : (
                  <span className="wn-learn-complete"><CheckCircle size={17} /> {isAr ? 'تم إكمال هذا الدرس' : 'Lesson completed'}</span>
                )}
              </div>
            ) : null}

            {enrollment?.status === 'completed' ? (
              <div className="wn-learn-certificate">
                <Award size={36} />
                <h3>{isAr ? 'أكملت الدورة' : 'Course completed'}</h3>
                {enrollment.certificate?.certificateId ? (
                  <Link to={localizedPath('/verify-certificate/' + enrollment.certificate.certificateId, locale)} className="wn-btn wn-btn--accent mt-3">
                    {isAr ? 'عرض الشهادة' : 'View certificate'}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
