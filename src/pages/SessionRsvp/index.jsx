import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert, UserCheck, XCircle } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';

export default function SessionRsvp() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, dir, t } = useI18n();
  const { user } = useAuth();

  const rsvpT = t?.student?.rsvp || {};
  const common = t?.common || {};
  const studentIdParam = searchParams.get('studentId') || '';

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [excuseMode, setExcuseMode] = useState(false);
  const [excuseReason, setExcuseReason] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = studentIdParam ? `?studentId=${encodeURIComponent(studentIdParam)}` : '';
    try {
      const data = await api.get(`/api/sessions/${encodeURIComponent(sessionId)}/rsvp${query}`, { auth: true });
      setInfo(data);
      if (data?.excuseReason && data?.rsvpStatus === 'excused') {
        setExcuseReason(data.excuseReason);
      }
    } catch (err) {
      setError(err?.message || rsvpT.loadError || 'Unable to load session details');
    } finally {
      setLoading(false);
    }
  }, [sessionId, studentIdParam, rsvpT.loadError]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const submitRsvp = async (status) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        status,
        excuseReason: status === 'excused' ? excuseReason.trim() : '',
      };
      if (info?.studentId || studentIdParam) {
        payload.studentId = info?.studentId || studentIdParam;
      }
      const res = await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/rsvp`, payload, { auth: true });
      setResult(res);
      setInfo((prev) => (prev ? { ...prev, rsvpStatus: status } : prev));
      setExcuseMode(false);
    } catch (err) {
      setError(err?.message || rsvpT.saveError || 'Could not save response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = info?.scheduledAt
    ? new Date(info.scheduledAt).toLocaleString(resolveIntlLocale(locale), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: info.timezone || 'Africa/Cairo',
      })
    : '';

  const goToDashboard = () => {
    navigate(dashboardPathForRole(user?.role, locale));
  };

  return (
    <div dir={dir} className="min-h-screen flex flex-col bg-[var(--wn-bg)] text-[var(--wn-text-primary)]">
      <SEOHead page={{ url: `/sessions/${sessionId}/rsvp`, noindex: true, canonical: false }} />
      <GlobalHeader />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-10">
        <div className="bg-[var(--wn-surface)] rounded-2xl shadow-sm border border-[var(--wn-border)] p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--wn-border)] pb-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] flex items-center justify-center shrink-0">
              <UserCheck size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--wn-heading)]">
                {rsvpT.title || 'Session Attendance Confirmation'}
              </h1>
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {rsvpT.subtitle || 'Wahy Wa Namaa Academy — Session Schedule Management'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <span className="sr-only">{rsvpT.loading || 'Loading session details…'}</span>
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          ) : error && !info ? (
            <div className="rounded-xl bg-[var(--wn-danger-soft)] border border-[var(--wn-danger)] p-4 text-[var(--wn-text-danger)] space-y-3" role="alert">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadInfo}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>{common.retry || 'Try again'}</span>
                </button>
                <button
                  type="button"
                  onClick={goToDashboard}
                  className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  {rsvpT.backDashboard || 'Back to dashboard'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] p-4 space-y-2.5 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-[var(--wn-text-secondary)]">{rsvpT.studentLabel || 'Student:'}</span>
                  <span className="font-semibold text-[var(--wn-text-primary)] text-end">{info?.studentName}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-[var(--wn-text-secondary)]">{rsvpT.teacherLabel || 'Tutor:'}</span>
                  <span className="font-semibold text-[var(--wn-text-primary)] text-end">{info?.teacherName}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 items-center">
                  <span className="text-[var(--wn-text-secondary)] flex items-center gap-1">
                    <Calendar size={14} aria-hidden="true" /> {rsvpT.timeLabel || 'Scheduled time:'}
                  </span>
                  <span className="font-semibold text-[var(--wn-text-primary)] text-end">{formattedDate}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 items-center">
                  <span className="text-[var(--wn-text-secondary)] flex items-center gap-1">
                    <Clock size={14} aria-hidden="true" /> {rsvpT.statusLabel || 'Current status:'}
                  </span>
                  <span className="font-semibold text-[var(--wn-link)] text-end">
                    {info?.rsvpStatus === 'confirmed'
                      ? (rsvpT.statusConfirmed || 'Attendance confirmed')
                      : info?.rsvpStatus === 'excused'
                        ? (rsvpT.statusExcused || 'Excused')
                        : (rsvpT.statusPending || 'Awaiting confirmation')}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--wn-gold-soft)] border border-[var(--wn-border-strong)] p-3 text-xs text-[var(--wn-text-primary)] leading-relaxed">
                {rsvpT.policyNote || 'Submitting an excuse at least 6 hours before the session preserves your balance for a make-up session.'}
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-[var(--wn-danger-soft)] border border-[var(--wn-danger)] p-3 text-sm text-[var(--wn-text-danger)]">
                  {error}
                </div>
              )}

              {result ? (
                <div className="rounded-xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] p-4 space-y-3 text-[var(--wn-text-primary)]">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 size={20} className="text-[var(--wn-link)] shrink-0" aria-hidden="true" />
                    <span>{result.message || rsvpT.submitted || 'Your response has been recorded'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={goToDashboard}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    {rsvpT.goDashboard || 'Go to dashboard'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitRsvp('confirmed')}
                      className="min-h-[44px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      {submitting && !excuseMode ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                      <span>{rsvpT.attending || 'I will attend'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setExcuseMode((prev) => !prev)}
                      className="min-h-[44px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-[var(--wn-danger)] text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      <XCircle size={18} aria-hidden="true" />
                      <span>{rsvpT.excused || 'Send an excuse'}</span>
                    </button>
                  </div>

                  {excuseMode && (
                    <div className="rounded-xl border border-[var(--wn-border)] p-4 space-y-3 bg-[var(--wn-surface-soft)]">
                      <label htmlFor="rsvp-excuse-reason" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                        {rsvpT.excuseLabel || 'Reason for absence (optional)'}
                      </label>
                      <textarea
                        id="rsvp-excuse-reason"
                        rows={3}
                        value={excuseReason}
                        disabled={submitting}
                        onChange={(e) => setExcuseReason(e.target.value)}
                        placeholder={rsvpT.excusePlaceholder || 'e.g., Family emergency or medical appointment...'}
                        className="w-full rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => submitRsvp('excused')}
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                      >
                        {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                        <span>{submitting ? (rsvpT.submitting || 'Submitting response…') : (rsvpT.confirmExcuseBtn || 'Confirm & submit excuse')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}

