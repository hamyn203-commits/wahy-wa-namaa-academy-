import { apiUrl } from '../config';

const VISITOR_KEY = 'wn_analytics_visitor_id';
const SESSION_KEY = 'wn_analytics_session_id';
const ATTR_KEY = 'wn_analytics_attribution';
const TEACHER_FUNNEL_KEY = 'wn_teacher_funnel_session_id';

let lastTrackedPath = '';
let lastTrackedAt = 0;

function generateId(prefix = 'wn') {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
    }
  } catch { /* fallback below */ }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch { /* private mode / disabled storage */ }
}

export function getOrCreateVisitorId() {
  if (typeof window === 'undefined') return 'server';
  let id = safeStorageGet(window.localStorage, VISITOR_KEY);
  if (!id) {
    id = generateId('v');
    safeStorageSet(window.localStorage, VISITOR_KEY, id);
  }
  return id;
}

export function getOrCreateSessionId() {
  if (typeof window === 'undefined') return 'server';
  let id = safeStorageGet(window.sessionStorage, SESSION_KEY);
  if (!id) {
    id = generateId('s');
    safeStorageSet(window.sessionStorage, SESSION_KEY, id);
  }
  return id;
}

export function getOrCreateTeacherFunnelSessionId() {
  if (typeof window === 'undefined') return 'server';
  let id = safeStorageGet(window.sessionStorage, TEACHER_FUNNEL_KEY);
  if (!id) {
    id = generateId('tf');
    safeStorageSet(window.sessionStorage, TEACHER_FUNNEL_KEY, id);
  }
  return id;
}

export function resetTeacherFunnelSessionId() {
  if (typeof window === 'undefined') return '';
  const id = generateId('tf');
  safeStorageSet(window.sessionStorage, TEACHER_FUNNEL_KEY, id);
  return id;
}

/**
 * Mobile-app-ready platform detection:
 * - Capacitor / React Native / WebView bridges set Capacitor.getPlatform() or window.__WN_APP_PLATFORM__
 * - Installed PWA detected via display-mode: standalone
 * - Standard browser falls back to 'web'
 */
export function detectAppPlatform() {
  if (typeof window === 'undefined') return 'web';
  const explicit = String(
    window.__WN_APP_PLATFORM__
    || window.Capacitor?.getPlatform?.()
    || ''
  ).toLowerCase();
  if (explicit === 'android' || explicit === 'ios') return explicit;

  try {
    if (
      window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator?.standalone === true
    ) {
      return 'pwa';
    }
  } catch { /* ignore */ }
  return 'web';
}

export function detectAppVersion() {
  if (typeof window === 'undefined') return '';
  return String(window.__WN_APP_VERSION__ || '').trim().slice(0, 32);
}

export function detectDeviceType() {
  if (typeof window === 'undefined') return 'unknown';
  const platform = detectAppPlatform();
  if (platform === 'android' || platform === 'ios') return 'mobile';
  const ua = String(window.navigator?.userAgent || '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return 'mobile';
  if (window.innerWidth && window.innerWidth <= 767) return 'mobile';
  if (window.innerWidth && window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

export function resolveAttribution(search = '') {
  if (typeof window === 'undefined') {
    return { source: 'direct', medium: '', campaign: '', referrer: '' };
  }
  const params = new URLSearchParams(search || window.location.search || '');
  const paramSource = (
    params.get('src')
    || params.get('utm_source')
    || params.get('ref')
    || ''
  ).trim().toLowerCase().slice(0, 80);
  const paramMedium = (params.get('utm_medium') || '').trim().toLowerCase().slice(0, 60);
  const paramCampaign = (params.get('utm_campaign') || '').trim().slice(0, 80);
  const referrer = String(document.referrer || '').slice(0, 300);

  if (paramSource) {
    const next = { source: paramSource, medium: paramMedium, campaign: paramCampaign, referrer };
    safeStorageSet(window.sessionStorage, ATTR_KEY, JSON.stringify(next));
    return next;
  }

  try {
    const cached = JSON.parse(safeStorageGet(window.sessionStorage, ATTR_KEY) || 'null');
    if (cached && cached.source) {
      return { ...cached, referrer: cached.referrer || referrer };
    }
  } catch { /* ignore */ }

  const initial = { source: '', medium: '', campaign: '', referrer };
  if (referrer) {
    safeStorageSet(window.sessionStorage, ATTR_KEY, JSON.stringify(initial));
  }
  return initial;
}

function sendAnalyticsEvent(endpoint, body) {
  if (typeof window === 'undefined') return;
  try {
    const platform = detectAppPlatform();
    const appVersion = detectAppVersion();
    const headers = {
      'Content-Type': 'application/json',
      'X-App-Platform': platform,
    };
    if (appVersion) headers['X-App-Version'] = appVersion;

    fetch(apiUrl(endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        platform,
        appVersion,
        deviceType: detectDeviceType(),
        ...body,
      }),
      keepalive: true,
    }).catch(() => { /* never interrupt UX */ });
  } catch { /* never interrupt UX */ }
}

export function trackPageVisit({ pathname, search = '', locale = 'ar' } = {}) {
  if (typeof window === 'undefined') return;
  const rawPath = String(pathname || window.location.pathname || '/');
  if (/^\/([a-z]{2}\/)?admin(\/|$)/i.test(rawPath)) return;

  const now = Date.now();
  if (rawPath === lastTrackedPath && now - lastTrackedAt < 2500) return;
  lastTrackedPath = rawPath;
  lastTrackedAt = now;

  const attr = resolveAttribution(search);
  sendAnalyticsEvent('/api/analytics/visit', {
    visitorId: getOrCreateVisitorId(),
    sessionId: getOrCreateSessionId(),
    path: rawPath,
    locale,
    source: attr.source,
    medium: attr.medium,
    campaign: attr.campaign,
    referrer: attr.referrer,
  });
}

export function trackTeacherFunnel({
  event = 'progress',
  step = 1,
  touchedFieldsCount = 0,
  filesSelectedCount = 0,
  emailVerified = false,
  fullName = '',
  email = '',
  phone = '',
  whatsapp = '',
  country = '',
  gender = '',
  locale = 'ar',
  lastError = '',
} = {}) {
  if (typeof window === 'undefined') return;
  const attr = resolveAttribution(window.location.search || '');
  sendAnalyticsEvent('/api/analytics/teacher-funnel', {
    sessionId: getOrCreateTeacherFunnelSessionId(),
    visitorId: getOrCreateVisitorId(),
    event,
    step,
    touchedFieldsCount,
    filesSelectedCount,
    emailVerified: Boolean(emailVerified),
    fullName,
    email,
    phone,
    whatsapp,
    country,
    gender,
    locale,
    entryPath: window.location.pathname || '/register/teacher',
    source: attr.source,
    campaign: attr.campaign,
    referrer: attr.referrer,
    lastError,
  });
}
