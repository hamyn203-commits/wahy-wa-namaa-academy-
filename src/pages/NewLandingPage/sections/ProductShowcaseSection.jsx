import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  Mic2,
  Radio,
  BarChart3,
  MessageCircleHeart,
  CalendarCheck2,
  BookOpenCheck,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Headphones,
  ShieldCheck,
  UserCheck,
  Eye,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { SHOWCASE_COPY, handleRovingKeyDown, pickLocale } from '../landingI18n';

const STUDIO_ICONS = {
  listen: Headphones,
  record: Radio,
  review: BookOpenCheck,
};

const CLASSROOM_META = {
  student: { icon: UserCheck, itemIcons: [CalendarCheck2, Mic2, CheckCircle2] },
  teacher: { icon: Radio, itemIcons: [BookOpenCheck, CalendarCheck2, CheckCircle2] },
  guardian: { icon: Eye, itemIcons: [ShieldCheck, CheckCircle2, MessageCircleHeart] },
};

function Waveform({ active }) {
  return (
    <div className={`wn-product-wave ${active ? 'is-energized' : ''}`} aria-hidden="true" data-visual-mask>
      {Array.from({ length: 28 }).map((_, index) => <i key={index} style={{ '--i': index }} />)}
    </div>
  );
}

export default function ProductShowcaseSection() {
  const { locale, isRTL } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(SHOWCASE_COPY, locale, isRTL);

  const [studioMode, setStudioMode] = useState('listen');
  const [activeMilestone, setActiveMilestone] = useState(3);
  const [classroomRole, setClassroomRole] = useState('student');

  const studioModes = copy.studioModes.map((mode) => ({
    ...mode,
    icon: STUDIO_ICONS[mode.id] || Headphones,
  }));
  const studioKeys = studioModes.map((mode) => mode.id);

  const milestones = copy.milestones;
  const milestoneKeys = milestones.map((item) => item.step);

  const classroomRoleKeys = Object.keys(CLASSROOM_META);
  const classroomViews = Object.fromEntries(
    classroomRoleKeys.map((roleKey) => {
      const view = copy.classroomViews[roleKey];
      const meta = CLASSROOM_META[roleKey];
      return [
        roleKey,
        {
          label: view.label,
          icon: meta.icon,
          headline: view.headline,
          items: view.items.map((text, idx) => ({
            icon: meta.itemIcons[idx] || CheckCircle2,
            text,
          })),
        },
      ];
    }),
  );

  const currentStudio = studioModes.find((mode) => mode.id === studioMode) || studioModes[0];
  const currentMilestone = milestones.find((item) => item.step === activeMilestone) || milestones[2];
  const currentClassroom = classroomViews[classroomRole] || classroomViews.student;

  return (
    <section className="wn-product-showcase" id="learning-tools">
      <div className="page-container">
        <div className="wn-section-split-heading wn-product-showcase__heading">
          <div>
            <span className="wn-approved-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h2 className="wn-home-title">{copy.title}</h2>
            <p className="wn-home-lead">{copy.lead}</p>
          </div>

          <span className="wn-product-showcase__demo-label">{copy.sandboxBadge}</span>
        </div>

        <div className="wn-product-bento">
          {/* Tile 1: Interactive Recitation Studio */}
          <article className="wn-product-tile wn-product-tile--recitation">
            <div className="wn-product-tile__top">
              <span className="wn-product-icon" aria-hidden="true"><Mic2 size={20} /></span>
              <span className="wn-product-status"><i aria-hidden="true" /> {copy.studioStatus}</span>
            </div>

            <div className="wn-product-recitation">
              <div className="wn-product-recitation__verse">
                <span>{copy.verseLabel}</span>
                <p className="font-quran">وَقُل رَّبِّ زِدْنِي عِلْمًا</p>
              </div>
              <Waveform active={studioMode === 'record'} />
              <div className="wn-product-recitation__controls" role="tablist" aria-label={copy.modesAria}>
                {studioModes.map(({ id, icon: ModeIcon, label }) => {
                  const active = id === studioMode;
                  return (
                    <button
                      type="button"
                      role="tab"
                      id={`wn-studio-tab-${id}`}
                      aria-selected={active}
                      aria-controls="wn-studio-tabpanel"
                      tabIndex={active ? 0 : -1}
                      key={id}
                      onClick={() => setStudioMode(id)}
                      onKeyDown={(event) => handleRovingKeyDown({
                        event,
                        keys: studioKeys,
                        currentKey: id,
                        onSelect: setStudioMode,
                        isRTL,
                      })}
                      className={`wn-studio-mode-btn ${active ? 'is-active' : ''}`}
                    >
                      <ModeIcon size={15} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                id="wn-studio-tabpanel"
                role="tabpanel"
                aria-labelledby={`wn-studio-tab-${currentStudio.id}`}
                className="wn-studio-feedback"
                aria-live="polite"
              >
                <strong>{currentStudio.status}</strong>
                <div className="wn-studio-feedback__tags">
                  {currentStudio.tags.map((tag) => (
                    <span key={tag}><CheckCircle2 size={13} aria-hidden="true" /> {tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="wn-product-tile__copy">
              <h3>{copy.tile1Title}</h3>
              <p>{copy.tile1Desc}</p>
            </div>
          </article>

          {/* Tile 2: Interactive 5-Milestone Hifz Map */}
          <article className="wn-product-tile wn-product-tile--journey">
            <div className="wn-product-tile__top">
              <span className="wn-product-icon wn-product-icon--mint" aria-hidden="true"><BarChart3 size={19} /></span>
              <span className="wn-product-kicker">{copy.hifzKicker}</span>
            </div>

            <div className="wn-hifz-map wn-hifz-map--interactive" role="tablist" aria-label={copy.hifzAria}>
              {milestones.map((item, idx) => {
                const isSelected = item.step === activeMilestone;
                const stateClass = item.state === 'done' ? 'is-done' : item.state === 'current' ? 'is-current' : '';
                return (
                  <span key={item.step} className="wn-hifz-map__group">
                    <button
                      type="button"
                      role="tab"
                      id={`wn-hifz-tab-${item.step}`}
                      aria-selected={isSelected}
                      aria-controls="wn-hifz-tabpanel"
                      aria-label={item.title}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setActiveMilestone(item.step)}
                      onKeyDown={(event) => handleRovingKeyDown({
                        event,
                        keys: milestoneKeys,
                        currentKey: item.step,
                        onSelect: setActiveMilestone,
                        isRTL,
                      })}
                      className={`wn-hifz-node ${stateClass} ${isSelected ? 'is-selected' : ''}`}
                    >
                      {item.step}
                    </button>
                    {idx < milestones.length - 1 && <i aria-hidden="true" />}
                  </span>
                );
              })}
            </div>

            <div
              id="wn-hifz-tabpanel"
              role="tabpanel"
              aria-labelledby={`wn-hifz-tab-${currentMilestone.step}`}
              className="wn-hifz-detail"
              aria-live="polite"
            >
              <strong>{currentMilestone.title}</strong>
              <p>{currentMilestone.desc}</p>
            </div>

            <h3>{copy.tile2Title}</h3>
            <p>{copy.tile2Desc}</p>
          </article>

          {/* Tile 3: Interactive Live Classroom Perspectives */}
          <article className="wn-product-tile wn-product-tile--classroom">
            <div className="wn-classroom-tabs" role="tablist" aria-label={copy.classroomAria}>
              {Object.entries(classroomViews).map(([key, view]) => {
                const RoleIcon = view.icon;
                const active = key === classroomRole;
                return (
                  <button
                    type="button"
                    role="tab"
                    id={`wn-classroom-tab-${key}`}
                    aria-selected={active}
                    aria-controls="wn-classroom-tabpanel"
                    tabIndex={active ? 0 : -1}
                    key={key}
                    onClick={() => setClassroomRole(key)}
                    onKeyDown={(event) => handleRovingKeyDown({
                      event,
                      keys: classroomRoleKeys,
                      currentKey: key,
                      onSelect: setClassroomRole,
                      isRTL,
                    })}
                    className={`wn-classroom-tab ${active ? 'is-active' : ''}`}
                  >
                    <RoleIcon size={14} aria-hidden="true" />
                    <span>{view.label}</span>
                  </button>
                );
              })}
            </div>

            <div
              id="wn-classroom-tabpanel"
              role="tabpanel"
              aria-labelledby={`wn-classroom-tab-${classroomRole}`}
              className="wn-product-classroom__screen"
              aria-live="polite"
            >
              <div className="wn-product-classroom__teacher">
                <span aria-hidden="true"><Radio size={18} /></span>
                <strong>{`${copy.classroomTitlePrefix}${currentClassroom.label}${copy.classroomTitleSuffix}`}</strong>
                <small>{currentClassroom.headline}</small>
              </div>
              <div className="wn-product-classroom__rail">
                {currentClassroom.items.map(({ icon: ItemIcon, text }) => (
                  <span key={text}><ItemIcon size={15} aria-hidden="true" /> {text}</span>
                ))}
              </div>
            </div>
            <div className="wn-product-tile__copy">
              <h3>{copy.tile3Title}</h3>
              <p>{copy.tile3Desc}</p>
            </div>
          </article>

          {/* Tile 4: Structured Family Report */}
          <article className="wn-product-tile wn-product-tile--family">
            <div className="wn-product-tile__top">
              <span className="wn-product-icon wn-product-icon--gold" aria-hidden="true"><MessageCircleHeart size={19} /></span>
              <span className="wn-product-kicker">{copy.familyKicker}</span>
            </div>

            <div className="wn-family-report wn-family-report--structured">
              {copy.reportRows.map((row, index) => (
                <div key={row.label} className="wn-family-report__row">
                  <span>{index + 1}</span>
                  <div>
                    <small>{row.label}</small>
                    <p>{row.value}</p>
                  </div>
                  <CheckCircle2 size={15} aria-hidden="true" />
                </div>
              ))}
            </div>

            <h3>{copy.tile4Title}</h3>
            <p>{copy.tile4Desc}</p>
          </article>
        </div>

        <div className="wn-product-showcase__cta">
          <LocalizedLink
            to="/free-trial"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/free-trial')}
            className="wn-btn wn-btn--primary wn-btn--lg"
          >
            <span>{copy.ctaTrial}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" aria-hidden="true" />
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
