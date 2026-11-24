import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BellRing, BookOpen, Calendar, CalendarClock, CheckCircle2,
  Clock3, Copy, Eye, GraduationCap, Loader2, MoreHorizontal, Radio, RefreshCw,
  Search, Sparkles, Star, UserRound, Users, Video, XCircle,
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
import Session360Drawer from './Session360Drawer';

const VALID_FOCUSES = new Set(['all', 'live', 'today', 'overdue', 'pending', 'missing-reports']);

export default function AdminSessionControl({
  initialFocus = 'all',
  onOpenStudent,
  onOpenTeacher,
  onMessageStudent = null,
  onFocusChange,
}) {
  const safeInitial = VALID_FOCUSES.has(initialFocus) ? initialFocus : 'all';
  const [focus, setFocus] = useState(safeInitial);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({
    liveCount: 0,
    todayTotal: 0,
    todayCompleted: 0,
    overdueCount: 0,
    pendingCount: 0,
    missingReportsCount: 0,
    avgRating: 0,
    ratedCount: 0,
  });
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const [updatingSessionId, setUpdatingSessionId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const toast = useToast();
  const { locale, t } = useI18n();
  const sc = t.adminPortal.sessionControl;
  const dash = t.adminPortal.common.dash;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/api/admin/session-control?focus=' + encodeURIComponent(focus);
      if (typeFilter !== 'all') url += '&type=' + encodeURIComponent(typeFilter);
      if (statusFilter !== 'all') url += '&status=' + encodeURIComponent(statusFilter);
      const result = await api.get(url, { auth: true });
      setSessions(result.sessions || []);
      setNowMs(Date.now());
      if (result.summary) {
        setSummary((prev) => ({ ...prev, ...result.summary }));
      }
    } catch (loadError) {
      setError(loadError.message || sc.loadError);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [focus, typeFilter, statusFilter, sc.loadError]);

  useEffect(() => {
    if (VALID_FOCUSES.has(initialFocus) && initialFocus !== focus) {
      setFocus(initialFocus);
    }
  }, [initialFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const chooseFocus = (next) => {
    setFocus(next);
    setOpenMenuId('');
    onFocusChange?.(next);
  };

  const copyText = async (value, successMsg) => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      toast.success(successMsg || sc.labels?.copiedCode);
    } catch {
      // ignore clipboard errors
    }
  };

  const defaultReasonForStatus = (nextStatus) => {
    if (nextStatus === 'accepted') return sc.reasonAccepted;
    if (nextStatus === 'completed') return sc.reasonCompleted;
    if (nextStatus === 'no-show') return sc.reasonNoShow;
    return sc.reasonCancelled;
  };

  const updateSessionStatus = async (sessionId, nextStatus, extra = {}) => {
    if (updatingSessionId) return false;
    setUpdatingSessionId(sessionId);
    try {
      await api.put(
        `/api/admin/session-control/${sessionId}/status`,
        {
          status: nextStatus,
          reason: extra.reason || defaultReasonForStatus(nextStatus),
          ...(extra.resolvePendingAttendanceAs
            ? { resolvePendingAttendanceAs: extra.resolvePendingAttendanceAs }
            : {}),
        },
        { auth: true }
      );
      const msgMap = {
        accepted: sc.updateSuccessAccepted,
        completed: sc.updateSuccessCompleted,
        'no-show': sc.updateSuccessNoShow,
        cancelled: sc.updateSuccessCancelled,
      };
      toast.success(msgMap[nextStatus] || sc.updateSuccessCompleted);
      await load();
      return true;
    } catch (err) {
      toast.error(err.message || sc.updateError);
      return false;
    } finally {
      setUpdatingSessionId('');
    }
  };

  const nudgeTeacher = async (sessionId) => {
    if (updatingSessionId) return;
    setUpdatingSessionId(sessionId);
    try {
      await api.post(`/api/admin/session-control/${sessionId}/nudge-teacher`, {}, { auth: true });
      toast.success(sc.nudgeSuccess);
    } catch (err) {
      toast.error(err.message || sc.updateError);
    } finally {
      setUpdatingSessionId('');
    }
  };

  const openConfirmModal = (session, nextStatus) => {
    setOpenMenuId('');
    setConfirmAction({
      session,
      sessionId: session._id,
      nextStatus,
      reason: defaultReasonForStatus(nextStatus),
      resolvePendingAttendanceAs: 'attended',
    });
  };

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^#/, '');
    if (!q) return sessions;
    return sessions.filter((item) => {
      const hay = [
        item._id,
        item.shortCode,
        item.student?.name,
        item.student?.email,
        item.student?.phone,
        item.teacher?.name,
        item.teacher?.email,
        item.circle?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, searchQuery]);

  const selectedSession = useMemo(
    () => sessions.find((s) => String(s._id) === String(selectedSessionId)) || null,
    [sessions, selectedSessionId]
  );

  const focusTabs = useMemo(
    () => [
      { key: 'all', title: sc.focuses?.all?.title, count: null },
      { key: 'live', title: sc.focuses?.live?.title, count: summary.liveCount },
      { key: 'today', title: sc.focuses?.today?.title, count: summary.todayTotal },
      { key: 'overdue', title: sc.focuses?.overdue?.title, count: summary.overdueCount, alert: summary.overdueCount > 0 },
      { key: 'pending', title: sc.focuses?.pending?.title, count: summary.pendingCount },
      { key: 'missing-reports', title: sc.focuses?.missingReports?.title, count: summary.missingReportsCount },
    ],
    [sc.focuses, summary]
  );

  const statusLabel = (status) => {
    if (status === 'no-show') return sc.statuses?.noShow || status;
    return sc.statuses?.[status] || status;
  };

  const todayRemaining = Math.max(0, Number(summary.todayTotal || 0) - Number(summary.todayCompleted || 0));

  return (
    <section className="space-y-4" onClick={() => { if (openMenuId) setOpenMenuId(''); }}>
      {/* Layer 1: Live Operations Pulse Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => chooseFocus('live')}
          className={`text-start p-4 rounded-2xl border transition cursor-pointer ${
            focus === 'live'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--wn-text-secondary)]">{sc.pulse?.liveTitle}</span>
            <Radio size={16} className={summary.liveCount > 0 ? 'text-[var(--wn-status-success-text)] animate-pulse' : 'text-[var(--wn-text-tertiary)]'} aria-hidden="true" />
          </div>
          <strong className="block text-2xl font-extrabold text-[var(--wn-heading)] mt-1 tabular-nums">{summary.liveCount}</strong>
          <small className="block text-xs text-[var(--wn-text-secondary)] mt-0.5 truncate">{sc.pulse?.liveSub}</small>
        </button>

        <button
          type="button"
          onClick={() => chooseFocus('today')}
          className={`text-start p-4 rounded-2xl border transition cursor-pointer ${
            focus === 'today'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--wn-text-secondary)]">{sc.pulse?.todayTitle}</span>
            <Calendar size={16} className="text-[var(--wn-link)]" aria-hidden="true" />
          </div>
          <strong className="block text-2xl font-extrabold text-[var(--wn-heading)] mt-1 tabular-nums">{summary.todayTotal}</strong>
          <small className="block text-xs text-[var(--wn-text-secondary)] mt-0.5 truncate">
            {formatMsg(sc.pulse?.todaySub, { done: summary.todayCompleted, left: todayRemaining })}
          </small>
        </button>

        <button
          type="button"
          onClick={() => chooseFocus('overdue')}
          className={`text-start p-4 rounded-2xl border transition cursor-pointer ${
            focus === 'overdue' || summary.overdueCount > 0
              ? 'border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-border-strong)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-bold ${summary.overdueCount > 0 ? 'text-[var(--wn-status-danger-text)]' : 'text-[var(--wn-text-secondary)]'}`}>
              {sc.pulse?.overdueTitle}
            </span>
            <AlertTriangle size={16} className={summary.overdueCount > 0 ? 'text-[var(--wn-status-danger-text)]' : 'text-[var(--wn-text-tertiary)]'} aria-hidden="true" />
          </div>
          <strong className={`block text-2xl font-extrabold mt-1 tabular-nums ${summary.overdueCount > 0 ? 'text-[var(--wn-status-danger-text)]' : 'text-[var(--wn-heading)]'}`}>
            {summary.overdueCount}
          </strong>
          <small className="block text-xs text-[var(--wn-text-secondary)] mt-0.5 truncate">{sc.pulse?.overdueSub}</small>
        </button>

        <button
          type="button"
          onClick={() => chooseFocus('pending')}
          className={`text-start p-4 rounded-2xl border transition cursor-pointer ${
            focus === 'pending'
              ? 'border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-border-strong)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--wn-text-secondary)]">{sc.pulse?.pendingTitle}</span>
            <Clock3 size={16} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
          </div>
          <strong className="block text-2xl font-extrabold text-[var(--wn-heading)] mt-1 tabular-nums">{summary.pendingCount}</strong>
          <small className="block text-xs text-[var(--wn-text-secondary)] mt-0.5 truncate">{sc.pulse?.pendingSub}</small>
        </button>

        <button
          type="button"
          onClick={() => chooseFocus('missing-reports')}
          className={`text-start p-4 rounded-2xl border transition cursor-pointer col-span-2 sm:col-span-1 ${
            focus === 'missing-reports'
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--wn-text-secondary)]">{sc.pulse?.qualityTitle}</span>
            <Star size={16} className="text-[var(--wn-gold)]" aria-hidden="true" />
          </div>
          <strong className="block text-2xl font-extrabold text-[var(--wn-heading)] mt-1 tabular-nums">
            {summary.ratedCount > 0 ? `${summary.avgRating}/5` : summary.missingReportsCount}
          </strong>
          <small className="block text-xs text-[var(--wn-text-secondary)] mt-0.5 truncate">
            {summary.ratedCount > 0
              ? formatMsg(sc.pulse?.qualitySubRated, { avg: summary.avgRating, missing: summary.missingReportsCount })
              : formatMsg(sc.pulse?.qualitySubEmpty, { missing: summary.missingReportsCount })}
          </small>
        </button>
      </div>

      {/* Layer 2: Unified Command & Filter Bar */}
      <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="flex flex-wrap items-center gap-1.5" aria-label={sc.filtersAria}>
            {focusTabs.map((item) => {
              const active = focus === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseFocus(item.key)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] shadow-xs'
                      : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)]'
                  }`}
                >
                  <span>{item.title}</span>
                  {item.count != null && item.count > 0 ? (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                        active
                          ? 'bg-white/20 text-[var(--wn-text-inverse)]'
                          : item.alert
                            ? 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]'
                            : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)]'
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:bg-[var(--wn-emerald-soft)] text-xs font-bold text-[var(--wn-text-primary)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{sc.refresh}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--wn-border)]">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={sc.searchPlaceholder}
              aria-label={sc.searchPlaceholder}
              className="w-full min-h-[42px] ps-9 pe-3 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs text-[var(--wn-text-primary)]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label={sc.typeFilterAria}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-text-primary)] cursor-pointer"
          >
            <option value="all">{sc.types?.all}</option>
            <option value="trial">{sc.types?.trial}</option>
            <option value="regular">{sc.types?.regular}</option>
            <option value="group_circle">{sc.types?.group_circle}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={sc.statusFilterAria}
            className="min-h-[42px] px-3 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-text-primary)] cursor-pointer"
          >
            <option value="all">{sc.statuses?.all}</option>
            <option value="accepted">{sc.statuses?.accepted}</option>
            <option value="pending">{sc.statuses?.pending}</option>
            <option value="completed">{sc.statuses?.completed}</option>
            <option value="cancelled">{sc.statuses?.cancelled}</option>
            <option value="no-show">{sc.statuses?.noShow}</option>
          </select>

          {(typeFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim()) ? (
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setSearchQuery(''); }}
              className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold text-[var(--wn-link)] hover:underline cursor-pointer"
            >
              {sc.clearFilters}
            </button>
          ) : null}
        </div>
      </div>

      {/* Error Alert */}
      {error ? (
        <div role="alert" className="rounded-2xl border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <span className="inline-flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" /> {error}</span>
          <button type="button" onClick={load} className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border border-[var(--wn-border)] cursor-pointer">
            {t.adminPortal.common.retry}
          </button>
        </div>
      ) : null}

      {/* Layer 3: Structured 5-Zone Session Rows */}
      {loading ? (
        <div className="space-y-3" role="status" aria-label={sc.loading}>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : !error && filteredSessions.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={sc.emptyTitle} description={sc.emptyDesc} />
      ) : !error ? (
        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] overflow-visible divide-y divide-[var(--wn-border)]">
          <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-4 py-3 bg-[var(--wn-surface-soft)] rounded-t-2xl text-xs font-extrabold text-[var(--wn-text-secondary)]">
            <div className="col-span-2">{sc.columns?.schedule}</div>
            <div className="col-span-2">{sc.columns?.typeRef}</div>
            <div className="col-span-4">{sc.columns?.people}</div>
            <div className="col-span-2">{sc.columns?.quality}</div>
            <div className="col-span-2 text-end">{sc.columns?.actions}</div>
          </div>

          {filteredSessions.map((session) => {
            const isGroup = session.type === 'group_circle';
            const isTrial = session.type === 'trial';
            const isOverdue = session.status === 'accepted' && session.scheduledAt && new Date(session.scheduledAt).getTime() < nowMs && !session.liveRoom?.isLive;
            const isUpdating = updatingSessionId === session._id;
            const menuOpen = openMenuId === session._id;

            return (
              <article
                key={session._id}
                onClick={() => setSelectedSessionId(session._id)}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-[var(--wn-surface-soft)] transition cursor-pointer"
              >
                {/* Zone 1: Schedule & Smart Pulse */}
                <div className="lg:col-span-2 space-y-0.5 min-w-0">
                  <div className="text-xs font-extrabold text-[var(--wn-heading)] flex items-center gap-1.5">
                    <CalendarClock size={14} className="text-[var(--wn-link)] shrink-0" aria-hidden="true" />
                    <span className="truncate">{formatSessionDateTime(session, locale, { dateStyle: 'medium' })}</span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--wn-text-secondary)]">
                    {formatSessionDateTime(session, locale, { timeStyle: 'short' })} · {formatMsg(sc.meta.minutes, { count: session.duration || 60 })}
                  </div>
                  {session.liveRoom?.isLive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--wn-status-success-text)]">
                      <Radio size={12} className="animate-pulse" aria-hidden="true" />
                      {sc.labels.liveNow}
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--wn-status-danger-text)]">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {sc.labels.overdueAlert}
                    </span>
                  ) : session.canObserveLive ? (
                    <span className="text-xs font-bold text-[var(--wn-emerald-dark)]">{sc.labels.roomOpen}</span>
                  ) : (
                    <span className="text-xs text-[var(--wn-text-tertiary)]">{sessionTimeZone(session)}</span>
                  )}
                </div>

                {/* Zone 2: Type Badge & Clean Short Reference */}
                <div className="lg:col-span-2 space-y-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isTrial
                        ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)] border-[var(--wn-border-strong)]'
                        : isGroup
                          ? 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border-[var(--wn-status-info-border)]'
                          : 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border-[var(--wn-border-mint)]'
                    }`}
                  >
                    {isTrial ? <Sparkles size={12} aria-hidden="true" /> : isGroup ? <Users size={12} aria-hidden="true" /> : <UserRound size={12} aria-hidden="true" />}
                    <span>{sc.types?.[session.type] || session.type}</span>
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => copyText(String(session._id), sc.labels?.copiedCode)}
                      title={String(session._id)}
                      className="inline-flex items-center gap-1 text-xs font-mono text-[var(--wn-text-tertiary)] hover:text-[var(--wn-text-primary)] cursor-pointer"
                    >
                      <span>{session.shortCode || `#${String(session._id).slice(-4).toUpperCase()}`}</span>
                      <Copy size={11} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Zone 3: Explicit Student & Teacher Cards */}
                <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={!session.student?._id}
                    onClick={() => session.student?._id && onOpenStudent?.(session.student._id)}
                    className="min-h-[48px] p-2.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] text-start min-w-0 transition cursor-pointer disabled:cursor-default"
                  >
                    <span className="block text-xs font-bold text-[var(--wn-text-tertiary)]">
                      {isGroup ? sc.labels.circleRole : sc.labels.studentRole}
                    </span>
                    <strong className="block text-xs font-extrabold text-[var(--wn-heading)] truncate">
                      {isGroup ? (session.circle?.name || sc.studentFallback) : (session.student?.name || sc.studentFallback)}
                    </strong>
                    <small className="block text-xs text-[var(--wn-text-secondary)] truncate">
                      {isGroup
                        ? formatMsg(sc.labels.groupRosterCount, {
                            attended: session.attendanceSummary?.attended || 0,
                            total: session.attendanceSummary?.total || 0,
                          })
                        : (session.student?.email || session.student?.phone || dash)}
                    </small>
                  </button>

                  <button
                    type="button"
                    disabled={!session.teacher?._id}
                    onClick={() => session.teacher?._id && onOpenTeacher?.(session.teacher._id)}
                    className="min-h-[48px] p-2.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] text-start min-w-0 transition cursor-pointer disabled:cursor-default"
                  >
                    <span className="block text-xs font-bold text-[var(--wn-text-tertiary)] flex items-center gap-1">
                      <GraduationCap size={12} aria-hidden="true" />
                      <span>{sc.labels.teacherRole}</span>
                    </span>
                    <strong className="block text-xs font-extrabold text-[var(--wn-heading)] truncate">
                      {session.teacher?.name || sc.teacherFallback}
                    </strong>
                    <small className="block text-xs text-[var(--wn-text-secondary)] truncate">
                      {session.teacher?.email || dash}
                    </small>
                  </button>
                </div>

                {/* Zone 4: Status, Real Report State & Student Rating */}
                <div className="lg:col-span-2 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        session.status === 'completed'
                          ? 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] border-[var(--wn-status-success-border)]'
                          : session.status === 'accepted'
                            ? 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border-[var(--wn-status-info-border)]'
                            : session.status === 'pending'
                              ? 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border-[var(--wn-status-warn-border)]'
                              : 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border-[var(--wn-status-danger-border)]'
                      }`}
                    >
                      {statusLabel(session.status)}
                    </span>
                    {session.recordingAvailable ? (
                      <Video size={13} className="text-[var(--wn-link)]" title={sc.meta.recording} aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--wn-text-secondary)] flex items-center gap-1 truncate">
                    <BookOpen size={12} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {session.hasTeacherReport
                        ? sc.labels.reportSubmitted
                        : session.status === 'completed'
                          ? sc.labels.reportMissing
                          : sc.labels.reportPendingRun}
                    </span>
                  </div>
                  {session.studentRating ? (
                    <div className="text-xs font-bold text-[var(--wn-text-gold)] flex items-center gap-1">
                      <Star size={12} fill="currentColor" aria-hidden="true" />
                      <span>{formatMsg(sc.labels.studentRating, { score: session.studentRating.average })}</span>
                    </div>
                  ) : null}
                </div>

                {/* Zone 5: Smart Context Action + 360 Button + Overflow Menu */}
                <div className="lg:col-span-2 flex items-center justify-end gap-1.5 relative" onClick={(e) => e.stopPropagation()}>
                  {session.canObserveLive ? (
                    <a
                      href={localizedPath(`/live/${session.roomId || session._id}`, locale)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] border border-[var(--wn-status-success-border)] text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Eye size={13} aria-hidden="true" />
                      <span>{sc.actions.joinObserver}</span>
                    </a>
                  ) : session.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => openConfirmModal(session, 'accepted')}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                      <span>{sc.actions.acceptPending}</span>
                    </button>
                  ) : session.status === 'accepted' && isOverdue ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => openConfirmModal(session, 'completed')}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)] border border-[var(--wn-status-info-border)] text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                      <span>{sc.actions.complete}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setSelectedSessionId(session._id)}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-emerald)] text-xs font-extrabold text-[var(--wn-text-primary)] cursor-pointer whitespace-nowrap"
                  >
                    360°
                  </button>

                  {['pending', 'accepted', 'completed'].includes(session.status) ? (
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={sc.actions.moreActions}
                        aria-expanded={menuOpen}
                        onClick={() => setOpenMenuId(menuOpen ? '' : session._id)}
                        className="min-h-[40px] min-w-[38px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] inline-flex items-center justify-center text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)] cursor-pointer"
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>

                      {menuOpen ? (
                        <div className="absolute end-0 top-full mt-1 z-30 w-48 rounded-2xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] shadow-xl p-1.5 space-y-0.5 text-xs font-bold">
                          {session.teacher?._id ? (
                            <button
                              type="button"
                              onClick={() => { setOpenMenuId(''); nudgeTeacher(session._id); }}
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-start flex items-center gap-2 hover:bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] cursor-pointer"
                            >
                              <BellRing size={14} className="text-[var(--wn-text-gold)]" aria-hidden="true" />
                              <span>{sc.actions.nudgeTeacher}</span>
                            </button>
                          ) : null}
                          {session.status === 'accepted' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openConfirmModal(session, 'completed')}
                                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-start flex items-center gap-2 hover:bg-[var(--wn-surface-soft)] text-[var(--wn-emerald-dark)] cursor-pointer"
                              >
                                <CheckCircle2 size={14} aria-hidden="true" />
                                <span>{sc.actions.complete}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openConfirmModal(session, 'no-show')}
                                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-start flex items-center gap-2 hover:bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] cursor-pointer"
                              >
                                <Clock3 size={14} aria-hidden="true" />
                                <span>{sc.actions.noShow}</span>
                              </button>
                            </>
                          ) : null}
                          {['pending', 'accepted'].includes(session.status) ? (
                            <button
                              type="button"
                              onClick={() => openConfirmModal(session, 'cancelled')}
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-xl text-start flex items-center gap-2 hover:bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] cursor-pointer"
                            >
                              <XCircle size={14} aria-hidden="true" />
                              <span>{sc.actions.cancel}</span>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {/* Layer 4: Slide-Over Session 360 Inspector Drawer */}
      <Session360Drawer
        session={selectedSession}
        onClose={() => setSelectedSessionId('')}
        onOpenStudent={onOpenStudent}
        onOpenTeacher={onOpenTeacher}
        onMessageStudent={onMessageStudent}
        onTriggerStatusModal={(sess, st) => openConfirmModal(sess, st)}
        onQuickCompleteGroup={(sid, resolveAs) =>
          updateSessionStatus(sid, 'completed', { resolvePendingAttendanceAs: resolveAs })
        }
        onNudgeTeacher={nudgeTeacher}
        onCopyText={copyText}
        busyId={updatingSessionId}
      />

      {/* Administrative Status Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => { if (!updatingSessionId) setConfirmAction(null); }}
        title={
          confirmAction?.nextStatus === 'accepted'
            ? sc.confirmModal.acceptTitle
            : confirmAction?.nextStatus === 'completed'
              ? sc.confirmModal.completeTitle
              : confirmAction?.nextStatus === 'no-show'
                ? sc.confirmModal.noShowTitle
                : sc.confirmModal.cancelTitle
        }
        disableClose={Boolean(updatingSessionId)}
      >
        {confirmAction ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>
              {confirmAction.nextStatus === 'accepted'
                ? sc.confirmModal.acceptBody
                : confirmAction.nextStatus === 'completed'
                  ? sc.confirmModal.completeBody
                  : confirmAction.nextStatus === 'no-show'
                    ? sc.confirmModal.noShowBody
                    : sc.confirmModal.cancelBody}
            </p>

            {confirmAction.nextStatus === 'completed' &&
              confirmAction.session?.type === 'group_circle' &&
              Number(confirmAction.session?.attendanceSummary?.unresolved || 0) > 0 ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--wn-text-primary)]">
                  {sc.confirmModal.resolveGroupLabel}
                </label>
                <select
                  value={confirmAction.resolvePendingAttendanceAs}
                  onChange={(e) =>
                    setConfirmAction((prev) => ({ ...prev, resolvePendingAttendanceAs: e.target.value }))
                  }
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-text-primary)]"
                >
                  <option value="attended">{sc.confirmModal.resolveAttendedOpt}</option>
                  <option value="absent">{sc.confirmModal.resolveAbsentOpt}</option>
                </select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--wn-text-primary)]">
                {sc.confirmModal.reasonLabel}
              </label>
              <input
                type="text"
                value={confirmAction.reason}
                onChange={(e) => setConfirmAction((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={sc.confirmModal.reasonPlaceholder}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs text-[var(--wn-text-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={Boolean(updatingSessionId)}
                onClick={() => setConfirmAction(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-secondary)] cursor-pointer disabled:opacity-50"
              >
                {sc.confirmModal.cancel}
              </button>
              <button
                type="button"
                disabled={Boolean(updatingSessionId)}
                onClick={async () => {
                  const needsResolve =
                    confirmAction.nextStatus === 'completed' &&
                    confirmAction.session?.type === 'group_circle' &&
                    Number(confirmAction.session?.attendanceSummary?.unresolved || 0) > 0;
                  const ok = await updateSessionStatus(confirmAction.sessionId, confirmAction.nextStatus, {
                    reason: confirmAction.reason,
                    ...(needsResolve
                      ? { resolvePendingAttendanceAs: confirmAction.resolvePendingAttendanceAs }
                      : {}),
                  });
                  if (ok) setConfirmAction(null);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  ['accepted', 'completed'].includes(confirmAction.nextStatus)
                    ? 'bg-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-danger)]'
                }`}
              >
                {updatingSessionId ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                <span>
                  {confirmAction.nextStatus === 'accepted'
                    ? sc.confirmModal.acceptConfirm
                    : confirmAction.nextStatus === 'completed'
                      ? sc.confirmModal.completeConfirm
                      : confirmAction.nextStatus === 'no-show'
                        ? sc.confirmModal.noShowConfirm
                        : sc.confirmModal.cancelConfirm}
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
