import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Sparkles } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function ResetPassword() {
  const { locale, isRTL, dir } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [searchParams] = useSearchParams();
  const [token] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hashToken = hashParams.get('token');
      if (hashToken) return hashToken;
    }
    return searchParams.get('token') || '';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.search.includes('token=') || window.location.hash.includes('token='))) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(token ? 'form' : 'invalid');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setMessage('');

    if (form.password.length < 8) {
      setMessage(isRTL ? 'كلمة المرور يجب ألا تقل عن 8 أحرف.' : 'Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage(isRTL ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        token,
        newPassword: form.password,
      });
      setStatus('success');
    } catch (error) {
      setMessage(
        error?.message ||
        (isRTL ? 'الرابط غير صالح أو انتهت صلاحيته.' : 'This reset link is invalid or has expired.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wn-public-shell min-h-screen grid place-items-center p-4" dir={dir}>
      <SEOHead page={{ title: isRTL ? 'تعيين كلمة مرور جديدة' : 'Set a new password', url: '/reset-password', noindex: true }} />
      <div className="wn-public-form-card">
        <div className="wn-public-form-card__header">
          <div className="flex justify-center">
            <BrandLogo size={54} to={localizedPath('/', locale)} />
          </div>
          <span className="wn-public-eyebrow mt-5">
            <Sparkles size={13} aria-hidden="true" /> {isRTL ? 'تأمين الحساب' : 'SECURE YOUR ACCOUNT'}
          </span>
          <h1>{isRTL ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}</h1>
          <p>
            {isRTL
              ? 'اكتب كلمة مرور جديدة وقوية لحسابك.'
              : 'Choose a new, strong password for your account.'}
          </p>
        </div>

        {status === 'success' ? (
          <div className="text-center" role="status">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]">
              <KeyRound size={25} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">
              {isRTL
                ? 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.'
                : 'Your password was changed successfully. You can sign in now.'}
            </p>
            <Link to={localizedPath('/login', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]">
              {isRTL ? 'تسجيل الدخول' : 'Sign in'}
              <ArrowIcon size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : status === 'invalid' ? (
          <div className="text-center" role="alert">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-danger-soft)] text-[var(--wn-danger)]">
              <LockKeyhole size={25} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">
              {isRTL
                ? 'رابط استعادة كلمة المرور غير مكتمل. اطلب رابطًا جديدًا.'
                : 'This password reset link is incomplete. Request a new one.'}
            </p>
            <Link to={localizedPath('/forgot-password', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]">
              {isRTL ? 'طلب رابط جديد' : 'Request a new link'}
              <ArrowIcon size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="wn-field">
              <label htmlFor="new-password">{isRTL ? 'كلمة المرور الجديدة' : 'New password'}</label>
              <div className="wn-field__control">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  required
                  aria-invalid={Boolean(message)}
                  aria-describedby={message ? 'reset-pw-error' : undefined}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="wn-field__eye min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide password') : (isRTL ? 'إظهار كلمة المرور' : 'Show password')}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="wn-field">
              <label htmlFor="confirm-password">{isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}</label>
              <div className="wn-field__control">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  required
                  aria-invalid={Boolean(message)}
                  aria-describedby={message ? 'reset-pw-error' : undefined}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
              </div>
            </div>

            {message && (
              <p id="reset-pw-error" role="alert" className="text-sm text-[var(--wn-danger)]">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                  <span className="sr-only">{isRTL ? 'جاري الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  {isRTL ? 'حفظ كلمة المرور الجديدة' : 'Save new password'}
                  <ArrowIcon size={16} aria-hidden="true" />
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
