import { X, Shield, Mic, Video, MessageSquare, Lock, Hand, MousePointerClick } from 'lucide-react';

/**
 * لوحة سيطرة وصلاحيات المعلم الكاملة على طلاب الغرفة المباشرة
 */
export default function TeacherPermissionsModal({
  isOpen,
  onClose,
  controls = {},
  onUpdateControls,
  dir = 'rtl',
}) {
  if (!isOpen) return null;

  const followTeacherTab = controls?.followTeacherTab !== false;
  const micPolicy = controls?.micPolicy || 'open';
  const cameraAllowed = Boolean(controls?.cameraAllowed);
  const chatMode = controls?.chatMode || 'teacher_only';
  const allowHandRaise = controls?.allowHandRaise !== false;
  const studentPointerAllowed = Boolean(controls?.studentPointerAllowed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-sm"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label="إدارة صلاحيات الطلاب داخل الغرفة"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] shadow-2xl">
        <div className="p-4 border-b border-[var(--wn-border)] bg-[var(--wn-surface-soft)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Shield size={20} className="text-[var(--wn-emerald)] shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-bold text-base text-[var(--wn-heading)]">لوحة ضبط وصلاحيات الطلاب في الحلقة</h3>
              <p className="text-xs text-[var(--wn-text-secondary)]">
                تحكّم فوري فيما يُسمح للطالب بفعله وما لا يُفتح إلا بإذنك
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl inline-flex items-center justify-center hover:bg-[var(--wn-surface-sunken)] cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* ١. تثبيت التبويب مع المعلم */}
          <div className="p-3.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="font-bold text-sm text-[var(--wn-heading)] flex items-center gap-1.5">
                <Lock size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
                <span>تثبيت شاشة الطالب مع المعلم</span>
              </div>
              <p className="text-[var(--wn-text-secondary)]">منع الطالب من تغيير التبويب أثناء شرحك على المصحف أو السبورة</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateControls?.({ followTeacherTab: true })}
                className={`min-h-[36px] px-3 rounded-lg font-bold border cursor-pointer ${
                  followTeacherTab
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                }`}
              >
                🔒 مفعّل (يتبعني)
              </button>
              <button
                type="button"
                onClick={() => onUpdateControls?.({ followTeacherTab: false })}
                className={`min-h-[36px] px-3 rounded-lg font-bold border cursor-pointer ${
                  !followTeacherTab
                    ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-[var(--wn-gold)]'
                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                }`}
              >
                تنقل حر
              </button>
            </div>
          </div>

          {/* ٢. سياسة الميكروفون */}
          <div className="p-3.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2">
            <div className="font-bold text-sm text-[var(--wn-heading)] flex items-center gap-1.5">
              <Mic size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              <span>صلاحية ميكروفون الطلاب</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'open', label: 'متاح للطالب' },
                { id: 'reciter_only', label: '🎙️ للقارئ فقط' },
                { id: 'locked', label: '🔇 قفل تام للجميع' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateControls?.({ micPolicy: opt.id })}
                  className={`min-h-[38px] px-2 rounded-lg font-bold border cursor-pointer ${
                    micPolicy === opt.id
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ٣. صلاحية الكاميرا */}
          <div className="p-3.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="font-bold text-sm text-[var(--wn-heading)] flex items-center gap-1.5">
                <Video size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
                <span>كاميرا الطلاب (مغلقة افتراضياً للخصوصية)</span>
              </div>
              <p className="text-[var(--wn-text-secondary)]">لا يستطيع الطالب تشغيل الكاميرا إلا عند السماح بها</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateControls?.({ cameraAllowed: false })}
                className={`min-h-[36px] px-3 rounded-lg font-bold border cursor-pointer ${
                  !cameraAllowed
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                }`}
              >
                🔒 ممنوعة
              </button>
              <button
                type="button"
                onClick={() => onUpdateControls?.({ cameraAllowed: true })}
                className={`min-h-[36px] px-3 rounded-lg font-bold border cursor-pointer ${
                  cameraAllowed
                    ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-[var(--wn-gold)]'
                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                }`}
              >
                📷 مسموحة
              </button>
            </div>
          </div>

          {/* ٤. وضع المحادثة الكتابية */}
          <div className="p-3.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2">
            <div className="font-bold text-sm text-[var(--wn-heading)] flex items-center gap-1.5">
              <MessageSquare size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
              <span>نظام المحادثة الكتابية (منع التشتيت والتغشيش)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'teacher_only', label: '🛡️ للمعلم فقط' },
                { id: 'everyone', label: 'للجميع' },
                { id: 'locked', label: '🔒 مغلقة تماماً' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateControls?.({ chatMode: opt.id })}
                  className={`min-h-[38px] px-2 rounded-lg font-bold border cursor-pointer ${
                    chatMode === opt.id
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ٥. مؤشر الطالب على المصحف + رفع اليد */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2">
              <div className="font-bold text-xs text-[var(--wn-heading)] flex items-center gap-1">
                <MousePointerClick size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
                <span>إشارة الطالب على المصحف</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateControls?.({ studentPointerAllowed: !studentPointerAllowed })}
                className={`w-full min-h-[36px] rounded-lg font-bold border cursor-pointer ${
                  studentPointerAllowed
                    ? 'bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border-[var(--wn-gold)]'
                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                }`}
              >
                {studentPointerAllowed ? '👆 مسموح (يشير الآن)' : '🔒 مقفل (للمعلم فقط)'}
              </button>
            </div>

            <div className="p-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2">
              <div className="font-bold text-xs text-[var(--wn-heading)] flex items-center gap-1">
                <Hand size={14} className="text-[var(--wn-emerald)]" aria-hidden="true" />
                <span>طلبات رفع اليد والجرس</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateControls?.({ allowHandRaise: !allowHandRaise })}
                className={`w-full min-h-[36px] rounded-lg font-bold border cursor-pointer ${
                  allowHandRaise
                    ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border-[var(--wn-danger)]'
                }`}
              >
                {allowHandRaise ? '✋ مسموح للطلاب' : '🚫 موقوف مؤقتاً'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
