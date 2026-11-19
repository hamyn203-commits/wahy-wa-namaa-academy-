import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import Modal from '../../components/shared/Modal';
import { useI18n } from '../../i18n';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export function RejectSessionModal({ session, onClose, onConfirm, submitting = false }) {
  const { t } = useI18n();
  const tp = t?.teacherPortal || {};
  const rm = tp.modals?.rejectSession || {};
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [session?._id]);

  const presets = [
    rm.presets?.busy || 'عدم مناسبة الوقت الحالي في الجدول',
    rm.presets?.full || 'اكتمال الحصص المتاحة هذا الأسبوع',
    rm.presets?.scope || 'التخصص أو المرحلة العمرية خارج نطاقي',
  ];

  const studentName = session?.student?.name || tp.welcome?.studentFallback || 'الطالب';

  return (
    <Modal
      isOpen={Boolean(session)}
      onClose={onClose}
      title={formatMsg(rm.title || 'الاعتذار عن طلب {name}', { name: studentName })}
      ariaLabel={rm.ariaTitle || 'الاعتذار عن طلب الحصة'}
      maxWidth="448px"
      disableClose={submitting}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1 leading-relaxed">
            {rm.subtitle || 'يمكنك كتابة سبب مختصر يظهر للطالب باحترام ووضوح (اختياري).'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className="min-h-[44px] rounded-full border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-soft)]"
            >
              {preset}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="reject-session-reason" className="sr-only">
            {rm.placeholder || 'سبب الاعتذار (اختياري)...'}
          </label>
          <textarea
            id="reject-session-reason"
            rows={3}
            maxLength={400}
            className="input-field w-full text-sm"
            placeholder={rm.placeholder || 'سبب الاعتذار (اختياري)...'}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="wn-btn wn-btn--secondary min-h-[44px] px-4 py-2 text-sm disabled:opacity-50"
          >
            {rm.cancelBtn || 'تراجع'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onConfirm?.(reason.trim())}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--wn-danger)] hover:opacity-90 text-[var(--wn-white)] text-sm font-bold disabled:opacity-50"
          >
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            <span>{submitting ? (rm.submittingBtn || 'جاري الإرسال…') : (rm.confirmBtn || 'تأكيد الاعتذار')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ConfirmDeleteUpdateModal({ update, onClose, onConfirm, submitting = false }) {
  const { t } = useI18n();
  const dm = t?.teacherPortal?.modals?.deleteUpdate || {};

  return (
    <Modal
      isOpen={Boolean(update)}
      onClose={onClose}
      title={dm.title || 'حذف هذه الرسالة وفيديوهاتها؟'}
      ariaLabel={dm.ariaTitle || 'تأكيد حذف الرسالة'}
      maxWidth="448px"
      disableClose={submitting}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]">
            <Trash2 size={18} aria-hidden="true" />
          </span>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1 leading-relaxed">
            {formatMsg(
              dm.desc || 'سيتم حذف «{title}» نهائيًا ولن يتمكن الطلاب من مشاهدتها بعد ذلك.',
              { title: update?.title || '' }
            )}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="wn-btn wn-btn--secondary min-h-[44px] px-4 py-2 text-sm disabled:opacity-50"
          >
            {dm.cancelBtn || 'إلغاء'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--wn-danger)] hover:opacity-90 text-[var(--wn-white)] text-sm font-bold disabled:opacity-50"
          >
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            <span>{submitting ? (dm.submittingBtn || 'جاري الحذف…') : (dm.confirmBtn || 'تأكيد الحذف')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
