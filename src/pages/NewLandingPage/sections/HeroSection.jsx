import { useI18n } from '../../../i18n';
import { useMarket } from '../../../context/MarketProvider';
import {
  BookOpen,
  GraduationCap,
  MonitorSmartphone,
  Users,
  ArrowLeft,
  ArrowRight,
  CirclePlay,
  Sparkles,
  HeartHandshake,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { HERO_COPY, pickLocale } from '../landingI18n';

const TRUST_ICONS = [GraduationCap, BookOpen, MonitorSmartphone, Users];

export default function HeroSection() {
  const { locale, isRTL } = useI18n();
  const { displayPrice } = useMarket();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(HERO_COPY, locale, isRTL);
  const startingPrice = displayPrice(10, 'EGP');
  const ctaPrimaryLabel = locale === 'ar' ? 'ابدأ رحلتك الآن' : copy.ctaStart;

  const trustItems = copy.trust.map((item, idx) => ({
    icon: TRUST_ICONS[idx] || GraduationCap,
    title: item.title,
    text: item.text,
  }));

  const divisionRoutes = [
    {
      id: 'men',
      to: '/start?section=men',
      icon: GraduationCap,
      title: copy.menTitle,
      meta: copy.menMeta,
      variant: 'men',
    },
    {
      id: 'women',
      to: '/start?section=women',
      icon: HeartHandshake,
      title: copy.womenTitle,
      meta: copy.womenMeta,
      variant: 'women',
    },
  ];

  return (
    <section className="wn-approved-hero">
      <div className="wn-approved-hero__pattern" aria-hidden="true" />

      <div className="page-container wn-approved-hero__layout">
        <div className="wn-approved-hero__copy">
          <span className="wn-approved-eyebrow wn-approved-eyebrow--hero">
            <Sparkles size={14} aria-hidden="true" />
            {copy.eyebrow}
          </span>

          <h1 className="wn-approved-hero__title">
            <span>{copy.titleTop}</span>
            <strong>{copy.titleBottom}</strong>
          </h1>

          <p className="wn-approved-hero__lead">{copy.lead}</p>

          <div className="wn-approved-hero__actions">
            <LocalizedLink
              to="/start"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-btn wn-btn--primary wn-btn--lg"
            >
              <span>{ctaPrimaryLabel}</span>
              <ArrowIcon size={18} className="wn-btn__arrow" aria-hidden="true" />
            </LocalizedLink>

            <a href="#learning-tools" className="wn-btn wn-btn--secondary wn-btn--lg">
              <CirclePlay size={19} aria-hidden="true" />
              <span>{copy.ctaPreview}</span>
            </a>
          </div>

          <div className="wn-hero-assurance">
            <span>
              <CheckCircle2 size={15} aria-hidden="true" />
              {copy.assuranceFree}
            </span>
            <span>
              <ShieldCheck size={15} aria-hidden="true" />
              {copy.assurancePrice.replace('{price}', startingPrice)}
            </span>
          </div>

          <div className="wn-hero-divisions" aria-label={copy.divisionsAria}>
            <span className="wn-hero-divisions__label">{copy.divisionsLabel}</span>
            <div className="wn-hero-divisions__grid">
              {divisionRoutes.map(({ id, to, icon: Icon, title, meta, variant }) => (
                <LocalizedLink
                  key={id}
                  to={to}
                  locale={locale}
                  onMouseEnter={() => prefetchRoute('/start')}
                  className={`wn-hero-division-card wn-hero-division-card--${variant}`}
                >
                  <span className="wn-hero-division-card__icon" aria-hidden="true">
                    <Icon size={19} strokeWidth={1.75} />
                  </span>
                  <span className="wn-hero-division-card__body">
                    <strong>{title}</strong>
                    <small>{meta}</small>
                  </span>
                  <ArrowIcon size={15} className="wn-hero-division-card__arrow" aria-hidden="true" />
                </LocalizedLink>
              ))}
            </div>
          </div>
        </div>

        <div className="wn-approved-hero__visual">
          <img
            src="/images/hero-wahy-namaa.jpg"
            alt={copy.imageAlt}
            width="640"
            height="560"
            loading="eager"
            fetchPriority="high"
          />
          <div className="wn-approved-hero__shade" aria-hidden="true" />
          <div className="wn-hero-orbit wn-hero-orbit--one" aria-hidden="true" />
          <div className="wn-hero-orbit wn-hero-orbit--two" aria-hidden="true" />

          <aside className="wn-approved-verse-card">
            <span className="wn-approved-verse-card__ornament" aria-hidden="true">✦</span>
            <p className="font-quran">وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا</p>
            <span>{copy.verseRef}</span>
          </aside>

          <div className="wn-hero-lens-bar">
            <span className="wn-hero-lens-bar__dot" aria-hidden="true" />
            <div>
              <strong>{copy.lensReciteBadge}</strong>
              <span>{copy.lensReciteDetail}</span>
            </div>
          </div>
        </div>

        <div className="wn-approved-hero__trust wn-approved-hero__trust--wide">
          {trustItems.map(({ icon: Icon, title, text }) => (
            <div key={title} className="wn-approved-trust-item">
              <span className="wn-approved-trust-item__icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
