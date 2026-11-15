import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useI18n } from '../../i18n';
import { dashboardPathForRole, isSafeInternalRedirect, postAuthDestination } from '../../lib/navigation';
import { useAuth } from '../../hooks/useAuth.jsx';

export default function ProfileSetup() {
  const { user, ready } = useRequireAuth(['student', 'guardian', 'teacher']);
  const { saveOnboarding } = useAuth();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const dashboardDestination = dashboardPathForRole(user?.role, locale);
  const destination = isSafeInternalRedirect(next)
    ? postAuthDestination({ redirect: next, role: user?.role, locale })
    : dashboardDestination;
  const [data, setData] = useState({ name: '', phone: '', age: '', gender: '', whatsappPhone: '', preferredTrack: 'memorization', currentLevel: 'beginner', memorizedJuz: 0, memorizationDetails: '', bio: '', guardianContact: { name: '', phone: '', relationship: '' } });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (user) setData(prev => ({ ...prev, ...Object.fromEntries(Object.keys(prev).filter(k => user[k] !== undefined && user[k] !== null).map(k => [k, user[k]])) })); }, [user]);
  useEffect(() => {
    // A returning student with a completed profile should not be asked to fill it again.
    if (!ready || user?.role !== 'student' || !user?.onboarding?.completed ||
        !user?.name?.trim() || !user?.phone?.trim() || !isSafeInternalRedirect(next)) return;
    if (new URL(next, 'https://wahy.local').pathname.endsWith('/journey')) {
      navigate(next, { replace: true, state: { profileJustSaved: true } });
    }
  }, [ready, user, next, navigate]);
  if (!ready) return null;
  const demographicsLocked = Boolean(user?.role === 'student' && user?.onboarding?.completed && user?.age && user?.gender);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      if (user.role === 'student' && !demographicsLocked && (!data.age || !['male', 'female'].includes(data.gender))) {
        throw new Error('يرجى تحديد العمر والجنس لاستكمال الملف الشخصي.');
      }
      const payload = { name: data.name, phone: data.phone, whatsappPhone: data.whatsappPhone, bio: data.bio };
      if (user.role === 'student') {
        Object.assign(payload, {
          ...(demographicsLocked ? {} : { age: data.age ? Number(data.age) : undefined, gender: data.gender || undefined }),
          memorizedJuz: Number(data.memorizedJuz),
          preferredTrack: data.preferredTrack,
          currentLevel: data.currentLevel,
          memorizationDetails: data.memorizationDetails,
        });
      }
      if (user.role === 'student') payload.guardianContact = data.guardianContact;
      const saved = await saveOnboarding(payload);
      if (!saved.onboarding?.completed) throw new Error('لم تكتمل البيانات بعد، تحقق من الحقول المطلوبة');
      // The authenticated PATCH response is the server's confirmation of persistence.
      // A second GET can be served from an older edge/browser cache and cause an endless loop.
      navigate(destination, { replace: true, state: { profileJustSaved: true } });
    } catch (e) { setError(e.message || 'تعذر حفظ بياناتك، تأكد من رقم الهاتف وباقي الحقول.'); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setSaving(false); }
  };
  const field = (label, key, type = 'text') => <label className="block text-sm font-semibold">{label}<input className="input-field w-full mt-2" type={type} value={data[key] ?? ''} onChange={e => setData(p => ({...p, [key]: e.target.value}))} /></label>;
  return <main className="min-h-screen bg-slate-50 py-12 px-4" dir="rtl"><section className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
    <h1 className="text-2xl font-bold mb-2">استكمال الملف الشخصي</h1>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
    <p className="text-sm text-slate-600 mb-6">بياناتك محفوظة ويمكنك استكمالها لاحقًا. {user.role === 'teacher' ? 'لا يمكنك التدريس أو الظهور للطلاب قبل اعتماد الإدارة.' : ''}</p>
    <form className="space-y-4" onSubmit={save}>
      {field('الاسم الكامل', 'name')}<label className="block text-sm font-semibold">رقم الهاتف (مطلوب)<input className="input-field w-full mt-2" type="tel" autoComplete="tel" required value={data.phone || ''} onChange={event => setData(prev => ({ ...prev, phone: event.target.value }))}/><span className="block text-xs font-normal text-slate-500 mt-1">اكتب رقمًا صحيحًا، مثال: 01012345678</span></label>{field('واتساب (اختياري)', 'whatsappPhone', 'tel')}
      {user.role === 'student' && <><label className="block text-sm font-semibold">العمر<input className="input-field w-full mt-2" type="number" min="4" max="100" required={!demographicsLocked} disabled={demographicsLocked} value={data.age ?? ''} onChange={e => setData(p => ({ ...p, age: e.target.value }))} /></label><label className="block text-sm font-semibold">الجنس<select className="input-field w-full mt-2" required={!demographicsLocked} disabled={demographicsLocked} value={data.gender} onChange={e => setData(p => ({ ...p, gender: e.target.value }))}><option value="">اختر الجنس</option><option value="male">ذكر</option><option value="female">أنثى</option></select></label><label className="block text-sm font-semibold">مستواك الحالي (تقييم مبدئي)
          <select className="input-field w-full mt-2" value={data.currentLevel || 'beginner'} onChange={e => setData(p => ({ ...p, currentLevel: e.target.value }))}>
            <option value="beginner">مبتدئ</option>
            <option value="intermediate">متوسط</option>
            <option value="advanced">متقدم</option>
            <option value="ijazah">مستوى الإجازة</option>
          </select>
          <span className="block text-xs font-normal text-slate-500 mt-1">اختيارك مبدئي، والمعلم يحدد المستوى الفعلي أثناء الحصة التجريبية.</span>
        </label>{field('عدد الأجزاء المحفوظة (0–30)', 'memorizedJuz', 'number')}{field('تفاصيل الحفظ', 'memorizationDetails')}</>}

      {user.role === 'student' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
        <h2 className="font-bold text-emerald-950">بيانات ولي الأمر</h2>
        <p className="text-sm text-slate-600">مطلوبة لمن عمره أقل من 18 سنة، واختيارية للبالغين. لا يتم ربط الحسابات تلقائيًا.</p>
        {['name', 'phone'].map(key => <label key={key} className="block text-sm font-semibold">
          {key === 'name' ? 'اسم ولي الأمر' : 'هاتف ولي الأمر'}
          <input className="input-field w-full mt-2" value={data.guardianContact?.[key] || ''} type={key === 'phone' ? 'tel' : 'text'}
            required={Number(data.age) > 0 && Number(data.age) < 18}
            onChange={event => setData(prev => ({ ...prev, guardianContact: { ...prev.guardianContact, [key]: event.target.value } }))}/>
        </label>)}
        <label className="block text-sm font-semibold">صلة القرابة
          <select className="input-field w-full mt-2" value={data.guardianContact?.relationship || ''}
            required={Number(data.age) > 0 && Number(data.age) < 18}
            onChange={event => setData(prev => ({ ...prev, guardianContact: { ...prev.guardianContact, relationship: event.target.value } }))}>
            <option value="">اختر صلة القرابة</option><option value="father">الأب</option>
            <option value="mother">الأم</option><option value="guardian">ولي أمر</option><option value="other">أخرى</option>
          </select>
        </label>
      </div>}
      {field('نبذة مختصرة (اختياري)', 'bio')}

      <button disabled={saving || !data.name.trim()} className="w-full rounded-xl bg-emerald-800 text-white p-3 font-bold">{saving ? 'جاري الحفظ...' : 'حفظ والمتابعة'}</button>
      <button type="button" className="w-full text-slate-600 underline" onClick={() => navigate(dashboardDestination, { replace: true })}>استكمل لاحقًا</button>
    </form>
  </section></main>;
}
