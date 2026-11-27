import { useEffect, useState } from 'react';
import { CalendarClock, Edit3, Loader2, Plus, Trash2, UsersRound } from 'lucide-react';
import Modal from '../../components/shared/Modal';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';

const DAY_KEYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value ?? '')),
    String(template || '')
  );
}

function durationOptionsFor(plan) {
  const min = plan?.durationMinMinutes || 1;
  const max = plan?.durationMaxMinutes || 60;
  return [30, 45, 60, 90, 120].filter((value) => value >= min && value <= max);
}

export default function SubscriptionCircleCard({ circle, teachers = [], allStudents = [], onChanged }) {
  const toast = useToast();
  const { locale, isRTL, t } = useI18n();
  const ps = t.payments.subscriptions;
  const psc = ps.card;
  const dash = t.adminPortal.common.dash;

  const [working, setWorking] = useState(false);
  const [schedule, setSchedule] = useState(
    circle.schedule?.length
      ? circle.schedule.map(({ day, startTime, endTime }) => ({ day, startTime, endTime }))
      : [{ day: 'Saturday', startTime: '', endTime: '' }]
  );
  const [timezone, setTimezone] = useState(circle.timezone || 'Africa/Cairo');
  const [sessionForm, setSessionForm] = useState({ scheduledAt: '', duration: durationOptionsFor(circle.plan)[0] || 60, notes: '' });
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editName, setEditName] = useState(circle.name || '');
  const [editTeacherId, setEditTeacherId] = useState(circle.teacher?._id || '');
  const [addStudentId, setAddStudentId] = useState('');
  const [grantScholarship, setGrantScholarship] = useState(false);
  const [confirmDeleteCircle, setConfirmDeleteCircle] = useState(false);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState(null);

  useEffect(() => {
    setEditName(circle.name || '');
    setEditTeacherId(circle.teacher?._id || '');
    if (circle.schedule?.length) {
      setSchedule(circle.schedule.map(({ day, startTime, endTime }) => ({ day, startTime, endTime })));
    }
    if (circle.timezone) {
      setTimezone(circle.timezone);
    }
  }, [circle._id, circle.name, circle.teacher?._id, circle.schedule, circle.timezone]);

  const running = ['active', 'full'].includes(circle.status);
  const paused = circle.status === 'paused';
  const roster = (circle.roster || []).filter((item) => item.status !== 'renewal_queued');
  const teacher = circle.teacher?.personalInfo?.fullName || circle.teacher?.user?.name || dash;
  const circlePlanName = locale === 'ar'
    ? (circle.plan?.name?.ar || circle.plan?.name?.en)
    : (circle.plan?.name?.en || circle.plan?.name?.ar);

  const start = async () => {
    if (working) return;
    if (schedule.some((row) => !row.startTime || !row.endTime || row.endTime <= row.startTime)) {
      toast.error(ps.toasts.startInvalidTime);
      return;
    }
    setWorking(true);
    try {
      await api.post('/api/subscriptions/admin/circles/' + circle._id + '/start', {
        schedule,
        timezone,
        allowUnderMinimum: Boolean(circle.missingToStart > 0),
      }, { auth: true });
      toast.success(ps.toasts.started);
      await onChanged();
    } catch (error) {
      toast.error(error.message || ps.toasts.startFailed);
    } finally {
      setWorking(false);
    }
  };

  const saveCircleEdits = async () => {
    if (working) return;
    if (!editName.trim()) return toast.error(ps.toasts.editNameRequired);
    const validSchedule = schedule.filter((row) => row.day && row.startTime && row.endTime);
    if (validSchedule.some((row) => row.endTime <= row.startTime)) {
      return toast.error(ps.toasts.startInvalidTime);
    }
    setWorking(true);
    try {
      await api.put('/api/subscriptions/admin/circles/' + circle._id, {
        name: editName.trim(),
        teacherId: editTeacherId || undefined,
        timezone,
        schedule: validSchedule,
      }, { auth: true });
      toast.success(ps.toasts.editSaved);
      setShowEditPanel(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || ps.toasts.editFailed);
    } finally {
      setWorking(false);
    }
  };

  const handleAddStudent = async () => {
    if (working) return;
    if (!addStudentId) return toast.error(ps.toasts.selectStudentFirst);
    setWorking(true);
    try {
      await api.post(`/api/subscriptions/admin/circles/${circle._id}/students`, {
        studentId: addStudentId,
        grantScholarship,
      }, { auth: true });
      toast.success(ps.toasts.studentAdded);
      setAddStudentId('');
      setGrantScholarship(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || ps.toasts.studentAddFailed);
    } finally {
      setWorking(false);
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!studentId || working) return;
    setWorking(true);
    try {
      await api.delete(`/api/subscriptions/admin/circles/${circle._id}/students/${studentId}`, { auth: true });
      toast.success(formatMsg(ps.toasts.studentRemoved, { name: studentName || ps.awaitingCard.studentFallback }));
      setConfirmRemoveStudent(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message || ps.toasts.studentRemoveFailed);
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteCircle = async () => {
    if (working) return;
    setWorking(true);
    try {
      await api.delete(`/api/subscriptions/admin/circles/${circle._id}`, { auth: true });
      toast.success(ps.toasts.circleDeleted);
      setConfirmDeleteCircle(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || ps.toasts.circleDeleteFailed);
    } finally {
      setWorking(false);
    }
  };

  const toggleCirclePause = async () => {
    if (working) return;
    const nextStatus = paused ? 'active' : 'paused';
    setWorking(true);
    try {
      await api.put('/api/subscriptions/admin/circles/' + circle._id + '/status', { status: nextStatus }, { auth: true });
      toast.success(nextStatus === 'paused' ? ps.toasts.circlePaused : ps.toasts.circleResumed);
      await onChanged();
    } catch (error) {
      toast.error(error.message || ps.toasts.statusUpdateFailed);
    } finally {
      setWorking(false);
    }
  };

  const scheduleSession = async () => {
    if (working) return;
    if (!sessionForm.scheduledAt) return toast.error(ps.toasts.selectSessionTime);
    setWorking(true);
    try {
      await api.post('/api/sessions/group-circle', {
        circleId: circle._id,
        ...sessionForm,
        duration: Number(sessionForm.duration),
        timezone,
      }, { auth: true });
      toast.success(ps.toasts.sessionScheduled);
      setSessionForm((current) => ({ ...current, scheduledAt: '', notes: '' }));
    } catch (error) {
      toast.error(error.message || ps.toasts.sessionScheduleFailed);
    } finally {
      setWorking(false);
    }
  };

  return (
    <article className="wn-dashboard-surface space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-lg text-[var(--wn-heading)]">{circle.name}</h3>
            <button
              type="button"
              onClick={() => setShowEditPanel((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:bg-[var(--wn-surface-sunken)] text-[var(--wn-text-primary)]"
            >
              <Edit3 size={13} aria-hidden="true" /> {showEditPanel ? psc.editClose : psc.editToggle}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => setConfirmDeleteCircle(true)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] disabled:opacity-50"
              title={psc.deleteTitle}
            >
              <Trash2 size={13} aria-hidden="true" /> {psc.deleteCircle}
            </button>
          </div>
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {teacher} · {circlePlanName || dash} · {circle.section === 'ladies' ? ps.awaitingCard.sectionLadies : ps.awaitingCard.sectionMenChildren}
          </p>
          <p className="text-xs text-[var(--wn-text-tertiary)]">{circle.code}</p>
        </div>
        <div className="text-center rounded-xl bg-[var(--wn-emerald-soft)] p-3 border border-[var(--wn-border-mint)]">
          <strong className="flex items-center justify-center gap-2 text-[var(--wn-heading)]">
            <UsersRound size={18} aria-hidden="true" /> {formatMsg(psc.studentsCount, { count: circle.studentCount, capacity: circle.capacity })}
          </strong>
          <p className="text-sm mt-1 text-[var(--wn-text-primary)]">
            {paused
              ? psc.paused
              : running
                ? psc.running
                : circle.missingToStart
                  ? formatMsg(psc.missingToStart, { count: circle.missingToStart })
                  : psc.readyToStart}
          </p>
          {(running || paused) ? (
            <button
              type="button"
              disabled={working}
              onClick={toggleCirclePause}
              className="mt-2 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] hover:bg-[var(--wn-surface-soft)] text-[var(--wn-heading)] transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {working ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
              {paused ? psc.resume : psc.pause}
            </button>
          ) : null}
        </div>
      </div>

      {showEditPanel ? (
        <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3">
          <h4 className="font-bold text-sm text-[var(--wn-heading)]">{psc.editPanelTitle}</h4>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{psc.editCircleName}</span>
              <input
                type="text"
                maxLength={120}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
              />
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{psc.editCircleTeacher}</span>
              <select
                value={editTeacherId}
                onChange={(e) => setEditTeacherId(e.target.value)}
                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
              >
                <option value={circle.teacher?._id || ''}>{teacher}</option>
                {teachers.filter((teacherItem) => String(teacherItem._id) !== String(circle.teacher?._id)).map((teacherItem) => (
                  <option key={teacherItem._id} value={teacherItem._id}>{teacherItem.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 font-bold text-[var(--wn-heading)]">
              <span>{psc.editTimezone}</span>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
              />
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-[var(--wn-border-mint)]">
            <span className="block text-xs font-bold text-[var(--wn-heading)]">{psc.editWeeklyTitle}</span>
            {schedule.map((row, index) => (
              <div key={index} className="grid sm:grid-cols-4 gap-2">
                <label className="text-xs font-semibold text-[var(--wn-heading)]">
                  {psc.editDayLabel}
                  <select
                    className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-sm mt-1"
                    value={row.day}
                    onChange={(event) => setSchedule((current) => current.map((item, position) => (position === index ? { ...item, day: event.target.value } : item)))}
                  >
                    {DAY_KEYS.map((day) => <option key={day} value={day}>{ps.days[day] || day}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-[var(--wn-heading)]">
                  {psc.editStartLabel}
                  <input
                    type="time"
                    className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-sm mt-1"
                    value={row.startTime}
                    onChange={(event) => setSchedule((current) => current.map((item, position) => (position === index ? { ...item, startTime: event.target.value } : item)))}
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--wn-heading)]">
                  {psc.editEndLabel}
                  <input
                    type="time"
                    className="block w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-sm mt-1"
                    value={row.endTime}
                    onChange={(event) => setSchedule((current) => current.map((item, position) => (position === index ? { ...item, endTime: event.target.value } : item)))}
                  />
                </label>
                <button
                  type="button"
                  className="wn-btn wn-btn--secondary self-end min-h-[44px] text-xs"
                  disabled={schedule.length === 1}
                  onClick={() => setSchedule((current) => current.filter((_, position) => position !== index))}
                >
                  {psc.deleteRowBtn}
                </button>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button
                type="button"
                className="wn-btn wn-btn--secondary min-h-[44px] text-xs"
                disabled={schedule.length >= 7}
                onClick={() => setSchedule((current) => [...current, { day: DAY_KEYS.find((day) => !current.some((row) => row.day === day)) || 'Saturday', startTime: '', endTime: '' }])}
              >
                {psc.addDayBtn}
              </button>
              <button type="button" disabled={working} onClick={saveCircleEdits} className="wn-btn wn-btn--primary min-h-[44px] text-xs">
                {working ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {working ? psc.savingEditsBtn : psc.saveEditsBtn}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <details>
        <summary className="cursor-pointer font-semibold text-[var(--wn-heading)] min-h-[44px] flex items-center">
          {formatMsg(psc.rosterSummary, { count: roster.length })}
        </summary>
        <div className="overflow-x-auto mt-3 space-y-3">
          <table className="w-full text-sm text-start">
            <thead>
              <tr className="border-b border-[var(--wn-border)]">
                <th className="p-2 whitespace-nowrap text-start">{psc.table.student}</th>
                <th className="p-2 whitespace-nowrap text-start">{psc.table.plan}</th>
                <th className="p-2 whitespace-nowrap text-start">{psc.table.used}</th>
                <th className="p-2 whitespace-nowrap text-start">{psc.table.remaining}</th>
                <th className="p-2 whitespace-nowrap text-start">{psc.table.status}</th>
                <th className="p-2 whitespace-nowrap text-start">{psc.table.action}</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((item) => (
                <tr key={item._id} className="border-b border-[var(--wn-border)]">
                  <td className="p-2 whitespace-nowrap">{item.student?.name || ps.awaitingCard.studentFallback}</td>
                  <td className="p-2 whitespace-nowrap">{item.sessionCount} {psc.table.sessionUnit}</td>
                  <td className="p-2 whitespace-nowrap">{item.sessionsUsed}</td>
                  <td className="p-2 whitespace-nowrap">{item.sessionsRemaining}</td>
                  <td className="p-2 whitespace-nowrap">
                    {item.status === 'active' ? psc.table.statusActive : item.status === 'paused' ? psc.table.statusPaused : psc.table.statusWaiting}
                    {circle.roster.some((renewal) => renewal.renewalOf === item._id && renewal.status === 'renewal_queued') ? ` · ${psc.table.renewalPaid}` : ''}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {item.student?._id ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setConfirmRemoveStudent({ id: item.student._id, name: item.student.name })}
                        className="text-xs text-[var(--wn-status-danger-text)] font-bold px-3 py-2 min-h-[44px] rounded border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] disabled:opacity-50"
                      >
                        {psc.removeStudent}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {allStudents.length > 0 && circle.studentCount < circle.capacity ? (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--wn-border)]">
              <select
                value={addStudentId}
                onChange={(e) => setAddStudentId(e.target.value)}
                className="flex-1 min-w-[220px] min-h-[44px] border border-[var(--wn-border)] rounded-lg p-2 text-xs bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                aria-label={psc.addStudentAria}
              >
                <option value="">{psc.addStudentPlaceholder}</option>
                {allStudents
                  .filter((s) => !roster.some((r) => String(r.student?._id) === String(s._id)))
                  .map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                  ))}
              </select>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--wn-heading)] cursor-pointer min-h-[44px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)]">
                <input
                  type="checkbox"
                  checked={grantScholarship}
                  onChange={(e) => setGrantScholarship(e.target.checked)}
                  className="w-4 h-4 accent-[var(--wn-emerald)]"
                />
                <span>{isRTL ? 'منحة دراسية (بدون اشتراك مدفوع)' : 'Grant scholarship (no paid sub)'}</span>
              </label>
              <button
                type="button"
                disabled={working || !addStudentId}
                onClick={handleAddStudent}
                className="wn-btn wn-btn--primary min-h-[44px] text-xs py-2 inline-flex items-center gap-1"
              >
                {working ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                {psc.addStudentBtn}
              </button>
            </div>
          ) : null}
        </div>
      </details>

      {running ? (
        <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2 text-[var(--wn-heading)]">
            <CalendarClock size={18} aria-hidden="true" /> {psc.scheduleTitle}
          </h4>
          <p className="text-sm text-[var(--wn-text-primary)]">
            {psc.weeklySchedule}: {(circle.schedule || []).map((row) => `${ps.days[row.day] || row.day} ${row.startTime}–${row.endTime}`).join('، ') || psc.noOldSchedule} · {timezone}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-[var(--wn-heading)]">
              {formatMsg(psc.sessionTimeLabel, { timezone })}
              <input
                type="datetime-local"
                className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                value={sessionForm.scheduledAt}
                onChange={(event) => setSessionForm((current) => ({ ...current, scheduledAt: event.target.value }))}
              />
            </label>
            <label className="text-sm font-semibold text-[var(--wn-heading)]">
              {psc.durationLabel}
              <select
                className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
                value={sessionForm.duration}
                onChange={(event) => setSessionForm((current) => ({ ...current, duration: event.target.value }))}
              >
                {durationOptionsFor(circle.plan).map((value) => <option key={value} value={value}>{value} {psc.minutesUnit}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-[var(--wn-heading)]">
            {psc.notesLabel}
            <input
              className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
              value={sessionForm.notes}
              onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <button type="button" className="wn-btn wn-btn--primary min-h-[44px]" disabled={working} onClick={scheduleSession}>
            {working ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
            {working ? psc.schedulingBtn : psc.scheduleBtn}
          </button>
          <p className="text-xs text-[var(--wn-text-secondary)]">{psc.scheduleHint}</p>
        </div>
      ) : !paused && circle.studentCount > 0 && !showEditPanel ? (
        <div className="rounded-xl border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-[var(--wn-status-warn-text)]">
              {psc.startHeader} {circle.missingToStart > 0 ? psc.earlyStartBadge : ''}
            </h4>
          </div>
          <label className="block text-sm font-semibold text-[var(--wn-heading)]">
            {psc.timezoneLabel}
            <input
              className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2 mt-1"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </label>
          {schedule.map((row, index) => (
            <div key={index} className="grid sm:grid-cols-4 gap-2">
              <label className="text-sm font-semibold text-[var(--wn-heading)]">
                {psc.startDayLabel}
                <select
                  className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2"
                  value={row.day}
                  onChange={(event) => setSchedule((current) => current.map((item, position) => (position === index ? { ...item, day: event.target.value } : item)))}
                >
                  {DAY_KEYS.map((day) => <option key={day} value={day}>{ps.days[day] || day}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--wn-heading)]">
                {psc.startFromLabel}
                <input
                  type="time"
                  className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2"
                  value={row.startTime}
                  onChange={(event) => setSchedule((current) => current.map((item, position) => (position === index ? { ...item, startTime: event.target.value } : item)))}
                />
              </label>
              <label className="text-sm font-semibold text-[var(--wn-heading)]">
                {psc.startToLabel}
                <input
                  type="time"
                  className="block w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg p-2"
                  value={row.endTime}
                  onChange={(event) => setSchedule((current) => current.map((item, position) => (position === index ? { ...item, endTime: event.target.value } : item)))}
                />
              </label>
              <button
                type="button"
                className="wn-btn wn-btn--secondary self-end min-h-[44px]"
                disabled={schedule.length === 1}
                onClick={() => setSchedule((current) => current.filter((_, position) => position !== index))}
              >
                {psc.deleteRowBtn}
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="wn-btn wn-btn--secondary min-h-[44px]"
              disabled={schedule.length >= 7}
              onClick={() => setSchedule((current) => [...current, { day: DAY_KEYS.find((day) => !current.some((row) => row.day === day)) || 'Saturday', startTime: '', endTime: '' }])}
            >
              {psc.addRowBtn}
            </button>
            <button type="button" className="wn-btn wn-btn--primary min-h-[44px]" disabled={working} onClick={start}>
              {working ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              {working ? psc.startingBtn : psc.startBtn}
            </button>
          </div>
          <p className="text-xs text-[var(--wn-text-secondary)]">{psc.startHint}</p>
        </div>
      ) : null}

      <Modal
        isOpen={confirmDeleteCircle}
        onClose={() => { if (!working) setConfirmDeleteCircle(false); }}
        title={psc.deleteConfirmTitle}
        disableClose={working}
      >
        <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
          <p>{formatMsg(psc.deleteConfirmBody, { name: circle.name })}</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
            <button
              type="button"
              disabled={working}
              onClick={() => setConfirmDeleteCircle(false)}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-[var(--wn-text-secondary)] disabled:opacity-50"
            >
              {ps.form.cancel}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={handleDeleteCircle}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {working ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
              {psc.deleteConfirmBtn}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(confirmRemoveStudent)}
        onClose={() => { if (!working) setConfirmRemoveStudent(null); }}
        title={psc.removeStudentConfirmTitle}
        disableClose={working}
      >
        {confirmRemoveStudent ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{formatMsg(psc.removeStudentConfirmBody, { name: confirmRemoveStudent.name || ps.awaitingCard.studentFallback })}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={working}
                onClick={() => setConfirmRemoveStudent(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-[var(--wn-text-secondary)] disabled:opacity-50"
              >
                {ps.form.cancel}
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => handleRemoveStudent(confirmRemoveStudent.id, confirmRemoveStudent.name)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {working ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                {psc.removeStudentConfirmBtn}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </article>
  );
}
