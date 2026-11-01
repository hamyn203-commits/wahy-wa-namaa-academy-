import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Users, Lock, Mail, Phone, Eye, EyeOff, ArrowRight, CheckCircle,
  Sparkles, CheckCircle2, Globe, ArrowLeft, ShieldCheck, ChevronDown, ImagePlus
} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import GoogleSignIn from '../../components/GoogleSignIn';
import { useI18n } from '../../i18n';
import { useMarket } from '../../context/MarketProvider';
import { useAuth } from '../../hooks/useAuth.jsx';
import { localizedPath } from '../../lib/locale';
import { dashboardPathForRole, isSafeInternalRedirect } from '../../lib/navigation';
import '../../styles/public-experience.css';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useToast } from '../../context/ToastProvider';

function evaluatePasswordStrength(pw, isAr) {
  if (!pw) return { score: 0, label: '', color: 'bg-slate-200', textColor: 'text-slate-500' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 11 || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length < 8) score = 1;

  const levels = {
    1: { label: isAr ? 'ضعيفة (8 أحرف على الأقل)' : 'Weak (min 8 chars)', color: 'bg-red-500', textColor: 'text-red-600' },
    2: { label: isAr ? 'متوسطة — أضف أرقاماً أو رموزاً' : 'Fair — add numbers/symbols', color: 'bg-amber-500', textColor: 'text-amber-600' },
    3: { label: isAr ? 'جيدة وآمنة' : 'Good password', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
    4: { label: isAr ? 'قوية جداً وممتازة' : 'Very strong password', color: 'bg-emerald-600', textColor: 'text-emerald-700' },
  };
  return { score, ...(levels[score] || levels[1]) };
}

/**
 * Turns a failed registration result into a message the learner can act on.
 * Server messages are often English/technical, so known cases are mapped first.
 */
function registrationErrorMessage(result, isAr) {
  const { status, code, error } = result || {};
  if (code === 'NETWORK_ERROR' || status === 0) {
    return isAr
      ? 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.'
      : 'We could not reach the server. Check your connection and try again.';
  }
  if (status === 429) {
    return isAr
      ? 'تمت محاولات تسجيل كثيرة خلال وقت قصير. انتظر بضع دقائق ثم حاول مرة أخرى، أو تواصل معنا إن استمرت المشكلة.'
      : 'Too many sign-up attempts in a short time. Please wait a few minutes and try again.';
  }
  if (code === 'GUARDIAN_PHONE_ALREADY_REGISTERED') return error;
  if (status === 409) {
    return isAr
      ? 'هذا البريد الإلكتروني مسجل بالفعل. سجّل الدخول إلى حسابك، أو استخدم "نسيت كلمة المرور".'
      : 'This email is already registered. Sign in instead, or use "Forgot password".';
  }
  if (status >= 500) {
    return isAr
      ? 'حدث خطأ مؤقت لدينا أثناء إنشاء الحساب. لم يتم حفظ أي شيء، حاول مرة أخرى بعد قليل.'
      : 'A temporary server error occurred. Nothing was saved — please try again shortly.';
  }
  return error || (isAr ? 'تعذر إنشاء الحساب. راجع البيانات وحاول مرة أخرى.' : 'Registration failed. Please review your details and try again.');
}

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const { register: createAccount } = useAuth();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  
  // Custom plan parameters from landing page planner
  const planPath = searchParams.get('path') || '';
  const planFreq = searchParams.get('freq') || '';
  const planLevel = searchParams.get('level') || '';
  const planMode = searchParams.get('mode') || 'private';
  const selectedSection = ['men', 'women'].includes(searchParams.get('section')) ? searchParams.get('section') : '';

  const initialRole = searchParams.get('role') === 'guardian' || (typeof window !== 'undefined' && window.location.pathname.includes('/guardian')) ? 'guardian' : 'student';
  const [role, setRole] = useState(initialRole);

  const { marketSlug } = useMarket();
  const isIndonesian = marketSlug === 'indonesia-malaysia';

  const { locale } = useI18n();
  const isRtl = locale === 'ar';
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const errorRef = useRef(null);
  const optionalDetailsRef = useRef(null);
  const photoInputRef = useRef(null);
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [photoNotice, setPhotoNotice] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    guardianPhone: '',
    guardianRelationship: 'father',
    whatsappPhone: '',
    age: '',
    gender: selectedSection === 'women' ? 'female' : selectedSection === 'men' ? 'male' : '',
    currentLevel: 'beginner',
    preferredTrack: 'memorization',
    memorizedJuz: '0',
    memorizationDetails: '',
    customLevel: '',
    password: '',
    confirmPassword: ''
  });

  // The form is long: bring any error into view next to the submit button and
  // move focus to it so screen readers announce it immediately.
  useEffect(() => {
    if (!error || !errorRef.current) return;
    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    errorRef.current.focus({ preventScroll: true });
  }, [error]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorStatus(null);

    // التحقق من تطابق كلمات المرور
    if (formData.password !== formData.confirmPassword) {
      setError(locale === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      setLoading(false);
      return;
    }

    // التحقق من قوة كلمة المرور
    if (formData.password.length < 8) {
      setError(locale === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const result = await createAccount({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        ...(role === 'student' ? {
          whatsappPhone: whatsappSame ? formData.phone : formData.whatsappPhone,
          age: formData.age,
          gender: formData.gender,
          currentLevel: formData.currentLevel === 'other' ? 'beginner' : formData.currentLevel,
          customLevel: formData.currentLevel === 'other' ? formData.customLevel : '',
          preferredTrack: formData.preferredTrack,
          memorizedJuz: Number(formData.memorizedJuz),
          memorizationDetails: formData.memorizationDetails,
        } : {}),
        password: formData.password,
        role,
        ...(role === 'student' && selectedSection ? { enrollmentSection: selectedSection === 'women' ? 'ladies' : 'men_children' } : {}),
        ...(role === 'student' && formData.guardianPhone.trim()
          ? {
              guardianPhone: formData.guardianPhone.trim(),
              guardianRelationship: formData.guardianRelationship,
            }
          : {}),
        ...(referralCode ? { referralCode } : {}),
        ...(planPath ? { selectedPlan: { path: planPath, freq: planFreq, level: planLevel } } : {}),
      });

      if (!result.success) {
        setErrorStatus(result.status ?? null);
        setError(registrationErrorMessage(result, locale === 'ar'));
        return;
      }

      if (role === 'student' && studentPhoto) {
        try {
          const uploaded = await uploadFileDirect(studentPhoto, 'student-avatar');
          const token = (await import('../../lib/authSession')).getAccessToken();
          const updateResponse = await fetch((await import('../../config')).apiUrl('/api/auth/me'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ avatar: uploaded.url }),
          });
          if (!updateResponse.ok) throw new Error('Photo save failed');
        } catch {
          toast.warning(locale === 'ar'
            ? 'تم إنشاء الحساب بنجاح، لكن تعذر حفظ الصورة. يمكنك إضافتها لاحقًا.'
            : 'Your account was created, but the optional photo could not be saved.');
        }
      }

      navigate(
        role === 'student' && isSafeInternalRedirect(searchParams.get('redirect')) ? searchParams.get('redirect') : dashboardPathForRole(result.user?.role, locale),
        { replace: true }
      );
    } catch (err) {
      setError(registrationErrorMessage({ error: err.message }, locale === 'ar'));
    } finally {
      setLoading(false);
    }
  };

  // Translations for plan summaries
  const pathNames = {
    hifz: locale === 'ar' ? 'حفظ القرآن وتجويده' : 'Quran Memorization & Tajweed',
    tajweed: locale === 'ar' ? 'أحكام التجويد ومخارج الحروف' : 'Tajweed & Pronunciation Rules',
    arabic: locale === 'ar' ? 'اللغة العربية الفصحى' : 'Classical Arabic (Fus’ha)'
  };

  const levelNames = {
    beginner: locale === 'ar' ? 'مبتدئ' : 'Beginner',
    intermediate: locale === 'ar' ? 'متوسط' : 'Intermediate',
    advanced: locale === 'ar' ? 'متقدم' : 'Advanced'
  };

  const getEstimatedDuration = () => {
    const frequency = parseInt(planFreq) || 2;
    if (planPath === 'hifz') {
      if (frequency === 1) return locale === 'ar' ? '4.5 سنوات' : '4.5 Years';
      if (frequency === 2) return locale === 'ar' ? '2.5 سنة' : '2.5 Years';
      if (frequency === 3) return locale === 'ar' ? '1.5 سنة' : '1.5 Years';
      return locale === 'ar' ? '10 أشهر' : '10 Months';
    } else if (planPath === 'tajweed') {
      if (frequency === 1) return locale === 'ar' ? '6 أشهر' : '6 Months';
      if (frequency === 2) return locale === 'ar' ? '4 أشهر' : '4 Months';
      if (frequency === 3) return locale === 'ar' ? '3 أشهر' : '3 Months';
      return locale === 'ar' ? '6 أسابيع' : '6 Weeks';
    } else {
      if (frequency === 1) return locale === 'ar' ? '1.5 سنة' : '1.5 Years';
      if (frequency === 2) return locale === 'ar' ? '9 أشهر' : '9 Months';
      if (frequency === 3) return locale === 'ar' ? '6 أشهر' : '6 Months';
      return locale === 'ar' ? '3 أشهر' : '3 Months';
    }
  };

  const getEstimatedPrice = () => {
    const frequency = parseInt(planFreq) || 2;
    if (isIndonesian) {
      if (planMode === 'group') {
        return { formatted: 'Rp 100.000', currency: 'IDR' };
      } else {
        let rate = 450000;
        if (frequency === 1) rate = 250000;
        else if (frequency === 2) rate = 450000;
        else if (frequency === 3) rate = 600000;
        else if (frequency === 5) rate = 900000;
        return { formatted: `Rp ${rate.toLocaleString('id-ID')}`, currency: 'IDR' };
      }
    } else {
      const monthlyHours = frequency * 4;
      const usdPrice = monthlyHours * 10;
      const egpPrice = monthlyHours * 50;
      return { usd: usdPrice, egp: egpPrice, currency: 'USD/EGP' };
    }
  };

  const planPrice = getEstimatedPrice();
  const planDuration = getEstimatedDuration();

  // Dynamic style values based on language direction
  const iconStyle = isRtl ? { right: '16px' } : { left: '16px' };
  const inputPadding = isRtl ? '14px 50px 14px 16px' : '14px 16px 14px 50px';
  // Shared look for the plain (icon-less) fields so the whole form is consistent.
  const fieldClass = 'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-[var(--athar-gold)] focus:ring-2 focus:ring-[var(--athar-gold)]/10';
  const fieldLabelClass = 'block text-xs font-bold text-[var(--athar-text)]';

  return (
    <div className="wn-register-shell flex items-center justify-center" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-6xl grid lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Column: Brand Intro & Plan Details */}
        <motion.div
          initial={{ opacity: 0, x: isRtl ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="wn-register-brand-panel lg:col-span-5 flex flex-col justify-between p-6 md:p-8 rounded-3xl text-white relative overflow-hidden"
        >
          {/* Subtle Arabesque Watermark */}
          <div className="absolute inset-0 opacity-15 pointer-events-none geo-pattern-athar" aria-hidden="true" />
          
          <div className="relative">
            {/* Header Brand */}
            <div className="mb-8">
              <BrandLogo size={54} variant="light" to={null} />
            </div>

            <h2 className="font-naskh text-3xl md:text-4xl font-bold leading-snug mb-4">
              {locale === 'ar' ? 'ابدأ رحلتك القرآنية المباركة' : 'Start Your Blessed Quranic Journey'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {locale === 'ar'
                ? 'انضم إلينا اليوم لتتعلم كتاب الله الكريم على يد نخبة من أمهر المعلمين والمعلمات المجازين أونلاين.'
                : 'Join us today to learn the Holy Quran from native certified scholars online at your own schedule.'}
            </p>

            {/* Custom Plan summary if present */}
            {planPath ? (
              <div className="rounded-2xl border border-[var(--athar-gold)]/30 bg-white/5 p-6 backdrop-blur-sm mt-8 space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--athar-gold)]/20 px-3 py-1 text-xs font-semibold text-[var(--athar-gold-light)]">
                  <Sparkles size={12} />
                  {locale === 'ar' ? 'خطة الدراسة المختارة' : 'Selected Study Plan'}
                </span>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400">{locale === 'ar' ? 'المسار التعليمي:' : 'Learning Path:'}</p>
                    <p className="text-base font-bold text-[var(--athar-gold-light)]">
                      {pathNames[planPath] || planPath}
                      {isIndonesian && (
                        <span className="text-xs font-normal text-slate-300 ml-2">
                          ({planMode === 'group' ? (locale === 'ar' ? 'حلقة جماعية' : 'Kelas Grup') : (locale === 'ar' ? 'حصة خاصة' : 'Kelas Privat')})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-xs text-slate-400">{locale === 'ar' ? 'المستوى الحالي:' : 'Current Level:'}</p>
                      <p className="text-sm font-semibold">{levelNames[planLevel] || planLevel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{locale === 'ar' ? 'الحصص شهرياً:' : 'Sessions Monthly:'}</p>
                      <p className="text-sm font-semibold">{planMode === 'group' && isIndonesian ? 8 : parseInt(planFreq) * 4} {locale === 'ar' ? 'حصص' : 'sessions'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-xs text-slate-400">{locale === 'ar' ? 'المدة المقدرة:' : 'Estimated Duration:'}</p>
                      <p className="text-sm font-bold text-emerald-400">{planMode === 'group' && isIndonesian ? (locale === 'ar' ? '1.5 سنة' : '1.5 Years') : planDuration}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{locale === 'ar' ? 'التكلفة الشهرية:' : 'Monthly Cost:'}</p>
                      <p className="text-sm font-bold text-[var(--athar-gold-light)]">
                        {isIndonesian ? (
                          planPrice.formatted
                        ) : (
                          <>{planPrice.egp} ج.م <span className="text-[10px] text-slate-300">/ {planPrice.usd}$</span></>
                        )}
                      </p>
                    </div>
                  </div>

                  {isIndonesian && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-300 leading-normal">
                      <Globe size={14} className="shrink-0 text-emerald-400 mt-0.5 animate-spin" style={{ animationDuration: '6s' }} />
                      <span>
                        {locale === 'id' 
                          ? 'Terdeteksi IP Indonesia: Subsidi Biaya Khusus Aktif (Dukungan Guru Mesir Terjangkau).' 
                          : locale === 'ar'
                          ? 'تم رصد عنوان IP من إندونيسيا: الرسوم المدعومة نشطة (معلمين مصريين بتكلفة مناسبة).'
                          : 'Indonesian IP Detected: Subsidized Pricing Active (Affordable Egyptian Scholars).'}
                      </span>
                    </div>
                  )}

                  {isIndonesian && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-[10px] text-slate-400 font-bold mb-1.5">
                        {locale === 'id' ? 'Pilihan Pembayaran Lokal:' : locale === 'ar' ? 'خيارات الدفع المحلية:' : 'Local Payment Options:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {['QRIS', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'Bank Transfer'].map(method => (
                          <span key={method} className="text-[8px] font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded px-1.5 py-0.5">
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Perks summary if no custom plan is passed
              <div className="space-y-4 mt-8">
                {[
                  { title: locale === 'ar' ? 'معلمون متخصصون في القرآن والتجويد' : 'Qualified Quran & Tajweed Tutors' },
                  { title: locale === 'ar' ? 'جلسات فردية مباشرة وتفاعلية' : 'Live 1-on-1 Interactive Classes' },
                  { title: locale === 'ar' ? 'خطط حفظ ودراسة ذكية ومرنة' : 'Adaptive and Smart Memorization Plans' },
                  { title: locale === 'ar' ? 'شهادات إتمام إلكترونية قابلة للتحقق' : 'Verifiable Digital Completion Certificates' }
                ].map((perk, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-[var(--athar-gold)] mt-0.5 shrink-0" />
                    <span className="text-sm text-slate-200">{perk.title}</span>
                  </div>
                ))}

                {isIndonesian && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-300 leading-normal">
                    <Globe size={14} className="shrink-0 text-emerald-400 mt-0.5 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>
                      {locale === 'id' 
                        ? 'Terdeteksi IP Indonesia: Subsidi Biaya Khusus Aktif (Dukungan Guru Mesir Terjangkau).' 
                        : locale === 'ar'
                        ? 'تم رصد عنوان IP من إندونيسيا: الرسوم المدعومة نشطة (معلمين مصريين بتكلفة مناسبة).'
                        : 'Indonesian IP Detected: Subsidized Pricing Active (Affordable Egyptian Scholars).'}
                    </span>
                  </div>
                )}

                {isIndonesian && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <p className="text-[10px] text-slate-400 font-bold mb-1.5">
                      {locale === 'id' ? 'Pilihan Pembayaran Lokal:' : locale === 'ar' ? 'خيارات الدفع المحلية:' : 'Local Payment Options:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['QRIS', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'Bank Transfer'].map(method => (
                        <span key={method} className="text-[8px] font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded px-1.5 py-0.5">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="wn-register-trust">
            <CheckCircle2 size={16} />
            <span>
              {locale === 'ar'
                ? 'ابدأ بالمعلومات الأساسية فقط، ويمكنك استكمال تفاصيل المسار والمعلم لاحقًا.'
                : 'Start with the basics now. You can complete your learning path and teacher preferences later.'}
            </span>
          </div>
        </motion.div>

        {/* Right Column: Registration Form */}
        <motion.div
          initial={{ opacity: 0, x: isRtl ? -40 : 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="wn-register-form-card lg:col-span-7 p-6 md:p-10 flex flex-col justify-between"
        >
          <div>
            {selectedSection && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                <span>{locale === 'ar' ? 'القسم المختار: ' : 'Learning section: '}
                  <strong>{selectedSection === 'women'
                    ? (locale === 'ar' ? 'قسم السيدات' : 'Women & girls')
                    : (locale === 'ar' ? 'قسم الرجال والأطفال' : 'Men & children')}</strong>
                </span>
                <button type="button" onClick={() => navigate(localizedPath('/start', locale))}
                  className="font-bold underline underline-offset-4">
                  {locale === 'ar' ? 'تغيير القسم' : 'Change section'}
                </button>
              </div>
            )}
            {/* Only student and guardian sign-up choices are publicly available. */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  role === 'student'
                    ? 'bg-white text-[var(--athar-navy)] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <User size={15} />
                <span>{locale === 'ar' ? 'حساب طالب' : 'Student Account'}</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('guardian')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  role === 'guardian'
                    ? 'bg-white text-[var(--athar-navy)] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users size={15} />
                <span>{locale === 'ar' ? 'حساب ولي أمر' : 'Guardian Account'}</span>
              </button>
            </div>
            <GoogleSignIn context="signup" role={role} enrollmentSection={role === 'student' && selectedSection ? (selectedSection === 'women' ? 'ladies' : 'men_children') : undefined} />

            <div className="mb-6">
              <h2 className="font-naskh text-2xl md:text-3xl font-bold text-[var(--athar-text)]">
                {role === 'guardian'
                  ? (locale === 'ar' ? 'إنشاء حساب ولي أمر' : 'Create Guardian Account')
                  : (locale === 'ar' ? 'إنشاء حساب طالب' : 'Create Student Account')}
              </h2>
              <p className="text-sm text-[var(--athar-text-muted)] mt-1">
                {role === 'guardian'
                  ? (locale === 'ar' ? 'تابع مسيرة أبنائك في حفظ القرآن وتقارير حضورهم وتقييماتهم' : 'Monitor your children’s Quran progress, attendance & teacher reports')
                  : (locale === 'ar' ? 'دقيقة واحدة وتبدأ: الاسم والبريد وكلمة المرور تكفي الآن.' : 'One minute to start: name, email and password are enough for now.')}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              // A required/invalid field inside the collapsed section cannot receive focus,
              // which would block submission silently. Open the section first.
              onInvalidCapture={(event) => {
                if (optionalDetailsRef.current?.contains(event.target)) optionalDetailsRef.current.open = true;
              }}
              className="space-y-5"
            >
              
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[var(--athar-text)] mb-2">
                  {locale === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                </label>
                <div className="relative">
                  <User size={18} style={iconStyle} className="absolute top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder={locale === 'ar' ? 'أدخل اسمك الكامل' : 'Enter your full name'}
                    style={{ padding: inputPadding }}
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-[var(--athar-gold)] focus:ring-2 focus:ring-[var(--athar-gold)]/10"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-[var(--athar-text)] mb-2">
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail size={18} style={iconStyle} className="absolute top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="example@email.com"
                    style={{ padding: inputPadding }}
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-[var(--athar-gold)] focus:ring-2 focus:ring-[var(--athar-gold)]/10"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="register-phone" className="block text-xs font-bold text-[var(--athar-text)] mb-2">
                  {role === 'guardian'
                    ? (locale === 'ar' ? 'رقم هاتف ولي الأمر' : 'Guardian Phone Number')
                    : (locale === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)')}
                </label>
                <div className="relative">
                  <Phone size={18} style={iconStyle} className="absolute top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    id="register-phone"
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    required={role === 'guardian'}
                    placeholder="+20 123 456 7890"
                    style={{ padding: inputPadding }}
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-[var(--athar-gold)] focus:ring-2 focus:ring-[var(--athar-gold)]/10"
                  />
                </div>
                {role === 'guardian' ? (
                  <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                    {locale === 'ar'
                      ? 'نستخدم الرقم فقط لمطابقة طلبات ربط أبنائك. لا يتم الربط إلا بعد موافقتك داخل حسابك.'
                      : 'This number is used only to match child-link requests. Nothing is linked until you confirm it.'}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {locale === 'ar'
                        ? 'نحتاجه فقط لتأكيد مواعيد حصصك، ويمكنك إضافته لاحقًا.'
                        : 'Only used to confirm your session times. You can add it later.'}
                    </p>
                    {formData.phone.trim() && (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={whatsappSame}
                          onChange={(event) => setWhatsappSame(event.target.checked)}
                          className="h-4 w-4 rounded accent-emerald-700"
                        />
                        {locale === 'ar' ? 'هذا الرقم عليه واتساب' : 'This number is on WhatsApp'}
                      </label>
                    )}
                    {formData.phone.trim() && !whatsappSame && (
                      <label className={fieldLabelClass}>
                        {locale === 'ar' ? 'رقم الواتساب' : 'WhatsApp number'}
                        <input type="tel" name="whatsappPhone" autoComplete="tel" inputMode="tel" value={formData.whatsappPhone} onChange={handleChange} placeholder="+201000000000" className={fieldClass} />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-[var(--athar-text)] mb-2">
                  {locale === 'ar' ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <Lock size={18} style={iconStyle} className="absolute top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    style={{ padding: inputPadding }}
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-[var(--athar-gold)] focus:ring-2 focus:ring-[var(--athar-gold)]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={isRtl ? { left: '16px' } : { right: '16px' }}
                    className="absolute top-1/2 transform -translate-y-1/2 background-none border-none cursor-pointer text-slate-400 p-1 flex items-center"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.password && (() => {
                  const strength = evaluatePasswordStrength(formData.password, locale === 'ar');
                  return (
                    <div className="mt-2.5 space-y-1.5" aria-live="polite">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((bar) => (
                          <span
                            key={bar}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              bar <= strength.score ? strength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${strength.textColor}`}>
                        <CheckCircle size={13} />
                        <span>{strength.label}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-[var(--athar-text)] mb-2">
                  {locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock size={18} style={iconStyle} className="absolute top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    style={{ padding: inputPadding }}
                    className="w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none transition focus:border-[var(--athar-gold)] focus:ring-2 focus:ring-[var(--athar-gold)]/10"
                  />
                </div>
                {formData.confirmPassword && (
                  formData.password === formData.confirmPassword ? (
                    <div className="mt-2 flex items-center gap-1.5 text-emerald-700 text-xs" aria-live="polite">
                      <CheckCircle size={14} />
                      {locale === 'ar' ? 'كلمتا المرور متطابقتان' : 'Passwords match'}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 text-amber-700 text-xs" aria-live="polite">
                      <span className="font-bold">!</span>
                      {locale === 'ar' ? 'كلمتا المرور غير متطابقتين بعد' : 'Passwords do not match yet'}
                    </div>
                  )
                )}
              </div>

              {role === 'student' && (
                <details ref={optionalDetailsRef} className="wn-register-optional group rounded-2xl border border-emerald-100 bg-emerald-50/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-emerald-900">
                        {locale === 'ar' ? 'أضف مستواك وبيانات إضافية الآن' : 'Add your level and extra details now'}{' '}
                        <span className="font-normal text-emerald-800/70">{locale === 'ar' ? '(اختياري)' : '(optional)'}</span>
                      </span>
                      <span className="text-[11px] text-emerald-800/80">
                        {locale === 'ar' ? 'يمكنك تخطي هذه الخطوة واستكمالها لاحقًا من لوحتك.' : 'You can skip this and complete it later from your dashboard.'}
                      </span>
                    </span>
                    <ChevronDown size={18} className="shrink-0 text-emerald-800 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>

                  <div className="space-y-5 border-t border-emerald-100 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className={fieldLabelClass}>{locale === 'ar' ? 'العمر' : 'Age'}
                        <input className={fieldClass} type="number" min="4" max="100" inputMode="numeric" name="age" value={formData.age} onChange={handleChange} />
                      </label>
                      <label className={fieldLabelClass}>{locale === 'ar' ? 'النوع' : 'Gender'}
                        <select className={fieldClass} name="gender" value={formData.gender} onChange={handleChange}>
                          <option value="">{locale === 'ar' ? 'اختر' : 'Select'}</option><option value="male">{locale === 'ar' ? 'ذكر' : 'Male'}</option><option value="female">{locale === 'ar' ? 'أنثى' : 'Female'}</option>
                        </select>
                      </label>
                      <label className={fieldLabelClass}>{locale === 'ar' ? 'المسار التعليمي' : 'Learning track'}
                        <select className={fieldClass} name="preferredTrack" value={formData.preferredTrack} onChange={handleChange}>
                          <option value="memorization">{locale === 'ar' ? 'حفظ القرآن' : 'Memorization'}</option>
                          <option value="tajweed_ijazah">{locale === 'ar' ? 'التجويد والإجازة' : 'Tajweed / Ijazah'}</option>
                          <option value="kids_foundation">{locale === 'ar' ? 'تأسيس الأطفال' : 'Foundation'}</option>
                        </select>
                      </label>
                      <label className={fieldLabelClass}>{locale === 'ar' ? 'مستواك' : 'Level'}
                        <select className={fieldClass} name="currentLevel" value={formData.currentLevel} onChange={handleChange}>
                          <option value="beginner">{locale === 'ar' ? 'مبتدئ' : 'Beginner'}</option><option value="intermediate">{locale === 'ar' ? 'متوسط' : 'Intermediate'}</option><option value="advanced">{locale === 'ar' ? 'متقدم' : 'Advanced'}</option><option value="ijazah">{locale === 'ar' ? 'طالب إجازة' : 'Ijazah'}</option><option value="other">{locale === 'ar' ? 'أخرى — اكتب مستواك' : 'Other — specify'}</option>
                        </select>
                      </label>
                      {formData.currentLevel === 'other' && (
                        <label className={fieldLabelClass + ' sm:col-span-2'}>{locale === 'ar' ? 'اكتب مستواك' : 'Describe your level'}
                          <input required maxLength="120" className={fieldClass} name="customLevel" value={formData.customLevel} onChange={handleChange} />
                        </label>
                      )}
                      <label className={fieldLabelClass + ' sm:col-span-2'}>{locale === 'ar' ? 'كم جزءًا تحفظ؟ (0 إلى 30)' : 'Memorized Juz (0–30)'}
                        <input type="number" min="0" max="30" step="1" inputMode="numeric" className={fieldClass} name="memorizedJuz" value={formData.memorizedJuz} onChange={handleChange} />
                      </label>
                    </div>
                    <label className={fieldLabelClass}>{locale === 'ar' ? 'تفاصيل الحفظ — السور أو الأجزاء التي تحفظها، أو خطة أخرى' : 'Memorization details / custom plan'}
                      <textarea name="memorizationDetails" maxLength="500" rows="3" value={formData.memorizationDetails} onChange={handleChange} className={fieldClass} placeholder={locale === 'ar' ? 'مثال: أحفظ جزء عم وتبارك، وأريد البدء من سورة البقرة' : 'Example: I memorized Juz Amma and Tabarak'} />
                    </label>
                    <p className="text-[11px] text-emerald-900/70">
                      {locale === 'ar' ? 'اختيارك مبدئي، والمعلم يحدد مستواك الفعلي في الحصة التجريبية.' : 'This is only a first estimate — your tutor confirms your level in the trial class.'}
                    </p>

                    <div className="space-y-2 border-t border-emerald-100 pt-4">
                      <span className={fieldLabelClass}>{locale === 'ar' ? 'الصورة الشخصية (اختيارية)' : 'Profile photo (optional)'}</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 focus-within:ring-2 focus-within:ring-emerald-200">
                          <ImagePlus size={16} aria-hidden="true" />
                          {studentPhoto ? (locale === 'ar' ? 'تغيير الصورة' : 'Change photo') : (locale === 'ar' ? 'اختيار صورة' : 'Choose photo')}
                          <input
                            ref={photoInputRef}
                            id="optional-student-photo"
                            type="file"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              if (file && (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                                setStudentPhoto(null);
                                event.target.value = '';
                                setPhotoNotice(locale === 'ar' ? 'اختر JPG أو PNG بحجم لا يتجاوز 5 ميجابايت' : 'Choose JPG or PNG up to 5 MB');
                              } else {
                                setStudentPhoto(file);
                                setPhotoNotice(file ? file.name : '');
                              }
                            }}
                          />
                        </label>
                        {studentPhoto && (
                          <button
                            type="button"
                            onClick={() => {
                              setStudentPhoto(null);
                              setPhotoNotice('');
                              if (photoInputRef.current) photoInputRef.current.value = '';
                            }}
                            className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-red-700"
                          >
                            {locale === 'ar' ? 'إزالة' : 'Remove'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{locale === 'ar' ? 'JPG أو PNG بحد أقصى 5 MB.' : 'JPG or PNG, up to 5 MB.'}</p>
                      {photoNotice && <p role="status" className="text-xs text-emerald-800">{photoNotice}</p>}
                    </div>

                    <div className="space-y-3 border-t border-emerald-100 pt-4">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck size={18} className="text-emerald-700 mt-0.5 shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-emerald-900">
                            {locale === 'ar' ? 'ربط ولي الأمر' : 'Guardian Linking'}
                          </h3>
                          <p className="text-[11px] text-emerald-800/80 mt-1 leading-relaxed">
                            {locale === 'ar'
                              ? 'اكتب رقم ولي الأمر ليظهر له طلب الربط عندما ينشئ حسابه أو يسجل الدخول. لن يتم الربط تلقائيًا.'
                              : 'Enter a guardian phone so a pending request appears when they sign in. Linking is never automatic.'}
                          </p>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className={fieldLabelClass}>{locale === 'ar' ? 'رقم ولي الأمر' : 'Guardian Phone'}
                          <input type="tel" name="guardianPhone" autoComplete="off" inputMode="tel" value={formData.guardianPhone} onChange={handleChange} placeholder="+20 10 0000 0000" className={fieldClass} />
                        </label>
                        <label className={fieldLabelClass}>{locale === 'ar' ? 'صلة القرابة' : 'Relationship'}
                          <select name="guardianRelationship" value={formData.guardianRelationship} onChange={handleChange} className={fieldClass}>
                            <option value="father">{locale === 'ar' ? 'أب' : 'Father'}</option>
                            <option value="mother">{locale === 'ar' ? 'أم' : 'Mother'}</option>
                            <option value="guardian">{locale === 'ar' ? 'ولي أمر / وصي' : 'Guardian'}</option>
                            <option value="other">{locale === 'ar' ? 'صلة أخرى' : 'Other'}</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {error && (
                <motion.div
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-start gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <span className="font-bold shrink-0" aria-hidden="true">!</span>
                  <div className="space-y-2">
                    <p>{error}</p>
                    {errorStatus === 409 && (
                      <button
                        type="button"
                        onClick={() => navigate(localizedPath('/login', locale))}
                        className="font-bold underline underline-offset-2"
                      >
                        {locale === 'ar' ? 'الذهاب لتسجيل الدخول' : 'Go to sign in'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full justify-center text-sm py-3.5 shadow-lg mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {locale === 'ar' ? 'إنشاء الحساب وبدء الدراسة' : 'Create Account & Begin'}
                    {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Login redirection */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-[var(--athar-text-muted)] mb-3">
              {locale === 'ar' ? 'لديك حساب بالفعل؟' : 'Already have an account?'}
            </p>
            <button
              onClick={() => navigate(localizedPath('/login', locale))}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--athar-gold)]/40 bg-white px-8 py-2.5 text-xs font-bold text-[var(--athar-gold-muted)] hover:bg-[var(--athar-gold-50)] transition"
            >
              {locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <div className="mt-4">
              <button
                onClick={() => navigate(localizedPath('/', locale))}
                className="text-xs text-[var(--athar-gold-muted)] hover:text-[var(--athar-gold)] hover:underline"
              >
                {locale === 'ar' ? 'العودة للصفحة الرئيسية' : 'Back to Homepage'}
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}