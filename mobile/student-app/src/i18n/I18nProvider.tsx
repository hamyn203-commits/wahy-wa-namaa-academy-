import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import { secureStorage } from '../lib/secureStorage';
import { AppLocale, TranslationDict, translations } from './translations';

interface I18nContextValue {
  locale: AppLocale;
  isRTL: boolean;
  t: TranslationDict;
  setLocale: (next: AppLocale) => Promise<void>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ar');

  useEffect(() => {
    let active = true;
    secureStorage.getLocale().then((stored) => {
      if (!active) return;
      if (stored === 'ar' || stored === 'en') {
        setLocaleState(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (next: AppLocale) => {
    setLocaleState(next);
    await secureStorage.setLocale(next);
    const shouldBeRTL = next === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      isRTL: locale === 'ar',
      t: translations[locale],
      setLocale,
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}
