import { Link, useParams, Navigate } from 'react-router-dom';
import { Clock3, Globe2, Users, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { getMarketBySlug } from '../../lib/market';
import { formatCurrencyPreview, formatZoneTime } from '../../data/v4Data';
import { localizedPath } from '../../lib/locale';
import { useMarket } from '../../context/MarketProvider';
import { useToast } from '../../context/ToastProvider';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';

export default function MarketDetail() {
  const { slug } = useParams();
  const { locale, isRTL, dir } = useI18n();
  const { marketSlug, setMarket } = useMarket();
  const toast = useToast();
  const market = getMarketBySlug(slug);

  if (!market) return <Navigate to={localizedPath('/markets', locale)} replace />;

  const isSelected = marketSlug === market.slug;
  const regionTitle = isRTL ? market.region : market.regionEn;
  const countries = isRTL ? market.countries : (market.countriesEn || market.countries);
  const services = isRTL ? market.services : (market.servicesEn || market.services);

  const handleSelectRegion = () => {
    setMarket(market.slug);
    toast.success(
      isRTL
        ? `تم تفعيل إعدادات منطقة: ${regionTitle}`
        : `Region updated to: ${regionTitle}`
    );
  };

  return (
    <>
      <SEOHead page={{
        url: '/markets/' + slug,
        title: regionTitle + ' | Wahy Wa Namaa',
        description: isRTL ? 'إعدادات وخدمات وحي ونماء لهذه المنطقة.' : 'Wahy Wa Namaa settings and services for this region.',
      }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {isRTL ? 'إعدادات المنطقة' : 'REGION SETTINGS'}</span>
              <h1>{regionTitle}</h1>
              <p>{countries.join(' · ')}</p>
              <div className="wn-detail-meta">
                <span>{market.currency}</span>
                <span><Clock3 size={14} aria-hidden="true" /> {formatZoneTime(market.timezone, market.language === 'en' ? 'en-US' : 'ar-EG')}</span>
                <span>{formatCurrencyPreview(market.currency, market.language === 'en' ? 'en-US' : 'ar-EG')}</span>
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
              <span>
                {isSelected
                  ? (isRTL ? 'المنطقة المفعّلة حالياً' : 'Active region')
                  : (isRTL ? 'استخدام هذه المنطقة' : 'Use this region')}
              </span>
            </button>
            <Link to={localizedPath('/teachers?market=' + market.slug, locale)} className="wn-btn wn-btn--secondary min-h-[44px]">
              <Users size={16} aria-hidden="true" />{isRTL ? 'استكشف المعلمين' : 'Explore teachers'}
            </Link>
            <Link to={localizedPath('/register/student', locale)} className="wn-btn wn-btn--secondary min-h-[44px]">
              {isRTL ? 'إنشاء حساب طالب' : 'Create learner account'}
            </Link>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
