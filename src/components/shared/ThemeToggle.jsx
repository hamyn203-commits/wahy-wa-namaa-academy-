import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '../../i18n';

const THEME_LABELS = {
  ar: { light: 'التبديل للوضع الفاتح', dark: 'التبديل للوضع الليلي' },
  en: { light: 'Switch to light mode', dark: 'Switch to dark mode' },
  fr: { light: 'Passer en mode clair', dark: 'Passer en mode sombre' },
  de: { light: 'Hellen Modus aktivieren', dark: 'Dunklen Modus aktivieren' },
  tr: { light: 'Açık moda geç', dark: 'Karanlık moda geç' },
  ur: { light: 'روشن موڈ پر جائیں', dark: 'تاریک موڈ پر جائیں' },
  id: { light: 'Beralih ke mode terang', dark: 'Beralih ke mode gelap' },
  ms: { light: 'Tukar ke mod cerah', dark: 'Tukar ke mod gelap' },
  ku: { light: 'گۆڕین بۆ دۆخی ڕووناک', dark: 'گۆڕین بۆ دۆخی تاریک' },
};

export default function ThemeToggle() {
  const { locale, t } = useI18n();
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('academy_theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('academy_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  const fallbackLabels = THEME_LABELS[locale] || THEME_LABELS.en;
  const label = isDark
    ? (t?.common?.themeLight || fallbackLabels.light)
    : (t?.common?.themeDark || fallbackLabels.dark);

  return (
    <button
      type="button"
      onClick={() => setIsDark((prev) => !prev)}
      aria-pressed={isDark}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl p-2 text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] hover:bg-[var(--wn-emerald-soft)] transition focus-visible:outline-none focus-visible:[box-shadow:var(--wn-focus-ring)]"
      aria-label={label}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
