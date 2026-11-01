import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import TeacherDashboard from './index';

export default function TeacherDashboardGate() {
  const { user, ready, logout } = useRequireAuth(['teacher']);
  const { locale } = useI18n();
  if (!ready) return null;
  if (user.teacherApproved === true) return <TeacherDashboard />;

  const status = user.teacherApprovalStatus || 'pending';
  const reviewNote = String(user.teacherReviewNote || '').trim();
  const requestedChanges = Array.isArray(user.teacherRequestedChanges) ? user.teacherRequestedChanges : [];
  const hasSubmittedApplication = status !== 'pending' || Boolean(user.onboarding?.teacherApplicationReady);
  const canEditOrResubmit = !hasSubmittedApplication
    || status === 'under-review'
    || status === 'rejected'
    || requestedChanges.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center" dir="rtl">
      <section className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-4">
          {status === 'under-review' || status === 'rejected' ? (
            <AlertTriangle className="text-amber-600 shrink-0" size={28} />
          ) : (
            <Clock className="text-emerald-700 shrink-0" size={28} />
          )}
          <h1 className="text-2xl font-bold text-slate-900">حساب المعلم — وحي ونماء</h1>
        </div>

        <p className="text-slate-700 mb-4">
          {hasSubmittedApplication
            ? (status === 'under-review' || requestedChanges.length > 0
                ? 'راجعت الإدارة ملفك وطلبت استكمال أو تعديل بعض البيانات/المرفقات أدناه قبل الاعتماد.'
                : 'طلبك قيد متابعة الإدارة. لا يمكنك التدريس أو الظهور للطلاب قبل الاعتماد.')
            : 'تم إنشاء حسابك. الخطوة التالية هي استكمال ملف التقديم للمعلم.'}
        </p>

        <p className="text-sm text-slate-500 mb-5">
          حالة الحساب:{' '}
          <strong className="text-slate-800">
            {status === 'under-review'
              ? 'يحتاج استكمال / قيد المراجعة'
              : status === 'rejected'
                ? 'يحتاج مراجعة وتعديل'
                : status === 'suspended'
                  ? 'موقوف'
                  : 'قيد انتظار مراجعة الإدارة'}
          </strong>
        </p>

        {reviewNote ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 text-sm text-amber-950">
            <strong className="block mb-1">ملاحظة المراجع الإداري:</strong>
            <p className="leading-relaxed">{reviewNote}</p>
          </div>
        ) : null}

        {requestedChanges.length > 0 ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 mb-5 text-sm text-rose-950">
            <strong className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={16} /> البنود المطلوب تعديلها أو إعادة رفعها:
            </strong>
            <ul className="space-y-1.5 text-xs">
              {requestedChanges.map((item) => (
                <li key={item.key} className="flex items-start gap-1.5">
                  <span className="font-bold">• {item.label}:</span>
                  <span>{item.note || 'يرجى مراجعة هذا البند وإعادة رفعه بوضوح'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          className="block text-center bg-emerald-800 text-white py-3 rounded-xl font-bold mb-3 hover:bg-emerald-900 transition"
          to={localizedPath('/profile/setup', locale)}
        >
          استكمال البيانات الأساسية
        </Link>

        {canEditOrResubmit && (
          <Link
            className="block text-center border border-emerald-800 text-emerald-900 py-3 rounded-xl font-bold mb-4 hover:bg-emerald-50 transition"
            to={localizedPath('/register/teacher', locale)}
          >
            {hasSubmittedApplication
              ? 'تعديل واستكمال طلب المعلم وإعادة رفع المرفقات'
              : 'استكمال طلب المعلم ورفع المستندات والفيديوهات'}
          </Link>
        )}

        <button className="w-full text-slate-600 underline text-sm mt-1" onClick={logout}>
          تسجيل الخروج
        </button>
      </section>
    </main>
  );
}
