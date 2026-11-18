import { useI18n } from '../../../i18n';
import {
  ShieldCheck,
  HeartHandshake,
  LockKeyhole,
  BadgeCheck,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { TRUST_COPY, pickLocale } from '../landingI18nPart2';

const SIGNAL_ICONS = [ShieldCheck, HeartHandshake, LockKeyhole, BadgeCheck];

export default function TrustSignalsSection() {
  const { locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(TRUST_COPY, locale, isRTL);

  const signals = copy.signals.map((signal, idx) => ({
    ...signal,
    icon: SIGNAL_ICONS[idx] || ShieldCheck,
  }));

  return (
    <section className="wn-home-section wn-home-section--ivory" id="trust-signals">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <ShieldCheck size={14} aria-hidden="true" />
            {copy.eyebrow}
          </span>
          <h2>{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        <div className="wn-trust-grid">
          {signals.map(({ icon: Icon, badge, title, desc, points }) => (
            <article key={title} className="wn-trust-card">
              <div className="wn-trust-card__top">
                <span className="wn-icon-box wn-icon-box--emerald" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <span className="wn-trust-card__badge">{badge}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <ul className="wn-trust-card__points">
                {points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="wn-trust-strip">
          <div className="wn-trust-strip__items">
            {copy.assurances.map((item) => (
              <span key={item} className="wn-trust-strip__item">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{item}</span>
              </span>
            ))}
          </div>
          <LocalizedLink
            to="/free-trial"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/free-trial')}
            className="wn-btn wn-btn--primary"
          >
            <span>{copy.ctaTrial}</span>
            <ArrowIcon size={15} className="wn-btn__arrow" aria-hidden="true" />
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
