import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import Skeleton from '../../components/shared/Skeleton';
import TeacherDashboard from './index';

export default function TeacherDashboardGate() {
  const { user, ready, logout } = useRequireAuth(['teacher']);
  const { locale, dir, t } = useI18n();
  const gate = t?.teacherPortal?.gate || {};

  if (!ready) {
    return (
      <main
        className="min-h-screen bg-[var(--wn-bg)] p-4 sm:p-6 flex items-center justify-center"
        dir={dir}
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">{t?.teacherPortal?.loadingSr || 'جاري تحميل لوحة المعلم…'}</span>
        <div className="max-w-xl w-full rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 sm:p-8 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  if (user.teacherApproved === true) return <TeacherDashboard />;

  const status = user.teacherApprovalStatus || 'pending';
  const reviewNote = String(user.teacherReviewNote || '').trim();
  const requestedChanges = Array.isArray(user.teacherRequestedChanges) ? user.teacherRequestedChanges : [];
  const hasSubmittedApplication = status !== 'pending' || Boolean(user.onboarding?.teacherApplicationReady);
  const canEditOrResubmit = !hasSubmittedApplication
    || status === 'under-review'
    || status === 'rejected'
    || requestedChanges.length > 0;

  const statusText = status === 'under-review'
    ? (gate.statusUnderReview || 'يحتاج استكمال / قيد المراجعة')
    : status === 'rejected'
      ? (gate.statusRejected || 'يحتاج مراجعة وتعديل')
      : status === 'suspended'
        ? (gate.statusSuspended || 'موقوف')
        : (gate.statusPending || 'قيد انتظار مراجعة الإدارة');

  return (
    <main className="min-h-screen bg-[var(--wn-bg)] p-4 sm:p-6 flex items-center justify-center" dir={dir}>
      <section className="max-w-xl w-full bg-[var(--wn-surface)] rounded-2xl shadow-sm border border-[var(--wn-border)] p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          {status === 'under-review' || status === 'rejected' ? (
            <AlertTriangle className="text-[var(--wn-warning)] shrink-0" size={28} aria-hidden="true" />
          ) : (
            <Clock className="text-[var(--wn-emerald)] shrink-0" size={28} aria-hidden="true" />
          )}
          <h1 className="text-2xl font-bold text-[var(--wn-heading)]">
            {gate.title || 'حساب المعلم — وحي ونماء'}
          </h1>
        </div>

        <p className="text-[var(--wn-text-primary)] mb-4">
          {hasSubmittedApplication
            ? (status === 'under-review' || requestedChanges.length > 0
                ? (gate.descChanges || 'راجعت الإدارة ملفك وطلبت استكمال أو تعديل بعض البيانات/المرفقات أدناه قبل الاعتماد.')
                : (gate.descPending || 'طلبك قيد متابعة الإدارة. لا يمكنك التدريس أو الظهور للطلاب قبل الاعتماد.'))
            : (gate.descIncomplete || 'تم إنشاء حسابك. الخطوة التالية هي استكمال ملف التقديم للمعلم.')}
        </p>

        <p className="text-sm text-[var(--wn-text-secondary)] mb-5">
          {gate.statusLabel || 'حالة الحساب:'}{' '}
          <strong className="text-[var(--wn-heading)]">{statusText}</strong>
        </p>

        {reviewNote ? (
          <div className="rounded-xl border border-[var(--wn-gold)]/40 bg-[var(--wn-gold-soft)] p-4 mb-4 text-sm text-[var(--wn-badge-gold-text)]">
            <strong className="block mb-1">{gate.reviewNoteTitle || 'ملاحظة المراجع الإداري:'}</strong>
            <p className="leading-relaxed">{reviewNote}</p>
          </div>
        ) : null}

        {requestedChanges.length > 0 ? (
          <div className="rounded-xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-4 mb-5 text-sm text-[var(--wn-text-danger)]">
            <strong className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{gate.requestedChangesTitle || 'البنود المطلوب تعديلها أو إعادة رفعها:'}</span>
            </strong>
            <ul className="space-y-1.5 text-xs">
              {requestedChanges.map((item) => (
                <li key={item.key} className="flex items-start gap-1.5">
                  <span className="font-bold">• {item.label}:</span>
                  <span>{item.note || gate.defaultChangeNote || 'يرجى مراجعة هذا البند وإعادة رفعه بوضوح'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          className="wn-btn wn-btn--primary wn-btn--block min-h-[44px] mb-3"
          to={localizedPath('/profile/setup', locale)}
        >
          {gate.completeProfileBtn || 'استكمال البيانات الأساسية'}
        </Link>

        {canEditOrResubmit && (
          <Link
            className="wn-btn wn-btn--secondary wn-btn--block min-h-[44px] mb-4"
            to={localizedPath('/register/teacher', locale)}
          >
            {hasSubmittedApplication
              ? (gate.editApplicationBtn || 'تعديل واستكمال طلب المعلم وإعادة رفع المرفقات')
              : (gate.completeApplicationBtn || 'استكمال طلب المعلم ورفع المستندات والفيديوهات')}
          </Link>
        )}

        <button
          type="button"
          onClick={logout}
          className="w-full min-h-[44px] rounded-xl text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] underline text-sm mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
        >
          {gate.logoutBtn || 'تسجيل الخروج'}
        </button>
      </section>
    </main>
  );
}
