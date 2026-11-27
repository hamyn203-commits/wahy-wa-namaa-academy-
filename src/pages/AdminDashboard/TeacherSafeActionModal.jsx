import { useEffect, useId, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Loader2, ShieldAlert, Trash2, Users } from 'lucide-react';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';

export default function TeacherSafeActionModal({
  modalState,
  onClose,
  onCompleted,
}) {
  const { isRTL } = useI18n();
  const toast = useToast();
  const selectId = useId();
  const reasonId = useId();

  const teacherId = modalState?.teacherId || '';
  const teacherLabel = modalState?.label || '';
  const mode = modalState?.mode || 'delete'; // 'delete' | 'suspend'

  const [loading, setLoading] = useState(false);
  const [impact, setImpact] = useState(null);
  const [replacementTeacherId, setReplacementTeacherId] = useState('');
  const [reason, setReason] = useState('');
  const [forceWithoutReplacement, setForceWithoutReplacement] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teacherId) {
      setImpact(null);
      setReplacementTeacherId('');
      setReason('');
      setForceWithoutReplacement(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api.get(`/api/admin/teachers/${teacherId}/impact`, { auth: true })
      .then((res) => {
        if (!active) return;
        setImpact(res);
        const firstCandidate = res?.replacementTeachers?.[0]?._id || '';
        const hasActiveLoad = Number(res?.activeCirclesCount || 0) > 0
          || Number(res?.futureSessionsCount || 0) > 0
          || Number(res?.lockedSubscriptionsCount || 0) > 0;
        setReplacementTeacherId(hasActiveLoad ? firstCandidate : '');
      })
      .catch((err) => {
        if (active) toast.error(err.message || (isRTL ? 'تعذر فحص ارتباطات المعلم' : 'Failed to inspect teacher impact'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [teacherId, isRTL, toast]);

  const hasImpact = Boolean(
    impact && (
      Number(impact.activeCirclesCount || 0) > 0
      || Number(impact.futureSessionsCount || 0) > 0
      || Number(impact.lockedSubscriptionsCount || 0) > 0
    )
  );

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!teacherId || submitting) return;
    if (hasImpact && !replacementTeacherId && !forceWithoutReplacement) {
      toast.error(
        isRTL
          ? 'اختر معلماً بديلاً لنقل الحلقات والحصص بأمان، أو فعّل خيار الإلغاء القسري الصريح'
          : 'Select a replacement teacher or explicitly confirm forced unassignment'
      );
      return;
    }

    const auditReason = reason.trim() || (
      mode === 'suspend'
        ? 'إيقاف المعلم ونقل الحلقات والاشتراكات من لوحة الإدارة'
        : 'حذف حساب المعلم بعد معالجة الحلقات المرتبطة'
    );

    setSubmitting(true);
    try {
      if (mode === 'suspend') {
        await api.put(`/api/admin/teachers/${teacherId}`, {
          status: 'suspended',
          isVerified: false,
          isActive: false,
          replacementTeacherId: replacementTeacherId || undefined,
          adminDirectOverride: true,
          adminReason: auditReason,
        }, { auth: true });
        toast.success(
          replacementTeacherId
            ? (isRTL ? 'تم إيقاف المعلم ونقل الحلقات والحصص للمعلم البديل بنجاح' : 'Teacher suspended and workload transferred')
            : (isRTL ? 'تم إيقاف حساب المعلم بنجاح' : 'Teacher suspended')
        );
      } else {
        if (hasImpact && replacementTeacherId) {
          await api.put(`/api/admin/teachers/${teacherId}`, {
            status: 'suspended',
            isVerified: false,
            replacementTeacherId,
            adminDirectOverride: true,
            adminReason: `${auditReason} (نقل الحلقات قبل الحذف)`,
          }, { auth: true });
        }
        await api.delete(`/api/admin/teachers/${teacherId}?force=true`, { auth: true });
        toast.success(
          replacementTeacherId
            ? (isRTL ? 'تم نقل الحلقات للمعلم البديل وحذف حساب المعلم بأمان' : 'Workload transferred and teacher deleted safely')
            : (isRTL ? 'تم حذف حساب المعلم بنجاح' : 'Teacher deleted')
        );
      }
      await onCompleted?.(teacherId, mode);
      onClose?.();
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر تنفيذ الإجراء على حساب المعلم' : 'Action failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = mode === 'suspend'
    ? (isRTL ? 'إيقاف المعلم وحماية الحلقات النشطة' : 'Suspend Teacher & Reassign Circles')
    : (isRTL ? 'فحص الأثر قبل حذف المعلم' : 'Impact Check Before Deleting Teacher');

  return (
    <Modal
      isOpen={Boolean(modalState)}
      onClose={() => { if (!submitting) onClose?.(); }}
      title={modalTitle}
      disableClose={submitting}
      maxWidth="540px"
    >
      {modalState ? (
        loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4 text-sm">
            <p className="text-[var(--wn-text-primary)] font-semibold">
              {isRTL ? `المعلم المستهدف: ${teacherLabel}` : `Target Teacher: ${teacherLabel}`}
            </p>

            {hasImpact ? (
              <div className="rounded-xl border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-[var(--wn-status-warn-text)] text-sm">
                  <ShieldAlert size={18} aria-hidden="true" />
                  <span>
                    {isRTL
                      ? 'تنبيه تشغيلي: هذا المعلم مرتبط بحلقات أو طلاب نشطين!'
                      : 'Operational Alert: Active circles or students depend on this teacher!'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center bg-[var(--wn-surface)] rounded-lg p-2 border border-[var(--wn-border)]">
                  <div>
                    <strong className="block text-base text-[var(--wn-heading)]">{impact?.activeCirclesCount || 0}</strong>
                    <span className="text-[var(--wn-text-secondary)]">{isRTL ? 'حلقات نشطة' : 'Active Circles'}</span>
                  </div>
                  <div>
                    <strong className="block text-base text-[var(--wn-heading)]">{impact?.futureSessionsCount || 0}</strong>
                    <span className="text-[var(--wn-text-secondary)]">{isRTL ? 'حصص قادمة' : 'Upcoming Sessions'}</span>
                  </div>
                  <div>
                    <strong className="block text-base text-[var(--wn-heading)]">{impact?.lockedSubscriptionsCount || 0}</strong>
                    <span className="text-[var(--wn-text-secondary)]">{isRTL ? 'اشتراكات مرتبطة' : 'Subscriptions'}</span>
                  </div>
                </div>
                {(impact?.circles || []).length > 0 && (
                  <div className="space-y-1">
                    <strong className="block text-[var(--wn-heading)]">{isRTL ? 'الحلقات المتأثرة:' : 'Affected circles:'}</strong>
                    <ul className="space-y-1">
                      {impact.circles.slice(0, 5).map((c) => (
                        <li key={c._id} className="flex items-center justify-between bg-[var(--wn-surface)] px-2.5 py-1.5 rounded border border-[var(--wn-border)]">
                          <span className="font-semibold text-[var(--wn-heading)]">{c.name}</span>
                          <span className="inline-flex items-center gap-1 text-[var(--wn-text-secondary)]">
                            <Users size={12} aria-hidden="true" /> {c.studentCount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 space-y-1.5">
                  <label htmlFor={selectId} className="block font-bold text-[var(--wn-heading)]">
                    <ArrowLeftRight size={13} className="inline me-1" aria-hidden="true" />
                    {isRTL ? 'اختر معلماً بديلاً متوافقاً لنقل الحلقات والحصص تلقائياً:' : 'Select compatible replacement teacher:'}
                  </label>
                  <select
                    id={selectId}
                    value={replacementTeacherId}
                    onChange={(e) => {
                      setReplacementTeacherId(e.target.value);
                      if (e.target.value) setForceWithoutReplacement(false);
                    }}
                    className="w-full min-h-[44px] border border-[var(--wn-border-strong)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                  >
                    <option value="">{isRTL ? '— بدون معلم بديل —' : '— No replacement selected —'}</option>
                    {(impact?.replacementTeachers || []).map((cand) => (
                      <option key={cand._id} value={cand._id}>
                        {cand.name} ({cand.gender === 'female' ? (isRTL ? 'معلمة' : 'Female') : (isRTL ? 'معلم' : 'Male')})
                      </option>
                    ))}
                  </select>
                </div>

                {!replacementTeacherId && (
                  <label className="flex items-center gap-2 pt-1 text-xs font-bold text-[var(--wn-status-danger-text)] cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={forceWithoutReplacement}
                      onChange={(e) => setForceWithoutReplacement(e.target.checked)}
                      className="w-4 h-4 accent-[var(--wn-danger)]"
                    />
                    <span>
                      {isRTL
                        ? 'أدرك أن عدم اختيار معلم بديل سيترك الطلاب بدون معلم معيّن لحين إعادة تسكينهم يدوياً'
                        : 'I understand proceeding without a replacement will unassign affected students'}
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-3 text-xs text-[var(--wn-emerald-dark)] font-semibold">
                {isRTL
                  ? 'لا توجد حلقات نشطة أو حصص مجدولة مرتبطة بهذا المعلم حالياً — الإجراء آمن.'
                  : 'No active circles or upcoming sessions depend on this teacher.'}
              </div>
            )}

            <div>
              <label htmlFor={reasonId} className="block text-xs font-bold text-[var(--wn-heading)] mb-1">
                {isRTL ? 'سبب القرار الإداري (لسجل التدقيق)' : 'Audit Log Reason'}
              </label>
              <input
                id={reasonId}
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={isRTL ? 'مثال: إجازة معلم ونقل طلابه للشيخ البديل' : 'e.g. Teacher leave — transferring circles'}
                className="w-full min-h-[44px] border border-[var(--wn-border-strong)] rounded-lg px-3 py-2 bg-[var(--wn-surface)] text-[var(--wn-text-primary)] text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[var(--wn-border)] text-xs font-semibold text-[var(--wn-text-secondary)]"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold text-[var(--wn-text-inverse)] inline-flex items-center gap-1.5 disabled:opacity-50 ${
                  mode === 'delete' ? 'bg-[var(--wn-danger)]' : 'bg-[var(--wn-emerald)]'
                }`}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : mode === 'delete' ? (
                  <Trash2 size={14} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={14} aria-hidden="true" />
                )}
                <span>
                  {mode === 'suspend'
                    ? (replacementTeacherId ? (isRTL ? 'نقل الحلقات وإيقاف المعلم' : (isRTL ? 'تأكيد إيقاف المعلم' : 'Suspend Teacher')) : (isRTL ? 'تأكيد إيقاف المعلم' : 'Suspend Teacher'))
                    : (replacementTeacherId ? (isRTL ? 'نقل الحلقات ثم حذف الحساب' : (isRTL ? 'تأكيد الحذف النهائي' : 'Delete Teacher')) : (isRTL ? 'تأكيد الحذف النهائي' : 'Delete Teacher'))}
                </span>
              </button>
            </div>
          </form>
        )
      ) : null}
    </Modal>
  );
}
