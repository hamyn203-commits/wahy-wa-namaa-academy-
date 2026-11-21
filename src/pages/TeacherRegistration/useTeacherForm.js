import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { apiUrl } from '../../config';
import { INITIAL_FORM, DRAFT_KEY, STATUS_TOKEN_KEY } from './constants';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useAuth } from '../../hooks/useAuth.jsx';
import { uploadTeacherFiles } from '../../lib/teacherUploadQueue.mjs';
import { getAccessToken, refreshAccessToken } from '../../lib/authSession';
import { trackTeacherFunnel, resetTeacherFunnelSessionId } from '../../lib/analytics';
import {
  loadTeacherDraft,
  saveTeacherDraft,
  loadVerificationSession,
  saveVerificationSession,
  loadTeacherDraftFiles,
  saveTeacherDraftFiles,
  clearTeacherDraft,
} from '../../lib/teacherDraftStorage';

const emptyFiles = () => ({
  profilePhoto: null,
  idCardFront: null,
  idCardBack: null,
  graduationCertificate: null,
  tajweedCertificates: [],
  ijazat: [],
  introductionVideo: null,
  recitationVideos: [],
  teachingMethodVideo: null,
});

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const emailLooksValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const MB = 1024 * 1024;
const FILE_RULE_SPECS = {
  publicImage: {
    types: ['image/jpeg', 'image/png'],
    extensions: ['.jpg', '.jpeg', '.jfif', '.png'],
    maxBytes: 100 * MB,
    fallbackLabel: 'الصورة الشخصية',
  },
  privateDocument: {
    types: ['image/jpeg', 'image/png', 'application/pdf'],
    extensions: ['.jpg', '.jpeg', '.jfif', '.png', '.pdf'],
    maxBytes: 25 * MB,
    fallbackLabel: 'المستند',
  },
  recitationVideo: {
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov'],
    maxBytes: 100 * MB,
    fallbackLabel: 'فيديو التلاوة',
  },
};

function fileExtension(name = '') {
  const value = String(name || '');
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(index).toLowerCase() : '';
}

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

function validateSelectedFile(file, rule, label, val) {
  if (!file) return null;
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    return formatMsg(val.fileEmpty || '{label}: الملف فارغ أو غير صالح', { label });
  }
  if (Number(file.size) > rule.maxBytes) {
    return formatMsg(val.fileTooLarge || '{label}: الحد الأقصى {maxMb} MB لكل ملف', {
      label,
      maxMb: Math.round(rule.maxBytes / MB),
    });
  }
  if (!rule.types.includes(String(file.type || '').toLowerCase())) {
    return formatMsg(val.fileUnsupportedType || '{label}: نوع الملف غير مدعوم', { label });
  }
  if (!rule.extensions.includes(fileExtension(file.name))) {
    return formatMsg(val.fileUnsupportedExt || '{label}: امتداد الملف غير مدعوم', { label });
  }
  return null;
}

function validateTeacherFiles(files, tr) {
  const val = tr?.validation || {};
  const ruleLabels = tr?.fileRules || {};
  const labelFor = (key) => ruleLabels[key] || FILE_RULE_SPECS[key].fallbackLabel;

  const checks = [
    [files.profilePhoto, FILE_RULE_SPECS.publicImage, labelFor('publicImage')],
    [files.idCardFront, FILE_RULE_SPECS.privateDocument, labelFor('privateDocument')],
    [files.idCardBack, FILE_RULE_SPECS.privateDocument, labelFor('privateDocument')],
    [files.graduationCertificate, FILE_RULE_SPECS.privateDocument, labelFor('privateDocument')],
    ...((files.tajweedCertificates || []).map((file) => [file, FILE_RULE_SPECS.privateDocument, labelFor('privateDocument')])),
    ...((files.ijazat || []).map((file) => [file, FILE_RULE_SPECS.privateDocument, labelFor('privateDocument')])),
    [files.introductionVideo, FILE_RULE_SPECS.recitationVideo, labelFor('recitationVideo')],
    ...((files.recitationVideos || []).map((file) => [file, FILE_RULE_SPECS.recitationVideo, labelFor('recitationVideo')])),
    [files.teachingMethodVideo, FILE_RULE_SPECS.recitationVideo, labelFor('recitationVideo')],
  ];

  for (const [file, rule, label] of checks) {
    const error = validateSelectedFile(file, rule, label, val);
    if (error) return error;
  }

  const coreVideos = [
    files.introductionVideo,
    files.recitationVideos?.[0],
    files.teachingMethodVideo,
  ].filter(Boolean);
  const fingerprints = coreVideos.map((file) => [
    String(file.name || '').toLowerCase(),
    Number(file.size || 0),
    Number(file.lastModified || 0),
  ].join(':'));
  if (new Set(fingerprints).size !== fingerprints.length) {
    return val.distinctVideosRequired || 'استخدم ثلاثة ملفات مختلفة: فيديو التعريف، فيديو التلاوة، وفيديو طريقة التدريس.';
  }

  return null;
}

export function useTeacherForm() {
  const toast = useToast();
  const { locale, t } = useI18n();
  const tr = t?.teacherRegistration || {};
  const { user } = useAuth();
  const authenticatedTeacher = user?.role === 'teacher';
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const submissionLock = useRef(false);
  const sendCodeLock = useRef(false);
  const verifyCodeLock = useRef(false);
  const checkStatusLock = useRef(false);
  const completedUploads = useRef({ scope: '', files: new Map() });
  const [applicationStatus, setApplicationStatus] = useState('pending');
  const [applicationStatusToken, setApplicationStatusToken] = useState('');
  const [applicationReviewNote, setApplicationReviewNote] = useState('');
  const [applicationRequestedChanges, setApplicationRequestedChanges] = useState([]);
  const [credentials, setCredentials] = useState({ email: '', password: '', confirmPassword: '' });
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [files, setFiles] = useState(emptyFiles);
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      const savedStatusRaw = sessionStorage.getItem(STATUS_TOKEN_KEY);
      if (savedStatusRaw && !authenticatedTeacher) {
        const parsedStatus = JSON.parse(savedStatusRaw);
        if (parsedStatus?.token) {
          setApplicationStatusToken(parsedStatus.token);
          setApplicationStatus(parsedStatus.status || 'pending');
          if (parsedStatus.email) {
            setCredentials((p) => ({ ...p, email: parsedStatus.email }));
          }
          setSubmitted(true);
          hydratedRef.current = true;
          return;
        }
      }
    } catch { /* ignore */ }

    let restoredSomething = false;
    try {
      const d = loadTeacherDraft(DRAFT_KEY);
      if (d) {
        if (d.formData) {
          restoredSomething = true;
          setFormData((prev) => ({
            ...prev,
            ...d.formData,
            personalInfo: { ...prev.personalInfo, ...(d.formData.personalInfo || {}) },
            academicInfo: { ...prev.academicInfo, ...(d.formData.academicInfo || {}) },
            quranInfo: { ...prev.quranInfo, ...(d.formData.quranInfo || {}) },
            documentAvailability: {
              ...(prev.documentAvailability || {}),
              ...(d.formData.documentAvailability || {}),
            },
            languages: Array.isArray(d.formData.languages) && d.formData.languages.length ? d.formData.languages : prev.languages,
          }));
        }
        if (d.credentials?.email) {
          restoredSomething = true;
          setCredentials((p) => ({ ...p, email: d.credentials.email }));
        }

        const verifySess = loadVerificationSession();
        const sameEmailVerified = Boolean(
          verifySess?.emailVerified
          && verifySess?.verificationToken
          && normalizeEmail(verifySess.verifiedEmail) === normalizeEmail(d.credentials?.email)
        );
        if (sameEmailVerified) {
          setEmailVerified(true);
          setVerifiedEmail(normalizeEmail(verifySess.verifiedEmail));
          setVerificationToken(verifySess.verificationToken);
        }

        if (d.step) {
          // If the user returned to Step 3-5 in a new session without active tab OTP token,
          // keep all saved data & files intact and guide them cleanly to Step 2 (if unauthenticated)
          // or directly to their saved step if OTP is still valid or authenticated.
          const savedStep = Number(d.step) || 1;
          if (authenticatedTeacher || sameEmailVerified || savedStep <= 2) {
            setStep(savedStep);
          } else {
            setStep(2);
          }
        }
      }
    } catch { /* ignore */ }

    let cancelled = false;
    loadTeacherDraftFiles()
      .then((restoredFiles) => {
        if (cancelled || !restoredFiles) return;
        const hasAnyFile = Object.values(restoredFiles).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
        if (hasAnyFile) {
          setFiles((prev) => ({ ...prev, ...restoredFiles }));
          restoredSomething = true;
        }
        if (restoredSomething) {
          setDraftRestored(true);
          setDraftSaved(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          hydratedRef.current = true;
          if (restoredSomething) {
            setDraftRestored(true);
            setDraftSaved(true);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authenticatedTeacher]);

  useEffect(() => {
    if (!authenticatedTeacher) return;
    setCredentials((p) => ({ ...p, email: user.email }));
    setFormData((p) => ({
      ...p,
      personalInfo: {
        ...p.personalInfo,
        fullName: p.personalInfo.fullName || user.name,
        phone: p.personalInfo.phone || user.phone || '',
      },
    }));
  }, [authenticatedTeacher, user?.email, user?.name, user?.phone]);

  const statusCheckFailedMsg = tr.toasts?.statusCheckFailed || 'تعذر تحديث حالة الطلب حاليًا، حاول مرة أخرى.';

  const applyStatusResponse = useCallback((data) => {
    const nextStatus = data.applicationStatus || 'pending';
    setApplicationStatus(nextStatus);
    setApplicationReviewNote(data.reviewNote || '');
    setApplicationRequestedChanges(Array.isArray(data.requestedChanges) ? data.requestedChanges : []);
    try { sessionStorage.setItem(STATUS_TOKEN_KEY, JSON.stringify({ token: applicationStatusToken, status: nextStatus, email: credentials.email })); } catch { /* ignore */ }
  }, [applicationStatusToken, credentials.email]);

  const checkApplicationStatus = useCallback(async (manual = false) => {
    if (!submitted || !applicationStatusToken) return;
    if (manual && checkStatusLock.current) return;
    if (manual) { checkStatusLock.current = true; setCheckingStatus(true); }
    try {
      const r = await fetch(apiUrl('/api/teachers/application-status'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: applicationStatusToken }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { if (manual) toast.error(data.error || statusCheckFailedMsg); return; }
      applyStatusResponse(data);
    } catch {
      if (manual) toast.error(statusCheckFailedMsg);
    } finally {
      if (manual) { checkStatusLock.current = false; setCheckingStatus(false); }
    }
  }, [submitted, applicationStatusToken, applyStatusResponse, toast, statusCheckFailedMsg]);

  useEffect(() => {
    if (!submitted || !applicationStatusToken) return undefined;

    checkApplicationStatus(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') checkApplicationStatus(false);
    }, 10000);

    const onFocus = () => checkApplicationStatus(false);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkApplicationStatus(false);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [submitted, applicationStatusToken, checkApplicationStatus]);

  const saveDraft = useCallback(() => {
    if (!hydratedRef.current || submitted) return;
    saveTeacherDraft(DRAFT_KEY, {
      formData,
      email: credentials.email,
      step,
    });
    setDraftSaved(true);
  }, [formData, credentials.email, step, submitted]);

  useEffect(() => {
    if (!hydratedRef.current || submitted) return undefined;
    const timer = setTimeout(saveDraft, 350);
    return () => clearTimeout(timer);
  }, [saveDraft, submitted]);

  useEffect(() => {
    if (submitted) return undefined;
    const flushNow = () => {
      if (!hydratedRef.current) return;
      saveTeacherDraft(DRAFT_KEY, {
        formData,
        email: credentials.email,
        step,
      });
    };
    window.addEventListener('pagehide', flushNow);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [formData, credentials.email, step, submitted]);

  useEffect(() => {
    if (!hydratedRef.current || submitted) return;
    saveTeacherDraftFiles(files).catch(() => {});
  }, [files, submitted]);

  useEffect(() => {
    saveVerificationSession({ emailVerified, verifiedEmail, verificationToken });
  }, [emailVerified, verifiedEmail, verificationToken]);

  const clearDraft = useCallback(async () => {
    await clearTeacherDraft(DRAFT_KEY);
    setFormData(INITIAL_FORM);
    setFiles(emptyFiles());
    setCredentials((prev) => ({
      email: authenticatedTeacher ? prev.email : '',
      password: '',
      confirmPassword: '',
    }));
    setVerificationCode('');
    setIsCodeSent(false);
    setEmailVerified(false);
    setVerifiedEmail('');
    setVerificationToken('');
    setStep(1);
    setFieldError('');
    setDraftRestored(false);
    setDraftSaved(false);
    completedUploads.current.files.clear();
  }, [authenticatedTeacher]);

  const countTouchedFields = useCallback((fd, emailValue) => {
    const p = fd?.personalInfo || {};
    const a = fd?.academicInfo || {};
    const fields = [
      p.fullName,
      p.age,
      p.gender,
      p.address,
      p.phone,
      p.whatsapp,
      a.university,
      a.graduationYear,
      emailValue,
    ];
    return fields.filter((val) => String(val ?? '').trim().length > 0).length;
  }, []);

  const countSelectedFiles = useCallback((fObj) => {
    if (!fObj) return 0;
    let total = 0;
    for (const val of Object.values(fObj)) {
      if (Array.isArray(val)) total += val.length;
      else if (val) total += 1;
    }
    return total;
  }, []);

  const buildFunnelPayload = useCallback((event, overrides = {}) => {
    const p = formData?.personalInfo || {};
    const emailVal = normalizeEmail(authenticatedTeacher ? user?.email : credentials.email);
    return {
      event,
      step: overrides.step ?? step,
      touchedFieldsCount: countTouchedFields(formData, emailVal),
      filesSelectedCount: countSelectedFiles(files),
      emailVerified: Boolean(overrides.emailVerified ?? emailVerified),
      fullName: String(p.fullName || '').trim(),
      email: emailVal,
      phone: String(p.phone || '').trim(),
      whatsapp: String(p.whatsapp || '').trim(),
      country: String(p.country || '').trim(),
      gender: ['male', 'female'].includes(p.gender) ? p.gender : '',
      locale,
      lastError: overrides.lastError || '',
    };
  }, [
    authenticatedTeacher,
    countSelectedFiles,
    countTouchedFields,
    credentials.email,
    emailVerified,
    files,
    formData,
    locale,
    step,
    user?.email,
  ]);

  const funnelOpenedRef = useRef(false);
  const lastTrackedStepRef = useRef(1);
  const lastTrackedFilesRef = useRef(0);

  useEffect(() => {
    if (funnelOpenedRef.current || submitted) return;
    funnelOpenedRef.current = true;
    trackTeacherFunnel(buildFunnelPayload('page_open', { step: 1 }));
  }, [buildFunnelPayload, submitted]);

  useEffect(() => {
    if (submitted) return undefined;
    const touched = countTouchedFields(formData, credentials.email);
    if (touched === 0 && step === 1) return undefined;
    const timer = window.setTimeout(() => {
      trackTeacherFunnel(buildFunnelPayload(step > 1 ? `step_${step}` : 'form_started'));
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [buildFunnelPayload, countTouchedFields, credentials.email, formData, step, submitted]);

  useEffect(() => {
    if (submitted || step === lastTrackedStepRef.current) return;
    lastTrackedStepRef.current = step;
    trackTeacherFunnel(buildFunnelPayload(`step_${step}`, { step }));
  }, [buildFunnelPayload, step, submitted]);

  useEffect(() => {
    if (submitted) return;
    const fileCount = countSelectedFiles(files);
    if (fileCount > 0 && fileCount !== lastTrackedFilesRef.current) {
      lastTrackedFilesRef.current = fileCount;
      trackTeacherFunnel(buildFunnelPayload('files_selected'));
    }
  }, [buildFunnelPayload, countSelectedFiles, files, submitted]);

  const update = (section, field, value) => {
    setFieldError('');
    setFormData((p) => ({ ...p, [section]: { ...p[section], [field]: value } }));
  };

  const toggleSpecialization = (specId) => {
    setFieldError('');
    setFormData((p) => {
      const current = Array.isArray(p.quranInfo?.specializations) ? p.quranInfo.specializations : ['tajweed'];
      const exists = current.includes(specId);
      const nextList = exists
        ? (current.length > 1 ? current.filter((item) => item !== specId) : current)
        : [...current, specId];
      return {
        ...p,
        quranInfo: { ...(p.quranInfo || {}), specializations: nextList },
      };
    });
  };

  const toggleLanguage = (langId) => {
    setFieldError('');
    setFormData((p) => {
      const current = Array.isArray(p.languages) ? p.languages : ['arabic'];
      const exists = current.includes(langId);
      const nextList = exists
        ? (current.length > 1 ? current.filter((item) => item !== langId) : current)
        : [...current, langId];
      return {
        ...p,
        languages: nextList,
      };
    });
  };

  const resetSubmittedApplication = () => {
    try {
      sessionStorage.removeItem(STATUS_TOKEN_KEY);
    } catch { /* ignore */ }
    resetTeacherFunnelSessionId();
    funnelOpenedRef.current = false;
    lastTrackedStepRef.current = 1;
    lastTrackedFilesRef.current = 0;
    setSubmitted(false);
    setApplicationStatusToken('');
    setStep(1);
  };

  const setFile = (field, file) => setFiles((p) => ({ ...p, [field]: file }));

  const resetVerification = () => {
    setVerificationCode('');
    setIsCodeSent(false);
    setEmailVerified(false);
    setVerifiedEmail('');
    setVerificationToken('');
  };

  const sendCode = async () => {
    if (sendCodeLock.current) return;
    const email = normalizeEmail(credentials.email);
    if (!emailLooksValid(email)) {
      return toast.error(tr.validation?.invalidEmail || 'أدخل بريدًا إلكترونيًا صحيحًا أولاً');
    }

    sendCodeLock.current = true;
    setSendingCode(true);
    resetVerification();

    try {
      const r = await fetch(apiUrl('/api/auth/send-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || tr.toasts?.codeSendFailed || 'فشل إرسال كود التحقق');
      setIsCodeSent(true);
      trackTeacherFunnel(buildFunnelPayload('otp_sent', { step: 2 }));
      toast.success(tr.toasts?.codeSentSuccess || 'تم إرسال كود التحقق إلى بريدك الإلكتروني');
    } catch (e) {
      toast.error(e.message || tr.toasts?.codeSendFailed || 'فشل إرسال كود التحقق');
    } finally {
      sendCodeLock.current = false;
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (verifyCodeLock.current) return;
    const email = normalizeEmail(credentials.email);
    if (!emailLooksValid(email)) {
      return toast.error(tr.validation?.invalidEmail || 'أدخل بريدًا إلكترونيًا صحيحًا أولاً');
    }
    if (verificationCode.length !== 6) {
      return toast.error(tr.validation?.codeLengthError || 'الكود مكوّن من 6 أرقام');
    }

    verifyCodeLock.current = true;
    setVerifyingCode(true);

    try {
      const r = await fetch(apiUrl('/api/auth/verify-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || tr.toasts?.invalidCode || 'كود غير صحيح');
      if (!data.verificationToken) throw new Error(tr.toasts?.verifyTokenFailed || 'تعذر إنشاء إثبات التحقق');

      setEmailVerified(true);
      setVerifiedEmail(email);
      setVerificationToken(data.verificationToken);
      trackTeacherFunnel(buildFunnelPayload('email_verified', { step: 3, emailVerified: true }));
      toast.success(tr.toasts?.emailVerifiedSuccess || 'تم تأكيد البريد الإلكتروني');
      setStep(3);
    } catch (e) {
      toast.error(e.message || tr.toasts?.invalidCode || 'كود غير صحيح');
    } finally {
      verifyCodeLock.current = false;
      setVerifyingCode(false);
    }
  };

  const validate = (s) => {
    const p = formData.personalInfo;
    const a = formData.academicInfo;
    const val = tr.validation || {};
    switch (s) {
      case 1:
        if (!p.fullName?.trim()) return val.nameRequired || 'الاسم مطلوب';
        if (!p.age || Number(p.age) < 18) return val.ageMin18 || 'العمر 18+';
        if (!['male', 'female'].includes(p.gender)) return val.genderRequired || 'اختر الجنس (معلم / معلمة)';
        if (!p.address?.trim()) return val.addressRequired || 'العنوان مطلوب';
        if (!a.university?.trim()) return val.universityRequired || 'اسم الجامعة / خريج أي مطلوب';
        if (!a.graduationYear) return val.gradYearRequired || 'سنة التخرج مطلوبة';
        if (!p.country) return val.countryRequired || 'اختر الدولة';
        if (!p.phone?.trim()) return val.phoneRequired || 'رقم الهاتف مطلوب';
        return null;
      case 2: {
        const email = normalizeEmail(credentials.email);
        if (!emailLooksValid(email)) return val.invalidEmail || 'أدخل بريدًا إلكترونيًا صحيحًا أولاً';
        if (!emailVerified || !verificationToken || verifiedEmail !== email) {
          return val.emailVerifyFirst || 'يجب تأكيد البريد الإلكتروني أولاً';
        }
        return null;
      }
      case 3:
        if (!credentials.password || credentials.password.length < 8) return val.passwordMin8 || 'كلمة المرور 8+ أحرف';
        if (credentials.password !== credentials.confirmPassword) return val.passwordMismatch || 'كلمتا المرور غير متطابقتين';
        return null;
      case 4: {
        if (!files.profilePhoto) return val.photoRequired || 'ارفع صورة شخصية 4×6';
        if (!files.idCardFront) return val.idFrontRequired || 'ارفع صورة وجه البطاقة الشخصية';
        if (!files.recitationVideos?.length) {
          return val.recitationVideoRequired || 'ارفع فيديو التعريف والتلاوة الأساسي (1–3 دقائق)';
        }
        return validateTeacherFiles(files, tr);
      }
      default:
        return null;
    }
  };

  const next = () => {
    const err = validate(step);
    if (err) { setFieldError(err); toast.error(err); return; }
    setFieldError('');
    if (step < 5) setStep(authenticatedTeacher && step === 1 ? 4 : step + 1);
  };

  const prev = () => { if (step > 1) setStep(authenticatedTeacher && step === 4 ? 1 : step - 1); };

  const submit = async () => {
    if (submissionLock.current) return;
    const err = validate(4);
    if (err) { toast.error(err); return; }

    const verifiedEmailNow = normalizeEmail(authenticatedTeacher ? user.email : credentials.email);
    if (!authenticatedTeacher && (!emailVerified || !verificationToken || verifiedEmail !== verifiedEmailNow)) {
      toast.error(tr.validation?.reverifyEmail || 'يجب إعادة تأكيد البريد الإلكتروني');
      setStep(2);
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    setFieldError('');
    setUploadProgress(null);
    const city = pCity(formData.personalInfo.address);
    let saveTimer;
    let saveTimedOut = false;

    try {
      const scope = authenticatedTeacher ? String(user.id || user._id || user.email) : verificationToken;
      if (completedUploads.current.scope !== scope) {
        completedUploads.current = { scope, files: new Map() };
      }
      const ul = tr.uploadLabels || {};
      const one = (key, purpose, label, enabled = true) => ({
        key, purpose, label, files: enabled && files[key] ? [files[key]] : [],
      });
      const many = (key, purpose, label, enabled = true) => ({
        key, purpose, label, multiple: true, files: enabled ? files[key] || [] : [],
      });
      const hasGradCert = Boolean(files.graduationCertificate);
      const hasTajweedCerts = Boolean(files.tajweedCertificates?.length);
      const hasIjazatCerts = Boolean(files.ijazat?.length);

      const uploadedFiles = await uploadTeacherFiles([
        one('profilePhoto', 'teacher-public', ul.profilePhoto || 'الصورة الشخصية'),
        one('idCardFront', 'teacher-private', ul.idCardFront || 'وجه البطاقة'),
        one('idCardBack', 'teacher-private', ul.idCardBack || 'ظهر البطاقة', Boolean(files.idCardBack)),
        one('graduationCertificate', 'teacher-private', ul.graduationCertificate || 'شهادة التخرج', hasGradCert),
        many('tajweedCertificates', 'teacher-private', ul.tajweedCertificates || 'شهادات التجويد', hasTajweedCerts),
        many('ijazat', 'teacher-private', ul.ijazat || 'الإجازات', hasIjazatCerts),
        one('introductionVideo', 'teacher-public', ul.introductionVideo || 'الفيديو التعريفي', Boolean(files.introductionVideo)),
        { ...many('recitationVideos', 'teacher-public', ul.recitationVideo || 'فيديو التعريف والتلاوة'), key: 'recitationVideo' },
        one('teachingMethodVideo', 'teacher-public', ul.teachingMethodVideo || 'فيديو طريقة التدريس', Boolean(files.teachingMethodVideo)),
      ], {
        upload: (file, purpose, options) => uploadFileDirect(file, purpose, { ...options, verificationToken }),
        cache: completedUploads.current.files,
        onProgress: setUploadProgress,
        maxRetries: 2,
      });
      setUploadProgress({ saving: true });

      const qInfo = formData.quranInfo || {};
      const payload = {
        personalInfo: JSON.stringify({
          ...formData.personalInfo,
          gender: ['male', 'female'].includes(formData.personalInfo.gender) ? formData.personalInfo.gender : 'male',
          age: Number(formData.personalInfo.age),
          city,
          whatsapp: formData.personalInfo.whatsapp || formData.personalInfo.phone,
        }),
        academicInfo: JSON.stringify({
          university: formData.academicInfo.university,
          graduationYear: Number(formData.academicInfo.graduationYear),
          faculty: '—',
          specialization: 'تحفيظ قرآن',
          qualification: 'خريج',
        }),
        quranInfo: JSON.stringify({
          numberOfIjazat: Math.max(0, Number(qInfo.numberOfIjazat) || (hasIjazatCerts ? files.ijazat.length : 0)),
          memorizedParts: Math.min(30, Math.max(1, Number(qInfo.memorizedParts ?? 30))),
          teachingExperience: Math.max(0, Number(qInfo.teachingExperience) || 0),
          specializations: Array.isArray(qInfo.specializations) && qInfo.specializations.length ? qInfo.specializations : ['tajweed'],
        }),
        languages: JSON.stringify(Array.isArray(formData.languages) && formData.languages.length ? formData.languages : ['arabic']),
        availability: JSON.stringify([]),
        email: verifiedEmailNow,
        password: credentials.password,
        verificationToken,
        documentAvailability: {
          graduationCertificate: hasGradCert,
          tajweedCertificates: hasTajweedCerts,
          ijazat: hasIjazatCerts,
        },
        uploadedFiles,
      };

      let activeToken = authenticatedTeacher ? getAccessToken() : '';
      if (authenticatedTeacher) {
        try {
          activeToken = await refreshAccessToken();
        } catch {
          activeToken = getAccessToken() || '';
        }
      }
      const saveController = new AbortController();
      saveTimer = setTimeout(() => { saveTimedOut = true; saveController.abort(); }, 45000);
      const r = await fetch(apiUrl('/api/teachers/register'), {
        signal: saveController.signal,
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(authenticatedTeacher && activeToken ? { Authorization: `Bearer ${activeToken}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.error || tr.toasts?.saveFailed || 'تعذر حفظ طلب المعلم. تواصل مع الإدارة إذا تكرر الخطأ.');
      }
      if (data.success !== true) {
        throw new Error(tr.toasts?.confirmFailed || 'تعذر تأكيد حفظ الطلب من رد الخادم. راجع حالة الطلب مع الإدارة قبل إعادة الإرسال.');
      }
      await clearTeacherDraft(DRAFT_KEY);
      setDraftRestored(false);
      setDraftSaved(false);
      const nextStatus = data.applicationStatus || 'pending';
      const nextToken = data.applicationStatusToken || '';
      setApplicationStatus(nextStatus);
      setApplicationStatusToken(nextToken);
      try {
        if (nextToken) {
          sessionStorage.setItem(STATUS_TOKEN_KEY, JSON.stringify({
            token: nextToken,
            status: nextStatus,
            email: verifiedEmailNow,
          }));
        }
      } catch { /* ignore */ }
      completedUploads.current.files.clear();
      trackTeacherFunnel(buildFunnelPayload('submitted', { step: 5, emailVerified: true }));
      setSubmitted(true);
      toast.success(tr.toasts?.submitSuccess || 'تم إرسال طلبك بنجاح!');
    } catch (e) {
      const message = saveTimedOut || /failed to fetch|network|load failed/i.test(e.message || '')
        ? (tr.toasts?.timeoutAfterUpload || 'اكتمل رفع الملفات لكن تعذر تأكيد حفظ الطلب. تحقق من حالة الطلب مع الإدارة قبل إعادة الإرسال.')
        : e.message;
      trackTeacherFunnel(buildFunnelPayload('submit_error', { lastError: String(message || '').slice(0, 140) }));
      setFieldError(message);
      toast.error(message);
    } finally {
      clearTimeout(saveTimer);
      submissionLock.current = false;
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return {
    step, setStep, submitted, submitting, sendingCode, verifyingCode, checkingStatus,
    uploadProgress, applicationStatus,
    applicationReviewNote, applicationRequestedChanges,
    checkApplicationStatus, resetSubmittedApplication,
    credentials, setCredentials, authenticatedTeacher,
    formData, files, setFile, update, toggleSpecialization, toggleLanguage,
    verificationCode, setVerificationCode, isCodeSent, emailVerified,
    verifiedEmail, fieldError, draftRestored, draftSaved, clearDraft,
    sendCode, verifyCode, resetVerification, next, prev, submit,
  };
}

function pCity(address) {
  const part = address?.split('،')?.[0]?.trim() || address?.split(',')?.[0]?.trim();
  return part || address?.slice(0, 40) || '—';
}
