import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n';
import { convertPrice, formatPrice } from '../config/currencies';
import { getMarketBySlug, resolveMarketPrefs, saveMarketPrefs } from '../lib/market';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const { locale } = useI18n();
  const [prefs, setPrefs] = useState(() => resolveMarketPrefs(locale));

  useEffect(() => {
    setPrefs((prev) => {
      const next = resolveMarketPrefs(locale);
      if (prev.marketSlug === next.marketSlug) return prev;
      return { ...prev, ...next };
    });
  }, [locale]);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem('wn_market_prefs')) return;

      let inferredSlug = '';
      if (import.meta.env.DEV && window.location.search.includes('mock_country=ID')) {
        inferredSlug = 'indonesia-malaysia';
      } else {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (/^Asia\/(?:Jakarta|Makassar|Jayapura|Pontianak|Kuala_Lumpur|Kuching)$/i.test(browserTz)) {
          inferredSlug = 'indonesia-malaysia';
        }
      }

      if (inferredSlug === 'indonesia-malaysia') {
        const next = { marketSlug: 'indonesia-malaysia', currency: 'IDR', timezone: 'Asia/Jakarta' };
        setPrefs(next);
        saveMarketPrefs(next);
      }
    } catch {
      // Ignore timezone detection failures.
    }
  }, []);

  const market = getMarketBySlug(prefs.marketSlug);

  const setMarket = useCallback((slug) => {
    const m = getMarketBySlug(slug);
    if (!m) return;
    const next = { marketSlug: slug, currency: m.currency, timezone: m.timezone };
    setPrefs(next);
    saveMarketPrefs(next);
  }, []);

  const setCurrency = useCallback((currency) => {
    setPrefs((prev) => {
      const next = { ...prev, currency };
      saveMarketPrefs(next);
      return next;
    });
  }, []);

  const setTimezone = useCallback((timezone) => {
    setPrefs((prev) => {
      const next = { ...prev, timezone };
      saveMarketPrefs(next);
      return next;
    });
  }, []);

  const displayPrice = useCallback(
    (amount, sourceCurrency = 'USD') => {
      const converted = convertPrice(amount, sourceCurrency, prefs.currency);
      const fmtLocale = locale === 'ar' ? 'ar-EG' : locale;
      return formatPrice(converted, prefs.currency, fmtLocale);
    },
    [prefs.currency, locale]
  );

  const formatDateTime = useCallback(
    (date, options = {}) => {
      const d = date instanceof Date ? date : new Date(date);
      return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : locale, {
        timeZone: prefs.timezone,
        ...options,
      }).format(d);
    },
    [locale, prefs.timezone]
  );

  return (
    <MarketContext.Provider value={{ ...prefs, market, setMarket, setCurrency, setTimezone, displayPrice, formatDateTime }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used within MarketProvider');
  return ctx;
}
