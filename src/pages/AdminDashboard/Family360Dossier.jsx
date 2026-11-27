import { useEffect, useId, useRef, useState } from 'react';
import {
  X, Users, UserRound, Bell, Calendar, ShieldCheck, History, Edit3, Link2, Unlink, Loader2, Save,
} from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { resolveIntlLocale } from '../../lib/locale';
import { useFocusTrapDialog } from './adminFormat';

function Info({ label, value, dash = '—' }) {
  return (
    <div className="wn-admin-360__info">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? dash : String(value)}</strong>
    </div>
  );
}

const PERMISSION_LABELS = {
  viewProgress: { ar: 'التقدم', en: 'Progress' },
  viewGrades: { ar: 'التقييمات', en: 'Grades' },
  viewAttendance: { ar: 'الحضور', en: 'Attendance' },
  receiveNotifications: { ar: 'الإشعارات', en: 'Alerts' },
  approveEnrollments: { ar: 'اعتماد التسجيل', en: 'Enrollments' },
};

export default function Family360Dossier({
  dossier,
  loading,
  onClose,
  onOpenStudent,
  onRefreshFamily,
}) {
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();
  const f360 = t.adminPortal.dossiers.family360;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const titleId = useId();
  const dialogRef = useRef(null);

  useFocusTrapDialog(Boolean(dossier), onClose, dialogRef);

  const guardian = dossier?.guardian;
  const summary = dossier?.summary || {};

  const [showEditForm, setShowEditForm] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    newPassword: '',
  });

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkingStudent, setLinkingStudent] = useState(false);
  const [linkForm, setLinkForm] = useState({
    studentIdentifier: '',
    relationship: 'father',
    reason: '',
  });

  const [confirmUnlinkId, setConfirmUnlinkId] = useState('');
  const [workingChildId, setWorkingChildId] = useState('');

  useEffect(() => {
    setShowEditForm(false);
    setShowLinkForm(false);
    setConfirmUnlinkId('');
    if (!guardian) return;
    setAccountForm({
      name: guardian.name || '',
      email: guardian.email || '',
      phone: guardian.phone || '',
      isActive: guardian.isActive !== false,
      newPassword: '',
    });
  }, [guardian]);

  const handleSaveGuardian = async (e) => {
    e.preventDefault();
    if (!guardian?._id || savingAccount) return;
    setSavingAccount(true);
    try {
      await api.put(`/api/admin/people/guardians/${guardian._id}`, {
        ...accountForm,
        adminReason: 'تحديث بيانات حساب ولي الأمر من Family 360',
      }, { auth: true });
      toast.success(isRTL ? 'تم تحديث حساب ولي الأمر بنجاح' : 'Guardian account updated');
      setAccountForm((p) => ({ ...p, newPassword: '' }));
      setShowEditForm(false);
      await onRefreshFamily?.(guardian._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر تحديث بيانات ولي الأمر' : 'Failed to update guardian'));
    } finally {
      setSavingAccount(false);
    }
  };

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!guardian?._id || linkingStudent || !linkForm.studentIdentifier.trim()) return;
    setLinkingStudent(true);
    try {
      await api.post(`/api/admin/people/guardians/${guardian._id}/link-student`, {
        studentIdentifier: linkForm.studentIdentifier.trim(),
        relationship: linkForm.relationship,
        reason: linkForm.reason.trim() || undefined,
      }, { auth: true });
      toast.success(isRTL ? 'تم ربط الطالب بحساب ولي الأمر بنجاح' : 'Student linked to guardian');
      setLinkForm({ studentIdentifier: '', relationship: 'father', reason: '' });
      setShowLinkForm(false);
      await onRefreshFamily?.(guardian._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر ربط الطالب بولي الأمر' : 'Failed to link student'));
    } finally {
      setLinkingStudent(false);
    }
  };

  const handleUnlinkStudent = async (studentId) => {
    if (!guardian?._id || !studentId || workingChildId) return;
    setWorkingChildId(String(studentId));
    try {
      await api.delete(
        `/api/admin/people/guardians/${guardian._id}/unlink-student/${studentId}?reason=${encodeURIComponent('فك الربط من Family 360')}`,
        { auth: true }
      );
      toast.success(isRTL ? 'تم فك ارتباط الطالب بحساب ولي الأمر' : 'Student unlinked');
      setConfirmUnlinkId('');
      await onRefreshFamily?.(guardian._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر فك ارتباط الطالب' : 'Failed to unlink student'));
    } finally {
      setWorkingChildId('');
    }
  };

  const handleTogglePermission = async (child, permKey) => {
    const studentId = child?.student?._id;
    if (!studentId || workingChildId) return;
    const currentVal = child.permissions?.[permKey] !== false;
    const nextPermissions = {
      viewProgress: child.permissions?.viewProgress !== false,
      viewGrades: child.permissions?.viewGrades !== false,
      viewAttendance: child.permissions?.viewAttendance !== false,
      receiveNotifications: child.permissions?.receiveNotifications !== false,
      approveEnrollments: Boolean(child.permissions?.approveEnrollments),
      [permKey]: permKey === 'approveEnrollments' ? !child.permissions?.approveEnrollments : !currentVal,
    };
    setWorkingChildId(String(studentId));
    try {
      await api.put(`/api/guardians/permissions/${studentId}`, {
        guardianId: dossier?.profile?._id || undefined,
        permissions: nextPermissions,
      }, { auth: true });
      toast.success(isRTL ? 'تم تحديث صلاحيات المتابعة لولي الأمر' : 'Guardian permissions updated');
      await onRefreshFamily?.(guardian._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر تحديث الصلاحيات' : 'Failed to update permissions'));
    } finally {
      setWorkingChildId('');
    }
  };

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
            <span>{f360.eyebrow || 'Family 360'}</span>
            <h2 id={titleId}>{guardian?.name || f360.titleFallback}</h2>
            <p>{guardian?.email || dash} · {guardian?.phone || dash}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {guardian?._id ? (
                <button
                  type="button"
                  onClick={() => setShowEditForm((v) => !v)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-heading)] inline-flex items-center gap-1.5"
                >
                  <Edit3 size={14} aria-hidden="true" />
                  <span>{showEditForm ? (isRTL ? 'إخفاء تعديل الحساب' : 'Hide Edit Form') : (isRTL ? 'تعديل حساب ولي الأمر' : 'Edit Guardian')}</span>
                </button>
              ) : null}
              {guardian?._id ? (
                <button
                  type="button"
                  onClick={() => setShowLinkForm((v) => !v)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Link2 size={14} aria-hidden="true" />
                  <span>{isRTL ? 'ربط ابن / طالب يدوياً' : 'Link Student'}</span>
                </button>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.adminPortal.dossiers.closeAria} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="wn-admin-dossier__loading space-y-3" role="status" aria-label={t.adminPortal.dossiers.loadingFamily}>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <div className="wn-admin-dossier__body">
            <section className="wn-admin-360-summary">
              <div><Users size={18} aria-hidden="true" /><span><strong>{summary.children || 0}</strong><small>{f360.summary.children}</small></span></div>
              <div><UserRound size={18} aria-hidden="true" /><span><strong>{summary.activeChildren || 0}</strong><small>{f360.summary.activeChildren}</small></span></div>
              <div><ShieldCheck size={18} aria-hidden="true" /><span><strong>{summary.pendingInvitations || 0}</strong><small>{f360.summary.pendingInvites}</small></span></div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><UserRound size={18} aria-hidden="true" /><h3>{f360.sections.account}</h3></div>
              <div className="wn-admin-dossier__grid">
                <Info label={f360.fields.name} value={guardian?.name} dash={dash} />
                <Info label={f360.fields.email} value={guardian?.email} dash={dash} />
                <Info label={f360.fields.phone} value={guardian?.phone} dash={dash} />
                <Info label={f360.fields.accountStatus} value={guardian?.isActive === false ? f360.statuses.suspended : f360.statuses.active} dash={dash} />
                <Info label={f360.fields.emailVerified} value={guardian?.emailVerified ? f360.statuses.yes : f360.statuses.no} dash={dash} />
                <Info label={f360.fields.lastLogin} value={guardian?.lastLogin ? new Date(guardian.lastLogin).toLocaleString(intlLocale) : dash} dash={dash} />
                <Info label={f360.fields.language} value={dossier.profile?.settings?.language || guardian?.preferences?.language} dash={dash} />
                <Info label={f360.fields.timezone} value={dossier.profile?.settings?.timezone || guardian?.preferences?.timezone} dash={dash} />
              </div>

              {showEditForm && guardian?._id && (
                <form onSubmit={handleSaveGuardian} className="mt-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3 text-xs">
                  <strong className="block text-sm text-[var(--wn-heading)]">
                    {isRTL ? 'تعديل حساب ولي الأمر' : 'Edit Guardian Account'}
                  </strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{f360.fields.name}</span>
                      <input
                        type="text"
                        required
                        value={accountForm.name}
                        onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{f360.fields.email}</span>
                      <input
                        type="email"
                        required
                        value={accountForm.email}
                        onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{f360.fields.phone}</span>
                      <input
                        type="text"
                        value={accountForm.phone}
                        onChange={(e) => setAccountForm((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{f360.fields.accountStatus}</span>
                      <select
                        value={accountForm.isActive ? 'active' : 'suspended'}
                        onChange={(e) => setAccountForm((p) => ({ ...p, isActive: e.target.value === 'active' }))}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      >
                        <option value="active">{f360.statuses.active}</option>
                        <option value="suspended">{f360.statuses.suspended}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'كلمة مرور جديدة' : 'New Password'}</span>
                      <input
                        type="password"
                        placeholder={isRTL ? 'اتركه فارغاً للإبقاء' : 'Leave blank to keep'}
                        value={accountForm.newPassword}
                        onChange={(e) => setAccountForm((p) => ({ ...p, newPassword: e.target.value }))}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowEditForm(false)} className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)]">
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button type="submit" disabled={savingAccount} className="min-h-[44px] px-4 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] font-bold inline-flex items-center gap-1.5">
                      {savingAccount ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                      <span>{isRTL ? 'حفظ التعديلات' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title justify-between flex-wrap">
                <div className="inline-flex items-center gap-2">
                  <Users size={18} aria-hidden="true" />
                  <h3>{f360.sections.children}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkForm((v) => !v)}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border border-[var(--wn-border-mint)] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Link2 size={14} aria-hidden="true" />
                  <span>{isRTL ? 'إضافة ربط عائلي' : 'Add Family Link'}</span>
                </button>
              </div>

              {showLinkForm && (
                <form onSubmit={handleLinkStudent} className="mb-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3 text-xs">
                  <strong className="block text-sm text-[var(--wn-heading)]">
                    {isRTL ? 'ربط طالب بحساب ولي الأمر مباشرة' : 'Directly Link Student to Guardian'}
                  </strong>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'بريد الطالب أو معرّفه' : 'Student Email or ID'}</span>
                      <input
                        type="text"
                        required
                        value={linkForm.studentIdentifier}
                        onChange={(e) => setLinkForm((p) => ({ ...p, studentIdentifier: e.target.value }))}
                        placeholder="student@example.com"
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'صلة القرابة' : 'Relationship'}</span>
                      <select
                        value={linkForm.relationship}
                        onChange={(e) => setLinkForm((p) => ({ ...p, relationship: e.target.value }))}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      >
                        <option value="father">{isRTL ? 'الأب' : 'Father'}</option>
                        <option value="mother">{isRTL ? 'الأم' : 'Mother'}</option>
                        <option value="guardian">{isRTL ? 'ولي أمر' : 'Guardian'}</option>
                        <option value="other">{isRTL ? 'أخرى' : 'Other'}</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-[var(--wn-heading)]">{isRTL ? 'ملاحظة التدقيق' : 'Audit Reason'}</span>
                      <input
                        type="text"
                        value={linkForm.reason}
                        onChange={(e) => setLinkForm((p) => ({ ...p, reason: e.target.value }))}
                        placeholder={isRTL ? 'تأكيد صلة القرابة عبر الدعم' : 'Verified via support'}
                        className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-2.5 py-1.5 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowLinkForm(false)} className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)]">
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button type="submit" disabled={linkingStudent} className="min-h-[44px] px-4 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] font-bold inline-flex items-center gap-1.5">
                      {linkingStudent ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                      <span>{isRTL ? 'تأكيد الربط' : 'Confirm Link'}</span>
                    </button>
                  </div>
                </form>
              )}

              {(dossier.children || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{f360.emptyChildren}</p>
              ) : (
                <div className="space-y-3">
                  {(dossier.children || []).map((child) => {
                    const childId = String(child.student?._id || '');
                    const isBusy = workingChildId === childId;
                    return (
                      <div key={childId} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-11 h-11 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)] border border-[var(--wn-border-mint)] flex items-center justify-center font-bold">
                              {child.student?.name?.slice(0, 1) || f360.childStats.avatarFallback}
                            </span>
                            <div>
                              <strong className="block text-sm text-[var(--wn-heading)]">{child.student?.name || f360.childStats.studentFallback}</strong>
                              <small className="text-xs text-[var(--wn-text-secondary)]">
                                {child.relationship} · {child.student?.currentLevel || dash} · {child.student?.email || dash}
                              </small>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenStudent?.(child.student?._id)}
                              className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold"
                            >
                              {isRTL ? 'فتح ملف الطالب 360' : 'Open Student 360'}
                            </button>
                            {confirmUnlinkId === childId ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleUnlinkStudent(childId)}
                                  className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[var(--wn-danger)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-1"
                                >
                                  {isBusy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : null}
                                  <span>{isRTL ? 'تأكيد فك الربط' : 'Confirm Unlink'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmUnlinkId('')}
                                  className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs"
                                >
                                  {isRTL ? 'تراجع' : 'Cancel'}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmUnlinkId(childId)}
                                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] text-xs font-bold inline-flex items-center gap-1"
                              >
                                <Unlink size={13} aria-hidden="true" />
                                <span>{isRTL ? 'فك الربط' : 'Unlink'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border)] p-2.5 text-xs">
                          <div><strong className="block text-sm text-[var(--wn-heading)]">{child.summary?.sessions || 0}</strong><small className="text-[var(--wn-text-secondary)]">{f360.childStats.sessions}</small></div>
                          <div><strong className="block text-sm text-[var(--wn-heading)]">{child.summary?.pendingHomework || 0}</strong><small className="text-[var(--wn-text-secondary)]">{f360.childStats.pendingHw}</small></div>
                          <div><strong className="block text-sm text-[var(--wn-heading)]">{child.summary?.submittedHomework || 0}</strong><small className="text-[var(--wn-text-secondary)]">{f360.childStats.submittedHw}</small></div>
                        </div>

                        {child.summary?.nextSession ? (
                          <p className="text-xs text-[var(--wn-emerald)] font-semibold flex items-center gap-1.5">
                            <Calendar size={13} aria-hidden="true" />
                            <span>{f360.childStats.nextSessionPrefix} {new Date(child.summary.nextSession.scheduledAt).toLocaleString(intlLocale)}</span>
                          </p>
                        ) : null}

                        <div className="pt-2 border-t border-[var(--wn-border)]">
                          <span className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                            {isRTL ? 'صلاحيات اطلاع ولي الأمر على هذا الابن:' : 'Guardian monitoring permissions:'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(PERMISSION_LABELS).map(([key, labels]) => {
                              const enabled = key === 'approveEnrollments'
                                ? Boolean(child.permissions?.[key])
                                : child.permissions?.[key] !== false;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={isBusy}
                                  aria-pressed={enabled}
                                  onClick={() => handleTogglePermission(child, key)}
                                  className={`min-h-[44px] px-3 py-1 rounded-full text-xs font-semibold border transition ${
                                    enabled
                                      ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] border-[var(--wn-border-mint)]'
                                      : 'bg-[var(--wn-surface)] text-[var(--wn-text-tertiary)] border-[var(--wn-border)]'
                                  }`}
                                >
                                  {enabled ? '✓ ' : ''}{isRTL ? labels.ar : labels.en}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><ShieldCheck size={18} aria-hidden="true" /><h3>{f360.sections.invitations}</h3></div>
              {(dossier.invitations || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{f360.emptyInvitations}</p>
              ) : (
                <div className="wn-admin-360-table">
                  {(dossier.invitations || []).map((invitation) => (
                    <div key={invitation._id}>
                      <span><strong>{invitation.student?.name || f360.childStats.studentFallback}</strong><small>{invitation.relationship} · {invitation.phoneMasked || dash}</small></span>
                      <span><strong>{invitation.status}</strong><small>{invitation.source}</small></span>
                      <small>{new Date(invitation.createdAt).toLocaleString(intlLocale)}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Bell size={18} aria-hidden="true" /><h3>{f360.sections.monitoring}</h3></div>
              <div className="wn-admin-dossier__grid">
                <Info label={f360.fields.reportFrequency} value={dossier.profile?.settings?.reportFrequency} dash={dash} />
                <Info label={f360.fields.emailNotif} value={dossier.profile?.notificationPreferences?.email?.enabled ? f360.statuses.enabled : f360.statuses.disabled} dash={dash} />
                <Info label={f360.fields.pushNotif} value={dossier.profile?.notificationPreferences?.push?.enabled ? f360.statuses.enabled : f360.statuses.disabled} dash={dash} />
                <Info label={f360.fields.smsNotif} value={dossier.profile?.notificationPreferences?.sms?.enabled ? f360.statuses.enabled : f360.statuses.disabled} dash={dash} />
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><History size={18} aria-hidden="true" /><h3>{f360.sections.audit}</h3></div>
              {(dossier.audit || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{f360.emptyAudit}</p>
              ) : (
                <div className="wn-admin-audit-list">
                  {(dossier.audit || []).map((entry) => (
                    <div key={entry._id}>
                      <span><strong>{entry.actor?.name || f360.actorFallback}</strong><small>{new Date(entry.createdAt).toLocaleString(intlLocale)}</small></span>
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
