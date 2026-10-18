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
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { postAuthDestination } from '../../lib/navigation';
import { useAuth } from '../../hooks/useAuth.jsx';
import '../../styles/public-experience.css';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: signIn } = useAuth();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const lp = (path) => localizedPath(path, locale);

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
    setLoading(true);
    setError('');

    try {
      const result = await signIn(formData.email, formData.password);
      if (!result.success) {
        const teacherNotices = {
          TEACHER_APPROVAL_PENDING: {
            title: isAr ? 'طلبك في انتظار موافقة الإدارة' : 'Your application is awaiting approval',
            text: isAr
              ? 'تم استلام طلبك بنجاح، ولن يتم فتح لوحة المعلم إلا بعد مراجعة الإدارة واعتماد الطلب.'
              : 'Your application was received. Teacher access will open only after administration review and approval.',
          },
          TEACHER_APPLICATION_UNDER_REVIEW: {
            title: isAr ? 'طلبك ما زال قيد المراجعة' : 'Your application is still under review',
            text: isAr
              ? 'الإدارة تراجع بياناتك ومستنداتك حاليًا. لا يوجد دخول إلى لوحة المعلم حتى اكتمال المراجعة.'
              : 'Administration is reviewing your details and documents. Teacher access stays locked until the review is complete.',
          },
          TEACHER_APPLICATION_REJECTED: {
            title: isAr ? 'تعذر اعتماد طلب المعلم' : 'Teacher application not approved',
            text: isAr
              ? 'يمكنك التواصل مع إدارة الأكاديمية لمعرفة الخطوة التالية أو إعادة التقديم عند السماح بذلك.'
              : 'Contact academy administration for the next step or to reapply when allowed.',
          },
          TEACHER_ACCOUNT_SUSPENDED: {
            title: isAr ? 'حساب المعلم موقوف' : 'Teacher account suspended',
            text: isAr
              ? 'تواصل مع إدارة الأكاديمية لمراجعة حالة الحساب.'
              : 'Contact academy administration to review the account status.',
          },
        };

        if (teacherNotices[result.code]) {
          setLoginNotice(teacherNotices[result.code]);
          return;
        }

        throw new Error(result.error || (isAr ? 'تعذر تسجيل الدخول' : 'Unable to sign in'));
      }

      navigate(
        postAuthDestination({
          redirect: searchParams.get('redirect'),
          role: result.user?.role,
          locale,
        }),
        { replace: true }
      );
    } catch (err) {
      setError(err.message || (isAr ? 'تعذر تسجيل الدخول' : 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: BookOpenCheck,
      title: isAr ? 'كل رحلتك في مكان واحد' : 'Your journey in one place',
      text: isAr ? 'الحصص، الحفظ، المراجعة، والتقارير.' : 'Lessons, memorization, review, and reports.',
    },
    {
      icon: AudioLines,
      title: isAr ? 'أدوات للتلاوة والمتابعة' : 'Recitation and follow-up tools',
      text: isAr ? 'راجع أداءك وارجع للجلسة بهدف أوضح.' : 'Review your performance and return with a clearer goal.',
    },
    {
      icon: Route,
      title: isAr ? 'مسار واضح للتقدم' : 'A clear progress path',
      text: isAr ? 'اعرف ما أنجزت وما هي الخطوة التالية.' : 'Know what you completed and what comes next.',
    },
  ];

  return (
    <main className="wn-public-shell">
      <div className="wn-auth-layout">
        <section className="wn-auth-visual">
          <div className="wn-auth-visual__content">
            <div>
              <BrandLogo size={60} variant="light" to={lp('/')} />
              <span className="wn-auth-visual__eyebrow wn-auth-visual__eyebrow--spaced">
                <Sparkles size={14} />
                {isAr ? 'مرحبًا بعودتك إلى وحي ونماء' : 'WELCOME BACK TO WAHY WA NAMAA'}
              </span>
              <h1>
                {isAr ? <>أكمل رحلتك مع القرآن.<strong>من حيث توقفت.</strong></> : <>Continue your Quran journey.<strong>Right where you left off.</strong></>}
              </h1>
              <p className="wn-auth-visual__lead">
                {isAr
                  ? 'دخول واحد يوصلك إلى جلساتك، مسارك التعليمي، أدوات التلاوة، وتقارير التقدم.'
                  : 'One sign-in gives you access to lessons, your learning path, recitation tools, and progress reports.'}
              </p>

              <div className="wn-auth-benefits">
                {benefits.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="wn-auth-benefit">
                    <span><Icon size={17} /></span>
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
              <span>{isAr ? 'طه: ١١٤' : 'Taha 20:114'}</span>
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
              <span className="wn-public-eyebrow">{isAr ? 'حسابك في الأكاديمية' : 'YOUR ACADEMY ACCOUNT'}</span>
              <h2>{isAr ? 'تسجيل الدخول' : 'Sign in'}</h2>
              <p>{isAr ? 'أدخل بياناتك للعودة إلى مساحة التعلم.' : 'Enter your details to return to your learning space.'}</p>
            </div>

            {loginNotice && (
              <div className="wn-public-notice wn-public-notice--warning" role="status">
                <strong>{loginNotice.title}</strong>
                <p>{loginNotice.text}</p>
              </div>
            )}
            {error && <div className="wn-public-error" role="alert">{error}</div>}

            <div className="mb-3">
              <p className="text-sm font-semibold mb-2">{isAr ? 'لو معندكش حساب، اختر نوعه قبل الدخول بجوجل' : 'New here? Choose your account type before continuing with Google'}</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={isAr ? 'نوع الحساب' : 'Account type'}>
                {[
                  ['student', isAr ? 'طالب' : 'Student'],
                  ['teacher', isAr ? 'معلم' : 'Teacher'],
                  ['guardian', isAr ? 'ولي أمر' : 'Guardian']
                ].map(([value, label]) => <button key={value} type="button" onClick={() => setGoogleRole(value)}
                  aria-pressed={googleRole === value}
                  className={`rounded-xl border p-2 text-sm font-bold ${googleRole === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>{label}</button>)}
              </div>
              <p className="mt-2 text-xs text-slate-500">{isAr ? 'لو عندك حساب بالفعل، هنفتح حسابك الحالي بنفس نوعه دون تغييره.' : 'Existing accounts retain their registered role.'}</p>
            </div>
            <GoogleSignIn context="signin" role={googleRole} />
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="wn-field">
                <label htmlFor="login-email">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                <div className="wn-field__control">
                  <Mail size={18} />
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    placeholder="example@email.com"
                    dir="auto"
                  />
                </div>
              </div>

              <div className="wn-field">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="login-password">{isAr ? 'كلمة المرور' : 'Password'}</label>
                  <Link to={lp('/forgot-password')} className="text-[11px] font-semibold text-[var(--wn-gold-dark)] hover:underline">
                    {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </Link>
                </div>
                <div className="wn-field__control">
                  <Lock size={18} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    dir="auto"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="wn-field__eye"
                    aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg disabled:opacity-60">
                {loading ? (
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <span>{isAr ? 'دخول إلى حسابي' : 'Sign in to my account'}</span>
                    <ArrowIcon size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="wn-auth-divider">{isAr ? 'حساب جديد' : 'New account'}</div>

            <div className="wn-auth-role-grid">
              <button type="button" onClick={() => navigate(lp('/register/student') + (searchParams.get('redirect') ? '?redirect=' + encodeURIComponent(searchParams.get('redirect')) : ''))} className="wn-auth-role">
                <User size={16} />
                {isAr ? 'إنشاء حساب طالب' : 'Student account'}
              </button>
              <button type="button" onClick={() => navigate(lp('/register/guardian'))} className="wn-auth-role">
                <Users size={16} />
                {isAr ? 'إنشاء حساب ولي أمر' : 'Parent account'}
              </button>
            </div>

            <div className="wn-auth-back">
              <Link to={lp('/')}>
                <ArrowIcon size={14} />
                {isAr ? 'العودة للرئيسية' : 'Back to home'}
              </Link>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}