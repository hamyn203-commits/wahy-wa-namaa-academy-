import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle, Loader2, Phone, RefreshCw, UserCheck, XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminDashboardShell from '../AdminDashboard/AdminDashboardShell';
import EmptyState from '../../components/shared/EmptyState';
import Modal from '../../components/shared/Modal';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value ?? '')),
    String(template || '')
  );
}

const STATUS_STYLES = {
  pending: 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]',
  scheduled: 'bg-[var(--wn-status-info-bg)] text-[var(--wn-status-info-text)]',
  completed: 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]',
  no_show: 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]',
  cancelled: 'bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)]',
};

function teacherName(teacher, fallback) {
  return teacher?.personalInfo?.fullName || teacher?.user?.name || fallback;
}

function formatDate(value, intlLocale, dash, withTime = false) {
  if (!value) return dash;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dash;
  return withTime ? date.toLocaleString(intlLocale) : date.toLocaleDateString(intlLocale);
}

function AssignPanel({ trial, teachers, onDone, onCancel }) {
  const toast = useToast();
  const { t } = useI18n();
  const pt = t.payments.trials;
  const ap = pt.assignPanel;
  const teacherSelectId = useId();
  const scheduledInputId = useId();
  const notesInputId = useId();
  const [teacherId, setTeacherId] = useState(trial.assignedTeacher?._id || '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Suggest teachers matching the requested teacher gender first.
  const sortedTeachers = useMemo(() => {
    const wanted = trial.preferredTeacherGender;
    if (!wanted || wanted === 'any') return teachers;
    return [...teachers].sort((a, b) => {
      const aMatch = a.personalInfo?.gender === wanted ? 0 : 1;
      const bMatch = b.personalInfo?.gender === wanted ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [teachers, trial.preferredTeacherGender]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!teacherId || !scheduledAt) {
      toast.error(pt.toasts.selectTeacherAndTime);
      return;
    }
    setSaving(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
      const result = await api.put('/api/trials/' + trial._id + '/assign', {
        teacherId,
        scheduledAt,
        timezone,
        notes: notes.trim() || undefined,
      }, { auth: true });
      toast.success(result.studentLinked ? pt.toasts.scheduledLinked : pt.toasts.scheduledUnlinked);
      onDone();
    } catch (error) {
      toast.error(error.message || pt.toasts.scheduleFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="text-sm font-semibold space-y-1">
          <label htmlFor={teacherSelectId} className="block text-[var(--wn-heading)]">{ap.teacher}</label>
          <select
            id={teacherSelectId}
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
            className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
            required
          >
            <option value="">{ap.selectTeacher}</option>
            {sortedTeachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {teacherName(teacher, pt.card.teacherFallback)}
                {teacher.personalInfo?.gender ? (teacher.personalInfo.gender === 'female' ? ap.femaleSuffix : ap.maleSuffix) : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm font-semibold space-y-1">
          <label htmlFor={scheduledInputId} className="block text-[var(--wn-heading)]">{ap.scheduledAt}</label>
          <input
            id={scheduledInputId}
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
            required
          />
        </div>
      </div>
      <div className="text-sm font-semibold space-y-1">
        <label htmlFor={notesInputId} className="block text-[var(--wn-heading)]">{ap.notes}</label>
        <textarea
          id={notesInputId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          className="w-full border border-[var(--wn-border)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} disabled={saving} className="wn-btn wn-btn--secondary min-h-[44px]">
          {ap.cancel}
        </button>
        <button type="submit" disabled={saving} className="wn-btn wn-btn--primary min-h-[44px]">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CalendarClock size={16} aria-hidden="true" />}
          {saving ? ap.saving : ap.submit}
        </button>
      </div>
    </form>
  );
}

export default function AdminTrials() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const pt = t.payments.trials;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const cancelReasonId = useId();
  const showLoadError = toast.error;
  const [filter, setFilter] = useState('all');
  const [trials, setTrials] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [working, setWorking] = useState('');
  const [cancelModal, setCancelModal] = useState(null);
  const [noShowModal, setNoShowModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const query = filter === 'all' ? '' : '?status=' + encodeURIComponent(filter);
      const [trialResult, teacherResult] = await Promise.all([
        api.get('/api/trials' + query + (query ? '&' : '?') + 'limit=50', { auth: true }),
        api.get('/api/admin/teachers/approved', { auth: true }).catch(() => []),
      ]);
      setTrials(trialResult.trials || []);
      setTeachers(Array.isArray(teacherResult) ? teacherResult : (teacherResult?.teachers || []));
    } catch (error) {
      const message = error.message || pt.loadError;
      setLoadError(message);
      setTrials([]);
      showLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [filter, showLoadError, pt.loadError]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const updateStatus = async (trial, status, reason = '') => {
    if (working) return false;
    setWorking(trial._id);
    try {
      await api.put('/api/trials/' + trial._id + '/status', { status, reason }, { auth: true });
      toast.success(status === 'cancelled' ? pt.toasts.cancelled : pt.toasts.updated);
      await load();
      return true;
    } catch (error) {
      toast.error(error.message || pt.toasts.updateFailed);
      return false;
    } finally {
      setWorking('');
    }
  };

  if (!ready) return null;

  const isCancelling = Boolean(cancelModal && working === cancelModal.trial._id);
  const isMarkingNoShow = Boolean(noShowModal && working === noShowModal._id);

  const handleTabChange = (nextTab) => {
    navigate(`${localizedPath('/admin', locale)}?tab=${encodeURIComponent(nextTab)}`);
  };
  const handleAdminRoute = (route) => {
    if (route === 'trials') return;
    navigate(localizedPath(`/admin/${route}`, locale));
  };

  return (
    <AdminDashboardShell
      user={user}
      active="trials"
      pageTitle={pt.title}
      onChange={handleTabChange}
      onNavigate={handleAdminRoute}
      onLogout={logout}
    >
      <SEOHead page={{ title: pt.seoTitle, description: pt.seoDesc, noindex: true, canonical: false }} />
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate('..', { relative: 'path' })} className="wn-btn wn-btn--secondary min-h-[44px]">
          {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />} {pt.backToAdmin}
        </button>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm"
            aria-label={pt.filterAria}
          >
            <option value="pending">{pt.statuses.pending}</option>
            <option value="scheduled">{pt.statuses.scheduled}</option>
            <option value="completed">{pt.statuses.completed}</option>
            <option value="no_show">{pt.statuses.no_show}</option>
            <option value="cancelled">{pt.statuses.cancelled}</option>
            <option value="all">{pt.statuses.all}</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px]"
            disabled={loading}
            aria-label={pt.refreshAria}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!loading && !loadError && teachers.length === 0 ? (
        <div className="mb-4 rounded-lg border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] p-3 text-sm text-[var(--wn-status-warn-text)]">
          {pt.noTeachersWarning}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4" role="status" aria-label={t.adminPortal.common.loading}>
          {[1, 2, 3].map((row) => (
            <div key={row} className="wn-dashboard-surface space-y-3">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div role="alert" className="wn-dashboard-surface border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} aria-hidden="true" />
            <span className="font-semibold">{loadError}</span>
          </div>
          <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
            {pt.retry}
          </button>
        </div>
      ) : trials.length === 0 ? (
        <div className="wn-dashboard-surface">
          <EmptyState title={pt.empty} />
        </div>
      ) : (
        <div className="space-y-4">
          {trials.map((trial) => {
            const session = trial.scheduledSession && typeof trial.scheduledSession === 'object' ? trial.scheduledSession : null;
            const canSchedule = ['pending', 'scheduled', 'no_show'].includes(trial.status);
            const isBusy = working === trial._id;

            return (
              <div key={trial._id} className="wn-dashboard-surface">
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-[var(--wn-heading)]">
                      {trial.studentName}
                      <span className="text-sm font-normal text-[var(--wn-text-secondary)]">
                        {' '}— {trial.age} {pt.card.yearsSuffix}، {trial.gender === 'female' ? pt.card.female : pt.card.male}
                      </span>
                    </h3>
                    {trial.guardianName ? <p className="text-sm text-[var(--wn-text-primary)]">{pt.card.guardian}: <strong>{trial.guardianName}</strong></p> : null}
                    <p className="text-sm flex items-center gap-1">
                      <Phone size={14} aria-hidden="true" />
                      <a href={'https://wa.me/' + String(trial.whatsappPhone || '').replace(/\D/g, '')} target="_blank" rel="noopener noreferrer" className="text-[var(--wn-link)] underline" dir="ltr">
                        {trial.whatsappPhone}
                      </a>
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {pt.card.track}: <strong>{pt.tracks[trial.preferredTrack] || trial.preferredTrack}</strong>
                      {trial.currentLevel ? <> · {pt.card.level}: <strong>{trial.currentLevel}</strong></> : null}
                    </p>
                    <p className="text-sm text-[var(--wn-text-primary)]">
                      {pt.card.preference}: <strong>{pt.slots[trial.preferredTimeSlot] || trial.preferredTimeSlot || dash}</strong>
                      {trial.preferredDate ? <> · {formatDate(trial.preferredDate, intlLocale, dash)}</> : null}
                      {trial.preferredTeacherGender && trial.preferredTeacherGender !== 'any'
                        ? <> · {trial.preferredTeacherGender === 'female' ? pt.card.prefersFemaleTeacher : pt.card.prefersMaleTeacher}</>
                        : null}
                    </p>
                    <p className="text-xs text-[var(--wn-text-secondary)]">
                      {trial.studentUser ? (
                        <span className="inline-flex items-center gap-1 text-[var(--wn-emerald)]">
                          <UserCheck size={12} aria-hidden="true" />
                          {formatMsg(pt.card.linkedAccount, { name: trial.studentUser.name || trial.studentUser.email || pt.card.studentFallback })}
                        </span>
                      ) : pt.card.noAccount}
                      {trial.referenceNumber ? <> · {pt.card.refPrefix} <span dir="ltr">{trial.referenceNumber}</span></> : null}
                      {' · '}{formatDate(trial.createdAt, intlLocale, dash, true)}
                    </p>
                    {trial.notes ? <p className="text-xs text-[var(--wn-text-secondary)] whitespace-pre-line">{pt.card.notes}: {trial.notes}</p> : null}
                    {trial.assignedTeacher ? (
                      <div className="space-y-1">
                        <p className="text-sm text-[var(--wn-text-primary)]">
                          {pt.card.teacher}: <strong>{teacherName(trial.assignedTeacher, pt.card.teacherFallback)}</strong>
                          {session?.scheduledAt ? <> · {pt.card.scheduledAt}: <strong>{formatDate(session.scheduledAt, intlLocale, dash, true)}</strong></> : null}
                        </p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)] px-2.5 py-0.5 text-xs font-semibold">
                          <UserCheck size={12} aria-hidden="true" />
                          {isRTL
                            ? `مُسندة للمعلم مباشرة (${session?.status === 'pending' ? 'بانتظار قبول المعلم' : 'مؤكدة'}) — للعلم والمتابعة`
                            : `Assigned to teacher (${session?.status === 'pending' ? 'awaiting teacher acceptance' : 'confirmed'}) — FYI`}
                        </span>
                      </div>
                    ) : null}
                    {trial.assessment?.level ? (
                      <p className="text-sm text-[var(--wn-emerald)]">
                        {pt.card.assessment}: {pt.card.level} <strong>{trial.assessment.level}</strong> · {pt.card.recommendedTrack} <strong>{pt.tracks[trial.assessment.recommendedTrack] || trial.assessment.recommendedTrack}</strong>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={'text-xs px-3 py-1 rounded-full font-semibold ' + (STATUS_STYLES[trial.status] || 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]')}>
                      {pt.statuses[trial.status] || trial.status}
                    </span>
                    {canSchedule ? (
                      <button
                        type="button"
                        onClick={() => setActiveId(activeId === trial._id ? '' : trial._id)}
                        className="wn-btn wn-btn--primary min-h-[44px]"
                        disabled={Boolean(working)}
                      >
                        <CalendarClock size={16} aria-hidden="true" /> {trial.status === 'pending' ? pt.card.assignBtn : pt.card.rescheduleBtn}
                      </button>
                    ) : null}
                    {trial.status === 'scheduled' ? (
                      <button
                        type="button"
                        onClick={() => setNoShowModal(trial)}
                        disabled={Boolean(working)}
                        className="wn-btn wn-btn--secondary min-h-[44px]"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                        {pt.card.noShowBtn}
                      </button>
                    ) : null}
                    {['pending', 'scheduled'].includes(trial.status) ? (
                      <button
                        type="button"
                        onClick={() => setCancelModal({ trial, reason: '' })}
                        disabled={Boolean(working)}
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <XCircle size={16} aria-hidden="true" /> {pt.card.cancelBtn}
                      </button>
                    ) : null}
                  </div>
                </div>

                {activeId === trial._id ? (
                  <AssignPanel
                    trial={trial}
                    teachers={teachers}
                    onCancel={() => setActiveId('')}
                    onDone={() => { setActiveId(''); load(); }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(noShowModal)}
        onClose={() => { if (!isMarkingNoShow) setNoShowModal(null); }}
        title={pt.noShowModal.title}
        disableClose={isMarkingNoShow}
      >
        {noShowModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{formatMsg(pt.noShowModal.body, { name: noShowModal.studentName || pt.card.studentFallback })}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={isMarkingNoShow}
                onClick={() => setNoShowModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {pt.noShowModal.cancel}
              </button>
              <button
                type="button"
                disabled={isMarkingNoShow}
                onClick={async () => {
                  const ok = await updateStatus(noShowModal, 'no_show');
                  if (ok) setNoShowModal(null);
                }}
                className="wn-btn wn-btn--primary min-h-[44px] disabled:opacity-50"
              >
                {isMarkingNoShow ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {pt.noShowModal.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(cancelModal)}
        onClose={() => { if (!isCancelling) setCancelModal(null); }}
        title={pt.cancelModal.title}
        disableClose={isCancelling}
      >
        {cancelModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{pt.cancelModal.student} <strong>{cancelModal.trial.studentName || dash}</strong></p>
            <div>
              <label htmlFor={cancelReasonId} className="block text-xs font-semibold text-[var(--wn-heading)] mb-1">
                {pt.cancelModal.reasonLabel}
              </label>
              <textarea
                id={cancelReasonId}
                rows={3}
                value={cancelModal.reason}
                disabled={isCancelling}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                className="w-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
                placeholder={pt.cancelModal.reasonPlaceholder}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancelModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {pt.cancelModal.back}
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={async () => {
                  const targetTrial = cancelModal.trial;
                  const reason = cancelModal.reason.trim();
                  const ok = await updateStatus(targetTrial, 'cancelled', reason);
                  if (ok) setCancelModal(null);
                }}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-medium rounded-lg bg-[var(--wn-danger)] inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isCancelling ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {isCancelling ? pt.cancelModal.confirming : pt.cancelModal.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AdminDashboardShell>
  );
}
