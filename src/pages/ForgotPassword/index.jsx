import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function ForgotPassword() {
  const { locale, isRTL, dir } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setStatus('');
    setMessage('');

    try {
      await api.post('/api/auth/forgot-password', { email });
      setStatus('success');
    } catch (error) {
      if (error?.status === 503) {
        setStatus('unavailable');
        setMessage(
          isRTL
            ? 'خدمة البريد الخاصة باستعادة كلمة المرور غير متاحة مؤقتًا. حاول مرة أخرى لاحقًا.'
            : 'Password recovery email is temporarily unavailable. Please try again later.'
        );
      } else {
        setStatus('success');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wn-public-shell min-h-screen grid place-items-center p-4" dir={dir}>
      <SEOHead page={{ title: isRTL ? 'استعادة كلمة المرور' : 'Reset password', url: '/forgot-password', noindex: true }} />
      <div className="wn-public-form-card">
        <div className="wn-public-form-card__header">
          <div className="flex justify-center"><BrandLogo size={54} to={localizedPath('/', locale)} /></div>
          <span className="wn-public-eyebrow mt-5"><Sparkles size={13} aria-hidden="true" /> {isRTL ? 'استعادة الوصول' : 'ACCOUNT RECOVERY'}</span>
          <h1>{isRTL ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}</h1>
          <p>{isRTL ? 'أدخل بريدك، وإذا كان مرتبطًا بحساب سنرسل تعليمات الاستعادة.' : 'Enter your email. If it belongs to an account, recovery instructions will be sent.'}</p>
        </div>

        {status === 'success' ? (
          <div className="text-center" role="status">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]"><KeyRound size={25} aria-hidden="true" /></div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">
              {isRTL ? 'لو البريد مسجل عندنا، ستصلك رسالة تحتوي على الخطوة التالية.' : 'If the email is registered, you will receive the next step by email.'}
            </p>
            <Link to={localizedPath('/login', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]">
              {isRTL ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
              <ArrowIcon size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : status === 'unavailable' ? (
          <div className="text-center" role="alert">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-gold-soft)] text-[var(--wn-text-gold)]"><Mail size={25} aria-hidden="true" /></div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">{message}</p>
            <button
              type="button"
              onClick={() => setStatus('')}
              className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]"
            >
              {isRTL ? 'المحاولة مرة أخرى' : 'Try again'}
              <ArrowIcon size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="wn-field">
              <label htmlFor="recovery-email">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
              <div className="wn-field__control">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@email.com"
                  dir="auto"
                />
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
                  <span className="sr-only">{isRTL ? 'جاري الإرسال...' : 'Sending...'}</span>
                </>
              ) : (
                <>
                  {isRTL ? 'إرسال تعليمات الاستعادة' : 'Send recovery instructions'} <ArrowIcon size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="wn-auth-back">
          <Link to={localizedPath('/', locale)} className="min-h-[44px] inline-flex items-center px-3">
            {isRTL ? 'العودة للرئيسية' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  );
}
