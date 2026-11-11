import { useEffect, useState } from 'react';
import { CalendarClock, Edit3, Plus, Trash2, UsersRound } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';

const DAYS = [['Saturday', 'السبت'], ['Sunday', 'الأحد'], ['Monday', 'الاثنين'], ['Tuesday', 'الثلاثاء'], ['Wednesday', 'الأربعاء'], ['Thursday', 'الخميس'], ['Friday', 'الجمعة']];

function durationOptionsFor(plan) {
  const min = plan?.durationMinMinutes || 1;
  const max = plan?.durationMaxMinutes || 60;
  return [30, 45, 60, 90, 120].filter(value => value >= min && value <= max);
}

export default function SubscriptionCircleCard({ circle, teachers = [], allStudents = [], onChanged }) {
  const toast = useToast();
  const [working, setWorking] = useState(false);
  const [schedule, setSchedule] = useState(circle.schedule?.length ? circle.schedule.map(({ day, startTime, endTime }) => ({ day, startTime, endTime })) : [{ day: 'Saturday', startTime: '', endTime: '' }]);
  const [timezone, setTimezone] = useState(circle.timezone || 'Africa/Cairo');
  const [sessionForm, setSessionForm] = useState({ scheduledAt: '', duration: durationOptionsFor(circle.plan)[0] || 60, notes: '' });
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editName, setEditName] = useState(circle.name || '');
  const [editTeacherId, setEditTeacherId] = useState(circle.teacher?._id || '');
  const [addStudentId, setAddStudentId] = useState('');

  useEffect(() => {
    setEditName(circle.name || '');
    setEditTeacherId(circle.teacher?._id || '');
    if (circle.schedule?.length) {
      setSchedule(circle.schedule.map(({ day, startTime, endTime }) => ({ day, startTime, endTime })));
    }
    if (circle.timezone) {
      setTimezone(circle.timezone);
    }
  }, [circle._id, circle.name, circle.teacher?._id, circle.schedule, circle.timezone]);

  const running = ['active', 'full'].includes(circle.status);
  const paused = circle.status === 'paused';
  const roster = (circle.roster || []).filter(item => item.status !== 'renewal_queued');
  const teacher = circle.teacher?.personalInfo?.fullName || circle.teacher?.user?.name || '—';

  const start = async () => {
    if (schedule.some(row => !row.startTime || !row.endTime || row.endTime <= row.startTime)) return toast.error('حدد بداية ونهاية صحيحتين لكل موعد');
    setWorking(true);
    try {
      await api.post('/api/subscriptions/admin/circles/' + circle._id + '/start', {
        schedule,
        timezone,
        allowUnderMinimum: true,
      }, { auth: true });
      toast.success('تم بدء الحلقة وتفعيل اشتراكات الطلاب. يمكنك الآن جدولة الحصص.');
      await onChanged();
    } catch (error) { toast.error(error.message || 'فشل بدء الحلقة'); }
    finally { setWorking(false); }
  };

  const saveCircleEdits = async () => {
    if (!editName.trim()) return toast.error('اكتب اسم المجموعة');
    const validSchedule = schedule.filter(row => row.day && row.startTime && row.endTime);
    if (validSchedule.some(row => row.endTime <= row.startTime)) {
      return toast.error('حدد بداية ونهاية صحيحتين لكل موعد');
    }
    setWorking(true);
    try {
      await api.put('/api/subscriptions/admin/circles/' + circle._id, {
        name: editName.trim(),
        teacherId: editTeacherId || undefined,
        timezone,
        schedule: validSchedule,
      }, { auth: true });
      toast.success('تم حفظ اسم المجموعة والمعلم والمواعيد بنجاح');
      setShowEditPanel(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || 'فشل تحديث بيانات المجموعة');
    } finally {
      setWorking(false);
    }
  };

  const handleAddStudent = async () => {
    if (!addStudentId) return toast.error('اختر الطالب أولاً');
    setWorking(true);
    try {
      await api.post(`/api/subscriptions/admin/circles/${circle._id}/students`, { studentId: addStudentId }, { auth: true });
      toast.success('تم إضافة الطالب إلى المجموعة بنجاح');
      setAddStudentId('');
      await onChanged();
    } catch (error) {
      toast.error(error.message || 'فشل إضافة الطالب للمجموعة');
    } finally {
      setWorking(false);
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!studentId) return;
    setWorking(true);
    try {
      await api.delete(`/api/subscriptions/admin/circles/${circle._id}/students/${studentId}`, { auth: true });
      toast.success(`تم إزالة ${studentName || 'الطالب'} من المجموعة وإعادته لطابور التسكين`);
      await onChanged();
    } catch (error) {
      toast.error(error.message || 'فشل إزالة الطالب من المجموعة');
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteCircle = async () => {
    setWorking(true);
    try {
      await api.delete(`/api/subscriptions/admin/circles/${circle._id}`, { auth: true });
      toast.success('تم حذف المجموعة وإعادة الطلاب لطابور التسكين');
      await onChanged();
    } catch (error) {
      toast.error(error.message || 'فشل حذف المجموعة');
    } finally {
      setWorking(false);
    }
  };

  const toggleCirclePause = async () => {
    const nextStatus = paused ? 'active' : 'paused';
    setWorking(true);
    try {
      await api.put('/api/subscriptions/admin/circles/' + circle._id + '/status', { status: nextStatus }, { auth: true });
      toast.success(nextStatus === 'paused' ? 'تم إيقاف الحلقة مؤقتاً' : 'تم استئناف تشغيل الحلقة');
      await onChanged();
    } catch (error) { toast.error(error.message || 'فشل تحديث حالة الحلقة'); }
    finally { setWorking(false); }
  };

  const scheduleSession = async () => {
    if (!sessionForm.scheduledAt) return toast.error('اختر موعد الحصة');
    setWorking(true);
    try {
      await api.post('/api/sessions/group-circle', { circleId: circle._id, ...sessionForm,
        duration: Number(sessionForm.duration), timezone }, { auth: true });
      toast.success('تم جدولة حصة الجروب وإرسال التنبيه للطلاب والمعلم');
      setSessionForm(current => ({ ...current, scheduledAt: '', notes: '' }));
    } catch (error) { toast.error(error.message || 'فشل جدولة الحصة'); }
    finally { setWorking(false); }
  };

  return (
    <article className="wn-dashboard-surface space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-lg">{circle.name}</h3>
            <button
              type="button"
              onClick={() => setShowEditPanel((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
            >
              <Edit3 size={13} /> {showEditPanel ? 'إغلاق التعديل' : 'تعديل الاسم / المعلم / المواعيد'}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={handleDeleteCircle}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
              title="حذف المجموعة"
            >
              <Trash2 size={13} /> حذف المجموعة
            </button>
          </div>
          <p className="text-sm text-slate-600">{teacher} · {circle.plan?.name?.ar} · {circle.section === 'ladies' ? 'قسم السيدات' : 'قسم الرجال والأطفال'}</p>
          <p className="text-xs text-slate-500">{circle.code}</p>
        </div>
        <div className="text-center rounded-xl bg-emerald-50 p-3">
          <strong className="flex items-center gap-2"><UsersRound size={18} /> {circle.studentCount}/{circle.capacity} طالب</strong>
          <p className="text-sm mt-1">{paused ? 'متوقفة' : running ? 'حلقة جارية' : circle.missingToStart ? `متبقي ${circle.missingToStart} طالب للحد القياسي (متاح البدء المبكر)` : 'جاهزة لتحديد المواعيد والبدء'}</p>
          {(running || paused) ? (
            <button type="button" disabled={working} onClick={toggleCirclePause} className="mt-2 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-200 bg-white hover:bg-emerald-100 text-emerald-900 transition">
              {paused ? 'استئناف تشغيل الحلقة' : 'إيقاف الحلقة مؤقتاً'}
            </button>
          ) : null}
        </div>
      </div>

      {showEditPanel ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
          <h4 className="font-bold text-sm text-emerald-950">تعديل اسم المجموعة والمعلم والمواعيد الأسبوعية</h4>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <label className="space-y-1 font-bold text-slate-700">
              <span>اسم المجموعة</span>
              <input
                type="text"
                maxLength={120}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
              />
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>معلم المجموعة</span>
              <select
                value={editTeacherId}
                onChange={(e) => setEditTeacherId(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
              >
                <option value={circle.teacher?._id || ''}>{teacher}</option>
                {teachers.filter((t) => String(t._id) !== String(circle.teacher?._id)).map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>المنطقة الزمنية للمجموعة</span>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
              />
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-emerald-200/60">
            <span className="block text-xs font-bold text-slate-700">تعديل المواعيد الأسبوعية للمجموعة</span>
            {schedule.map((row, index) => (
              <div key={index} className="grid sm:grid-cols-4 gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  اليوم الأسبوعي
                  <select className="block w-full border rounded-lg p-2 bg-white text-sm mt-1" value={row.day} onChange={event => setSchedule(current => current.map((item, position) => position === index ? { ...item, day: event.target.value } : item))}>
                    {DAYS.map(([day, label]) => <option key={day} value={day}>{label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  وقت البدء
                  <input type="time" className="block w-full border rounded-lg p-2 bg-white text-sm mt-1" value={row.startTime} onChange={event => setSchedule(current => current.map((item, position) => position === index ? { ...item, startTime: event.target.value } : item))} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  وقت الانتهاء
                  <input type="time" className="block w-full border rounded-lg p-2 bg-white text-sm mt-1" value={row.endTime} onChange={event => setSchedule(current => current.map((item, position) => position === index ? { ...item, endTime: event.target.value } : item))} />
                </label>
                <button type="button" className="wn-btn wn-btn--secondary self-end text-xs" disabled={schedule.length === 1} onClick={() => setSchedule(current => current.filter((_, position) => position !== index))}>
                  حذف الموعد
                </button>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button
                type="button"
                className="wn-btn wn-btn--secondary text-xs"
                disabled={schedule.length >= 7}
                onClick={() => setSchedule(current => [...current, { day: DAYS.find(([day]) => !current.some(row => row.day === day))?.[0] || 'Saturday', startTime: '', endTime: '' }])}
              >
                + إضافة يوم آخر
              </button>
              <button type="button" disabled={working} onClick={saveCircleEdits} className="wn-btn wn-btn--primary text-xs">
                {working ? 'جارٍ الحفظ...' : 'حفظ تعديلات المجموعة والمواعيد'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <details>
        <summary className="cursor-pointer font-semibold">قائمة الطلاب ورصيد الاشتراكات ({roster.length}) — إضافة أو حذف طالب</summary>
        <div className="overflow-x-auto mt-3 space-y-3">
          <table className="w-full text-sm text-right">
            <thead><tr className="border-b"><th className="p-2">الطالب</th><th>الباقة</th><th>المستخدم</th><th>المتبقي</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>{roster.map(item => (
              <tr key={item._id} className="border-b">
                <td className="p-2">{item.student?.name || 'طالب'}</td>
                <td>{item.sessionCount} حصة</td>
                <td>{item.sessionsUsed}</td>
                <td>{item.sessionsRemaining}</td>
                <td>{item.status === 'active' ? 'نشط' : item.status === 'paused' ? 'متوقف' : 'بانتظار البدء'}{circle.roster.some(renewal => renewal.renewalOf === item._id && renewal.status === 'renewal_queued') ? ' · تجديد مدفوع' : ''}</td>
                <td>
                  {item.student?._id ? (
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => handleRemoveStudent(item.student._id, item.student.name)}
                      className="text-xs text-rose-700 font-bold px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100"
                    >
                      حذف من المجموعة
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}</tbody>
          </table>

          {allStudents.length > 0 && circle.studentCount < circle.capacity ? (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
              <select
                value={addStudentId}
                onChange={(e) => setAddStudentId(e.target.value)}
                className="flex-1 min-w-[220px] border border-slate-300 rounded-lg p-2 text-xs bg-white"
                aria-label="إضافة طالب إلى المجموعة"
              >
                <option value="">اختر طالباً لإضافته وتسكينه مباشرة في هذه المجموعة...</option>
                {allStudents
                  .filter((s) => !roster.some((r) => String(r.student?._id) === String(s._id)))
                  .map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                  ))}
              </select>
              <button
                type="button"
                disabled={working || !addStudentId}
                onClick={handleAddStudent}
                className="wn-btn wn-btn--primary text-xs py-2 inline-flex items-center gap-1"
              >
                <Plus size={14} /> إضافة الطالب للمجموعة
              </button>
            </div>
          ) : null}
        </div>
      </details>

      {running ? (
        <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><CalendarClock size={18} /> جدولة حصة الجروب</h4>
          <p className="text-sm">المواعيد الأسبوعية: {(circle.schedule || []).map(row => `${DAYS.find(day => day[0] === row.day)?.[1]} ${row.startTime}–${row.endTime}`).join('، ') || 'لم تُحدد في الحلقة القديمة'} · {timezone}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">موعد الحصة بتوقيت {timezone}<input type="datetime-local" className="block w-full border rounded-lg p-2 mt-1" value={sessionForm.scheduledAt} onChange={event => setSessionForm(current => ({ ...current, scheduledAt: event.target.value }))} /></label>
            <label className="text-sm">مدة الحصة<select className="block w-full border rounded-lg p-2 mt-1" value={sessionForm.duration} onChange={event => setSessionForm(current => ({ ...current, duration: event.target.value }))}>{durationOptionsFor(circle.plan).map(value => <option key={value} value={value}>{value} دقيقة</option>)}</select></label>
          </div>
          <label className="block text-sm">ملاحظات<input className="block w-full border rounded-lg p-2 mt-1" value={sessionForm.notes} onChange={event => setSessionForm(current => ({ ...current, notes: event.target.value }))} /></label>
          <button type="button" className="wn-btn wn-btn--primary" disabled={working} onClick={scheduleSession}>{working ? 'جاري التنفيذ...' : 'جدولة الحصة وإرسال التنبيهات'}</button>
          <p className="text-xs text-slate-600">تُراجع إتاحة المعلم وتعارض المواعيد عند الجدولة. لا تخصم حصة الآن؛ الخصم بعد إتمام الحصة وفق الحضور والأعذار.</p>
        </div>
      ) : !paused && circle.studentCount > 0 && !showEditPanel ? (
        <div className="rounded-xl border bg-amber-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold">تحديد المواعيد وبدء الحلقة {circle.missingToStart > 0 ? '(متاح البدء المبكر قبل اكتمال العدد)' : ''}</h4>
          </div>
          <label className="block text-sm">المنطقة الزمنية<input className="block w-full border rounded-lg p-2 mt-1" value={timezone} onChange={event => setTimezone(event.target.value)} /></label>
          {schedule.map((row, index) => <div key={index} className="grid sm:grid-cols-4 gap-2">
            <label className="text-sm">اليوم<select className="block w-full border rounded-lg p-2" value={row.day} onChange={event => setSchedule(current => current.map((item, position) => position === index ? { ...item, day: event.target.value } : item))}>{DAYS.map(([day, label]) => <option key={day} value={day}>{label}</option>)}</select></label>
            <label className="text-sm">البداية<input type="time" className="block w-full border rounded-lg p-2" value={row.startTime} onChange={event => setSchedule(current => current.map((item, position) => position === index ? { ...item, startTime: event.target.value } : item))} /></label>
            <label className="text-sm">النهاية<input type="time" className="block w-full border rounded-lg p-2" value={row.endTime} onChange={event => setSchedule(current => current.map((item, position) => position === index ? { ...item, endTime: event.target.value } : item))} /></label>
            <button type="button" className="wn-btn wn-btn--secondary self-end" disabled={schedule.length === 1} onClick={() => setSchedule(current => current.filter((_, position) => position !== index))}>حذف الموعد</button>
          </div>)}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wn-btn wn-btn--secondary" disabled={schedule.length >= 7} onClick={() => setSchedule(current => [...current, { day: DAYS.find(([day]) => !current.some(row => row.day === day))?.[0] || 'Saturday', startTime: '', endTime: '' }])}>إضافة موعد أسبوعي</button>
            <button type="button" className="wn-btn wn-btn--primary" disabled={working} onClick={start}>{working ? 'جاري البدء...' : 'اعتماد المواعيد وبدء الحلقة'}</button>
          </div>
          <p className="text-xs">بدء الحلقة يفعّل الاشتراكات دون خصم (سواء اكتمل الحد الأدنى أو قررت الإدارة البدء المبكر). بعده تُجدول كل حصة بتاريخها الفعلي.</p>
        </div>
      ) : null}
    </article>
  );
}
