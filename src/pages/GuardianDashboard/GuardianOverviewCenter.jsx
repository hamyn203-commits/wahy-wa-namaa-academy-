import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import TeacherAvatar from '../../components/shared/TeacherAvatar';

function formatMsg(template, vars = {}) {
  let out = String(template || '');
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(val ?? ''));
  }
  return out;
}

const DEFAULT_SESSION_STATUS_LABELS = {
  pending: 'بانتظار التأكيد',
  accepted: 'مؤكدة',
  rejected: 'مرفوضة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

function statusLabel(status, labels = {}) {
  return labels[status] || DEFAULT_SESSION_STATUS_LABELS[status] || status || '—';
}

export default function GuardianOverviewCenter({ child, nextSession }) {
  const { locale, t } = useI18n();

  if (!child) return null;

  const gp = t?.guardianPortal || {};
  const oc = gp.overviewCenter || {};
  const permLabels = oc.permLabels || {};
  const intlLocale = resolveIntlLocale(locale);

  const permissions = child.permissions || {};
  const evaluation = child.latestEvaluation;
  const memScore = Number(evaluation?.memorizationScore ?? 0);
  const tajScore = Number(evaluation?.tajweedScore ?? 0);
  const attendanceRate = Number(child.attendance?.rate ?? 0);

  const permissionItems = [
    ['viewProgress', permLabels.viewProgress || 'متابعة التقدم'],
    ['viewGrades', permLabels.viewGrades || 'الاطلاع على التقييمات'],
    ['viewAttendance', permLabels.viewAttendance || 'متابعة الحضور'],
    ['receiveNotifications', permLabels.receiveNotifications || 'استقبال التنبيهات'],
    ['approveEnrollments', permLabels.approveEnrollments || 'اعتماد الاشتراكات'],
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-text-accent)]">
              <Sparkles size={14} aria-hidden="true" />
              <span>{oc.eyebrow || 'مركز المتابعة السريع'}</span>
            </span>
            <h3 className="mt-1 text-lg font-black text-[var(--wn-heading)]">
              {formatMsg(oc.journeyTitle || 'رحلة {name} الآن', { name: child.name })}
            </h3>
          </div>
          <span className="rounded-full bg-[var(--wn-emerald-soft)] px-3 py-1 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
            {child.studentProfile?.level || oc.levelFallback || 'المستوى غير محدد'}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
            <div className="flex items-center gap-2 text-[var(--wn-text-tertiary)] text-xs mb-2">
              <CalendarClock size={15} aria-hidden="true" />
              <span>{oc.nextSessionLabel || 'الحصة القادمة'}</span>
            </div>
            {nextSession ? (
              <>
                <p className="font-bold text-[var(--wn-heading)]">
                  {new Date(nextSession.scheduledAt).toLocaleDateString(intlLocale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                  {new Date(nextSession.scheduledAt).toLocaleTimeString(intlLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {nextSession.type === 'trial'
                    ? (oc.trialSession || 'حصة تجريبية')
                    : (oc.regularSession || 'حصة منتظمة')}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-[var(--wn-gold-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--wn-text-gold)]">
                  {statusLabel(nextSession.status, gp.sessionStatuses)}
                </span>
              </>
            ) : (
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {oc.noUpcoming || 'لا توجد حصة قادمة حاليًا.'}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
            <div className="flex items-center gap-2 text-[var(--wn-text-tertiary)] text-xs mb-2">
              <UserRoundCheck size={15} aria-hidden="true" />
              <span>{oc.currentTutorLabel || 'المعلم الحالي'}</span>
            </div>
            {nextSession?.teacher?.name ? (
              <div className="flex items-center gap-3">
                <TeacherAvatar
                  src={nextSession.teacher.avatar}
                  name={nextSession.teacher.name}
                  size="sm"
                  className="h-11 w-11 rounded-full shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-bold text-[var(--wn-heading)] truncate">{nextSession.teacher.name}</p>
                  <p className="text-xs text-[var(--wn-text-tertiary)]">
                    {oc.internalCommHint || 'التواصل يتم داخل الأكاديمية'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {oc.tutorPlaceholder || 'سيظهر المعلم هنا عند تأكيد الحجز.'}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
            <div className="flex items-center gap-2 text-[var(--wn-text-tertiary)] text-xs mb-2">
              <BookOpen size={15} aria-hidden="true" />
              <span>{oc.lastEvalLabel || 'آخر تقييم'}</span>
            </div>
            {evaluation ? (
              <div className="space-y-2.5 text-sm">
                <div>
                  <div className="flex items-center justify-between text-xs text-[var(--wn-text-secondary)]">
                    <span>{oc.memorization || 'الحفظ'}</span>
                    <strong className="text-[var(--wn-badge-emerald-text)]">{evaluation.memorizationScore ?? '—'}/10</strong>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--wn-surface-sunken)]">
                    <div
                      className="h-full rounded-full bg-[var(--wn-emerald)]"
                      style={{ width: `${Math.min(100, memScore * 10)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-[var(--wn-text-secondary)]">
                    <span>{oc.tajweed || 'التجويد'}</span>
                    <strong className="text-[var(--wn-text-accent)]">{evaluation.tajweedScore ?? '—'}/10</strong>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--wn-surface-sunken)]">
                    <div
                      className="h-full rounded-full bg-[var(--wn-teal-dark)]"
                      style={{ width: `${Math.min(100, tajScore * 10)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {oc.noEval || 'لا يوجد تقييم مسجل بعد.'}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
            <div className="flex items-center gap-2 text-[var(--wn-text-tertiary)] text-xs mb-2">
              <Clock3 size={15} aria-hidden="true" />
              <span>{oc.attendanceLabel || 'الحضور'}</span>
            </div>
            <p className="text-xl font-black text-[var(--wn-heading)]">
              {child.attendance?.rate != null ? `${child.attendance.rate}%` : '—'}
            </p>
            {child.attendance?.rate != null && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--wn-surface-sunken)]">
                <div
                  className="h-full rounded-full bg-[var(--wn-emerald)]"
                  style={{ width: `${Math.min(100, attendanceRate)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-[var(--wn-text-secondary)] mt-1.5">
              {child.attendance
                ? formatMsg(oc.attendanceBreakdown || '{attended} حضور · {absent} غياب · {excused} اعتذار', {
                    attended: child.attendance.attended || 0,
                    absent: child.attendance.absent || 0,
                    excused: child.attendance.excused || 0,
                  })
                : (oc.noPermissionData || 'هذه البيانات غير متاحة حسب الصلاحيات.')}
            </p>
          </div>
        </div>
      </section>

      <aside className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={19} className="text-[var(--wn-text-accent)]" aria-hidden="true" />
          <h3 className="font-black text-[var(--wn-heading)]">
            {oc.permissionsTitle || 'صلاحيات المتابعة'}
          </h3>
        </div>

        <div className="space-y-2">
          {permissionItems.map(([key, label]) => {
            const enabled = Boolean(permissions[key]);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--wn-surface)] px-3 py-2 border border-[var(--wn-border)]"
              >
                <span className="text-sm text-[var(--wn-text-primary)]">{label}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0 ${
                    enabled
                      ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                      : 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-tertiary)]'
                  }`}
                >
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span>{enabled ? (oc.enabledBadge || 'مفعّل') : (oc.restrictedBadge || 'مقيد')}</span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] leading-5 text-[var(--wn-text-tertiary)]">
          {oc.chatPrivacyNote || 'المحادثات الصوتية والنصية ستُربط بصلاحية مستقلة في مرحلة الشات حتى نحافظ على خصوصية الطالب والمعلم.'}
        </p>
      </aside>
    </div>
  );
}
