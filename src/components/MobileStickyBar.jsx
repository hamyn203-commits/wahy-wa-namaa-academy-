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
import { dashboardPathForRole, isOnboardingPath } from '../lib/navigation';
import { useAuth } from '../hooks/useAuth';
import { prefetchRoute } from '../lib/routePrefetch';

const STICKY_COPY = {
  ar: {
    dashboard: 'لوحتي',
    teachers: 'المعلمون',
    plans: 'الباقات',
    alerts: 'الإشعارات',
    family: 'الأسرة',
    teacherDash: 'لوحة المعلم',
    programs: 'البرامج',
    directory: 'المعلمون',
    admin: 'القيادة',
    payments: 'المدفوعات',
    placements: 'التسكين',
    accountNav: 'التنقل السريع للحساب',
    quickActions: 'إجراءات سريعة',
    browseTeachers: 'تصفح المعلمين',
    getStarted: 'ابدأ معنا',
    contactAcademy: 'تواصل مع الأكاديمية',
  },
  en: {
    dashboard: 'Dashboard',
    teachers: 'Teachers',
    plans: 'Plans',
    alerts: 'Alerts',
    family: 'Family',
    teacherDash: 'Dashboard',
    programs: 'Programs',
    directory: 'Directory',
    admin: 'Admin',
    payments: 'Payments',
    placements: 'Placements',
    accountNav: 'Account quick navigation',
    quickActions: 'Quick actions',
    browseTeachers: 'Browse teachers',
    getStarted: 'Get started',
    contactAcademy: 'Contact the academy',
  },
  fr: {
    dashboard: 'Tableau',
    teachers: 'Profs',
    plans: 'Formules',
    alerts: 'Alertes',
    family: 'Famille',
    teacherDash: 'Tableau',
    programs: 'Cours',
    directory: 'Annuaire',
    admin: 'Admin',
    payments: 'Paiements',
    placements: 'Groupes',
    accountNav: 'Navigation rapide du compte',
    quickActions: 'Actions rapides',
    browseTeachers: 'Parcourir les enseignants',
    getStarted: 'Commencer',
    contactAcademy: 'Contacter l’académie',
  },
  de: {
    dashboard: 'Übersicht',
    teachers: 'Lehrkräfte',
    plans: 'Tarife',
    alerts: 'Hinweise',
    family: 'Familie',
    teacherDash: 'Übersicht',
    programs: 'Kurse',
    directory: 'Verzeichnis',
    admin: 'Admin',
    payments: 'Zahlungen',
    placements: 'Zuweisung',
    accountNav: 'Kontoschnellnavigation',
    quickActions: 'Schnellaktionen',
    browseTeachers: 'Lehrkräfte ansehen',
    getStarted: 'Jetzt starten',
    contactAcademy: 'Akademie kontaktieren',
  },
  tr: {
    dashboard: 'Panel',
    teachers: 'Eğitmenler',
    plans: 'Paketler',
    alerts: 'Bildirimler',
    family: 'Aile',
    teacherDash: 'Panel',
    programs: 'Programlar',
    directory: 'Rehber',
    admin: 'Yönetim',
    payments: 'Ödemeler',
    placements: 'Yerleştirme',
    accountNav: 'Hesap hızlı gezinme',
    quickActions: 'Hızlı işlemler',
    browseTeachers: 'Eğitmenlere göz at',
    getStarted: 'Hemen başla',
    contactAcademy: 'Akademiyle iletişime geç',
  },
  ur: {
    dashboard: 'ڈیش بورڈ',
    teachers: 'اساتذہ',
    plans: 'پیکجز',
    alerts: 'اطلاعات',
    family: 'خاندان',
    teacherDash: 'استاد پینل',
    programs: 'پروگرامز',
    directory: 'اساتذہ',
    admin: 'انتظامیہ',
    payments: 'ادائیگیاں',
    placements: 'تقرری',
    accountNav: 'اکاؤنٹ فوری نیویگیشن',
    quickActions: 'فوری اقدامات',
    browseTeachers: 'اساتذہ دیکھیں',
    getStarted: 'آغاز کریں',
    contactAcademy: 'اکیڈمی سے رابطہ کریں',
  },
  id: {
    dashboard: 'Dasbor',
    teachers: 'Pengajar',
    plans: 'Paket',
    alerts: 'Notifikasi',
    family: 'Keluarga',
    teacherDash: 'Dasbor',
    programs: 'Program',
    directory: 'Direktori',
    admin: 'Admin',
    payments: 'Pembayaran',
    placements: 'Penempatan',
    accountNav: 'Navigasi cepat akun',
    quickActions: 'Aksi cepat',
    browseTeachers: 'Lihat pengajar',
    getStarted: 'Mulai sekarang',
    contactAcademy: 'Hubungi akademi',
  },
  ms: {
    dashboard: 'Papan Pemuka',
    teachers: 'Guru',
    plans: 'Pelan',
    alerts: 'Makluman',
    family: 'Keluarga',
    teacherDash: 'Papan Pemuka',
    programs: 'Program',
    directory: 'Direktori',
    admin: 'Admin',
    payments: 'Bayaran',
    placements: 'Penempatan',
    accountNav: 'Navigasi pantas akaun',
    quickActions: 'Tindakan pantas',
    browseTeachers: 'Lihat guru',
    getStarted: 'Mula sekarang',
    contactAcademy: 'Hubungi akademi',
  },
  ku: {
    dashboard: 'داشبۆرد',
    teachers: 'مامۆستایان',
    plans: 'پاکێجەکان',
    alerts: 'ئاگادارکردنەوە',
    family: 'خێزان',
    teacherDash: 'داشبۆردی مامۆستا',
    programs: 'بەرنامەکان',
    directory: 'مامۆستایان',
    admin: 'کارگێڕی',
    payments: 'پارەدانەکان',
    placements: 'دابەشکردن',
    accountNav: 'ڕێنیشاندەری خێرای هەژمار',
    quickActions: 'کردارە خێراکان',
    browseTeachers: 'گەڕان بەناو مامۆستایان',
    getStarted: 'دەستپێبکە',
    contactAcademy: 'پەیوەندی بە ئەکادیمیاوە بکە',
  },
};

export default function MobileStickyBar() {
  const { locale, isRTL, t } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const activeLocale = locale || DEFAULT_LOCALE;
  const lp = (path) => localizedPath(path, activeLocale);
  const copy = STICKY_COPY[activeLocale] || (isRTL ? STICKY_COPY.ar : STICKY_COPY.en);

  const isRouteActive = (targetPath) => {
    return location.pathname === targetPath || location.pathname.startsWith(targetPath + '/');
  };

  if (isAuthenticated && user?.role) {
    const roleHome = dashboardPathForRole(user.role, activeLocale);
    const personaTabsByRole = {
      student: [
        { to: roleHome, icon: LayoutDashboard, label: copy.dashboard },
        { to: lp('/teachers'), icon: GraduationCap, label: copy.teachers },
        { to: lp('/plans'), icon: Layers, label: t.common?.plans || copy.plans },
        { to: lp('/notifications'), icon: Bell, label: copy.alerts },
      ],
      guardian: [
        { to: roleHome, icon: LayoutDashboard, label: copy.family },
        { to: lp('/teachers'), icon: GraduationCap, label: copy.teachers },
        { to: lp('/plans'), icon: Layers, label: t.common?.plans || copy.plans },
        { to: lp('/notifications'), icon: Bell, label: copy.alerts },
      ],
      teacher: [
        { to: roleHome, icon: LayoutDashboard, label: copy.teacherDash },
        { to: lp('/courses'), icon: BookOpen, label: copy.programs },
        { to: lp('/teachers'), icon: GraduationCap, label: copy.directory },
        { to: lp('/notifications'), icon: Bell, label: copy.alerts },
      ],
      admin: [
        { to: roleHome, icon: ShieldCheck, label: copy.admin },
        { to: lp('/admin/payments'), icon: Layers, label: copy.payments },
        { to: lp('/admin/subscriptions'), icon: GraduationCap, label: copy.placements },
        { to: lp('/notifications'), icon: Bell, label: copy.alerts },
      ],
    };

    const tabs = personaTabsByRole[user.role] || personaTabsByRole.student;

    return (
      <aside
        aria-label={copy.accountNav}
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
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  // Inside the enrollment funnel the bar would cover form fields and its
  // "Get started" button only points back to the current step.
  if (isOnboardingPath(location.pathname)) return null;

  return (
    <aside
      aria-label={copy.quickActions}
      className="wn-mobile-sticky"
    >
      <div className="wn-mobile-sticky__inner">
        <Link
          to={lp('/teachers')}
          onTouchStart={() => prefetchRoute('/teachers')}
          onMouseEnter={() => prefetchRoute('/teachers')}
          className="wn-mobile-sticky__secondary"
          aria-label={t.common?.browseTeachers || copy.browseTeachers}
          title={copy.teachers}
        >
          <GraduationCap size={19} aria-hidden="true" />
        </Link>
        <Link
          to={lp('/start')}
          onTouchStart={() => prefetchRoute('/start')}
          onMouseEnter={() => prefetchRoute('/start')}
          className="wn-mobile-sticky__primary"
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>{t.common?.start || copy.getStarted}</span>
        </Link>
        <Link
          to={lp('/contact')}
          onTouchStart={() => prefetchRoute('/contact')}
          onMouseEnter={() => prefetchRoute('/contact')}
          className="wn-mobile-sticky__secondary"
          aria-label={copy.contactAcademy}
        >
          <MessageCircleMore size={20} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
