import { Link } from 'react-router-dom';
import { Globe2, ArrowLeft, ArrowRight, MapPinned, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { v4Markets, formatCurrencyPreview, getMarketRegion, getMarketCountries } from '../../data/v4Data';
import { localizedPath } from '../../lib/locale';
import { useMarket } from '../../context/MarketProvider';
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

const MARKETS_COPY = {
  ar: {
    seoTitle: 'الأسواق والمناطق | وَحْيٌ وَنَمَاء',
    seoDesc: 'اختر المنطقة الأقرب لك لعرض الإعدادات المحلية المتاحة.',
    eyebrow: 'تعلّم من أي مكان',
    title: 'اختر المنطقة الأقرب لك',
    subtitle: 'تساعد إعدادات السوق على عرض العملة والمنطقة الزمنية والخدمات المتاحة بصورة أنسب للمستخدم.',
    details: 'تفاصيل المنطقة',
    sep: '، ',
  },
  en: {
    seoTitle: 'Markets & Regions | Wahy Wa Namaa',
    seoDesc: 'Choose the region closest to you to view available local settings.',
    eyebrow: 'LEARN FROM ANYWHERE',
    title: 'Choose the region closest to you',
    subtitle: 'Market settings help present currency, timezone, and available services in a way that better fits the learner.',
    details: 'Region details',
    sep: ', ',
  },
  fr: {
    seoTitle: 'Marchés et régions | Wahy Wa Namaa',
    seoDesc: 'Choisissez la région la plus proche de vous pour afficher les paramètres locaux disponibles.',
    eyebrow: 'APPRENDRE DE PARTOUT',
    title: 'Choisissez la région la plus proche de vous',
    subtitle: 'Les paramètres régionaux permettent d’adapter la devise, le fuseau horaire et les services disponibles à chaque apprenant.',
    details: 'Détails de la région',
    sep: ', ',
  },
  de: {
    seoTitle: 'Märkte & Regionen | Wahy Wa Namaa',
    seoDesc: 'Wählen Sie Ihre nächstgelegene Region für passende lokale Einstellungen.',
    eyebrow: 'ÜBERALL LERNEN',
    title: 'Wählen Sie die nächstgelegene Region',
    subtitle: 'Regionale Einstellungen passen Währung, Zeitzone und verfügbare Angebote optimal an Lernende weltweit an.',
    details: 'Regionsdetails',
    sep: ', ',
  },
  tr: {
    seoTitle: 'Pazarlar ve Bölgeler | Wahy Wa Namaa',
    seoDesc: 'Size en yakın bölgeyi seçerek yerel ayarları görüntüleyin.',
    eyebrow: 'HER YERDEN ÖĞRENİN',
    title: 'Size en yakın bölgeyi seçin',
    subtitle: 'Bölge ayarları; para birimi, saat dilimi ve sunulan hizmetlerin size en uygun şekilde gösterilmesine yardımcı olur.',
    details: 'Bölge detayları',
    sep: ', ',
  },
  ur: {
    seoTitle: 'مارکیٹس اور خطے | وحی و نماء',
    seoDesc: 'دستیاب مقامی ترتیبات دیکھنے کے لیے اپنے قریب ترین خطے کا انتخاب کریں۔',
    eyebrow: 'کہیں سے بھی سیکھیں',
    title: 'اپنے قریب ترین خطے کا انتخاب کریں',
    subtitle: 'خطے کی ترتیبات کرنسی، ٹائم زون اور دستیاب خدمات کو آپ کی سہولت کے مطابق دکھانے میں مدد دیتی ہیں۔',
    details: 'خطے کی تفصیلات',
    sep: '، ',
  },
  id: {
    seoTitle: 'Pasar & Wilayah | Wahy Wa Namaa',
    seoDesc: 'Pilih wilayah terdekat Anda untuk melihat pengaturan lokal yang tersedia.',
    eyebrow: 'BELAJAR DARI MANA SAJA',
    title: 'Pilih wilayah terdekat dengan Anda',
    subtitle: 'Pengaturan wilayah membantu menampilkan mata uang, zona waktu, dan layanan yang paling sesuai bagi pelajar.',
    details: 'Detail wilayah',
    sep: ', ',
  },
  ms: {
    seoTitle: 'Pasaran & Wilayah | Wahy Wa Namaa',
    seoDesc: 'Pilih wilayah terdekat anda untuk melihat tetapan tempatan yang tersedia.',
    eyebrow: 'BELAJAR DARI MANA SAHAJA',
    title: 'Pilih wilayah terdekat dengan anda',
    subtitle: 'Tetapan wilayah membantu memaparkan mata wang, zon masa, dan perkhidmatan yang paling sesuai untuk pelajar.',
    details: 'Butiran wilayah',
    sep: ', ',
  },
  ku: {
    seoTitle: 'بازاڕ و ناوچەکان | وەحی و نەما',
    seoDesc: 'نزیکترین ناوچە لە خۆت هەڵبژێرە بۆ بینینی ڕێکخستنە ناوخۆییەکان.',
    eyebrow: 'لە هەموو شوێنێکەوە فێربە',
    title: 'نزیکترین ناوچە لە خۆت هەڵبژێرە',
    subtitle: 'ڕێکخستنەکانی ناوچە یارمەتی نیشاندانی دراو، ناوچەی کات و خزمەتگوزارییە بەردەستەکان دەدەن بە شێوەیەکی گونجاوتر.',
    details: 'وردەکارییەکانی ناوچە',
    sep: '، ',
  },
};

export default function MarketsIndex() {
  const { locale, isRTL, dir } = useI18n();
  const { marketSlug } = useMarket();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = MARKETS_COPY[locale] || MARKETS_COPY.en;
  const intlLoc = INTL_LOCALE[locale] || 'en-US';

  return (
    <>
      <SEOHead page={{
        url: '/markets',
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
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><Globe2 size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-ecosystem-grid">
            {v4Markets.map((market) => {
              const countryList = getMarketCountries(market, locale);
              return (
                <Link key={market.slug} to={localizedPath('/markets/' + market.slug, locale)} className={'wn-market-card ' + (marketSlug === market.slug ? 'is-active' : '')}>
                  <div className="flex items-start justify-between gap-3">
                    <MapPinned size={23} className="text-[var(--wn-link)]" aria-hidden="true" />
                    <span className="text-xs font-bold text-[var(--wn-text-gold)]">
                      {market.currency} · {formatCurrencyPreview(market.currency, intlLoc)}
                    </span>
                  </div>
                  <h2 className="mt-3">{getMarketRegion(market, locale)}</h2>
                  <p className="mt-1">{countryList.slice(0, 4).join(copy.sep)}</p>
                  <span className="min-h-[44px] inline-flex items-center gap-1 mt-3 text-xs font-bold text-[var(--wn-link)]">
                    {copy.details} <ArrowIcon size={13} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
