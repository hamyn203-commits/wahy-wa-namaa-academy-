import { useState } from 'react';
import { CalendarClock, UsersRound } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastProvider';

const DAYS = [['Saturday', 'السبت'], ['Sunday', 'الأحد'], ['Monday', 'الاثنين'], ['Tuesday', 'الثلاثاء'], ['Wednesday', 'الأربعاء'], ['Thursday', 'الخميس'], ['Friday', 'الجمعة']];

function durationOptionsFor(plan) {
  const min = plan?.durationMinMinutes || 1;
  const max = plan?.durationMaxMinutes || 60;
  return [30, 45, 60, 90, 120].filter(value => value >= min && value <= max);
}

export default function SubscriptionCircleCard({ circle, onChanged }) {
  const toast = useToast();
  const [working, setWorking] = useState(false);
  const [schedule, setSchedule] = useState(circle.schedule?.length ? circle.schedule.map(({ day, startTime, endTime }) => ({ day, startTime, endTime })) : [{ day: 'Saturday', startTime: '', endTime: '' }]);
  const [timezone, setTimezone] = useState(circle.timezone || 'Africa/Cairo');
  const [sessionForm, setSessionForm] = useState({ scheduledAt: '', duration: durationOptionsFor(circle.plan)[0] || 60, notes: '' });
  const running = ['active', 'full'].includes(circle.status);
  const paused = circle.status === 'paused';
  const roster = circle.roster.filter(item => item.status !== 'renewal_queued');
  const teacher = circle.teacher?.personalInfo?.fullName || circle.teacher?.user?.name || '—';

  const start = async () => {
    if (schedule.some(row => !row.startTime || !row.endTime || row.endTime <= row.startTime)) return toast.error('حدد بداية ونهاية صحيحتين لكل موعد');
    setWorking(true);
    try {
      await api.post('/api/subscriptions/admin/circles/' + circle._id + '/start', { schedule, timezone }, { auth: true });
      toast.success('تم بدء الحلقة وتفعيل اشتراكات الطلاب. يمكنك الآن جدولة الحصص.');
      await onChanged();
    } catch (error) { toast.error(error.message || 'فشل بدء الحلقة'); }
    finally { setWorking(false); }
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
        <div>
          <h3 className="font-bold text-lg">{circle.name}</h3>
          <p className="text-sm text-slate-600">{teacher} · {circle.plan?.name?.ar} · {circle.section === 'ladies' ? 'قسم السيدات' : 'قسم الرجال والأطفال'}</p>
          <p className="text-xs text-slate-500">{circle.code}</p>
        </div>
        <div className="text-center rounded-xl bg-emerald-50 p-3">
          <strong className="flex items-center gap-2"><UsersRound size={18} /> {circle.studentCount}/{circle.capacity} طالب</strong>
          <p className="text-sm mt-1">{paused ? 'متوقفة' : running ? 'حلقة جارية' : circle.missingToStart ? `متبقي ${circle.missingToStart} طالب قبل تحديد المواعيد` : 'جاهزة لتحديد المواعيد والبدء'}</p>
          {(running || paused) ? (
            <button type="button" disabled={working} onClick={toggleCirclePause} className="mt-2 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-200 bg-white hover:bg-emerald-100 text-emerald-900 transition">
              {paused ? 'استئناف تشغيل الحلقة' : 'إيقاف الحلقة مؤقتاً'}
            </button>
          ) : null}
        </div>
      </div>

      <details>
        <summary className="cursor-pointer font-semibold">قائمة الطلاب ورصيد الاشتراكات ({roster.length})</summary>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm text-right">
            <thead><tr className="border-b"><th className="p-2">الطالب</th><th>الباقة</th><th>المستخدم</th><th>المتبقي</th><th>الحالة</th></tr></thead>
            <tbody>{roster.map(item => <tr key={item._id} className="border-b"><td className="p-2">{item.student?.name || 'طالب'}</td><td>{item.sessionCount} حصة</td><td>{item.sessionsUsed}</td><td>{item.sessionsRemaining}</td><td>{item.status === 'active' ? 'نشط' : item.status === 'paused' ? 'متوقف' : 'بانتظار البدء'}{circle.roster.some(renewal => renewal.renewalOf === item._id && renewal.status === 'renewal_queued') ? ' · تجديد مدفوع' : ''}</td></tr>)}</tbody>
          </table>
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
      ) : !paused && !circle.missingToStart ? (
        <div className="rounded-xl border bg-amber-50 p-4 space-y-3">
          <h4 className="font-bold">تحديد المواعيد وبدء الحلقة</h4>
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
          <p className="text-xs">بدء الحلقة يفعّل الاشتراكات دون خصم. بعده تُجدول كل حصة بتاريخها الفعلي.</p>
        </div>
      ) : null}
    </article>
  );
}
