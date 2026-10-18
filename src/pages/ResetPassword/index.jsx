import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole, Sparkles } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function ResetPassword() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [status, setStatus] = useState(token ? 'form' : 'invalid');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (form.password.length < 8) {
      setMessage(isAr ? 'كلمة المرور يجب ألا تقل عن 8 أحرف.' : 'Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
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
        (isAr ? 'الرابط غير صالح أو انتهت صلاحيته.' : 'This reset link is invalid or has expired.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wn-public-shell min-h-screen grid place-items-center p-4">
      <SEOHead page={{ title: isAr ? 'تعيين كلمة مرور جديدة' : 'Set a new password', url: '/reset-password' }} />
      <div className="wn-public-form-card">
        <div className="wn-public-form-card__header">
          <div className="flex justify-center">
            <BrandLogo size={54} to={localizedPath('/', locale)} />
          </div>
          <span className="wn-public-eyebrow mt-5">
            <Sparkles size={13} /> {isAr ? 'تأمين الحساب' : 'SECURE YOUR ACCOUNT'}
          </span>
          <h2>{isAr ? 'تعيين كلمة مرور جديدة' : 'Set a new password'}</h2>
          <p>
            {isAr
              ? 'اكتب كلمة مرور جديدة وقوية لحسابك.'
              : 'Choose a new, strong password for your account.'}
          </p>
        </div>

        {status === 'success' ? (
          <div className="wn-public-feedback wn-public-feedback--success">
            <div className="wn-public-feedback__icon">
              <KeyRound size={25} />
            </div>
            <p className="wn-public-feedback__message">
              {isAr
                ? 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.'
                : 'Your password was changed successfully. You can sign in now.'}
            </p>
            <Link to={localizedPath('/login', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5">
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
              <ArrowIcon size={15} />
            </Link>
          </div>
        ) : status === 'invalid' ? (
          <div className="wn-public-feedback wn-public-feedback--error">
            <div className="wn-public-feedback__icon">
              <LockKeyhole size={25} />
            </div>
            <p className="wn-public-feedback__message">
              {isAr
                ? 'رابط استعادة كلمة المرور غير مكتمل. اطلب رابطًا جديدًا.'
                : 'This password reset link is incomplete. Request a new one.'}
            </p>
            <Link to={localizedPath('/forgot-password', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5">
              {isAr ? 'طلب رابط جديد' : 'Request a new link'}
              <ArrowIcon size={15} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="wn-field">
              <label htmlFor="new-password">{isAr ? 'كلمة المرور الجديدة' : 'New password'}</label>
              <div className="wn-field__control">
                <LockKeyhole size={18} />
                <input
                  id="new-password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
            </div>

            <div className="wn-field">
              <label htmlFor="confirm-password">{isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}</label>
              <div className="wn-field__control">
                <LockKeyhole size={18} />
                <input
                  id="confirm-password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
              </div>
            </div>

            {message && <p className="text-sm text-red-700">{message}</p>}

            <button type="submit" disabled={loading} className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg disabled:opacity-60">
              {loading
                ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                : <>
                    {isAr ? 'حفظ كلمة المرور الجديدة' : 'Save new password'}
                    <ArrowIcon size={16} />
                  </>}
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
