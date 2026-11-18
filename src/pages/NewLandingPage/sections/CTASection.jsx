import { useI18n } from '../../../i18n';
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircleMore, GraduationCap, HeartHandshake } from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import WahyNamaaEmblem from '../../../components/WahyNamaaEmblem';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { CTA_COPY, pickLocale } from '../landingI18nPart2';

export default function CTASection() {
  const { locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(CTA_COPY, locale, isRTL);

  return (
    <section className="wn-home-section wn-home-section--ivory" id="cta">
      <div className="page-container">
        <div className="wn-final-cta wn-pattern-geo--gold">
          <div className="wn-final-cta__glow" aria-hidden="true" />
          <div className="wn-final-cta__mark">
            <WahyNamaaEmblem size={64} variant="light" decorative />
          </div>

          <span className="wn-badge wn-badge--onDark">{copy.badge}</span>
          <h2>{copy.title}</h2>
          <p>{copy.lead}</p>

          <div className="wn-final-cta__actions">
            <LocalizedLink
              to="/start"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-btn wn-btn--light wn-btn--lg"
            >
              <span>{copy.primary}</span>
              <ArrowIcon size={18} className="wn-btn__arrow" aria-hidden="true" />
            </LocalizedLink>
            <LocalizedLink
              to="/contact"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/contact')}
              className="wn-btn wn-btn--outline-light wn-btn--lg"
            >
              <MessageCircleMore size={18} aria-hidden="true" />
              <span>{copy.secondary}</span>
            </LocalizedLink>
          </div>

          <div className="wn-final-cta__divisions">
            <LocalizedLink
              to="/start?section=men"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-final-cta__division-pill"
            >
              <GraduationCap size={15} aria-hidden="true" />
              <span>{copy.menPill}</span>
            </LocalizedLink>
            <LocalizedLink
              to="/start?section=women"
              locale={locale}
              onMouseEnter={() => prefetchRoute('/start')}
              className="wn-final-cta__division-pill"
            >
              <HeartHandshake size={15} aria-hidden="true" />
              <span>{copy.womenPill}</span>
            </LocalizedLink>
          </div>

          <div className="wn-final-cta__assurances">
            {copy.assurances.map((item) => <span key={item}><CheckCircle2 size={15} aria-hidden="true" /> {item}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
