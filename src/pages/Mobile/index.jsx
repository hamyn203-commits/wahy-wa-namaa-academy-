import { Link } from 'react-router-dom';
import { Smartphone, Download, Share, Bell, WifiOff, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { apiUrl } from '../../config';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';

const MOBILE_COPY = {
  ar: {
    seoTitle: 'وحي ونماء على الهاتف',
    seoDesc: 'تعرف على طريقة تثبيت تجربة وحي ونماء على هاتفك كتطبيق ويب.',
    eyebrow: 'تجربة الهاتف',
    title: 'خلي وحي ونماء أقرب إليك',
    subtitle: 'يمكن تثبيت المنصة كتطبيق ويب من المتصفح للوصول السريع إلى حسابك ودروسك.',
    register: 'إنشاء حساب',
    login: 'تسجيل الدخول',
    appName: 'وحي ونماء',
    tagline: 'تعلّم • احفظ • انمُ',
    steps: [
      'استخدم خيار تثبيت التطبيق عندما يظهر في المتصفح',
      'في Safari: مشاركة ← إضافة إلى الشاشة الرئيسية',
      'فعّل الإشعارات من إعدادات حسابك إذا رغبت',
      'بعض الموارد قد تبقى متاحة بعد التثبيت حسب التخزين المحلي',
    ],
  },
  en: {
    seoTitle: 'Wahy Wa Namaa on mobile',
    seoDesc: 'Learn how to install Wahy Wa Namaa as a web app on your phone.',
    eyebrow: 'MOBILE EXPERIENCE',
    title: 'Keep Wahy Wa Namaa close at hand',
    subtitle: 'Install the platform as a web app from your browser for faster access to your account and lessons.',
    register: 'Create account',
    login: 'Sign in',
    appName: 'Wahy Wa Namaa',
    tagline: 'Learn • Memorize • Grow',
    steps: [
      'Use the install option when your browser offers it',
      'In Safari: Share → Add to Home Screen',
      'Enable notifications from account settings if you want them',
      'Some resources may remain available after install depending on local cache',
    ],
  },
  fr: {
    seoTitle: 'Wahy Wa Namaa sur mobile',
    seoDesc: 'Découvrez comment installer Wahy Wa Namaa comme application web sur votre téléphone.',
    eyebrow: 'EXPÉRIENCE MOBILE',
    title: 'Gardez Wahy Wa Namaa à portée de main',
    subtitle: 'Installez la plateforme comme application web depuis votre navigateur pour accéder plus vite à votre compte et à vos cours.',
    register: 'Créer un compte',
    login: 'Connexion',
    appName: 'Wahy Wa Namaa',
    tagline: 'Apprendre • Mémoriser • Grandir',
    steps: [
      'Utilisez l’option d’installation lorsque votre navigateur la propose',
      'Dans Safari : Partager → Sur l’écran d’accueil',
      'Activez les notifications depuis les paramètres de votre compte si vous le souhaitez',
      'Certaines ressources peuvent rester disponibles hors ligne selon le cache local',
    ],
  },
  de: {
    seoTitle: 'Wahy Wa Namaa mobil nutzen',
    seoDesc: 'Erfahren Sie, wie Sie Wahy Wa Namaa als Web-App auf Ihrem Smartphone installieren.',
    eyebrow: 'MOBILES ERLEBNIS',
    title: 'Wahy Wa Namaa immer griffbereit',
    subtitle: 'Installieren Sie die Plattform über Ihren Browser als Web-App für schnelleren Zugriff auf Konto und Unterricht.',
    register: 'Konto erstellen',
    login: 'Anmelden',
    appName: 'Wahy Wa Namaa',
    tagline: 'Lernen • Bewahren • Wachsen',
    steps: [
      'Nutzen Sie die Installationsoption, sobald Ihr Browser sie anbietet',
      'In Safari: Teilen → Zum Home-Bildschirm',
      'Aktivieren Sie bei Bedarf Benachrichtigungen in Ihren Kontoeinstellungen',
      'Einige Inhalte bleiben nach der Installation je nach lokalem Cache verfügbar',
    ],
  },
  tr: {
    seoTitle: 'Mobilde Wahy Wa Namaa',
    seoDesc: 'Wahy Wa Namaa’yı telefonunuza web uygulaması olarak nasıl kuracağınızı öğrenin.',
    eyebrow: 'MOBİL DENEYİM',
    title: 'Wahy Wa Namaa her an yanınızda olsun',
    subtitle: 'Hesabınıza ve derslerinize daha hızlı ulaşmak için platformu tarayıcınızdan web uygulaması olarak yükleyin.',
    register: 'Hesap oluştur',
    login: 'Giriş yap',
    appName: 'Wahy Wa Namaa',
    tagline: 'Öğren • Ezberle • Geliş',
    steps: [
      'Tarayıcınız sunduğunda uygulamayı yükle seçeneğini kullanın',
      'Safari’de: Paylaş → Ana Ekrana Ekle',
      'İsterseniz hesap ayarlarınızdan bildirimleri etkinleştirin',
      'Yerel önbelleğe bağlı olarak bazı kaynaklar kurulumdan sonra erişilebilir kalabilir',
    ],
  },
  ur: {
    seoTitle: 'موبائل پر وحی و نماء',
    seoDesc: 'اپنے فون پر وحی و نماء کو ویب ایپ کے طور پر انسٹال کرنے کا طریقہ جانیں۔',
    eyebrow: 'موبائل تجربہ',
    title: 'وحی و نماء کو ہمیشہ اپنے قریب رکھیں',
    subtitle: 'اپنے اکاؤنٹ اور اسباق تک تیز رسائی کے لیے اپنے براؤزر سے پلیٹ فارم کو ویب ایپ کے طور پر انسٹال کریں۔',
    register: 'اکاؤنٹ بنائیں',
    login: 'لاگ ان',
    appName: 'وحی و نماء',
    tagline: 'سیکھیں • حفظ کریں • آگے بڑھیں',
    steps: [
      'جب براؤزر انسٹال کا اختیار دکھائے تو اسے منتخب کریں',
      'Safari میں: Share ← Add to Home Screen',
      'اگر چاہیں تو اکاؤنٹ کی ترتیبات سے اطلاعات آن کریں',
      'مقامی کیش کے مطابق کچھ مواد انسٹال کے بعد بھی دستیاب رہ سکتا ہے',
    ],
  },
  id: {
    seoTitle: 'Wahy Wa Namaa di Ponsel',
    seoDesc: 'Pelajari cara memasang Wahy Wa Namaa sebagai aplikasi web di ponsel Anda.',
    eyebrow: 'PENGALAMAN SELULER',
    title: 'Jaga Wahy Wa Namaa selalu dekat dengan Anda',
    subtitle: 'Pasang platform sebagai aplikasi web dari peramban untuk akses lebih cepat ke akun dan pelajaran Anda.',
    register: 'Buat akun',
    login: 'Masuk',
    appName: 'Wahy Wa Namaa',
    tagline: 'Belajar • Hafalkan • Bertumbuh',
    steps: [
      'Gunakan opsi pemasangan saat peramban Anda menawarkannya',
      'Di Safari: Bagikan → Tambah ke Layar Utama',
      'Aktifkan notifikasi dari pengaturan akun jika diinginkan',
      'Sebagian sumber belajar tetap tersedia setelah dipasang sesuai cache lokal',
    ],
  },
  ms: {
    seoTitle: 'Wahy Wa Namaa di Telefon Bimbit',
    seoDesc: 'Ketahui cara memasang Wahy Wa Namaa sebagai aplikasi web di telefon anda.',
    eyebrow: 'PENGALAMAN MUDAH ALIH',
    title: 'Pastikan Wahy Wa Namaa sentiasa dekat dengan anda',
    subtitle: 'Pasang platform sebagai aplikasi web daripada pelayar anda untuk akses lebih pantas ke akaun dan pelajaran anda.',
    register: 'Cipta akaun',
    login: 'Log masuk',
    appName: 'Wahy Wa Namaa',
    tagline: 'Belajar • Hafal • Berkembang',
    steps: [
      'Gunakan pilihan pasang apabila pelayar anda menawarkannya',
      'Di Safari: Kongsi → Tambah ke Skrin Utama',
      'Aktifkan pemberitahuan daripada tetapan akaun jika mahu',
      'Sesetengah bahan mungkin kekal tersedia selepas dipasang mengikut cache setempat',
    ],
  },
  ku: {
    seoTitle: 'وەحی و نەما لەسەر مۆبایل',
    seoDesc: 'فێرببە چۆن وەحی و نەما وەک ئەپێکی وێب لەسەر مۆبایلەکەت دابمەزرێنیت.',
    eyebrow: 'ئەزموونی مۆبایل',
    title: 'وەحی و نەما لە خۆت نزیک بهێڵەرەوە',
    subtitle: 'دەتوانیت پلاتفۆرمەکە وەک ئەپێکی وێب لە وێبگەڕەکەتەوە دابمەزرێنیت بۆ گەیشتنی خێرا بە هەژمار و وانەکانت.',
    register: 'دروستکردنی هەژمار',
    login: 'چوونەژوورەوە',
    appName: 'وەحی و نەما',
    tagline: 'فێربە • لەبەر بکە • گەشە بکە',
    steps: [
      'بژاردەی دامەزراندن بەکاربهێنە کاتێک لە وێبگەڕەکەتدا دەردەکەوێت',
      'لە Safari دا: Share ← Add to Home Screen',
      'ئەگەر حەز دەکەیت ئاگادارکردنەوەکان لە ڕێکخستنی هەژمارەکەتەوە چالاک بکە',
      'هەندێک سەرچاوە لەوانەیە دوای دامەزراندن بەپێی هەڵگرتنی ناوخۆیی بەردەست بن',
    ],
  },
};

const DOWNLOAD_ANDROID_LABEL = {
  ar: 'تحميل تطبيق أندرويد (Wahy-Wa-Namaa-Academy.apk)',
  en: 'Download Android App (APK)',
  fr: 'Télécharger l’application Android (APK)',
  de: 'Android-App herunterladen (APK)',
  tr: 'Android Uygulamasını İndir (APK)',
  ur: 'اینڈرائیڈ ایپ ڈاؤن لوڈ کریں (APK)',
  id: 'Unduh Aplikasi Android (APK)',
  ms: 'Muat Turun Aplikasi Android (APK)',
  ku: 'داگرتنی ئەپی ئەندرۆید (APK)',
};

const STEP_ICONS = [Download, Share, Bell, WifiOff];

export default function MobileAppPage() {
  const { locale, dir, t } = useI18n();
  const lp = (path) => localizedPath(path, locale);
  const copy = MOBILE_COPY[locale] || MOBILE_COPY.en;
  const androidDownloadLabel = DOWNLOAD_ANDROID_LABEL[locale] || DOWNLOAD_ANDROID_LABEL.en;
  const androidDownloadHref = apiUrl('/api/mobile/download/android');

  return (
    <>
      <SEOHead page={{
        url: '/app',
        title: copy.seoTitle,
        description: copy.seoDesc,
      }} />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <a
                  href={androidDownloadHref}
                  className="wn-btn wn-btn--accent min-h-[44px] inline-flex items-center gap-2"
                >
                  <Download size={18} aria-hidden="true" />
                  <span>{androidDownloadLabel}</span>
                </a>
                <Link to={lp('/register/student')} className="wn-btn wn-btn--secondary min-h-[44px]">{t.common?.register || copy.register}</Link>
                <Link to={lp('/login')} className="wn-btn wn-btn--secondary min-h-[44px]">{t.common?.login || copy.login}</Link>
              </div>
            </div>

            <div className="wn-public-hero__art">
              <div className="wn-mobile-preview" aria-hidden="true">
                <div className="wn-mobile-preview__screen">
                  <Smartphone size={52} strokeWidth={1.2} />
                  <strong>{t.common?.appName || copy.appName}</strong>
                  <small>{copy.tagline}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-public-feature-grid">
            {copy.steps.map((text, idx) => {
              const Icon = STEP_ICONS[idx];
              return (
                <article key={idx} className="wn-public-feature-card">
                  <span><Icon size={21} aria-hidden="true" /></span>
                  <h3>{text}</h3>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
