import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const REJECT_REASONS = [
  'عدم مناسبة الوقت الحالي في الجدول',
  'اكتمال الحصص المتاحة هذا الأسبوع',
  'التخصص أو المرحلة العمرية خارج نطاقي',
];

export function RejectSessionModal({ session, onClose, onConfirm, submitting = false }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [session?._id]);

  useEffect(() => {
    if (!session) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, submitting, onClose]);

  if (!session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-xl space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label="الاعتذار عن طلب الحصة"
      >
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute end-4 top-4 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              الاعتذار عن طلب {session.student?.name || 'الطالب'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              يمكنك كتابة سبب مختصر يظهر للطالب باحترام ووضوح (اختياري).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {REJECT_REASONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
            >
              {preset}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          maxLength={400}
          className="input-field w-full text-sm"
          placeholder="سبب الاعتذار (اختياري)..."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
          >
            تراجع
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onConfirm?.(reason.trim())}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {submitting ? 'جاري الإرسال...' : 'تأكيد الاعتذار'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDeleteUpdateModal({ update, onClose, onConfirm, submitting = false }) {
  useEffect(() => {
    if (!update) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [update, submitting, onClose]);

  if (!update) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-xl space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label="تأكيد حذف الرسالة"
      >
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute end-4 top-4 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Trash2 size={18} />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">حذف هذه الرسالة وفيديوهاتها؟</h3>
            <p className="text-xs text-slate-600 mt-1">
              سيتم حذف «{update.title}» نهائياً ولن يتمكن الطلاب من مشاهدتها بعد ذلك.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {submitting ? 'جاري الحذف...' : 'تأكيد الحذف'}
          </button>
        </div>
      </div>
    </div>
  );
}
