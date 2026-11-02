import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n } from '../i18n';
import { dashboardPathForRole } from '../lib/navigation';
import { PublicChromeContext } from '../lib/publicChrome';
import { useStudentTeacherLock } from '../hooks/useStudentTeacherLock';
import DashboardLayout from './dashboard/DashboardLayout';

// Signed-in students live inside their dashboard: public marketing pages are
// replaced by the dashboard, and pages they still need (plans, payment, tutor
// profile, booking...) render inside the dashboard shell without the public
// site header/footer.

function useStudentContext() {
  const { user, isLoading, logout } = useAuth();
  const { locale: paramLocale } = useParams();
  const { locale } = useI18n();
  const activeLocale = paramLocale || locale;
  return {
    user,
    isLoading,
    logout,
    locale: activeLocale,
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

/**
 * lockPolicy:
 *  - undefined: always render in the dashboard shell
 *  - 'block': students who already chose a tutor are sent back to the dashboard
 *  - 'own-teacher': locked students may only open their own tutor (route param `id`)
 *  - 'block-unless-renewal': like 'block', but `?renew=` (same tutor renewal) stays allowed
 */
export function StudentShell({ lockPolicy, children }) {
  const { user, isLoading, logout, locale, isStudent, dashboardPath } = useStudentContext();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const needsLock = isStudent && Boolean(lockPolicy);
  const { loading: lockLoading, lock } = useStudentTeacherLock(needsLock);

  if (isLoading) return null;
  if (!isStudent) return children;
  if (needsLock && lockLoading) return null;

  if (lock) {
    const ownTeacher = lockPolicy === 'own-teacher' && String(params.id || '') === lock.teacherId;
    const renewal = lockPolicy === 'block-unless-renewal' && Boolean(searchParams.get('renew'));
    if (lockPolicy && !ownTeacher && !renewal) {
      return <Navigate to={dashboardPath} replace />;
    }
  }

  const title = locale === 'ar' ? 'لوحة الطالب' : locale === 'id' ? 'Dasbor Siswa' : 'Student Dashboard';
  return (
    <PublicChromeContext.Provider value>
      <DashboardLayout title={title} user={user} onLogout={logout}>
        <div className="wn-student-shell-page" data-testid="student-shell">{children}</div>
      </DashboardLayout>
    </PublicChromeContext.Provider>
  );
}

