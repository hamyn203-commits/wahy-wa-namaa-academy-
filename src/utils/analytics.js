const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;
const IS_PRODUCTION = import.meta.env.PROD;

const SENSITIVE_PARAMS = ['token', 'code', 'ticket', 'state', 'credential'];

function sanitizeLocationForAnalytics(rawHref) {
  try {
    const parsed = new URL(rawHref || window.location.href, window.location.origin);
    for (const key of SENSITIVE_PARAMS) {
      parsed.searchParams.delete(key);
    }
    if (parsed.hash && /token=|code=|credential=/i.test(parsed.hash)) {
      parsed.hash = '';
    }
    return parsed.toString();
  } catch {
    return window.location.origin + window.location.pathname;
  }
}

export function initAnalytics() {
  if (!IS_PRODUCTION) {
    console.log('Analytics disabled in development');
    return;
  }

  const isSensitiveAuthRoute = /\/reset-password(?:\/|$)/i.test(window.location.pathname || '');

  if (GA_MEASUREMENT_ID) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: document.title,
      page_location: sanitizeLocationForAnalytics(window.location.href)
    });
  }

  if (CLARITY_PROJECT_ID && !isSensitiveAuthRoute) {
    (function(c, l, a, r, i, t, y) {
      c[a] = c[a] || function() {
        (c[a].q = c[a].q || []).push(arguments);
      };
      t = l.createElement(r);
      t.async = 1;
      t.src = `https://www.clarity.ms/tag/${i}`;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID);
  }
}

export function trackPageView(path, title) {
  if (!IS_PRODUCTION || !window.gtag) return;
  const safePath = String(path || '').split('?')[0].split('#')[0] || '/';

  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: safePath,
    page_title: title || document.title
  });

  if (window.clarity && !/\/reset-password(?:\/|$)/i.test(safePath)) {
    window.clarity('set', 'page', safePath);
  }
}

export function trackEvent(eventName, parameters = {}) {
  if (!IS_PRODUCTION || !window.gtag) return;

  window.gtag('event', eventName, parameters);

  if (window.clarity) {
    window.clarity('event', eventName);
  }
}

export function trackUser(userId, properties = {}) {
  if (!IS_PRODUCTION) return;

  if (window.gtag) {
    window.gtag('set', {
      user_id: userId,
      ...properties
    });
  }

  if (window.clarity) {
    window.clarity('identify', userId, properties);
  }
}

export function trackError(error, fatal = false) {
  if (!IS_PRODUCTION || !window.gtag) return;

  window.gtag('event', 'exception', {
    description: error.message || error,
    fatal: fatal
  });
}

export function trackTiming(category, variable, value, label) {
  if (!IS_PRODUCTION || !window.gtag) return;

  window.gtag('event', 'timing_complete', {
    name: variable,
    value: value,
    event_category: category,
    event_label: label
  });
}

export const events = {
  PAGE_VIEW: 'page_view',
  LOGIN: 'login',
  SIGN_UP: 'sign_up',
  LOGOUT: 'logout',
  SEARCH: 'search',
  SHARE: 'share',
  SELECT_CONTENT: 'select_content',
  VIEW_ITEM: 'view_item',
  GENERATE_LEAD: 'generate_lead',
  SUBMIT_FORM: 'submit_form',
  FILE_DOWNLOAD: 'file_download',
  VIDEO_PLAY: 'video_play',
  VIDEO_COMPLETE: 'video_complete',
  LIVE_SESSION_JOIN: 'live_session_join',
  LIVE_SESSION_CREATE: 'live_session_create',
  RECITATION_UPLOAD: 'recitation_upload',
  HABIT_COMPLETE: 'habit_complete',
  QUIZ_COMPLETE: 'quiz_complete'
};
