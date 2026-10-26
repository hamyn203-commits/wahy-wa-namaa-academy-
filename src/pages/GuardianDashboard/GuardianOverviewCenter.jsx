import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';

function statusLabel(status) {
  const map = {
    pending: 'بانتظار التأكيد',
    accepted: 'مؤكدة',
    rejected: 'مرفوضة',
    completed: 'مكتملة',
    cancelled: 'ملغاة',
  };
  return map[status] || status || '—';
}

export default function GuardianOverviewCenter({ child, nextSession }) {
  if (!child) return null;

  const permissions = child.permissions || {};
  const evaluation = child.latestEvaluation;
  const memScore = Number(evaluation?.memorizationScore ?? 0);
  const tajScore = Number(evaluation?.tajweedScore ?? 0);
  const attendanceRate = Number(child.attendance?.rate ?? 0);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <Sparkles size={14} />
              مركز المتابعة السريع
            </span>
            <h3 className="mt-1 text-lg font-black text-slate-900">رحلة {child.name} الآن</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {child.studentProfile?.level || 'المستوى غير محدد'}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <CalendarClock size={15} />
              الحصة القادمة
            </div>
            {nextSession ? (
              <>
                <p className="font-bold text-slate-900">
                  {new Date(nextSession.scheduledAt).toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {new Date(nextSession.scheduledAt).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {nextSession.type === 'trial' ? 'حصة تجريبية' : 'حصة منتظمة'}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                  {statusLabel(nextSession.status)}
                </span>
              </>
            ) : (
              <p className="text-sm text-slate-500">لا توجد حصة قادمة حاليًا.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <UserRoundCheck size={15} />
              المعلم الحالي
            </div>
            {nextSession?.teacher?.name ? (
              <div className="flex items-center gap-3">
                <img
                  src={nextSession.teacher.avatar || '/default-teacher.png'}
                  alt={nextSession.teacher.name}
                  className="h-11 w-11 rounded-full object-cover border border-white shadow-sm"
                />
                <div>
                  <p className="font-bold text-slate-900">{nextSession.teacher.name}</p>
                  <p className="text-xs text-slate-500">التواصل يتم داخل الأكاديمية</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">سيظهر المعلم هنا عند تأكيد الحجز.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <BookOpen size={15} />
              آخر تقييم
            </div>
            {evaluation ? (
              <div className="space-y-2.5 text-sm">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span>الحفظ</span>
                    <strong className="text-emerald-700">{evaluation.memorizationScore ?? '—'}/10</strong>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.min(100, memScore * 10)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span>التجويد</span>
                    <strong className="text-teal-700">{evaluation.tajweedScore ?? '—'}/10</strong>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-teal-100">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${Math.min(100, tajScore * 10)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">لا يوجد تقييم مسجل بعد.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
              <Clock3 size={15} />
              الحضور
            </div>
            <p className="text-xl font-black text-slate-900">
              {child.attendance?.rate != null ? child.attendance.rate + '%' : '—'}
            </p>
            {child.attendance?.rate != null && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${Math.min(100, attendanceRate)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1.5">
              {child.attendance
                ? `${child.attendance.attended || 0} حضور · ${child.attendance.absent || 0} غياب · ${child.attendance.excused || 0} اعتذار`
                : 'هذه البيانات غير متاحة حسب الصلاحيات.'}
            </p>
          </div>
        </div>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={19} className="text-emerald-700" />
          <h3 className="font-black text-slate-900">صلاحيات المتابعة</h3>
        </div>

        <div className="space-y-2">
          {[
            ['viewProgress', 'متابعة التقدم'],
            ['viewGrades', 'الاطلاع على التقييمات'],
            ['viewAttendance', 'متابعة الحضور'],
            ['receiveNotifications', 'استقبال التنبيهات'],
            ['approveEnrollments', 'اعتماد الاشتراكات'],
          ].map(([key, label]) => {
            const enabled = Boolean(permissions[key]);
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 border border-slate-100">
                <span className="text-sm text-slate-700">{label}</span>
                <span className={enabled ? 'text-emerald-600' : 'text-slate-300'}>
                  <CheckCircle2 size={17} />
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          المحادثات الصوتية والنصية ستُربط بصلاحية مستقلة في مرحلة الشات حتى نحافظ على خصوصية الطالب والمعلم.
        </p>
      </aside>
    </div>
  );
}
