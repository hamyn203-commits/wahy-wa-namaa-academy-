import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import ar from './ar';
import en from './en';
import fr from './fr';
import de from './de';
import tr from './tr';
import ur from './ur';
import id from './id';
import ms from './ms';
import ku from './ku';
import { detectBrowserLocale } from '../lib/locale';

const I18nContext = createContext();

const translations = { ar, en, fr, de, tr, ur, id, ms, ku };

// اللغات التي تكتب من اليمين لليسار
const rtlLanguages = ['ar', 'ur', 'ku'];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeTwoDicts(primary, secondary) {
  if (!isPlainObject(secondary)) {
    return primary !== undefined ? primary : secondary;
  }
  const result = { ...secondary };
  if (!isPlainObject(primary)) {
    return result;
  }
  for (const [key, value] of Object.entries(primary)) {
    if (isPlainObject(value) && isPlainObject(secondary[key])) {
      result[key] = mergeTwoDicts(value, secondary[key]);
    } else if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

export function deepFallback(activeDict, fallbackEn = en, fallbackAr = ar) {
  const baseWithAr = mergeTwoDicts(fallbackEn, fallbackAr);
  return mergeTwoDicts(activeDict, baseWithAr);
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    const saved = localStorage.getItem('locale');
    if (saved && translations[saved]) return saved;
    return detectBrowserLocale();
  });

  useEffect(() => {
    localStorage.setItem('locale', locale);
    document.documentElement.dir = rtlLanguages.includes(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const isRTL = rtlLanguages.includes(locale);
  const dir = isRTL ? 'rtl' : 'ltr';

  const t = useMemo(() => {
    const active = translations[locale] || ar;
    if (locale === 'ar') return mergeTwoDicts(ar, en);
    if (isRTL) return deepFallback(active, ar, en);
    return deepFallback(active, en, ar);
  }, [locale, isRTL]);

  const changeLocale = (newLocale) => {
    if (translations[newLocale]) {
      setLocale(newLocale);
    }
  };

  return (
    <I18nContext.Provider value={{ locale, t, changeLocale, isRTL, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
