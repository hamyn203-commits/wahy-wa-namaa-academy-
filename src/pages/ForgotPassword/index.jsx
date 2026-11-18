import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const FORGOT_COPY = {
  ar: {
    seoTitle: 'استعادة كلمة المرور',
    eyebrow: 'استعادة الوصول',
    title: 'نسيت كلمة المرور؟',
    subtitle: 'أدخل بريدك، وإذا كان مرتبطًا بحساب سنرسل تعليمات الاستعادة.',
    successText: 'لو البريد مسجل عندنا، ستصلك رسالة تحتوي على الخطوة التالية.',
    backToLogin: 'العودة لتسجيل الدخول',
    unavailableMsg: 'خدمة البريد الخاصة باستعادة كلمة المرور غير متاحة مؤقتًا. حاول مرة أخرى لاحقًا.',
    tryAgain: 'المحاولة مرة أخرى',
    emailLabel: 'البريد الإلكتروني',
    sending: 'جاري الإرسال...',
    submit: 'إرسال تعليمات الاستعادة',
    backHome: 'العودة للرئيسية',
  },
  en: {
    seoTitle: 'Reset password',
    eyebrow: 'ACCOUNT RECOVERY',
    title: 'Forgot your password?',
    subtitle: 'Enter your email. If it belongs to an account, recovery instructions will be sent.',
    successText: 'If the email is registered, you will receive the next step by email.',
    backToLogin: 'Back to sign in',
    unavailableMsg: 'Password recovery email is temporarily unavailable. Please try again later.',
    tryAgain: 'Try again',
    emailLabel: 'Email',
    sending: 'Sending...',
    submit: 'Send recovery instructions',
    backHome: 'Back to home',
  },
  fr: {
    seoTitle: 'Réinitialiser le mot de passe',
    eyebrow: 'RÉCUPÉRATION DE COMPTE',
    title: 'Mot de passe oublié ?',
    subtitle: 'Saisissez votre e-mail. S’il correspond à un compte, vous recevrez les instructions de récupération.',
    successText: 'Si cette adresse est enregistrée, vous recevrez la prochaine étape par e-mail.',
    backToLogin: 'Retour à la connexion',
    unavailableMsg: 'L’envoi d’e-mails de récupération est temporairement indisponible. Veuillez réessayer plus tard.',
    tryAgain: 'Réessayer',
    emailLabel: 'Adresse e-mail',
    sending: 'Envoi en cours...',
    submit: 'Envoyer les instructions',
    backHome: 'Retour à l’accueil',
  },
  de: {
    seoTitle: 'Passwort zurücksetzen',
    eyebrow: 'KONTOWIEDERHERSTELLUNG',
    title: 'Passwort vergessen?',
    subtitle: 'Geben Sie Ihre E-Mail-Adresse ein. Wenn ein Konto existiert, erhalten Sie Anweisungen zur Wiederherstellung.',
    successText: 'Falls die E-Mail-Adresse registriert ist, erhalten Sie die weiteren Schritte per E-Mail.',
    backToLogin: 'Zurück zur Anmeldung',
    unavailableMsg: 'Der E-Mail-Versand zur Passwortwiederherstellung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
    tryAgain: 'Erneut versuchen',
    emailLabel: 'E-Mail-Adresse',
    sending: 'Wird gesendet...',
    submit: 'Anweisungen senden',
    backHome: 'Zurück zur Startseite',
  },
  tr: {
    seoTitle: 'Şifre sıfırlama',
    eyebrow: 'HESAP KURTARMA',
    title: 'Şifrenizi mi unuttunuz?',
    subtitle: 'E-postanızı girin. Bir hesapla eşleşirse kurtarma talimatları gönderilecektir.',
    successText: 'E-posta adresiniz kayıtlıysa sonraki adımları içeren bir ileti alacaksınız.',
    backToLogin: 'Girişe dön',
    unavailableMsg: 'Şifre kurtarma e-posta hizmeti geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    tryAgain: 'Tekrar dene',
    emailLabel: 'E-posta',
    sending: 'Gönderiliyor...',
    submit: 'Kurtarma talimatlarını gönder',
    backHome: 'Ana sayfaya dön',
  },
  ur: {
    seoTitle: 'پاس ورڈ بحال کریں',
    eyebrow: 'اکاؤنٹ کی بحالی',
    title: 'پاس ورڈ بھول گئے؟',
    subtitle: 'اپنا ای میل درج کریں۔ اگر یہ کسی اکاؤنٹ سے منسلک ہوا تو بحالی کی ہدایات بھیج دی جائیں گی۔',
    successText: 'اگر یہ ای میل ہمارے پاس رجسٹرڈ ہے تو آپ کو اگلا مرحلہ ای میل کے ذریعے موصول ہوگا۔',
    backToLogin: 'لاگ ان پر واپس جائیں',
    unavailableMsg: 'پاس ورڈ بحالی کی ای میل سروس عارضی طور پر دستیاب نہیں ہے۔ براہِ کرم بعد میں کوشش کریں۔',
    tryAgain: 'دوبارہ کوشش کریں',
    emailLabel: 'ای میل',
    sending: 'بھیجا جا رہا ہے...',
    submit: 'بحالی کی ہدایات بھیجیں',
    backHome: 'ہوم پر واپس جائیں',
  },
  id: {
    seoTitle: 'Atur ulang kata sandi',
    eyebrow: 'PEMULIHAN AKUN',
    title: 'Lupa kata sandi Anda?',
    subtitle: 'Masukkan email Anda. Jika terdaftar pada sebuah akun, petunjuk pemulihan akan dikirim.',
    successText: 'Jika email terdaftar, Anda akan menerima langkah berikutnya melalui email.',
    backToLogin: 'Kembali ke halaman masuk',
    unavailableMsg: 'Layanan email pemulihan kata sandi sedang tidak tersedia sementara. Silakan coba lagi nanti.',
    tryAgain: 'Coba lagi',
    emailLabel: 'Email',
    sending: 'Mengirim...',
    submit: 'Kirim petunjuk pemulihan',
    backHome: 'Kembali ke beranda',
  },
  ms: {
    seoTitle: 'Tetapkan semula kata laluan',
    eyebrow: 'PEMULIHAN AKAUN',
    title: 'Terlupa kata laluan anda?',
    subtitle: 'Masukkan e-mel anda. Jika ia berdaftar dengan akaun, arahan pemulihan akan dihantar.',
    successText: 'Jika e-mel ini berdaftar, anda akan menerima langkah seterusnya melalui e-mel.',
    backToLogin: 'Kembali ke log masuk',
    unavailableMsg: 'Perkhidmatan e-mel pemulihan kata laluan tidak tersedia buat sementara waktu. Sila cuba lagi nanti.',
    tryAgain: 'Cuba lagi',
    emailLabel: 'E-mel',
    sending: 'Menghantar...',
    submit: 'Hantar arahan pemulihan',
    backHome: 'Kembali ke laman utama',
  },
  ku: {
    seoTitle: 'گەڕاندنەوەی وشەی تێپەڕ',
    eyebrow: 'گەڕاندنەوەی هەژمار',
    title: 'وشەی تێپەڕت لەبیرچووە؟',
    subtitle: 'ئیمەیڵەکەت بنووسە. ئەگەر پەیوەست بێت بە هەژمارێکەوە، ڕێنماییەکانی گەڕاندنەوە دەنێردرێت.',
    successText: 'ئەگەر ئیمەیڵەکە تۆمارکرابێت، پەیامێکت پێدەگات کە هەنگاوی داهاتووی تێدایە.',
    backToLogin: 'گەڕانەوە بۆ چوونەژوورەوە',
    unavailableMsg: 'خزمەتگوزاری ئیمەیڵی گەڕاندنەوەی وشەی تێپەڕ بە شێوەیەکی کاتی بەردەست نییە. تکایە دواتر هەوڵبدەرەوە.',
    tryAgain: 'دووبارە هەوڵبدەرەوە',
    emailLabel: 'ئیمەیڵ',
    sending: 'دەنێردرێت...',
    submit: 'ناردنی ڕێنماییەکانی گەڕاندنەوە',
    backHome: 'گەڕانەوە بۆ سەرەکی',
  },
};

export default function ForgotPassword() {
  const { locale, isRTL, dir } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = FORGOT_COPY[locale] || FORGOT_COPY.en;
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
        setMessage(copy.unavailableMsg);
      } else {
        setStatus('success');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wn-public-shell min-h-screen grid place-items-center p-4" dir={dir}>
      <SEOHead page={{ title: copy.seoTitle, url: '/forgot-password', noindex: true }} />
      <div className="wn-public-form-card">
        <div className="wn-public-form-card__header">
          <div className="flex justify-center"><BrandLogo size={54} to={localizedPath('/', locale)} /></div>
          <span className="wn-public-eyebrow mt-5"><Sparkles size={13} aria-hidden="true" /> {copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        {status === 'success' ? (
          <div className="text-center" role="status">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]"><KeyRound size={25} aria-hidden="true" /></div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">
              {copy.successText}
            </p>
            <Link to={localizedPath('/login', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]">
              {copy.backToLogin}
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
              {copy.tryAgain}
              <ArrowIcon size={15} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="wn-field">
              <label htmlFor="recovery-email">{copy.emailLabel}</label>
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
                  <span className="sr-only">{copy.sending}</span>
                </>
              ) : (
                <>
                  {copy.submit} <ArrowIcon size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="wn-auth-back">
          <Link to={localizedPath('/', locale)} className="min-h-[44px] inline-flex items-center px-3">
            {copy.backHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
