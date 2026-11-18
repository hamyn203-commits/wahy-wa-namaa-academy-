import { useI18n } from '../../../i18n';
import {
  Sparkles,
  HeartHandshake,
  BriefcaseBusiness,
  Globe2,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { AUDIENCES_COPY, pickLocale } from '../landingI18nPart2';

const AUDIENCE_ICONS = [Sparkles, HeartHandshake, BriefcaseBusiness, Globe2];

export default function TargetAudiencesSection() {
  const { locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(AUDIENCES_COPY, locale, isRTL);

  const audiences = copy.cards.map((card, idx) => ({
    ...card,
    icon: AUDIENCE_ICONS[idx] || Sparkles,
  }));

  return (
    <section className="wn-home-section wn-home-section--white" id="audiences">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>

        <div className="wn-audiences-grid">
          {audiences.map(({ icon: Icon, title, eyebrow, desc, items, to, cta, variant }) => (
            <article key={title} className={`wn-audience-card ${variant === 'women' ? 'wn-audience-card--women' : ''}`}>
              <span className="wn-icon-box wn-icon-box--gold" aria-hidden="true"><Icon size={21} strokeWidth={1.6} /></span>
              <small>{eyebrow}</small>
              <h3>{title}</h3>
              <p>{desc}</p>
              <div className="wn-audience-card__checks">
                {items.map((item) => <span key={item}><Check size={14} aria-hidden="true" /> {item}</span>)}
              </div>
              <LocalizedLink
                to={to}
                locale={locale}
                onMouseEnter={() => prefetchRoute(to.split('?')[0])}
                className="wn-audience-card__link"
              >
                <span>{cta}</span>
                <ArrowIcon size={14} aria-hidden="true" />
              </LocalizedLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
