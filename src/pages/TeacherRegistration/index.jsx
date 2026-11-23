import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info, Lock, Mail, Eye, EyeOff, ArrowLeft, ArrowRight,
  CheckCircle2, Clock, Shield, Video, AlertTriangle, Loader2, ChevronDown, ChevronUp, RotateCcw,
  KeyRound, MessageCircle,
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useTeacherForm } from './useTeacherForm';
import StepProgress from './StepProgress';
import FileBox from './FileBox';
import {
  STEPS, COUNTRY_OPTIONS, VIDEO_GUIDE_KEYS,
  SPECIALIZATION_OPTIONS, LANGUAGE_OPTIONS, countryLabel,
} from './constants';
import '../../styles/public-experience.css';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import { apiUrl } from '../../config';
import { SOCIAL_LINKS } from '../../config/social';

const inputCls = 'input-field w-full';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

function ProfilePhotoPreview({ file, alt }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!previewUrl) return null;
  return <img src={previewUrl} alt={alt} className="h-32 rounded-lg object-cover" />;
}

function inviteBlockCopy(code, isRTL) {
  switch (code) {
    case 'INVITE_EXPIRED':
      return {
        title: isRTL ? 'انتهت صلاحية رابط الدعوة المؤقت' : 'Temporary Invitation Link Expired',
        desc: isRTL
          ? 'انتهت المدة المحددة لهذا الرابط. يُرجى التواصل مع إدارة الأكاديمية للحصول على رابط تسجيل مؤقت جديد.'
          : 'This temporary link has expired. Please contact academy administration for a fresh invitation link.',
      };
    case 'INVITE_EXHAUSTED':
      return {
        title: isRTL ? 'تم استخدام رابط الدعوة بالكامل' : 'Invitation Link Already Used',
        desc: isRTL
          ? 'بلغ هذا الرابط الحد الأقصى للاستخدام ولا يمكن التسجيل به مرة أخرى. تواصل مع الإدارة لطلب رابط جديد.'
          : 'This invitation link has reached its usage limit. Please request a new temporary link from administration.',
      };
    case 'INVITE_REVOKED':
      return {
        title: isRTL ? 'تم إلغاء رابط الدعوة من الإدارة' : 'Invitation Link Revoked',
        desc: isRTL
          ? 'أوقفت الإدارة صلاحية هذا الرابط. للتقديم كمعلم أو معلمة، يُرجى طلب رابط دعوة جديد عبر واتساب.'
          : 'This link was revoked by administration. Please contact us on WhatsApp to request a new link.',
      };
    case 'INVITE_IP_MISMATCH':
      return {
        title: isRTL ? 'هذا الرابط مرتبط بشبكة/جهاز آخر' : 'Link Locked to Another Network',
        desc: isRTL
          ? 'هذا الرابط المؤقت مخصّص لشخص واحد فقط وقد تم تفعيله بالفعل من عنوان IP مختلف، ولا يمكن مشاركته. إذا كنت أنت المتقدم وتغيّرت شبكتك أو أردت رابطاً خاصاً بك، تواصل مع الإدارة عبر واتساب.'
          : 'This temporary invitation link is locked to a different IP address and cannot be shared. Please contact administration on WhatsApp if you need a fresh link or network reset.',
      };
    case 'INVITE_INVALID':
      return {
        title: isRTL ? 'رابط الدعوة غير صالح' : 'Invalid Invitation Link',
        desc: isRTL
          ? 'تأكد من نسخ الرابط كاملاً كما أرسلته الإدارة، أو اطلب رابط دعوة مؤقت جديد.'
          : 'Please make sure you copied the complete link sent by administration, or request a new temporary link.',
      };
    default:
      return {
        title: isRTL ? 'التسجيل متاح عبر رابط دعوة مؤقت فقط' : 'Invite-Only Teacher Registration',
        desc: isRTL
          ? 'لا يوجد رابط دائم مفتوح لتسجيل المعلمين. للانضمام لهيئة التدريس في أكاديمية وَحْيٌ وَنَمَاء، يُرجى التواصل مع الإدارة للحصول على رابط دعوة مؤقت.'
          : 'Public permanent teacher registration is disabled. To apply as a Quran teacher at Wahy Wa Namaa Academy, please request a temporary invitation link from administration.',
      };
  }
}

export default function TeacherRegistration() {
  const { locale, dir, isRTL, t } = useI18n();
  const tr = t?.teacherRegistration || {};
  const intlLocale = resolveIntlLocale(locale);
  const [searchParams] = useSearchParams();
  const inviteToken = (searchParams.get('invite') || searchParams.get('token') || '').trim();
  const [showPass, setShowPass] = useState(false);
  const [showOptionalUploads, setShowOptionalUploads] = useState(false);
  const f = useTeacherForm({ inviteToken });
  const [inviteState, setInviteState] = useState(() => ({
    status: inviteToken ? 'checking' : 'blocked',
    code: inviteToken ? '' : 'INVITE_REQUIRED',
    invite: null,
  }));

  useEffect(() => {
    if (f.authenticatedTeacher || f.submitted) return undefined;
    if (!inviteToken) {
      setInviteState({ status: 'blocked', code: 'INVITE_REQUIRED', invite: null });
      return undefined;
    }

    let cancelled = false;
    setInviteState({ status: 'checking', code: '', invite: null });

    fetch(`${apiUrl('/api/teachers/invite-status')}?token=${encodeURIComponent(inviteToken)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.valid) {
          setInviteState({ status: 'valid', code: 'INVITE_VALID', invite: data.invite || null });
        } else {
          setInviteState({ status: 'blocked', code: data?.code || 'INVITE_INVALID', invite: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInviteState({ status: 'blocked', code: 'INVITE_INVALID', invite: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inviteToken, f.authenticatedTeacher, f.submitted]);

  const PrevIcon = isRTL ? ArrowRight : ArrowLeft;
  const NextIcon = isRTL ? ArrowLeft : ArrowRight;

  if (f.submitted) {
    const approved = f.applicationStatus === 'approved';
    const underReview = f.applicationStatus === 'under-review';
    const rejected = f.applicationStatus === 'rejected';
    const hasRequestedChanges = (f.applicationRequestedChanges || []).length > 0;
    const sub = tr.submitted || {};
    const pollingText = sub.descPolling || 'تتحدث هذه الصفحة تلقائيًا كل عدة ثوانٍ. سنرسل تحديث الحالة أيضًا إلى {email}.';
    const [pollingBefore, pollingAfter] = pollingText.split('{email}');

    return (
      <>
        <GlobalHeader />
        <div className="wn-teacher-register-shell min-h-screen flex items-center justify-center p-4" dir={dir}>
          <div className="wn-teacher-register-card max-w-lg w-full text-center p-5 sm:p-10">
            <CheckCircle2
              className={`mx-auto mb-4 ${
                approved
                  ? 'text-[var(--wn-emerald)]'
                  : rejected
                    ? 'text-[var(--wn-text-danger)]'
                    : 'text-[var(--wn-warning)]'
              }`}
              size={64}
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold text-[var(--wn-heading)] mb-2">
              {approved
                ? (sub.titleApproved || 'تم قبولك كمعلم ✅')
                : rejected
                  ? (sub.titleRejected || 'تم تحديث حالة طلبك')
                  : (sub.titleReceived || 'تم استلام طلبك ✅')}
            </h1>

            <div className={`rounded-xl border p-4 mb-6 ${
              approved
                ? 'border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                : rejected
                  ? 'border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]'
                  : 'border-[var(--wn-gold)]/40 bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]'
            }`}>
              <p className="font-bold mb-1">
                {approved
                  ? (sub.headlineApproved || 'وافقت الإدارة على طلبك ويمكنك الدخول الآن')
                  : rejected
                    ? (sub.headlineRejected || 'تعذر اعتماد الطلب في الوقت الحالي')
                    : underReview
                      ? (hasRequestedChanges
                          ? (sub.headlineChanges || 'طلبت الإدارة استكمال بعض المرفقات أو البيانات')
                          : (sub.headlineUnderReview || 'طلبك قيد المراجعة ويحتاج متابعة الإدارة'))
                      : (sub.headlinePending || 'طلبك الآن في انتظار موافقة الإدارة')}
              </p>
              <p className="text-sm">
                {approved
                  ? (sub.descApproved || 'تم تحديث الحالة تلقائيًا بدون الحاجة لعمل Refresh. استخدم نفس البريد وكلمة المرور للدخول.')
                  : rejected
                    ? (sub.descRejected || 'راجع ملاحظة الإدارة أدناه أو تواصل مع إدارة الأكاديمية لمعرفة الخطوة التالية.')
                    : (
                      <>
                        {pollingBefore}
                        <strong dir="ltr">{f.credentials.email}</strong>
                        {pollingAfter}
                      </>
                    )}
              </p>

              {f.applicationReviewNote ? (
                <div className="mt-3 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-border)] p-3 text-start text-sm text-[var(--wn-text-primary)]">
                  <strong className="block mb-1">{sub.adminNoteLabel || 'ملاحظة الإدارة:'}</strong>
                  <p>{f.applicationReviewNote}</p>
                </div>
              ) : null}

              {hasRequestedChanges ? (
                <div className="mt-3 rounded-lg bg-[var(--wn-surface)] border border-[var(--wn-gold)]/40 p-3 text-start text-sm text-[var(--wn-text-primary)]">
                  <strong className="flex items-center gap-1.5 text-[var(--wn-badge-gold-text)] mb-1.5">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>{sub.requestedChangesLabel || 'بنود مطلوبة للاستكمال:'}</span>
                  </strong>
                  <ul className="space-y-1 text-xs text-[var(--wn-text-secondary)]">
                    {f.applicationRequestedChanges.map((item) => (
                      <li key={item.key}>
                        • <strong>{item.label}:</strong> {item.note || sub.defaultChangeNote || 'يرجى المراجعة وإعادة الرفع'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {!approved && !rejected && (
              <button
                type="button"
                onClick={() => f.checkApplicationStatus(true)}
                disabled={f.checkingStatus}
                className="btn-secondary w-full min-h-[44px] mb-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {f.checkingStatus && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                <span>
                  {f.checkingStatus
                    ? (sub.refreshingStatusBtn || 'جاري تحديث الحالة…')
                    : (sub.refreshStatusBtn || 'تحديث الحالة الآن')}
                </span>
              </button>
            )}

            <div className="flex flex-col gap-3">
              <Link to={localizedPath('/login', locale)} className="btn-primary min-h-[44px]">
                {approved
                  ? (sub.goDashboardBtn || 'الدخول إلى لوحة المعلم')
                  : (sub.loginFollowupBtn || 'تسجيل الدخول لمتابعة أو تعديل الطلب')}
              </Link>
              {(underReview || rejected) && (
                <button
                  type="button"
                  onClick={f.resetSubmittedApplication}
                  className="btn-secondary min-h-[44px]"
                >
                  {sub.editResubmitBtn || 'تعديل البيانات وإعادة رفع الملفات'}
                </button>
              )}
              <Link to={localizedPath('/', locale)} className="btn-secondary min-h-[44px]">
                {sub.backHomeBtn || 'العودة للرئيسية'}
              </Link>
            </div>
          </div>
        </div>
        <GlobalFooter />
      </>
    );
  }

  if (!f.authenticatedTeacher && inviteState.status === 'checking') {
    return (
      <>
        <SEOHead
          page={{
            title: tr.seo?.title || 'تسجيل معلم',
            description: tr.seo?.description || 'انضم كمعلم قرآن في أكاديمية وَحْيٌ وَنَمَاء',
            url: '/register/teacher',
            noindex: true,
          }}
        />
        <GlobalHeader />
        <div className="wn-teacher-register-shell min-h-screen flex items-center justify-center p-4" dir={dir}>
          <div className="wn-teacher-register-card max-w-md w-full text-center p-8 space-y-3">
            <Loader2 size={40} className="mx-auto animate-spin text-[var(--wn-emerald)]" aria-hidden="true" />
            <h1 className="text-lg font-bold text-[var(--wn-heading)]">
              {isRTL ? 'جارٍ التحقق من رابط الدعوة المؤقت...' : 'Verifying temporary invitation link...'}
            </h1>
          </div>
        </div>
        <GlobalFooter />
      </>
    );
  }

  if (!f.authenticatedTeacher && inviteState.status !== 'valid') {
    const blocked = inviteBlockCopy(inviteState.code, isRTL);
    const whatsappHref = SOCIAL_LINKS.whatsapp || 'https://wa.me/201557891330';
    return (
      <>
        <SEOHead
          page={{
            title: tr.seo?.title || 'تسجيل معلم',
            description: tr.seo?.description || 'انضم كمعلم قرآن في أكاديمية وَحْيٌ وَنَمَاء',
            url: '/register/teacher',
            noindex: true,
          }}
        />
        <GlobalHeader />
        <div className="wn-teacher-register-shell min-h-screen flex items-center justify-center p-4" dir={dir}>
          <div className="wn-teacher-register-card max-w-lg w-full text-center p-6 sm:p-10 space-y-5">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--wn-gold-soft)] border border-[var(--wn-border-strong)] flex items-center justify-center text-[var(--wn-badge-gold-text)]">
              <KeyRound size={32} aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[var(--wn-heading)]">{blocked.title}</h1>
              <p className="text-sm text-[var(--wn-text-secondary)] leading-relaxed">{blocked.desc}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2"
              >
                <MessageCircle size={18} aria-hidden="true" />
                <span>{isRTL ? 'طلب رابط دعوة عبر واتساب' : 'Request invite via WhatsApp'}</span>
              </a>
              <Link to={localizedPath('/', locale)} className="btn-secondary min-h-[44px] inline-flex items-center">
                {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
              </Link>
            </div>
          </div>
        </div>
        <GlobalFooter />
      </>
    );
  }

  const stepMeta = STEPS.find((s) => s.id === f.step);
  const stepTitle = (stepMeta && tr.steps?.[stepMeta.fullKey]) || stepMeta?.fullTitle;
  const s1 = tr.step1 || {};
  const s2 = tr.step2 || {};
  const s3 = tr.step3 || {};
  const s4 = tr.step4 || {};
  const s5 = tr.step5 || {};
  const hdr = tr.header || {};
  const nav = tr.nav || {};

  return (
    <>
      <SEOHead
        page={{
          title: tr.seo?.title || 'تسجيل معلم',
          description: tr.seo?.description || 'انضم كمعلم قرآن في أكاديمية وَحْيٌ وَنَمَاء',
          url: '/register/teacher',
          noindex: true,
        }}
      />
      <GlobalHeader />

      <div className="wn-teacher-register-shell min-h-screen py-10" dir={dir}>
        <div className="page-container max-w-3xl">
          <div className="text-center mb-8">
            <span className="section-label mb-4">{hdr.eyebrow || 'انضم لفريق المعلمين'}</span>
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--wn-heading)] mt-3">
              {hdr.title || 'سجّل كمعلم قرآن'}
            </h1>
            <p className="text-[var(--wn-text-secondary)] mt-2">
              {hdr.subtitle || '5 خطوات واضحة لإكمال ملف التقديم'}
            </p>
          </div>

          {!f.authenticatedTeacher && inviteState.invite ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] px-4 py-2.5 text-xs text-[var(--wn-badge-gold-text)]">
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-2 font-bold">
                  <KeyRound size={15} className="shrink-0" aria-hidden="true" />
                  <span>
                    {isRTL ? 'رابط دعوة مؤقت صالح من الإدارة' : 'Valid temporary invitation link'}
                    {inviteState.invite.label ? ` — ${inviteState.invite.label}` : ''}
                  </span>
                </span>
                {inviteState.invite.lockToFirstIp ? (
                  <p className="text-xs font-medium opacity-90">
                    {isRTL
                      ? 'الرابط مربوط بشبكتك الحالية فقط — يمكنك الخروج والعودة لإكمال التسجيل من نفس الإنترنت طوال مدة الصلاحية.'
                      : 'This link is locked to your current network — you may leave and resume from the same IP until expiry.'}
                  </p>
                ) : null}
              </div>
              {inviteState.invite.expiresAt ? (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Clock size={13} aria-hidden="true" />
                  <span>
                    {isRTL ? 'ينتهي في: ' : 'Expires: '}
                    {new Date(inviteState.invite.expiresAt).toLocaleString(intlLocale)}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          <StepProgress current={f.step} />

          {(f.draftSaved || f.draftRestored) && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] px-4 py-2.5 text-xs text-[var(--wn-badge-emerald-text)]">
              <span className="inline-flex items-center gap-2 font-semibold">
                <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />
                <span>
                  {f.draftRestored
                    ? (isRTL
                      ? 'تم استرجاع بياناتك وملفاتك المحفوظة تلقائياً — يمكنك الإكمال من حيث توقفت'
                      : 'Your saved form data and files were restored automatically — continue where you left off')
                    : (isRTL
                      ? 'يتم حفظ بياناتك وملفاتك تلقائياً على جهازك — لن يضيع شيء لو انقطع الإنترنت'
                      : 'Your progress and files are auto-saved locally — nothing is lost if the connection drops')}
                </span>
              </span>
              <button
                type="button"
                onClick={f.clearDraft}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-2.5 py-1 text-xs font-bold text-[var(--wn-heading)] hover:bg-[var(--wn-surface-soft)]"
              >
                <RotateCcw size={13} aria-hidden="true" />
                <span>{isRTL ? 'البدء من جديد' : 'Start fresh'}</span>
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={f.step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="wn-teacher-register-card p-5 sm:p-8"
            >
              <h2 className="text-xl font-bold text-[var(--wn-heading)] mb-1">{stepTitle}</h2>
              {f.fieldError && (
                <p
                  role="alert"
                  className="text-[var(--wn-text-danger)] text-sm bg-[var(--wn-danger-soft)] border border-[var(--wn-danger)]/30 rounded-lg px-3 py-2 mb-4"
                >
                  {f.fieldError}
                </p>
              )}

              {f.step === 1 && (
                <div className="space-y-5">
                  <div className="flex gap-2 p-3 bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] rounded-xl text-sm text-[var(--wn-badge-emerald-text)]">
                    <Info size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{s1.infoNotice || 'أدخل بياناتك الأساسية والقرآنية بدقة — سيتم تأكيد البريد الإلكتروني في الخطوة التالية'}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field htmlFor="reg-full-name" label={s1.fullNameLabel || 'الاسم الكامل *'}>
                      <input
                        id="reg-full-name"
                        className={inputCls}
                        value={f.formData.personalInfo.fullName}
                        onChange={(e) => f.update('personalInfo', 'fullName', e.target.value)}
                        placeholder={s1.fullNamePlaceholder || 'الاسم رباعي'}
                      />
                    </Field>
                    <Field htmlFor="reg-gender" label={s1.genderLabel || 'النوع (القسم التعليمي) *'}>
                      <select
                        id="reg-gender"
                        className={inputCls}
                        value={f.formData.personalInfo.gender || 'male'}
                        onChange={(e) => f.update('personalInfo', 'gender', e.target.value)}
                      >
                        <option value="male">{s1.genderMale || 'معلم (حلقات الرجال والبنين)'}</option>
                        <option value="female">{s1.genderFemale || 'معلمة (قسم السيدات والفتيات والأطفال)'}</option>
                      </select>
                    </Field>
                    <Field htmlFor="reg-age" label={s1.ageLabel || 'السن *'}>
                      <input
                        id="reg-age"
                        type="number"
                        min={18}
                        max={80}
                        className={inputCls}
                        value={f.formData.personalInfo.age}
                        onChange={(e) => f.update('personalInfo', 'age', e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="reg-address" label={s1.addressLabel || 'العنوان *'}>
                      <input
                        id="reg-address"
                        className={inputCls}
                        value={f.formData.personalInfo.address}
                        onChange={(e) => f.update('personalInfo', 'address', e.target.value)}
                        placeholder={s1.addressPlaceholder || 'المدينة، الشارع...'}
                      />
                    </Field>
                    <Field htmlFor="reg-university" label={s1.universityLabel || 'خريج أي (الجامعة / المعهد) *'}>
                      <input
                        id="reg-university"
                        className={inputCls}
                        value={f.formData.academicInfo.university}
                        onChange={(e) => f.update('academicInfo', 'university', e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="reg-grad-year" label={s1.graduationYearLabel || 'سنة التخرج *'}>
                      <input
                        id="reg-grad-year"
                        type="number"
                        className={inputCls}
                        value={f.formData.academicInfo.graduationYear}
                        onChange={(e) => f.update('academicInfo', 'graduationYear', e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="reg-country" label={s1.countryLabel || 'البلد *'}>
                      <select
                        id="reg-country"
                        className={inputCls}
                        value={f.formData.personalInfo.country}
                        onChange={(e) => f.update('personalInfo', 'country', e.target.value)}
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.value}>
                            {tr.countries?.[c.code] || c.value}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field htmlFor="reg-phone" label={s1.phoneLabel || 'رقم التليفون *'}>
                      <input
                        id="reg-phone"
                        type="tel"
                        dir="ltr"
                        className={inputCls}
                        placeholder={s1.phonePlaceholder || '+2010XXXXXXXX'}
                        value={f.formData.personalInfo.phone}
                        onChange={(e) => f.update('personalInfo', 'phone', e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="reg-whatsapp" label={s1.whatsappLabel || 'واتساب (اختياري للتواصل)'}>
                      <input
                        id="reg-whatsapp"
                        type="tel"
                        dir="ltr"
                        className={inputCls}
                        placeholder={s1.whatsappPlaceholder || 'نفس الرقم أو مختلف'}
                        value={f.formData.personalInfo.whatsapp}
                        onChange={(e) => f.update('personalInfo', 'whatsapp', e.target.value)}
                      />
                    </Field>
                    <Field htmlFor="reg-telegram" label={s1.telegramLabel || 'تليجرام (اختياري)'}>
                      <input
                        id="reg-telegram"
                        dir="ltr"
                        className={inputCls}
                        placeholder={s1.telegramPlaceholder || '@username'}
                        value={f.formData.personalInfo.telegram}
                        onChange={(e) => f.update('personalInfo', 'telegram', e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="border-t border-[var(--wn-border)] pt-4 space-y-4">
                    <p className="font-semibold text-[var(--wn-heading)]">
                      {s1.quranSectionTitle || 'الخبرة القرآنية والتخصصات'}
                    </p>
                    <div className="grid md:grid-cols-3 gap-4">
                      <Field htmlFor="reg-exp-years" label={s1.experienceYears || 'سنوات الخبرة في التحفيظ'}>
                        <input
                          id="reg-exp-years"
                          type="number"
                          min={0}
                          max={60}
                          className={inputCls}
                          value={f.formData.quranInfo?.teachingExperience ?? 0}
                          onChange={(e) => f.update('quranInfo', 'teachingExperience', e.target.value)}
                        />
                      </Field>
                      <Field htmlFor="reg-mem-parts" label={s1.memorizedParts || 'عدد الأجزاء المحفوظة'}>
                        <input
                          id="reg-mem-parts"
                          type="number"
                          min={1}
                          max={30}
                          className={inputCls}
                          value={f.formData.quranInfo?.memorizedParts ?? 30}
                          onChange={(e) => f.update('quranInfo', 'memorizedParts', e.target.value)}
                        />
                      </Field>
                      <Field htmlFor="reg-ijazat-count" label={s1.ijazatCount || 'عدد الإجازات القرآنية'}>
                        <input
                          id="reg-ijazat-count"
                          type="number"
                          min={0}
                          max={20}
                          className={inputCls}
                          value={f.formData.quranInfo?.numberOfIjazat ?? 0}
                          onChange={(e) => f.update('quranInfo', 'numberOfIjazat', e.target.value)}
                        />
                      </Field>
                    </div>

                    <div>
                      <p className="block text-sm font-medium text-[var(--wn-text-primary)] mb-2">
                        {s1.specializationsLabel || 'المسارات والتخصصات المتقنة (اختر واحدًا أو أكثر)'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SPECIALIZATION_OPTIONS.map((opt) => {
                          const active = (f.formData.quranInfo?.specializations || ['tajweed']).includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => f.toggleSpecialization(opt.id)}
                              className={`min-h-[44px] inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${
                                active
                                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                                  : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                              }`}
                            >
                              {tr.specializations?.[opt.id] || opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="block text-sm font-medium text-[var(--wn-text-primary)] mb-2">
                        {s1.languagesLabel || 'لغات التدريس المتاحة'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map((opt) => {
                          const active = (f.formData.languages || ['arabic']).includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => f.toggleLanguage(opt.id)}
                              className={`min-h-[44px] inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${
                                active
                                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
                                  : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
                              }`}
                            >
                              {tr.languages?.[opt.id] || opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {f.step === 2 && (
                <div className="space-y-5">
                  <div className="flex gap-2 p-3 bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] rounded-xl text-sm text-[var(--wn-badge-emerald-text)]">
                    <Mail size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{s2.infoNotice || 'سنرسل كود تحقق من 6 أرقام إلى بريدك الإلكتروني. الكود صالح لمدة 10 دقائق.'}</span>
                  </div>
                  <Field htmlFor="reg-email" label={s2.emailLabel || 'البريد الإلكتروني *'}>
                    <div className="relative">
                      <Mail
                        className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none"
                        size={18}
                        aria-hidden="true"
                      />
                      <input
                        id="reg-email"
                        type="email"
                        dir="ltr"
                        className={`${inputCls} ps-10`}
                        value={f.credentials.email}
                        disabled={f.isCodeSent || f.sendingCode}
                        onChange={(e) => f.setCredentials((p) => ({ ...p, email: e.target.value }))}
                        placeholder={s2.emailPlaceholder || 'name@example.com'}
                      />
                    </div>
                  </Field>
                  {!f.isCodeSent ? (
                    <button
                      type="button"
                      onClick={f.sendCode}
                      disabled={f.sendingCode}
                      className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {f.sendingCode && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                      <span>{f.sendingCode ? (s2.sendingCodeBtn || 'جاري إرسال الكود…') : (s2.sendCodeBtn || 'إرسال كود التحقق إلى البريد')}</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--wn-text-secondary)] text-center">
                        {s2.codeSentTo || 'تم إرسال الكود إلى'} <strong dir="ltr">{f.credentials.email}</strong>
                      </p>
                      <label htmlFor="reg-otp" className="sr-only">
                        {s2.otpLabel || 'كود التحقق المكون من 6 أرقام'}
                      </label>
                      <input
                        id="reg-otp"
                        dir="ltr"
                        className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
                        placeholder={s2.otpPlaceholder || '000000'}
                        aria-label={s2.otpLabel || 'كود التحقق المكون من 6 أرقام'}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={f.verificationCode}
                        onChange={(e) => f.setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                      <button
                        type="button"
                        onClick={f.verifyCode}
                        disabled={f.verifyingCode}
                        className="btn-primary w-full min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {f.verifyingCode && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                        <span>{f.verifyingCode ? (s2.verifyingCodeBtn || 'جاري التحقق…') : (s2.verifyCodeBtn || 'تأكيد البريد')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={f.resetVerification}
                        disabled={f.verifyingCode}
                        className="text-sm text-[var(--wn-text-secondary)] hover:text-[var(--wn-heading)] w-full min-h-[44px] inline-flex items-center justify-center"
                      >
                        {s2.changeEmailBtn || 'تغيير البريد أو إعادة الإرسال'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {f.step === 3 && (
                <div className="space-y-4">
                  <div className="flex gap-2 p-3 bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] rounded-xl text-sm text-[var(--wn-badge-emerald-text)]">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      {s3.verifiedNotice || 'تم تأكيد البريد وسيُستخدم للحساب والإشعارات:'}{' '}
                      <strong dir="ltr">{f.verifiedEmail}</strong>
                    </span>
                  </div>
                  <Field htmlFor="reg-password" label={s3.passwordLabel || 'كلمة المرور *'}>
                    <div className="relative">
                      <Lock
                        className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none"
                        size={18}
                        aria-hidden="true"
                      />
                      <input
                        id="reg-password"
                        type={showPass ? 'text' : 'password'}
                        className={`${inputCls} ps-10 pe-12`}
                        value={f.credentials.password}
                        onChange={(e) => f.setCredentials((p) => ({ ...p, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        aria-label={showPass ? (s3.hidePasswordAria || 'إخفاء كلمة المرور') : (s3.showPasswordAria || 'إظهار كلمة المرور')}
                        className="absolute end-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] grid place-items-center text-[var(--wn-text-tertiary)] hover:text-[var(--wn-heading)]"
                      >
                        {showPass ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </Field>
                  <Field htmlFor="reg-confirm-password" label={s3.confirmPasswordLabel || 'تأكيد كلمة المرور *'}>
                    <input
                      id="reg-confirm-password"
                      type="password"
                      className={inputCls}
                      value={f.credentials.confirmPassword}
                      onChange={(e) => f.setCredentials((p) => ({ ...p, confirmPassword: e.target.value }))}
                    />
                  </Field>
                </div>
              )}

              {f.step === 4 && (
                <div className="space-y-5">
                  <div className="flex gap-2.5 p-3.5 bg-[var(--wn-surface-mint)] border border-[var(--wn-border-mint)] rounded-xl text-sm text-[var(--wn-badge-emerald-text)]">
                    <Info size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-bold">
                        {isRTL ? 'بسّطنا التقديم: ملفان أساسيان فقط يكفيان لإرسال طلبك!' : 'Simplified application: only 2 essential files are needed!'}
                      </p>
                      <p className="text-xs mt-1">
                        {isRTL
                          ? 'صورة شخصية + فيديو واحد (1–3 دقائق) يجمع تعريفاً سريعاً بنفسك وتلاوة واضحة. البطاقة الشخصية وباقي المرفقات اختيارية بالكامل.'
                          : 'Profile photo + one short video (1–3 min) with a quick intro and clear Quran recitation. ID card and all other files are completely optional.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <FileBox
                      id="profilePhoto"
                      label={s4.profilePhotoLabel || 'صورة شخصية 4×6 *'}
                      hint={s4.imageHint || 'JPG أو PNG فقط'}
                      accept=".jpg,.jpeg,.jfif,.png,image/jpeg,image/png"
                      allowedMimeTypes={['image/jpeg', 'image/png']}
                      allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png']}
                      maxBytes={100 * 1024 * 1024}
                      captureKind="image"
                      file={f.files.profilePhoto}
                      onChange={(file) => f.setFile('profilePhoto', file)}
                      preview={(file) => <ProfilePhotoPreview file={file} alt={s4.profilePhotoAlt || 'معاينة الصورة الشخصية'} />}
                    />
                  </div>

                  <div className="border-t border-[var(--wn-border)] pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="text-[var(--wn-emerald)]" size={20} aria-hidden="true" />
                      <p className="font-semibold text-[var(--wn-heading)]">
                        {isRTL ? 'فيديو التعريف والتلاوة الأساسي (فيديو واحد يكفي) *' : 'Primary Intro & Recitation Video (1 video is enough) *'}
                      </p>
                    </div>
                    <ul className="text-sm text-[var(--wn-badge-gold-text)] space-y-1 mb-3 bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)]/35 rounded-lg p-3">
                      <li>
                        • {isRTL
                          ? 'فيديو واحد من دقيقة إلى 3 دقائق: عرّف بنفسك وخبرتك في 30 ثانية ثم اتلُ آيات قصيرة بصوت واضح.'
                          : 'One 1–3 minute video: briefly introduce yourself (30 sec), then recite a few Quran verses clearly.'}
                      </li>
                      {VIDEO_GUIDE_KEYS.slice(0, 2).map((item) => (
                        <li key={item.key}>• {s4.videoGuide?.[item.key] || item.fallback}</li>
                      ))}
                    </ul>
                    <FileBox
                      id="reciteVid"
                      label={isRTL ? 'ارفع فيديو التعريف والتلاوة (1–3 دقائق) *' : 'Upload Intro & Recitation Video (1–3 min) *'}
                      hint={s4.recitationVideoHint || 'MP4 أو WebM أو MOV — الحد الأقصى 100 MB'}
                      accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                      allowedMimeTypes={['video/mp4', 'video/webm', 'video/quicktime']}
                      allowedExtensions={['.mp4', '.webm', '.mov']}
                      maxBytes={100 * 1024 * 1024}
                      captureKind="video"
                      multiple
                      files={f.files.recitationVideos}
                      onChange={(selectedFiles) => f.setFile('recitationVideos', selectedFiles)}
                    />
                  </div>

                  <div className="border-t border-[var(--wn-border)] pt-4">
                    <button
                      type="button"
                      onClick={() => setShowOptionalUploads((open) => !open)}
                      aria-expanded={showOptionalUploads}
                      className="w-full min-h-[48px] flex items-center justify-between gap-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-4 py-3 text-start hover:border-[var(--wn-emerald)] transition"
                    >
                      <div>
                        <strong className="block text-sm text-[var(--wn-heading)]">
                          {isRTL
                            ? 'مرفقات إضافية اختيارية (البطاقة الشخصية، الشهادات، الإجازات، أو فيديوهات إضافية)'
                            : 'Optional Extra Attachments (ID Card, Certificates, Ijazat, or Extra Videos)'}
                        </strong>
                        <small className="block text-xs text-[var(--wn-text-secondary)] mt-0.5">
                          {isRTL
                            ? 'يمكنك تخطي هذا القسم تماماً والانتقال للخطوة التالية، أو رفع أي مرفق متاح لديك الآن لتسريع القبول.'
                            : 'You can skip this section completely and proceed, or upload any optional documents now.'}
                        </small>
                      </div>
                      {showOptionalUploads ? (
                        <ChevronUp size={18} className="shrink-0 text-[var(--wn-emerald)]" aria-hidden="true" />
                      ) : (
                        <ChevronDown size={18} className="shrink-0 text-[var(--wn-emerald)]" aria-hidden="true" />
                      )}
                    </button>

                    {showOptionalUploads && (
                      <div className="mt-4 space-y-4 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4">
                        <FileBox
                          id="idCardFront"
                          label={isRTL ? 'وجه البطاقة الشخصية (اختياري)' : 'ID Card Front (Optional)'}
                          hint={s4.imageHint || 'JPG أو PNG فقط — محفوظة بسرية تامة للإدارة فقط'}
                          accept=".jpg,.jpeg,.jfif,.png,image/jpeg,image/png"
                          allowedMimeTypes={['image/jpeg', 'image/png']}
                          allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png']}
                          maxBytes={25 * 1024 * 1024}
                          captureKind="image"
                          file={f.files.idCardFront}
                          onChange={(file) => f.setFile('idCardFront', file)}
                        />

                        <FileBox
                          id="idCardBack"
                          label={isRTL ? 'ظهر البطاقة الشخصية (اختياري)' : 'ID Card Back (Optional)'}
                          hint={s4.imageHint || 'JPG أو PNG فقط'}
                          accept=".jpg,.jpeg,.jfif,.png,image/jpeg,image/png"
                          allowedMimeTypes={['image/jpeg', 'image/png']}
                          allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png']}
                          maxBytes={25 * 1024 * 1024}
                          captureKind="image"
                          file={f.files.idCardBack}
                          onChange={(file) => f.setFile('idCardBack', file)}
                        />

                        <FileBox
                          id="gradCert"
                          label={isRTL ? 'شهادة التخرج (اختياري)' : 'Graduation Certificate (Optional)'}
                          hint="JPG / PNG / PDF"
                          accept=".jpg,.jpeg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf"
                          allowedMimeTypes={['image/jpeg', 'image/png', 'application/pdf']}
                          allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png', '.pdf']}
                          maxBytes={25 * 1024 * 1024}
                          captureKind="image"
                          file={f.files.graduationCertificate}
                          onChange={(file) => f.setFile('graduationCertificate', file)}
                        />

                        <FileBox
                          id="tajweed"
                          label={isRTL ? 'شهادات التجويد (اختياري)' : 'Tajweed Certificates (Optional)'}
                          hint="JPG / PNG / PDF"
                          accept=".jpg,.jpeg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf"
                          allowedMimeTypes={['image/jpeg', 'image/png', 'application/pdf']}
                          allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png', '.pdf']}
                          maxBytes={25 * 1024 * 1024}
                          multiple
                          files={f.files.tajweedCertificates}
                          onChange={(selectedFiles) => f.setFile('tajweedCertificates', selectedFiles)}
                        />

                        <FileBox
                          id="ijazat"
                          label={isRTL ? 'الإجازات القرآنية (اختياري)' : 'Quran Ijazat (Optional)'}
                          hint="JPG / PNG / PDF"
                          accept=".jpg,.jpeg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf"
                          allowedMimeTypes={['image/jpeg', 'image/png', 'application/pdf']}
                          allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png', '.pdf']}
                          maxBytes={25 * 1024 * 1024}
                          multiple
                          files={f.files.ijazat}
                          onChange={(selectedFiles) => f.setFile('ijazat', selectedFiles)}
                        />

                        <FileBox
                          id="introVid"
                          label={isRTL ? 'فيديو تعريفي قصير منفصل (اختياري)' : 'Separate Short Intro Video (Optional)'}
                          hint={s4.videoHint || 'MP4 أو WebM أو MOV — الحد الأقصى 100 MB'}
                          accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                          allowedMimeTypes={['video/mp4', 'video/webm', 'video/quicktime']}
                          allowedExtensions={['.mp4', '.webm', '.mov']}
                          maxBytes={100 * 1024 * 1024}
                          captureKind="video"
                          file={f.files.introductionVideo}
                          onChange={(file) => f.setFile('introductionVideo', file)}
                        />

                        <FileBox
                          id="methodVid"
                          label={isRTL ? 'فيديو طريقة التدريس (اختياري)' : 'Teaching Method Demo Video (Optional)'}
                          hint={s4.videoHint || 'MP4 أو WebM أو MOV — الحد الأقصى 100 MB'}
                          accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                          allowedMimeTypes={['video/mp4', 'video/webm', 'video/quicktime']}
                          allowedExtensions={['.mp4', '.webm', '.mov']}
                          maxBytes={100 * 1024 * 1024}
                          captureKind="video"
                          file={f.files.teachingMethodVideo}
                          onChange={(file) => f.setFile('teachingMethodVideo', file)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {f.step === 5 && (
                <div className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <ReviewBlock
                      title={s5.personalBlock || 'البيانات'}
                      items={[
                        f.formData.personalInfo.fullName,
                        f.formData.personalInfo.gender === 'female'
                          ? (s5.genderFemaleSummary || 'معلمة (قسم السيدات والفتيات)')
                          : (s5.genderMaleSummary || 'معلم (قسم الرجال والبنين)'),
                        formatMsg(s5.ageLine || 'السن: {age}', { age: f.formData.personalInfo.age }),
                        f.formData.personalInfo.address,
                        countryLabel(f.formData.personalInfo.country, tr),
                        f.formData.personalInfo.phone,
                      ]}
                    />
                    <ReviewBlock
                      title={s5.educationBlock || 'التعليم والخبرة القرآنية'}
                      items={[
                        f.formData.academicInfo.university,
                        formatMsg(s5.graduationLine || 'تخرج {year}', { year: f.formData.academicInfo.graduationYear }),
                        formatMsg(s5.experienceLine || 'الخبرة: {years} سنوات · الحفظ: {parts} جزء', {
                          years: f.formData.quranInfo?.teachingExperience || 0,
                          parts: f.formData.quranInfo?.memorizedParts || 30,
                        }),
                        formatMsg(s5.ijazatLine || 'الإجازات: {count}', {
                          count: f.formData.quranInfo?.numberOfIjazat || 0,
                        }),
                      ]}
                    />
                    <ReviewBlock title={s5.accountBlock || 'الحساب'} items={[f.credentials.email]} />
                    <ReviewBlock
                      title={s5.filesBlock || 'الملفات'}
                      items={[
                        f.files.profilePhoto ? (s5.photoOk || '✓ صورة 4×6') : (s5.photoMissing || '✗ صورة'),
                        f.files.recitationVideos?.length
                          ? formatMsg(s5.reciteVidOk || '✓ {count} فيديو تلاوة وتعريف', { count: f.files.recitationVideos.length })
                          : (s5.reciteVidMissing || '✗ فيديو التعريف والتلاوة'),
                        f.files.idCardFront ? (isRTL ? '✓ وجه البطاقة (اختياري)' : '✓ ID Front (Optional)') : null,
                        f.files.idCardBack ? (s5.idBackOk || '✓ ظهر البطاقة (اختياري)') : null,
                        f.files.graduationCertificate ? (s5.gradCertOk || '✓ شهادة التخرج (اختياري)') : null,
                        f.files.tajweedCertificates?.length
                          ? formatMsg(s5.tajweedCertOk || '✓ شهادات تجويد: {count}', { count: f.files.tajweedCertificates.length })
                          : null,
                        f.files.ijazat?.length
                          ? formatMsg(s5.ijazatOk || '✓ الإجازات: {count}', { count: f.files.ijazat.length })
                          : null,
                        f.files.introductionVideo ? (s5.introVidOk || '✓ فيديو تعريفي منفصل (اختياري)') : null,
                        f.files.teachingMethodVideo ? (s5.methodVidOk || '✓ فيديو طريقة التدريس (اختياري)') : null,
                      ]}
                    />
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)]/35 rounded-xl text-sm text-[var(--wn-badge-gold-text)]">
                    <Shield size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{s5.consentNotice || 'بالضغط على إرسال، أنت توافق على مراجعة بياناتك من قبل إدارة الأكاديمية'}</span>
                  </div>
                  {f.submitting && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-4 text-sm text-[var(--wn-badge-emerald-text)]"
                    >
                      {f.uploadProgress?.saving ? (
                        <p>{s5.uploadingSaving || 'اكتمل رفع الملفات، جاري حفظ الطلب...'}</p>
                      ) : (
                        <>
                          <p>
                            {formatMsg(s5.uploadingLabel || 'جاري رفع: {label}', {
                              label: f.uploadProgress?.label || s5.uploadingPreparing || 'تجهيز الملفات',
                            })}
                          </p>
                          <p className="mt-1">
                            {formatMsg(s5.uploadingCount || 'الملفات المكتملة: {completed} من {total}', {
                              completed: f.uploadProgress?.completed || 0,
                              total: f.uploadProgress?.total || '—',
                            })}
                          </p>
                          <progress
                            className="mt-2 w-full"
                            max={100}
                            value={f.uploadProgress?.percentage || 0}
                            aria-label={s5.progressAria || 'نسبة رفع الملف الحالي'}
                          />
                          <p>
                            {formatMsg(s5.uploadingPct || '{pct}% — اترك الصفحة مفتوحة حتى يكتمل الإرسال.', {
                              pct: f.uploadProgress?.percentage || 0,
                            })}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={f.submit}
                    disabled={f.submitting}
                    className="btn-primary w-full min-h-[44px] py-4 text-base inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {f.submitting && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                    <span>{f.submitting ? (s5.submittingBtn || 'جاري الإرسال…') : (s5.submitBtn || 'إرسال الطلب للمراجعة')}</span>
                  </button>
                </div>
              )}

              {f.step < 5 && (
                <div className="flex flex-wrap justify-between gap-3 mt-8 pt-6 border-t border-[var(--wn-border)]">
                  <button
                    type="button"
                    onClick={f.prev}
                    disabled={f.step === 1}
                    className="btn-secondary min-h-[44px] disabled:opacity-40"
                  >
                    <PrevIcon size={18} aria-hidden="true" /> {nav.prev || 'السابق'}
                  </button>
                  <button type="button" onClick={f.next} className="btn-primary min-h-[44px]">
                    {nav.next || 'التالي'} <NextIcon size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
              {f.step === 5 && (
                <button
                  type="button"
                  onClick={f.prev}
                  disabled={f.submitting}
                  className="btn-secondary min-h-[44px] mt-4 disabled:opacity-50"
                >
                  <PrevIcon size={18} aria-hidden="true" /> {s5.editDataBtn || 'تعديل البيانات'}
                </button>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-[var(--wn-text-secondary)]">
            <span className="flex items-center gap-1"><Clock size={14} aria-hidden="true" /> {hdr.durationHint || '~8 دقائق'}</span>
            <span className="flex items-center gap-1"><Shield size={14} aria-hidden="true" /> {hdr.privacyHint || 'بياناتك مخصصة للمراجعة'}</span>
          </div>
        </div>
      </div>
      <GlobalFooter />
    </>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--wn-text-primary)] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReviewBlock({ title, items }) {
  return (
    <div className="bg-[var(--wn-surface-soft)] rounded-xl p-4 border border-[var(--wn-border)]">
      <p className="font-bold text-[var(--wn-heading)] mb-2">{title}</p>
      {items.filter(Boolean).map((item, i) => (
        <p key={i} className="text-[var(--wn-text-secondary)]">{item}</p>
      ))}
    </div>
  );
}
