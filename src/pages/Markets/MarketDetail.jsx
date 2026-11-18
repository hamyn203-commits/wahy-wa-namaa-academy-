import { Link, useParams, Navigate } from 'react-router-dom';
import { Clock3, Globe2, Users, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { getMarketBySlug } from '../../lib/market';
import {
  formatCurrencyPreview,
  formatZoneTime,
  getMarketRegion,
  getMarketCountries,
  getMarketServices,
} from '../../data/v4Data';
import { localizedPath } from '../../lib/locale';
import { useMarket } from '../../context/MarketProvider';
import { useToast } from '../../context/ToastProvider';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';

const INTL_LOCALE = {
  ar: 'ar-EG',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  tr: 'tr-TR',
  ur: 'ur-PK',
  id: 'id-ID',
  ms: 'ms-MY',
  ku: 'ku',
};

const MARKET_DETAIL_COPY = {
  ar: {
    brand: 'وَحْيٌ وَنَمَاء',
    seoDesc: 'إعدادات وخدمات أكاديمية وحي ونماء لهذه المنطقة.',
    eyebrow: 'إعدادات المنطقة',
    activeRegion: 'المنطقة المفعّلة حالياً',
    useRegion: 'استخدام هذه المنطقة',
    toastUpdated: 'تم تفعيل إعدادات منطقة:',
    exploreTeachers: 'استكشف المعلمين',
    createLearner: 'إنشاء حساب طالب',
  },
  en: {
    brand: 'Wahy Wa Namaa',
    seoDesc: 'Wahy Wa Namaa settings and services for this region.',
    eyebrow: 'REGION SETTINGS',
    activeRegion: 'Active region',
    useRegion: 'Use this region',
    toastUpdated: 'Region updated to:',
    exploreTeachers: 'Explore teachers',
    createLearner: 'Create learner account',
  },
  fr: {
    brand: 'Wahy Wa Namaa',
    seoDesc: 'Paramètres et services de Wahy Wa Namaa pour cette région.',
    eyebrow: 'PARAMÈTRES RÉGIONAUX',
    activeRegion: 'Région active',
    useRegion: 'Utiliser cette région',
    toastUpdated: 'Région activée :',
    exploreTeachers: 'Découvrir les enseignants',
    createLearner: 'Créer un compte élève',
  },
  de: {
    brand: 'Wahy Wa Namaa',
    seoDesc: 'Einstellungen und Angebote von Wahy Wa Namaa für diese Region.',
    eyebrow: 'REGIONSEINSTELLUNGEN',
    activeRegion: 'Aktive Region',
    useRegion: 'Diese Region verwenden',
    toastUpdated: 'Region aktualisiert auf:',
    exploreTeachers: 'Lehrer entdecken',
    createLearner: 'Schülerkonto erstellen',
  },
  tr: {
    brand: 'Wahy Wa Namaa',
    seoDesc: 'Bu bölge için Wahy Wa Namaa ayarları ve hizmetleri.',
    eyebrow: 'BÖLGE AYARLARI',
    activeRegion: 'Etkin bölge',
    useRegion: 'Bu bölgeyi kullan',
    toastUpdated: 'Bölge güncellendi:',
    exploreTeachers: 'Öğretmenleri keşfet',
    createLearner: 'Öğrenci hesabı oluştur',
  },
  ur: {
    brand: 'وحی و نماء',
    seoDesc: 'اس خطے کے لیے وحی و نماء کی ترتیبات اور خدمات۔',
    eyebrow: 'خطے کی ترتیبات',
    activeRegion: 'موجودہ فعال خطہ',
    useRegion: 'یہ خطہ منتخب کریں',
    toastUpdated: 'خطہ تبدیل کر دیا گیا:',
    exploreTeachers: 'اساتذہ دیکھیں',
    createLearner: 'طالب علم اکاؤنٹ بنائیں',
  },
  id: {
    brand: 'Wahy Wa Namaa',
    seoDesc: 'Pengaturan dan layanan Wahy Wa Namaa untuk wilayah ini.',
    eyebrow: 'PENGATURAN WILAYAH',
    activeRegion: 'Wilayah aktif',
    useRegion: 'Gunakan wilayah ini',
    toastUpdated: 'Wilayah diperbarui ke:',
    exploreTeachers: 'Jelajahi guru',
    createLearner: 'Buat akun pelajar',
  },
  ms: {
    brand: 'Wahy Wa Namaa',
    seoDesc: 'Tetapan dan perkhidmatan Wahy Wa Namaa untuk wilayah ini.',
    eyebrow: 'TETAPAN WILAYAH',
    activeRegion: 'Wilayah aktif',
    useRegion: 'Gunakan wilayah ini',
    toastUpdated: 'Wilayah dikemas kini ke:',
    exploreTeachers: 'Terokai guru',
    createLearner: 'Cipta akaun pelajar',
  },
  ku: {
    brand: 'وەحی و نەما',
    seoDesc: 'ڕێکخستن و خزمەتگوزارییەکانی وەحی و نەما بۆ ئەم ناوچەیە.',
    eyebrow: 'ڕێکخستنەکانی ناوچە',
    activeRegion: 'ناوچەی چالاک',
    useRegion: 'ئەم ناوچەیە بەکاربهێنە',
    toastUpdated: 'ناوچە نوێکرایەوە بۆ:',
    exploreTeachers: 'مامۆستایان ببینە',
    createLearner: 'هەژماری قوتابی دروست بکە',
  },
};

export default function MarketDetail() {
  const { slug } = useParams();
  const { locale, dir } = useI18n();
  const { marketSlug, setMarket } = useMarket();
  const toast = useToast();
  const market = getMarketBySlug(slug);
  const copy = MARKET_DETAIL_COPY[locale] || MARKET_DETAIL_COPY.en;
  const intlLoc = INTL_LOCALE[locale] || 'en-US';

  if (!market) return <Navigate to={localizedPath('/markets', locale)} replace />;

  const isSelected = marketSlug === market.slug;
  const regionTitle = getMarketRegion(market, locale);
  const countries = getMarketCountries(market, locale);
  const services = getMarketServices(market, locale);

  const handleSelectRegion = () => {
    setMarket(market.slug);
    toast.success(`${copy.toastUpdated} ${regionTitle}`);
  };

  return (
    <>
      <SEOHead page={{
        url: '/markets/' + slug,
        title: `${regionTitle} | ${copy.brand}`,
        description: copy.seoDesc,
      }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}</span>
              <h1>{regionTitle}</h1>
              <p>{countries.join(' · ')}</p>
              <div className="wn-detail-meta">
                <span>{market.currency}</span>
                <span><Clock3 size={14} aria-hidden="true" /> {formatZoneTime(market.timezone, intlLoc)}</span>
                <span>{formatCurrencyPreview(market.currency, intlLoc)}</span>
              </div>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><Globe2 size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-public-feature-grid">
            {services.map((service) => (
              <article key={service} className="wn-public-feature-card">
                <span><BookOpen size={20} aria-hidden="true" /></span>
                <h3>{service}</h3>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={handleSelectRegion}
              className="wn-btn wn-btn--primary min-h-[44px]"
            >
              {isSelected ? <CheckCircle2 size={16} aria-hidden="true" /> : null}
              <span>{isSelected ? copy.activeRegion : copy.useRegion}</span>
            </button>
            <Link to={localizedPath('/teachers?market=' + market.slug, locale)} className="wn-btn wn-btn--secondary min-h-[44px]">
              <Users size={16} aria-hidden="true" />{copy.exploreTeachers}
            </Link>
            <Link to={localizedPath('/register/student', locale)} className="wn-btn wn-btn--secondary min-h-[44px]">
              {copy.createLearner}
            </Link>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
