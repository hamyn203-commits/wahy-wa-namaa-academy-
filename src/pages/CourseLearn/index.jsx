import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Circle,
  Award,
  Menu,
  X,
  Home,
  Loader2,
  LogOut,
} from 'lucide-react';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import VideoLesson from '../../components/lms/VideoLesson';
import TextLesson from '../../components/lms/TextLesson';
import QuizLesson from '../../components/lms/QuizLesson';
import '../../styles/learning-experience.css';

export default function CourseLearn() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const { locale, dir, isRTL, t } = useI18n();
  const { user, ready, logout } = useRequireAuth(['student', 'admin', 'teacher']);
  const toast = useToast();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth > 820 : true
  ));

  const pickText = useCallback((obj) => (
    isRTL
      ? (obj?.[locale] || obj?.ar || obj?.en || '')
      : (obj?.[locale] || obj?.en || obj?.ar || '')
  ), [locale, isRTL]);

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
    let active = true;
    (async () => {
      try {
        const data = await loadCourse();
        if (!active) return;
        if (!data.enrollment && user?.role === 'student') {
          toast.error(t.lms?.courseLearn?.enrollFirstError || 'Please enroll in the course first');
          navigate(localizedPath('/courses/' + slug, locale));
          return;
        }
      } catch {
        if (!active) return;
        toast.error(t.lms?.courseLearn?.loadCourseError || 'Unable to load course');
        navigate(localizedPath('/courses/' + slug, locale));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, loadCourse, navigate, toast, slug, locale, user?.role, t.lms?.courseLearn?.enrollFirstError, t.lms?.courseLearn?.loadCourseError]);

  useEffect(() => {
    if (!ready || !lessons.length) return;
    const targetId = lessonId || lessons[0]?._id;
    if (targetId) {
      loadLesson(targetId).catch(() => {
        toast.error(t.lms?.courseLearn?.loadLessonError || 'Unable to load lesson');
      });
    }
  }, [ready, lessonId, lessons, loadLesson, toast, t.lms?.courseLearn?.loadLessonError]);

  const goToLesson = (id) => {
    navigate(localizedPath('/courses/' + slug + '/learn/' + id, locale));
    if (typeof window !== 'undefined' && window.innerWidth <= 820) {
      setSidebarOpen(false);
    }
  };

  const markComplete = async () => {
    if (!currentLesson || completing) return;
    setCompleting(true);
    try {
      const result = await api.post(
        '/api/lms/course/' + slug + '/lesson/' + currentLesson._id + '/complete',
        { score: 100 },
        { auth: true }
      );
      setEnrollment(result.enrollment);
      setCompleted(true);
      toast.success(t.lms?.courseLearn?.lessonSaved || 'Lesson completion saved');
      if (result.certificate) {
        toast.success(t.lms?.courseLearn?.certificateIssued || 'Course certificate issued');
      }
      await loadCourse();
    } catch {
      toast.error(t.lms?.courseLearn?.completeError || t.lms?.courseLearn?.saveProgressError || 'Could not save progress');
    } finally {
      setCompleting(false);
    }
  };

  const currentIndex = lessons.findIndex((lesson) => lesson._id === currentLesson?._id);
  const isLessonDone = (id) => enrollment?.progress?.completedLessons?.some((item) => item.lesson?.toString?.() === id || item.lesson === id);
  const progress = Number(enrollment?.progress?.percentage || 0);
  const dashboardHref = dashboardPathForRole(user?.role, locale);
  const toggleLabel = t.lms?.courseLearn?.toggleLessonsAria || t.lms?.sidebarToggle || 'Toggle lessons menu';
  const BackChevron = isRTL ? ChevronRight : ChevronLeft;
  const PrevChevron = isRTL ? ChevronRight : ChevronLeft;
  const NextChevron = isRTL ? ChevronLeft : ChevronRight;

  if (!ready || loading) {
    return (
      <div className="wn-learn-shell" dir={dir} role="status" aria-live="polite">
        <span className="sr-only">{t.lms?.loading || t.common?.loading || 'Loading lesson…'}</span>
        <aside className="wn-learn-sidebar hidden md:block p-4 space-y-4" aria-hidden="true">
          <Skeleton className="h-5 w-36 bg-white/15" />
          <Skeleton className="h-7 w-full bg-white/20" />
          <Skeleton className="h-2 w-full rounded-full bg-white/15" />
          <div className="space-y-2 pt-3">
            {Array.from({ length: 5 }, (_, idx) => (
              <Skeleton key={idx} className="h-11 w-full rounded-xl bg-white/10" />
            ))}
          </div>
        </aside>
        <div className="wn-learn-main">
          <header className="wn-learn-header" aria-hidden="true">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-11 w-24 rounded-xl" />
          </header>
          <main className="wn-learn-content space-y-4" aria-hidden="true">
            <div className="wn-learn-stage space-y-4">
              <Skeleton className="h-72 w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex justify-between gap-3">
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-36 rounded-xl" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="wn-learn-shell" dir={dir}>
      <SEOHead page={{ url: '/courses', noindex: true, canonical: false }} />
      {sidebarOpen ? (
        <div
          className="wn-learn-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="wn-learn-sidebar"
        className={'wn-learn-sidebar ' + (sidebarOpen ? '' : 'is-closed')}
        aria-label={toggleLabel}
      >
        <div className="wn-learn-sidebar__head">
          <div className="flex items-center justify-between gap-2">
            <Link to={localizedPath('/courses/' + slug, locale)} className="wn-learn-back">
              <BackChevron size={14} aria-hidden="true" />
              {t.lms?.courseLearn?.backToCourse || 'Back to course'}
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              aria-label={t.common?.close || 'Close'}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <h2 className="wn-learn-course-title line-clamp-2">{pickText(course?.title)}</h2>
          <div className="wn-learn-progress">
            <div className="wn-learn-progress__bar"><i style={{ width: Math.min(100, Math.max(0, progress)) + '%' }} /></div>
            <p>{progress}% {t.lms?.courseLearn?.completePct || 'complete'}</p>
          </div>
        </div>

        <div className="wn-learn-lessons">
          {lessons.map((lesson, index) => (
            <button
              type="button"
              key={lesson._id}
              onClick={() => goToLesson(lesson._id)}
              aria-current={currentLesson?._id === lesson._id ? 'true' : undefined}
              className={'wn-learn-lesson ' + (currentLesson?._id === lesson._id ? 'is-active ' : '') + (isLessonDone(lesson._id) ? 'is-done' : '')}
            >
              {isLessonDone(lesson._id) ? (
                <CheckCircle size={15} className="shrink-0" aria-hidden="true" />
              ) : (
                <Circle size={15} className="shrink-0 opacity-40" aria-hidden="true" />
              )}
              <span className="line-clamp-2">{index + 1}. {pickText(lesson.title)}</span>
            </button>
          ))}
        </div>

        <div className="wn-learn-sidebar__mobile-actions">
          <Link
            to={dashboardHref}
            onClick={() => setSidebarOpen(false)}
            className="min-h-[44px] w-full inline-flex items-center gap-2 rounded-xl px-3 text-xs font-bold text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            <Home size={16} aria-hidden="true" />
            <span>{t.lms?.courseLearn?.dashboardTitle || t.common?.dashboard || 'Dashboard'}</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="min-h-[44px] w-full inline-flex items-center gap-2 rounded-xl px-3 text-xs font-bold text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{t.lms?.courseLearn?.logout || t.common?.logout || 'Logout'}</span>
          </button>
        </div>
      </aside>

      <div className="wn-learn-main">
        <header className="wn-learn-header">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="wn-learn-icon-btn"
            aria-label={toggleLabel}
            aria-expanded={sidebarOpen}
            aria-controls="wn-learn-sidebar"
          >
            {sidebarOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>

          <h1 className="truncate">{pickText(currentLesson?.title) || t.lms?.courseLearn?.learningStudio || 'Learning studio'}</h1>

          <div className="wn-learn-header__secondary flex items-center gap-2">
            <Link
              to={dashboardHref}
              className="wn-learn-icon-btn"
              title={t.lms?.courseLearn?.dashboardTitle || 'Dashboard'}
              aria-label={t.lms?.courseLearn?.dashboardTitle || 'Dashboard'}
            >
              <Home size={16} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] inline-flex items-center px-3 rounded-xl text-xs font-semibold text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] transition"
            >
              {t.lms?.courseLearn?.logout || t.common?.logout || 'Logout'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="wn-learn-content">
            <section className="wn-learn-stage">
              {currentLesson?.type === 'video' ? <VideoLesson lesson={currentLesson} locale={locale} courseSlug={slug} /> : null}
              {currentLesson?.type === 'text' ? <TextLesson lesson={currentLesson} locale={locale} /> : null}
              {currentLesson?.type === 'quiz' ? <QuizLesson lesson={currentLesson} locale={locale} onComplete={markComplete} /> : null}
              {!currentLesson ? (
                <div className="grid min-h-[240px] place-items-center text-sm text-[var(--wn-text-secondary)]">
                  {t.lms?.courseLearn?.chooseLesson || 'Choose a lesson from the list'}
                </div>
              ) : null}
            </section>

            {currentLesson?.type !== 'quiz' && currentLesson ? (
              <div className="wn-learn-nav">
                <div className="wn-learn-nav__group">
                  {currentIndex > 0 ? (
                    <button type="button" onClick={() => goToLesson(lessons[currentIndex - 1]._id)} className="wn-learn-nav-btn">
                      <PrevChevron size={15} aria-hidden="true" />
                      <span>{t.lms?.courseLearn?.previous || t.lms?.prevLesson || 'Previous'}</span>
                    </button>
                  ) : null}
                  {currentIndex < lessons.length - 1 ? (
                    <button type="button" onClick={() => goToLesson(lessons[currentIndex + 1]._id)} className="wn-learn-nav-btn">
                      <span>{t.lms?.courseLearn?.next || t.lms?.nextLesson || 'Next'}</span>
                      <NextChevron size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {!completed ? (
                  <button
                    type="button"
                    onClick={markComplete}
                    disabled={completing}
                    className="wn-btn wn-btn--primary min-h-[44px]"
                  >
                    {completing ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle size={16} aria-hidden="true" />
                    )}
                    <span>
                      {completing
                        ? (t.lms?.courseLearn?.completing || 'Saving…')
                        : (t.lms?.courseLearn?.markComplete || t.lms?.markComplete || 'Mark complete')}
                    </span>
                  </button>
                ) : (
                  <span className="wn-learn-complete">
                    <CheckCircle size={17} aria-hidden="true" />
                    <span>{t.lms?.courseLearn?.lessonCompleted || t.lms?.completed || 'Lesson completed'}</span>
                  </span>
                )}
              </div>
            ) : null}

            {enrollment?.status === 'completed' ? (
              <div className="wn-learn-certificate">
                <Award size={36} aria-hidden="true" />
                <h3>{t.lms?.courseLearn?.courseCompleted || 'Course completed'}</h3>
                {enrollment.certificate?.certificateId ? (
                  <Link
                    to={localizedPath('/verify-certificate/' + enrollment.certificate.certificateId, locale)}
                    className="wn-btn wn-btn--accent mt-3 min-h-[44px]"
                  >
                    {t.lms?.courseLearn?.viewCertificate || 'View certificate'}
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
