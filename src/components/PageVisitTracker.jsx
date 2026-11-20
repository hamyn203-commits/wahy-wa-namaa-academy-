import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { trackPageVisit } from '../lib/analytics';

export default function PageVisitTracker() {
  const location = useLocation();
  const { locale } = useI18n();

  useEffect(() => {
    trackPageVisit({
      pathname: location.pathname,
      search: location.search,
      locale,
    });
  }, [location.pathname, location.search, locale]);

  return null;
}
