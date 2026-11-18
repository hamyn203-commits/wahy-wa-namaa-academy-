import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { localizedPath, DEFAULT_LOCALE } from '../lib/locale';
import { Menu, X, ArrowLeft, ArrowRight, Search, Compass } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import BrandLogo from './BrandLogo';
import ThemeToggle from './shared/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { prefetchRoute } from '../lib/routePrefetch';
import { isOnboardingPath } from '../lib/navigation';
import { usePublicChromeHidden } from '../lib/publicChrome';

export default function GlobalHeader() {
  const hidden = usePublicChromeHidden();
  return hidden ? null : <PublicGlobalHeader />;
}

const HEADER_COPY = {
  ar: {
    home: 'الرئيسية',
    programs: 'البرامج',
    teachers: 'معلمونا',
    plans: 'الباقات',
    about: 'عن الأكاديمية',
    contact: 'تواصل معنا',
    resources: 'الموارد',
    anchorPrograms: 'المسارات القرآنية',
    anchorPreview: 'معاينة المنصة',
    anchorFaculty: 'المعلمون المعتمدون',
    anchorHeritage: 'السند الأزهري',
    anchorCalculator: 'حاسبة الباقات',
    anchorFaq: 'الأسئلة الشائعة',
    mainNav: 'التنقل الرئيسي',
    mobileNav: 'قائمة الجوال',
    explorePrograms: 'استكشف البرامج',
    ctaStart: 'ابدأ رحلتك الآن',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    jumpLabel: 'انتقال سريع داخل الصفحة',
    onThisPage: 'أقسام الصفحة:',
    pageSectionsNav: 'أقسام الصفحة الرئيسية',
  },
  en: {
    home: 'Home',
    programs: 'Programs',
    teachers: 'Teachers',
    plans: 'Plans',
    about: 'About',
    contact: 'Contact',
    resources: 'Resources',
    anchorPrograms: 'Tracks',
    anchorPreview: 'Live Preview',
    anchorFaculty: 'Faculty',
    anchorHeritage: 'Azhari Sanad',
    anchorCalculator: 'Calculator',
    anchorFaq: 'FAQ',
    mainNav: 'Main navigation',
    mobileNav: 'Mobile navigation',
    explorePrograms: 'Explore programs',
    ctaStart: 'Start Your Journey',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    jumpLabel: 'Jump to section',
    onThisPage: 'On this page:',
    pageSectionsNav: 'Homepage sections',
  },
  fr: {
    home: 'Accueil',
    programs: 'Programmes',
    teachers: 'Enseignants',
    plans: 'Formules',
    about: 'À propos',
    contact: 'Contact',
    resources: 'Ressources',
    anchorPrograms: 'Parcours',
    anchorPreview: 'Aperçu en direct',
    anchorFaculty: 'Enseignants',
    anchorHeritage: 'Sanad d’Al-Azhar',
    anchorCalculator: 'Calculateur',
    anchorFaq: 'FAQ',
    mainNav: 'Navigation principale',
    mobileNav: 'Navigation mobile',
    explorePrograms: 'Explorer les programmes',
    ctaStart: 'Commencer maintenant',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    jumpLabel: 'Accès rapide',
    onThisPage: 'Sur cette page :',
    pageSectionsNav: 'Sections de la page',
  },
  de: {
    home: 'Startseite',
    programs: 'Programme',
    teachers: 'Lehrkräfte',
    plans: 'Tarife',
    about: 'Über uns',
    contact: 'Kontakt',
    resources: 'Ressourcen',
    anchorPrograms: 'Lernpfade',
    anchorPreview: 'Live-Vorschau',
    anchorFaculty: 'Lehrkräfte',
    anchorHeritage: 'Azhar-Sanad',
    anchorCalculator: 'Rechner',
    anchorFaq: 'FAQ',
    mainNav: 'Hauptnavigation',
    mobileNav: 'Mobile Navigation',
    explorePrograms: 'Programme entdecken',
    ctaStart: 'Jetzt starten',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    jumpLabel: 'Direkt zu Bereich',
    onThisPage: 'Auf dieser Seite:',
    pageSectionsNav: 'Startseiten-Bereiche',
  },
  tr: {
    home: 'Ana Sayfa',
    programs: 'Programlar',
    teachers: 'Eğitmenler',
    plans: 'Paketler',
    about: 'Hakkımızda',
    contact: 'İletişim',
    resources: 'Kaynaklar',
    anchorPrograms: 'Yollar',
    anchorPreview: 'Canlı Önizleme',
    anchorFaculty: 'Eğitmenler',
    anchorHeritage: 'Ezher Senedi',
    anchorCalculator: 'Hesaplayıcı',
    anchorFaq: 'SSS',
    mainNav: 'Ana gezinme',
    mobileNav: 'Mobil menü',
    explorePrograms: 'Programları keşfet',
    ctaStart: 'Yolculuğa Başla',
    openMenu: 'Menüyü aç',
    closeMenu: 'Menüyü kapat',
    jumpLabel: 'Bölüme git',
    onThisPage: 'Bu sayfada:',
    pageSectionsNav: 'Ana sayfa bölümleri',
  },
  ur: {
    home: 'مرکزی صفحہ',
    programs: 'پروگرامز',
    teachers: 'اساتذہ',
    plans: 'پیکجز',
    about: 'تعارف',
    contact: 'رابطہ',
    resources: 'وسائل',
    anchorPrograms: 'قرآنی راستے',
    anchorPreview: 'لائیو پیش منظر',
    anchorFaculty: 'مستند اساتذہ',
    anchorHeritage: 'ازہری سند',
    anchorCalculator: 'کیلکولیٹر',
    anchorFaq: 'سوالات',
    mainNav: 'مرکزی نیویگیشن',
    mobileNav: 'موبائل مینو',
    explorePrograms: 'پروگرام دیکھیں',
    ctaStart: 'سفر شروع کریں',
    openMenu: 'مینو کھولیں',
    closeMenu: 'مینو بند کریں',
    jumpLabel: 'فوری منتقلی',
    onThisPage: 'اس صفحے پر:',
    pageSectionsNav: 'مرکزی صفحے کے حصے',
  },
  id: {
    home: 'Beranda',
    programs: 'Program',
    teachers: 'Pengajar',
    plans: 'Paket',
    about: 'Tentang',
    contact: 'Kontak',
    resources: 'Sumber',
    anchorPrograms: 'Jalur Belajar',
    anchorPreview: 'Pratinjau Langsung',
    anchorFaculty: 'Pengajar',
    anchorHeritage: 'Sanad Al-Azhar',
    anchorCalculator: 'Kalkulator',
    anchorFaq: 'FAQ',
    mainNav: 'Navigasi utama',
    mobileNav: 'Navigasi seluler',
    explorePrograms: 'Jelajahi program',
    ctaStart: 'Mulai Perjalanan',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    jumpLabel: 'Lompat ke bagian',
    onThisPage: 'Di halaman ini:',
    pageSectionsNav: 'Bagian beranda',
  },
  ms: {
    home: 'Utama',
    programs: 'Program',
    teachers: 'Guru',
    plans: 'Pelan',
    about: 'Tentang',
    contact: 'Hubungi',
    resources: 'Sumber',
    anchorPrograms: 'Laluan Belajar',
    anchorPreview: 'Pratonton Langsung',
    anchorFaculty: 'Guru',
    anchorHeritage: 'Sanad Al-Azhar',
    anchorCalculator: 'Kalkulator',
    anchorFaq: 'Soalan Lazim',
    mainNav: 'Navigasi utama',
    mobileNav: 'Navigasi mudah alih',
    explorePrograms: 'Teroka program',
    ctaStart: 'Mulakan Perjalanan',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    jumpLabel: 'Lompat ke bahagian',
    onThisPage: 'Di halaman ini:',
    pageSectionsNav: 'Bahagian halaman utama',
  },
  ku: {
    home: 'سەرەکی',
    programs: 'بەرنامەکان',
    teachers: 'مامۆستایان',
    plans: 'پاکێجەکان',
    about: 'دەربارە',
    contact: 'پەیوەندی',
    resources: 'سەرچاوەکان',
    anchorPrograms: 'ڕێچکەکان',
    anchorPreview: 'پێشبینینی ڕاستەوخۆ',
    anchorFaculty: 'مامۆستایان',
    anchorHeritage: 'سەنەدی ئەزهەر',
    anchorCalculator: 'ژمێریار',
    anchorFaq: 'پرسیارە باوەکان',
    mainNav: 'ڕێنیشاندەری سەرەکی',
    mobileNav: 'مینیوی مۆبایل',
    explorePrograms: 'گەڕان بەناو بەرنامەکان',
    ctaStart: 'گەشتەکەت دەستپێبکە',
    openMenu: 'کردنەوەی مینیو',
    closeMenu: 'داخستنی مینیو',
    jumpLabel: 'بازدان بۆ بەش',
    onThisPage: 'لەم پەڕەیەدا:',
    pageSectionsNav: 'بەشەکانی پەڕەی سەرەکی',
  },
};

function PublicGlobalHeader() {
  const { t, locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const { isAuthenticated } = useAuth();
  const { locale: paramLocale } = useParams();
  const activeLocale = paramLocale || locale || DEFAULT_LOCALE;
  const copy = HEADER_COPY[activeLocale] || (isRTL ? HEADER_COPY.ar : HEADER_COPY.en);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const lp = (path) => localizedPath(path, activeLocale);
  const inOnboarding = isOnboardingPath(location.pathname);
  const isHome = (
    location.pathname === '/'
    || location.pathname === lp('/')
    || location.pathname === `/${activeLocale}/`
  );

  const navLinks = [
    { path: lp('/'), label: t.common?.home || copy.home },
    { path: lp('/courses'), label: copy.programs },
    { path: lp('/teachers'), label: copy.teachers },
    { path: lp('/plans'), label: t.common?.plans || copy.plans },
    { path: lp('/about'), label: t.common?.about || copy.about },
    { path: lp('/contact'), label: copy.contact },
  ];

  const mobileNavLinks = [
    ...navLinks,
    { path: lp('/blog'), label: copy.resources },
  ];

  const homeAnchors = [
    { href: '#programs', label: copy.anchorPrograms },
    { href: '#learning-tools', label: copy.anchorPreview },
    { href: '#faculty', label: copy.anchorFaculty },
    { href: '#azhar-heritage', label: copy.anchorHeritage },
    { href: '#pricing-calculator', label: copy.anchorCalculator },
    { href: '#faq', label: copy.anchorFaq },
  ];

  const isActive = (path) => {
    if (path === lp('/') || path === '/' + activeLocale || path === '/' + activeLocale + '/') {
      return location.pathname === path || location.pathname === '/' + activeLocale;
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <header className="wn-approved-header">
      <div className="page-container">
        <div className="wn-approved-header__row">
          <BrandLogo to={lp('/')} size={52} />

          <nav className="wn-approved-header__nav" aria-label={copy.mainNav}>
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onMouseEnter={() => prefetchRoute(link.path)}
                onFocus={() => prefetchRoute(link.path)}
                onTouchStart={() => prefetchRoute(link.path)}
                className={'wn-approved-header__link ' + (isActive(link.path) ? 'is-active' : '')}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="wn-approved-header__actions">
            <Link
              to={lp('/courses')}
              onMouseEnter={() => prefetchRoute('/courses')}
              onFocus={() => prefetchRoute('/courses')}
              className="wn-approved-header__icon"
              aria-label={copy.explorePrograms}
            >
              <Search size={19} aria-hidden="true" />
            </Link>
            <ThemeToggle />
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <NotificationBell />
                <UserMenu locale={activeLocale} />
              </>
            ) : (
              <>
                <Link
                  to={lp('/login')}
                  onMouseEnter={() => prefetchRoute('/login')}
                  onFocus={() => prefetchRoute('/login')}
                  className="wn-approved-header__login"
                >
                  {t.common.login}
                </Link>
                {!inOnboarding && (
                  <Link
                    to={lp('/start')}
                    onMouseEnter={() => prefetchRoute('/start')}
                    onFocus={() => prefetchRoute('/start')}
                    className="wn-approved-header__cta"
                  >
                    <span>{t.hero?.cta1 || copy.ctaStart}</span>
                    <ArrowIcon size={15} aria-hidden="true" />
                  </Link>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="wn-approved-header__menu"
            aria-label={isMenuOpen ? (t.common?.closeMenu || copy.closeMenu) : (t.common?.openMenu || copy.openMenu)}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="wn-approved-mobile-menu">
            <nav className="grid gap-1" aria-label={copy.mobileNav}>
              {mobileNavLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onTouchStart={() => prefetchRoute(link.path)}
                  onClick={() => setIsMenuOpen(false)}
                  className={'wn-approved-mobile-menu__link ' + (isActive(link.path) ? 'is-active' : '')}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {isHome && (
              <div className="wn-mobile-quick-jumps">
                <span className="wn-mobile-quick-jumps__label">
                  <Compass size={14} aria-hidden="true" />
                  {copy.jumpLabel}
                </span>
                <div className="wn-mobile-quick-jumps__chips">
                  {homeAnchors.map((anchor) => (
                    <a
                      key={anchor.href}
                      href={anchor.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="wn-mobile-quick-jumps__chip"
                    >
                      {anchor.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="wn-approved-mobile-menu__tools">
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
              {!isAuthenticated && (
                <Link
                  to={lp('/login')}
                  onTouchStart={() => prefetchRoute('/login')}
                  onClick={() => setIsMenuOpen(false)}
                  className="wn-btn wn-btn--secondary"
                >
                  {t.common.login}
                </Link>
              )}
            </div>

            {!isAuthenticated && !inOnboarding && (
              <Link
                to={lp('/start')}
                onTouchStart={() => prefetchRoute('/start')}
                onClick={() => setIsMenuOpen(false)}
                className="wn-btn wn-btn--primary wn-btn--block"
              >
                {t.hero?.cta1 || copy.ctaStart}
              </Link>
            )}
          </div>
        )}
      </div>

      {isHome && (
        <div className="wn-header-subnav">
          <div className="page-container wn-header-subnav__inner">
            <span className="wn-header-subnav__eyebrow">
              <Compass size={13} aria-hidden="true" />
              {copy.onThisPage}
            </span>
            <nav className="wn-header-subnav__links" aria-label={copy.pageSectionsNav}>
              {homeAnchors.map((anchor) => (
                <a key={anchor.href} href={anchor.href} className="wn-header-subnav__link">
                  {anchor.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
