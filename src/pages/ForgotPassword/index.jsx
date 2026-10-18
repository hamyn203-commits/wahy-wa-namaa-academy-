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
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
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
          isAr
            ? 'خدمة البريد الخاصة باستعادة كلمة المرور غير متاحة مؤقتًا. حاول مرة أخرى لاحقًا.'
            : 'Password recovery email is temporarily unavailable. Please try again later.'
        );
      } else {
        // Keep the same account-agnostic response for all other failures.
        setStatus('success');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wn-public-shell min-h-screen grid place-items-center p-4">
      <SEOHead page={{ title: isAr ? 'استعادة كلمة المرور' : 'Reset password', url: '/forgot-password' }} />
      <div className="wn-public-form-card">
        <div className="wn-public-form-card__header">
          <div className="flex justify-center"><BrandLogo size={54} to={localizedPath('/', locale)} /></div>
          <span className="wn-public-eyebrow mt-5"><Sparkles size={13} /> {isAr ? 'استعادة الوصول' : 'ACCOUNT RECOVERY'}</span>
          <h2>{isAr ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}</h2>
          <p>{isAr ? 'أدخل بريدك، وإذا كان مرتبطًا بحساب سنرسل تعليمات الاستعادة.' : 'Enter your email. If it belongs to an account, recovery instructions will be sent.'}</p>
        </div>

        {status === 'success' ? (
          <div className="wn-public-feedback wn-public-feedback--success">
            <div className="wn-public-feedback__icon"><KeyRound size={25} /></div>
            <p className="wn-public-feedback__message">
              {isAr ? 'لو البريد مسجل عندنا، ستصلك رسالة تحتوي على الخطوة التالية.' : 'If the email is registered, you will receive the next step by email.'}
            </p>
            <Link to={localizedPath('/login', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5">
              {isAr ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
              <ArrowIcon size={15} />
            </Link>
          </div>
        ) : status === 'unavailable' ? (
          <div className="wn-public-feedback wn-public-feedback--warning">
            <div className="wn-public-feedback__icon"><Mail size={25} /></div>
            <p className="wn-public-feedback__message">{message}</p>
            <button
              type="button"
              onClick={() => setStatus('')}
              className="wn-btn wn-btn--primary wn-btn--block mt-5"
            >
              {isAr ? 'المحاولة مرة أخرى' : 'Try again'}
              <ArrowIcon size={15} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="wn-field">
              <label htmlFor="recovery-email">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
              <div className="wn-field__control">
                <Mail size={18} />
                <input id="recovery-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" dir="auto" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg disabled:opacity-60">
              {loading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : <>{isAr ? 'إرسال تعليمات الاستعادة' : 'Send recovery instructions'} <ArrowIcon size={16} /></>}
            </button>
          </form>
        )}

        <div className="wn-auth-back">
          <Link to={localizedPath('/', locale)}>{isAr ? 'العودة للرئيسية' : 'Back to home'}</Link>
        </div>
      </div>
    </main>
  );
}
