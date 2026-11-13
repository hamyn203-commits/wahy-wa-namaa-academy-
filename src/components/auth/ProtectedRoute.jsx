import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useI18n } from '../../i18n';
import {
  dashboardPathForRole,
  loginPathForLocale,
} from '../../lib/navigation';
import BrandLogo from '../BrandLogo';
import SEOHead from '../SEOHead';

function GuardLoader() {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <BrandLogo size={58} />
      <div className="spinner spinner-lg" />
      <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
        جاري التحقق من الجلسة...
      </span>
    </div>
  );
}

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { locale: uiLocale } = useI18n();
  const location = useLocation();
  const { locale: paramLocale } = useParams();
  const activeLocale = paramLocale || uiLocale;
  const noindexHead = (
    <SEOHead
      page={{
        title: activeLocale === 'ar' ? 'بوابة الأعضاء' : 'Member Portal',
        url: location.pathname,
        noindex: true,
        canonical: false,
      }}
    />
  );

  if (isLoading) return <>{noindexHead}<GuardLoader /></>;

  if (!isAuthenticated || !user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`${loginPathForLocale(activeLocale)}?redirect=${redirect}`} replace />;
  }

  if (roles.length && !roles.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role, activeLocale)} replace />;
  }

  return <>{noindexHead}{children}</>;
}
