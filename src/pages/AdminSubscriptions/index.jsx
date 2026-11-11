import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Plus, RefreshCw, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import SubscriptionCircleCard from './SubscriptionCircleCard';

const DAYS = [['Saturday', 'السبت'], ['Sunday', 'الأحد'], ['Monday', 'الاثنين'], ['Tuesday', 'الثلاثاء'], ['Wednesday', 'الأربعاء'], ['Thursday', 'الخميس'], ['Friday', 'الجمعة']];

function planName(item) { return item.pricingSnapshot?.nameAr || item.planKey; }
function teacherName(item) { return item.preferredTeacher?.personalInfo?.fullName || item.preferredTeacher?.user?.name || 'لم يُحدد'; }

export default function AdminSubscriptions() {
  const { user, ready, logout } = useRequireAuth(['admin']);
  const navigate = useNavigate();
  const toast = useToast();
  const showLoadError = toast.error;
  const [tab, setTab] = useState('awaiting');
  const [subscriptions, setSubscriptions] = useState([]);
  const [circles, setCircles] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [search, setSearch] = useState('');
  const [showNewCircleForm, setShowNewCircleForm] = useState(false);
  const [newCircleForm, setNewCircleForm] = useState({
    name: '',
    teacherId: '',
    planKey: 'group',
    section: 'men_children',
    day: 'Saturday',
    startTime: '',
    endTime: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [placements, groups] = await Promise.all([
        api.get('/api/subscriptions/admin/placements?status=awaiting_placement', { auth: true }),
        api.get('/api/subscriptions/admin/circles', { auth: true }),
      ]);
      setSubscriptions(placements.subscriptions || []);
      setCircles(groups.circles || []);
      setTeachers(groups.teachers || placements.teachers || []);
      setAllStudents(groups.students || []);
    } catch (error) { showLoadError(error.message || 'تعذر تحميل الاشتراكات والحلقات'); }
    finally { setLoading(false); }
  }, [showLoadError]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const formFor = item => forms[item._id] || {
    mode: item.compatibleCircles?.length ? 'existing' : 'new',
    existingCircleId: item.compatibleCircles?.[0]?._id || item.flexibleCircles?.[0]?._id || '',
    circleName: planName(item) + ' — ' + teacherName(item),
    teacherId: item.preferredTeacher?._id || '',
    setScheduleNow: false,
    startImmediately: false,
    day: 'Saturday',
    startTime: '18:00',
    endTime: '19:00',
    timezone: 'Africa/Cairo',
  };
  const updateForm = (item, patch) => setForms(current => ({
    ...current, [item._id]: { ...formFor(item), ...patch },
  }));

  const place = async item => {
    if (working) return;
    const form = formFor(item);
    if ((form.mode === 'existing' || form.mode === 'flexible') && !form.existingCircleId) return toast.error('اختر جروب موجود أو أنشئ جروب جديد');
    if (form.mode === 'new' && !form.circleName.trim()) return toast.error('اكتب اسم الجروب');
    if (form.setScheduleNow && (!form.startTime || !form.endTime || form.endTime <= form.startTime)) {
      return toast.error('حدد وقت بداية ونهاية صحيح للموعد');
    }
    setWorking(item._id);
    try {
      const schedulePayload = form.setScheduleNow
        ? [{ day: form.day || 'Saturday', startTime: form.startTime, endTime: form.endTime }]
        : undefined;
      const payload = form.mode === 'existing' || form.mode === 'flexible'
        ? {
            existingCircleId: form.existingCircleId,
            allowFlexibleCircle: form.mode === 'flexible',
            schedule: schedulePayload,
            timezone: form.timezone || 'Africa/Cairo',
            startImmediately: Boolean(form.setScheduleNow && form.startImmediately),
          }
        : {
            circleName: form.circleName.trim(),
            teacherId: form.teacherId || undefined,
            schedule: schedulePayload,
            timezone: form.timezone || 'Africa/Cairo',
            startImmediately: Boolean(form.setScheduleNow && form.startImmediately),
          };
      const result = await api.post('/api/subscriptions/admin/' + encodeURIComponent(item._id) + '/place', payload, { auth: true });
      toast.success(result.subscriptionStatus === 'active'
        ? 'تم تسكين الطالب وتشغيل الحلقة الجارية دون خصم أي حصة.'
        : result.circleStatus === 'ready'
          ? 'تم التسكين واكتمل العدد. افتح الحلقات لتحديد المواعيد والبدء.'
          : 'تم التسكين بنجاح. يمكنك بدء الحلقة فوراً من تبويب الحلقات أو انتظار اكتمال العدد.');
      await load();
    } catch (error) { toast.error(error.message || 'فشل التسكين'); }
    finally { setWorking(''); }
  };

  const createStandaloneCircle = async (e) => {
    e.preventDefault();
    if (!newCircleForm.name.trim()) return toast.error('اكتب اسم المجموعة');
    if (!newCircleForm.teacherId) return toast.error('اختر معلم المجموعة');
    setWorking('create-circle');
    try {
      const schedule = newCircleForm.startTime && newCircleForm.endTime && newCircleForm.endTime > newCircleForm.startTime
        ? [{ day: newCircleForm.day, startTime: newCircleForm.startTime, endTime: newCircleForm.endTime }]
        : [];
      await api.post('/api/subscriptions/admin/circles', {
        name: newCircleForm.name.trim(),
        teacherId: newCircleForm.teacherId,
        planKey: newCircleForm.planKey,
        section: newCircleForm.section,
        schedule,
      }, { auth: true });
      toast.success('تم إنشاء المجموعة الجديدة بنجاح');
      setNewCircleForm({ name: '', teacherId: '', planKey: 'group', section: 'men_children', day: 'Saturday', startTime: '', endTime: '' });
      setShowNewCircleForm(false);
      await load();
    } catch (error) {
      toast.error(error.message || 'فشل إنشاء المجموعة');
    } finally {
      setWorking('');
    }
  };

  const filteredSubscriptions = useMemo(() => subscriptions.filter(item => [item.student?.name, teacherName(item), planName(item)].join(' ').includes(search)), [subscriptions, search]);
  const filteredCircles = useMemo(() => circles.filter(circle => [circle.name, circle.teacher?.personalInfo?.fullName, circle.teacher?.user?.name, circle.plan?.name?.ar].join(' ').includes(search)), [circles, search]);
  const readyCount = circles.filter(circle => circle.status === 'ready').length;

  if (!ready) return null;
  return (
    <DashboardLayout title="إدارة اشتراكات الطلاب والتسكين" user={user} onLogout={logout}>
      <div className="space-y-5" dir="rtl">
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" className="wn-btn wn-btn--secondary" onClick={() => navigate('..', { relative: 'path' })}><ArrowRight size={16} /> لوحة الإدارة</button>
          <div className="flex gap-2">
            <button type="button" className="wn-btn wn-btn--secondary" onClick={() => navigate('../payments', { relative: 'path' })}>مراجعة إيصالات الدفع</button>
            <button type="button" className="wn-btn wn-btn--secondary" disabled={loading || Boolean(working)} onClick={load}><RefreshCw size={16} /> تحديث</button>
          </div>
        </div>
        <div className="wn-dashboard-surface">
          <h2 className="font-bold text-xl flex gap-2 items-center"><UsersRound /> تسكين الطلاب وتشغيل الحلقات</h2>
          <p className="mt-2 text-sm text-slate-600">اعتماد الدفع ← التسكين مع المعلم والخطة المختارين ← اكتمال العدد ← تحديد المواعيد وبدء الحلقة ← جدولة الحصص. الخصم بعد إتمام كل حصة وفق الحضور والأعذار.</p>
          <p className="mt-2 text-sm">باقة 10 جنيه: من 15 إلى 20 طالب. رصيد كل طالب مستقل حسب اشتراكه: 4 أو 8 أو 12 أو 24 حصة.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" aria-pressed={tab === 'awaiting'} className={'wn-btn ' + (tab === 'awaiting' ? 'wn-btn--primary' : 'wn-btn--secondary')} onClick={() => setTab('awaiting')}>بانتظار التسكين ({subscriptions.length})</button>
            <button type="button" aria-pressed={tab === 'circles'} className={'wn-btn ' + (tab === 'circles' ? 'wn-btn--primary' : 'wn-btn--secondary')} onClick={() => setTab('circles')}>الحلقات ({circles.length}) · جاهزة للبدء ({readyCount})</button>
          </div>
        </div>
        <label className="block text-sm">بحث باسم الطالب أو المعلم أو الحلقة<input className="block w-full border rounded-xl p-3 mt-1" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {loading ? <div className="flex justify-center py-12"><div className="spinner spinner-lg" /></div> : tab === 'circles' ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowNewCircleForm((v) => !v)}
                className="wn-btn wn-btn--primary text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={15} /> {showNewCircleForm ? 'إغلاق نموذج الإنشاء' : 'إنشاء مجموعة جديدة وتسميتها'}
              </button>
            </div>

            {showNewCircleForm ? (
              <form onSubmit={createStandaloneCircle} className="wn-dashboard-surface border-emerald-200 bg-emerald-50/40 space-y-3">
                <h3 className="font-bold text-sm text-emerald-950">إنشاء مجموعة جديدة وتعيين المعلم والمواعيد</h3>
                <div className="grid sm:grid-cols-4 gap-3 text-xs">
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>اسم المجموعة *</span>
                    <input required type="text" maxLength={120} placeholder="مثال: مجموعة النور لتحفيظ القرآن" value={newCircleForm.name} onChange={(e) => setNewCircleForm((p) => ({ ...p, name: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" />
                  </label>
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>المعلم المسؤول *</span>
                    <select required value={newCircleForm.teacherId} onChange={(e) => setNewCircleForm((p) => ({ ...p, teacherId: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white">
                      <option value="">اختر المعلم...</option>
                      {teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>نوع الباقة</span>
                    <select value={newCircleForm.planKey} onChange={(e) => setNewCircleForm((p) => ({ ...p, planKey: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white">
                      <option value="community">حلقة اقتصادية (15-20 طالب)</option>
                      <option value="group">حلقة جماعية (6-8 طلاب)</option>
                      <option value="focused">حلقة مركزة (3-5 طلاب)</option>
                      <option value="mini">ثنائية / ثلاثية (2-3 طلاب)</option>
                      <option value="private">مكثفة فردية (طالب واحد)</option>
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>القسم</span>
                    <select value={newCircleForm.section} onChange={(e) => setNewCircleForm((p) => ({ ...p, section: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white">
                      <option value="men_children">قسم الرجال والأطفال</option>
                      <option value="ladies">قسم السيدات</option>
                    </select>
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>يوم الموعد الأسبوعي (اختياري)</span>
                    <select value={newCircleForm.day} onChange={(e) => setNewCircleForm((p) => ({ ...p, day: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white">
                      {DAYS.map(([day, label]) => <option key={day} value={day}>{label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>وقت البداية (اختياري)</span>
                    <input type="time" value={newCircleForm.startTime} onChange={(e) => setNewCircleForm((p) => ({ ...p, startTime: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" />
                  </label>
                  <label className="space-y-1 font-bold text-slate-700">
                    <span>وقت النهاية (اختياري)</span>
                    <input type="time" value={newCircleForm.endTime} onChange={(e) => setNewCircleForm((p) => ({ ...p, endTime: e.target.value }))} className="block w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewCircleForm(false)} className="wn-btn wn-btn--secondary text-xs">إلغاء</button>
                  <button type="submit" disabled={Boolean(working)} className="wn-btn wn-btn--primary text-xs">إنشاء وحفظ المجموعة</button>
                </div>
              </form>
            ) : null}

            {filteredCircles.length ? filteredCircles.map(circle => (
              <SubscriptionCircleCard
                key={circle._id}
                circle={circle}
                teachers={teachers}
                allStudents={allStudents}
                onChanged={load}
              />
            )) : <p className="wn-dashboard-surface text-center">لا توجد حلقات مطابقة. ابدأ بتسكين طالب مدفوع أو أنشئ مجموعة جديدة من الزر أعلاه.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {!filteredSubscriptions.length ? <p className="wn-dashboard-surface text-center">لا توجد طلبات مدفوعة بانتظار التسكين. لو الإيصال ما زال قيد المراجعة، اعتمد الدفع أولًا من صفحة المدفوعات.</p> : filteredSubscriptions.map(item => {
              const form = formFor(item);
              return (
                <article key={item._id} className="wn-dashboard-surface grid md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">{item.student?.name || 'طالب'}</h3>
                    <p className="text-sm text-slate-600">{item.student?.email}</p>
                    <p>الخطة: <strong>{planName(item)}</strong> · {(item.pricePerSessionMinor || 0) / 100} جنيه للحصة</p>
                    <p>المعلم المختار: <strong>{teacherName(item)}</strong></p>
                    <p>القسم: {item.section === 'ladies' ? 'قسم السيدات' : 'قسم الرجال والأطفال'} · العمر: {item.student?.age || '—'}</p>
                    <p>الرصيد: <strong>{item.sessionsRemaining}/{item.sessionCount} حصة</strong></p>
                    <span className="inline-block bg-emerald-50 text-emerald-800 rounded-lg p-2 text-sm">مدفوع — بانتظار التسكين</span>
                  </div>
                  <div className="border rounded-xl p-4 space-y-3">
                    <label className="block text-sm">
                      طريقة التسكين
                      <select
                        className="block w-full border rounded-lg p-2 mt-1"
                        value={form.mode}
                        onChange={event => {
                          const nextMode = event.target.value;
                          const nextCircleId = nextMode === 'existing'
                            ? (item.compatibleCircles?.[0]?._id || '')
                            : nextMode === 'flexible'
                              ? (item.flexibleCircles?.[0]?._id || '')
                              : '';
                          updateForm(item, { mode: nextMode, existingCircleId: nextCircleId });
                        }}
                      >
                        <option value="existing" disabled={!item.compatibleCircles?.length}>جروب موجود ومتوافق</option>
                        {item.flexibleCircles?.length ? (
                          <option value="flexible">جروب موجود (تسكين مرن بأي مجموعة متاحة)</option>
                        ) : null}
                        <option value="new">جروب جديد</option>
                      </select>
                    </label>

                    {form.mode === 'existing' ? (
                      <label className="block text-sm">
                        الحلقة
                        <select className="block w-full border rounded-lg p-2 mt-1" value={form.existingCircleId} onChange={event => updateForm(item, { existingCircleId: event.target.value })}>
                          {item.compatibleCircles?.map(circle => <option key={circle._id} value={circle._id}>{circle.name} · {circle.currentCount}/{circle.capacity} · {['active', 'full'].includes(circle.status) ? 'جارية' : 'قيد التكوين'}</option>)}
                        </select>
                      </label>
                    ) : form.mode === 'flexible' ? (
                      <label className="block text-sm">
                        اختر المجموعة المتاحة (تسكين مرن)
                        <select className="block w-full border rounded-lg p-2 mt-1" value={form.existingCircleId} onChange={event => updateForm(item, { existingCircleId: event.target.value })}>
                          {item.flexibleCircles?.map(circle => <option key={circle._id} value={circle._id}>{circle.name} · {circle.currentCount}/{circle.capacity} · {['active', 'full'].includes(circle.status) ? 'جارية' : 'قيد التكوين'}</option>)}
                        </select>
                      </label>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-sm">
                          اسم الجروب الجديد
                          <input className="block w-full border rounded-lg p-2 mt-1" maxLength={120} value={form.circleName} onChange={event => updateForm(item, { circleName: event.target.value })} />
                        </label>
                        {teachers.length > 0 ? (
                          <label className="block text-sm">
                            تعيين / تغيير معلم المجموعة
                            <select className="block w-full border rounded-lg p-2 mt-1" value={form.teacherId || item.preferredTeacher?._id || ''} onChange={event => updateForm(item, { teacherId: event.target.value })}>
                              {!item.preferredTeacher?._id ? <option value="">اختر المعلم...</option> : null}
                              {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.setScheduleNow)}
                          onChange={e => updateForm(item, { setScheduleNow: e.target.checked })}
                          className="w-4 h-4 accent-emerald-700"
                        />
                        <span>تحديد موعد المجموعة أو تشغيلها الآن (حتى قبل اكتمال العدد)</span>
                      </label>
                      {form.setScheduleNow ? (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <label className="space-y-1 font-semibold">
                              <span>اليوم</span>
                              <select value={form.day || 'Saturday'} onChange={e => updateForm(item, { day: e.target.value })} className="block w-full border rounded p-1.5 bg-white">
                                {DAYS.map(([day, label]) => <option key={day} value={day}>{label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-1 font-semibold">
                              <span>من</span>
                              <input type="time" value={form.startTime || '18:00'} onChange={e => updateForm(item, { startTime: e.target.value })} className="block w-full border rounded p-1.5 bg-white" />
                            </label>
                            <label className="space-y-1 font-semibold">
                              <span>إلى</span>
                              <input type="time" value={form.endTime || '19:00'} onChange={e => updateForm(item, { endTime: e.target.value })} className="block w-full border rounded p-1.5 bg-white" />
                            </label>
                          </div>
                          <label className="inline-flex items-center gap-2 font-bold text-emerald-900 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={Boolean(form.startImmediately)}
                              onChange={e => updateForm(item, { startImmediately: e.target.checked })}
                              className="w-4 h-4 accent-emerald-700"
                            />
                            <span>بدء وتشغيل الحلقة فوراً مع التسكين (قبل اكتمال العدد)</span>
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-600">التوافق القياسي حسب المعلم والخطة والقسم والعمر والمستوى، أو يمكنك التسكين المرن وتشغيل المجموعة في أي وقت حتى قبل اكتمال العدد.</p>
                    <button type="button" disabled={Boolean(working)} className="wn-btn wn-btn--primary wn-btn--block" onClick={() => place(item)}>{working === item._id ? 'جاري التسكين...' : 'تسكين الطالب'}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="text-xs text-slate-500">تُعرض أحدث 100 حلقة وأقدم 100 طلب تسكين في كل تحديث.</p>
      </div>
    </DashboardLayout>
  );
}

