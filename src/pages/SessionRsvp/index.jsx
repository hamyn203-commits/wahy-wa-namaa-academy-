import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Loader2, ShieldAlert, UserCheck, XCircle } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { dashboardPathForRole } from '../../lib/navigation';

export default function SessionRsvp() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, dir } = useI18n();
  const { user } = useAuth();

  const studentIdParam = searchParams.get('studentId') || '';

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [excuseMode, setExcuseMode] = useState(false);
  const [excuseReason, setExcuseReason] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const query = studentIdParam ? `?studentId=${encodeURIComponent(studentIdParam)}` : '';
    api.get(`/api/sessions/${encodeURIComponent(sessionId)}/rsvp${query}`, { auth: true })
      .then((data) => {
        if (!active) return;
        setInfo(data);
        if (data?.excuseReason && data?.rsvpStatus === 'excused') {
          setExcuseReason(data.excuseReason);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'تعذر تحميل تفاصيل الحصة');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId, studentIdParam]);

  const submitRsvp = async (status) => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        status,
        excuseReason: status === 'excused' ? excuseReason.trim() : '',
      };
      if (info?.studentId || studentIdParam) {
        payload.studentId = info?.studentId || studentIdParam;
      }
      const res = await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/rsvp`, payload, { auth: true });
      setResult(res);
      setInfo((prev) => (prev ? { ...prev, rsvpStatus: status } : prev));
      setExcuseMode(false);
    } catch (err) {
      setError(err?.message || 'تعذر حفظ الرد، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = info?.scheduledAt
    ? new Date(info.scheduledAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: info.timezone || 'Africa/Cairo',
      })
    : '';

  const goToDashboard = () => {
    navigate(dashboardPathForRole(user?.role, locale));
  };

  return (
    <div dir={dir} className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <SEOHead page={{ url: `/sessions/${sessionId}/rsvp`, noindex: true, canonical: false }} />
      <GlobalHeader />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <UserCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">تأكيد الحضور أو الاعتذار</h1>
              <p className="text-sm text-slate-500">أكاديمية وَحْيٌ وَنَمَاء — إدارة مواعيد الحلقات</p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="animate-spin text-emerald-600" size={28} />
              <span>جاري تحميل تفاصيل الحصة...</span>
            </div>
          ) : error && !info ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert size={18} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={goToDashboard}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium"
              >
                العودة إلى لوحة التحكم
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">الطالب:</span>
                  <span className="font-semibold text-slate-900">{info?.studentName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">المعلم:</span>
                  <span className="font-semibold text-slate-900">{info?.teacherName}</span>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar size={14} /> الموعد:
                  </span>
                  <span className="font-semibold text-slate-900">{formattedDate}</span>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock size={14} /> الحالة الحالية:
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {info?.rsvpStatus === 'confirmed'
                      ? 'مؤكد الحضور'
                      : info?.rsvpStatus === 'excused'
                        ? 'معتذر'
                        : 'بانتظار التأكيد'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
                الاعتذار قبل موعد الحصة بـ <strong>6 ساعات على الأقل</strong> يحفظ حق الطالب في حصة تعويضية دون خصم من الرصيد.
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {result ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3 text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    <span>{result.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={goToDashboard}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition"
                  >
                    الانتقال إلى لوحة التحكم
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitRsvp('confirmed')}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition disabled:opacity-60"
                    >
                      {submitting && !excuseMode ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                      <span>تأكيد الحضور</span>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setExcuseMode((prev) => !prev)}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold transition disabled:opacity-60"
                    >
                      <XCircle size={18} />
                      <span>اعتذار عن الحصة</span>
                    </button>
                  </div>

                  {excuseMode && (
                    <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
                      <label className="block text-sm font-semibold text-slate-700">
                        سبب الاعتذار (اختياري)
                      </label>
                      <textarea
                        rows={3}
                        value={excuseReason}
                        onChange={(e) => setExcuseReason(e.target.value)}
                        placeholder="مثال: ظرف عائلي طارئ أو موعد طبي..."
                        className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => submitRsvp('excused')}
                        className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition disabled:opacity-60"
                      >
                        {submitting ? 'جاري إرسال الاعتذار...' : 'تأكيد إرسال الاعتذار'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <GlobalFooter />
    </div>
  );
}
