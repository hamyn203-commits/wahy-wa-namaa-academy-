import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppLocale, TranslationDict, translations } from './translations';
import { secureStorage } from '../lib/secureStorage';

interface I18nContextValue {
  locale: AppLocale;
  isRTL: boolean;
  t: TranslationDict;
  setLocale: (next: AppLocale) => void;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ar');

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await secureStorage.getLocale();
      if (active && (saved === 'ar' || saved === 'en')) {
        setLocaleState(saved);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    void secureStorage.setLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: AppLocale = prev === 'ar' ? 'en' : 'ar';
      void secureStorage.setLocale(next);
      return next;
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      isRTL: locale === 'ar',
      t: translations[locale],
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
