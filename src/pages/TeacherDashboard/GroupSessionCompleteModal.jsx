import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Users, X } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';

export default function GroupSessionCompleteModal({ session, onClose, onCompleted }) {
  const toast = useToast();
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

  useEffect(() => {
    if (!session) return;
    const attended = (session.attendance || []).filter((entry) => entry.status === 'attended');
    setStudentScores(
      attended.map((entry) => ({
        studentId: String(entry.student?._id || entry.student),
        name: entry.student?.name || 'طالب',
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
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, submitting, onClose]);

  if (!session) return null;

  const updateStudentScore = (studentId, key, value) => {
    setStudentScores((current) =>
      current.map((row) => (row.studentId === studentId ? { ...row, [key]: value } : row))
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
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
            overallNotes: form.overallNotes.trim() || 'تم إغلاق الحصة الجماعية من لوحة المعلم',
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
          toast.info('تم إنهاء الحصة، وتعذر إرسال بعض التقارير الخارجية؛ التقييم محفوظ داخل الحصة.');
        });
      }

      const circleId = session.circle?._id || session.circle;
      if (form.assignTaskToCircle && form.nextHomework.trim() && circleId) {
        await api.post(
          '/api/teachers/dashboard/tasks',
          {
            circleId,
            sessionId: session._id,
            type: 'memorization',
            title: form.surahRecited.trim()
              ? `واجب ${form.surahRecited.trim()}`
              : `واجب ${session.circle?.name || 'الحلقة الجماعية'}`,
            description: form.nextHomework.trim(),
          },
          { auth: true }
        ).catch(() => {});
      }

      const earnedAmount = Number(completed?.session?.earnings?.amount || 0);
      toast.success(`تم إنهاء الحصة الجماعية واحتساب أرصدة الطلاب (+${earnedAmount} ج.م للمعلم)`);
      onCompleted?.();
      onClose?.();
    } catch (error) {
      toast.error(error.message || 'فشل إكمال الحصة الجماعية');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" dir="rtl">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={`إنهاء وتقييم ${session.circle?.name || 'الحصة الجماعية'}`}
      >
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          aria-label="إغلاق النافذة"
          className="absolute end-4 top-4 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <Users size={14} /> إغلاق الحصة الجماعية وإرسال التقرير
          </span>
          <h3 className="text-lg font-extrabold text-slate-900 mt-1">
            {session.circle?.name || 'الحلقة الجماعية'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            سيتم خصم حصة واحدة من رصيد كل طالب مستحق حسب كشف الحضور والاعتذارات، وحفظ التقييم لجميع الحاضرين.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
            <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <BookOpen size={15} /> مقرر الحلقة في هذه الحصة
            </h4>
            <input
              className="input-field w-full"
              placeholder="السورة / المقطع الذي تم تسميعه (مثال: سورة الملك)"
              value={form.surahRecited}
              onChange={(event) => setForm((cur) => ({ ...cur, surahRecited: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="1"
                className="input-field w-full"
                placeholder="من آية"
                value={form.fromAyah}
                onChange={(event) => setForm((cur) => ({ ...cur, fromAyah: event.target.value }))}
              />
              <input
                type="number"
                min="1"
                className="input-field w-full"
                placeholder="إلى آية"
                value={form.toAyah}
                onChange={(event) => setForm((cur) => ({ ...cur, toAyah: event.target.value }))}
              />
            </div>
            <input
              className="input-field w-full"
              placeholder="الهدف / الواجب القادم للحلقة (مثال: تسميع سورة الملك 16-30)"
              value={form.nextHomework}
              onChange={(event) => setForm((cur) => ({ ...cur, nextHomework: event.target.value }))}
            />
            {form.nextHomework.trim() ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <input
                  type="checkbox"
                  checked={form.assignTaskToCircle}
                  onChange={(event) => setForm((cur) => ({ ...cur, assignTaskToCircle: event.target.checked }))}
                />
                إرسال الهدف القادم تلقائياً كواجب صوتي في تبويب «واجباتي» لجميع الطلاب الحاضرين
              </label>
            ) : null}
            <textarea
              rows={2}
              className="input-field w-full"
              placeholder="ملاحظات عامة لأولياء الأمور والطلاب..."
              value={form.overallNotes}
              onChange={(event) => setForm((cur) => ({ ...cur, overallNotes: event.target.value }))}
            />
          </div>

          {studentScores.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-800">
                تقييم الطلاب الحاضرين ({studentScores.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
                {studentScores.map((row) => (
                  <div
                    key={row.studentId}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-slate-900">{row.name}</strong>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1 font-semibold text-slate-700">
                          الحفظ:
                          <select
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold"
                            value={row.memorization}
                            onChange={(e) => updateStudentScore(row.studentId, 'memorization', Number(e.target.value))}
                          >
                            {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}/5</option>)}
                          </select>
                        </label>
                        <label className="flex items-center gap-1 font-semibold text-slate-700">
                          التجويد:
                          <select
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold"
                            value={row.tajweed}
                            onChange={(e) => updateStudentScore(row.studentId, 'tajweed', Number(e.target.value))}
                          >
                            {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}/5</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                    <input
                      className="input-field w-full text-xs"
                      placeholder={`ملاحظة خاصة لـ ${row.name} (اختياري)`}
                      value={row.note}
                      onChange={(e) => updateStudentScore(row.studentId, 'note', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              تراجع
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              {submitting ? 'جاري الإغلاق والاعتماد...' : 'تأكيد إنهاء الحصة الجماعية'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
