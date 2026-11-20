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
  const ActiveFeatureIcon = activeFeature.icon;
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
            {features.map(({ id, icon: Icon, title, text }, idx) => {
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
                  <span aria-hidden="true"><Icon size={18} strokeWidth={1.65} /></span>
                  <div className="wn-immersive-feature__body">
                    <div className="wn-immersive-feature__head">
                      <strong>{title}</strong>
                      <em className="wn-immersive-feature__idx" aria-hidden="true">
                        {String(idx + 1).padStart(2, '0')}
                      </em>
                    </div>
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
          className={`wn-quran-3d-stage wn-quran-3d-stage--focus-${activeFeature.stageFocus}`}
          aria-label={copy.stageAria}
        >
          <div className="wn-quran-3d-stage__halo" aria-hidden="true" />
          <div className="wn-quran-3d-stage__orbit" aria-hidden="true" />
          <div className="wn-quran-3d-stage__arch" aria-hidden="true" />

          <div className="wn-quran-book3d" aria-hidden="true">
            <div className="wn-quran-book3d__shadow" />
            <div className="wn-quran-book3d__left">
              <div className="wn-quran-book3d__mushaf-page" dir="rtl" lang="ar">
                <span className="wn-quran-book3d__surah-band">سُورَةُ المُزَّمِّلِ</span>
                <p className="font-quran wn-quran-book3d__ayah">
                  وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا
                </p>
                <p className="font-quran wn-quran-book3d__ayah wn-quran-book3d__ayah--sub">
                  فَاقْرَءُوا مَا تَيَسَّرَ مِنَ الْقُرْآنِ
                </p>
                <span className="wn-quran-book3d__ornament">۞ ✦ ۞</span>
              </div>
            </div>
            <div className="wn-quran-book3d__right">
              <div className="wn-quran-book3d__mushaf-page" dir="rtl" lang="ar">
                <span className="wn-quran-book3d__surah-band">سُورَةُ الفَاتِحَةِ</span>
                <p className="font-quran wn-quran-book3d__ayah">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>
                <p className="font-quran wn-quran-book3d__ayah wn-quran-book3d__ayah--sub">
                  الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
                </p>
                <span className="wn-quran-book3d__ornament">۞ ✦ ۞</span>
              </div>
            </div>
            <div className="wn-quran-book3d__spine" />
            <div className="wn-quran-book3d__light">✦</div>
          </div>

          <button
            type="button"
            onClick={() => setActiveId('recite')}
            className={`wn-float-card wn-float-card--recite wn-float-card--interactive ${activeFeature.stageFocus === 'recite' ? 'is-highlighted' : ''}`}
          >
            <span className="wn-float-card__icon" aria-hidden="true"><Mic2 size={16} /></span>
            <div className="wn-float-card__copy">
              <strong>{copy.cardReciteTitle}</strong>
              <small>{copy.cardReciteSub}</small>
              <span className="wn-float-card__wave" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveId('progress')}
            className={`wn-float-card wn-float-card--progress wn-float-card--interactive ${activeFeature.stageFocus === 'progress' ? 'is-highlighted' : ''}`}
          >
            <div className="wn-progress-ring" aria-hidden="true"><span>✦</span></div>
            <div className="wn-float-card__copy">
              <strong>{copy.cardProgressTitle}</strong>
              <small>{copy.cardProgressSub}</small>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveId('family')}
            className={`wn-float-card wn-float-card--family wn-float-card--interactive ${activeFeature.stageFocus === 'family' ? 'is-highlighted' : ''}`}
          >
            <span className="wn-float-card__icon" aria-hidden="true"><CheckCircle2 size={16} /></span>
            <div className="wn-float-card__copy">
              <strong>{copy.cardFamilyTitle}</strong>
              <small>{copy.cardFamilySub}</small>
            </div>
          </button>

          <div className="wn-stage-focus-note" aria-live="polite">
            <span className="wn-stage-focus-note__badge" aria-hidden="true">
              <ActiveFeatureIcon size={15} strokeWidth={1.8} />
            </span>
            <div className="wn-stage-focus-note__text">
              <strong>{activeFeature.title}</strong>
              <span>{activeFeature.stageNote}</span>
            </div>
            <i className="wn-stage-focus-note__pulse" aria-hidden="true" />
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
