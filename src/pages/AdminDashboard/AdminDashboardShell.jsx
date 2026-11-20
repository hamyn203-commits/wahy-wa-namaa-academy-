import {
  Activity, AlertTriangle, BookOpen, CalendarClock, CreditCard, FileText, GraduationCap, History,
  Home, LogOut, Mail, Menu, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Settings, ShieldCheck, Sparkles, TrendingUp, UserRoundCheck, Users, WalletCards, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BrandLogo from '../../components/BrandLogo';
import NotificationBell from '../../components/NotificationBell';
import ThemeToggle from '../../components/shared/ThemeToggle';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import '../../styles/dashboard-experience.css';

const NAV_GROUPS = [
  {
    id: 'command',
    ar: 'القيادة والرصد',
    en: 'Command & Insights',
    items: [
      { id: 'overview', icon: Home },
      { id: 'analytics', icon: Activity },
    ],
  },
  {
    id: 'operations',
    ar: 'التشغيل التعليمي',
    en: 'Academic Operations',
    items: [
      { id: 'teachers', icon: GraduationCap, badgeTone: 'gold' },
      { id: 'people', icon: Users },
      { id: 'sessions', icon: CalendarClock, badgeTone: 'danger' },
      { id: 'trials', icon: Sparkles, route: 'trials', badgeTone: 'gold' },
    ],
  },
  {
    id: 'finance',
    ar: 'المالية والاشتراكات',
    en: 'Finance & Subscriptions',
    items: [
      { id: 'payments', icon: CreditCard, route: 'payments', badgeTone: 'danger' },
      { id: 'subscriptions', icon: UserRoundCheck, route: 'subscriptions', badgeTone: 'gold' },
      { id: 'withdrawals', icon: WalletCards, badgeTone: 'danger' },
    ],
  },
  {
    id: 'content',
    ar: 'المحتوى والنظام',
    en: 'Content & System',
    items: [
      { id: 'messages', icon: Mail, badgeTone: 'gold' },
      { id: 'courses', icon: BookOpen },
      { id: 'growth', icon: TrendingUp },
      { id: 'blog', icon: FileText },
      { id: 'audit', icon: History },
      { id: 'system', icon: Settings },
    ],
  },
];

export default function AdminDashboardShell({
  user,
  active,
  onChange,
  onNavigate,
  onLogout,
  search,
  pageTitle = '',
  badges = {},
  statusSummary = null,
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

  const navGroups = useMemo(
    () => NAV_GROUPS.map((group) => ({
      ...group,
      title: isRTL ? group.ar : group.en,
      items: group.items.map((item) => ({
        ...item,
        label: item.id === 'system'
          ? (sh.systemNavLabel || (isRTL ? 'النظام والجاهزية' : 'System & Readiness'))
          : (sh.nav?.[item.id] || (item.id === 'analytics' ? (isRTL ? 'الزيارات والتتبع' : 'Traffic & Funnel') : item.id)),
      })),
    })),
    [sh.nav, sh.systemNavLabel, isRTL]
  );

  const flatNavItems = useMemo(
    () => navGroups.flatMap((group) => group.items),
    [navGroups]
  );

  const activeSectionTitle = pageTitle
    || flatNavItems.find((item) => item.id === active)?.label
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
    if (item.id === 'system') {
      onChange?.('system');
      return;
    }
    onChange?.(item.id);
  };

  const ToggleIcon = isRTL
    ? (collapsed ? PanelRightOpen : PanelRightClose)
    : (collapsed ? PanelLeftOpen : PanelLeftClose);

  const criticalCount = Number(statusSummary?.critical || 0);
  const pendingCount = Number(statusSummary?.totalPending || 0);

  return (
    <div className={`wn-admin-app wn-admin-calm ${collapsed ? 'is-sidebar-collapsed' : ''}`} dir={dir}>
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
            size={48}
            showText={true}
            variant="light"
            layout="vertical"
            to={roleHome}
          />
        </div>

        <div className="wn-admin-sidebar__divider" />

        <nav className="wn-admin-sidebar__nav" aria-label={sh.navAriaLabel}>
          {navGroups.map((group) => (
            <div key={group.id} className="wn-admin-sidebar__group">
              <span className="wn-admin-sidebar__group-label">{group.title}</span>
              <div className="wn-admin-sidebar__group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const selected = active === item.id;
                  const count = Number(badges?.[item.id] || 0);
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
                      <Icon size={17} aria-hidden="true" />
                      <span className="wn-admin-sidebar__label">{item.label}</span>
                      {count > 0 ? (
                        <b className={`wn-admin-sidebar__badge is-${item.badgeTone || 'gold'}`}>
                          {count > 99 ? '99+' : count}
                        </b>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="wn-admin-sidebar__profile">
          <div className="wn-admin-sidebar__avatar">{user?.name?.slice(0, 1) || sh.avatarFallback}</div>
          <div className="wn-admin-sidebar__profile-meta">
            <strong>{user?.name || sh.adminFallbackName}</strong>
            <small>{sh.roleTitle}</small>
          </div>
          <button type="button" onClick={onLogout} aria-label={sh.logout} title={sh.logout}>
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="wn-admin-stage">
        <header className="wn-admin-topbar">
          <div className="wn-admin-topbar__search">
            {search || (
              <span className="wn-admin-topbar__crumb">
                {sh.pageHeadingBrand} · <strong>{activeSectionTitle}</strong>
              </span>
            )}
          </div>
          <div className="wn-admin-topbar__actions">
            <ThemeToggle />
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
            <ToggleIcon size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="wn-admin-canvas">
          {active === 'overview' ? (
            <section className="wn-admin-welcome wn-admin-welcome--illustrated wn-admin-welcome--calm" aria-labelledby="admin-welcome-title">
              <div className="wn-admin-welcome__copy">
                <div className="wn-admin-welcome__meta-row">
                  <span className="wn-admin-welcome__eyebrow">
                    <Sparkles size={13} aria-hidden="true" /> {sh.welcomeEyebrow}
                  </span>
                  <a
                    href="#admin-executive-content"
                    className={`wn-admin-welcome__status-pill ${criticalCount > 0 ? 'is-alert' : 'is-clear'}`}
                  >
                    {criticalCount > 0 ? <AlertTriangle size={13} aria-hidden="true" /> : <ShieldCheck size={13} aria-hidden="true" />}
                    <span>
                      {criticalCount > 0
                        ? (isRTL ? `${criticalCount} أولوية عاجلة` : `${criticalCount} urgent`)
                        : pendingCount > 0
                          ? (isRTL ? `${pendingCount} مهمة للمتابعة` : `${pendingCount} to review`)
                          : (isRTL ? 'كل شيء مستقر اليوم' : 'All systems calm')}
                    </span>
                  </a>
                </div>
                <h1 id="admin-welcome-title">{sh.welcomeTitlePrefix} <em>{firstName}</em></h1>
                <p>{sh.welcomeSubtitle}</p>
              </div>
              <div className="wn-admin-welcome__actions">
                <button type="button" className="is-primary" onClick={() => onChange?.('teachers')}>
                  <GraduationCap size={16} aria-hidden="true" /> {sh.ctaTeachers}
                </button>
                <button type="button" className="is-secondary" onClick={() => onChange?.('sessions')}>
                  <CalendarClock size={16} aria-hidden="true" /> {sh.ctaSessions}
                </button>
              </div>
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
