import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, CalendarClock, CheckCircle2, Clock3, GraduationCap,
  Loader2, RefreshCw, UserRound, Video,
} from 'lucide-react';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { formatMsg } from './adminFormat';

const FOCUS_ICONS = {
  all: CalendarClock,
  overdue: AlertTriangle,
  'missing-reports': BookOpen,
};

export default function AdminSessionControl({
  initialFocus = 'all',
  onOpenStudent,
  onOpenTeacher,
  onFocusChange,
}) {
  const safeInitial = FOCUS_ICONS[initialFocus] ? initialFocus : 'all';
  const [focus, setFocus] = useState(safeInitial);
  const toast = useToast();
  const { locale, t } = useI18n();
  const sc = t.adminPortal.sessionControl;
  const dash = t.adminPortal.common.dash;

  const [sessions, setSessions] = useState([]);
  const [updatingSessionId, setUpdatingSessionId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get('/api/admin/session-control?focus=' + encodeURIComponent(focus), { auth: true });
      setSessions(result.sessions || []);
    } catch (loadError) {
      setError(loadError.message || sc.loadError);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [focus, sc.loadError]);

  useEffect(() => {
    if (FOCUS_ICONS[initialFocus] && initialFocus !== focus) setFocus(initialFocus);
  }, [initialFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const updateSessionStatus = async (sessionId, nextStatus) => {
    if (updatingSessionId) return false;
    setUpdatingSessionId(sessionId);
    try {
      await api.put(`/api/admin/session-control/${sessionId}/status`, {
        status: nextStatus,
        reason: nextStatus === 'completed' ? sc.reasonCompleted : sc.reasonCancelled,
      }, { auth: true });
      toast.success(nextStatus === 'completed' ? sc.updateSuccessCompleted : sc.updateSuccessCancelled);
      await load();
      return true;
    } catch (err) {
      toast.error(err.message || sc.updateError);
      return false;
    } finally {
      setUpdatingSessionId('');
    }
  };

  const focusMeta = useMemo(() => ({
    all: { ...(sc.focuses?.all || {}), icon: CalendarClock },
    overdue: { ...(sc.focuses?.overdue || {}), icon: AlertTriangle },
    'missing-reports': { ...(sc.focuses?.missingReports || {}), icon: BookOpen },
  }), [sc.focuses]);

  const meta = focusMeta[focus] || focusMeta.all;
  const Icon = meta.icon;

  const groupedStats = useMemo(() => ({
    total: sessions.length,
    withMeeting: sessions.filter((item) => item.meetingAvailable).length,
    withRecording: sessions.filter((item) => item.recordingAvailable).length,
  }), [sessions]);

  const chooseFocus = (next) => {
    setFocus(next);
    onFocusChange?.(next);
  };

  const statusLabel = (status) => {
    if (status === 'no-show') return sc.statuses?.noShow || status;
    return sc.statuses?.[status] || status;
  };

  return (
    <section className="wn-admin-session-control">
      <header className="wn-admin-session-control__hero">
        <div>
          <span>{sc.eyebrow}</span>
          <h2><Icon size={20} aria-hidden="true" /> {meta.title}</h2>
          <p>{meta.desc}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="min-h-[44px]">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {sc.refresh}
        </button>
      </header>

      <nav className="wn-admin-session-control__filters" aria-label={sc.filtersAria}>
        {Object.entries(focusMeta).map(([key, item]) => (
          <button
            type="button"
            key={key}
            aria-pressed={focus === key}
            className={`min-h-[44px] ${focus === key ? 'is-active' : ''}`}
            onClick={() => chooseFocus(key)}
          >
            {item.title}
          </button>
        ))}
      </nav>

      <div className="wn-admin-session-control__stats">
        <div><strong>{groupedStats.total}</strong><span>{sc.stats.total}</span></div>
        <div><strong>{groupedStats.withMeeting}</strong><span>{sc.stats.withMeeting}</span></div>
        <div><strong>{groupedStats.withRecording}</strong><span>{sc.stats.withRecording}</span></div>
      </div>

      {error ? (
        <div role="alert" className="wn-admin-session-control__error flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2"><AlertTriangle size={17} aria-hidden="true" /> {error}</span>
          <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
            {t.adminPortal.common.retry}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3" role="status" aria-label={sc.loading}>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : !error && sessions.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={sc.emptyTitle} description={sc.emptyDesc} />
      ) : !error ? (
        <div className="wn-admin-session-control__list">
          {sessions.map((session) => (
            <article key={session._id}>
              <div className="wn-admin-session-control__date">
                <CalendarClock size={17} aria-hidden="true" />
                <span>{formatSessionDateTime(session, locale, { dateStyle: 'medium' })}</span>
                <small>{formatSessionDateTime(session, locale, { timeStyle: 'short' })} · {sessionTimeZone(session)}</small>
              </div>

              <div className="wn-admin-session-control__people">
                <button type="button" disabled={!session.student?._id} onClick={() => onOpenStudent?.(session.student?._id)} className="min-h-[44px]">
                  <UserRound size={16} aria-hidden="true" />
                  <span><strong>{session.student?.name || sc.studentFallback}</strong><small>{session.student?.email || session.circle?.name || dash}</small></span>
                </button>
                <button type="button" disabled={!session.teacher?._id} onClick={() => onOpenTeacher?.(session.teacher?._id)} className="min-h-[44px]">
                  <GraduationCap size={16} aria-hidden="true" />
                  <span><strong>{session.teacher?.name || sc.teacherFallback}</strong><small>{session.teacher?.email || dash}</small></span>
                </button>
              </div>

              <div className="wn-admin-session-control__meta">
                <span className={`is-${session.status}`}>{statusLabel(session.status)}</span>
                <span><Clock3 size={13} aria-hidden="true" /> {formatMsg(sc.meta.minutes, { count: session.duration || 0 })}</span>
                <span><BookOpen size={13} aria-hidden="true" /> {formatMsg(sc.meta.reports, { count: session.reportCount || 0 })}</span>
                {session.recordingAvailable ? <span><Video size={13} aria-hidden="true" /> {sc.meta.recording}</span> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {['accepted', 'pending'].includes(session.status) ? (
                  <a
                    href={localizedPath(`/live/${session.roomId || session._id}`, locale)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center px-3 py-2 rounded-lg bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] border border-[var(--wn-status-success-border)] text-xs font-bold transition"
                  >
                    {sc.actions.joinObserver}
                  </a>
                ) : null}
                {session.status === 'accepted' ? (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(updatingSessionId)}
                      onClick={() => setConfirmAction({ sessionId: session._id, nextStatus: 'completed' })}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border border-[var(--wn-status-info-border)] text-xs font-bold transition disabled:opacity-50"
                    >
                      {updatingSessionId === session._id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
                      {sc.actions.complete}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(updatingSessionId)}
                      onClick={() => setConfirmAction({ sessionId: session._id, nextStatus: 'cancelled' })}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)] text-xs font-bold transition disabled:opacity-50"
                    >
                      {sc.actions.cancel}
                    </button>
                  </>
                ) : null}
                <code>{session._id}</code>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => { if (!updatingSessionId) setConfirmAction(null); }}
        title={confirmAction?.nextStatus === 'completed' ? sc.confirmModal.completeTitle : sc.confirmModal.cancelTitle}
        disableClose={Boolean(updatingSessionId)}
      >
        {confirmAction ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{confirmAction.nextStatus === 'completed' ? sc.confirmModal.completeBody : sc.confirmModal.cancelBody}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={Boolean(updatingSessionId)}
                onClick={() => setConfirmAction(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-[var(--wn-text-secondary)] disabled:opacity-50"
              >
                {sc.confirmModal.cancel}
              </button>
              <button
                type="button"
                disabled={Boolean(updatingSessionId)}
                onClick={async () => {
                  const ok = await updateSessionStatus(confirmAction.sessionId, confirmAction.nextStatus);
                  if (ok) setConfirmAction(null);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-[var(--wn-text-inverse)] font-semibold inline-flex items-center gap-2 disabled:opacity-50 ${
                  confirmAction.nextStatus === 'completed' ? 'bg-[var(--wn-emerald)]' : 'bg-[var(--wn-danger)]'
                }`}
              >
                {updatingSessionId ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                {confirmAction.nextStatus === 'completed' ? sc.confirmModal.completeConfirm : sc.confirmModal.cancelConfirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
