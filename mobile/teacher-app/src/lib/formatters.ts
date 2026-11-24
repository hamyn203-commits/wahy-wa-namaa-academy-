import { TeacherSession } from '../types/teacher';

export function formatDateTime(iso?: string | null, locale: 'ar' | 'en' = 'ar'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function formatShortDate(iso?: string | null, locale: 'ar' | 'en' = 'ar'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatCurrency(amount: number, currency: 'EGP' | 'USD' = 'EGP', locale: 'ar' | 'en' = 'ar'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 2,
  });
  if (currency === 'USD') {
    return locale === 'ar' ? `${formatted} $` : `$${formatted}`;
  }
  return locale === 'ar' ? `${formatted} ج.م` : `${formatted} EGP`;
}

export function formatSeconds(total = 0): string {
  const value = Math.max(0, Math.floor(total));
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function getLocalizedText(
  value: string | { ar?: string; en?: string } | undefined,
  locale: 'ar' | 'en' = 'ar'
): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return locale === 'ar' ? (value.ar || value.en || '') : (value.en || value.ar || '');
}

export function getSessionTitle(session: TeacherSession, locale: 'ar' | 'en' = 'ar'): string {
  if (session.type === 'group_circle') {
    return session.circle?.name || (locale === 'ar' ? 'حلقة جماعية' : 'Group Circle');
  }
  return session.student?.name || (locale === 'ar' ? 'طالب' : 'Student');
}

export function isSessionLiveSoon(session: TeacherSession): boolean {
  const start = new Date(session.scheduledAt).getTime();
  if (Number.isNaN(start)) return false;
  const now = Date.now();
  const durationMs = (Number(session.duration) || 60) * 60 * 1000;
  return now >= start - 20 * 60 * 1000 && now <= start + durationMs + 30 * 60 * 1000;
}

export function toLocalDateTimeInput(date = new Date(Date.now() + 2 * 60 * 60 * 1000)): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
