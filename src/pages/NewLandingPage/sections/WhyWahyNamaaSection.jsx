import { useI18n } from '../../../i18n';
import {
  GraduationCap,
  HeartHandshake,
  Compass,
  ShieldCheck,
  Clock,
  Sprout,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { WHY_COPY, pickLocale } from '../landingI18n';

const PILLAR_META = [
  { icon: GraduationCap, featured: true, tone: 'gold' },
  { icon: Sprout, featured: false, tone: 'emerald' },
  { icon: HeartHandshake, featured: false, tone: 'gold' },
  { icon: Compass, featured: false, tone: 'teal' },
  { icon: ShieldCheck, featured: true, tone: 'gold' },
  { icon: Clock, featured: false, tone: 'emerald' },
];

export default function WhyWahyNamaaSection() {
  const { locale, isRTL } = useI18n();
  const copy = pickLocale(WHY_COPY, locale, isRTL);
  const pillars = copy.pillars.map((pillar, idx) => ({
    ...pillar,
    icon: PILLAR_META[idx]?.icon || GraduationCap,
    featured: Boolean(PILLAR_META[idx]?.featured),
    tone: PILLAR_META[idx]?.tone || 'gold',
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
          {pillars.map(({ num, icon: Icon, title, desc, proof, featured, tone }) => (
            <article
              key={num}
              className={`wn-approved-why-card wn-why-card-editorial${featured ? ' wn-why-card-editorial--featured' : ''}`}
            >
              <div className="wn-why-card-editorial__arch" aria-hidden="true" />
              <div className="wn-why-card-editorial__top">
                <span
                  className={`wn-why-card-editorial__icon wn-why-card-editorial__icon--${tone}`}
                  aria-hidden="true"
                >
                  <Icon size={22} strokeWidth={1.65} />
                </span>
                <span className="wn-why-card-editorial__num" aria-hidden="true">{num}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              {proof && (
                <div className="wn-why-card-editorial__proof">
                  <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                  <span>{proof}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
