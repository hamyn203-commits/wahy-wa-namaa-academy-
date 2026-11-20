import {
  Activity, ArrowDown, BookOpen, CalendarClock, CreditCard, FileText, GraduationCap, History,
  Home, LogOut, Mail, Menu, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Settings, ShieldCheck, TrendingUp, Users, WalletCards, X, Sparkles, UserRoundCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';
import NotificationBell from '../../components/NotificationBell';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';

const NAV_ITEMS = [
  { id: 'overview', icon: Home },
  { id: 'analytics', icon: Activity },
  { id: 'teachers', icon: GraduationCap },
  { id: 'people', icon: Users },
  { id: 'sessions', icon: CalendarClock },
  { id: 'trials', icon: Sparkles, route: 'trials' },
  { id: 'payments', icon: CreditCard, route: 'payments' },
  { id: 'subscriptions', icon: UserRoundCheck, route: 'subscriptions' },
  { id: 'withdrawals', icon: WalletCards },
  { id: 'courses', icon: BookOpen },
  { id: 'messages', icon: Mail },
  { id: 'growth', icon: TrendingUp },
  { id: 'blog', icon: FileText },
  { id: 'audit', icon: History },
];

export default function AdminDashboardShell({
  user,
  active,
  onChange,
  onNavigate,
  onLogout,
  search,
  children,
}) {
  const { locale, dir, isRTL, t } = useI18n();
  const sh = t.adminPortal.shell;
  const intlLocale = resolveIntlLocale(locale);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined'
        && window.localStorage.getItem('wn-admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('wn-admin-sidebar-collapsed', String(collapsed));
    } catch {
      // The control remains usable when browser storage is disabled.
    }
  }, [collapsed]);

  const roleHome = dashboardPathForRole('admin', locale);
  const firstName = user?.name?.trim().split(/\s+/)[0] || sh.adminFallbackName;
  const navItems = useMemo(
    () => NAV_ITEMS.map((item) => ({
      ...item,
      label: sh.nav?.[item.id] || (item.id === 'analytics' ? (isRTL ? 'الزيارات والتتبع' : 'Traffic & Funnel') : item.id),
    })),
    [sh.nav, isRTL]
  );
  const activeSectionTitle = navItems.find((item) => item.id === active)?.label
    || (active === 'system' ? sh.systemSectionTitle : sh.defaultSectionTitle);

  const today = useMemo(() => new Intl.DateTimeFormat(intlLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()), [intlLocale]);

  const selectItem = (item) => {
    setMobileOpen(false);
    if (item.route) {
      onNavigate?.(item.route);
      return;
    }
    onChange?.(item.id);
  };

  const ToggleIcon = isRTL
    ? (collapsed ? PanelRightOpen : PanelRightClose)
    : (collapsed ? PanelLeftOpen : PanelLeftClose);

  return (
    <div className={`wn-admin-app ${collapsed ? 'is-sidebar-collapsed' : ''}`} dir={dir}>
      <button
        type="button"
        className="wn-admin-mobile-toggle"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label={mobileOpen ? sh.toggleMobileClose : sh.toggleMobileOpen}
        aria-expanded={mobileOpen}
        aria-controls="wn-admin-sidebar"
      >
        {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>

      {mobileOpen ? (
        <button type="button" className="wn-admin-sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label={sh.closeScrim} />
      ) : null}

      <aside id="wn-admin-sidebar" className={`wn-admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="wn-admin-sidebar__close"
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
            } else {
              setCollapsed(true);
            }
          }}
          aria-label={sh.toggleSidebarHide || (isRTL ? 'إخفاء القائمة الجانبية' : 'Hide sidebar')}
          title={sh.toggleSidebarHide || (isRTL ? 'إخفاء القائمة الجانبية' : 'Hide sidebar')}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="wn-admin-sidebar__brand">
          <BrandLogo
            size={58}
            showText={true}
            variant="light"
            layout="vertical"
            to={roleHome}
          />
        </div>

        <div className="wn-admin-sidebar__divider" />

        <nav className="wn-admin-sidebar__nav" aria-label={sh.navAriaLabel}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = !item.route && active === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => selectItem(item)}
                className={selected ? 'is-active' : ''}
                aria-current={selected ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="wn-admin-sidebar__system">
          <button
            type="button"
            onClick={() => { setMobileOpen(false); onChange?.('system'); }}
            className={active === 'system' ? 'is-active' : ''}
            aria-label={sh.systemNavLabel}
            aria-current={active === 'system' ? 'page' : undefined}
            title={sh.systemNavLabel}
          >
            <Settings size={18} aria-hidden="true" />
            <span>{sh.systemNavLabel}</span>
          </button>
          <Link to={roleHome} aria-label={sh.adminLink} title={sh.adminLink} onClick={() => setMobileOpen(false)}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{sh.adminLink}</span>
          </Link>
        </div>

        <div className="wn-admin-sidebar__profile">
          <div className="wn-admin-sidebar__avatar">{user?.name?.slice(0, 1) || sh.avatarFallback}</div>
          <div>
            <strong>{user?.name || sh.adminFallbackName}</strong>
            <small>{sh.roleTitle}</small>
          </div>
          <button type="button" onClick={onLogout} aria-label={sh.logout} title={sh.logout}>
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="wn-admin-stage">
        <header className="wn-admin-topbar">
          <div className="wn-admin-topbar__search">{search}</div>
          <div className="wn-admin-topbar__actions">
            <NotificationBell />
            <span className="wn-admin-topbar__date">{today}</span>
            <span className="wn-admin-topbar__locale">{locale.toUpperCase()}</span>
          </div>
          <button
            type="button"
            className="wn-admin-topbar__sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? sh.toggleSidebarShow : sh.toggleSidebarHide}
            aria-expanded={!collapsed}
            aria-controls="wn-admin-sidebar"
            title={collapsed ? sh.toggleSidebarShow : sh.toggleSidebarHide}
          >
            <ToggleIcon size={19} aria-hidden="true" />
          </button>
        </header>

        <main className="wn-admin-canvas">
          {active === 'overview' ? (
            <section className="wn-admin-welcome wn-admin-welcome--illustrated" aria-labelledby="admin-welcome-title">
              <div className="wn-admin-welcome__copy">
                <span className="wn-admin-welcome__eyebrow"><Sparkles size={15} aria-hidden="true" /> {sh.welcomeEyebrow}</span>
                <h1 id="admin-welcome-title">{sh.welcomeTitlePrefix} <em>{firstName}</em></h1>
                <p>{sh.welcomeSubtitle}</p>
                <div className="wn-admin-welcome__actions">
                  <button type="button" className="is-primary" onClick={() => onChange?.('sessions')}>
                    <CalendarClock size={17} aria-hidden="true" /> {sh.ctaSessions}
                  </button>
                  <button type="button" className="is-secondary" onClick={() => onChange?.('teachers')}>
                    <GraduationCap size={17} aria-hidden="true" /> {sh.ctaTeachers}
                  </button>
                </div>
              </div>
              <a className="wn-admin-welcome__scroll" href="#admin-executive-content">
                {sh.scrollLabel} <ArrowDown size={15} aria-hidden="true" />
              </a>
            </section>
          ) : (
            <section className="wn-admin-page-heading" aria-labelledby="admin-section-title">
              <span>{sh.pageHeadingBrand}</span>
              <h1 id="admin-section-title">{activeSectionTitle}</h1>
            </section>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
