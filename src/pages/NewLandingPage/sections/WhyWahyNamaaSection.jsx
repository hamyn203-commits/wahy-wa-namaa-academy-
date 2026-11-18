import { useI18n } from '../../../i18n';
import {
  GraduationCap,
  HeartHandshake,
  Compass,
  ShieldCheck,
  Clock,
  Sprout,
  Sparkles,
} from 'lucide-react';
import { WHY_COPY, pickLocale } from '../landingI18n';

const PILLAR_ICONS = [GraduationCap, Sprout, HeartHandshake, Compass, ShieldCheck, Clock];

export default function WhyWahyNamaaSection() {
  const { locale, isRTL } = useI18n();
  const copy = pickLocale(WHY_COPY, locale, isRTL);
  const pillars = copy.pillars.map((pillar, idx) => ({
    ...pillar,
    icon: PILLAR_ICONS[idx] || GraduationCap,
  }));

  return (
    <section className="wn-approved-why" id="why-wahy-namaa">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}
          </span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>

        <div className="wn-approved-why__grid">
          {pillars.map(({ num, icon: Icon, title, desc }) => (
            <article key={num} className="wn-approved-why-card wn-why-card-editorial">
              <div className="wn-why-card-editorial__top">
                <span className="wn-icon-box wn-icon-box--gold" aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>
                <span className="wn-why-card-editorial__num" aria-hidden="true">{num}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
