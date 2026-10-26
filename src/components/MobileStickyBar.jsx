import { Link, useLocation } from 'react-router-dom';
import {
  Sparkles,
  MessageCircleMore,
  LayoutDashboard,
  GraduationCap,
  Layers,
  Bell,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { localizedPath, DEFAULT_LOCALE } from '../lib/locale';
import { dashboardPathForRole } from '../lib/navigation';
import { useAuth } from '../hooks/useAuth';
import { prefetchRoute } from '../lib/routePrefetch';

export default function MobileStickyBar() {
  const { locale } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const activeLocale = locale || DEFAULT_LOCALE;
  const lp = (path) => localizedPath(path, activeLocale);
  const isAr = activeLocale === 'ar';

  const isRouteActive = (targetPath) => {
    return location.pathname === targetPath || location.pathname.startsWith(targetPath + '/');
  };

  if (isAuthenticated && user?.role) {
    const roleHome = dashboardPathForRole(user.role, activeLocale);
    const personaTabsByRole = {
      student: [
        { to: roleHome, icon: LayoutDashboard, label: isAr ? 'لوحتي' : 'Dashboard' },
        { to: lp('/teachers'), icon: GraduationCap, label: isAr ? 'المعلمون' : 'Teachers' },
        { to: lp('/plans'), icon: Layers, label: isAr ? 'الباقات' : 'Plans' },
        { to: lp('/notifications'), icon: Bell, label: isAr ? 'الإشعارات' : 'Alerts' },
      ],
      guardian: [
        { to: roleHome, icon: LayoutDashboard, label: isAr ? 'الأسرة' : 'Family' },
        { to: lp('/teachers'), icon: GraduationCap, label: isAr ? 'المعلمون' : 'Teachers' },
        { to: lp('/plans'), icon: Layers, label: isAr ? 'الباقات' : 'Plans' },
        { to: lp('/notifications'), icon: Bell, label: isAr ? 'الإشعارات' : 'Alerts' },
      ],
      teacher: [
        { to: roleHome, icon: LayoutDashboard, label: isAr ? 'لوحة المعلم' : 'Dashboard' },
        { to: lp('/courses'), icon: BookOpen, label: isAr ? 'البرامج' : 'Programs' },
        { to: lp('/teachers'), icon: GraduationCap, label: isAr ? 'المعلمون' : 'Directory' },
        { to: lp('/notifications'), icon: Bell, label: isAr ? 'الإشعارات' : 'Alerts' },
      ],
      admin: [
        { to: roleHome, icon: ShieldCheck, label: isAr ? 'القيادة' : 'Admin' },
        { to: lp('/admin/payments'), icon: Layers, label: isAr ? 'المدفوعات' : 'Payments' },
        { to: lp('/admin/subscriptions'), icon: GraduationCap, label: isAr ? 'التسكين' : 'Placements' },
        { to: lp('/notifications'), icon: Bell, label: isAr ? 'الإشعارات' : 'Alerts' },
      ],
    };

    const tabs = personaTabsByRole[user.role] || personaTabsByRole.student;

    return (
      <aside
        aria-label={isAr ? 'التنقل السريع للحساب' : 'Account quick navigation'}
        className="wn-mobile-sticky"
      >
        <nav className="wn-mobile-sticky__persona-grid">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = isRouteActive(to);
            return (
              <Link
                key={to}
                to={to}
                onTouchStart={() => prefetchRoute(to)}
                onMouseEnter={() => prefetchRoute(to)}
                className={'wn-mobile-sticky__tab ' + (active ? 'is-active' : '')}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      aria-label={isAr ? 'إجراءات سريعة' : 'Quick actions'}
      className="wn-mobile-sticky"
    >
      <div className="wn-mobile-sticky__inner">
        <Link
          to={lp('/teachers')}
          onTouchStart={() => prefetchRoute('/teachers')}
          onMouseEnter={() => prefetchRoute('/teachers')}
          className="wn-mobile-sticky__secondary"
          aria-label={isAr ? 'تصفح المعلمين' : 'Browse teachers'}
          title={isAr ? 'المعلمون' : 'Teachers'}
        >
          <GraduationCap size={19} />
        </Link>
        <Link
          to={lp('/start')}
          onTouchStart={() => prefetchRoute('/start')}
          onMouseEnter={() => prefetchRoute('/start')}
          className="wn-mobile-sticky__primary"
        >
          <Sparkles size={16} />
          <span>{isAr ? 'ابدأ معنا' : 'Get started'}</span>
        </Link>
        <Link
          to={lp('/contact')}
          onTouchStart={() => prefetchRoute('/contact')}
          onMouseEnter={() => prefetchRoute('/contact')}
          className="wn-mobile-sticky__secondary"
          aria-label={isAr ? 'تواصل مع الأكاديمية' : 'Contact the academy'}
        >
          <MessageCircleMore size={20} />
        </Link>
      </div>
    </aside>
  );
}
