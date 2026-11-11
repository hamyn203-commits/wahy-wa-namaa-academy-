import { useEffect, useState } from 'react';
import { Search, Users, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';

const INITIAL_STUDENT_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  age: 12,
  gender: 'male',
  currentLevel: 'beginner',
  preferredTrack: 'memorization',
  memorizedJuz: 0,
  createSubscription: false,
  planKey: 'group',
  sessionCount: 8,
  preferredTeacherId: '',
};

export default function AdminPeopleDirectory({ onOpenStudent, onOpenGuardian, selectedRole = 'all', approvedTeachers = [] }) {
  const toast = useToast();
  const [role, setRole] = useState(selectedRole);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState({ people: [], total: 0, pages: 1, counts: { student: null, guardian: null } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState(INITIAL_STUDENT_FORM);
  const [savingStudent, setSavingStudent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ role, status, page: String(page), limit: '15' });
    if (search) params.set('q', search);
    api.get('/api/admin/people/directory?' + params, { auth: true, signal: controller.signal })
      .then((result) => { if (current) setData(result); })
      .catch((err) => { if (current) setError(err.message || 'تعذر تحميل دليل الطلاب والأسر'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [role, status, page, search, refresh]);

  useEffect(() => { setRole(selectedRole); setPage(1); }, [selectedRole]);

  const selectRole = (next) => { setRole(next); setPage(1); };
  const selectStatus = (next) => { setStatus(next); setPage(1); };
  const submit = (event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); };
  const open = (person) => person.role === 'student'
    ? onOpenStudent?.(person._id)
    : onOpenGuardian?.(person._id);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setSavingStudent(true);
    try {
      await api.post('/api/admin/people/students', {
        ...studentForm,
        age: Number(studentForm.age) || 12,
        memorizedJuz: Number(studentForm.memorizedJuz) || 0,
        sessionCount: Number(studentForm.sessionCount) || 8,
        preferredTeacherId: studentForm.preferredTeacherId || null,
      }, { auth: true });
      toast.success(studentForm.createSubscription ? 'تم إنشاء حساب الطالب واشتراكه وإرساله لطابور التسكين' : 'تم إنشاء حساب الطالب بنجاح');
      setStudentForm(INITIAL_STUDENT_FORM);
      setShowAddStudent(false);
      setRefresh((x) => x + 1);
    } catch (err) {
      toast.error(err.message || 'فشل إنشاء حساب الطالب');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/admin/people/students/${deleteTarget._id}`, { auth: true });
      toast.success('تم حذف حساب الطالب بنجاح');
      setDeleteTarget(null);
      setRefresh((x) => x + 1);
    } catch (err) {
      toast.error(err.message || 'تعذر حذف حساب الطالب');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7 space-y-5" dir="rtl" aria-label="دليل الطلاب والأسر">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">دليل الطلاب والأسر</h2>
          <p className="text-sm text-slate-500 mt-1">عرض وإضافة الحسابات المسجلة وفتح ملفاتها الإدارية الآمنة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddStudent((v) => !v)}
            className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 flex items-center gap-1.5 text-sm font-bold"
          >
            <Plus size={16} /> {showAddStudent ? 'إغلاق نموذج الإضافة' : 'إضافة طالب جديد'}
          </button>
          <button type="button" onClick={() => setRefresh((x) => x + 1)} className="rounded-xl border px-3 py-2 flex items-center gap-2 text-sm" aria-label="تحديث القائمة"><RefreshCw size={16} /> تحديث</button>
        </div>
      </div>

      {showAddStudent ? (
        <form onSubmit={handleCreateStudent} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-emerald-950">إضافة حساب طالب جديد من الإدارة</h3>
            <span className="text-xs text-emerald-800">يتم تفعيل الحساب فوراً دون الحاجة لتأكيد البريد</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label className="space-y-1 font-bold text-slate-700">
              <span>اسم الطالب *</span>
              <input required type="text" placeholder="الاسم الثلاثي" value={studentForm.name} onChange={(e) => setStudentForm((p) => ({ ...p, name: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>البريد الإلكتروني *</span>
              <input required type="email" placeholder="student@example.com" value={studentForm.email} onChange={(e) => setStudentForm((p) => ({ ...p, email: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>كلمة المرور *</span>
              <input required type="password" minLength={8} placeholder="8 أحرف على الأقل" value={studentForm.password} onChange={(e) => setStudentForm((p) => ({ ...p, password: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>رقم الهاتف / واتساب</span>
              <input type="text" placeholder="+2010..." value={studentForm.phone} onChange={(e) => setStudentForm((p) => ({ ...p, phone: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>العمر</span>
              <input type="number" min={4} max={100} value={studentForm.age} onChange={(e) => setStudentForm((p) => ({ ...p, age: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>الجنس</span>
              <select value={studentForm.gender} onChange={(e) => setStudentForm((p) => ({ ...p, gender: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>المستوى</span>
              <select value={studentForm.currentLevel} onChange={(e) => setStudentForm((p) => ({ ...p, currentLevel: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="beginner">مبتدئ</option>
                <option value="intermediate">متوسط</option>
                <option value="advanced">متقدم</option>
                <option value="ijazah">مجاز / خاتم</option>
              </select>
            </label>
            <label className="space-y-1 font-bold text-slate-700">
              <span>المسار المفضل</span>
              <select value={studentForm.preferredTrack} onChange={(e) => setStudentForm((p) => ({ ...p, preferredTrack: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="memorization">الحفظ والمراجعة</option>
                <option value="tajweed_ijazah">التجويد والإجازة</option>
                <option value="kids_foundation">تأسيس الأطفال</option>
              </select>
            </label>
          </div>

          <div className="pt-2 border-t border-emerald-200/70 space-y-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
              <input
                type="checkbox"
                checked={studentForm.createSubscription}
                onChange={(e) => setStudentForm((p) => ({ ...p, createSubscription: e.target.checked }))}
                className="w-4 h-4 accent-emerald-700"
              />
              <span>إنشاء اشتراك مفعل لهذا الطالب وإرساله لطابور التسكين فوراً</span>
            </label>

            {studentForm.createSubscription ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1 font-bold text-slate-700">
                  <span>باقة الاشتراك</span>
                  <select value={studentForm.planKey} onChange={(e) => setStudentForm((p) => ({ ...p, planKey: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="community">حلقة اقتصادية (15-20 طالب)</option>
                    <option value="group">حلقة جماعية (6-8 طلاب)</option>
                    <option value="focused">حلقة مركزة (3-5 طلاب)</option>
                    <option value="mini">ثنائية / ثلاثية (2-3 طلاب)</option>
                    <option value="private">مكثفة فردية (طالب واحد)</option>
                  </select>
                </label>
                <label className="space-y-1 font-bold text-slate-700">
                  <span>عدد الحصص</span>
                  <select value={studentForm.sessionCount} onChange={(e) => setStudentForm((p) => ({ ...p, sessionCount: Number(e.target.value) }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value={4}>4 حصص</option>
                    <option value={8}>8 حصص</option>
                    <option value={12}>12 حصة</option>
                    <option value={24}>24 حصة</option>
                  </select>
                </label>
                <label className="space-y-1 font-bold text-slate-700">
                  <span>المعلم المفضل (اختياري)</span>
                  <select value={studentForm.preferredTeacherId} onChange={(e) => setStudentForm((p) => ({ ...p, preferredTeacherId: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">اختر المعلم لاحقاً عند التسكين</option>
                    {approvedTeachers.map((t) => (
                      <option key={t._id} value={t._id}>{t.personalInfo?.fullName || t.user?.name || 'معلم'}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddStudent(false)} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700">إلغاء</button>
            <button type="submit" disabled={savingStudent} className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold">
              {savingStudent ? 'جارٍ الإنشاء...' : 'حفظ وإنشاء حساب الطالب'}
            </button>
          </div>
        </form>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => selectRole('student')} className={`rounded-xl border p-4 text-right ${role === 'student' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
          <Users size={20} className="text-emerald-700 mb-2" /><strong className="block">الطلاب</strong><span className="text-xl font-bold">{loading && data.counts?.student == null ? '…' : (data.counts?.student ?? '—')}</span>
        </button>
        <button type="button" onClick={() => selectRole('guardian')} className={`rounded-xl border p-4 text-right ${role === 'guardian' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
          <ShieldCheck size={20} className="text-emerald-700 mb-2" /><strong className="block">أولياء الأمور</strong><span className="text-xl font-bold">{loading && data.counts?.guardian == null ? '…' : (data.counts?.guardian ?? '—')}</span>
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[190px] flex items-center gap-2 border rounded-xl px-3"><Search size={17} className="text-slate-500" /><input className="w-full py-3 outline-none bg-transparent" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="الاسم أو البريد أو رقم الحساب" aria-label="بحث عن طالب أو ولي أمر" /></div>
        <button type="submit" className="rounded-xl bg-emerald-800 text-white px-5">بحث</button>
        <select className="rounded-xl border px-3 py-2 bg-white" value={role} onChange={(e) => selectRole(e.target.value)} aria-label="نوع الحساب">
          <option value="all">الطلاب والأسر</option><option value="student">الطلاب فقط</option><option value="guardian">أولياء الأمور فقط</option>
        </select>
        <select className="rounded-xl border px-3 py-2 bg-white" value={status} onChange={(e) => selectStatus(e.target.value)} aria-label="حالة الحساب">
          <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option>
        </select>
      </form>
      {error ? <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4">{error}</p> : null}
      {loading ? <p className="p-6 text-center text-slate-500">جاري تحميل الحسابات...</p> : !error && data.people?.length === 0 ? <p className="p-6 text-center text-slate-500">لا توجد حسابات مطابقة للبحث.</p> : (
        <div className="space-y-2">
          {(data.people || []).map((person) => (
            <div key={person._id} className="w-full text-right flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-emerald-50/60 transition">
              <button type="button" onClick={() => open(person)} className="flex-1 min-w-[200px] text-right flex items-center gap-3">
                <span className="rounded-full bg-slate-100 p-3">{person.role === 'student' ? <Users size={20} /> : <ShieldCheck size={20} />}</span>
                <span>
                  <strong className="block text-slate-900">{person.name || 'بدون اسم'}</strong>
                  <small className="text-slate-500">{person.email || 'لا يوجد بريد'} · {person.role === 'student' ? 'طالب' : 'ولي أمر'}</small>
                </span>
              </button>
              <span className={`text-xs rounded-full px-3 py-1 ${person.isActive === false ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{person.isActive === false ? 'غير نشط' : 'نشط'}</span>
              <button type="button" onClick={() => open(person)} className="text-sm text-emerald-800 font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
                فتح ملف 360
              </button>
              {person.role === 'student' ? (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(person)}
                  className="text-xs text-rose-700 font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 inline-flex items-center gap-1"
                  title="حذف حساب الطالب"
                >
                  <Trash2 size={14} /> حذف
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">تأكيد حذف حساب الطالب</h3>
            <p className="text-sm text-slate-600">
              هل أنت متأكد من حذف حساب الطالب <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) نهائياً وإزالته من أي حلقات مسجل بها؟
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700">إلغاء</button>
              <button type="button" onClick={handleDeleteStudent} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">نعم، احذف الطالب</button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex justify-between items-center gap-3 text-sm text-slate-500">
        <span>إجمالي النتائج: {data.total ?? 0} · صفحة {page} من {data.pages || 1}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((n) => n - 1)} className="border rounded-lg p-2 disabled:opacity-40" aria-label="الصفحة السابقة"><ChevronRight size={18} /></button>
          <button type="button" disabled={page >= (data.pages || 1) || loading} onClick={() => setPage((n) => n + 1)} className="border rounded-lg p-2 disabled:opacity-40" aria-label="الصفحة التالية"><ChevronLeft size={18} /></button>
        </div>
      </div>
    </section>
  );
}
