import { useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Users } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import Modal from '../../components/shared/Modal';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function GroupSessionCompleteModal({ session, onClose, onCompleted }) {
  const toast = useToast();
  const { t } = useI18n();
  const tp = t?.teacherPortal || {};
  const gm = tp.modals?.groupComplete || {};
  const [form, setForm] = useState({
    surahRecited: '',
    fromAyah: '',
    toAyah: '',
    nextHomework: '',
    overallNotes: '',
    assignTaskToCircle: true,
  });
  const [studentScores, setStudentScores] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [ayahError, setAyahError] = useState('');
  const submitLock = useRef(false);

  useEffect(() => {
    if (!session) return;
    const attended = (session.attendance || []).filter((entry) => entry.status === 'attended');
    setStudentScores(
      attended.map((entry) => ({
        studentId: String(entry.student?._id || entry.student),
        name: entry.student?.name || tp.requests?.studentFallback || 'طالب',
        memorization: 5,
        tajweed: 5,
        note: '',
      }))
    );
    setForm({
      surahRecited: '',
      fromAyah: '',
      toAyah: '',
      nextHomework: '',
      overallNotes: '',
      assignTaskToCircle: true,
    });
    setAyahError('');
  }, [session, tp.requests?.studentFallback]);

  const updateStudentScore = (studentId, key, value) => {
    setStudentScores((current) =>
      current.map((row) => (row.studentId === studentId ? { ...row, [key]: value } : row))
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitLock.current || submitting || !session) return;

    const fromNum = form.fromAyah ? Number(form.fromAyah) : null;
    const toNum = form.toAyah ? Number(form.toAyah) : null;
    if (fromNum !== null && toNum !== null && toNum < fromNum) {
      const msg = tp.validation?.ayahOrderInvalid || 'يجب أن تكون آية النهاية أكبر من أو تساوي آية البداية';
      setAyahError(msg);
      return;
    }
    setAyahError('');

    submitLock.current = true;
    setSubmitting(true);

    const avgMem = studentScores.length
      ? Math.round(studentScores.reduce((acc, r) => acc + Number(r.memorization || 5), 0) / studentScores.length)
      : 5;
    const avgTaj = studentScores.length
      ? Math.round(studentScores.reduce((acc, r) => acc + Number(r.tajweed || 5), 0) / studentScores.length)
      : 5;

    try {
      const completed = await api.put(
        `/api/sessions/${session._id}/complete`,
        {
          evaluation: {
            attendance: 5,
            memorization: avgMem,
            tajweed: avgTaj,
            behavior: 5,
            commitment: 5,
            surahRecited: form.surahRecited.trim(),
            fromAyah: form.fromAyah ? Number(form.fromAyah) : undefined,
            toAyah: form.toAyah ? Number(form.toAyah) : undefined,
            nextHomework: form.nextHomework.trim(),
            overallNotes: form.overallNotes.trim() || gm.fallbackNotes || 'تم إغلاق الحصة الجماعية من لوحة المعلم',
          },
        },
        { auth: true }
      );

      if (studentScores.length > 0) {
        await api.post(
          `/api/sessions/${session._id}/report`,
          {
            studentReports: studentScores.map((row) => ({
              student: row.studentId,
              memorizationScore: Math.min(10, Math.max(0, Number(row.memorization || 5) * 2)),
              tajweedScore: Math.min(10, Math.max(0, Number(row.tajweed || 5) * 2)),
              surahRecited: form.surahRecited.trim(),
              fromAyah: form.fromAyah ? Number(form.fromAyah) : undefined,
              toAyah: form.toAyah ? Number(form.toAyah) : undefined,
              nextHomework: form.nextHomework.trim(),
              notes: row.note.trim() || form.overallNotes.trim(),
            })),
          },
          { auth: true }
        ).catch(() => {
          toast.info(gm.reportErrorInfo || 'تم إنهاء الحصة، وتعذر إرسال بعض التقارير الخارجية؛ التقييم محفوظ داخل الحصة.');
        });
      }

      const circleId = session.circle?._id || session.circle;
      if (form.assignTaskToCircle && form.nextHomework.trim() && circleId) {
        const targetName = form.surahRecited.trim()
          || session.circle?.name
          || gm.fallbackCircleName
          || 'الحلقة الجماعية';
        await api.post(
          '/api/teachers/dashboard/tasks',
          {
            circleId,
            sessionId: session._id,
            type: 'memorization',
            title: formatMsg(gm.taskTitlePrefix || 'واجب {target}', { target: targetName }),
            description: form.nextHomework.trim(),
          },
          { auth: true }
        ).catch(() => {
          toast.info(tp.toasts?.taskAssignFailed || 'فشل إسناد الواجب');
        });
      }

      const earnedAmount = Number(completed?.session?.earnings?.amount || 0);
      toast.success(
        formatMsg(
          tp.toasts?.groupCompleted || 'تم إنهاء الحصة الجماعية واحتساب أرصدة الطلاب (+{amount} ج.م للمعلم)',
          { amount: earnedAmount }
        )
      );
      onCompleted?.();
      onClose?.();
    } catch (error) {
      toast.error(error.message || tp.toasts?.groupCompleteFailed || 'فشل إكمال الحصة الجماعية');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const circleTitle = session?.circle?.name || gm.fallbackCircleName || 'الحلقة الجماعية';

  return (
    <Modal
      isOpen={Boolean(session)}
      onClose={onClose}
      title={circleTitle}
      ariaLabel={formatMsg(gm.ariaTitle || 'إنهاء وتقييم {name}', { name: circleTitle })}
      maxWidth="672px"
      disableClose={submitting}
    >
      <div className="space-y-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
            <Users size={14} aria-hidden="true" />
            <span>{gm.eyebrow || 'إغلاق الحصة الجماعية وإرسال التقرير'}</span>
          </span>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
            {gm.desc || 'سيتم خصم حصة واحدة من رصيد كل طالب مستحق حسب كشف الحضور والاعتذارات، وحفظ التقييم لجميع الحاضرين.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] p-4 space-y-3">
            <h4 className="text-sm font-bold text-[var(--wn-heading)] flex items-center gap-1.5">
              <BookOpen size={15} aria-hidden="true" />
              <span>{gm.curriculumTitle || 'مقرر الحلقة في هذه الحصة'}</span>
            </h4>
            <div>
              <label htmlFor="group-eval-surah" className="sr-only">
                {gm.surahPlaceholder || 'السورة / المقطع الذي تم تسميعه'}
              </label>
              <input
                id="group-eval-surah"
                className="input-field w-full"
                placeholder={gm.surahPlaceholder || 'السورة / المقطع الذي تم تسميعه (مثال: سورة الملك)'}
                value={form.surahRecited}
                onChange={(event) => setForm((cur) => ({ ...cur, surahRecited: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="group-eval-from-ayah" className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                  {gm.fromAyah || 'من آية'}
                </label>
                <input
                  id="group-eval-from-ayah"
                  type="number"
                  min="1"
                  aria-invalid={Boolean(ayahError)}
                  aria-describedby={ayahError ? 'group-eval-ayah-error' : undefined}
                  className="input-field w-full"
                  placeholder={gm.fromAyah || 'من آية'}
                  value={form.fromAyah}
                  onChange={(event) => {
                    setAyahError('');
                    setForm((cur) => ({ ...cur, fromAyah: event.target.value }));
                  }}
                />
              </div>
              <div>
                <label htmlFor="group-eval-to-ayah" className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                  {gm.toAyah || 'إلى آية'}
                </label>
                <input
                  id="group-eval-to-ayah"
                  type="number"
                  min="1"
                  aria-invalid={Boolean(ayahError)}
                  aria-describedby={ayahError ? 'group-eval-ayah-error' : undefined}
                  className="input-field w-full"
                  placeholder={gm.toAyah || 'إلى آية'}
                  value={form.toAyah}
                  onChange={(event) => {
                    setAyahError('');
                    setForm((cur) => ({ ...cur, toAyah: event.target.value }));
                  }}
                />
              </div>
            </div>
            {ayahError && (
              <p id="group-eval-ayah-error" role="alert" className="text-xs font-semibold text-[var(--wn-text-danger)]">
                {ayahError}
              </p>
            )}
            <div>
              <label htmlFor="group-eval-next-homework" className="sr-only">
                {gm.nextHomeworkPlaceholder || 'الهدف / الواجب القادم للحلقة'}
              </label>
              <input
                id="group-eval-next-homework"
                className="input-field w-full"
                placeholder={gm.nextHomeworkPlaceholder || 'الهدف / الواجب القادم للحلقة (مثال: تسميع سورة الملك 16-30)'}
                value={form.nextHomework}
                onChange={(event) => setForm((cur) => ({ ...cur, nextHomework: event.target.value }))}
              />
            </div>
            {form.nextHomework.trim() ? (
              <label htmlFor="group-eval-assign-checkbox" className="flex min-h-[44px] items-center gap-2 text-xs font-semibold text-[var(--wn-badge-emerald-text)] cursor-pointer">
                <input
                  id="group-eval-assign-checkbox"
                  type="checkbox"
                  checked={form.assignTaskToCircle}
                  onChange={(event) => setForm((cur) => ({ ...cur, assignTaskToCircle: event.target.checked }))}
                />
                <span>{gm.assignCircleCheckbox || 'إرسال الهدف القادم تلقائيًا كواجب صوتي في تبويب «واجباتي» لجميع الطلاب الحاضرين'}</span>
              </label>
            ) : null}
            <div>
              <label htmlFor="group-eval-notes" className="sr-only">
                {gm.notesPlaceholder || 'ملاحظات عامة'}
              </label>
              <textarea
                id="group-eval-notes"
                rows={2}
                className="input-field w-full"
                placeholder={gm.notesPlaceholder || 'ملاحظات عامة لأولياء الأمور والطلاب...'}
                value={form.overallNotes}
                onChange={(event) => setForm((cur) => ({ ...cur, overallNotes: event.target.value }))}
              />
            </div>
          </div>

          {studentScores.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-[var(--wn-heading)]">
                {formatMsg(gm.studentsHeading || 'تقييم الطلاب الحاضرين ({count})', { count: studentScores.length })}
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
                {studentScores.map((row) => {
                  const memId = `group-mem-${row.studentId}`;
                  const tajId = `group-taj-${row.studentId}`;
                  const noteId = `group-note-${row.studentId}`;
                  return (
                    <div
                      key={row.studentId}
                      className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-[var(--wn-heading)]">{row.name}</strong>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <label htmlFor={memId} className="flex items-center gap-1 font-semibold text-[var(--wn-text-primary)]">
                            <span>{gm.memLabel || 'الحفظ:'}</span>
                            <select
                              id={memId}
                              className="min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-2 py-1 font-bold"
                              value={row.memorization}
                              onChange={(e) => updateStudentScore(row.studentId, 'memorization', Number(e.target.value))}
                            >
                              {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}/5</option>)}
                            </select>
                          </label>
                          <label htmlFor={tajId} className="flex items-center gap-1 font-semibold text-[var(--wn-text-primary)]">
                            <span>{gm.tajweedLabel || 'التجويد:'}</span>
                            <select
                              id={tajId}
                              className="min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] px-2 py-1 font-bold"
                              value={row.tajweed}
                              onChange={(e) => updateStudentScore(row.studentId, 'tajweed', Number(e.target.value))}
                            >
                              {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}/5</option>)}
                            </select>
                          </label>
                        </div>
                      </div>
                      <label htmlFor={noteId} className="sr-only">
                        {formatMsg(gm.studentNotePlaceholder || 'ملاحظة خاصة لـ {name} (اختياري)', { name: row.name })}
                      </label>
                      <input
                        id={noteId}
                        className="input-field w-full text-xs"
                        placeholder={formatMsg(gm.studentNotePlaceholder || 'ملاحظة خاصة لـ {name} (اختياري)', { name: row.name })}
                        value={row.note}
                        onChange={(e) => updateStudentScore(row.studentId, 'note', e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="wn-btn wn-btn--secondary min-h-[44px] px-4 py-2 text-sm disabled:opacity-50"
            >
              {gm.cancelBtn || 'تراجع'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={16} aria-hidden="true" />
              )}
              <span>
                {submitting
                  ? (gm.submittingBtn || 'جاري الإغلاق والاعتماد…')
                  : (gm.confirmBtn || 'تأكيد إنهاء الحصة الجماعية')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
