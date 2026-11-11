import { useEffect, useMemo, useState } from 'react';
import TeacherAssetViewer from './TeacherAssetViewer';
import './TeacherReviewDossier.css';
import {
  AlertTriangle, CheckCircle2, Circle, FileText, GraduationCap, Headphones,
  IdCard, ShieldCheck, UserRound, Video, X, XCircle, Clock3, History, Eye, Trash2, Save,
} from 'lucide-react';

const SPECIALIZATION_OPTIONS = [
  { key: 'tajweed', label: 'التجويد وأحكام التلاوة' },
  { key: 'children', label: 'تحفيظ الأطفال' },
  { key: 'adults', label: 'تحفيظ الكبار' },
  { key: 'women', label: 'حلقات النساء' },
  { key: 'ijaza', label: 'الإجازة والسند' },
  { key: 'non-arabic', label: 'غير الناطقين بالعربية' },
  { key: 'arabic-language', label: 'اللغة العربية والقاعدة النورانية' },
];

const LANGUAGE_OPTIONS = [
  { key: 'arabic', label: 'العربية' },
  { key: 'english', label: 'الإنجليزية' },
  { key: 'french', label: 'الفرنسية' },
  { key: 'german', label: 'الألمانية' },
  { key: 'turkish', label: 'التركية' },
  { key: 'urdu', label: 'الأردية' },
  { key: 'indonesian', label: 'الإندونيسية' },
  { key: 'malay', label: 'الملايوية' },
];

const MEDIA_ITEMS = [
  { key: 'profilePhoto', label: 'الصورة الشخصية', icon: UserRound },
  { key: 'introductionVideo', label: 'فيديو التعريف', icon: Video },
  { key: 'recitationVideo', label: 'فيديو التلاوة', icon: Video },
  { key: 'teachingMethodVideo', label: 'فيديو طريقة التدريس', icon: Video },
];

const REVIEW_GROUPS = [
  { title: 'البيانات والمؤهلات', hint: 'التحقق من البيانات الشخصية والمؤهلات والخبرة', keys: ['personal-info', 'academic-info', 'quran-profile'] },
  { title: 'الصور والفيديوهات', hint: 'مراجعة صورة الملف والفيديوهات المطلوبة بالصوت والصورة', keys: ['profile-photo', 'introduction-video', 'recitation-video', 'teaching-method-video'] },
  { title: 'الهوية والشهادات', hint: 'فحص البطاقة والمستندات والإجازات إن وجدت', keys: ['id-card-front', 'id-card-back', 'graduation-certificate', 'tajweed-certificates', 'ijazat'] },
];

const REVIEW_GUIDES = {
  'personal-info': { hint: 'طابق الاسم والسن والهاتف والمدينة مع الهوية.', section: 'review-personal-info' },
  'academic-info': { hint: 'تحقق من الجامعة والكلية والمؤهل وسنة التخرج.', section: 'review-academic-info' },
  'quran-profile': { hint: 'تحقق من الحفظ والإجازات والخبرة والتخصصات.', section: 'review-academic-info' },
  'profile-photo': { hint: 'تأكد من وضوح الصورة ومناسبتها للملف.', category: 'media', kind: 'profilePhoto' },
  'introduction-video': { hint: 'استمع إلى تعريف المعلم وجودة الصوت والصورة.', category: 'media', kind: 'introductionVideo' },
  'recitation-video': { hint: 'راجع جودة التلاوة وسلامة الأداء.', category: 'media', kind: 'recitationVideo' },
  'teaching-method-video': { hint: 'راجع أسلوب الشرح وطريقة التدريس.', category: 'media', kind: 'teachingMethodVideo' },
  'id-card-front': { hint: 'طابق بيانات وجه البطاقة مع ملف المعلم.', category: 'document', kind: 'idCardFront' },
  'id-card-back': { hint: 'راجع ظهر بطاقة الهوية.', category: 'document', kind: 'idCardBack' },
  'graduation-certificate': { hint: 'راجع صحة شهادة التخرج إن كانت مطلوبة.', category: 'document', kind: 'graduationCertificate' },
  'tajweed-certificates': { hint: 'راجع الشهادات المرفوعة واحدةً واحدة.', category: 'document', kind: 'tajweedCertificates', index: 0 },
  ijazat: { hint: 'راجع الإجازات وأسماء المشايخ.', category: 'document', kind: 'ijazat', index: 0 },
};
const REVIEW_STATES = { pending: 'لم يراجع بعد', approved: 'تم الاعتماد', 'changes-requested': 'بانتظار تعديل المعلم', 'not-applicable': 'غير منطبق' };

function Value({ label, value }) {
  return (
    <div className="wn-admin-dossier__value">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? '—' : String(value)}</strong>
    </div>
  );
}

export default function TeacherReviewDossier({
  dossier,
  loading,
  onClose,
  onChecklist,
  onReview,
  onOpenDocument,
  onOpenMedia,
  onOpenProfileChangeMedia,
  onProfileChangeReview,
  onPreviewPublic,
  onUpdateAdminSettings,
  onDeleteTeacher,
}) {
  const teacher = dossier?.teacher;
  const gate = dossier?.gate;
  const profileChange = dossier?.profileChange;
  const approved = teacher?.status === 'approved' && teacher?.isVerified === true;
  const [selectedAsset, setSelectedAsset] = useState(null);
  const showAsset = (category, kind, label, index) => setSelectedAsset({ category, kind, label, index });
  const inspectItem = (item) => {
    const guide = REVIEW_GUIDES[item.key];
    if (!guide) return;
    if (guide.section) document.getElementById(guide.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else showAsset(guide.category, guide.kind, item.label, guide.index);
  };
  const canInspect = (item) => {
    if (!item.available) return false;
    if (item.key === 'graduation-certificate') return Boolean(teacher?.documents?.graduationCertificate);
    if (item.key === 'tajweed-certificates') return (teacher?.documents?.tajweedCertificatesCount || 0) > 0;
    if (item.key === 'ijazat') return (teacher?.documents?.ijazatCount || 0) > 0;
    return true;
  };

  const [promptModal, setPromptModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    whatsapp: '',
    telegram: '',
    age: 30,
    gender: 'male',
    country: '',
    city: '',
    address: '',
    bio: '',
    newPassword: '',
    university: '',
    faculty: '',
    graduationYear: 2015,
    specialization: '',
    qualification: '',
    memorizedParts: 30,
    teachingExperience: 5,
    numberOfIjazat: 0,
    ijazaType: '',
    sheikhName: '',
    sanad: '',
    specializations: ['tajweed'],
    languages: ['arabic'],
    hourlyRate: 50,
    status: 'pending',
    isVerified: false,
    isFeatured: false,
    isActive: true,
  });

  useEffect(() => {
    if (!teacher) return;
    setEditForm({
      fullName: teacher.personalInfo?.fullName || teacher.user?.name || '',
      email: teacher.user?.email || '',
      phone: teacher.personalInfo?.phone || teacher.user?.phone || '',
      whatsapp: teacher.personalInfo?.whatsapp || teacher.user?.whatsappPhone || '',
      telegram: teacher.personalInfo?.telegram || '',
      age: teacher.personalInfo?.age ?? 30,
      gender: teacher.personalInfo?.gender || 'male',
      country: teacher.personalInfo?.country || 'مصر',
      city: teacher.personalInfo?.city || 'القاهرة',
      address: teacher.personalInfo?.address || '',
      bio: teacher.user?.bio || '',
      newPassword: '',
      university: teacher.academicInfo?.university || '',
      faculty: teacher.academicInfo?.faculty || '',
      graduationYear: teacher.academicInfo?.graduationYear ?? 2015,
      specialization: teacher.academicInfo?.specialization || '',
      qualification: teacher.academicInfo?.qualification || '',
      memorizedParts: teacher.quranInfo?.memorizedParts ?? 30,
      teachingExperience: teacher.quranInfo?.teachingExperience ?? 0,
      numberOfIjazat: teacher.quranInfo?.numberOfIjazat ?? 0,
      ijazaType: teacher.quranInfo?.ijazaType || '',
      sheikhName: teacher.quranInfo?.sheikhName || '',
      sanad: teacher.quranInfo?.sanad || '',
      specializations: Array.isArray(teacher.quranInfo?.specializations) && teacher.quranInfo.specializations.length
        ? teacher.quranInfo.specializations
        : ['tajweed'],
      languages: Array.isArray(teacher.languages) && teacher.languages.length
        ? teacher.languages
        : ['arabic'],
      hourlyRate: teacher.hourlyRate ?? 50,
      status: teacher.status || 'pending',
      isVerified: Boolean(teacher.isVerified),
      isFeatured: Boolean(teacher.isFeatured),
      isActive: teacher.user?.isActive !== false,
    });
  }, [teacher]);

  const toggleArrayValue = (field, value) => {
    setEditForm((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const exists = current.includes(value);
      const next = exists ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [field]: next.length ? next : current };
    });
  };

  const saveAdminSettings = async () => {
    if (!onUpdateAdminSettings || !teacher?._id) return;
    setSavingSettings(true);
    try {
      await onUpdateAdminSettings(teacher._id, {
        ...editForm,
        name: editForm.fullName,
        age: Number(editForm.age) || 30,
        graduationYear: Number(editForm.graduationYear) || 2015,
        memorizedParts: Number(editForm.memorizedParts) || 0,
        teachingExperience: Number(editForm.teachingExperience) || 0,
        numberOfIjazat: Number(editForm.numberOfIjazat) || 0,
        hourlyRate: Number(editForm.hourlyRate) || 50,
        adminDirectOverride: true,
      });
      setEditForm((prev) => ({ ...prev, newPassword: '' }));
    } finally {
      setSavingSettings(false);
    }
  };

  const specializations = useMemo(
    () => (teacher?.quranInfo?.specializations || []).join('، '),
    [teacher?.quranInfo?.specializations]
  );

  if (!teacher && !loading) return null;

  const requestChanges = (item) => {
    setPromptModal({
      title: 'طلب تعديل في ملف المعلم',
      label: `المطلوب تعديله في: ${item.label}`,
      initialValue: item.note || '',
      confirmText: 'إرسال طلب التعديل',
      isDanger: false,
      onConfirm: (note) => {
        setPromptModal(null);
        if (!note.trim()) return;
        onChecklist(teacher._id, item.key, 'changes-requested', note.trim());
      },
    });
  };

  const finalDecision = (action) => {
    if (action === 'approve') {
      if (!gate?.approvalReady) return;
      onReview(teacher._id, 'approve', 'تم اعتماد الملف بعد اكتمال قائمة المراجعة.');
      return;
    }

    const isReject = action === 'reject';
    setPromptModal({
      title: isReject ? 'رفض طلب المعلم' : 'طلب استكمال الملف',
      label: isReject ? 'اكتب سبب رفض الطلب:' : 'اكتب المطلوب من المعلم استكماله:',
      initialValue: '',
      confirmText: isReject ? 'تأكيد الرفض' : 'إرسال الطلب',
      isDanger: isReject,
      onConfirm: (note) => {
        setPromptModal(null);
        if (!note.trim()) return;
        onReview(teacher._id, action, note.trim());
      },
    });
  };

  return (
    <div className="wn-admin-dossier-backdrop" dir="rtl" role="dialog" aria-modal="true">
      <div className="wn-admin-dossier">
        <header className="wn-admin-dossier__header">
          <div>
            <span>{approved ? 'Teacher 360 · Administration' : 'Teacher 360 Review Dossier'}</span>
            <h2>{teacher?.personalInfo?.fullName || teacher?.user?.name || 'ملف المعلم'}</h2>
            <p>{teacher?.user?.email || '—'} · {teacher?.personalInfo?.phone || '—'}</p>
          </div>
          <div className="wn-admin-dossier__header-actions">
            {approved ? <button type="button" onClick={() => onPreviewPublic?.(teacher._id)} className="wn-admin-teacher-public-link">معاينة الملف العام</button> : null}
            <button type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
          </div>
        </header>

        {loading ? (
          <div className="wn-admin-dossier__loading">جاري تحميل ملف المعلم الكامل...</div>
        ) : (
          <div className="wn-admin-dossier__body">
            {!approved ? <section className="wn-admin-review-gate">
              <div className="wn-admin-review-gate__summary">
                <div>
                  <span>جاهزية الاعتماد</span>
                  <strong>{gate?.readiness || 0}%</strong>
                  <small>{gate?.completedRequired || 0} من {gate?.requiredCount || 0} بند إلزامي</small>
                </div>
                <div className="wn-admin-review-gate__bar">
                  <i style={{ width: `${gate?.readiness || 0}%` }} />
                </div>
                <div className={`wn-admin-review-gate__state ${gate?.approvalReady ? 'is-ready' : 'is-blocked'}`}>
                  {gate?.approvalReady ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <span>{gate?.approvalReady ? 'الملف جاهز لقرار الاعتماد' : 'زر الاعتماد مقفول حتى اكتمال المراجعة'}</span>
                </div>
              </div>

              <p className="wn-admin-review-gate__intro">افتح تفاصيل كل بند أولًا، ثم اعتمده بعد التحقق منه. لو في مشكلة، اطلب تعديلًا واكتب للمعلم ما يجب إصلاحه.</p>
              {REVIEW_GROUPS.map((group) => {
                const items = (gate?.items || []).filter((item) => group.keys.includes(item.key));
                if (!items.length) return null;
                return (
                  <div className="wn-admin-review-group" key={group.title}>
                    <div className="wn-admin-review-group__heading">
                      <div><h3>{group.title}</h3><p>{group.hint}</p></div>
                      <span>{items.filter((item) => item.satisfied).length} من {items.length} مكتمل</span>
                    </div>
                    <div className="wn-admin-review-checklist">
                      {items.map((item) => (
                        <article key={item.key} className={`is-${item.status} ${!item.available ? 'is-missing' : ''}`}>
                          <div className="wn-admin-review-checklist__label">
                            {item.satisfied ? <CheckCircle2 size={20} /> : item.status === 'changes-requested' ? <XCircle size={20} /> : <Circle size={20} />}
                            <div>
                              <strong>{item.label}</strong>
                              <small>{item.requiredForTeacher ? 'إلزامي' : 'اختياري'} · {REVIEW_STATES[item.status] || 'قيد المراجعة'}</small>
                              <p className="wn-admin-review-checklist__hint">{REVIEW_GUIDES[item.key]?.hint}</p>
                              {!item.available ? <p className="wn-admin-review-checklist__missing-text">هذا البيان أو الملف غير متاح حتى الآن.</p> : null}
                              {item.note ? <p className="wn-admin-review-checklist__note">ملاحظة الإدارة: {item.note}</p> : null}
                            </div>
                          </div>
                          <div className="wn-admin-review-checklist__actions">
                            <button type="button" className="is-inspect" disabled={!canInspect(item)} onClick={() => inspectItem(item)}><Eye size={16} /> عرض التفاصيل</button>
                            <button type="button" className="is-approve" disabled={!item.available || item.status === 'approved'} onClick={() => onChecklist(teacher._id, item.key, 'approved', '')}>{item.status === 'approved' ? 'تم الاعتماد' : 'اعتماد البند'}</button>
                            <button type="button" className="is-change" onClick={() => requestChanges(item)}>طلب تعديل</button>
                            {item.canMarkNotApplicable ? <button type="button" disabled={item.status === 'not-applicable'} onClick={() => onChecklist(teacher._id, item.key, 'not-applicable', '')}>غير منطبق</button> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section> : null}

            {profileChange ? (
              <section className="wn-admin-dossier__section border-amber-200 bg-amber-50/40">
                <div className="wn-admin-dossier__section-title">
                  <History size={18} />
                  <h3>طلب تعديل الملف العام</h3>
                </div>

                <div className="mb-4 rounded-xl border border-amber-200 bg-white p-3">
                  <strong className="block text-amber-950">
                    {profileChange.status === 'pending' ? 'قيد المراجعة' : profileChange.status === 'approved' ? 'تم اعتماده' : 'تم رفضه'}
                  </strong>
                  <small className="text-slate-500">
                    {profileChange.createdAt ? new Date(profileChange.createdAt).toLocaleString('ar-EG') : ''}
                    {' · '}{(profileChange.changedFields || []).length} حقل/وسيط
                  </small>
                  {profileChange.adminNote ? <p className="mt-2 text-sm">ملاحظة الإدارة: {profileChange.adminNote}</p> : null}
                </div>

                <div className="wn-admin-dossier__grid">
                  <Value label="الاسم المقترح" value={profileChange.proposed?.personalInfo?.fullName} />
                  <Value label="المدينة المقترحة" value={profileChange.proposed?.personalInfo?.city} />
                  <Value label="الجامعة المقترحة" value={profileChange.proposed?.academicInfo?.university} />
                  <Value label="الكلية المقترحة" value={profileChange.proposed?.academicInfo?.faculty} />
                  <Value label="المؤهل المقترح" value={profileChange.proposed?.academicInfo?.qualification} />
                  <Value label="سنوات الخبرة المقترحة" value={profileChange.proposed?.quranInfo?.teachingExperience} />
                  <Value label="عدد الإجازات المقترح" value={profileChange.proposed?.quranInfo?.numberOfIjazat} />
                  <Value label="النبذة المقترحة" value={profileChange.proposed?.user?.bio} />
                </div>

                <div className="wn-admin-dossier__asset-grid mt-4">
                  {MEDIA_ITEMS.filter(({ key }) => profileChange.proposed?.media?.[key]).map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => showAsset('profile-change', key, `${label} المقترحة`)}>
                      <Icon size={18} />
                      <span><strong>{label} المقترحة</strong><small>فتح للمراجعة</small></span>
                    </button>
                  ))}
                </div>

                {profileChange.status === 'pending' ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="wn-btn wn-btn--primary"
                      onClick={() => {
                        setConfirmModal({
                          title: 'اعتماد ونشر التعديلات',
                          message: 'هل راجعت كل التعديلات والوسائط وتريد نشرها الآن في الملف العام للمعلم؟',
                          confirmText: 'نعم، انشر الآن',
                          onConfirm: () => {
                            setConfirmModal(null);
                            onProfileChangeReview?.(teacher._id, 'approve', 'تمت مراجعة التعديلات واعتمادها للنشر.');
                          },
                        });
                      }}
                    >
                      <CheckCircle2 size={16} /> اعتماد ونشر التعديلات
                    </button>
                    <button
                      type="button"
                      className="wn-btn wn-btn--secondary"
                      onClick={() => {
                        setPromptModal({
                          title: 'رفض تعديل ملف المعلم',
                          label: 'اكتب سبب رفض التعديل أو المطلوب من المعلم:',
                          initialValue: '',
                          confirmText: 'تأكيد الرفض',
                          isDanger: true,
                          onConfirm: (note) => {
                            setPromptModal(null);
                            if (!note.trim()) return;
                            onProfileChangeReview?.(teacher._id, 'reject', note.trim());
                          },
                        });
                      }}
                    >
                      <XCircle size={16} /> رفض وإعادة للمعلم
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section id="review-personal-info" className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><UserRound size={18} /><h3>البيانات الشخصية</h3></div>
              <div className="wn-admin-dossier__grid">
                <Value label="الاسم" value={teacher.personalInfo?.fullName} />
                <Value label="العمر" value={teacher.personalInfo?.age} />
                <Value label="النوع" value={teacher.personalInfo?.gender} />
                <Value label="الدولة" value={teacher.personalInfo?.country} />
                <Value label="المدينة" value={teacher.personalInfo?.city} />
                <Value label="العنوان" value={teacher.personalInfo?.address} />
                <Value label="الهاتف" value={teacher.personalInfo?.phone} />
                <Value label="WhatsApp" value={teacher.personalInfo?.whatsapp} />
                <Value label="Telegram" value={teacher.personalInfo?.telegram} />
              </div>
            </section>

            <section id="review-academic-info" className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><GraduationCap size={18} /><h3>الدراسة والخبرة</h3></div>
              <div className="wn-admin-dossier__grid">
                <Value label="الجامعة" value={teacher.academicInfo?.university} />
                <Value label="الكلية" value={teacher.academicInfo?.faculty} />
                <Value label="سنة التخرج" value={teacher.academicInfo?.graduationYear} />
                <Value label="التخصص" value={teacher.academicInfo?.specialization} />
                <Value label="المؤهل" value={teacher.academicInfo?.qualification} />
                <Value label="سنوات التدريس" value={teacher.quranInfo?.teachingExperience} />
                <Value label="الأجزاء المحفوظة" value={teacher.quranInfo?.memorizedParts} />
                <Value label="عدد الإجازات" value={teacher.quranInfo?.numberOfIjazat} />
                <Value label="نوع الإجازة" value={teacher.quranInfo?.ijazaType} />
                <Value label="اسم الشيخ" value={teacher.quranInfo?.sheikhName} />
                <Value label="السند" value={teacher.quranInfo?.sanad} />
                <Value label="التخصصات" value={specializations} />
                <Value label="اللغات" value={(teacher.languages || []).join('، ')} />
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Video size={18} /><h3>الصور والفيديوهات والتسجيلات</h3></div>
              <div className="wn-admin-dossier__asset-grid">
                {MEDIA_ITEMS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!teacher.media?.[key]}
                    onClick={() => showAsset('media', key, label)}
                  >
                    <Icon size={18} />
                    <span><strong>{label}</strong><small>{teacher.media?.[key] ? 'فتح للمراجعة' : 'غير متاح'}</small></span>
                  </button>
                ))}
                {Array.from({ length: teacher.media?.additionalVideosCount || 0 }).map((_, index) => (
                  <button key={`video-${index}`} type="button" onClick={() => showAsset('media', 'additionalVideos', `فيديو إضافي ${index + 1}`, index)}>
                    <Video size={18} />
                    <span><strong>فيديو إضافي {index + 1}</strong><small>فتح للمراجعة</small></span>
                  </button>
                ))}
                {Array.from({ length: teacher.media?.audioRecordingsCount || 0 }).map((_, index) => (
                  <button key={`audio-${index}`} type="button" onClick={() => showAsset('media', 'audioRecordings', `تسجيل صوتي ${index + 1}`, index)}>
                    <Headphones size={18} />
                    <span><strong>تسجيل صوتي {index + 1}</strong><small>فتح للمراجعة</small></span>
                  </button>
                ))}
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><IdCard size={18} /><h3>المستندات الحساسة</h3></div>
              <p className="wn-admin-dossier__privacy">
                <ShieldCheck size={15} />
                كل فتح لمستند أو ملف حساس يتم تسجيله في سجل الإدارة.
              </p>
              <div className="wn-admin-dossier__asset-grid">
                <button type="button" disabled={!teacher.documents?.idCardFront} onClick={() => showAsset('document', 'idCardFront', 'وجه البطاقة')}>
                  <IdCard size={18} /><span><strong>وجه البطاقة</strong><small>{teacher.documents?.idCardFront ? 'فتح' : 'غير متاح'}</small></span>
                </button>
                <button type="button" disabled={!teacher.documents?.idCardBack} onClick={() => showAsset('document', 'idCardBack', 'ظهر البطاقة')}>
                  <IdCard size={18} /><span><strong>ظهر البطاقة</strong><small>{teacher.documents?.idCardBack ? 'فتح' : 'غير متاح'}</small></span>
                </button>
                <button type="button" disabled={!teacher.documents?.graduationCertificate} onClick={() => showAsset('document', 'graduationCertificate', 'شهادة التخرج')}>
                  <FileText size={18} /><span><strong>شهادة التخرج</strong><small>{teacher.documents?.graduationCertificate ? 'فتح' : 'غير متاح'}</small></span>
                </button>
                {Array.from({ length: teacher.documents?.tajweedCertificatesCount || 0 }).map((_, index) => (
                  <button key={`tajweed-${index}`} type="button" onClick={() => showAsset('document', 'tajweedCertificates', `شهادة تجويد ${index + 1}`, index)}>
                    <FileText size={18} /><span><strong>شهادة تجويد {index + 1}</strong><small>فتح</small></span>
                  </button>
                ))}
                {Array.from({ length: teacher.documents?.ijazatCount || 0 }).map((_, index) => (
                  <button key={`ijaza-${index}`} type="button" onClick={() => showAsset('document', 'ijazat', `إجازة ${index + 1}`, index)}>
                    <FileText size={18} /><span><strong>إجازة {index + 1}</strong><small>فتح</small></span>
                  </button>
                ))}
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Clock3 size={18} /><h3>النشاط داخل الأكاديمية</h3></div>
              <div className="wn-admin-dossier__grid">
                <Value label="إجمالي الحصص" value={dossier.activity?.totalSessions || 0} />
                <Value label="حصص مكتملة" value={dossier.activity?.completedSessions || 0} />
                <Value label="حصص مؤكدة" value={dossier.activity?.acceptedSessions || 0} />
                <Value label="طلاب مختلفون" value={dossier.activity?.distinctStudents || 0} />
                <Value label="متوسط التقييم" value={teacher.rating?.average || 0} />
                <Value label="عدد التقييمات" value={teacher.rating?.count || 0} />
              </div>
              {onUpdateAdminSettings ? (
                <div className="mt-5 pt-5 border-t border-slate-200 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">تعديل شامل لملف المعلم وإعدادات الحساب</h4>
                      <p className="text-xs text-slate-500">يمكنك تعديل أي تفصيلة في حساب المعلم (البيانات الشخصية، المؤهل، الإجازات، حالة الحساب، أو كلمة المرور).</p>
                    </div>
                    {onDeleteTeacher ? (
                      <button
                        type="button"
                        onClick={() => onDeleteTeacher(teacher._id, teacher.personalInfo?.fullName || teacher.user?.name || 'المعلم')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                      >
                        <Trash2 size={14} /> حذف حساب المعلم
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>الاسم الكامل</span>
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>البريد الإلكتروني</span>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>رقم الهاتف</span>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>واتساب</span>
                      <input
                        type="text"
                        value={editForm.whatsapp}
                        onChange={(e) => setEditForm((p) => ({ ...p, whatsapp: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>تيليجرام</span>
                      <input
                        type="text"
                        value={editForm.telegram}
                        onChange={(e) => setEditForm((p) => ({ ...p, telegram: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>السن</span>
                      <input
                        type="number"
                        min="18"
                        max="80"
                        value={editForm.age}
                        onChange={(e) => setEditForm((p) => ({ ...p, age: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>القسم / النوع</span>
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="male">ذكر (معلم)</option>
                        <option value="female">أنثى (معلمة)</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>تعيين كلمة مرور جديدة (اختياري)</span>
                      <input
                        type="password"
                        placeholder="اتركه فارغاً لعدم التغيير"
                        value={editForm.newPassword}
                        onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>الدولة</span>
                      <input
                        type="text"
                        value={editForm.country}
                        onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>المدينة</span>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>العنوان التفصيلي</span>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>الجامعة</span>
                      <input
                        type="text"
                        value={editForm.university}
                        onChange={(e) => setEditForm((p) => ({ ...p, university: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>الكلية</span>
                      <input
                        type="text"
                        value={editForm.faculty}
                        onChange={(e) => setEditForm((p) => ({ ...p, faculty: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>سنة التخرج</span>
                      <input
                        type="number"
                        min="1970"
                        max="2030"
                        value={editForm.graduationYear}
                        onChange={(e) => setEditForm((p) => ({ ...p, graduationYear: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>التخصص الأكاديمي</span>
                      <input
                        type="text"
                        value={editForm.specialization}
                        onChange={(e) => setEditForm((p) => ({ ...p, specialization: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>المؤهل العلمي</span>
                      <input
                        type="text"
                        value={editForm.qualification}
                        onChange={(e) => setEditForm((p) => ({ ...p, qualification: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>الأجزاء المحفوظة (0-30)</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={editForm.memorizedParts}
                        onChange={(e) => setEditForm((p) => ({ ...p, memorizedParts: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>سنوات الخبرة</span>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={editForm.teachingExperience}
                        onChange={(e) => setEditForm((p) => ({ ...p, teachingExperience: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>عدد الإجازات</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={editForm.numberOfIjazat}
                        onChange={(e) => setEditForm((p) => ({ ...p, numberOfIjazat: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>نوع الإجازة / القراءة</span>
                      <input
                        type="text"
                        value={editForm.ijazaType}
                        onChange={(e) => setEditForm((p) => ({ ...p, ijazaType: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>الشيخ المجيز</span>
                      <input
                        type="text"
                        value={editForm.sheikhName}
                        onChange={(e) => setEditForm((p) => ({ ...p, sheikhName: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>السند القرآني</span>
                      <textarea
                        rows={2}
                        value={editForm.sanad}
                        onChange={(e) => setEditForm((p) => ({ ...p, sanad: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>النبذة التعريفية للمعلم</span>
                      <textarea
                        rows={2}
                        value={editForm.bio}
                        onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-slate-700">التخصصات التعليمية</span>
                      <div className="flex flex-wrap gap-2">
                        {SPECIALIZATION_OPTIONS.map((opt) => {
                          const active = (editForm.specializations || []).includes(opt.key);
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleArrayValue('specializations', opt.key)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                                active ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="block text-xs font-bold text-slate-700">لغات التدريس</span>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map((opt) => {
                          const active = (editForm.languages || []).includes(opt.key);
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleArrayValue('languages', opt.key)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                                active ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>أجر الساعة (ج.م/ساعة)</span>
                      <input
                        type="number"
                        min="10"
                        max="2000"
                        value={editForm.hourlyRate}
                        onChange={(e) => setEditForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700 space-y-1">
                      <span>حالة اعتماد المعلم</span>
                      <select
                        value={editForm.status}
                        onChange={(e) => {
                          const nextStatus = e.target.value;
                          setEditForm((p) => ({
                            ...p,
                            status: nextStatus,
                            isVerified: nextStatus === 'approved',
                          }));
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="approved">معتمد ومنشور (Approved)</option>
                        <option value="pending">بانتظار المراجعة (Pending)</option>
                        <option value="under-review">قيد المراجعة (Under Review)</option>
                        <option value="suspended">موقوف مؤقتاً (Suspended)</option>
                        <option value="rejected">مرفوض (Rejected)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.isFeatured}
                        onChange={(e) => setEditForm((p) => ({ ...p, isFeatured: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-700"
                      />
                      <span>معلم مميز بالصفحة الرئيسية</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-700"
                      />
                      <span>حساب المعلم نشط للدخول</span>
                    </label>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={saveAdminSettings}
                      className="wn-btn wn-btn--primary text-xs py-2.5 inline-flex items-center justify-center gap-1.5"
                    >
                      <Save size={14} />
                      {savingSettings ? 'جارٍ الحفظ...' : 'حفظ كافة تعديلات المعلم'}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="hidden">
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><History size={18} /><h3>تاريخ المراجعة والقرارات</h3></div>
              {(dossier.audit || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا يوجد سجل إداري بعد.</p>
              ) : (
                <div className="wn-admin-audit-list">
                  {(dossier.audit || []).map((entry) => (
                    <div key={entry._id}>
                      <span><strong>{entry.actor?.name || 'الإدارة'}</strong><small>{new Date(entry.createdAt).toLocaleString('ar-EG')}</small></span>
                      <span><strong>{entry.action}</strong>{entry.reason ? <small>{entry.reason}</small> : null}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {!approved ? <footer className="wn-admin-dossier__footer">
              <button type="button" onClick={() => finalDecision('reject')} className="is-reject">رفض الطلب</button>
              <button type="button" onClick={() => finalDecision('request-changes')} className="is-change">طلب استكمال</button>
              <button
                type="button"
                onClick={() => finalDecision('approve')}
                disabled={!gate?.approvalReady}
                className="is-approve"
              >
                <CheckCircle2 size={17} />
                اعتماد المعلم نهائيًا
              </button>
            </footer> : null}
          </div>
        )}
      </div>
      {selectedAsset && (
        <TeacherAssetViewer
          teacherId={teacher._id}
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          loader={selectedAsset.category === 'document' ? onOpenDocument : selectedAsset.category === 'profile-change' ? onOpenProfileChangeMedia : onOpenMedia}
        />
      )}

      {promptModal && (
        <DossierPromptModal
          title={promptModal.title}
          label={promptModal.label}
          initialValue={promptModal.initialValue}
          confirmText={promptModal.confirmText}
          isDanger={promptModal.isDanger}
          onClose={() => setPromptModal(null)}
          onConfirm={promptModal.onConfirm}
        />
      )}

      {confirmModal && (
        <DossierConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
        />
      )}
    </div>
  );
}

function DossierPromptModal({ title, label, initialValue, confirmText, isDanger, onClose, onConfirm }) {
  const [val, setVal] = useState(initialValue || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">{label}</label>
          <textarea
            autoFocus
            rows={4}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="اكتب الملاحظة هنا..."
          />
        </div>
        <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition">
            إلغاء
          </button>
          <button
            type="button"
            disabled={!val.trim()}
            onClick={() => onConfirm(val.trim())}
            className={`px-4 py-2 text-sm text-white font-medium rounded-lg transition disabled:opacity-50 ${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {confirmText || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DossierConfirmModal({ title, message, confirmText, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 text-sm text-slate-600">
          <p>{message}</p>
        </div>
        <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition">
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white font-medium rounded-lg transition bg-emerald-600 hover:bg-emerald-700"
          >
            {confirmText || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
}
