import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { useMarket } from '../../../context/MarketProvider';
import {
  formatLocalEquivalent,
  formatRegionalMoney,
  resolveRegionalPlanPriceMinor,
  usdLocalEquivalentNote,
} from '../../../lib/regionalPricing';
import {
  Calculator,
  Users,
  Heart,
  Clock3,
  Check,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Crown,
  CalendarRange,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { handleRovingKeyDown, pickLocale } from '../landingI18n';
import { CALCULATOR_COPY } from '../landingI18nPart2';

const CALCULATOR_PLANS = [
  {
    id: 'focused',
    price: 20,
    allowedPacks: [8, 12, 24],
    i18n: {
      ar: {
        name: 'الحلقة الجماعية المركّزة',
        badge: 'تبدأ من 20 ج • 3–5 طلاب',
        students: 'من 3 إلى 5 طلاب فقط',
        duration: '45 دقيقة',
        recitation: 'مجموعة صغيرة مركّزة تضمن وقت تسميع وتصحيح وافراً لكل طالب',
        features: [
          '3 إلى 5 طلاب كحد أقصى في الحلقة',
          'مدة الحصة 45 دقيقة ثابتة ومنظمة',
          '20 ج/حصة لباقتَي 12 و24 حصة (و25 ج لباقة 8 حصص)',
        ],
      },
      en: {
        name: 'Focused Group Circle',
        badge: '3–5 learners',
        students: '3–5 students only',
        duration: '45 minutes',
        recitation: 'Small focused circle giving every learner generous recitation & feedback time',
        features: [
          'Maximum 3 to 5 matched learners per circle',
          'Fixed 45-minute structured live session',
          'Available in 8, 12, or 24 monthly session packs',
        ],
      },
    },
  },
  {
    id: 'mini',
    price: 45,
    allowedPacks: [8, 12, 24],
    i18n: {
      ar: {
        name: 'حلقة الإخوة والثنائية',
        badge: 'للإخوة • تبدأ فوراً',
        students: 'من 2 إلى 3 طلاب (إخوة أو ثنائي)',
        duration: '45 دقيقة',
        recitation: 'مثالية لأخوين أو 3 إخوة في نفس البيت مع معلم واحد بدون انتظار تسكين',
        features: [
          'تبدأ فوراً للإخوة بدون انتظار اكتمال مجموعة',
          'اهتمام شبه فردي وتشجيع عائلي مشترك',
          'مدة الحصة 45 دقيقة بجدول يناسب الأسرة',
        ],
      },
      en: {
        name: 'Siblings & Dual Circle',
        badge: 'Siblings • Instant start',
        students: '2–3 learners (siblings or dual)',
        duration: '45 minutes',
        recitation: 'Ideal for 2 or 3 siblings sharing one dedicated tutor with zero waiting',
        features: [
          'Starts immediately for siblings with no group queue',
          'Near-individual coaching & shared family motivation',
          'Fixed 45-minute session tailored to family schedules',
        ],
      },
    },
  },
  {
    id: 'private',
    featured: true,
    price: 80,
    allowedPacks: [4, 8, 12, 24],
    i18n: {
      ar: {
        name: 'الباقة الفردية المركّزة (1-on-1)',
        badge: 'الأكثر طلبًا • يبدأ فوراً',
        students: 'طالب واحد فقط (1-on-1)',
        duration: '30 دقيقة',
        recitation: 'معلم خاص لك أو لطفلك وحدك لبداية فورية وتقدم مضاعف',
        features: [
          'طالب واحد فقط مع المعلم أو المعلمة (1-on-1)',
          '30 دقيقة مركّزة مثالية للأطفال والحفظ المنتظم',
          'مرونة كاملة في المواعيد وبداية فورية بدون انتظار',
        ],
      },
      en: {
        name: 'Focused Private 1-on-1',
        badge: 'Most popular • Instant start',
        students: '1 student (1-on-1)',
        duration: '30 minutes',
        recitation: 'Dedicated 1-on-1 tutor exclusively for you or your child',
        features: [
          'Undivided 1-on-1 instructor attention',
          'Focused 30-minute session ideal for kids & steady Hifz',
          'Flexible personal scheduling with immediate start',
        ],
      },
    },
  },
  {
    id: 'private_intensive',
    price: 150,
    allowedPacks: [4, 8, 12, 24],
    i18n: {
      ar: {
        name: 'الفردية المكثّفة والإجازة (1-on-1)',
        badge: 'ساعة كاملة • سند متصل',
        students: 'طالب واحد • ختم وإجازة',
        duration: '60 دقيقة',
        recitation: 'ساعة كاملة فردية للختم والمراجعة المكثفة والإجازة بالسند المتصل',
        features: [
          '60 دقيقة كاملة فردية خالصة (1-on-1)',
          'مثالية للمراجعة الكبيرة وتصحيح التلاوة والإجازات',
          'متابعة فردية دقيقة مع كبار المعلمين والمعلمات المجازين',
        ],
      },
      en: {
        name: 'Intensive Private & Ijazah',
        badge: '60 min • Sanad & Mastery',
        students: '1 student • Intensive & Ijazah',
        duration: '60 minutes',
        recitation: 'Full 60-minute private session for intensive revision, Khatmah & Sanad Ijazah',
        features: [
          'Full 60-minute undivided 1-on-1 session',
          'Designed for intensive Hifz, Tajweed & Ijazah tracks',
          'Personalized study plan with certified scholars',
        ],
      },
    },
  },
];

const PLAN_KEYS = CALCULATOR_PLANS.map((p) => p.id);
const SECTION_KEYS = ['general', 'women'];

export default function PricingCalculatorSection() {
  const { locale, isRTL } = useI18n();
  const { regionalPricing } = useMarket();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(CALCULATOR_COPY, locale, isRTL);

  const [section, setSection] = useState('general');
  const [selectedPlanId, setSelectedPlanId] = useState('private');
  const [sessionCount, setSessionCount] = useState(12);

  const billingCurrency = regionalPricing?.currency || 'EGP';
  const localHint = regionalPricing?.localCurrencyHint || null;

  const activePlan = CALCULATOR_PLANS.find((plan) => plan.id === selectedPlanId) || CALCULATOR_PLANS[0];
  const allowedPacks = activePlan.allowedPacks || [4, 8, 12, 24];
  const effectiveSessionCount = allowedPacks.includes(sessionCount)
    ? sessionCount
    : allowedPacks[0];

  const getMinorForPlan = (plan, packCount = effectiveSessionCount) => {
    const validPack = (plan.allowedPacks || [4, 8, 12, 24]).includes(packCount)
      ? packCount
      : (plan.allowedPacks?.[0] || 12);
    return resolveRegionalPlanPriceMinor(regionalPricing, plan.id, validPack, plan.price);
  };

  const activePlanCopy = pickLocale(activePlan.i18n, locale, isRTL);
  const activeMinor = getMinorForPlan(activePlan, effectiveSessionCount);
  const totalMinor = activeMinor * effectiveSessionCount;
  const totalLocalHint = formatLocalEquivalent(totalMinor, billingCurrency, localHint, isRTL);
  const pacingNote = copy.pacing?.[effectiveSessionCount] || '';

  const checkoutTarget = `/plans?section=${encodeURIComponent(section)}&plan=${encodeURIComponent(activePlan.id)}&sessions=${effectiveSessionCount}`;
  const minFormattedPrice = formatRegionalMoney(
    regionalPricing?.minPriceMinor ?? 2000,
    billingCurrency,
    locale
  );

  const sessionWord = (count) => {
    if (locale === 'ar') return count === 12 ? copy.sessionSingular : copy.sessionPlural;
    return count === 1 ? copy.sessionSingular : copy.sessionPlural;
  };

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId);
    const nextPlan = CALCULATOR_PLANS.find((p) => p.id === planId);
    if (nextPlan?.allowedPacks && !nextPlan.allowedPacks.includes(sessionCount)) {
      setSessionCount(nextPlan.allowedPacks.includes(12) ? 12 : nextPlan.allowedPacks[0]);
    }
  };

  return (
    <section className="wn-home-section wn-home-section--white" id="pricing-calculator">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <Calculator size={14} aria-hidden="true" />
            {copy.eyebrow}
          </span>
          <h2>{copy.title}</h2>
          <p>{copy.lead.replace('{minPrice}', minFormattedPrice)}</p>
        </div>

        <div className="wn-calc-shell">
          <div className="wn-calc-controls">
            {/* 1. Section Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">{copy.step1}</span>
              <div className="wn-calc-section-toggle" role="group" aria-label={copy.sectionAria}>
                <button
                  type="button"
                  aria-pressed={section === 'general'}
                  aria-controls="wn-calc-summary-panel"
                  onClick={() => setSection('general')}
                  onKeyDown={(event) => handleRovingKeyDown({
                    event,
                    keys: SECTION_KEYS,
                    currentKey: 'general',
                    onSelect: setSection,
                    isRTL,
                  })}
                  className={'wn-calc-section-btn' + (section === 'general' ? ' is-active' : '')}
                >
                  <Users size={18} aria-hidden="true" />
                  <div>
                    <strong>{copy.menTitle}</strong>
                    <small>{copy.menSub}</small>
                  </div>
                </button>
                <button
                  type="button"
                  aria-pressed={section === 'women'}
                  aria-controls="wn-calc-summary-panel"
                  onClick={() => setSection('women')}
                  onKeyDown={(event) => handleRovingKeyDown({
                    event,
                    keys: SECTION_KEYS,
                    currentKey: 'women',
                    onSelect: setSection,
                    isRTL,
                  })}
                  className={'wn-calc-section-btn is-women' + (section === 'women' ? ' is-active' : '')}
                >
                  <Heart size={18} aria-hidden="true" />
                  <div>
                    <strong>{copy.womenTitle}</strong>
                    <small>{copy.womenSub}</small>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Plan Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">{copy.step2}</span>
              <div className="wn-calc-plans" role="radiogroup" aria-label={copy.planAria}>
                {CALCULATOR_PLANS.map((plan) => {
                  const active = plan.id === activePlan.id;
                  const pCopy = pickLocale(plan.i18n, locale, isRTL);
                  const planMinor = getMinorForPlan(plan, effectiveSessionCount);
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      role="radio"
                      aria-checked={active}
                      aria-controls="wn-calc-summary-panel"
                      tabIndex={active ? 0 : -1}
                      onClick={() => handleSelectPlan(plan.id)}
                      onKeyDown={(event) => handleRovingKeyDown({
                        event,
                        keys: PLAN_KEYS,
                        currentKey: plan.id,
                        onSelect: handleSelectPlan,
                        isRTL,
                      })}
                      className={
                        'wn-calc-plan-btn'
                        + (active ? ' is-active' : '')
                        + (plan.featured ? ' is-featured' : '')
                      }
                    >
                      <div className="wn-calc-plan-btn__top">
                        <span className="wn-calc-plan-btn__badge">
                          {plan.featured && <Crown size={11} aria-hidden="true" />}
                          {pCopy.badge}
                        </span>
                        <strong className="wn-calc-plan-btn__price">
                          {formatRegionalMoney(planMinor, billingCurrency, locale)}
                          <small>{copy.perSessionUnit}</small>
                        </strong>
                      </div>
                      <strong className="wn-calc-plan-btn__name">{pCopy.name}</strong>
                      <span className="wn-calc-plan-btn__meta">
                        {pCopy.students} • {pCopy.duration}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Session Pack Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">{copy.step3}</span>
              <div className="wn-calc-packs" role="radiogroup" aria-label={copy.packsAria}>
                {allowedPacks.map((count) => {
                  const active = effectiveSessionCount === count;
                  return (
                    <button
                      type="button"
                      key={count}
                      role="radio"
                      aria-checked={active}
                      aria-controls="wn-calc-summary-panel"
                      tabIndex={active ? 0 : -1}
                      onClick={() => setSessionCount(count)}
                      onKeyDown={(event) => handleRovingKeyDown({
                        event,
                        keys: allowedPacks,
                        currentKey: count,
                        onSelect: setSessionCount,
                        isRTL,
                      })}
                      className={'wn-calc-pack-btn' + (active ? ' is-active' : '')}
                    >
                      <strong>{count}</strong>
                      <span>{sessionWord(count)}</span>
                    </button>
                  );
                })}
              </div>
              {pacingNote && (
                <div className="wn-calc-pacing-hint">
                  <CalendarRange size={15} aria-hidden="true" />
                  <span>{pacingNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Live Summary Card */}
          <aside id="wn-calc-summary-panel" className="wn-calc-summary" aria-live="polite">
            <div className="wn-calc-summary__header">
              <span className="wn-calc-summary__pill">
                <Sparkles size={13} aria-hidden="true" />
                {section === 'women' ? copy.womenPill : copy.menPill}
              </span>
              <h3>{activePlanCopy.name}</h3>
              <p>{activePlanCopy.recitation}</p>
            </div>

            <div className="wn-calc-summary__pricing">
              <div className="wn-calc-summary__row">
                <span>{copy.pricePerSessionLabel}</span>
                <strong>
                  {formatRegionalMoney(activeMinor, billingCurrency, locale)}
                </strong>
              </div>
              <div className="wn-calc-summary__row">
                <span>{copy.selectedSessionsLabel}</span>
                <strong>
                  {effectiveSessionCount} {sessionWord(effectiveSessionCount)}
                </strong>
              </div>
              <div className="wn-calc-summary__total">
                <span>{copy.packageTotalLabel}</span>
                <strong>
                  {formatRegionalMoney(totalMinor, billingCurrency, locale)}
                  {totalLocalHint ? <em> ({totalLocalHint})</em> : null}
                </strong>
              </div>
              {billingCurrency === 'USD' ? (
                <div className="wn-calc-summary__row">
                  <span>{usdLocalEquivalentNote(isRTL)}</span>
                </div>
              ) : null}
            </div>

            <div className="wn-calc-summary__specs">
              <span>
                <Users size={15} aria-hidden="true" />
                {activePlanCopy.students}
              </span>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                {activePlanCopy.duration}
              </span>
            </div>

            <ul className="wn-calc-summary__features">
              {activePlanCopy.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="wn-calc-summary__actions">
              <LocalizedLink
                to={checkoutTarget}
                locale={locale}
                onMouseEnter={() => prefetchRoute('/plans')}
                className="wn-btn wn-btn--light wn-btn--lg wn-btn--block"
              >
                <span>{copy.continueCta}</span>
                <ArrowIcon size={17} className="wn-btn__arrow" aria-hidden="true" />
              </LocalizedLink>
              <LocalizedLink
                to="/free-trial"
                locale={locale}
                onMouseEnter={() => prefetchRoute('/free-trial')}
                className="wn-btn wn-btn--outline-light wn-btn--block"
              >
                <span>{copy.trialCta}</span>
              </LocalizedLink>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
