import {
  ArrowDown, BookOpen, CalendarClock, CreditCard, FileText, GraduationCap, History,
  Home, LogOut, Mail, Menu, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, TrendingUp, Users,
  WalletCards, X, Sparkles, UserRoundCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo';
import NotificationBell from '../../components/NotificationBell';
import { useI18n } from '../../i18n';
import { dashboardPathForRole } from '../../lib/navigation';

const NAV_ITEMS = [
  { id: 'overview', label: 'مركز القيادة', icon: Home },
  { id: 'teachers', label: 'المعلمون', icon: GraduationCap },
  { id: 'people', label: 'الطلاب والأسر', icon: Users },
  { id: 'sessions', label: 'مركز الحصص', icon: CalendarClock },
  { id: 'trials', label: 'الحصص التجريبية', icon: Sparkles, route: 'trials' },
  { id: 'payments', label: 'المدفوعات', icon: CreditCard, route: 'payments' },
  { id: 'subscriptions', label: 'الاشتراكات والتسكين', icon: UserRoundCheck, route: 'subscriptions' },
  { id: 'withdrawals', label: 'السحوبات والمالية', icon: WalletCards },
  { id: 'courses', label: 'الدورات والمحتوى', icon: BookOpen },
  { id: 'messages', label: 'الدعم والرسائل', icon: Mail },
  { id: 'growth', label: 'التحليلات والنمو', icon: TrendingUp },
  { id: 'blog', label: 'المدونة', icon: FileText },
  { id: 'audit', label: 'سجل الإدارة', icon: History },
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
  const { locale } = useI18n();
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
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'مدير الأكاديمية';
  const activeSectionTitle = NAV_ITEMS.find((item) => item.id === active)?.label
    || (active === 'system' ? 'إدارة النظام' : 'لوحة الإدارة');

  const today = useMemo(() => new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()), []);

  const selectItem = (item) => {
    setMobileOpen(false);
    if (item.route) {
      onNavigate?.(item.route);
      return;
    }
    onChange?.(item.id);
  };

  return (
    <div className={`wn-admin-app ${collapsed ? 'is-sidebar-collapsed' : ''}`} dir="rtl">
      <button
        type="button"
        className="wn-admin-mobile-toggle"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label={mobileOpen ? 'إغلاق القائمة الجانبية' : 'فتح القائمة الجانبية'}
        aria-expanded={mobileOpen}
        aria-controls="wn-admin-sidebar"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen ? <button type="button" className="wn-admin-sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" /> : null}

      <aside id="wn-admin-sidebar" className={`wn-admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
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

        <nav className="wn-admin-sidebar__nav" aria-label="أقسام لوحة الإدارة">
          {NAV_ITEMS.map((item) => {
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
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="wn-admin-sidebar__system">
          <button type="button" onClick={() => { setMobileOpen(false); onChange?.('system'); }}
            className={active === 'system' ? 'is-active' : ''}
            aria-label="النظام"
            aria-current={active === 'system' ? 'page' : undefined}
            title="النظام"
          >
            <Settings size={18} />
            <span>النظام</span>
          </button>
          <Link to={roleHome} aria-label="لوحة الإدارة" title="لوحة الإدارة" onClick={() => setMobileOpen(false)}>
            <ShieldCheck size={18} />
            <span>لوحة الإدارة</span>
          </Link>
        </div>

        <div className="wn-admin-sidebar__profile">
          <div className="wn-admin-sidebar__avatar">{user?.name?.slice(0, 1) || 'A'}</div>
          <div>
            <strong>{user?.name || 'Admin'}</strong>
            <small>مدير الأكاديمية</small>
          </div>
          <button type="button" onClick={onLogout} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="wn-admin-stage">
        <header className="wn-admin-topbar">
          <div className="wn-admin-topbar__search">{search}</div>
          <div className="wn-admin-topbar__actions">
            <NotificationBell />
            <span className="wn-admin-topbar__date">{today}</span>
            <span className="wn-admin-topbar__locale">AR</span>
          </div>
          <button
            type="button"
            className="wn-admin-topbar__sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'إظهار القائمة الجانبية' : 'إخفاء القائمة الجانبية'}
            aria-expanded={!collapsed}
            aria-controls="wn-admin-sidebar"
            title={collapsed ? 'إظهار القائمة الجانبية' : 'إخفاء القائمة الجانبية'}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </header>

        <main className="wn-admin-canvas">
          {active === 'overview' ? (
            <section className="wn-admin-welcome wn-admin-welcome--illustrated" aria-labelledby="admin-welcome-title">
              <div className="wn-admin-welcome__copy">
                <span className="wn-admin-welcome__eyebrow"><Sparkles size={15} /> وَحْيٌ وَنَمَاء · مركز القيادة</span>
                <h1 id="admin-welcome-title">مرحبًا بعودتك، <em>{firstName}</em></h1>
                <p>من هنا تبدأ رؤية أوضح لكل ما يحدث في الأكاديمية، وخطوات أسرع لما يستحق اهتمامك.</p>
                <div className="wn-admin-welcome__actions">
                  <button type="button" className="is-primary" onClick={() => onChange?.('sessions')}>
                    <CalendarClock size={17} /> متابعة الحصص
                  </button>
                  <button type="button" className="is-secondary" onClick={() => onChange?.('teachers')}>
                    <GraduationCap size={17} /> مراجعة المعلمين
                  </button>
                </div>
              </div>
              <a className="wn-admin-welcome__scroll" href="#admin-executive-content">
                استكشف لوحة التشغيل <ArrowDown size={15} />
              </a>
            </section>
          ) : (
            <section className="wn-admin-page-heading" aria-labelledby="admin-section-title">
              <span>وَحْيٌ وَنَمَاء · الإدارة</span>
              <h1 id="admin-section-title">{activeSectionTitle}</h1>
            </section>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
