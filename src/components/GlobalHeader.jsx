import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { localizedPath, DEFAULT_LOCALE } from '../lib/locale';
import { Menu, X, ArrowLeft, ArrowRight, Search } from 'lucide-react';
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

function PublicGlobalHeader() {
  const { t, locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const { isAuthenticated } = useAuth();
  const { locale: paramLocale } = useParams();
  const activeLocale = paramLocale || DEFAULT_LOCALE;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const lp = (path) => localizedPath(path, activeLocale);
  const inOnboarding = isOnboardingPath(location.pathname);

  const navLinks = [
    { path: lp('/'), label: isAr ? 'الرئيسية' : 'Home' },
    { path: lp('/courses'), label: isAr ? 'البرامج والدورات' : 'Programs' },
    { path: lp('/teachers'), label: isAr ? 'معلمونا' : 'Teachers' },
    { path: lp('/about'), label: isAr ? 'عن الأكاديمية' : 'About' },
    { path: lp('/blog'), label: isAr ? 'الموارد' : 'Resources' },
    { path: lp('/contact'), label: isAr ? 'تواصل معنا' : 'Contact' },
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

          <nav className="wn-approved-header__nav" aria-label={isAr ? 'التنقل الرئيسي' : 'Main navigation'}>
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
              aria-label={isAr ? 'استكشف البرامج' : 'Explore programs'}
            >
              <Search size={19} />
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
                    <span>{isAr ? 'ابدأ رحلتك الآن' : 'Start Your Journey'}</span>
                    <ArrowIcon size={15} />
                  </Link>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="wn-approved-header__menu"
            aria-label={isMenuOpen ? (isAr ? 'إغلاق القائمة' : 'Close menu') : (isAr ? 'فتح القائمة' : 'Open menu')}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="wn-approved-mobile-menu">
            <nav className="grid gap-1">
              {navLinks.map((link) => (
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
                  className="wn-btn wn-btn--secondary wn-btn--sm"
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
                {isAr ? 'ابدأ رحلتك الآن' : 'Start Your Journey'}
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
