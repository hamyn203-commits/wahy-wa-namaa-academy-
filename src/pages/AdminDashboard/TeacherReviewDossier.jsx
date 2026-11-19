import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Circle, FileText, GraduationCap, Headphones,
  IdCard, Loader2, ShieldCheck, UserRound, Video, X, XCircle, Clock3, History, Eye, Trash2, Save,
} from 'lucide-react';
import Modal from '../../components/shared/Modal';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
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
  { key: 'profilePhoto', icon: UserRound },
  { key: 'introductionVideo', icon: Video },
  { key: 'recitationVideo', icon: Video },
  { key: 'teachingMethodVideo', icon: Video },
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
}) {
  const { locale, dir, t } = useI18n();
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
    isActive: true,
  });

  useFocusTrapDialog(
    Boolean((teacher || loading) && !selectedAsset && !promptModal && !confirmModal),
    onClose,
    dialogRef
  );

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

  if (!teacher && !loading) return null;

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
          <div className="wn-admin-dossier__header-actions">
            {approved ? (
              <button type="button" onClick={() => onPreviewPublic?.(teacher._id)} className="wn-admin-teacher-public-link">
                {t360.previewPublic}
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

              <p className="wn-admin-review-gate__intro">{t360.intro}</p>
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

            {profileChange ? (
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

                <div className="wn-admin-dossier__grid">
                  <Value label={t360.profileChange.proposedName} value={profileChange.proposed?.personalInfo?.fullName} dash={dash} />
                  <Value label={t360.profileChange.proposedCity} value={profileChange.proposed?.personalInfo?.city} dash={dash} />
                  <Value label={t360.profileChange.proposedUniversity} value={profileChange.proposed?.academicInfo?.university} dash={dash} />
                  <Value label={t360.profileChange.proposedFaculty} value={profileChange.proposed?.academicInfo?.faculty} dash={dash} />
                  <Value label={t360.profileChange.proposedQualification} value={profileChange.proposed?.academicInfo?.qualification} dash={dash} />
                  <Value label={t360.profileChange.proposedExperience} value={profileChange.proposed?.quranInfo?.teachingExperience} dash={dash} />
                  <Value label={t360.profileChange.proposedIjazat} value={profileChange.proposed?.quranInfo?.numberOfIjazat} dash={dash} />
                  <Value label={t360.profileChange.proposedBio} value={profileChange.proposed?.user?.bio} dash={dash} />
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

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Video size={18} aria-hidden="true" /><h3>{t360.sections.media}</h3></div>
              <div className="wn-admin-dossier__asset-grid">
                {mediaItems.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!teacher.media?.[key]}
                    onClick={() => showAsset('media', key, label)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span><strong>{label}</strong><small>{teacher.media?.[key] ? t360.mediaItems.openForReview : t360.mediaItems.unavailable}</small></span>
                  </button>
                ))}
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
                <button type="button" disabled={!teacher.documents?.idCardFront} onClick={() => showAsset('document', 'idCardFront', t360.docItems.idCardFront)}>
                  <IdCard size={18} aria-hidden="true" /><span><strong>{t360.docItems.idCardFront}</strong><small>{teacher.documents?.idCardFront ? t360.docItems.open : t360.docItems.unavailable}</small></span>
                </button>
                <button type="button" disabled={!teacher.documents?.idCardBack} onClick={() => showAsset('document', 'idCardBack', t360.docItems.idCardBack)}>
                  <IdCard size={18} aria-hidden="true" /><span><strong>{t360.docItems.idCardBack}</strong><small>{teacher.documents?.idCardBack ? t360.docItems.open : t360.docItems.unavailable}</small></span>
                </button>
                <button type="button" disabled={!teacher.documents?.graduationCertificate} onClick={() => showAsset('document', 'graduationCertificate', t360.docItems.graduationCertificate)}>
                  <FileText size={18} aria-hidden="true" /><span><strong>{t360.docItems.graduationCertificate}</strong><small>{teacher.documents?.graduationCertificate ? t360.docItems.open : t360.docItems.unavailable}</small></span>
                </button>
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

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Clock3 size={18} aria-hidden="true" /><h3>{t360.sections.activity}</h3></div>
              <div className="wn-admin-dossier__grid">
                <Value label={t360.fields.totalSessions} value={dossier.activity?.totalSessions || 0} dash={dash} />
                <Value label={t360.fields.completedSessions} value={dossier.activity?.completedSessions || 0} dash={dash} />
                <Value label={t360.fields.acceptedSessions} value={dossier.activity?.acceptedSessions || 0} dash={dash} />
                <Value label={t360.fields.distinctStudents} value={dossier.activity?.distinctStudents || 0} dash={dash} />
                <Value label={t360.fields.avgRating} value={teacher.rating?.average || 0} dash={dash} />
                <Value label={t360.fields.ratingsCount} value={teacher.rating?.count || 0} dash={dash} />
              </div>
              {onUpdateAdminSettings ? (
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
                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] py-2 cursor-pointer min-h-[44px]">
                      <input type="checkbox" checked={editForm.isFeatured} onChange={(e) => setEditForm((p) => ({ ...p, isFeatured: e.target.checked }))} className="w-4 h-4 accent-[var(--wn-emerald)]" />
                      <span>{ef.isFeatured}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--wn-heading)] py-2 cursor-pointer min-h-[44px]">
                      <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-[var(--wn-emerald)]" />
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
            isDanger={promptModal.isDanger}
            submitting={submittingAction}
            onClose={() => setPromptModal(null)}
            onConfirm={() => promptModal.onConfirm(promptValue)}
          />
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(confirmModal)}
        onClose={() => { if (!submittingAction) setConfirmModal(null); }}
        title={confirmModal?.title || ''}
        disableClose={submittingAction}
      >
        {confirmModal ? (
          <div className="space-y-4 text-sm text-[var(--wn-text-secondary)]">
            <p>{confirmModal.message}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--wn-border)]">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => setConfirmModal(null)}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-secondary)] border border-[var(--wn-border)] rounded-lg disabled:opacity-50"
              >
                {t360.modals.cancel}
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={confirmModal.onConfirm}
                className="min-h-[44px] px-4 py-2 text-sm text-[var(--wn-text-inverse)] font-medium rounded-lg bg-[var(--wn-emerald)] inline-flex items-center gap-2 disabled:opacity-50"
              >
                {submittingAction ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
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
