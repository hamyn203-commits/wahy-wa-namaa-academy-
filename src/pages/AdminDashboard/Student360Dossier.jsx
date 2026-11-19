import {
  X, UserRound, Users, Calendar, BookOpen, CreditCard, Bell, GraduationCap,
  PlayCircle, CheckCircle2, AlertTriangle, History, MessageSquare, TrendingUp, Trash2, Loader2,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { formatMsg, localizedValue, useFocusTrapDialog } from './adminFormat';

function studentAvatarUrl(value) {
  const reference = String(value || '').trim();
  if (!reference) return '';
  try {
    const url = new URL(reference, 'https://wahy.invalid');
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')
      && url.pathname.startsWith('/uploads/student-avatar/')) {
      return '/api/uploads/public?ref=' + encodeURIComponent(reference);
    }
    if (reference.startsWith('/') && !reference.startsWith('//')) return reference;
  } catch { return ''; }
  return '';
}

function whatsappLink(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1) : raw;
  const normalized = digits.startsWith('0') && digits.length === 11 ? '20' + digits.slice(1) : digits;
  return /^\d{8,15}$/.test(normalized) ? 'https://wa.me/' + normalized : '';
}

function Info({ label, value, dash = '—' }) {
  return (
    <div className="wn-admin-360__info">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? dash : String(value)}</strong>
    </div>
  );
}

export default function Student360Dossier({
  dossier,
  loading,
  onClose,
  onOpenGuardian,
  onOpenTeacher,
  onOpenHomeworkAudio,
  onMessageStudent,
  onUpdateStudent,
  onDeleteStudent,
}) {
  const { locale, dir, t } = useI18n();
  const s360 = t.adminPortal.dossiers.student360;
  const ef = s360.editForm;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const titleId = useId();
  const dialogRef = useRef(null);

  useFocusTrapDialog(Boolean(dossier), onClose, dialogRef);

  const student = dossier?.student;
  const summary = dossier?.summary || {};
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    whatsappPhone: '',
    age: 12,
    gender: 'male',
    enrollmentSection: 'men_children',
    currentLevel: 'beginner',
    customLevel: '',
    preferredTrack: 'memorization',
    memorizedJuz: 0,
    memorizationDetails: '',
    newPassword: '',
    isActive: true,
  });
  const [savingStudent, setSavingStudent] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
    if (!student) return;
    setForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      whatsappPhone: student.whatsappPhone || '',
      age: student.age ?? 12,
      gender: student.gender || 'male',
      enrollmentSection: student.enrollmentSection || (student.gender === 'female' ? 'ladies' : 'men_children'),
      currentLevel: student.currentLevel || 'beginner',
      customLevel: student.customLevel || '',
      preferredTrack: student.preferredTrack || 'memorization',
      memorizedJuz: student.memorizedJuz ?? 0,
      memorizationDetails: student.memorizationDetails || '',
      newPassword: '',
      isActive: student.isActive !== false,
    });
  }, [student]);

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!onUpdateStudent || !student?._id || savingStudent) return;
    setSavingStudent(true);
    try {
      await onUpdateStudent(student._id, {
        ...form,
        age: Number(form.age) || 12,
        memorizedJuz: Number(form.memorizedJuz) || 0,
        isActive: Boolean(form.isActive),
      });
      setForm((prev) => ({ ...prev, newPassword: '' }));
    } finally {
      setSavingStudent(false);
    }
  };

  const avatarSrc = !avatarFailed ? studentAvatarUrl(student?.avatar) : '';

  return (
    <div
      className="wn-admin-dossier-backdrop"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <div ref={dialogRef} tabIndex={-1} className="wn-admin-dossier wn-admin-people-dossier">
        <header className="wn-admin-dossier__header">
          <div>
            <span>{s360.eyebrow || 'Student 360'}</span>
            <h2 id={titleId}>{student?.name || s360.headerTitleFallback}</h2>
            <p>{student?.email || dash} · {student?.phone || dash}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {student?._id && (
                <button type="button" onClick={() => onMessageStudent?.(student._id)} className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] px-4 py-2 text-[var(--wn-text-inverse)] font-semibold">
                  <MessageSquare size={17} aria-hidden="true" /> {s360.messageBtn}
                </button>
              )}
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={s360.avatarAlt}
                  onError={() => setAvatarFailed(true)}
                  className="w-16 h-16 rounded-full object-cover border border-[var(--wn-border)]"
                />
              ) : student?.name ? (
                <span className="w-16 h-16 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border border-[var(--wn-border-mint)] flex items-center justify-center text-xl font-bold" aria-hidden="true">
                  {student.name.trim().slice(0, 1)}
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.adminPortal.dossiers.closeAria} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="wn-admin-dossier__loading space-y-3" role="status" aria-label={t.adminPortal.dossiers.loadingStudent}>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : (
          <div className="wn-admin-dossier__body">
            <section className="wn-admin-360-summary">
              <div><Calendar size={18} aria-hidden="true" /><span><strong>{summary.totalSessions || 0}</strong><small>{s360.summary.total}</small></span></div>
              <div><CheckCircle2 size={18} aria-hidden="true" /><span><strong>{summary.completedSessions || 0}</strong><small>{s360.summary.completed}</small></span></div>
              <div><BookOpen size={18} aria-hidden="true" /><span><strong>{summary.pendingHomework || 0}</strong><small>{s360.summary.pendingHw}</small></span></div>
              <div className={summary.absentSessions ? 'is-alert' : ''}><AlertTriangle size={18} aria-hidden="true" /><span><strong>{summary.absentSessions || 0}</strong><small>{s360.summary.absent}</small></span></div>
              <div><Users size={18} aria-hidden="true" /><span><strong>{summary.guardians || 0}</strong><small>{s360.summary.guardians}</small></span></div>
              <div><GraduationCap size={18} aria-hidden="true" /><span><strong>{summary.activeEnrollments || 0}</strong><small>{s360.summary.courses}</small></span></div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><UserRound size={18} aria-hidden="true" /><h3>{s360.sections.account}</h3></div>
              <div className="wn-admin-dossier__grid">
                <Info label={s360.fields.name} value={student?.name} dash={dash} />
                <Info label={s360.fields.email} value={student?.email} dash={dash} />
                <Info label={s360.fields.phone} value={student?.phone} dash={dash} />
                <div className="wn-admin-360__info">
                  <span>{s360.fields.whatsapp}</span>
                  {whatsappLink(student?.whatsappPhone || student?.phone) ? (
                    <a href={whatsappLink(student?.whatsappPhone || student?.phone)} target="_blank" rel="noopener noreferrer" className="text-[var(--wn-link)] font-bold underline">
                      {s360.whatsappCta}
                    </a>
                  ) : <strong>{s360.whatsappUnavailable}</strong>}
                </div>
                <Info label={s360.fields.age} value={student?.age} dash={dash} />
                <Info label={s360.fields.gender} value={student?.gender} dash={dash} />
                <Info label={s360.fields.level} value={student?.customLevel || student?.currentLevel} dash={dash} />
                <Info label={s360.fields.memorizedJuz} value={student?.memorizedJuz} dash={dash} />
                <Info label={s360.fields.memorizationDetails} value={student?.memorizationDetails} dash={dash} />
                <Info label={s360.fields.track} value={student?.preferredTrack} dash={dash} />
                <Info label={s360.fields.circle} value={student?.circle?.name} dash={dash} />
                <Info label={s360.fields.accountStatus} value={student?.isActive === false ? s360.statuses.suspended : s360.statuses.active} dash={dash} />
                <Info label={s360.fields.emailVerified} value={student?.emailVerified ? s360.statuses.yes : s360.statuses.no} dash={dash} />
                <Info label={s360.fields.lastLogin} value={student?.lastLogin ? new Date(student.lastLogin).toLocaleString(intlLocale) : dash} dash={dash} />
              </div>
              {onUpdateStudent && student?._id ? (
                <form onSubmit={handleSaveStudent} className="mt-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-xs text-[var(--wn-heading)]">{ef.title}</div>
                    {onDeleteStudent ? (
                      <button
                        type="button"
                        onClick={() => onDeleteStudent(student._id, student.name || s360.headerTitleFallback)}
                        className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)]"
                      >
                        <Trash2 size={14} aria-hidden="true" /> {ef.deleteBtn}
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.name}</span>
                      <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.email}</span>
                      <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.phone}</span>
                      <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.whatsapp}</span>
                      <input type="text" value={form.whatsappPhone} onChange={(e) => setForm((p) => ({ ...p, whatsappPhone: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.age}</span>
                      <input type="number" min="4" max="100" value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.gender}</span>
                      <select value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                        <option value="male">{ef.genderMale}</option>
                        <option value="female">{ef.genderFemale}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.section}</span>
                      <select value={form.enrollmentSection} onChange={(e) => setForm((p) => ({ ...p, enrollmentSection: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                        <option value="men_children">{ef.sectionMenChildren}</option>
                        <option value="ladies">{ef.sectionLadies}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.newPassword}</span>
                      <input type="password" placeholder={ef.newPasswordPlaceholder} value={form.newPassword} onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.level}</span>
                      <select value={form.currentLevel} onChange={(e) => setForm((p) => ({ ...p, currentLevel: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                        <option value="beginner">{ef.levels.beginner}</option>
                        <option value="intermediate">{ef.levels.intermediate}</option>
                        <option value="advanced">{ef.levels.advanced}</option>
                        <option value="ijazah">{ef.levels.ijazah}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.track}</span>
                      <select value={form.preferredTrack} onChange={(e) => setForm((p) => ({ ...p, preferredTrack: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                        <option value="memorization">{ef.tracks.memorization}</option>
                        <option value="tajweed_ijazah">{ef.tracks.tajweed_ijazah}</option>
                        <option value="kids_foundation">{ef.tracks.kids_foundation}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.memorizedJuz}</span>
                      <input type="number" min="0" max="30" value={form.memorizedJuz} onChange={(e) => setForm((p) => ({ ...p, memorizedJuz: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.accountStatus}</span>
                      <select value={form.isActive ? 'active' : 'suspended'} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'active' }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                        <option value="active">{ef.statusActive}</option>
                        <option value="suspended">{ef.statusSuspended}</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.customLevel}</span>
                      <input type="text" value={form.customLevel} onChange={(e) => setForm((p) => ({ ...p, customLevel: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{ef.memorizationDetails}</span>
                      <input type="text" value={form.memorizationDetails} onChange={(e) => setForm((p) => ({ ...p, memorizationDetails: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={savingStudent} className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-2 transition disabled:opacity-50">
                      {savingStudent ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                      {savingStudent ? ef.savingBtn : ef.saveBtn}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Users size={18} aria-hidden="true" /><h3>{s360.sections.family}</h3></div>
              {(dossier.guardians || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{s360.familySection.empty}</p>
              ) : (
                <div className="wn-admin-360-list">
                  {(dossier.guardians || []).map((guardian) => (
                    <button type="button" key={guardian.guardianProfileId} onClick={() => onOpenGuardian?.(guardian.user?._id)} className="min-h-[44px]">
                      <span><strong>{guardian.user?.name || s360.familySection.guardianFallback}</strong><small>{guardian.relationship} · {guardian.user?.email || dash} · {guardian.user?.phone || dash}</small></span>
                      <span>{s360.familySection.openFamily360}</span>
                    </button>
                  ))}
                </div>
              )}

              {(dossier.guardianInvitations || []).length > 0 && (
                <div className="wn-admin-360-subsection">
                  <strong>{s360.familySection.invitesTitle}</strong>
                  {(dossier.guardianInvitations || []).map((invitation) => (
                    <div key={invitation._id}>
                      <span>{invitation.relationship} · {invitation.phoneMasked || dash}</span>
                      <b>{invitation.status}</b>
                      <small>{new Date(invitation.createdAt).toLocaleString(intlLocale)}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Calendar size={18} aria-hidden="true" /><h3>{s360.sections.sessions}</h3></div>
              {(dossier.sessions || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{s360.attendance.noSessions}</p>
              ) : (
                <div className="wn-admin-session-timeline">
                  {(dossier.sessions || []).slice(0, 40).map((session) => (
                    <article key={session._id}>
                      <div>
                        <span>{formatSessionDateTime(session, locale, { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session)}</span>
                        <h4>{session.teacher?.name || s360.attendance.teacherFallback} · {session.type}</h4>
                        <small>{session.status} · {s360.attendance.prefix} {session.attendanceStatus || dash} · {session.duration || 0} {s360.attendance.minutesUnit}</small>
                      </div>
                      <div className="wn-admin-session-timeline__actions">
                        {session.teacher?.id ? (
                          <button type="button" onClick={() => onOpenTeacher?.(session.teacher.id)} className="min-h-[44px]">{s360.attendance.teacherDossierBtn}</button>
                        ) : null}
                        {session.recordingAvailable ? <span>{s360.attendance.recordingAvailable}</span> : null}
                      </div>
                      {session.report ? (
                        <div className="wn-admin-session-report">
                          <span>{s360.attendance.memLabel} <b>{session.report.memorizationScore ?? dash}/10</b></span>
                          <span>{s360.attendance.tajLabel} <b>{session.report.tajweedScore ?? dash}/10</b></span>
                          <p>{session.report.surahRecited ? `${s360.attendance.recitedPrefix} ${session.report.surahRecited}` : ''}</p>
                          <p>{session.report.nextHomework ? `${s360.attendance.nextHwPrefix} ${session.report.nextHomework}` : ''}</p>
                          {session.report.notes ? <p>{s360.attendance.notesPrefix} {session.report.notes}</p> : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><BookOpen size={18} aria-hidden="true" /><h3>{s360.sections.homework}</h3></div>
              {(dossier.homework || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{s360.homework.empty}</p>
              ) : (
                <div className="wn-admin-homework-list">
                  {(dossier.homework || []).map((task) => (
                    <article key={task._id}>
                      <div>
                        <span>{task.status}</span>
                        <h4>{task.title}</h4>
                        <small>{task.teacher?.name || s360.homework.teacherFallback} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString(intlLocale) : s360.homework.noDueDate}</small>
                        {task.description ? <p>{task.description}</p> : null}
                        {task.teacherFeedback ? <p><strong>{s360.homework.feedbackPrefix}</strong> {task.teacherFeedback}</p> : null}
                      </div>
                      {task.submissionAvailable ? (
                        <button type="button" onClick={() => onOpenHomeworkAudio?.(task._id)} className="min-h-[44px]">
                          <PlayCircle size={16} aria-hidden="true" /> {s360.homework.openSubmission}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><TrendingUp size={18} aria-hidden="true" /><h3>{s360.sections.progress}</h3></div>
              <div className="wn-admin-360-columns">
                <div>
                  <strong>{s360.progress.coursesTitle}</strong>
                  {(dossier.enrollments || []).length === 0 ? <small>{s360.progress.noCourses}</small> : (dossier.enrollments || []).map((entry) => (
                    <div key={entry._id}><span>{localizedValue(entry.course?.title, locale, dash)}</span><b>{entry.status}</b><small>{entry.progress?.percentage || 0}%</small></div>
                  ))}
                </div>
                <div>
                  <strong>{s360.progress.metricsTitle}</strong>
                  {(dossier.progress || []).length === 0 ? <small>{s360.progress.noProgress}</small> : (dossier.progress || []).map((entry) => (
                    <div key={entry._id}><span>{localizedValue(entry.course?.title, locale, dash)}</span><b>{Math.round(entry.overallProgress?.percentage || 0)}%</b><small>{formatMsg(s360.progress.averagePrefix, { score: Math.round(entry.overallProgress?.averageScore || 0) })}</small></div>
                  ))}
                </div>
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><CreditCard size={18} aria-hidden="true" /><h3>{s360.sections.subscriptionsPayments}</h3></div>
              {(dossier.subscriptions || []).length > 0 ? (
                <div className="mb-4 space-y-2">
                  <strong className="block text-xs text-[var(--wn-emerald)]">
                    {formatMsg(s360.subscriptions.heading, { count: dossier.subscriptions.length })}
                  </strong>
                  <div className="wn-admin-360-table">
                    {(dossier.subscriptions || []).map((sub) => (
                      <div key={sub._id}>
                        <span>
                          <strong>{locale === 'ar' ? (sub.pricingSnapshot?.nameAr || sub.pricingSnapshot?.nameEn || sub.planKey || s360.subscriptions.planFallback) : (sub.pricingSnapshot?.nameEn || sub.pricingSnapshot?.nameAr || sub.planKey || s360.subscriptions.planFallback)}</strong>
                          <small>{sub.circle?.name || s360.subscriptions.awaitingPlacement} · {sub.section === 'ladies' ? s360.subscriptions.sectionLadies : s360.subscriptions.sectionMenChildren}</small>
                        </span>
                        <span>
                          <strong>{formatMsg(s360.subscriptions.balance, { remaining: sub.sessionsRemaining ?? 0, total: sub.sessionCount ?? 0 })}</strong>
                          <small>{sub.status}</small>
                        </span>
                        <small>{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString(intlLocale) : dash}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {(dossier.payments || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{s360.subscriptions.noPayments}</p>
              ) : (
                <div className="wn-admin-360-table">
                  {(dossier.payments || []).map((payment) => (
                    <div key={payment._id}>
                      <span>
                        <strong>
                          {payment.subscription?.pricingSnapshot?.nameAr
                            ? (locale === 'ar' ? payment.subscription.pricingSnapshot.nameAr : (payment.subscription.pricingSnapshot.nameEn || payment.subscription.pricingSnapshot.nameAr))
                            : (payment.kind === 'subscription' ? s360.subscriptions.subPaymentFallback : localizedValue(payment.course?.title, locale, dash))}
                        </strong>
                        <small>{payment.provider}</small>
                      </span>
                      <span><strong>{(Number(payment.amountMinor || 0) / 100).toFixed(2)} {payment.currency}</strong><small>{payment.status}</small></span>
                      <small>{new Date(payment.createdAt).toLocaleString(intlLocale)}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><MessageSquare size={18} aria-hidden="true" /><h3>{s360.sections.teacherUpdates}</h3></div>
              {(dossier.teacherUpdates || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{s360.updates.empty}</p>
              ) : (
                <div className="wn-admin-360-feed">
                  {(dossier.teacherUpdates || []).map((update) => (
                    <article key={update._id}>
                      <span>{update.teacher?.personalInfo?.fullName || s360.updates.teacherFallback}</span>
                      <h4>{update.title}</h4>
                      <p>{update.message}</p>
                      <small>{formatMsg(s360.updates.videosCount, { count: update.videoCount || 0 })} · {new Date(update.publishedAt || update.createdAt).toLocaleString(intlLocale)}</small>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Bell size={18} aria-hidden="true" /><h3>{s360.sections.notifications}</h3></div>
              <div className="wn-admin-360-feed">
                {(dossier.notifications || []).slice(0, 30).map((notice) => (
                  <article key={notice._id}>
                    <span>{notice.type}</span>
                    <h4>{localizedValue(notice.title, locale, s360.notifications.defaultTitle)}</h4>
                    <p>{localizedValue(notice.message, locale, '')}</p>
                    <small>{notice.isRead ? s360.statuses.read : s360.statuses.unread} · {new Date(notice.createdAt).toLocaleString(intlLocale)}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><History size={18} aria-hidden="true" /><h3>{s360.sections.audit}</h3></div>
              {(dossier.audit || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{s360.auditEmpty}</p>
              ) : (
                <div className="wn-admin-audit-list">
                  {(dossier.audit || []).map((entry) => (
                    <div key={entry._id}>
                      <span><strong>{entry.actor?.name || s360.actorFallback}</strong><small>{new Date(entry.createdAt).toLocaleString(intlLocale)}</small></span>
                      <span><strong>{entry.action}</strong><small>{entry.reason || dash}</small></span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

