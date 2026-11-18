import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { localizedLocation } from '../lib/locale';
import { Check, Globe, ChevronDown } from 'lucide-react';

const languages = [
  { code: 'ar', iso: 'AR', name: 'العربية' },
  { code: 'en', iso: 'EN', name: 'English' },
  { code: 'fr', iso: 'FR', name: 'Français' },
  { code: 'de', iso: 'DE', name: 'Deutsch' },
  { code: 'tr', iso: 'TR', name: 'Türkçe' },
  { code: 'ur', iso: 'UR', name: 'اردو' },
  { code: 'id', iso: 'ID', name: 'Indonesia' },
  { code: 'ku', iso: 'KU', name: 'کوردی' },
  { code: 'ms', iso: 'MS', name: 'Melayu' },
];

export default function LanguageSwitcher() {
  const { locale, changeLocale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        const items = itemRefs.current.filter(Boolean);
        if (!items.length) return;
        event.preventDefault();
        const activeIndex = items.indexOf(document.activeElement);
        let nextIndex = 0;
        if (event.key === 'ArrowDown') {
          nextIndex = activeIndex >= 0 ? (activeIndex + 1) % items.length : 0;
        } else if (event.key === 'ArrowUp') {
          nextIndex = activeIndex >= 0 ? (activeIndex - 1 + items.length) % items.length : items.length - 1;
        } else if (event.key === 'End') {
          nextIndex = items.length - 1;
        }
        items[nextIndex]?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLanguageChange = (langCode) => {
    changeLocale(langCode);
    navigate(localizedLocation(location.pathname, langCode, location.search, location.hash));
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
      requestAnimationFrame(() => {
        const currentIndex = languages.findIndex((lang) => lang.code === locale);
        const targetIndex = currentIndex >= 0 ? currentIndex : 0;
        itemRefs.current[targetIndex]?.focus();
      });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:bg-[var(--wn-emerald-soft)] hover:border-[var(--wn-emerald)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
        aria-label={t.common.language}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <Globe size={17} aria-hidden="true" className="shrink-0 text-[var(--wn-heading)]" />
        <span className="inline-flex items-center justify-center rounded-md bg-[var(--wn-emerald-soft)] px-1.5 py-0.5 text-xs font-bold tracking-wide text-[var(--wn-heading)]">
          {currentLanguage.iso}
        </span>
        <span className="text-sm font-medium">{currentLanguage.name}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-[var(--wn-text-secondary)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={t.common.language}
          className="absolute end-0 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] py-1.5 shadow-xl z-50 overflow-hidden"
        >
          {languages.map((lang, index) => {
            const isSelected = locale === lang.code;
            return (
              <button
                key={lang.code}
                ref={(el) => { itemRefs.current[index] = el; }}
                type="button"
                role="menuitem"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => handleLanguageChange(lang.code)}
                className={`min-h-[44px] w-full px-3.5 py-2.5 text-start transition-colors flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:bg-[var(--wn-emerald-soft)] ${
                  isSelected
                    ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] font-semibold'
                    : 'text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-sunken)]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex min-w-[2.1rem] items-center justify-center rounded-md border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-1.5 py-0.5 text-xs font-bold tracking-wide text-[var(--wn-heading)]">
                    {lang.iso}
                  </span>
                  <span className="text-sm font-medium truncate">{lang.name}</span>
                </span>
                {isSelected && (
                  <Check size={16} aria-hidden="true" className="shrink-0 text-[var(--wn-heading)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}