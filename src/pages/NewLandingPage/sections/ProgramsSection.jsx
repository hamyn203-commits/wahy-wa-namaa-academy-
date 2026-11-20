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
  kids: { icon: Sparkles, to: '/plans?program=kids&plan=group', image: '/images/programs/program-kids.jpg?v=2' },
  hifz: { icon: BookOpen, to: '/plans?program=hifz&plan=focused', image: '/images/programs/program-hifz.jpg?v=2' },
  tajweed: { icon: Award, to: '/plans?program=tajweed&plan=focused', image: '/images/programs/program-tajweed.jpg' },
  understanding: { icon: Languages, to: '/plans?program=understanding&plan=group', image: '/images/programs/program-understanding.jpg?v=2' },
  ijazah: { icon: ScrollText, to: '/plans?program=ijazah&plan=private', image: '/images/programs/program-ijazah.jpg' },
};

export default function ProgramsSection() {
  const { locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(PROGRAMS_COPY, locale, isRTL);

  const programs = copy.programs.map((item) => ({
    ...item,
    icon: PROGRAM_META[item.id]?.icon || BookOpen,
    to: PROGRAM_META[item.id]?.to || '/courses',
    image: PROGRAM_META[item.id]?.image || null,
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
          {programs.map(({ id, icon: Icon, image, tag, title, desc, ctaLabel, to }) => (
            <article key={id} className="wn-approved-program-card">
              <div className={`wn-approved-program-card__visual${image ? ' wn-approved-program-card__visual--photo' : ''}`}>
                {image ? (
                  <>
                    <img
                      src={image}
                      alt={title}
                      loading="lazy"
                      decoding="async"
                      className="wn-approved-program-card__img"
                    />
                    <div className="wn-approved-program-card__scrim" aria-hidden="true" />
                    <span className="wn-approved-program-card__icon-badge" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                  </>
                ) : (
                  <Icon size={34} strokeWidth={1.55} aria-hidden="true" />
                )}
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
