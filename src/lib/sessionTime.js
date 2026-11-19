import { resolveIntlLocale } from './locale.js';

export const SESSION_JOIN_EARLY_MINUTES = 30;
export const SESSION_JOIN_LATE_MINUTES = 60;

export function sessionJoinWindow(session, now = Date.now()) {
  const scheduledAt = new Date(session?.scheduledAt || 0).getTime();
  if (!Number.isFinite(scheduledAt) || scheduledAt <= 0) {
    return { valid: false, phase: 'invalid', within: false, opensAt: null, closesAt: null };
  }

  const durationMinutes = Math.max(15, Number(session?.duration || 60));
  const opensAtMs = scheduledAt - SESSION_JOIN_EARLY_MINUTES * 60 * 1000;
  const closesAtMs = scheduledAt + (durationMinutes + SESSION_JOIN_LATE_MINUTES) * 60 * 1000;
  const clock = now instanceof Date ? now.getTime() : Number(now);

  const phase = clock < opensAtMs ? 'early' : clock > closesAtMs ? 'expired' : 'open';

  return {
    valid: true,
    phase,
    within: phase === 'open',
    opensAt: new Date(opensAtMs),
    closesAt: new Date(closesAtMs),
  };
}


export function sessionTimeZone(session, fallback = 'Africa/Cairo') {
  const candidate = String(
    session?.timezone
    || session?.teacher?.availabilityTimezone
    || fallback
  ).trim();

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return fallback;
  }
}

export function formatSessionDateTime(session, locale = 'ar', options = {}) {
  const date = new Date(session?.scheduledAt || 0);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(resolveIntlLocale(locale), {
    timeZone: sessionTimeZone(session),
    ...options,
  }).format(date);
}
