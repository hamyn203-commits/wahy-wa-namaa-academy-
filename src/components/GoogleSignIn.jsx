import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth.jsx';
import { postAuthDestination } from '../lib/navigation';
import { localizedPath } from '../lib/locale';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const GOOGLE_COPY = {
  ar: {
    orContinue: 'أو المتابعة باستخدام',
    scriptErr: 'تعذر تحميل تسجيل الدخول بجوجل. جرّب تحديث الصفحة.',
    signinErr: 'تعذر تسجيل الدخول بجوجل.',
    loading: 'جاري تحميل خيار جوجل...',
    verifying: 'جاري التحقق من الحساب...',
  },
  en: {
    orContinue: 'Or continue with',
    scriptErr: 'Could not load Google sign-in. Refresh the page.',
    signinErr: 'Google sign-in failed.',
    loading: 'Loading Google sign-in...',
    verifying: 'Verifying your account...',
  },
  fr: {
    orContinue: 'Ou continuer avec',
    scriptErr: 'Impossible de charger la connexion Google. Actualisez la page.',
    signinErr: 'La connexion Google a échoué.',
    loading: 'Chargement de Google...',
    verifying: 'Vérification du compte...',
  },
  de: {
    orContinue: 'Oder fortfahren mit',
    scriptErr: 'Google-Anmeldung konnte nicht geladen werden. Seite neu laden.',
    signinErr: 'Google-Anmeldung fehlgeschlagen.',
    loading: 'Google-Anmeldung wird geladen...',
    verifying: 'Konto wird überprüft...',
  },
  tr: {
    orContinue: 'Veya şununla devam et',
    scriptErr: 'Google ile giriş yüklenemedi. Sayfayı yenileyin.',
    signinErr: 'Google ile giriş başarısız oldu.',
    loading: 'Google girişi yükleniyor...',
    verifying: 'Hesabınız doğrulanıyor...',
  },
  ur: {
    orContinue: 'یا اس کے ساتھ جاری رکھیں',
    scriptErr: 'گوگل سائن ان لوڈ نہیں ہو سکا۔ صفحہ ریفریش کریں۔',
    signinErr: 'گوگل سائن ان ناکام ہو گیا۔',
    loading: 'گوگل سائن ان لوڈ ہو رہا ہے...',
    verifying: 'اکاؤنٹ کی تصدیق ہو رہی ہے...',
  },
  id: {
    orContinue: 'Atau lanjutkan dengan',
    scriptErr: 'Tidak dapat memuat masuk dengan Google. Muat ulang halaman.',
    signinErr: 'Masuk dengan Google gagal.',
    loading: 'Memuat Google Sign-In...',
    verifying: 'Memverifikasi akun Anda...',
  },
  ms: {
    orContinue: 'Atau teruskan dengan',
    scriptErr: 'Tidak dapat memuatkan log masuk Google. Muat semula halaman.',
    signinErr: 'Log masuk Google gagal.',
    loading: 'Memuatkan log masuk Google...',
    verifying: 'Mengesahkan akaun anda...',
  },
  ku: {
    orContinue: 'یان بەردەوامبە لەگەڵ',
    scriptErr: 'بارکردنی چوونەژوورەوەی گووگڵ سەرکەوتوو نەبوو. پەڕەکە نوێ بکەرەوە.',
    signinErr: 'چوونەژوورەوە بە گووگڵ سەرکەوتوو نەبوو.',
    loading: 'گووگڵ باردەکرێت...',
    verifying: 'هەژمارەکەت پشتڕاست دەکرێتەوە...',
  },
};

export default function GoogleSignIn({ context = 'signin', role = 'student', enrollmentSection }) {
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const [error, setError] = useState('');
  const [gsiReady, setGsiReady] = useState(Boolean(typeof window !== 'undefined' && window.google?.accounts?.id));
  const [verifying, setVerifying] = useState(false);
  const { googleLogin } = useAuth();
  const { locale, isRTL } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const copy = GOOGLE_COPY[locale] || (isRTL ? GOOGLE_COPY.ar : GOOGLE_COPY.en);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let active = true;
    const scriptId = 'google-identity-services';
    let script = document.getElementById(scriptId);

    const start = () => {
      if (!active || !window.google?.accounts?.id || !buttonRef.current) return;
      setGsiReady(true);
      const containerWidth = containerRef.current?.clientWidth || 320;
      const clampedWidth = Math.min(320, Math.max(220, containerWidth));
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        callback: async (response) => {
          if (!active || !response?.credential) return;
          setVerifying(true);
          setError('');
          let result;
          try {
            result = await googleLogin(response.credential, role, context, enrollmentSection);
          } catch (err) {
            if (active) {
              setError(err?.message || copy.signinErr);
              setVerifying(false);
            }
            return;
          }
          if (!active) return;
          if (!result.success) {
            setError(result.error || copy.signinErr);
            setVerifying(false);
            return;
          }
          const redirectTarget = searchParams.get('redirect') || searchParams.get('next');
          if (result.user?.onboarding?.required && !result.user?.onboarding?.completed) {
            navigate(
              localizedPath('/profile/setup', locale) + (redirectTarget ? '?next=' + encodeURIComponent(redirectTarget) : ''),
              { replace: true }
            );
            return;
          }
          navigate(postAuthDestination({
            redirect: redirectTarget,
            role: result.user?.role,
            locale,
          }), { replace: true });
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: context === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        width: clampedWidth,
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onScriptError = () => {
      if (active) setError(copy.scriptErr);
    };
    script.addEventListener('load', start);
    script.addEventListener('error', onScriptError);
    if (window.google?.accounts?.id) start();
    return () => {
      active = false;
      script?.removeEventListener('load', start);
      script?.removeEventListener('error', onScriptError);
    };
  }, [context, googleLogin, locale, navigate, searchParams, role, enrollmentSection, copy.scriptErr, copy.signinErr]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div ref={containerRef} className="my-5 space-y-2 text-center max-w-full overflow-hidden">
      <p className="text-xs text-[var(--wn-text-secondary)]">{copy.orContinue}</p>
      {!gsiReady && !error && (
        <div role="status" className="mx-auto h-[44px] max-w-[320px] rounded-lg bg-[var(--wn-surface-sunken)] border border-[var(--wn-border)] animate-pulse flex items-center justify-center text-xs text-[var(--wn-text-secondary)]">
          <span>{copy.loading}</span>
        </div>
      )}
      <div className={`flex justify-center max-w-full ${verifying ? 'opacity-60 pointer-events-none' : ''}`} ref={buttonRef} />
      {verifying && (
        <p role="status" className="text-xs text-[var(--wn-heading)] font-semibold">
          {copy.verifying}
        </p>
      )}
      {error && <p role="alert" className="text-[var(--wn-danger)] text-xs">{error}</p>}
    </div>
  );
}
