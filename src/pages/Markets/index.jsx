import { Link } from 'react-router-dom';
import { Globe2, ArrowLeft, ArrowRight, MapPinned, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { v4Markets, formatCurrencyPreview } from '../../data/v4Data';
import { localizedPath } from '../../lib/locale';
import { useMarket } from '../../context/MarketProvider';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';

export default function MarketsIndex() {
  const { locale, isRTL, dir } = useI18n();
  const { marketSlug } = useMarket();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <>
      <SEOHead page={{
        url: '/markets',
        title: isRTL ? 'الأسواق والمناطق | وحي ونماء' : 'Markets | Wahy Wa Namaa',
        description: isRTL ? 'اختر المنطقة الأقرب لك لعرض الإعدادات المحلية المتاحة.' : 'Choose the region closest to you to view available local settings.',
      }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {isRTL ? 'تعلم من أي مكان' : 'LEARN FROM ANYWHERE'}</span>
              <h1>{isRTL ? 'اختر المنطقة الأقرب لك' : 'Choose the region closest to you'}</h1>
              <p>{isRTL ? 'تساعد إعدادات السوق على عرض العملة والمنطقة الزمنية والخدمات المتاحة بصورة أنسب للمستخدم.' : 'Market settings help present currency, timezone, and available services in a way that better fits the learner.'}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><Globe2 size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-ecosystem-grid">
            {v4Markets.map((market) => {
              const countryList = isRTL ? market.countries : (market.countriesEn || market.countries);
              return (
                <Link key={market.slug} to={localizedPath('/markets/' + market.slug, locale)} className={'wn-market-card ' + (marketSlug === market.slug ? 'is-active' : '')}>
                  <div className="flex items-start justify-between gap-3">
                    <MapPinned size={23} className="text-[var(--wn-link)]" aria-hidden="true" />
                    <span className="text-xs font-bold text-[var(--wn-text-gold)]">
                      {market.currency} · {formatCurrencyPreview(market.currency, market.language === 'en' ? 'en-US' : 'ar-EG')}
                    </span>
                  </div>
                  <h2 className="mt-3">{isRTL ? market.region : market.regionEn}</h2>
                  <p className="mt-1">{countryList.slice(0, 4).join(isRTL ? '، ' : ', ')}</p>
                  <span className="min-h-[44px] inline-flex items-center gap-1 mt-3 text-xs font-bold text-[var(--wn-link)]">
                    {isRTL ? 'تفاصيل المنطقة' : 'Region details'} <ArrowIcon size={13} aria-hidden="true" />
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
