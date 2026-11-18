import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  Mic2,
  Video,
  BarChart3,
  MessageCircleHeart,
  LibraryBig,
  Sparkles,
  CheckCircle2,
  Waves,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { IMMERSIVE_COPY, handleRovingKeyDown, pickLocale } from '../landingI18n';

const FEATURE_ICONS = {
  recite: Mic2,
  classroom: Video,
  progress: BarChart3,
  family: MessageCircleHeart,
  library: LibraryBig,
};

export default function ImmersiveLearningSection() {
  const { locale, isRTL } = useI18n();
  const [activeId, setActiveId] = useState('recite');
  const copy = pickLocale(IMMERSIVE_COPY, locale, isRTL);

  const features = copy.features.map((item) => ({
    ...item,
    icon: FEATURE_ICONS[item.id] || Mic2,
  }));

  const featureKeys = features.map((item) => item.id);
  const activeFeature = features.find((item) => item.id === activeId) || features[0];
  const stagePanelId = 'wn-immersive-stage-panel';

  return (
    <section className="wn-immersive" id="platform-experience">
      <div className="wn-immersive__grid-glow" aria-hidden="true" />
      <div className="page-container wn-immersive__layout">
        <div className="wn-immersive__content">
          <span className="wn-immersive__eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            {copy.eyebrow}
          </span>

          <h2>
            {copy.titleLine1}
            <br />
            <strong>{copy.titleLine2}</strong>
          </h2>

          <p className="wn-immersive__lead">{copy.lead}</p>

          <div className="wn-immersive__features" role="tablist" aria-label={copy.tablistAria}>
            {features.map(({ id, icon: Icon, title, text }) => {
              const selected = id === activeFeature.id;
              return (
                <button
                  type="button"
                  role="tab"
                  id={`wn-immersive-tab-${id}`}
                  aria-selected={selected}
                  aria-controls={stagePanelId}
                  tabIndex={selected ? 0 : -1}
                  key={id}
                  onClick={() => setActiveId(id)}
                  onKeyDown={(event) => handleRovingKeyDown({
                    event,
                    keys: featureKeys,
                    currentKey: id,
                    onSelect: setActiveId,
                    isRTL,
                  })}
                  className={`wn-immersive-feature wn-immersive-feature--btn ${selected ? 'is-active' : ''}`}
                >
                  <span aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <LocalizedLink
            to="/ai"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/ai')}
            className="wn-btn wn-btn--accent wn-btn--lg"
          >
            <Waves size={17} aria-hidden="true" />
            <span>{copy.ctaAi}</span>
          </LocalizedLink>
        </div>

        <div
          id={stagePanelId}
          role="tabpanel"
          aria-labelledby={`wn-immersive-tab-${activeFeature.id}`}
          className="wn-quran-3d-stage"
          aria-label={copy.stageAria}
        >
          <div className="wn-quran-3d-stage__halo" aria-hidden="true" />
          <div className="wn-quran-3d-stage__arch" aria-hidden="true" />

          <div className="wn-quran-book3d" aria-hidden="true">
            <div className="wn-quran-book3d__shadow" />
            <div className="wn-quran-book3d__left">
              <div className="wn-quran-book3d__page-lines">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="wn-quran-book3d__right">
              <div className="wn-quran-book3d__page-lines">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="wn-quran-book3d__spine" />
            <div className="wn-quran-book3d__light">✦</div>
          </div>

          <div className={`wn-float-card wn-float-card--recite ${activeFeature.stageFocus === 'recite' ? 'is-highlighted' : ''}`}>
            <span className="wn-float-card__icon" aria-hidden="true"><Mic2 size={16} /></span>
            <div>
              <strong>{copy.cardReciteTitle}</strong>
              <small>{copy.cardReciteSub}</small>
            </div>
          </div>

          <div className={`wn-float-card wn-float-card--progress ${activeFeature.stageFocus === 'progress' ? 'is-highlighted' : ''}`}>
            <div className="wn-progress-ring" aria-hidden="true"><span>✦</span></div>
            <div>
              <strong>{copy.cardProgressTitle}</strong>
              <small>{copy.cardProgressSub}</small>
            </div>
          </div>

          <div className={`wn-float-card wn-float-card--family ${activeFeature.stageFocus === 'family' ? 'is-highlighted' : ''}`}>
            <span className="wn-float-card__icon" aria-hidden="true"><CheckCircle2 size={16} /></span>
            <div>
              <strong>{copy.cardFamilyTitle}</strong>
              <small>{copy.cardFamilySub}</small>
            </div>
          </div>

          <div className="wn-stage-focus-note" aria-live="polite">
            {activeFeature.stageNote}
          </div>

          <div className="wn-quran-3d-stage__caption" aria-hidden="true">
            <span>{copy.captionLeft}</span>
            <i />
            <span>{copy.captionRight}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
