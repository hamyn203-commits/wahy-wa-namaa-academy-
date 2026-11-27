import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Circle, FileText, GraduationCap, Headphones,
  IdCard, Loader2, ShieldCheck, UserRound, Video, X, XCircle, Clock3, History, Eye, Trash2, Save,
  Upload, Users, Wallet, Edit3, CheckCheck, PauseCircle,
} from 'lucide-react';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { resolveIntlLocale } from '../../lib/locale';
import { formatMsg, useFocusTrapDialog } from './adminFormat';
import TeacherAssetViewer from './TeacherAssetViewer';
import './TeacherReviewDossier.css';

const SPECIALIZATION_KEYS = [
  { key: 'tajweed', tKey: 'tajweed' },
  { key: 'children', tKey: 'children' },
  { key: 'adults', tKey: 'adults' },
  { key: 'women', tKey: 'women' },
  { key: 'ijaza', tKey: 'ijaza' },
  { key: 'non-arabic', tKey: 'nonArabic' },
  { key: 'arabic-language', tKey: 'arabicLanguage' },
];

const LANGUAGE_KEYS = [
  'arabic',
  'english',
  'french',
  'german',
  'turkish',
  'urdu',
  'indonesian',
  'malay',
  'kurdish',
];

const MEDIA_KEYS = [
  { key: 'profilePhoto', icon: UserRound, accept: 'image/jpeg,image/png,image/webp' },
  { key: 'introductionVideo', icon: Video, accept: 'video/mp4,video/webm,video/quicktime' },
  { key: 'recitationVideo', icon: Video, accept: 'video/mp4,video/webm,video/quicktime' },
  { key: 'teachingMethodVideo', icon: Video, accept: 'video/mp4,video/webm,video/quicktime' },
];

const DOC_UPLOAD_KEYS = [
  { key: 'idCardFront', tKey: 'idCardFront' },
  { key: 'idCardBack', tKey: 'idCardBack' },
  { key: 'graduationCertificate', tKey: 'graduationCertificate' },
];

const REVIEW_GROUPS = [
  { id: 'personal', titleKey: 'personalTitle', hintKey: 'personalHint', keys: ['personal-info', 'academic-info', 'quran-profile'] },
  { id: 'media', titleKey: 'mediaTitle', hintKey: 'mediaHint', keys: ['profile-photo', 'introduction-video', 'recitation-video', 'teaching-method-video'] },
  { id: 'docs', titleKey: 'docsTitle', hintKey: 'docsHint', keys: ['id-card-front', 'id-card-back', 'graduation-certificate', 'tajweed-certificates', 'ijazat'] },
];

const REVIEW_GUIDES = {
  'personal-info': { guideKey: 'personalInfo', section: 'review-personal-info' },
  'academic-info': { guideKey: 'academicInfo', section: 'review-academic-info' },
  'quran-profile': { guideKey: 'quranProfile', section: 'review-academic-info' },
  'profile-photo': { guideKey: 'profilePhoto', category: 'media', kind: 'profilePhoto' },
  'introduction-video': { guideKey: 'introductionVideo', category: 'media', kind: 'introductionVideo' },
  'recitation-video': { guideKey: 'recitationVideo', category: 'media', kind: 'recitationVideo' },
  'teaching-method-video': { guideKey: 'teachingMethodVideo', category: 'media', kind: 'teachingMethodVideo' },
  'id-card-front': { guideKey: 'idCardFront', category: 'document', kind: 'idCardFront' },
  'id-card-back': { guideKey: 'idCardBack', category: 'document', kind: 'idCardBack' },
  'graduation-certificate': { guideKey: 'graduationCertificate', category: 'document', kind: 'graduationCertificate' },
  'tajweed-certificates': { guideKey: 'tajweedCertificates', category: 'document', kind: 'tajweedCertificates', index: 0 },
  ijazat: { guideKey: 'ijazat', category: 'document', kind: 'ijazat', index: 0 },
};

function Value({ label, value, dash = '—' }) {
  return (
    <div className="wn-admin-dossier__value">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? dash : String(value)}</strong>
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
  onSafeSuspendTeacher,
  onRefreshDossier,
  onOpenStudent,
}) {
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();
  const t360 = t.adminPortal.dossiers.teacher360;
  const ef = t360.editForm;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const titleId = useId();
  const dialogRef = useRef(null);

  const teacher = dossier?.teacher;
  const gate = dossier?.gate;
  const profileChange = dossier?.profileChange;
  const approved = teacher?.status === 'approved' && teacher?.isVerified === true;

  const [activeTab, setActiveTab] = useState('all');
  const [showSettingsEditor, setShowSettingsEditor] = useState(false);
  const [uploadingAssetKey, setUploadingAssetKey] = useState('');
  const [purgingAssets, setPurgingAssets] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [promptModal, setPromptModal] = useState(null);
  const [promptValue, setPromptValue] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
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
    isPublic: true,
    isActive: true,
  });

  useFocusTrapDialog(
    Boolean((teacher || loading) && !selectedAsset && !promptModal && !confirmModal),
    onClose,
    dialogRef
  );

  useEffect(() => {
    setActiveTab('all');
    setShowSettingsEditor(false);
    if (!teacher) return;
    setEditForm({
      fullName: teacher.personalInfo?.fullName || teacher.user?.name || '',
      email: teacher.user?.email || '',
      phone: teacher.personalInfo?.phone || teacher.user?.phone || '',
      whatsapp: teacher.personalInfo?.whatsapp || teacher.user?.whatsappPhone || '',
      telegram: teacher.personalInfo?.telegram || '',
      age: teacher.personalInfo?.age ?? 30,
      gender: teacher.personalInfo?.gender || 'male',
      country: teacher.personalInfo?.country || '',
      city: teacher.personalInfo?.city || '',
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
      isPublic: teacher.isPublic !== false,
      isActive: teacher.user?.isActive !== false,
    });
  }, [teacher]);

  const specializations = useMemo(
    () => (teacher?.quranInfo?.specializations || []).join('، '),
    [teacher?.quranInfo?.specializations]
  );

  const specializationOptions = useMemo(
    () => SPECIALIZATION_KEYS.map((item) => ({ key: item.key, label: t360.specializations[item.tKey] || item.key })),
    [t360.specializations]
  );

  const LANGUAGE_OPTIONS = useMemo(
    () => LANGUAGE_KEYS.map((key) => ({ key, label: t360.languages[key] || key })),
    [t360.languages]
  );

  const mediaItems = useMemo(
    () => MEDIA_KEYS.map((item) => ({ ...item, label: t360.mediaItems[item.key] || item.key })),
    [t360.mediaItems]
  );

  const reviewStates = useMemo(() => ({
    pending: t360.states.pending,
    approved: t360.states.approved,
    'changes-requested': t360.states.changesRequested,
    'not-applicable': t360.states.notApplicable,
  }), [t360.states]);

  const bulkApprovableKeys = useMemo(
    () => (gate?.items || [])
      .filter((item) => item.available && item.status !== 'approved')
      .map((item) => item.key),
    [gate?.items]
  );

  const profileDiffRows = useMemo(() => {
    if (!profileChange) return [];
    const cur = profileChange.current || {
      personalInfo: teacher?.personalInfo,
      academicInfo: teacher?.academicInfo,
      quranInfo: teacher?.quranInfo,
      user: { bio: teacher?.user?.bio },
    };
    const prop = profileChange.proposed || {};
    const pairs = [
      { key: 'name', label: t360.profileChange.proposedName, before: cur.personalInfo?.fullName, after: prop.personalInfo?.fullName },
      { key: 'city', label: t360.profileChange.proposedCity, before: cur.personalInfo?.city, after: prop.personalInfo?.city },
      { key: 'university', label: t360.profileChange.proposedUniversity, before: cur.academicInfo?.university, after: prop.academicInfo?.university },
      { key: 'faculty', label: t360.profileChange.proposedFaculty, before: cur.academicInfo?.faculty, after: prop.academicInfo?.faculty },
      { key: 'qualification', label: t360.profileChange.proposedQualification, before: cur.academicInfo?.qualification, after: prop.academicInfo?.qualification },
      { key: 'experience', label: t360.profileChange.proposedExperience, before: cur.quranInfo?.teachingExperience, after: prop.quranInfo?.teachingExperience },
      { key: 'ijazat', label: t360.profileChange.proposedIjazat, before: cur.quranInfo?.numberOfIjazat, after: prop.quranInfo?.numberOfIjazat },
      { key: 'bio', label: t360.profileChange.proposedBio, before: cur.user?.bio, after: prop.user?.bio },
    ];
    return pairs.map((row) => ({
      ...row,
      changed: row.after !== undefined && row.after !== null && String(row.before ?? '') !== String(row.after ?? ''),
    }));
  }, [profileChange, teacher, t360.profileChange]);

  if (!teacher && !loading) return null;

  const showAsset = (category, kind, label, index) => setSelectedAsset({ category, kind, label, index });

  const inspectItem = (item) => {
    const guide = REVIEW_GUIDES[item.key];
    if (!guide) return;
    if (guide.section) {
      setActiveTab('all');
      window.setTimeout(() => {
        document.getElementById(guide.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else {
      showAsset(guide.category, guide.kind, item.label, guide.index);
    }
  };

  const canInspect = (item) => {
    if (!item.available) return false;
    if (item.key === 'graduation-certificate') return Boolean(teacher?.documents?.graduationCertificate);
    if (item.key === 'tajweed-certificates') return (teacher?.documents?.tajweedCertificatesCount || 0) > 0;
    if (item.key === 'ijazat') return (teacher?.documents?.ijazatCount || 0) > 0;
    return true;
  };

  const handleAdminUploadAsset = async (fieldKey, purpose, file) => {
    if (!file || !teacher?._id || uploadingAssetKey) return;
    setUploadingAssetKey(fieldKey);
    try {
      const uploaded = await uploadFileDirect(file, purpose);
      await api.put(
        `/api/teachers/admin/${teacher._id}/assets`,
        {
          uploadedFiles: { [fieldKey]: uploaded },
          reason: `رفع وتحديث ملف (${fieldKey}) مباشرة بواسطة الإدارة`,
        },
        { auth: true }
      );
      toast.success(isRTL ? 'تم رفع الملف وتحديث ملف المعلم بنجاح' : 'Asset uploaded and attached to teacher dossier');
      await onRefreshDossier?.(teacher._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر رفع الملف' : 'Failed to upload asset'));
    } finally {
      setUploadingAssetKey('');
    }
  };

  const handleBulkApproveChecklist = async () => {
    if (!teacher?._id || !bulkApprovableKeys.length || bulkApproving) return;
    setBulkApproving(true);
    try {
      await api.put(
        `/api/teachers/admin/${teacher._id}/review-checklist-bulk`,
        {
          keys: bulkApprovableKeys,
          note: isRTL ? 'اعتماد جماعي لبنود المراجعة المستوفاة بعد الفحص' : 'Bulk checklist approval after review',
        },
        { auth: true }
      );
      toast.success(isRTL ? `تم اعتماد ${bulkApprovableKeys.length} بنداً متاحاً دفعة واحدة` : `Approved ${bulkApprovableKeys.length} checklist items`);
      await onRefreshDossier?.(teacher._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر الاعتماد الجماعي للبنود' : 'Bulk approval failed'));
    } finally {
      setBulkApproving(false);
    }
  };

  const handlePurgeAssets = async () => {
    if (!teacher?._id || purgingAssets) return;
    setPurgingAssets(true);
    try {
      await api.delete(
        `/api/teachers/admin/${teacher._id}/assets?reason=${encodeURIComponent('تطهير أصول التخزين السحابي لمعلم موقوف/مرفوض')}`,
        { auth: true }
      );
      toast.success(isRTL ? 'تم تطهير الملفات والوثائق السحابية بنجاح' : 'Cloud assets purged successfully');
      setConfirmModal(null);
      await onRefreshDossier?.(teacher._id);
    } catch (err) {
      toast.error(err.message || (isRTL ? 'تعذر تطهير الملفات السحابية' : 'Failed to purge cloud assets'));
    } finally {
      setPurgingAssets(false);
    }
  };

  const toggleArrayValue = (field, value) => {
    setEditForm((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const exists = current.includes(value);
      const next = exists ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [field]: next.length ? next : current };
    });
  };

  const saveAdminSettings = async () => {
    if (!onUpdateAdminSettings || !teacher?._id || savingSettings) return;
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
      setShowSettingsEditor(false);
    } finally {
      setSavingSettings(false);
    }
  };

  const runAction = async (fn) => {
    if (submittingAction) return false;
    setSubmittingAction(true);
    try {
      const result = await fn();
      return result !== false;
    } finally {
      setSubmittingAction(false);
    }
  };

  const requestChanges = (item) => {
    setPromptValue(item.note || '');
    setPromptModal({
      title: t360.modals.requestChangeTitle,
      label: formatMsg(t360.modals.requestChangeLabel, { label: item.label }),
      confirmText: t360.modals.requestChangeConfirm,
      isDanger: false,
      onConfirm: async (note) => {
        if (!note.trim()) return;
        const ok = await runAction(() => onChecklist(teacher._id, item.key, 'changes-requested', note.trim()));
        if (ok) setPromptModal(null);
      },
    });
  };

  const finalDecision = (action) => {
    if (action === 'approve') {
      if (!gate?.approvalReady || submittingAction) return;
      runAction(() => onReview(teacher._id, 'approve', t360.footer.approveDefaultNote));
      return;
    }

    const isReject = action === 'reject';
    setPromptValue('');
    setPromptModal({
      title: isReject ? t360.modals.rejectTitle : t360.modals.requestCompletionTitle,
      label: isReject ? t360.modals.rejectLabel : t360.modals.requestCompletionLabel,
      confirmText: isReject ? t360.modals.rejectConfirm : t360.modals.requestCompletionConfirm,
      isDanger: isReject,
      onConfirm: async (note) => {
        if (!note.trim()) return;
        const ok = await runAction(() => onReview(teacher._id, action, note.trim()));
        if (ok) setPromptModal(null);
      },
    });
  };

  const circles = dossier?.circles || [];
  const assignedStudents = dossier?.assignedStudents || [];
  const walletSummary = dossier?.walletSummary || { earnings: {}, recentLedger: [] };
  const canPurgeAssets = ['rejected', 'suspended'].includes(teacher?.status) && !dossier?.assetsPurgedAt;

  const sectionTabs = [
    { id: 'all', label: isRTL ? 'نظرة شاملة 360' : 'All 360' },
    ...(!approved || profileChange ? [{ id: 'review', label: isRTL ? 'بوابة الاعتماد والمراجعة' : 'Review Gate' }] : []),
    { id: 'circles', label: isRTL ? `الحلقات والطلاب (${circles.length})` : `Circles & Students (${circles.length})` },
    { id: 'media', label: isRTL ? 'الوسائط والوثائق' : 'Media & Docs' },
    { id: 'wallet', label: isRTL ? 'المحفظة والمستحقات' : 'Wallet & Ledger' },
    { id: 'settings', label: isRTL ? 'تعديل البيانات والإعدادات' : 'Edit & Override' },
    { id: 'audit', label: isRTL ? 'سجل التدقيق' : 'Audit' },
  ];

  const showSection = (key) => activeTab === 'all' || activeTab === key;

  return (
    <div
      className="wn-admin-dossier-backdrop"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submittingAction) onClose?.(); }}
    >
      <div ref={dialogRef} tabIndex={-1} className="wn-admin-dossier">
        <header className="wn-admin-dossier__header">
          <div>
            <span>{approved ? (t360.adminSubtitle || 'Teacher 360 · Administration') : (t360.reviewSubtitle || 'Teacher 360 Review Dossier')}</span>
            <h2 id={titleId}>{teacher?.personalInfo?.fullName || teacher?.user?.name || t360.titleFallback}</h2>
            <p>{teacher?.user?.email || dash} · {teacher?.personalInfo?.phone || dash}</p>
          </div>
          <div className="wn-admin-dossier__header-actions flex-wrap">
            {approved && teacher?.isPublic === false ? (
              <span className="inline-flex items-center rounded-full border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] px-3 py-1 text-xs font-bold text-[var(--wn-badge-gold-text)]">
                {dir === 'rtl' ? 'مخفي عن العام' : 'Hidden from public'}
              </span>
            ) : approved ? (
              <button type="button" onClick={() => onPreviewPublic?.(teacher._id)} className="wn-admin-teacher-public-link">
                {t360.previewPublic}
              </button>
            ) : null}
            {approved && onSafeSuspendTeacher ? (
              <button
                type="button"
                onClick={() => onSafeSuspendTeacher(teacher._id, teacher.personalInfo?.fullName || teacher.user?.name || t360.titleFallback)}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)] text-xs font-bold inline-flex items-center gap-1.5"
              >
                <PauseCircle size={15} aria-hidden="true" />
                <span>{isRTL ? 'إيقاف / نقل الحلقات' : 'Suspend / Reassign'}</span>
              </button>
            ) : null}
            {canPurgeAssets ? (
              <button
                type="button"
                onClick={() => setConfirmModal({
                  title: isRTL ? 'تطهير الملفات السحابية للمعلم' : 'Purge Cloud Assets',
                  message: isRTL
                    ? 'سيتم حذف الصور والفيديوهات وصور الوثائق الخاصة بهذا المعلم المرفوض/الموقوف من التخزين السحابي نهائياً مع الاحتفاظ بسجل التدقيق. هل تود المتابعة؟'
                    : 'Permanently delete cloud media and private ID documents for this rejected/suspended teacher while keeping audit logs?',
                  confirmText: isRTL ? 'تأكيد التطهير السحابي' : 'Purge Assets',
                  onConfirm: handlePurgeAssets,
                })}
                className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>{isRTL ? 'تطهير الملفات السحابية' : 'Purge Cloud Assets'}</span>
              </button>
            ) : null}
            <button type="button" className="wn-admin-dossier__close" onClick={onClose} aria-label={t.adminPortal.dossiers.closeAria}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="wn-admin-dossier__loading space-y-3" role="status" aria-label={t.adminPortal.dossiers.loadingTeacher}>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        ) : (
          <div className="wn-admin-dossier__body">
            <nav className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-[var(--wn-border)]" aria-label={isRTL ? 'أقسام ملف المعلم' : 'Teacher dossier sections'}>
              {sectionTabs.map((tabItem) => (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tabItem.id);
                    if (tabItem.id === 'settings') setShowSettingsEditor(true);
                  }}
                  className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    activeTab === tabItem.id
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)] hover:border-[var(--wn-border-strong)]'
                  }`}
                >
                  {tabItem.label}
                </button>
              ))}
            </nav>

            <div hidden={!showSection('review')}>
            {!approved ? <section className="wn-admin-review-gate">
              <div className="wn-admin-review-gate__summary">
                <div>
                  <span>{t360.readiness}</span>
                  <strong>{gate?.readiness || 0}%</strong>
                  <small>{formatMsg(t360.mandatoryProgress, { completed: gate?.completedRequired || 0, total: gate?.requiredCount || 0 })}</small>
                </div>
                <div className="wn-admin-review-gate__bar">
                  <i style={{ width: `${gate?.readiness || 0}%` }} />
                </div>
                <div className={`wn-admin-review-gate__state ${gate?.approvalReady ? 'is-ready' : 'is-blocked'}`}>
                  {gate?.approvalReady ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
                  <span>{gate?.approvalReady ? t360.readyBanner : t360.blockedBanner}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 my-3">
                <p className="wn-admin-review-gate__intro flex-1 m-0">{t360.intro}</p>
                {bulkApprovableKeys.length > 0 ? (
                  <button
                    type="button"
                    disabled={bulkApproving || submittingAction}
                    onClick={handleBulkApproveChecklist}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] text-xs font-bold inline-flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {bulkApproving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={15} aria-hidden="true" />}
                    <span>
                      {isRTL
                        ? `اعتماد كل البنود المتوفرة (${bulkApprovableKeys.length})`
                        : `Approve All Available (${bulkApprovableKeys.length})`}
                    </span>
                  </button>
                ) : null}
              </div>

              {REVIEW_GROUPS.map((group) => {
                const items = (gate?.items || []).filter((item) => group.keys.includes(item.key));
                if (!items.length) return null;
                return (
                  <div className="wn-admin-review-group" key={group.id}>
                    <div className="wn-admin-review-group__heading">
                      <div><h3>{t360.groups[group.titleKey]}</h3><p>{t360.groups[group.hintKey]}</p></div>
                      <span>{formatMsg(t360.groupProgress, { done: items.filter((item) => item.satisfied).length, total: items.length })}</span>
                    </div>
                    <div className="wn-admin-review-checklist">
                      {items.map((item) => {
                        const guideKey = REVIEW_GUIDES[item.key]?.guideKey;
                        return (
                          <article key={item.key} className={`is-${item.status} ${!item.available ? 'is-missing' : ''}`}>
                            <div className="wn-admin-review-checklist__label">
                              {item.satisfied ? <CheckCircle2 size={20} aria-hidden="true" /> : item.status === 'changes-requested' ? <XCircle size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
                              <div>
                                <strong>{item.label}</strong>
                                <small>{item.requiredForTeacher ? t360.requiredLabel : t360.optionalLabel} · {reviewStates[item.status] || t360.states.fallback}</small>
                                <p className="wn-admin-review-checklist__hint">{guideKey ? t360.guides[guideKey] : ''}</p>
                                {!item.available ? <p className="wn-admin-review-checklist__missing-text">{t360.missingFile}</p> : null}
                                {item.note ? <p className="wn-admin-review-checklist__note">{formatMsg(t360.adminNotePrefix, { note: item.note })}</p> : null}
                              </div>
                            </div>
                            <div className="wn-admin-review-checklist__actions">
                              <button type="button" className="is-inspect" disabled={!canInspect(item)} onClick={() => inspectItem(item)}>
                                <Eye size={16} aria-hidden="true" /> {t360.actions.inspect}
                              </button>
                              <button
                                type="button"
                                className="is-approve"
                                disabled={!item.available || item.status === 'approved' || submittingAction}
                                onClick={() => runAction(() => onChecklist(teacher._id, item.key, 'approved', ''))}
                              >
                                {item.status === 'approved' ? t360.actions.approvedItem : t360.actions.approveItem}
                              </button>
                              <button type="button" className="is-change" disabled={submittingAction} onClick={() => requestChanges(item)}>
                                {t360.actions.requestChange}
                              </button>
                              {item.canMarkNotApplicable ? (
                                <button
                                  type="button"
                                  disabled={item.status === 'not-applicable' || submittingAction}
                                  onClick={() => runAction(() => onChecklist(teacher._id, item.key, 'not-applicable', ''))}
                                >
                                  {t360.actions.notApplicable}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section> : null}
            </div>

            {profileChange && showSection('review') ? (
              <section className="wn-admin-dossier__section border-[var(--wn-status-warn-border)] bg-[var(--wn-status-warn-bg)]">
                <div className="wn-admin-dossier__section-title">
                  <History size={18} aria-hidden="true" />
                  <h3>{t360.profileChange.title}</h3>
                </div>

                <div className="mb-4 rounded-xl border border-[var(--wn-status-warn-border)] bg-[var(--wn-surface)] p-3">
                  <strong className="block text-[var(--wn-heading)]">
                    {profileChange.status === 'pending'
                      ? t360.profileChange.statusPending
                      : profileChange.status === 'approved'
                        ? t360.profileChange.statusApproved
                        : t360.profileChange.statusRejected}
                  </strong>
                  <small className="text-[var(--wn-text-secondary)]">
                    {profileChange.createdAt ? new Date(profileChange.createdAt).toLocaleString(intlLocale) : ''}
                    {' · '}{formatMsg(t360.profileChange.fieldsCount, { count: (profileChange.changedFields || []).length })}
                  </small>
                  {profileChange.adminNote ? <p className="mt-2 text-sm text-[var(--wn-text-primary)]">{formatMsg(t360.adminNotePrefix, { note: profileChange.adminNote })}</p> : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {profileDiffRows.map((row) => (
                    <div
                      key={row.key}
                      className={`rounded-xl p-3 border text-xs ${
                        row.changed
                          ? 'border-[var(--wn-status-warn-border)] bg-[var(--wn-surface)]'
                          : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-[var(--wn-heading)]">{row.label}</span>
                        {row.changed ? (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] font-bold">
                            {isRTL ? 'مُعدّل' : 'Modified'}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <small className="block text-[var(--wn-text-tertiary)]">{isRTL ? 'الحالي:' : 'Current:'}</small>
                          <span className="text-[var(--wn-text-secondary)]">{row.before ?? dash}</span>
                        </div>
                        <div>
                          <small className="block text-[var(--wn-emerald)] font-semibold">{isRTL ? 'المقترح:' : 'Proposed:'}</small>
                          <strong className="text-[var(--wn-heading)]">{row.after ?? dash}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="wn-admin-dossier__asset-grid mt-4">
                  {mediaItems.filter(({ key }) => profileChange.proposed?.media?.[key]).map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => showAsset('profile-change', key, `${label} (${t360.profileChange.proposedAssetSuffix})`)}>
                      <Icon size={18} aria-hidden="true" />
                      <span><strong>{label} ({t360.profileChange.proposedAssetSuffix})</strong><small>{t360.profileChange.openReview}</small></span>
                    </button>
                  ))}
                </div>

                {profileChange.status === 'pending' ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submittingAction}
                      className="wn-btn wn-btn--primary min-h-[44px]"
                      onClick={() => {
                        setConfirmModal({
                          title: t360.profileChange.approveModalTitle,
                          message: t360.profileChange.approveModalBody,
                          confirmText: t360.profileChange.approveModalConfirm,
                          onConfirm: async () => {
                            const ok = await runAction(() => onProfileChangeReview?.(teacher._id, 'approve', t360.profileChange.approveDefaultNote));
                            if (ok) setConfirmModal(null);
                          },
                        });
                      }}
                    >
                      <CheckCircle2 size={16} aria-hidden="true" /> {t360.profileChange.approveBtn}
                    </button>
                    <button
                      type="button"
                      disabled={submittingAction}
                      className="wn-btn wn-btn--secondary min-h-[44px]"
                      onClick={() => {
                        setPromptValue('');
                        setPromptModal({
                          title: t360.profileChange.rejectModalTitle,
                          label: t360.profileChange.rejectModalLabel,
                          confirmText: t360.profileChange.rejectModalConfirm,
                          isDanger: true,
                          onConfirm: async (note) => {
                            if (!note.trim()) return;
                            const ok = await runAction(() => onProfileChangeReview?.(teacher._id, 'reject', note.trim()));
                            if (ok) setPromptModal(null);
                          },
                        });
                      }}
                    >
                      <XCircle size={16} aria-hidden="true" /> {t360.profileChange.rejectBtn}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === 'all' && (
              <>
                <section id="review-personal-info" className="wn-admin-dossier__section">
                  <div className="wn-admin-dossier__section-title"><UserRound size={18} aria-hidden="true" /><h3>{t360.sections.personal}</h3></div>
                  <div className="wn-admin-dossier__grid">
                    <Value label={t360.fields.fullName} value={teacher.personalInfo?.fullName} dash={dash} />
                    <Value label={t360.fields.age} value={teacher.personalInfo?.age} dash={dash} />
                    <Value label={t360.fields.gender} value={teacher.personalInfo?.gender} dash={dash} />
                    <Value label={t360.fields.country} value={teacher.personalInfo?.country} dash={dash} />
                    <Value label={t360.fields.city} value={teacher.personalInfo?.city} dash={dash} />
                    <Value label={t360.fields.address} value={teacher.personalInfo?.address} dash={dash} />
                    <Value label={t360.fields.phone} value={teacher.personalInfo?.phone} dash={dash} />
                    <Value label={t360.fields.whatsapp} value={teacher.personalInfo?.whatsapp} dash={dash} />
                    <Value label={t360.fields.telegram} value={teacher.personalInfo?.telegram} dash={dash} />
                  </div>
                </section>

                <section id="review-academic-info" className="wn-admin-dossier__section">
                  <div className="wn-admin-dossier__section-title"><GraduationCap size={18} aria-hidden="true" /><h3>{t360.sections.academic}</h3></div>
                  <div className="wn-admin-dossier__grid">
                    <Value label={t360.fields.university} value={teacher.academicInfo?.university} dash={dash} />
                    <Value label={t360.fields.faculty} value={teacher.academicInfo?.faculty} dash={dash} />
                    <Value label={t360.fields.graduationYear} value={teacher.academicInfo?.graduationYear} dash={dash} />
                    <Value label={t360.fields.specialization} value={teacher.academicInfo?.specialization} dash={dash} />
                    <Value label={t360.fields.qualification} value={teacher.academicInfo?.qualification} dash={dash} />
                    <Value label={t360.fields.teachingExperience} value={teacher.quranInfo?.teachingExperience} dash={dash} />
                    <Value label={t360.fields.memorizedParts} value={teacher.quranInfo?.memorizedParts} dash={dash} />
                    <Value label={t360.fields.numberOfIjazat} value={teacher.quranInfo?.numberOfIjazat} dash={dash} />
                    <Value label={t360.fields.ijazaType} value={teacher.quranInfo?.ijazaType} dash={dash} />
                    <Value label={t360.fields.sheikhName} value={teacher.quranInfo?.sheikhName} dash={dash} />
                    <Value label={t360.fields.sanad} value={teacher.quranInfo?.sanad} dash={dash} />
                    <Value label={t360.fields.specializations} value={specializations} dash={dash} />
                    <Value label={t360.fields.languages} value={(teacher.languages || []).join('، ')} dash={dash} />
                  </div>
                </section>
              </>
            )}

            {showSection('circles') && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title">
                  <Users size={18} aria-hidden="true" />
                  <h3>{isRTL ? 'الحلقات المسندة والطلاب والجدول الأسبوعي' : 'Assigned Circles, Students & Schedule'}</h3>
                </div>
                {circles.length === 0 ? (
                  <p className="wn-admin-dossier__empty">
                    {isRTL ? 'لا توجد حلقات نشطة مسندة لهذا المعلم حالياً.' : 'No active circles assigned to this teacher.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {circles.map((circle) => (
                      <div key={circle._id} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm text-[var(--wn-heading)]">{circle.name}</strong>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)] font-bold border border-[var(--wn-border-mint)]">
                            {circle.studentCount}/{circle.capacity} {isRTL ? 'طلاب' : 'students'}
                          </span>
                        </div>
                        <p className="text-[var(--wn-text-secondary)]">
                          {circle.planKey || dash} · {circle.status}
                          {Array.isArray(circle.schedule) && circle.schedule.length
                            ? ` · ${circle.schedule.map((s) => `${s.day} ${s.startTime}–${s.endTime}`).join('، ')}`
                            : ''}
                        </p>
                        {(circle.students || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {circle.students.map((st) => (
                              <button
                                key={st._id}
                                type="button"
                                onClick={() => onOpenStudent?.(st._id)}
                                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-heading)] font-semibold hover:border-[var(--wn-emerald)]"
                              >
                                {st.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {assignedStudents.length > 0 && (
                  <div className="pt-3 border-t border-[var(--wn-border)] space-y-2">
                    <strong className="block text-xs text-[var(--wn-heading)]">
                      {isRTL ? `اشتراكات الطلاب المرتبطة بالمعلم (${assignedStudents.length}):` : `Linked Student Subscriptions (${assignedStudents.length}):`}
                    </strong>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {assignedStudents.slice(0, 18).map((item) => (
                        <button
                          key={item.subscriptionId}
                          type="button"
                          onClick={() => item.student?._id && onOpenStudent?.(item.student._id)}
                          className="min-h-[44px] text-start rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 flex items-center justify-between gap-2 hover:border-[var(--wn-emerald)]"
                        >
                          <span className="font-semibold text-[var(--wn-heading)] truncate">{item.student?.name || dash}</span>
                          <span className="text-[var(--wn-emerald)] font-bold shrink-0">{item.sessionsRemaining}/{item.sessionCount}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {showSection('media') && (
              <>
                <section className="wn-admin-dossier__section">
                  <div className="wn-admin-dossier__section-title justify-between flex-wrap">
                    <div className="inline-flex items-center gap-2">
                      <Video size={18} aria-hidden="true" />
                      <h3>{t360.sections.media}</h3>
                    </div>
                    <span className="text-xs text-[var(--wn-text-secondary)]">
                      {isRTL ? 'يمكنك المعاينة أو رفع/استبدال الملفات مباشرة بالنيابة عن المعلم' : 'Preview or upload/replace media directly on behalf of the teacher'}
                    </span>
                  </div>
                  <div className="wn-admin-dossier__asset-grid">
                    {mediaItems.map(({ key, label, icon: Icon, accept }) => {
                      const isUploadingThis = uploadingAssetKey === key;
                      return (
                        <div key={key} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 flex flex-col justify-between gap-2">
                          <button
                            type="button"
                            disabled={!teacher.media?.[key]}
                            onClick={() => showAsset('media', key, label)}
                            className="min-h-[48px] text-start flex items-center gap-2.5 disabled:opacity-55"
                          >
                            <Icon size={18} aria-hidden="true" />
                            <span>
                              <strong className="block text-sm text-[var(--wn-heading)]">{label}</strong>
                              <small className="text-xs text-[var(--wn-text-secondary)]">
                                {teacher.media?.[key] ? t360.mediaItems.openForReview : t360.mediaItems.unavailable}
                              </small>
                            </span>
                          </button>
                          <label className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-heading)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:border-[var(--wn-emerald)]">
                            {isUploadingThis ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                            <span>
                              {isUploadingThis
                                ? (isRTL ? 'جارٍ الرفع...' : 'Uploading...')
                                : teacher.media?.[key]
                                  ? (isRTL ? 'استبدال الملف' : 'Replace File')
                                  : (isRTL ? 'رفع الملف الآن' : 'Upload Now')}
                            </span>
                            <input
                              type="file"
                              accept={accept}
                              disabled={Boolean(uploadingAssetKey)}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) handleAdminUploadAsset(key, 'teacher-public', file);
                              }}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      );
                    })}
                    {Array.from({ length: teacher.media?.additionalVideosCount || 0 }).map((_, index) => {
                      const label = formatMsg(t360.mediaItems.additionalVideo, { n: index + 1 });
                      return (
                        <button key={`video-${index}`} type="button" onClick={() => showAsset('media', 'additionalVideos', label, index)}>
                          <Video size={18} aria-hidden="true" />
                          <span><strong>{label}</strong><small>{t360.mediaItems.openForReview}</small></span>
                        </button>
                      );
                    })}
                    {Array.from({ length: teacher.media?.audioRecordingsCount || 0 }).map((_, index) => {
                      const label = formatMsg(t360.mediaItems.audioRecording, { n: index + 1 });
                      return (
                        <button key={`audio-${index}`} type="button" onClick={() => showAsset('media', 'audioRecordings', label, index)}>
                          <Headphones size={18} aria-hidden="true" />
                          <span><strong>{label}</strong><small>{t360.mediaItems.openForReview}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="wn-admin-dossier__section">
                  <div className="wn-admin-dossier__section-title"><IdCard size={18} aria-hidden="true" /><h3>{t360.sections.documents}</h3></div>
                  <p className="wn-admin-dossier__privacy">
                    <ShieldCheck size={15} aria-hidden="true" />
                    {t360.docItems.privacyNotice}
                  </p>
                  <div className="wn-admin-dossier__asset-grid">
                    {DOC_UPLOAD_KEYS.map(({ key, tKey }) => {
                      const hasDoc = Boolean(teacher.documents?.[key]);
                      const label = t360.docItems[tKey];
                      const isUploadingThis = uploadingAssetKey === key;
                      const DocIcon = key === 'graduationCertificate' ? FileText : IdCard;
                      return (
                        <div key={key} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 flex flex-col justify-between gap-2">
                          <button
                            type="button"
                            disabled={!hasDoc}
                            onClick={() => showAsset('document', key, label)}
                            className="min-h-[48px] text-start flex items-center gap-2.5 disabled:opacity-55"
                          >
                            <DocIcon size={18} aria-hidden="true" />
                            <span>
                              <strong className="block text-sm text-[var(--wn-heading)]">{label}</strong>
                              <small className="text-xs text-[var(--wn-text-secondary)]">
                                {hasDoc ? t360.docItems.open : t360.docItems.unavailable}
                              </small>
                            </span>
                          </button>
                          <label className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-xs font-bold text-[var(--wn-heading)] inline-flex items-center justify-center gap-1.5 cursor-pointer hover:border-[var(--wn-emerald)]">
                            {isUploadingThis ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                            <span>
                              {isUploadingThis
                                ? (isRTL ? 'جارٍ الرفع...' : 'Uploading...')
                                : hasDoc
                                  ? (isRTL ? 'استبدال الوثيقة' : 'Replace Doc')
                                  : (isRTL ? 'رفع الوثيقة' : 'Upload Doc')}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              disabled={Boolean(uploadingAssetKey)}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) handleAdminUploadAsset(key, 'teacher-private', file);
                              }}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      );
                    })}
                    {Array.from({ length: teacher.documents?.tajweedCertificatesCount || 0 }).map((_, index) => {
                      const label = formatMsg(t360.docItems.tajweedCert, { n: index + 1 });
                      return (
                        <button key={`tajweed-${index}`} type="button" onClick={() => showAsset('document', 'tajweedCertificates', label, index)}>
                          <FileText size={18} aria-hidden="true" /><span><strong>{label}</strong><small>{t360.docItems.open}</small></span>
                        </button>
                      );
                    })}
                    {Array.from({ length: teacher.documents?.ijazatCount || 0 }).map((_, index) => {
                      const label = formatMsg(t360.docItems.ijaza, { n: index + 1 });
                      return (
                        <button key={`ijaza-${index}`} type="button" onClick={() => showAsset('document', 'ijazat', label, index)}>
                          <FileText size={18} aria-hidden="true" /><span><strong>{label}</strong><small>{t360.docItems.open}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {showSection('wallet') && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title">
                  <Wallet size={18} aria-hidden="true" />
                  <h3>{isRTL ? 'المحفظة المالية وسجل التسويات' : 'Financial Wallet & Recent Ledger'}</h3>
                </div>
                <div className="wn-admin-dossier__grid mb-4">
                  <Value label={isRTL ? 'إجمالي الأرباح المحققة' : 'Total Earned'} value={`${Number(walletSummary.earnings?.totalEarned || 0)} EGP`} dash={dash} />
                  <Value label={isRTL ? 'الرصيد المتاح للسحب' : 'Pending Payout'} value={`${Number(walletSummary.earnings?.pendingPayout || 0)} EGP`} dash={dash} />
                  <Value label={isRTL ? 'المبالغ المسحوبة' : 'Withdrawn'} value={`${Number(walletSummary.earnings?.withdrawn || 0)} EGP`} dash={dash} />
                </div>
                {(walletSummary.recentLedger || []).length > 0 ? (
                  <div className="wn-admin-360-table">
                    {walletSummary.recentLedger.map((entry) => (
                      <div key={entry._id}>
                        <span>
                          <strong>{entry.type}</strong>
                          <small>{entry.description || dash}</small>
                        </span>
                        <span>
                          <strong>{(Number(entry.amountMinor || 0) / 100).toFixed(2)} {entry.currency || 'EGP'}</strong>
                          <small>{entry.status || 'settled'}</small>
                        </span>
                        <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString(intlLocale) : dash}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="wn-admin-dossier__empty">
                    {isRTL ? 'لا توجد حركات دفتر أستاذ مسجلة لهذا المعلم بعد.' : 'No ledger transactions recorded yet.'}
                  </p>
                )}
              </section>
            )}

            {showSection('settings') && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title justify-between flex-wrap">
                  <div className="inline-flex items-center gap-2">
                    <Clock3 size={18} aria-hidden="true" />
                    <h3>{t360.sections.activity}</h3>
                  </div>
                  {onUpdateAdminSettings ? (
                    <button
                      type="button"
                      onClick={() => setShowSettingsEditor((v) => !v)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-lg border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-xs font-bold text-[var(--wn-heading)] inline-flex items-center gap-1.5"
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      <span>{showSettingsEditor ? (isRTL ? 'طي نموذج التعديل الشامل' : 'Collapse Full Editor') : ef.title}</span>
                    </button>
                  ) : null}
                </div>
                <div className="wn-admin-dossier__grid">
                  <Value label={t360.fields.totalSessions} value={dossier.activity?.totalSessions || 0} dash={dash} />
                  <Value label={t360.fields.completedSessions} value={dossier.activity?.completedSessions || 0} dash={dash} />
                  <Value label={t360.fields.acceptedSessions} value={dossier.activity?.acceptedSessions || 0} dash={dash} />
                  <Value label={t360.fields.distinctStudents} value={dossier.activity?.distinctStudents || 0} dash={dash} />
                  <Value label={t360.fields.avgRating} value={teacher.rating?.average || 0} dash={dash} />
                  <Value label={t360.fields.ratingsCount} value={teacher.rating?.count || 0} dash={dash} />
                </div>
                {onUpdateAdminSettings && (showSettingsEditor || activeTab === 'settings') ? (
                  <div className="mt-5 pt-5 border-t border-[var(--wn-border)] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--wn-heading)]">{ef.title}</h4>
                        <p className="text-xs text-[var(--wn-text-secondary)]">{ef.desc}</p>
                      </div>
                      {onDeleteTeacher ? (
                        <button
                          type="button"
                          onClick={() => onDeleteTeacher(teacher._id, teacher.personalInfo?.fullName || teacher.user?.name || t360.titleFallback)}
                          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] border border-[var(--wn-status-danger-border)]"
                        >
                          <Trash2 size={14} aria-hidden="true" /> {ef.deleteBtn}
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.fullName}</span>
                        <input type="text" value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.email}</span>
                        <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.phone}</span>
                        <input type="text" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.whatsapp}</span>
                        <input type="text" value={editForm.whatsapp} onChange={(e) => setEditForm((p) => ({ ...p, whatsapp: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.telegram}</span>
                        <input type="text" value={editForm.telegram} onChange={(e) => setEditForm((p) => ({ ...p, telegram: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.age}</span>
                        <input type="number" min="18" max="80" value={editForm.age} onChange={(e) => setEditForm((p) => ({ ...p, age: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.gender}</span>
                        <select value={editForm.gender} onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]">
                          <option value="male">{ef.genderMale}</option>
                          <option value="female">{ef.genderFemale}</option>
                        </select>
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.newPassword}</span>
                        <input type="password" placeholder={ef.newPasswordPlaceholder} value={editForm.newPassword} onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.country}</span>
                        <input type="text" value={editForm.country} onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.city}</span>
                        <input type="text" value={editForm.city} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.address}</span>
                        <input type="text" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.university}</span>
                        <input type="text" value={editForm.university} onChange={(e) => setEditForm((p) => ({ ...p, university: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.faculty}</span>
                        <input type="text" value={editForm.faculty} onChange={(e) => setEditForm((p) => ({ ...p, faculty: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.graduationYear}</span>
                        <input type="number" min="1970" max="2030" value={editForm.graduationYear} onChange={(e) => setEditForm((p) => ({ ...p, graduationYear: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.academicSpec}</span>
                        <input type="text" value={editForm.specialization} onChange={(e) => setEditForm((p) => ({ ...p, specialization: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.qualification}</span>
                        <input type="text" value={editForm.qualification} onChange={(e) => setEditForm((p) => ({ ...p, qualification: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.memorizedParts}</span>
                        <input type="number" min="0" max="30" value={editForm.memorizedParts} onChange={(e) => setEditForm((p) => ({ ...p, memorizedParts: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.teachingExperience}</span>
                        <input type="number" min="0" max="60" value={editForm.teachingExperience} onChange={(e) => setEditForm((p) => ({ ...p, teachingExperience: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.numberOfIjazat}</span>
                        <input type="number" min="0" max="30" value={editForm.numberOfIjazat} onChange={(e) => setEditForm((p) => ({ ...p, numberOfIjazat: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.ijazaType}</span>
                        <input type="text" value={editForm.ijazaType} onChange={(e) => setEditForm((p) => ({ ...p, ijazaType: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.sheikhName}</span>
                        <input type="text" value={editForm.sheikhName} onChange={(e) => setEditForm((p) => ({ ...p, sheikhName: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.sanad}</span>
                        <textarea rows={2} value={editForm.sanad} onChange={(e) => setEditForm((p) => ({ ...p, sanad: e.target.value }))} className="w-full border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.bio}</span>
                        <textarea rows={2} value={editForm.bio} onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))} className="w-full border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="block text-xs font-bold text-[var(--wn-heading)]">{ef.specializationsLabel}</span>
                        <div className="flex flex-wrap gap-2">
                          {specializationOptions.map((opt) => {
                            const active = (editForm.specializations || []).includes(opt.key);
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleArrayValue('specializations', opt.key)}
                                className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                  active
                                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="block text-xs font-bold text-[var(--wn-heading)]">{ef.languagesLabel}</span>
                        <div className="flex flex-wrap gap-2">
                          {LANGUAGE_OPTIONS.map((opt) => {
                            const active = (editForm.languages || []).includes(opt.key);
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleArrayValue('languages', opt.key)}
                                className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                  active
                                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] border-[var(--wn-emerald)]'
                                    : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end bg-[var(--wn-surface-soft)] p-3 rounded-xl border border-[var(--wn-border)]">
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.hourlyRate}</span>
                        <input type="number" min="10" max="2000" value={editForm.hourlyRate} onChange={(e) => setEditForm((p) => ({ ...p, hourlyRate: e.target.value }))} className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]" />
                      </label>
                      <label className="text-xs font-bold text-[var(--wn-heading)] space-y-1">
                        <span>{ef.status}</span>
                        <select
                          value={editForm.status}
                          onChange={(e) => {
                            const nextStatus = e.target.value;
                            setEditForm((p) => ({ ...p, status: nextStatus, isVerified: nextStatus === 'approved' }));
                          }}
                          className="w-full min-h-[44px] border border-[var(--wn-border)] rounded-lg px-3 py-2 text-sm bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
                        >
                          <option value="approved">{ef.statuses.approved}</option>
                          <option value="pending">{ef.statuses.pending}</option>
                          <option value="under-review">{ef.statuses.underReview}</option>
                          <option value="suspended">{ef.statuses.suspended}</option>
                          <option value="rejected">{ef.statuses.rejected}</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] py-2 cursor-pointer min-h-11">
                        <input type="checkbox" checked={editForm.isPublic} onChange={(e) => setEditForm((p) => ({ ...p, isPublic: e.target.checked }))} className="w-4 h-4 accent-[var(--wn-emerald)]" />
                        <span>{dir === 'rtl' ? 'ظاهر للعام (في صفحة المعلمين والموقع)' : 'Visible to the public (directory & profile)'}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] py-2 cursor-pointer min-h-[44px]">
                        <input type="checkbox" checked={editForm.isFeatured} onChange={(e) => setEditForm((p) => ({ ...p, isFeatured: e.target.checked }))} className="w-4 h-4 accent-[var(--wn-emerald)]" />
                        <span>{ef.isFeatured}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] py-2 cursor-pointer min-h-[44px]">
                        <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.value }))} className="w-4 h-4 accent-[var(--wn-emerald)]" />
                        <span>{ef.isActive}</span>
                      </label>
                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={saveAdminSettings}
                        className="wn-btn wn-btn--primary min-h-[44px] text-xs py-2.5 inline-flex items-center justify-center gap-1.5"
                      >
                        {savingSettings ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                        {savingSettings ? ef.savingBtn : ef.saveBtn}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {showSection('audit') && (
              <section className="wn-admin-dossier__section">
                <div className="wn-admin-dossier__section-title"><History size={18} aria-hidden="true" /><h3>{t360.sections.audit}</h3></div>
                {(dossier.audit || []).length === 0 ? (
                  <p className="wn-admin-dossier__empty">{t360.auditEmpty}</p>
                ) : (
                  <div className="wn-admin-audit-list">
                    {(dossier.audit || []).map((entry) => (
                      <div key={entry._id}>
                        <span><strong>{entry.actor?.name || t360.actorFallback}</strong><small>{new Date(entry.createdAt).toLocaleString(intlLocale)}</small></span>
                        <span><strong>{entry.action}</strong>{entry.reason ? <small>{entry.reason}</small> : null}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!approved ? <footer className="wn-admin-dossier__footer">
              <button type="button" disabled={submittingAction} onClick={() => finalDecision('reject')} className="is-reject">
                {t360.footer.reject}
              </button>
              <button type="button" disabled={submittingAction} onClick={() => finalDecision('request-changes')} className="is-change">
                {t360.footer.requestChanges}
              </button>
              <button
                type="button"
                onClick={() => finalDecision('approve')}
                disabled={!gate?.approvalReady || submittingAction}
                className="is-approve"
              >
                {submittingAction ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
                {t360.footer.approveFinal}
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

      <Modal
        isOpen={Boolean(promptModal)}
        onClose={() => { if (!submittingAction) setPromptModal(null); }}
        title={promptModal?.title || ''}
        disableClose={submittingAction}
      >
        {promptModal ? (
          <DossierPromptContent
            label={promptModal.label}
            value={promptValue}
            onChange={setPromptValue}
            placeholder={t360.modals.promptPlaceholder}
            cancelText={t360.modals.cancel}
            confirmText={promptModal.confirmText || t360.modals.confirm}
            isDanger={promptModal.isDanger || purgingAssets}
            submitting={submittingAction || purgingAssets}
            onClose={() => setPromptModal(null)}
            onConfirm={() => promptModal.onConfirm(promptValue)}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(confirmModal)}
        onClose={() => { if (!submittingAction && !purgingAssets) setConfirmModal(null); }}
        title={confirmModal?.title || ''}
        disableClose={submittingAction || purgingAssets}
      >
        {confirmModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{confirmModal.message}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={submittingAction || purgingAssets}
                onClick={() => setConfirmModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {t360.modals.cancel}
              </button>
              <button
                type="button"
                disabled={submittingAction || purgingAssets}
                onClick={confirmModal.onConfirm}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-medium rounded-lg bg-[var(--wn-emerald)] inline-flex items-center gap-2 disabled:opacity-50"
              >
                {(submittingAction || purgingAssets) ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                {confirmModal.confirmText || t360.modals.confirm}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DossierPromptContent({
  label,
  value,
  onChange,
  placeholder,
  cancelText,
  confirmText,
  isDanger,
  submitting,
  onClose,
  onConfirm,
}) {
  const textareaId = useId();
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={textareaId} className="block text-xs font-semibold text-[var(--wn-heading)] mb-1">
          {label}
        </label>
        <textarea
          id={textareaId}
          rows={4}
          value={value}
          disabled={submitting}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg p-2.5 text-sm"
          placeholder={placeholder}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
        <button
          type="button"
          disabled={submitting}
          onClick={onClose}
          className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          disabled={!value.trim() || submitting}
          onClick={onConfirm}
          className={`min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50 ${
            isDanger ? 'bg-[var(--wn-danger)]' : 'bg-[var(--wn-emerald)]'
          }`}
        >
          {submitting ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
          {confirmText}
        </button>
      </div>
    </div>
  );
}
