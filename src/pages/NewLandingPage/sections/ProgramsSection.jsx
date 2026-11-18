import { useI18n } from '../../../i18n';
import {
  BookOpen,
  Award,
  Sparkles,
  ScrollText,
  Languages,
  ArrowLeft,
  ArrowRight,
  Sprout,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { PROGRAMS_COPY, pickLocale } from '../landingI18n';

const PROGRAM_META = {
  kids: { icon: Sparkles, to: '/programs/kids' },
  hifz: { icon: BookOpen, to: '/courses?track=quran' },
  tajweed: { icon: Award, to: '/courses?track=tajweed' },
  understanding: { icon: Languages, to: '/tracks' },
  ijazah: { icon: ScrollText, to: '/courses?track=ijazah' },
};

export default function ProgramsSection() {
  const { locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(PROGRAMS_COPY, locale, isRTL);

  const programs = copy.programs.map((item) => ({
    ...item,
    icon: PROGRAM_META[item.id]?.icon || BookOpen,
    to: PROGRAM_META[item.id]?.to || '/courses',
  }));

  return (
    <section className="wn-approved-programs" id="programs">
      <div className="wn-approved-programs__pattern" aria-hidden="true" />
      <div className="page-container relative z-10">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>

        <div className="wn-approved-programs__grid">
          {programs.map(({ id, icon: Icon, tag, title, desc, ctaLabel, to }) => (
            <article key={id} className="wn-approved-program-card">
              <div className="wn-approved-program-card__visual">
                <Icon size={34} strokeWidth={1.55} aria-hidden="true" />
                <span className="wn-program-card-tag">{tag}</span>
              </div>
              <div className="wn-approved-program-card__body">
                <h3>{title}</h3>
                <p>{desc}</p>
                <div className="wn-program-card-footer">
                  <LocalizedLink
                    to={to}
                    locale={locale}
                    onMouseEnter={() => prefetchRoute(to.split('?')[0])}
                    className="wn-program-card-cta"
                  >
                    <span>{ctaLabel}</span>
                    <ArrowIcon size={15} aria-hidden="true" />
                  </LocalizedLink>
                </div>
              </div>
            </article>
          ))}

          <aside className="wn-approved-programs__manifesto">
            <Sprout size={30} strokeWidth={1.5} aria-hidden="true" />
            <p>{copy.manifestoQuote}</p>
            <span>{copy.manifestoSub}</span>
          </aside>
        </div>

        <div className="wn-approved-trust-bar" aria-label={copy.trustAria}>
          {copy.trust.map((item, index) => (
            <div key={item} className="wn-approved-trust-bar__item">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>

        <div className="wn-approved-programs__more">
          <LocalizedLink
            to="/courses"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/courses')}
            className="wn-btn wn-btn--secondary"
          >
            <span>{copy.exploreAll}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" aria-hidden="true" />
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
