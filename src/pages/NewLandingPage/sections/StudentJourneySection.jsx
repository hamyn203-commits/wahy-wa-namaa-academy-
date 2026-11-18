import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  BookOpen,
  Repeat2,
  BadgeCheck,
  Sprout,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { JOURNEY_COPY, handleRovingKeyDown, pickLocale } from '../landingI18nPart2';

const STAGE_ICONS = [BookOpen, Repeat2, BadgeCheck, Sprout];

export default function StudentJourneySection() {
  const { locale, isRTL } = useI18n();
  const [activeStep, setActiveStep] = useState('01');
  const copy = pickLocale(JOURNEY_COPY, locale, isRTL);

  const stages = copy.stages.map((stage, idx) => ({
    ...stage,
    icon: STAGE_ICONS[idx] || BookOpen,
  }));
  const stageKeys = stages.map((stage) => stage.step);
  const currentStage = stages.find((item) => item.step === activeStep) || stages[0];

  return (
    <section className="wn-home-section wn-home-section--ivory" id="journey">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>

        <div className="wn-journey-grid" role="group" aria-label={copy.groupAria}>
          {stages.map(({ step, icon: Icon, title, text, outcome }, index) => {
            const isSelected = step === currentStage.step;
            return (
              <button
                type="button"
                key={step}
                aria-pressed={isSelected}
                onClick={() => setActiveStep(step)}
                onMouseEnter={() => setActiveStep(step)}
                onKeyDown={(event) => handleRovingKeyDown({
                  event,
                  keys: stageKeys,
                  currentKey: step,
                  onSelect: setActiveStep,
                  isRTL,
                })}
                className={`wn-journey-card wn-journey-card--interactive ${isSelected ? 'is-selected' : ''}`}
              >
                <div className="wn-journey-card__head w-full">
                  <span className="wn-journey-card__icon" aria-hidden="true"><Icon size={22} strokeWidth={1.55} /></span>
                  <span className="wn-journey-card__step">{step}</span>
                </div>
                <strong className="wn-journey-card-title">{title}</strong>
                <p>{text}</p>
                <div className="wn-journey-card__outcome w-full">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>{outcome}</span>
                </div>
                {index < stages.length - 1 && <span className="wn-journey-card__line" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="wn-journey-cta" aria-live="polite">
          <div>
            <strong>{copy.ctaHeadline}</strong>
            <span>{currentStage.outcome}</span>
          </div>
          <LocalizedLink
            to="/start"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/start')}
            className="wn-btn wn-btn--primary"
          >
            <Sparkles size={16} aria-hidden="true" />
            {copy.ctaButton}
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
