import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandLogo from '../../components/BrandLogo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import '../../styles/public-experience.css';

const NOT_FOUND_COPY = {
  ar: {
    title: 'الصفحة غير موجودة',
    description: 'الرابط قديم أو الصفحة نُقلت. استخدم أحد الروابط التالية للعودة إلى مسار واضح.',
    home: 'الرئيسية',
    courses: 'الدورات',
    contact: 'تواصل معنا',
  },
  en: {
    title: 'Page not found',
    description: 'The link may be old or the page moved. Use one of the links below to continue.',
    home: 'Home',
    courses: 'Courses',
    contact: 'Contact',
  },
  fr: {
    title: 'Page introuvable',
    description: 'Ce lien est peut-être obsolète ou la page a été déplacée. Utilisez l’un des liens ci-dessous pour continuer.',
    home: 'Accueil',
    courses: 'Cours',
    contact: 'Contact',
  },
  de: {
    title: 'Seite nicht gefunden',
    description: 'Dieser Link ist möglicherweise veraltet oder die Seite wurde verschoben. Nutzen Sie einen der folgenden Links.',
    home: 'Startseite',
    courses: 'Kurse',
    contact: 'Kontakt',
  },
  tr: {
    title: 'Sayfa bulunamadı',
    description: 'Bağlantı eski olabilir veya sayfa taşınmış olabilir. Devam etmek için aşağıdaki bağlantılardan birini kullanın.',
    home: 'Ana Sayfa',
    courses: 'Kurslar',
    contact: 'İletişim',
  },
  ur: {
    title: 'صفحہ دستیاب نہیں',
    description: 'یہ لنک پرانا ہو سکتا ہے یا صفحہ منتقل ہو گیا ہے۔ جاری رکھنے کے لیے نیچے دیے گئے روابط میں سے کسی ایک کا انتخاب کریں۔',
    home: 'ہوم',
    courses: 'کورسز',
    contact: 'رابطہ',
  },
  id: {
    title: 'Halaman tidak ditemukan',
    description: 'Tautan ini mungkin sudah lama atau halamannya telah dipindahkan. Gunakan salah satu tautan di bawah untuk melanjutkan.',
    home: 'Beranda',
    courses: 'Kursus',
    contact: 'Kontak',
  },
  ms: {
    title: 'Halaman tidak ditemui',
    description: 'Pautan ini mungkin lama atau halaman telah dipindahkan. Gunakan salah satu pautan di bawah untuk meneruskan.',
    home: 'Laman Utama',
    courses: 'Kursus',
    contact: 'Hubungi',
  },
  ku: {
    title: 'پەڕەکە نەدۆزرایەوە',
    description: 'لەوانەیە ئەم بەستەرە کۆن بێت یان پەڕەکە گوازرابێتەوە. یەکێک لە بەستەرەکانی خوارەوە بەکاربهێنە بۆ بەردەوامبوون.',
    home: 'سەرەکی',
    courses: 'خولەکان',
    contact: 'پەیوەندی',
  },
};

export default function NotFoundPage() {
  const { locale, dir, t } = useI18n();
  const location = useLocation();
  const copy = NOT_FOUND_COPY[locale] || NOT_FOUND_COPY.en;
  const links = [
    { icon: Home, label: t.common?.home || copy.home, path: '/' },
    { icon: BookOpen, label: t.common?.courses || copy.courses, path: '/courses' },
    { icon: Search, label: t.common?.contact || copy.contact, path: '/contact' },
  ];

  return (
    <>
      <SEOHead page={{ title: copy.title, url: location.pathname, noindex: true, canonical: false }} />
      <main className="wn-notfound" dir={dir}>
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="wn-notfound__card">
          <div className="flex justify-center mb-4">
            <BrandLogo size={58} to={localizedPath('/', locale)} />
          </div>
          <div className="wn-notfound__code">404</div>
          <h1 className="mt-4 font-[var(--wn-font-display)] text-2xl text-[var(--wn-heading)]">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm leading-7 text-[var(--wn-text-secondary)]">
            {copy.description}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {links.map(({ icon: Icon, label, path }) => (
              <Link key={path} to={localizedPath(path, locale)} className="wn-btn wn-btn--secondary min-h-[44px]">
                <Icon size={15} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </motion.section>
      </main>
    </>
  );
}
