import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import ar from './ar.js';
import { detectBrowserLocale, isValidLocale, RTL_LOCALES } from '../lib/locale';

const I18nContext = createContext();

const localeLoaders = {
  en: () => import('./en.js'),
  fr: () => import('./fr.js'),
  de: () => import('./de.js'),
  tr: () => import('./tr.js'),
  ur: () => import('./ur.js'),
  id: () => import('./id.js'),
  ms: () => import('./ms.js'),
  ku: () => import('./ku.js'),
};

const loadedDictionaries = { ar };
const inflightLoads = new Map();

function loadLocaleDictionary(localeCode) {
  if (loadedDictionaries[localeCode]) {
    return Promise.resolve(loadedDictionaries[localeCode]);
  }
  const loader = localeLoaders[localeCode];
  if (!loader) {
    return Promise.resolve(ar);
  }
  if (!inflightLoads.has(localeCode)) {
    const promise = loader()
      .then((mod) => {
        const dict = mod?.default || ar;
        loadedDictionaries[localeCode] = dict;
        inflightLoads.delete(localeCode);
        return dict;
      })
      .catch((err) => {
        inflightLoads.delete(localeCode);
        throw err;
      });
    inflightLoads.set(localeCode, promise);
  }
  return inflightLoads.get(localeCode);
}

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

export function deepFallback(activeDict, fallbackEn = loadedDictionaries.en || ar, fallbackAr = ar) {
  const baseWithAr = mergeTwoDicts(fallbackEn, fallbackAr);
  return mergeTwoDicts(activeDict, baseWithAr);
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage?.getItem('locale') : null;
    if (saved && isValidLocale(saved)) return saved;
    return detectBrowserLocale();
  });

  const [dictionaries, setDictionaries] = useState(() => ({ ...loadedDictionaries }));

  useEffect(() => {
    localStorage.setItem('locale', locale);
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const cached = loadedDictionaries[locale];
    if (cached) {
      setDictionaries((prev) => (prev[locale] === cached ? prev : { ...prev, [locale]: cached }));
      return undefined;
    }

    let cancelled = false;
    loadLocaleDictionary(locale)
      .then((dict) => {
        if (!cancelled && dict) {
          setDictionaries((prev) => (prev[locale] === dict ? prev : { ...prev, [locale]: dict }));
        }
      })
      .catch(() => {
        // Keep synchronous base dictionary (`ar`) active if dynamic locale chunk fails to load.
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const isRTL = RTL_LOCALES.includes(locale);
  const dir = isRTL ? 'rtl' : 'ltr';

  const t = useMemo(() => {
    const fallbackEn = dictionaries.en || ar;
    if (locale === 'ar') return mergeTwoDicts(ar, fallbackEn);
    const active = dictionaries[locale] || (!isRTL ? fallbackEn : ar);
    if (isRTL) return deepFallback(active, ar, fallbackEn);
    return deepFallback(active, fallbackEn, ar);
  }, [locale, isRTL, dictionaries]);

  const changeLocale = useCallback((newLocale) => {
    if (isValidLocale(newLocale)) {
      loadLocaleDictionary(newLocale).catch(() => {});
      setLocale(newLocale);
    }
  }, []);

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
