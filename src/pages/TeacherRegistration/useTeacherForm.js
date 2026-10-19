import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../context/ToastProvider';
import { apiUrl } from '../../config';
import { INITIAL_FORM, DRAFT_KEY } from './constants';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useAuth } from '../../hooks/useAuth.jsx';
import { uploadTeacherFiles } from '../../lib/teacherUploadQueue.mjs';
import { getAccessToken } from '../../lib/authSession';

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
const FILE_RULES = {
  publicImage: {
    types: ['image/jpeg', 'image/png'],
    extensions: ['.jpg', '.jpeg', '.jfif', '.png'],
    maxBytes: 100 * MB,
    label: 'الصورة الشخصية',
  },
  privateDocument: {
    types: ['image/jpeg', 'image/png', 'application/pdf'],
    extensions: ['.jpg', '.jpeg', '.jfif', '.png', '.pdf'],
    maxBytes: 25 * MB,
    label: 'المستند',
  },
  recitationVideo: {
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov'],
    maxBytes: 100 * MB,
    label: 'فيديو التلاوة',
  },
};

function fileExtension(name = '') {
  const value = String(name || '');
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(index).toLowerCase() : '';
}

function validateSelectedFile(file, rule) {
  if (!file) return null;
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    return `${rule.label}: الملف فارغ أو غير صالح`;
  }
  if (Number(file.size) > rule.maxBytes) {
    return `${rule.label}: الحد الأقصى ${Math.round(rule.maxBytes / MB)} MB لكل ملف`;
  }
  if (!rule.types.includes(String(file.type || '').toLowerCase())) {
    return `${rule.label}: نوع الملف غير مدعوم`;
  }
  if (!rule.extensions.includes(fileExtension(file.name))) {
    return `${rule.label}: امتداد الملف غير مدعوم`;
  }
  return null;
}

function validateTeacherFiles(files) {
  const checks = [
    [files.profilePhoto, FILE_RULES.publicImage],
    [files.idCardFront, FILE_RULES.privateDocument],
    [files.idCardBack, FILE_RULES.privateDocument],
    [files.graduationCertificate, FILE_RULES.privateDocument],
    ...((files.tajweedCertificates || []).map((file) => [file, FILE_RULES.privateDocument])),
    ...((files.ijazat || []).map((file) => [file, FILE_RULES.privateDocument])),
    [files.introductionVideo, FILE_RULES.recitationVideo],
    ...((files.recitationVideos || []).map((file) => [file, FILE_RULES.recitationVideo])),
    [files.teachingMethodVideo, FILE_RULES.recitationVideo],
  ];

  for (const [file, rule] of checks) {
    const error = validateSelectedFile(file, rule);
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
    return 'استخدم ثلاثة ملفات مختلفة: فيديو التعريف، فيديو التلاوة، وفيديو طريقة التدريس.';
  }

  return null;
}

export function useTeacherForm() {
  const toast = useToast();
  const { user } = useAuth();
  const authenticatedTeacher = user?.role === 'teacher';
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const submissionLock = useRef(false);
  const completedUploads = useRef({ scope: '', files: new Map() });
  const [applicationStatus, setApplicationStatus] = useState('pending');
  const [applicationStatusToken, setApplicationStatusToken] = useState('');
  const [credentials, setCredentials] = useState({ email: '', password: '', confirmPassword: '' });
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [files, setFiles] = useState(emptyFiles);
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.formData) setFormData(d.formData);
      if (d.credentials) setCredentials((p) => ({ ...p, email: d.credentials.email || '' }));
      if (d.step) setStep(d.step);
      // Verification proof is intentionally never restored from localStorage.
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!authenticatedTeacher) return;
    setCredentials(p => ({ ...p, email: user.email }));
    setFormData(p => ({ ...p, personalInfo: { ...p.personalInfo, fullName: p.personalInfo.fullName || user.name, phone: p.personalInfo.phone || user.phone || '' } }));
  }, [authenticatedTeacher, user?.email, user?.name, user?.phone]);

  const checkApplicationStatus = useCallback(async () => {
    if (!submitted || !applicationStatusToken) return;
    try {
      const r = await fetch(apiUrl('/api/teachers/application-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: applicationStatusToken }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return;
      setApplicationStatus(data.applicationStatus || 'pending');
    } catch {
      // Keep the waiting screen stable if connectivity is temporary.
    }
  }, [submitted, applicationStatusToken]);

  useEffect(() => {
    if (!submitted || !applicationStatusToken) return undefined;

    checkApplicationStatus();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') checkApplicationStatus();
    }, 10000);

    const onFocus = () => checkApplicationStatus();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkApplicationStatus();
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
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      formData, credentials: { email: credentials.email }, step,
    }));
  }, [formData, credentials.email, step]);

  useEffect(() => {
    const t = setTimeout(saveDraft, 500);
    return () => clearTimeout(t);
  }, [saveDraft]);

  const update = (section, field, value) => {
    setFieldError('');
    setFormData((p) => ({ ...p, [section]: { ...p[section], [field]: value } }));
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
    const email = normalizeEmail(credentials.email);
    if (!emailLooksValid(email)) return toast.error('أدخل بريدًا إلكترونيًا صحيحًا أولاً');

    resetVerification();

    try {
      const r = await fetch(apiUrl('/api/auth/send-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'فشل إرسال كود التحقق');
      setIsCodeSent(true);
      toast.success('تم إرسال كود التحقق إلى بريدك الإلكتروني');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const verifyCode = async () => {
    const email = normalizeEmail(credentials.email);
    if (!emailLooksValid(email)) return toast.error('أدخل بريدًا إلكترونيًا صحيحًا');
    if (verificationCode.length !== 6) return toast.error('الكود مكوّن من 6 أرقام');

    try {
      const r = await fetch(apiUrl('/api/auth/verify-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'كود غير صحيح');
      if (!data.verificationToken) throw new Error('تعذر إنشاء إثبات التحقق');

      setEmailVerified(true);
      setVerifiedEmail(email);
      setVerificationToken(data.verificationToken);
      toast.success('تم تأكيد البريد الإلكتروني');
      setStep(3);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const validate = (s) => {
    const p = formData.personalInfo;
    const a = formData.academicInfo;
    switch (s) {
      case 1:
        if (!p.fullName?.trim()) return 'الاسم مطلوب';
        if (!p.age || Number(p.age) < 18) return 'العمر 18+';
        if (!p.address?.trim()) return 'العنوان مطلوب';
        if (!a.university?.trim()) return 'اسم الجامعة / خريج أي مطلوب';
        if (!a.graduationYear) return 'سنة التخرج مطلوبة';
        if (!p.country) return 'اختر الدولة';
        if (!p.phone?.trim()) return 'رقم الهاتف مطلوب';
        return null;
      case 2: {
        const email = normalizeEmail(credentials.email);
        if (!emailLooksValid(email)) return 'أدخل بريدًا إلكترونيًا صحيحًا';
        if (!emailVerified || !verificationToken || verifiedEmail !== email) {
          return 'يجب تأكيد البريد الإلكتروني أولاً';
        }
        return null;
      }
      case 3:
        if (!credentials.password || credentials.password.length < 8) return 'كلمة المرور 8+ أحرف';
        if (credentials.password !== credentials.confirmPassword) return 'كلمتا المرور غير متطابقتين';
        return null;
      case 4: {
        const docs = formData.documentAvailability || {};
        if (!files.profilePhoto) return 'ارفع صورة شخصية 4×6';
        if (!files.idCardFront) return 'ارفع صورة وجه البطاقة الشخصية';
        if (!files.idCardBack) return 'ارفع صورة ظهر البطاقة الشخصية';
        if (!files.introductionVideo) return 'ارفع فيديو تعريفي قصير';
        if (!files.recitationVideos?.length) return 'ارفع فيديو تلاوة واحد على الأقل';
        if (!files.teachingMethodVideo) return 'ارفع فيديو يوضح طريقة التدريس';

        if (typeof docs.graduationCertificate !== 'boolean') {
          return 'حدد هل شهادة التخرج موجودة أم غير موجودة';
        }
        if (docs.graduationCertificate && !files.graduationCertificate) {
          return 'ارفع شهادة التخرج لأنك اخترت أنها موجودة';
        }

        if (typeof docs.tajweedCertificates !== 'boolean') {
          return 'حدد هل شهادات التجويد موجودة أم غير موجودة';
        }
        if (docs.tajweedCertificates && !files.tajweedCertificates?.length) {
          return 'ارفع شهادة تجويد واحدة على الأقل';
        }

        if (typeof docs.ijazat !== 'boolean') {
          return 'حدد هل لديك إجازات أم لا';
        }
        if (docs.ijazat && !files.ijazat?.length) {
          return 'ارفع إجازة واحدة على الأقل';
        }

        return validateTeacherFiles(files);
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
      toast.error('يجب إعادة تأكيد البريد الإلكتروني');
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
    let filesUploaded = false;

    try {
      const scope = authenticatedTeacher ? String(user.id || user._id || user.email) : verifiedEmailNow;
      if (completedUploads.current.scope !== scope) {
        completedUploads.current = { scope, files: new Map() };
      }
      const one = (key, purpose, label, enabled = true) => ({
        key, purpose, label, files: enabled && files[key] ? [files[key]] : [],
      });
      const many = (key, purpose, label, enabled = true) => ({
        key, purpose, label, multiple: true, files: enabled ? files[key] || [] : [],
      });
      const uploadedFiles = await uploadTeacherFiles([
        one('profilePhoto', 'teacher-public', 'الصورة الشخصية'),
        one('idCardFront', 'teacher-private', 'وجه البطاقة'),
        one('idCardBack', 'teacher-private', 'ظهر البطاقة'),
        one('graduationCertificate', 'teacher-private', 'شهادة التخرج', formData.documentAvailability.graduationCertificate),
        many('tajweedCertificates', 'teacher-private', 'شهادات التجويد', formData.documentAvailability.tajweedCertificates),
        many('ijazat', 'teacher-private', 'الإجازات', formData.documentAvailability.ijazat),
        one('introductionVideo', 'teacher-public', 'الفيديو التعريفي'),
        { ...many('recitationVideos', 'teacher-public', 'فيديو التلاوة'), key: 'recitationVideo' },
        one('teachingMethodVideo', 'teacher-public', 'فيديو طريقة التدريس'),
      ], {
        upload: (file, purpose, options) => uploadFileDirect(file, purpose, { ...options, verificationToken }),
        cache: completedUploads.current.files,
        onProgress: setUploadProgress,
      });
      filesUploaded = true;
      setUploadProgress({ saving: true });

      const payload = {
        personalInfo: JSON.stringify({
          ...formData.personalInfo,
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
          numberOfIjazat: 0,
          memorizedParts: 30,
          teachingExperience: 0,
          specializations: ['tajweed'],
        }),
        languages: JSON.stringify(['arabic']),
        availability: JSON.stringify([]),
        email: verifiedEmailNow,
        password: credentials.password,
        verificationToken,
        documentAvailability: {
          graduationCertificate: formData.documentAvailability.graduationCertificate,
          tajweedCertificates: formData.documentAvailability.tajweedCertificates,
          ijazat: formData.documentAvailability.ijazat,
        },
        uploadedFiles,
      };

      const saveController = new AbortController();
      saveTimer = setTimeout(() => { saveTimedOut = true; saveController.abort(); }, 45000);
      const r = await fetch(apiUrl('/api/teachers/register'), {
        signal: saveController.signal,
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(authenticatedTeacher ? { Authorization: `Bearer ${getAccessToken()}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'تعذر حفظ طلب المعلم. تواصل مع الإدارة إذا تكرر الخطأ.');
      if (data.success !== true) {
        throw new Error('تعذر تأكيد حفظ الطلب من رد الخادم. راجع حالة الطلب مع الإدارة قبل إعادة الإرسال.');
      }
      localStorage.removeItem(DRAFT_KEY);
      setApplicationStatus(data.applicationStatus || 'pending');
      setApplicationStatusToken(data.applicationStatusToken || '');
      completedUploads.current.files.clear();
      setSubmitted(true);
      toast.success('تم إرسال طلبك بنجاح!');
    } catch (e) {
      const message = saveTimedOut || (filesUploaded && /failed to fetch|network|load failed/i.test(e.message || ''))
        ? 'اكتمل رفع الملفات لكن تعذر تأكيد حفظ الطلب. تحقق من حالة الطلب مع الإدارة قبل إعادة الإرسال.'
        : e.message;
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
    step, setStep, submitted, submitting, uploadProgress, applicationStatus, checkApplicationStatus, credentials, setCredentials, authenticatedTeacher,
    formData, files, setFile, update,
    verificationCode, setVerificationCode, isCodeSent, emailVerified,
    verifiedEmail, fieldError,
    sendCode, verifyCode, resetVerification, next, prev, submit,
  };
}

function pCity(address) {
  const part = address?.split('،')?.[0]?.trim();
  return part || address?.slice(0, 40) || '—';
}