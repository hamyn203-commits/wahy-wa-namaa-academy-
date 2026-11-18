import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Sparkles } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const RESET_COPY = {
  ar: {
    seoTitle: 'تعيين كلمة مرور جديدة',
    eyebrow: 'تأمين الحساب',
    title: 'تعيين كلمة مرور جديدة',
    subtitle: 'اكتب كلمة مرور جديدة وقوية لحسابك.',
    errMinLength: 'كلمة المرور يجب ألا تقل عن 8 أحرف.',
    errMismatch: 'كلمتا المرور غير متطابقتين.',
    errInvalidLink: 'الرابط غير صالح أو انتهت صلاحيته.',
    successText: 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
    signIn: 'تسجيل الدخول',
    incompleteText: 'رابط استعادة كلمة المرور غير مكتمل. اطلب رابطًا جديدًا.',
    requestNewLink: 'طلب رابط جديد',
    newPasswordLabel: 'كلمة المرور الجديدة',
    confirmPasswordLabel: 'تأكيد كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    saving: 'جاري الحفظ...',
    saveBtn: 'حفظ كلمة المرور الجديدة',
    backHome: 'العودة للرئيسية',
  },
  en: {
    seoTitle: 'Set a new password',
    eyebrow: 'SECURE YOUR ACCOUNT',
    title: 'Set a new password',
    subtitle: 'Choose a new, strong password for your account.',
    errMinLength: 'Password must be at least 8 characters.',
    errMismatch: 'Passwords do not match.',
    errInvalidLink: 'This reset link is invalid or has expired.',
    successText: 'Your password was changed successfully. You can sign in now.',
    signIn: 'Sign in',
    incompleteText: 'This password reset link is incomplete. Request a new one.',
    requestNewLink: 'Request a new link',
    newPasswordLabel: 'New password',
    confirmPasswordLabel: 'Confirm password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    saving: 'Saving...',
    saveBtn: 'Save new password',
    backHome: 'Back to home',
  },
  fr: {
    seoTitle: 'Définir un nouveau mot de passe',
    eyebrow: 'SÉCURISER VOTRE COMPTE',
    title: 'Définir un nouveau mot de passe',
    subtitle: 'Choisissez un nouveau mot de passe robuste pour votre compte.',
    errMinLength: 'Le mot de passe doit contenir au moins 8 caractères.',
    errMismatch: 'Les mots de passe ne correspondent pas.',
    errInvalidLink: 'Ce lien de réinitialisation est invalide ou a expiré.',
    successText: 'Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.',
    signIn: 'Se connecter',
    incompleteText: 'Ce lien de réinitialisation est incomplet. Demandez-en un nouveau.',
    requestNewLink: 'Demander un nouveau lien',
    newPasswordLabel: 'Nouveau mot de passe',
    confirmPasswordLabel: 'Confirmer le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    showPassword: 'Afficher le mot de passe',
    saving: 'Enregistrement...',
    saveBtn: 'Enregistrer le mot de passe',
    backHome: 'Retour à l’accueil',
  },
  de: {
    seoTitle: 'Neues Passwort festlegen',
    eyebrow: 'KONTO ABSICHERN',
    title: 'Neues Passwort festlegen',
    subtitle: 'Wählen Sie ein neues, sicheres Passwort für Ihr Konto.',
    errMinLength: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
    errMismatch: 'Die Passwörter stimmen nicht überein.',
    errInvalidLink: 'Dieser Link zum Zurücksetzen ist ungültig oder abgelaufen.',
    successText: 'Ihr Passwort wurde erfolgreich geändert. Sie können sich jetzt anmelden.',
    signIn: 'Anmelden',
    incompleteText: 'Dieser Link zum Zurücksetzen ist unvollständig. Fordern Sie einen neuen an.',
    requestNewLink: 'Neuen Link anfordern',
    newPasswordLabel: 'Neues Passwort',
    confirmPasswordLabel: 'Passwort bestätigen',
    hidePassword: 'Passwort verbergen',
    showPassword: 'Passwort anzeigen',
    saving: 'Wird gespeichert...',
    saveBtn: 'Neues Passwort speichern',
    backHome: 'Zurück zur Startseite',
  },
  tr: {
    seoTitle: 'Yeni şifre belirle',
    eyebrow: 'HESABINIZI GÜVENCEYE ALIN',
    title: 'Yeni şifre belirle',
    subtitle: 'Hesabınız için yeni ve güçlü bir şifre seçin.',
    errMinLength: 'Şifre en az 8 karakter olmalıdır.',
    errMismatch: 'Şifreler eşleşmiyor.',
    errInvalidLink: 'Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş.',
    successText: 'Şifreniz başarıyla değiştirildi. Şimdi giriş yapabilirsiniz.',
    signIn: 'Giriş yap',
    incompleteText: 'Bu şifre sıfırlama bağlantısı eksik. Yeni bir bağlantı isteyin.',
    requestNewLink: 'Yeni bağlantı iste',
    newPasswordLabel: 'Yeni şifre',
    confirmPasswordLabel: 'Şifreyi onayla',
    hidePassword: 'Şifreyi gizle',
    showPassword: 'Şifreyi göster',
    saving: 'Kaydediliyor...',
    saveBtn: 'Yeni şifreyi kaydet',
    backHome: 'Ana sayfaya dön',
  },
  ur: {
    seoTitle: 'نیا پاس ورڈ مقرر کریں',
    eyebrow: 'اکاؤنٹ کی حفاظت',
    title: 'نیا پاس ورڈ مقرر کریں',
    subtitle: 'اپنے اکاؤنٹ کے لیے ایک نیا اور مضبوط پاس ورڈ منتخب کریں۔',
    errMinLength: 'پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے۔',
    errMismatch: 'دونوں پاس ورڈ آپس میں نہیں ملتے۔',
    errInvalidLink: 'یہ لنک غلط ہے یا اس کی مدت ختم ہو چکی ہے۔',
    successText: 'آپ کا پاس ورڈ کامیابی سے تبدیل ہو گیا ہے۔ اب آپ لاگ ان کر سکتے ہیں۔',
    signIn: 'لاگ ان کریں',
    incompleteText: 'پاس ورڈ بحال کرنے کا یہ لنک نامکمل ہے۔ نیا لنک طلب کریں۔',
    requestNewLink: 'نیا لنک طلب کریں',
    newPasswordLabel: 'نیا پاس ورڈ',
    confirmPasswordLabel: 'پاس ورڈ کی تصدیق کریں',
    hidePassword: 'پاس ورڈ چھپائیں',
    showPassword: 'پاس ورڈ دکھائیں',
    saving: 'محفوظ ہو رہا ہے...',
    saveBtn: 'نیا پاس ورڈ محفوظ کریں',
    backHome: 'ہوم پر واپس جائیں',
  },
  id: {
    seoTitle: 'Atur kata sandi baru',
    eyebrow: 'AMANKAN AKUN ANDA',
    title: 'Atur kata sandi baru',
    subtitle: 'Pilih kata sandi baru yang kuat untuk akun Anda.',
    errMinLength: 'Kata sandi minimal harus 8 karakter.',
    errMismatch: 'Kata sandi tidak cocok.',
    errInvalidLink: 'Tautan atur ulang ini tidak valid atau telah kedaluwarsa.',
    successText: 'Kata sandi Anda berhasil diubah. Sekarang Anda dapat masuk.',
    signIn: 'Masuk',
    incompleteText: 'Tautan atur ulang kata sandi ini tidak lengkap. Minta tautan baru.',
    requestNewLink: 'Minta tautan baru',
    newPasswordLabel: 'Kata sandi baru',
    confirmPasswordLabel: 'Konfirmasi kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
    showPassword: 'Tampilkan kata sandi',
    saving: 'Menyimpan...',
    saveBtn: 'Simpan kata sandi baru',
    backHome: 'Kembali ke beranda',
  },
  ms: {
    seoTitle: 'Tetapkan kata laluan baharu',
    eyebrow: 'LINDUNGI AKAUN ANDA',
    title: 'Tetapkan kata laluan baharu',
    subtitle: 'Pilih kata laluan baharu yang kukuh untuk akaun anda.',
    errMinLength: 'Kata laluan mestilah sekurang-kurangnya 8 aksara.',
    errMismatch: 'Kata laluan tidak sepadan.',
    errInvalidLink: 'Pautan tetapan semula ini tidak sah atau telah tamat tempoh.',
    successText: 'Kata laluan anda berjaya ditukar. Anda boleh log masuk sekarang.',
    signIn: 'Log masuk',
    incompleteText: 'Pautan tetapan semula kata laluan ini tidak lengkap. Minta pautan baharu.',
    requestNewLink: 'Minta pautan baharu',
    newPasswordLabel: 'Kata laluan baharu',
    confirmPasswordLabel: 'Sahkan kata laluan',
    hidePassword: 'Sembunyikan kata laluan',
    showPassword: 'Tunjukkan kata laluan',
    saving: 'Menyimpan...',
    saveBtn: 'Simpan kata laluan baharu',
    backHome: 'Kembali ke laman utama',
  },
  ku: {
    seoTitle: 'دانانی وشەی تێپەڕی نوێ',
    eyebrow: 'پاراستنی هەژمار',
    title: 'دانانی وشەی تێپەڕی نوێ',
    subtitle: 'وشەیەکی تێپەڕی نوێ و بەهێز بۆ هەژمارەکەت هەڵبژێرە.',
    errMinLength: 'وشەی تێپەڕ دەبێت لانیکەم 8 پیت بێت.',
    errMismatch: 'وشە تێپەڕەکان یەکناگرنەوە.',
    errInvalidLink: 'ئەم بەستەرە نادروستە یان کاتەکەی بەسەرچووە.',
    successText: 'وشەی تێپەڕەکەت بە سەرکەوتوویی گۆڕدرا. ئێستا دەتوانیت بچیتە ژوورەوە.',
    signIn: 'چوونەژوورەوە',
    incompleteText: 'بەستەری گەڕاندنەوەی وشەی تێپەڕ تەواو نییە. داوای بەستەرێکی نوێ بکە.',
    requestNewLink: 'داوای بەستەری نوێ بکە',
    newPasswordLabel: 'وشەی تێپەڕی نوێ',
    confirmPasswordLabel: 'دڵنیاکردنەوەی وشەی تێپەڕ',
    hidePassword: 'شاردنەوەی وشەی تێپەڕ',
    showPassword: 'پیشاندانی وشەی تێپەڕ',
    saving: 'پاشەکەوت دەکرێت...',
    saveBtn: 'پاشەکەوتکردنی وشەی تێپەڕی نوێ',
    backHome: 'گەڕانەوە بۆ سەرەکی',
  },
};

export default function ResetPassword() {
  const { locale, isRTL, dir } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = RESET_COPY[locale] || RESET_COPY.en;
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
      setMessage(copy.errMinLength);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage(copy.errMismatch);
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
      setMessage(error?.message || copy.errInvalidLink);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="wn-public-shell min-h-screen grid place-items-center p-4" dir={dir}>
      <SEOHead page={{ title: copy.seoTitle, url: '/reset-password', noindex: true }} />
      <div className="wn-public-form-card">
        <div className="wn-public-form-card__header">
          <div className="flex justify-center">
            <BrandLogo size={54} to={localizedPath('/', locale)} />
          </div>
          <span className="wn-public-eyebrow mt-5">
            <Sparkles size={13} aria-hidden="true" /> {copy.eyebrow}
          </span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        {status === 'success' ? (
          <div className="text-center" role="status">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]">
              <KeyRound size={25} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">
              {copy.successText}
            </p>
            <Link to={localizedPath('/login', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]">
              {copy.signIn}
              <ArrowIcon size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : status === 'invalid' ? (
          <div className="text-center" role="alert">
            <div className="w-14 h-14 mx-auto grid place-items-center rounded-2xl bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger,var(--wn-danger))]">
              <LockKeyhole size={25} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--wn-text-secondary)]">
              {copy.incompleteText}
            </p>
            <Link to={localizedPath('/forgot-password', locale)} className="wn-btn wn-btn--primary wn-btn--block mt-5 min-h-[44px]">
              {copy.requestNewLink}
              <ArrowIcon size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="wn-field">
              <label htmlFor="new-password">{copy.newPasswordLabel}</label>
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
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="wn-field">
              <label htmlFor="confirm-password">{copy.confirmPasswordLabel}</label>
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
              <p id="reset-pw-error" role="alert" className="text-sm text-[var(--wn-text-danger,var(--wn-danger))]">
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
                  <span className="sr-only">{copy.saving}</span>
                </>
              ) : (
                <>
                  {copy.saveBtn}
                  <ArrowIcon size={16} aria-hidden="true" />
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
