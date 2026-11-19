import { useEffect } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n } from '../i18n';
import { dashboardPathForRole } from '../lib/navigation';
import { PublicChromeContext } from '../lib/publicChrome';
import { useStudentTeacherLock } from '../hooks/useStudentTeacherLock';
import { prefetchTeacherBundle } from '../lib/teacherProfileCache';
import DashboardLayout from './dashboard/DashboardLayout';
import Skeleton from './shared/Skeleton';

// Signed-in students live inside their dashboard: public marketing pages are
// replaced by the dashboard, and pages they still need (plans, payment, tutor
// profile, booking...) render inside the dashboard shell without the public
// site header/footer.

function useStudentContext() {
  const { user, isLoading, logout } = useAuth();
  const { locale: paramLocale } = useParams();
  const { locale, t } = useI18n();
  const activeLocale = paramLocale || locale;
  return {
    user,
    isLoading,
    logout,
    locale: activeLocale,
    t,
    isStudent: user?.role === 'student',
    dashboardPath: dashboardPathForRole('student', activeLocale),
  };
}

function withTab(path, tab) {
  return tab ? `${path}?tab=${encodeURIComponent(tab)}` : path;
}

export function StudentPublicRedirect({ tab, children }) {
  const { isLoading, isStudent, dashboardPath } = useStudentContext();
  if (isLoading) return null;
  if (isStudent) return <Navigate to={withTab(dashboardPath, tab)} replace />;
  return children;
}

function StudentShellLoadingSkeleton({ isStudent, title, user, onLogout, loadingLabel }) {
  const skeletonBody = (
    <div className="page-container py-8 space-y-5" role="status" aria-live="polite">
      <span className="sr-only">{loadingLabel}</span>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );

  if (isStudent) {
    return (
      <PublicChromeContext.Provider value>
        <DashboardLayout title={title} user={user} onLogout={onLogout}>
          <div className="wn-student-shell-page">{skeletonBody}</div>
        </DashboardLayout>
      </PublicChromeContext.Provider>
    );
  }

  return <main className="min-h-[60vh]">{skeletonBody}</main>;
}

/**
 * lockPolicy:
 *  - undefined: always render in the dashboard shell
 *  - 'block': students who already chose a tutor are sent back to the dashboard
 *  - 'own-teacher': locked students may only open their own tutor (route param `id`)
 *  - 'block-unless-renewal': like 'block', but `?renew=` (same tutor renewal) stays allowed
 */
export function StudentShell({ lockPolicy, children }) {
  const { user, isLoading, logout, t, isStudent, dashboardPath } = useStudentContext();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const needsLock = isStudent && Boolean(lockPolicy);
  const { loading: lockLoading, lock } = useStudentTeacherLock(needsLock);

  // Warm the teacher bundle immediately instead of waiting for auth/lock round-trips.
  useEffect(() => {
    if (lockPolicy === 'own-teacher' && params.id) {
      prefetchTeacherBundle(params.id);
    }
  }, [lockPolicy, params.id]);

  const title = t?.student?.shellTitle || t?.student?.dashboardTitle || 'Student Dashboard';
  const loadingLabel = t?.common?.loading || 'Loading…';

  if (isLoading || (needsLock && lockLoading)) {
    return (
      <StudentShellLoadingSkeleton
        isStudent={isStudent}
        title={title}
        user={user}
        onLogout={logout}
        loadingLabel={loadingLabel}
      />
    );
  }
  if (!isStudent) return children;

  if (lock) {
    const ownTeacher = lockPolicy === 'own-teacher' && String(params.id || '') === lock.teacherId;
    const renewal = lockPolicy === 'block-unless-renewal' && Boolean(searchParams.get('renew'));
    if (lockPolicy && !ownTeacher && !renewal) {
      return <Navigate to={dashboardPath} replace />;
    }
  }

  return (
    <PublicChromeContext.Provider value>
      <DashboardLayout title={title} user={user} onLogout={logout}>
        <div className="wn-student-shell-page" data-testid="student-shell">{children}</div>
      </DashboardLayout>
    </PublicChromeContext.Provider>
  );
}
