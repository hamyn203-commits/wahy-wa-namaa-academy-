import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Users,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpenCheck,
  Route,
  Sparkles,
} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import GoogleSignIn from '../../components/GoogleSignIn';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { postAuthDestination } from '../../lib/navigation';
import { useAuth } from '../../hooks/useAuth.jsx';
import '../../styles/public-experience.css';

const LOGIN_COPY = {
  ar: {
    seoTitle: 'تسجيل الدخول',
    eyebrow: 'مرحبًا بعودتك إلى وحي ونماء',
    visualTitleA: 'أكمل رحلتك مع القرآن.',
    visualTitleB: 'من حيث توقفت.',
    visualLead: 'دخول واحد يوصلك إلى جلساتك، مسارك التعليمي، أدوات التلاوة، وتقارير التقدم.',
    verseRef: 'طه: ١١٤',
    formEyebrow: 'حسابك في الأكاديمية',
    formTitle: 'تسجيل الدخول',
    formSubtitle: 'أدخل بياناتك للعودة إلى مساحة التعلم.',
    rolePrompt: 'إذا لم يكن لديك حساب، اختر نوعه قبل الدخول بجوجل',
    roleGroupLabel: 'نوع الحساب',
    roleStudent: 'طالب',
    roleGuardian: 'ولي أمر',
    roleHint: 'إذا كان لديك حساب بالفعل (طالب، معلم، ولي أمر، أو إدارة)، أدخل البريد الإلكتروني أو رقم الهاتف وكلمة المرور بالأسفل وسيتم تحويلك مباشرة إلى لوحتك.',
    emailLabel: 'البريد الإلكتروني أو رقم الهاتف',
    emailPlaceholder: 'example@email.com أو 010XXXXXXXX',
    passwordLabel: 'كلمة المرور',
    forgotPassword: 'نسيت كلمة المرور؟',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    submitBtn: 'دخول إلى حسابي',
    signingIn: 'جاري تسجيل الدخول...',
    newAccountDivider: 'حساب جديد',
    createStudent: 'إنشاء حساب طالب',
    createGuardian: 'إنشاء حساب ولي أمر',
    backHome: 'العودة للرئيسية',
    errGeneric: 'تعذر تسجيل الدخول',
    benefits: [
      { title: 'كل رحلتك في مكان واحد', text: 'الحصص، الحفظ، المراجعة، والتقارير.' },
      { title: 'أدوات للتلاوة والمتابعة', text: 'راجع أداءك وارجع للجلسة بهدف أوضح.' },
      { title: 'مسار واضح للتقدم', text: 'اعرف ما أنجزت وما هي الخطوة التالية.' },
    ],
  },
  en: {
    seoTitle: 'Sign in',
    eyebrow: 'WELCOME BACK TO WAHY WA NAMAA',
    visualTitleA: 'Continue your Quran journey.',
    visualTitleB: 'Right where you left off.',
    visualLead: 'One sign-in gives you access to lessons, your learning path, recitation tools, and progress reports.',
    verseRef: 'Taha 20:114',
    formEyebrow: 'YOUR ACADEMY ACCOUNT',
    formTitle: 'Sign in',
    formSubtitle: 'Enter your details to return to your learning space.',
    rolePrompt: 'New here? Choose your account type before continuing with Google',
    roleGroupLabel: 'Account type',
    roleStudent: 'Student',
    roleGuardian: 'Guardian',
    roleHint: 'Already have an account (student, teacher, guardian, or admin)? Sign in below with your email or phone number and password to go straight to your dashboard.',
    emailLabel: 'Email or phone number',
    emailPlaceholder: 'example@email.com or +2010XXXXXXXX',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submitBtn: 'Sign in to my account',
    signingIn: 'Signing in...',
    newAccountDivider: 'New account',
    createStudent: 'Student account',
    createGuardian: 'Parent account',
    backHome: 'Back to home',
    errGeneric: 'Unable to sign in',
    benefits: [
      { title: 'Your journey in one place', text: 'Lessons, memorization, review, and reports.' },
      { title: 'Recitation and follow-up tools', text: 'Review your performance and return with a clearer goal.' },
      { title: 'A clear progress path', text: 'Know what you completed and what comes next.' },
    ],
  },
  fr: {
    seoTitle: 'Connexion',
    formEyebrow: 'VOTRE COMPTE ACADÉMIE',
    formTitle: 'Se connecter',
    formSubtitle: 'Saisissez vos identifiants pour retrouver votre espace d’apprentissage.',
    rolePrompt: 'Nouveau ici ? Choisissez votre profil avant de continuer avec Google',
    roleGroupLabel: 'Type de compte',
    roleStudent: 'Élève',
    roleTeacher: 'Enseignant',
    roleGuardian: 'Parent',
    roleHint: 'Les comptes existants conservent leur rôle initial.',
    emailLabel: 'E-mail',
    passwordLabel: 'Mot de passe',
    forgotPassword: 'Mot de passe oublié ?',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    submitBtn: 'Accéder à mon compte',
    signingIn: 'Connexion en cours...',
    newAccountDivider: 'Nouveau compte',
    createStudent: 'Compte élève',
    createGuardian: 'Compte parent',
    backHome: 'Retour à l’accueil',
    errGeneric: 'Impossible de se connecter',
  },
  de: {
    seoTitle: 'Anmelden',
    formEyebrow: 'IHR AKADEMIE-KONTO',
    formTitle: 'Anmelden',
    formSubtitle: 'Geben Sie Ihre Zugangsdaten ein, um zu Ihrem Lernbereich zurückzukehren.',
    rolePrompt: 'Neu hier? Wählen Sie vor Google-Anmeldung Ihren Kontotyp',
    roleGroupLabel: 'Kontotyp',
    roleStudent: 'Schüler',
    roleTeacher: 'Lehrkraft',
    roleGuardian: 'Elternteil',
    roleHint: 'Bestehende Konten behalten ihre registrierte Rolle.',
    emailLabel: 'E-Mail',
    passwordLabel: 'Passwort',
    forgotPassword: 'Passwort vergessen?',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
    submitBtn: 'Anmelden',
    signingIn: 'Anmeldung läuft...',
    newAccountDivider: 'Neues Konto',
    createStudent: 'Schülerkonto',
    createGuardian: 'Elternkonto',
    backHome: 'Zur Startseite',
    errGeneric: 'Anmeldung fehlgeschlagen',
  },
  tr: {
    seoTitle: 'Giriş Yap',
    formEyebrow: 'AKADEMİ HESABINIZ',
    formTitle: 'Giriş Yap',
    formSubtitle: 'Öğrenim alanınıza dönmek için bilgilerinizi girin.',
    rolePrompt: 'Yeni misiniz? Google ile devam etmeden önce hesap türünüzü seçin',
    roleGroupLabel: 'Hesap türü',
    roleStudent: 'Öğrenci',
    roleTeacher: 'Öğretmen',
    roleGuardian: 'Veli',
    roleHint: 'Mevcut hesaplar kayıtlı rollerini korur.',
    emailLabel: 'E-posta',
    passwordLabel: 'Şifre',
    forgotPassword: 'Şifremi unuttum?',
    showPassword: 'Şifreyi göster',
    hidePassword: 'Şifreyi gizle',
    submitBtn: 'Hesabıma giriş yap',
    signingIn: 'Giriş yapılıyor...',
    newAccountDivider: 'Yeni hesap',
    createStudent: 'Öğrenci hesabı',
    createGuardian: 'Veli hesabı',
    backHome: 'Ana sayfaya dön',
    errGeneric: 'Giriş yapılamadı',
  },
  ur: {
    seoTitle: 'لاگ ان کریں',
    formEyebrow: 'آپ کا اکیڈمی اکاؤنٹ',
    formTitle: 'لاگ ان کریں',
    formSubtitle: 'اپنے تعلیمی ماحول میں واپس جانے کے لیے تفصیلات درج کریں۔',
    rolePrompt: 'نئے ہیں؟ گوگل سے جاری رکھنے سے پہلے اکاؤنٹ کی قسم منتخب کریں',
    roleGroupLabel: 'اکاؤنٹ کی قسم',
    roleStudent: 'طالب علم',
    roleTeacher: 'استاد',
    roleGuardian: 'سرپرست',
    roleHint: 'موجودہ اکاؤنٹس اپنا سابقہ کردار برقرار رکھیں گے۔',
    emailLabel: 'ای میل',
    passwordLabel: 'پاس ورڈ',
    forgotPassword: 'پاس ورڈ بھول گئے؟',
    showPassword: 'پاس ورڈ دکھائیں',
    hidePassword: 'پاس ورڈ چھپائیں',
    submitBtn: 'اپنے اکاؤنٹ میں داخل ہوں',
    signingIn: 'لاگ ان ہو رہا ہے...',
    newAccountDivider: 'نیا اکاؤنٹ',
    createStudent: 'طالب علم کا اکاؤنٹ بنائیں',
    createGuardian: 'سرپرست کا اکاؤنٹ بنائیں',
    backHome: 'صفحہ اول پر واپس جائیں',
    errGeneric: 'لاگ ان ممکن نہیں ہو سکا',
  },
  id: {
    seoTitle: 'Masuk',
    formEyebrow: 'AKUN AKADEMI ANDA',
    formTitle: 'Masuk',
    formSubtitle: 'Masukkan detail Anda untuk kembali ke ruang belajar.',
    rolePrompt: 'Baru di sini? Pilih jenis akun sebelum melanjutkan dengan Google',
    roleGroupLabel: 'Jenis akun',
    roleStudent: 'Siswa',
    roleTeacher: 'Guru',
    roleGuardian: 'Wali',
    roleHint: 'Akun yang sudah ada tetap mempertahankan perannya.',
    emailLabel: 'Email',
    passwordLabel: 'Kata Sandi',
    forgotPassword: 'Lupa kata sandi?',
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
    submitBtn: 'Masuk ke akun saya',
    signingIn: 'Sedang masuk...',
    newAccountDivider: 'Akun baru',
    createStudent: 'Akun siswa',
    createGuardian: 'Akun wali',
    backHome: 'Kembali ke beranda',
    errGeneric: 'Tidak dapat masuk',
  },
  ms: {
    seoTitle: 'Log Masuk',
    formEyebrow: 'AKAUN AKADEMI ANDA',
    formTitle: 'Log Masuk',
    formSubtitle: 'Masukkan butiran anda untuk kembali ke ruang pembelajaran.',
    rolePrompt: 'Pengguna baharu? Pilih jenis akaun sebelum meneruskan dengan Google',
    roleGroupLabel: 'Jenis akaun',
    roleStudent: 'Pelajar',
    roleTeacher: 'Guru',
    roleGuardian: 'Penjaga',
    roleHint: 'Akaun sedia ada mengekalkan peranan yang didaftarkan.',
    emailLabel: 'E-mel',
    passwordLabel: 'Kata Laluan',
    forgotPassword: 'Terlupa kata laluan?',
    showPassword: 'Tunjukkan kata laluan',
    hidePassword: 'Sembunyikan kata laluan',
    submitBtn: 'Log masuk ke akaun saya',
    signingIn: 'Sedang log masuk...',
    newAccountDivider: 'Akaun baharu',
    createStudent: 'Akaun pelajar',
    createGuardian: 'Akaun penjaga',
    backHome: 'Kembali ke utama',
    errGeneric: 'Tidak dapat log masuk',
  },
  ku: {
    seoTitle: 'چوونەژوورەوە',
    formEyebrow: 'هەژمارەکەت لە ئەکادیمیا',
    formTitle: 'چوونەژوورەوە',
    formSubtitle: 'زانیارییەکانت بنووسە بۆ گەڕانەوە بۆ ژینگەی فێربوون.',
    rolePrompt: 'نوێیت؟ جۆری هەژمار هەڵبژێرە پێش بەردەوامبوون بە گووگڵ',
    roleGroupLabel: 'جۆری هەژمار',
    roleStudent: 'فێرخواز',
    roleTeacher: 'مامۆستا',
    roleGuardian: 'بەخێوکار',
    roleHint: 'هەژمارە پێشینەکان هەمان ڕۆڵی خۆیان دەپارێزن.',
    emailLabel: 'ئیمەیڵ',
    passwordLabel: 'وشەی نهێنی',
    forgotPassword: 'وشەی نهێنیت لەبیرچووە؟',
    showPassword: 'پیشاندانی وشەی نهێنی',
    hidePassword: 'شاردنەوەی وشەی نهێنی',
    submitBtn: 'چوونەژوورەوە بۆ هەژمارەکەم',
    signingIn: 'چوونەژوورەوە...',
    newAccountDivider: 'هەژماری نوێ',
    createStudent: 'دروستکردنی هەژماری فێرخواز',
    createGuardian: 'دروستکردنی هەژماری بەخێوکار',
    backHome: 'گەڕانەوە بۆ سەرەتا',
    errGeneric: 'چوونەژوورەوە سەرکەوتوو نەبوو',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: signIn } = useAuth();
  const { locale, isRTL, dir } = useI18n();
  const baseCopy = isRTL ? LOGIN_COPY.ar : LOGIN_COPY.en;
  const copy = { ...baseCopy, ...(LOGIN_COPY[locale] || {}) };
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const lp = (path) => localizedPath(path, locale);

  const redirectParam = searchParams.get('redirect') || searchParams.get('next') || '';
  const redirectQuery = redirectParam ? '?redirect=' + encodeURIComponent(redirectParam) : '';

  const [googleRole, setGoogleRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginNotice, setLoginNotice] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setLoginNotice(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const result = await signIn(formData.email, formData.password);
      if (!result.success) {
        const teacherNotices = {
          TEACHER_APPROVAL_PENDING: {
            title: isRTL ? 'طلبك في انتظار موافقة الإدارة' : 'Your application is awaiting approval',
            text: isRTL
              ? 'تم استلام طلبك بنجاح، ولن يتم فتح لوحة المعلم إلا بعد مراجعة الإدارة واعتماد الطلب.'
              : 'Your application was received. Teacher access will open only after administration review and approval.',
          },
          TEACHER_APPLICATION_UNDER_REVIEW: {
            title: isRTL ? 'طلبك ما زال قيد المراجعة' : 'Your application is still under review',
            text: isRTL
              ? 'الإدارة تراجع بياناتك ومستنداتك حاليًا. لا يوجد دخول إلى لوحة المعلم حتى اكتمال المراجعة.'
              : 'Administration is reviewing your details and documents. Teacher access stays locked until the review is complete.',
          },
          TEACHER_APPLICATION_REJECTED: {
            title: isRTL ? 'تعذر اعتماد طلب المعلم' : 'Teacher application not approved',
            text: isRTL
              ? 'يمكنك التواصل مع إدارة الأكاديمية لمعرفة الخطوة التالية أو إعادة التقديم عند السماح بذلك.'
              : 'Contact academy administration for the next step or to reapply when allowed.',
          },
          TEACHER_ACCOUNT_SUSPENDED: {
            title: isRTL ? 'حساب المعلم موقوف' : 'Teacher account suspended',
            text: isRTL
              ? 'تواصل مع إدارة الأكاديمية لمراجعة حالة الحساب.'
              : 'Contact academy administration to review the account status.',
          },
        };

        if (teacherNotices[result.code]) {
          setLoginNotice(teacherNotices[result.code]);
          return;
        }

        throw new Error(result.error || copy.errGeneric);
      }

      navigate(
        postAuthDestination({
          redirect: searchParams.get('redirect') || searchParams.get('next'),
          role: result.user?.role,
          locale,
        }),
        { replace: true }
      );
    } catch (err) {
      setError(err.message || copy.errGeneric);
    } finally {
      setLoading(false);
    }
  };

  const benefitIcons = [BookOpenCheck, AudioLines, Route];
  const benefits = (copy.benefits || baseCopy.benefits).map((b, idx) => ({
    icon: benefitIcons[idx],
    ...b,
  }));

  return (
    <main className="wn-public-shell" dir={dir}>
      <SEOHead page={{ title: copy.seoTitle, url: '/login', noindex: true }} />
      <div className="wn-auth-layout">
        <section className="wn-auth-visual">
          <div className="wn-auth-visual__content">
            <div>
              <BrandLogo size={60} variant="light" to={lp('/')} />
              <span className="wn-auth-visual__eyebrow" style={{ marginTop: '2.6rem' }}>
                <Sparkles size={14} aria-hidden="true" />
                {copy.eyebrow}
              </span>
              <h2>
                {copy.visualTitleA}<strong>{copy.visualTitleB}</strong>
              </h2>
              <p className="wn-auth-visual__lead">
                {copy.visualLead}
              </p>

              <div className="wn-auth-benefits">
                {benefits.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="wn-auth-benefit">
                    <span><Icon size={17} aria-hidden="true" /></span>
                    <div>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="wn-auth-verse">
              <p>وَقُل رَّبِّ زِدْنِي عِلْمًا</p>
              <span>{copy.verseRef}</span>
            </div>
          </div>
        </section>

        <section className="wn-auth-form-side">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .45 }}
            className="wn-public-form-card"
          >
            <div className="wn-public-form-card__header">
              <div className="lg:hidden flex justify-center">
                <BrandLogo size={54} to={lp('/')} />
              </div>
              <span className="wn-public-eyebrow">{copy.formEyebrow}</span>
              <h1>{copy.formTitle}</h1>
              <p>{copy.formSubtitle}</p>
            </div>

            {loginNotice && (
              <div className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-4 text-[var(--wn-text-primary)]" role="status">
                <strong className="block mb-1 text-[var(--wn-heading)]">{loginNotice.title}</strong>
                <p className="text-sm leading-6 text-[var(--wn-text-secondary)]">{loginNotice.text}</p>
              </div>
            )}
            {error && <div id="login-error" className="wn-public-error" role="alert">{error}</div>}

            <div className="mb-3">
              <p className="text-sm font-semibold mb-2 text-[var(--wn-text-primary)]">{copy.rolePrompt}</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={copy.roleGroupLabel}>
                {[
                  ['student', copy.roleStudent],
                  ['guardian', copy.roleGuardian]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGoogleRole(value)}
                    aria-pressed={googleRole === value}
                    className={`min-h-[44px] rounded-xl border p-2 text-sm font-bold transition ${
                      googleRole === value
                        ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]'
                        : 'border-[var(--wn-border-strong)] bg-[var(--wn-surface)] text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--wn-text-secondary)]">{copy.roleHint}</p>
            </div>

            <GoogleSignIn context="signin" role={googleRole} />

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="wn-field">
                <label htmlFor="login-email">{copy.emailLabel}</label>
                <div className="wn-field__control">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="text"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                    autoComplete="username"
                    inputMode="text"
                    enterKeyHint="next"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={copy.emailPlaceholder || 'example@email.com / +2010XXXXXXXX'}
                    dir="auto"
                  />
                </div>
              </div>

              <div className="wn-field">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="login-password">{copy.passwordLabel}</label>
                  <Link
                    to={lp('/forgot-password')}
                    className="min-h-[44px] inline-flex items-center px-1 text-xs font-semibold text-[var(--wn-text-gold)] hover:underline"
                  >
                    {copy.forgotPassword}
                  </Link>
                </div>
                <div className="wn-field__control">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    placeholder="••••••••"
                    dir="auto"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="wn-field__eye min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                    <span className="sr-only">{copy.signingIn}</span>
                  </>
                ) : (
                  <>
                    <span>{copy.submitBtn}</span>
                    <ArrowIcon size={17} aria-hidden="true" />
                  </>
                )}
              </button>

              {import.meta.env.DEV && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    if (loading) return;
                    setFormData({ email: 'admin@wahy.com', password: 'Admin123456!' });
                    setLoading(true);
                    setError('');
                    try {
                      const result = await signIn('admin@wahy.com', 'Admin123456!');
                      if (!result.success) throw new Error(result.error);
                      navigate(postAuthDestination({ redirect: searchParams.get('redirect') || searchParams.get('next'), role: result.user?.role, locale }), { replace: true });
                    } catch (err) {
                      setError(err.message || copy.errGeneric);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-4 py-2.5 text-xs font-bold text-[var(--wn-heading)] hover:opacity-90 transition"
                >
                  {isRTL ? 'دخول سريع لحساب الإدارة المحلي (admin@wahy.com)' : 'Quick Local Admin Sign-in (admin@wahy.com)'}
                </button>
              )}
            </form>

            <div className="wn-auth-divider">{copy.newAccountDivider}</div>

            <div className="wn-auth-role-grid">
              <button type="button" onClick={() => navigate(lp('/register/student') + redirectQuery)} className="wn-auth-role min-h-[44px]">
                <User size={16} aria-hidden="true" />
                {copy.createStudent}
              </button>
              <button type="button" onClick={() => navigate(lp('/register/guardian') + redirectQuery)} className="wn-auth-role min-h-[44px]">
                <Users size={16} aria-hidden="true" />
                {copy.createGuardian}
              </button>
            </div>

            <div className="wn-auth-back">
              <Link to={lp('/')} className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3">
                <ArrowIcon size={14} aria-hidden="true" />
                {copy.backHome}
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
