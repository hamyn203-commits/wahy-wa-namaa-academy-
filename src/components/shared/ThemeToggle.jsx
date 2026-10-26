import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function ThemeToggle() {
  const { locale } = useI18n();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('academy_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('academy_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl p-2 text-[var(--wn-text-secondary)] hover:text-[var(--wn-emerald-deep)] hover:bg-[var(--wn-emerald-soft)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
      aria-label={
        isDark
          ? (locale === 'ar' ? 'التبديل للوضع الفاتح' : locale === 'tr' ? 'Açık moda geç' : locale === 'id' || locale === 'ms' ? 'Beralih ke mode terang' : locale === 'ur' ? 'روشن موڈ پر جائیں' : locale === 'fr' ? 'Passer en mode clair' : locale === 'de' ? 'Hellen Modus aktivieren' : 'Switch to light mode')
          : (locale === 'ar' ? 'التبديل للوضع الليلي' : locale === 'tr' ? 'Karanlık moda geç' : locale === 'id' || locale === 'ms' ? 'Beralih ke mode gelap' : locale === 'ur' ? 'تاریک موڈ پر جائیں' : locale === 'fr' ? 'Passer en mode sombre' : locale === 'de' ? 'Dunklen Modus aktivieren' : 'Switch to dark mode')
      }
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
