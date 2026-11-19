import { useId } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Modal from '../../components/shared/Modal';

function formatMsg(template, vars = {}) {
  let out = String(template || '');
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(val ?? ''));
  }
  return out;
}

export function LinkChildModal({
  isOpen,
  onClose,
  onSubmit,
  linkInput,
  onLinkInputChange,
  linkError,
  relationship,
  onRelationshipChange,
  linking,
  gp = {},
}) {
  const linkCodeId = useId();
  const linkCodeErrorId = useId();
  const relationshipId = useId();
  const mc = gp.modals?.linkChild || {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mc.title || 'ربط حساب طالب بولي الأمر'}
      disableClose={linking}
      maxWidth="448px"
    >
      <p className="text-sm text-[var(--wn-text-secondary)] mb-4">
        {mc.desc || 'اطلب كود ربط ولي الأمر من حساب الطالب ثم أدخله هنا. يمكنك تكرار العملية لأي عدد من الأبناء، وكل ابن له كود مستقل:'}
      </p>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor={linkCodeId}
            className="block text-xs font-bold text-[var(--wn-text-primary)] mb-1"
          >
            {mc.codeLabel || 'كود ربط الطالب'}
          </label>
          <input
            id={linkCodeId}
            type="text"
            dir="ltr"
            placeholder={mc.codePlaceholder || 'مثال: WN-7F3A91C2'}
            value={linkInput}
            onChange={onLinkInputChange}
            aria-invalid={Boolean(linkError)}
            aria-describedby={linkError ? linkCodeErrorId : undefined}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)] text-sm"
            required
          />
          {linkError ? (
            <p
              id={linkCodeErrorId}
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--wn-text-danger)]"
            >
              {linkError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={relationshipId}
            className="block text-xs font-bold text-[var(--wn-text-primary)] mb-1"
          >
            {mc.relLabel || 'صلة القرابة'}
          </label>
          <select
            id={relationshipId}
            value={relationship}
            onChange={onRelationshipChange}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)] text-sm"
          >
            <option value="father">{mc.relFather || 'أب'}</option>
            <option value="mother">{mc.relMother || 'أم'}</option>
            <option value="guardian">{mc.relGuardian || 'ولي أمر / وصي'}</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={linking}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            {linking ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            <span>{linking ? (mc.submittingBtn || 'جاري الربط…') : (mc.submitBtn || 'تأكيد الربط')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={linking}
            className="min-h-[44px] px-4 border border-[var(--wn-border)] text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] rounded-xl text-sm font-medium transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            {mc.cancelBtn || 'إلغاء'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RsvpExcuseModal({
  session,
  onClose,
  onConfirm,
  excuseReason,
  onExcuseReasonChange,
  submittingRsvp,
  gp = {},
}) {
  const reasonId = useId();
  const ec = gp.modals?.rsvpExcuse || {};

  return (
    <Modal
      isOpen={Boolean(session)}
      onClose={onClose}
      title={ec.title || 'الاعتذار عن حضور حلقة القرآن'}
      disableClose={submittingRsvp}
      maxWidth="448px"
    >
      <div className="bg-[var(--wn-gold-soft)] border border-[var(--wn-border-strong)] rounded-xl p-3 text-xs text-[var(--wn-text-gold)] mb-4 flex items-start gap-2">
        {session?.canExcuseWithCompensation ? (
          <>
            <CheckCircle2
              size={16}
              className="shrink-0 mt-0.5 text-[var(--wn-badge-emerald-text)]"
              aria-hidden="true"
            />
            <p>
              {formatMsg(
                ec.compensatedNote ||
                  'تم تقديم الاعتذار قبل الموعد بأكثر من 6 ساعات ({hours} ساعة متبقية). يحق لك الحصول على حصة تعويضية مجانية!',
                { hours: session.hoursUntilSession }
              )}
            </p>
          </>
        ) : (
          <>
            <AlertTriangle
              size={16}
              className="shrink-0 mt-0.5 text-[var(--wn-text-gold)]"
              aria-hidden="true"
            />
            <p>
              {ec.lateNote ||
                'تبقى أقل من 6 ساعات على موعد الحصة. وفقًا للائحة الأكاديمية لا يمكن ضمان حصة تعويضية في حال الاعتذار المتأخر.'}
            </p>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor={reasonId}
            className="block text-xs font-bold text-[var(--wn-text-primary)] mb-1"
          >
            {ec.reasonLabel || 'سبب الاعتذار (اختياري)'}
          </label>
          <textarea
            id={reasonId}
            rows={3}
            value={excuseReason}
            onChange={onExcuseReasonChange}
            placeholder={ec.reasonPlaceholder || 'مثال: ظرف طارئ، مرض، اختبارات مدرسية...'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)] text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submittingRsvp}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 bg-[var(--wn-danger)] hover:opacity-90 text-[var(--wn-text-inverse)] font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            {submittingRsvp ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            <span>{submittingRsvp ? (ec.submittingBtn || 'جاري التسجيل…') : (ec.confirmBtn || 'تأكيد الاعتذار')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submittingRsvp}
            className="min-h-[44px] px-4 border border-[var(--wn-border)] text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] rounded-xl text-sm font-medium transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            {ec.cancelBtn || 'تراجع'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
