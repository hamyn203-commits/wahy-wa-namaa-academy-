import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info, Lock, Mail, Eye, EyeOff, ArrowLeft, ArrowRight,
  CheckCircle2, Clock, Shield, Video, AlertTriangle, Loader2,
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
import { localizedPath } from '../../lib/locale';

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

export default function TeacherRegistration() {
  const { locale, dir, isRTL, t } = useI18n();
  const tr = t?.teacherRegistration || {};
  const [showPass, setShowPass] = useState(false);
  const f = useTeacherForm();

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

          <StepProgress current={f.step} />

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

                  <div className="border-t border-[var(--wn-border)] pt-4">
                    <p className="font-semibold text-[var(--wn-heading)] mb-1">{s4.identityTitle || 'إثبات الهوية *'}</p>
                    <p className="text-sm text-[var(--wn-text-secondary)] mb-3">
                      {s4.identitySubtitle || 'وجه البطاقة وظهر البطاقة مطلوبان لإكمال الطلب.'}
                    </p>
                    <div className="grid md:grid-cols-2 gap-3">
                      <FileBox
                        id="idCardFront"
                        label={s4.idFrontLabel || 'وجه البطاقة الشخصية *'}
                        hint={s4.imageHint || 'JPG أو PNG فقط'}
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
                        label={s4.idBackLabel || 'ظهر البطاقة الشخصية *'}
                        hint={s4.imageHint || 'JPG أو PNG فقط'}
                        accept=".jpg,.jpeg,.jfif,.png,image/jpeg,image/png"
                        allowedMimeTypes={['image/jpeg', 'image/png']}
                        allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png']}
                        maxBytes={25 * 1024 * 1024}
                        captureKind="image"
                        file={f.files.idCardBack}
                        onChange={(file) => f.setFile('idCardBack', file)}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--wn-border)] pt-4 space-y-4">
                    <p className="font-semibold text-[var(--wn-heading)]">{s4.extraDocsTitle || 'المستندات الإضافية'}</p>

                    <AvailabilityChoice
                      label={s4.gradCertQuestion || 'هل شهادة التخرج موجودة؟'}
                      yesLabel={s4.yesAvailable || 'موجود'}
                      noLabel={s4.noUnavailable || 'غير موجود'}
                      value={f.formData.documentAvailability?.graduationCertificate}
                      onChange={(value) => {
                        f.update('documentAvailability', 'graduationCertificate', value);
                        if (!value) f.setFile('graduationCertificate', null);
                      }}
                    />
                    {f.formData.documentAvailability?.graduationCertificate === true && (
                      <FileBox
                        id="gradCert"
                        label={s4.gradCertLabel || 'شهادة التخرج *'}
                        hint={s4.gradCertRequiredHint || 'بما أنك اخترت «موجود»، رفع الشهادة أصبح إجباريًا'}
                        accept=".jpg,.jpeg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf"
                        allowedMimeTypes={['image/jpeg', 'image/png', 'application/pdf']}
                        allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png', '.pdf']}
                        maxBytes={25 * 1024 * 1024}
                        captureKind="image"
                        file={f.files.graduationCertificate}
                        onChange={(file) => f.setFile('graduationCertificate', file)}
                      />
                    )}

                    <AvailabilityChoice
                      label={s4.tajweedCertQuestion || 'هل لديك شهادات تجويد؟'}
                      yesLabel={s4.yesAvailable || 'موجود'}
                      noLabel={s4.noUnavailable || 'غير موجود'}
                      value={f.formData.documentAvailability?.tajweedCertificates}
                      onChange={(value) => {
                        f.update('documentAvailability', 'tajweedCertificates', value);
                        if (!value) f.setFile('tajweedCertificates', []);
                      }}
                    />
                    {f.formData.documentAvailability?.tajweedCertificates === true && (
                      <FileBox
                        id="tajweed"
                        label={s4.tajweedCertLabel || 'شهادات التجويد *'}
                        hint={s4.atLeastOneHint || 'ارفع شهادة واحدة على الأقل'}
                        accept=".jpg,.jpeg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf"
                        allowedMimeTypes={['image/jpeg', 'image/png', 'application/pdf']}
                        allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png', '.pdf']}
                        maxBytes={25 * 1024 * 1024}
                        multiple
                        files={f.files.tajweedCertificates}
                        onChange={(selectedFiles) => f.setFile('tajweedCertificates', selectedFiles)}
                      />
                    )}

                    <AvailabilityChoice
                      label={s4.ijazatQuestion || 'هل لديك إجازات؟'}
                      yesLabel={s4.yesAvailable || 'موجود'}
                      noLabel={s4.noUnavailable || 'غير موجود'}
                      value={f.formData.documentAvailability?.ijazat}
                      onChange={(value) => {
                        f.update('documentAvailability', 'ijazat', value);
                        if (!value) f.setFile('ijazat', []);
                      }}
                    />
                    {f.formData.documentAvailability?.ijazat === true && (
                      <FileBox
                        id="ijazat"
                        label={s4.ijazatLabel || 'الإجازات *'}
                        hint={s4.atLeastOneHint || 'ارفع إجازة واحدة على الأقل'}
                        accept=".jpg,.jpeg,.jfif,.png,.pdf,image/jpeg,image/png,application/pdf"
                        allowedMimeTypes={['image/jpeg', 'image/png', 'application/pdf']}
                        allowedExtensions={['.jpg', '.jpeg', '.jfif', '.png', '.pdf']}
                        maxBytes={25 * 1024 * 1024}
                        multiple
                        files={f.files.ijazat}
                        onChange={(selectedFiles) => f.setFile('ijazat', selectedFiles)}
                      />
                    )}
                  </div>

                  <div className="border-t border-[var(--wn-border)] pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="text-[var(--wn-emerald)]" size={20} aria-hidden="true" />
                      <p className="font-semibold text-[var(--wn-heading)]">{s4.introVideoTitle || 'فيديو تعريفي قصير *'}</p>
                    </div>
                    <p className="text-sm text-[var(--wn-text-secondary)] mb-3">
                      {s4.introVideoDesc || 'عرّف بنفسك وخبرتك وطريقتك في التعامل مع الطلاب في فيديو واضح من 60–120 ثانية.'}
                    </p>
                    <FileBox
                      id="introVid"
                      label={s4.introVideoLabel || 'ارفع الفيديو التعريفي'}
                      hint={s4.videoHint || 'MP4 أو WebM أو MOV — الحد الأقصى 100 MB'}
                      accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                      allowedMimeTypes={['video/mp4', 'video/webm', 'video/quicktime']}
                      allowedExtensions={['.mp4', '.webm', '.mov']}
                      maxBytes={100 * 1024 * 1024}
                      captureKind="video"
                      file={f.files.introductionVideo}
                      onChange={(file) => f.setFile('introductionVideo', file)}
                    />
                  </div>

                  <div className="border-t border-[var(--wn-border)] pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="text-[var(--wn-emerald)]" size={20} aria-hidden="true" />
                      <p className="font-semibold text-[var(--wn-heading)]">{s4.recitationVideoTitle || 'فيديو تلاوة قرآنية *'}</p>
                    </div>
                    <ul className="text-sm text-[var(--wn-badge-gold-text)] space-y-1 mb-3 bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)]/35 rounded-lg p-3">
                      {VIDEO_GUIDE_KEYS.map((item) => (
                        <li key={item.key}>• {s4.videoGuide?.[item.key] || item.fallback}</li>
                      ))}
                    </ul>
                    <FileBox
                      id="reciteVid"
                      label={s4.recitationVideoLabel || 'ارفع فيديو/فيديوهات التلاوة (3–5 دقائق)'}
                      hint={s4.recitationVideoHint || 'MP4 أو WebM أو MOV — الحد الأقصى 100 MB لكل فيديو'}
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
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="text-[var(--wn-emerald)]" size={20} aria-hidden="true" />
                      <p className="font-semibold text-[var(--wn-heading)]">{s4.methodVideoTitle || 'فيديو طريقة التدريس *'}</p>
                    </div>
                    <p className="text-sm text-[var(--wn-text-secondary)] mb-3">
                      {s4.methodVideoDesc || 'اشرح أو مثّل جزءًا قصيرًا من حصة لتستطيع الإدارة تقييم أسلوب الشرح والتواصل.'}
                    </p>
                    <FileBox
                      id="methodVid"
                      label={s4.methodVideoLabel || 'ارفع فيديو طريقة التدريس'}
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
                        f.files.idCardFront ? (s5.idFrontOk || '✓ وجه البطاقة') : (s5.idFrontMissing || '✗ وجه البطاقة'),
                        f.files.idCardBack ? (s5.idBackOk || '✓ ظهر البطاقة') : (s5.idBackMissing || '✗ ظهر البطاقة'),
                        f.formData.documentAvailability?.graduationCertificate
                          ? (f.files.graduationCertificate ? (s5.gradCertOk || '✓ شهادة التخرج') : (s5.gradCertMissing || '✗ شهادة التخرج'))
                          : (s5.gradCertUnavailable || '— شهادة التخرج: غير موجودة'),
                        f.formData.documentAvailability?.tajweedCertificates
                          ? formatMsg(s5.tajweedCertOk || '✓ شهادات تجويد: {count}', { count: f.files.tajweedCertificates?.length || 0 })
                          : (s5.tajweedCertUnavailable || '— شهادات التجويد: غير موجودة'),
                        f.formData.documentAvailability?.ijazat
                          ? formatMsg(s5.ijazatOk || '✓ الإجازات: {count}', { count: f.files.ijazat?.length || 0 })
                          : (s5.ijazatUnavailable || '— الإجازات: غير موجودة'),
                        f.files.introductionVideo ? (s5.introVidOk || '✓ فيديو تعريفي') : (s5.introVidMissing || '✗ فيديو تعريفي'),
                        f.files.recitationVideos?.length
                          ? formatMsg(s5.reciteVidOk || '✓ {count} فيديو تلاوة', { count: f.files.recitationVideos.length })
                          : (s5.reciteVidMissing || '✗ فيديو تلاوة'),
                        f.files.teachingMethodVideo ? (s5.methodVidOk || '✓ فيديو طريقة التدريس') : (s5.methodVidMissing || '✗ فيديو طريقة التدريس'),
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

function AvailabilityChoice({ label, yesLabel, noLabel, value, onChange }) {
  return (
    <div className="rounded-xl border border-[var(--wn-border)] p-4 bg-[var(--wn-surface-soft)]">
      <p className="font-medium text-[var(--wn-heading)] mb-3">{label} *</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => onChange(true)}
          className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            value === true
              ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-emerald)]'
          }`}
        >
          {yesLabel || 'موجود'}
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          onClick={() => onChange(false)}
          className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            value === false
              ? 'border-[var(--wn-emerald-deep)] bg-[var(--wn-emerald-deep)] text-[var(--wn-white)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-border-strong)]'
          }`}
        >
          {noLabel || 'غير موجود'}
        </button>
      </div>
    </div>
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
