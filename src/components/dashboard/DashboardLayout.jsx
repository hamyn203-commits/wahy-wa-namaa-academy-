import { useRef } from 'react';
import { Home, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import NotificationBell from '../NotificationBell';
import ThemeToggle from '../shared/ThemeToggle';
import { useI18n } from '../../i18n';
import { dashboardPathForRole } from '../../lib/navigation';
import '../../styles/dashboard-experience.css';

const GREETING_FALLBACKS = {
  ar: 'مرحبًا',
  en: 'Welcome',
  fr: 'Bienvenue',
  de: 'Willkommen',
  tr: 'Hoş geldiniz',
  ur: 'خوش آمدید',
  id: 'Halo',
  ms: 'Selamat datang',
  ku: 'بەخێربێیت',
};

const DASHBOARD_ROLE_FALLBACKS = {
  ar: {
    student: 'لوحة الطالب',
    teacher: 'لوحة المعلم',
    guardian: 'لوحة ولي الأمر',
    admin: 'لوحة الإدارة',
    supervisor: 'لوحة المشرف',
    default: 'لوحة التحكم',
  },
  en: {
    student: 'Student dashboard',
    teacher: 'Teacher dashboard',
    guardian: 'Guardian dashboard',
    admin: 'Admin dashboard',
    supervisor: 'Supervisor dashboard',
    default: 'Dashboard',
  },
  fr: {
    student: 'Tableau de bord élève',
    teacher: 'Tableau de bord enseignant',
    guardian: 'Tableau de bord tuteur',
    admin: 'Tableau de bord admin',
    supervisor: 'Tableau de bord superviseur',
    default: 'Tableau de bord',
  },
  de: {
    student: 'Schüler-Dashboard',
    teacher: 'Lehrer-Dashboard',
    guardian: 'Eltern-Dashboard',
    admin: 'Admin-Dashboard',
    supervisor: 'Betreuer-Dashboard',
    default: 'Dashboard',
  },
  tr: {
    student: 'Öğrenci Paneli',
    teacher: 'Öğretmen Paneli',
    guardian: 'Veli Paneli',
    admin: 'Yönetici Paneli',
    supervisor: 'Danışman Paneli',
    default: 'Kontrol Paneli',
  },
  ur: {
    student: 'طالب علم ڈیش بورڈ',
    teacher: 'استاد ڈیش بورڈ',
    guardian: 'سرپرست ڈیش بورڈ',
    admin: 'ایڈمن ڈیش بورڈ',
    supervisor: 'نگران ڈیش بورڈ',
    default: 'ڈیش بورڈ',
  },
  id: {
    student: 'Dasbor Siswa',
    teacher: 'Dasbor Guru',
    guardian: 'Dasbor Wali',
    admin: 'Dasbor Admin',
    supervisor: 'Dasbor Pengawas',
    default: 'Dasbor',
  },
  ms: {
    student: 'Papan Pemuka Pelajar',
    teacher: 'Papan Pemuka Guru',
    guardian: 'Papan Pemuka Penjaga',
    admin: 'Papan Pemuka Admin',
    supervisor: 'Papan Pemuka Penyelia',
    default: 'Papan Pemuka',
  },
  ku: {
    student: 'داشبۆردی خوێندکار',
    teacher: 'داشبۆردی مامۆستا',
    guardian: 'داشبۆردی سەرپەرشتیار',
    admin: 'داشبۆردی بەڕێوەبەر',
    supervisor: 'داشبۆردی سەرپەرشت',
    default: 'داشبۆرد',
  },
};

const LOGOUT_FALLBACKS = {
  ar: 'تسجيل الخروج',
  en: 'Logout',
  fr: 'Déconnexion',
  de: 'Abmelden',
  tr: 'Çıkış Yap',
  ur: 'لاگ آؤٹ',
  id: 'Keluar',
  ms: 'Log Keluar',
  ku: 'چوونەدەرەوە',
};

const TAB_NAV_FALLBACKS = {
  ar: 'التنقل داخل لوحة التحكم',
  en: 'Dashboard navigation',
  fr: 'Navigation du tableau de bord',
  de: 'Dashboard-Navigation',
  tr: 'Panel gezinmesi',
  ur: 'ڈیش بورڈ نیویگیشن',
  id: 'Navigasi dasbor',
  ms: 'Navigasi papan pemuka',
  ku: 'ڕێنیشاندەری داشبۆرد',
};

export default function DashboardLayout({ title, user, onLogout, children }) {
  const { locale, dir, isRTL, t } = useI18n();
  const roleHomeHref = dashboardPathForRole(user?.role, locale);
  const resolvedDir = dir || (isRTL ? 'rtl' : 'ltr');

  const userName = user?.name || '';
  const greetingTemplate = t?.dashboard?.greeting;
  const comma = locale === 'ar' || locale === 'ur' || locale === 'ku' ? '، ' : ', ';
  let greeting = '';
  if (userName) {
    if (typeof greetingTemplate === 'string' && greetingTemplate.includes('{name}')) {
      greeting = greetingTemplate.replace('{name}', userName);
    } else {
      const prefix = greetingTemplate || GREETING_FALLBACKS[locale] || GREETING_FALLBACKS.en;
      greeting = `${prefix}${comma}${userName}`;
    }
  }

  const roleKey = user?.role;
  const roleFallbacks = DASHBOARD_ROLE_FALLBACKS[locale] || DASHBOARD_ROLE_FALLBACKS.en;
  const websiteLabel = (roleKey && (t?.dashboard?.roles?.[roleKey] || roleFallbacks[roleKey]))
    || t?.dashboard?.home
    || t?.common?.dashboard
    || roleFallbacks.default;

  const logoutLabel = t?.dashboard?.logout
    || t?.common?.logout
    || LOGOUT_FALLBACKS[locale]
    || LOGOUT_FALLBACKS.en;

  return (
    <div className="wn-dashboard-shell" dir={resolvedDir}>
      <header className="wn-dashboard-header">
        <div className="wn-dashboard-header__bar" aria-hidden="true" />
        <div className="page-container wn-dashboard-header__inner">
          <div className="flex items-center gap-3 min-w-0">
            <div className="wn-dashboard-brand shrink-0">
              <BrandLogo size={42} to={roleHomeHref} />
            </div>
            <div className="min-w-0">
              <h1 className="wn-dashboard-title truncate">{title}</h1>
              {userName ? <p className="wn-dashboard-greeting truncate">{greeting}</p> : null}
            </div>
          </div>

          <div className="wn-dashboard-actions shrink-0 max-w-full flex-wrap justify-end">
            <ThemeToggle />
            <NotificationBell />
            <Link
              to={roleHomeHref}
              aria-label={websiteLabel}
              className="wn-dashboard-action min-h-[44px] min-w-[44px]"
            >
              <Home size={15} aria-hidden="true" />
              <span>{websiteLabel}</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              aria-label={logoutLabel}
              className="wn-dashboard-action wn-dashboard-action--danger min-h-[44px] min-w-[44px] hover:text-[var(--wn-text-danger)] hover:border-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] active:scale-[0.98]"
            >
              <LogOut size={15} aria-hidden="true" />
              <span>{logoutLabel}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page-container wn-dashboard-main">{children}</main>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="wn-stat-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="wn-stat-card__label">{label}</p>
          <p className="wn-stat-card__value">{value}</p>
        </div>
        {Icon ? (
          <div className="wn-stat-card__icon" aria-hidden="true">
            <Icon size={22} aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TabBar({ tabs = [], active, onChange, onTabChange, ariaLabel }) {
  const { locale, isRTL, t } = useI18n();
  const tabRefs = useRef([]);
  const handleSelect = onChange || onTabChange;
  const activeIndex = tabs.findIndex((tab) => tab.id === active);

  const handleKeyDown = (event, index) => {
    if (!tabs.length) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = isRTL
        ? (index - 1 + tabs.length) % tabs.length
        : (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = isRTL
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    tabRefs.current[nextIndex]?.focus();
    if (nextTab) {
      handleSelect?.(nextTab.id);
    }
  };

  return (
    <div className="wn-dashboard-tabs">
      <div
        className="wn-dashboard-tabs__row"
        role="tablist"
        aria-orientation="horizontal"
        aria-label={
          ariaLabel
          || t?.dashboard?.navigation
          || t?.common?.dashboardNavigation
          || TAB_NAV_FALLBACKS[locale]
          || TAB_NAV_FALLBACKS.en
        }
      >
        {tabs.map((tab, index) => {
          const isSelected = active === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              key={tab.id}
              id={tab.tabId || `dashboard-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={tab.panelId || undefined}
              tabIndex={isSelected || (activeIndex === -1 && index === 0) ? 0 : -1}
              onClick={() => handleSelect?.(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`wn-dashboard-tab min-h-[44px] inline-flex items-center gap-2 ${isSelected ? 'is-active' : ''}`}
            >
              {TabIcon ? <TabIcon size={16} aria-hidden="true" /> : null}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
