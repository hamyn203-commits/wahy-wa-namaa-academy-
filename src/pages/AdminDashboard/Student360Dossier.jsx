import {
  X, UserRound, Users, Calendar, BookOpen, CreditCard, Bell, GraduationCap,
  PlayCircle, CheckCircle2, AlertTriangle, History, MessageSquare, TrendingUp, Trash2, Loader2,
  Edit3, Plus, Minus, RefreshCw, Sparkles, PauseCircle, Ban, ArrowUpRight, Download,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
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

function extensionFromMime(mime = '') {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3';
  if (normalized.includes('mp4') || normalized.includes('m4a')) return '.m4a';
  if (normalized.includes('ogg')) return '.ogg';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('pdf')) return '.pdf';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  return '';
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
  onRefreshStudent,
  onNavigateSubscriptions,
  approvedTeachers = [],
}) {
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();
  const s360 = t.adminPortal.dossiers.student360;
  const ef = s360.editForm;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const titleId = useId();
  const dialogRef = useRef(null);

  useFocusTrapDialog(Boolean(dossier), onClose, dialogRef);

  const student = dossier?.student;
  const summary = dossier?.summary || {};
  const [activeSection, setActiveSection] = useState('all');
  const [showEditForm, setShowEditForm] = useState(false);
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

  // Subscription & Scholarship management states
  const [showScholarshipForm, setShowScholarshipForm] = useState(false);
  const [scholarshipForm, setScholarshipForm] = useState({
    planKey: 'group',
    sessionCount: 8,
    preferredTeacherId: '',
    reason: '',
  });
  const [subActionState, setSubActionState] = useState(null);
  const [workingSubAction, setWorkingSubAction] = useState(false);

  // Inline homework audio/media preview state
  const [homeworkMedia, setHomeworkMedia] = useState(null);
  const [loadingTaskId, setLoadingTaskId] = useState('');

  useEffect(() => () => {
    if (homeworkMedia?.url) URL.revokeObjectURL(homeworkMedia.url);
  }, [homeworkMedia]);

  useEffect(() => {
    setAvatarFailed(false);
    setShowEditForm(false);
    setShowScholarshipForm(false);
    setSubActionState(null);
    setActiveSection('all');
    setHomeworkMedia((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
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

  const compatibleTeachers = useMemo(() => {
    if (!student) return approvedTeachers;
    const sGender = student.gender || 'male';
    const sAge = Number(student.age ?? 12);
    return (approvedTeachers || []).filter((tItem) => {
      const tGender = tItem.personalInfo?.gender || 'male';
      if (sGender === 'female') {
        return tGender === 'female' || sAge < 12;
      }
      return tGender === 'male' || sAge < 12;
    });
  }, [approvedTeachers, student]);

  const hasOpenSubscription = useMemo(
    () => (dossier?.subscriptions || []).some((sub) => ['awaiting_placement', 'placed', 'active', 'paused'].includes(sub.status)),
    [dossier?.subscriptions]
  );

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
      setShowEditForm(false);
    } finally {
      setSavingStudent(false);
    }
  };

  const handleGrantScholarship = async (e) => {
    e.preventDefault();
    if (!student?._id || workingSubAction) return;
    if (scholarshipForm.reason.trim().length < 3) {
      toast.error(isRTL ? 'يرجى كتابة سبب المنحة الدراسية (3 أحرف على الأقل)' : 'Please enter a scholarship reason (min 3 chars)');
      return;
    }
    setWorkingSubAction(true);
    try {
      await api.post(`/api/admin/people/students/${student._id}/scholarships`, {
        planKey: scholarshipForm.planKey,
        sessionCount: Number(scholarshipForm.sessionCount) || 8,
        preferredTeacherId: scholarshipForm.preferredTeacherId || undefined,
        reason: scholarshipForm.reason.trim(),
      }, { auth: true });
      toast.success(isRTL ? 'تم إصدار المنحة الدراسية بنجاح (بانتظار التسكين)' : 'Scholarship granted successfully');
      setShowScholarshipForm(false);
      setScholarshipForm({ planKey: 'group', sessionCount: 8, preferredTeacherId: '', reason: '' });
      await onRefreshStudent?.(student._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر إصدار المنحة الدراسية' : 'Failed to grant scholarship'));
    } finally {
      setWorkingSubAction(false);
    }
  };

  const submitSubscriptionMutation = async (e) => {
    e.preventDefault();
    if (!student?._id || !subActionState || workingSubAction) return;
    const reason = String(subActionState.reason || '').trim();
    if (reason.length < 3) {
      toast.error(isRTL ? 'يرجى كتابة سبب الإجراء في سجل التدقيق (3 أحرف على الأقل)' : 'Audit reason is required (min 3 chars)');
      return;
    }
    setWorkingSubAction(true);
    try {
      await api.patch(
        `/api/admin/people/students/${student._id}/subscriptions/${subActionState.subId}`,
        {
          action: subActionState.action,
          preferredTeacherId: subActionState.preferredTeacherId,
          status: subActionState.status,
          sessionCount: subActionState.sessionCount ? Number(subActionState.sessionCount) : undefined,
          reason,
        },
        { auth: true }
      );
      toast.success(isRTL ? 'تم تحديث باقة الطالب وتسجيل القرار في سجل التدقيق' : 'Subscription updated and logged');
      setSubActionState(null);
      await onRefreshStudent?.(student._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر تنفيذ الإجراء على الاشتراك' : 'Subscription update failed'));
    } finally {
      setWorkingSubAction(false);
    }
  };

  const handlePreviewHomework = async (taskId) => {
    if (!taskId || loadingTaskId) return;
    if (homeworkMedia?.taskId === taskId) {
      setHomeworkMedia((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
      return;
    }
    setLoadingTaskId(taskId);
    try {
      const response = await api.request(
        `/api/homework/tasks/${taskId}/file?reason=student-360-review`,
        { auth: true, json: false, method: 'GET' }
      );
      const blob = await response.blob();
      const mime = String(blob.type || '').toLowerCase();
      const ext = extensionFromMime(mime);
      const url = URL.createObjectURL(blob);
      if (mime.startsWith('audio/') || mime.startsWith('video/') || mime.startsWith('image/')) {
        setHomeworkMedia((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { taskId, url, mime, ext };
        });
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `student-homework-${taskId}${ext}`;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (onOpenHomeworkAudio) {
        await onOpenHomeworkAudio(taskId);
      } else {
        toast.error(err.message || (isRTL ? 'تعذر فتح ملف التسليم' : 'Failed to open submission'));
      }
    } finally {
      setLoadingTaskId('');
    }
  };

  const avatarSrc = !avatarFailed ? studentAvatarUrl(student?.avatar) : '';
  const isMinorWithoutGuardian = Number(student?.age) < 18 && (dossier?.guardians || []).length === 0;

  const sectionTabs = [
    { id: 'all', label: isRTL ? 'نظرة شاملة' : 'All 360' },
    { id: 'subscriptions', label: isRTL ? `الاشتراكات والرصيد (${(dossier?.subscriptions || []).length})` : `Subscriptions (${(dossier?.subscriptions || []).length})` },
    { id: 'sessions', label: isRTL ? `الحصص (${(dossier?.sessions || []).length})` : `Sessions (${(dossier?.sessions || []).length})` },
    { id: 'homework', label: isRTL ? `الواجبات (${(dossier?.homework || []).length})` : `Homework (${(dossier?.homework || []).length})` },
    { id: 'family', label: isRTL ? `الأسرة (${(dossier?.guardians || []).length})` : `Family (${(dossier?.guardians || []).length})` },
    { id: 'audit', label: isRTL ? 'سجل التدقيق' : 'Audit' },
  ];

  const showBlock = (key) => activeSection === 'all' || activeSection === key;

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
            <div className="flex flex-wrap items-center gap-2.5 mt-3">
              {student?._id && (
                <button type="button" onClick={() => onMessageStudent?.(student._id)} className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] px-4 py-2 text-[var(--wn-text-inverse)] font-semibold text-sm">
                  <MessageSquare size={17} aria-hidden="true" /> {s360.messageBtn}
                </button>
              )}
              {onUpdateStudent && student?._id ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('all');
                    setShowEditForm((v) => !v);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-3.5 py-2 text-xs font-bold text-[var(--wn-heading)]"
                >
                  <Edit3 size={15} aria-hidden="true" />
                  <span>{showEditForm ? (isRTL ? 'إخفاء نموذج التعديل' : 'Hide Edit Form') : (isRTL ? 'تعديل الحساب والبيانات' : 'Edit Profile')}</span>
                </button>
              ) : null}
              {isMinorWithoutGuardian ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] border border-[var(--wn-status-warn-border)]">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {isRTL ? 'قاصر بدون حساب ولي أمر مرتبط' : 'Minor without linked guardian'}
                </span>
              ) : null}
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={s360.avatarAlt}
                  onError={() => setAvatarFailed(true)}
                  className="w-14 h-14 rounded-full object-cover border border-[var(--wn-border)]"
                />
              ) : student?.name ? (
                <span className="w-14 h-14 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border border-[var(--wn-border-mint)] flex items-center justify-center text-lg font-bold" aria-hidden="true">
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

            <nav className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-[var(--wn-border)]" aria-label={isRTL ? 'أقسام ملف الطالب' : 'Student dossier sections'}>
              {sectionTabs.map((tabItem) => (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setActiveSection(tabItem.id)}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    activeSection === tabItem.id
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)] hover:border-[var(--wn-border-strong)]'
                  }`}
                >
                  {tabItem.label}
                </button>
              ))}
            </nav>

            {activeSection === 'all' && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title justify-between flex-wrap">
                  <div className="inline-flex items-center gap-2">
                    <UserRound size={18} aria-hidden="true" />
                    <h3>{s360.sections.account}</h3>
                  </div>
                  {onUpdateStudent && student?._id ? (
                    <button
                      type="button"
                      onClick={() => setShowEditForm((v) => !v)}
                      className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-heading)] inline-flex items-center gap-1.5"
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      {showEditForm ? (isRTL ? 'طي نموذج التعديل' : 'Collapse Form') : ef.title}
                    </button>
                  ) : null}
                </div>
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

                {showEditForm && onUpdateStudent && student?._id ? (
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
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowEditForm(false)} className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-semibold text-[var(--wn-text-secondary)]">
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button type="submit" disabled={savingStudent} className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-2 transition disabled:opacity-50">
                        {savingStudent ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                        {savingStudent ? ef.savingBtn : ef.saveBtn}
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            )}

            {showBlock('subscriptions') && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title justify-between flex-wrap">
                  <div className="inline-flex items-center gap-2">
                    <CreditCard size={18} aria-hidden="true" />
                    <h3>{s360.sections.subscriptionsPayments}</h3>
                  </div>
                  {student?._id && !hasOpenSubscription ? (
                    <button
                      type="button"
                      onClick={() => setShowScholarshipForm((v) => !v)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)] text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      <span>{isRTL ? 'إصدار منحة دراسية' : 'Grant Scholarship'}</span>
                    </button>
                  ) : null}
                </div>

                {showScholarshipForm && (
                  <form onSubmit={handleGrantScholarship} className="mb-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3 text-xs">
                    <strong className="block text-sm text-[var(--wn-heading)]">
                      {isRTL ? 'إصدار منحة دراسية مجانية (تخضع لقواعد الفصل والتسكين)' : 'Grant Free Scholarship Package'}
                    </strong>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block space-y-1">
                        <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'نوع الحلقة' : 'Plan'}</span>
                        <select
                          value={scholarshipForm.planKey}
                          onChange={(e) => setScholarshipForm((p) => ({ ...p, planKey: e.target.value }))}
                          className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                        >
                          <option value="group">{isRTL ? 'حلقة جماعية (5–8 طلاب)' : 'Group Circle'}</option>
                          <option value="focused">{isRTL ? 'حلقة مركّزة (3–4 طلاب)' : 'Focused Circle'}</option>
                          <option value="mini">{isRTL ? 'حلقة ثنائية (طالبان)' : 'Mini Circle (2)'}</option>
                          <option value="private">{isRTL ? 'حلقة فردية خاصة' : 'Private 1-on-1'}</option>
                          <option value="community">{isRTL ? 'حلقة مجتمعية' : 'Community Circle'}</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'عدد الحصص' : 'Sessions'}</span>
                        <select
                          value={scholarshipForm.sessionCount}
                          onChange={(e) => setScholarshipForm((p) => ({ ...p, sessionCount: Number(e.target.value) }))}
                          className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                        >
                          {[4, 8, 12, 24].map((n) => (
                            <option key={n} value={n}>{n} {isRTL ? 'حصص' : 'sessions'}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'المعلم المفضل (اختياري)' : 'Preferred Tutor (optional)'}</span>
                        <select
                          value={scholarshipForm.preferredTeacherId}
                          onChange={(e) => setScholarshipForm((p) => ({ ...p, preferredTeacherId: e.target.value }))}
                          className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                        >
                          <option value="">{isRTL ? 'مفتوح لأي معلم متوافق' : 'Any compatible tutor'}</option>
                          {compatibleTeachers.map((tItem) => (
                            <option key={tItem._id} value={tItem._id}>
                              {tItem.personalInfo?.fullName || tItem.user?.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'سبب المنحة (يُسجل في سجل التدقيق)' : 'Scholarship reason (audit log)'}</span>
                      <input
                        type="text"
                        required
                        value={scholarshipForm.reason}
                        onChange={(e) => setScholarshipForm((p) => ({ ...p, reason: e.target.value }))}
                        placeholder={isRTL ? 'مثال: منحة تفوق حفظ / دعم طالب مستحق' : 'e.g. Memorization excellence scholarship'}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowScholarshipForm(false)} className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)]">
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button type="submit" disabled={workingSubAction} className="min-h-[44px] px-4 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] font-bold inline-flex items-center gap-1.5">
                        {workingSubAction ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                        <span>{isRTL ? 'تأكيد المنحة' : 'Confirm Scholarship'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {(dossier.subscriptions || []).length > 0 ? (
                  <div className="mb-4 space-y-3">
                    <strong className="block text-xs text-[var(--wn-emerald)]">
                      {formatMsg(s360.subscriptions.heading, { count: dossier.subscriptions.length })}
                    </strong>
                    <div className="space-y-3">
                      {(dossier.subscriptions || []).map((sub) => {
                        const tutorName = sub.preferredTeacher?.personalInfo?.fullName || sub.preferredTeacher?.user?.name || '';
                        const isEditingSub = subActionState?.subId === sub._id;
                        const isTerminal = ['cancelled', 'expired'].includes(sub.status);
                        return (
                          <div key={sub._id} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3.5 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-sm text-[var(--wn-heading)]">
                                    {locale === 'ar'
                                      ? (sub.pricingSnapshot?.nameAr || sub.pricingSnapshot?.nameEn || sub.planKey || s360.subscriptions.planFallback)
                                      : (sub.pricingSnapshot?.nameEn || sub.pricingSnapshot?.nameAr || sub.planKey || s360.subscriptions.planFallback)}
                                  </strong>
                                  {sub.isScholarship ? (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border border-[var(--wn-border-strong)]">
                                      {isRTL ? 'منحة دراسية' : 'Scholarship'}
                                    </span>
                                  ) : null}
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-text-secondary)]">
                                    {sub.status}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--wn-text-secondary)]">
                                  {sub.circle?.name || s360.subscriptions.awaitingPlacement}
                                  {' · '}
                                  {sub.section === 'ladies' ? s360.subscriptions.sectionLadies : s360.subscriptions.sectionMenChildren}
                                  {' · '}
                                  {tutorName
                                    ? (isRTL ? `المعلم المفضل: ${tutorName}` : `Tutor lock: ${tutorName}`)
                                    : (isRTL ? 'متاح لأي معلم متوافق' : 'Unlocked tutor')}
                                </p>
                              </div>
                              <div className="text-end">
                                <strong className="block text-sm text-[var(--wn-heading)]">
                                  {formatMsg(s360.subscriptions.balance, { remaining: sub.sessionsRemaining ?? 0, total: sub.sessionCount ?? 0 })}
                                </strong>
                                <small className="text-xs text-[var(--wn-text-tertiary)]">
                                  {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString(intlLocale) : dash}
                                </small>
                              </div>
                            </div>

                            {!isTerminal && (
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--wn-border)]">
                                <button
                                  type="button"
                                  onClick={() => setSubActionState({
                                    subId: sub._id,
                                    action: 'change-teacher',
                                    preferredTeacherId: sub.preferredTeacher?._id || '',
                                    reason: '',
                                  })}
                                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-heading)] inline-flex items-center gap-1.5"
                                >
                                  <RefreshCw size={13} aria-hidden="true" />
                                  <span>{isRTL ? 'تغيير / فك قفل المعلم' : 'Change / Unlock Tutor'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={Number(sub.sessionsUsed || 0) <= 0}
                                  onClick={() => setSubActionState({
                                    subId: sub._id,
                                    action: 'restore-credit',
                                    reason: '',
                                  })}
                                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-xs font-bold text-[var(--wn-emerald-dark)] inline-flex items-center gap-1 disabled:opacity-45"
                                >
                                  <Plus size={13} aria-hidden="true" />
                                  <span>{isRTL ? '+1 استعادة حصة' : '+1 Restore Credit'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={Number(sub.sessionsRemaining || 0) <= 0}
                                  onClick={() => setSubActionState({
                                    subId: sub._id,
                                    action: 'deduct-credit',
                                    reason: '',
                                  })}
                                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-text-primary)] inline-flex items-center gap-1 disabled:opacity-45"
                                >
                                  <Minus size={13} aria-hidden="true" />
                                  <span>{isRTL ? '-1 خصم حصة' : '-1 Deduct Credit'}</span>
                                </button>
                                {sub.status !== 'completed' ? (
                                  <button
                                    type="button"
                                    onClick={() => setSubActionState({
                                      subId: sub._id,
                                      action: 'set-status',
                                      status: sub.status === 'paused' ? 'active' : 'paused',
                                      reason: '',
                                    })}
                                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-semibold text-[var(--wn-text-primary)] inline-flex items-center gap-1"
                                  >
                                    <PauseCircle size={13} aria-hidden="true" />
                                    <span>{sub.status === 'paused' ? (isRTL ? 'استئناف الباقة' : 'Resume') : (isRTL ? 'إيقاف مؤقت' : 'Pause')}</span>
                                  </button>
                                ) : null}
                                {sub.status !== 'completed' ? (
                                  <button
                                    type="button"
                                    onClick={() => setSubActionState({
                                      subId: sub._id,
                                      action: 'set-status',
                                      status: 'cancelled',
                                      reason: '',
                                    })}
                                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-xs font-bold text-[var(--wn-status-danger-text)] inline-flex items-center gap-1"
                                  >
                                    <Ban size={13} aria-hidden="true" />
                                    <span>{isRTL ? 'إلغاء الاشتراك' : 'Cancel'}</span>
                                  </button>
                                ) : null}
                                {sub.status === 'awaiting_placement' && onNavigateSubscriptions ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateSubscriptions()}
                                    className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1"
                                  >
                                    <ArrowUpRight size={14} aria-hidden="true" />
                                    <span>{isRTL ? 'تسكين في حلقة الآن' : 'Place in Circle'}</span>
                                  </button>
                                ) : null}
                              </div>
                            )}

                            {isEditingSub && (
                              <form onSubmit={submitSubscriptionMutation} className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] p-3 space-y-2.5 text-xs">
                                {subActionState.action === 'change-teacher' && (
                                  <label className="block space-y-1">
                                    <span className="font-bold text-[var(--wn-heading)]">
                                      {isRTL ? 'اختر المعلم البديل المتوافق (أو فك القفل لأي معلم)' : 'Select compatible tutor (or unlock)'}
                                    </span>
                                    <select
                                      value={subActionState.preferredTeacherId || ''}
                                      onChange={(e) => setSubActionState((p) => ({ ...p, preferredTeacherId: e.target.value }))}
                                      className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                                    >
                                      <option value="">{isRTL ? 'بدون قفل معلم محدد (متاح لأي حلقة متوافقة)' : 'Unlock — allow any compatible circle'}</option>
                                      {compatibleTeachers.map((tItem) => (
                                        <option key={tItem._id} value={tItem._id}>
                                          {tItem.personalInfo?.fullName || tItem.user?.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                )}
                                <label className="block space-y-1">
                                  <span className="font-bold text-[var(--wn-heading)]">
                                    {isRTL ? 'سبب القرار الإداري (إلزامي لسجل التدقيق)' : 'Reason for audit log (required)'}
                                  </span>
                                  <input
                                    type="text"
                                    required
                                    value={subActionState.reason}
                                    onChange={(e) => setSubActionState((p) => ({ ...p, reason: e.target.value }))}
                                    placeholder={isRTL ? 'اكتب سبب التعديل بوضوح...' : 'Enter clear audit reason...'}
                                    className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-1.5 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]"
                                  />
                                </label>
                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => setSubActionState(null)} className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border)]">
                                    {isRTL ? 'تراجع' : 'Cancel'}
                                  </button>
                                  <button type="submit" disabled={workingSubAction} className="min-h-[44px] px-4 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] font-bold inline-flex items-center gap-1.5">
                                    {workingSubAction ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                                    <span>{isRTL ? 'حفظ القرار' : 'Apply'}</span>
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
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
            )}

            {showBlock('family') && (
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
            )}

            {showBlock('sessions') && (
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
            )}

            {showBlock('homework') && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title"><BookOpen size={18} aria-hidden="true" /><h3>{s360.sections.homework}</h3></div>
                {(dossier.homework || []).length === 0 ? (
                  <p className="wn-admin-dossier__empty">{s360.homework.empty}</p>
                ) : (
                  <div className="wn-admin-homework-list">
                    {(dossier.homework || []).map((task) => {
                      const isPlayingHere = homeworkMedia?.taskId === task._id;
                      return (
                        <article key={task._id} className="space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-3 w-full">
                            <div>
                              <span>{task.status}</span>
                              <h4>{task.title}</h4>
                              <small>{task.teacher?.name || s360.homework.teacherFallback} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString(intlLocale) : s360.homework.noDueDate}</small>
                              {task.description ? <p>{task.description}</p> : null}
                              {task.teacherFeedback ? <p><strong>{s360.homework.feedbackPrefix}</strong> {task.teacherFeedback}</p> : null}
                            </div>
                            {task.submissionAvailable ? (
                              <button
                                type="button"
                                disabled={loadingTaskId === task._id}
                                onClick={() => handlePreviewHomework(task._id)}
                                className="min-h-[44px] inline-flex items-center gap-1.5"
                              >
                                {loadingTaskId === task._id ? (
                                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <PlayCircle size={16} aria-hidden="true" />
                                )}
                                {isPlayingHere ? (isRTL ? 'إخفاء المشغل' : 'Hide Player') : s360.homework.openSubmission}
                              </button>
                            ) : null}
                          </div>
                          {isPlayingHere && homeworkMedia?.url ? (
                            <div className="w-full rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-3 flex flex-wrap items-center justify-between gap-3">
                              {homeworkMedia.mime.startsWith('audio/') ? (
                                <audio controls src={homeworkMedia.url} className="flex-1 min-w-[220px]">
                                  <track kind="captions" />
                                </audio>
                              ) : homeworkMedia.mime.startsWith('video/') ? (
                                <video controls src={homeworkMedia.url} className="max-h-60 rounded-lg">
                                  <track kind="captions" />
                                </video>
                              ) : (
                                <img src={homeworkMedia.url} alt={task.title} className="max-h-56 rounded-lg object-contain" />
                              )}
                              <a
                                href={homeworkMedia.url}
                                download={`student-homework-${task._id}${homeworkMedia.ext}`}
                                className="min-h-[44px] px-3 py-2 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-heading)] inline-flex items-center gap-1.5"
                              >
                                <Download size={14} aria-hidden="true" />
                                <span>{isRTL ? 'تنزيل الملف' : 'Download'}</span>
                              </a>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeSection === 'all' && (
              <>
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
              </>
            )}

            {showBlock('audit') && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

