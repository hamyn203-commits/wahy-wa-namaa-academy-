import { useState } from 'react';
import { useI18n } from '../../../i18n';
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
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';

const CALCULATOR_PLANS = [
  {
    id: 'community',
    nameAr: 'الحلقة الاقتصادية الكبرى',
    nameEn: 'Community Circle',
    badgeAr: 'الأوفر',
    badgeEn: 'Best value',
    price: 10,
    studentsAr: 'من 15 إلى 20 طالب',
    studentsEn: '15–20 students',
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    recitationAr: 'تسميع بالدور ومتابعة مستمرة',
    recitationEn: 'Turn-based recitation & continuous follow-up',
    featuresAr: [
      'أقل تكلفة للاستمرار في الحفظ والمراجعة',
      'بيئة جماعية مشجعة ومنظمة',
      'تقارير حضور وتقدم دورية',
    ],
    featuresEn: [
      'Lowest cost for steady memorization and review',
      'Encouraging, structured group circle',
      'Regular attendance and progress reports',
    ],
  },
  {
    id: 'group',
    nameAr: 'الحلقة الجماعية',
    nameEn: 'Group Circle',
    badgeAr: 'الأكثر طلبًا',
    badgeEn: 'Most popular',
    featured: true,
    price: 20,
    studentsAr: 'من 5 إلى 10 طلاب',
    studentsEn: '5–10 students',
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    recitationAr: 'وقت تسميع أطول ومتابعة أقرب',
    recitationEn: 'Longer recitation slot & closer guidance',
    featuresAr: [
      'أفضل توازن بين السعر ووقت التسميع الفردي',
      'تصحيح مباشر للتلاوة وأحكام التجويد',
      'متابعة أسبوعية مع ولي الأمر أو الطالب',
    ],
    featuresEn: [
      'Best balance between price and individual recitation time',
      'Live recitation and Tajweed correction',
      'Weekly follow-up with parent or learner',
    ],
  },
  {
    id: 'focused',
    nameAr: 'الحلقة المركزة',
    nameEn: 'Focused Circle',
    badgeAr: 'متابعة أقوى',
    badgeEn: 'High focus',
    price: 35,
    studentsAr: 'من 3 إلى 5 طلاب',
    studentsEn: '3–5 students',
    durationAr: 'ساعة ونصف',
    durationEn: '90 minutes',
    recitationAr: 'تركيز عالٍ للحفظ والمراجعة المكثفة',
    recitationEn: 'High focus for intensive Hifz & review',
    featuresAr: [
      'مجموعة صغيرة جداً بتركيز مضاعف لكل طالب',
      'مناسبة لخطة الحفظ السريع والمراجعة الكبرى',
      'تقييم تفصيلي بعد كل حصة',
    ],
    featuresEn: [
      'Very small group with doubled attention per learner',
      'Ideal for accelerated Hifz and major review',
      'Detailed evaluation after every session',
    ],
  },
  {
    id: 'mini',
    nameAr: 'الحلقة المصغرة',
    nameEn: 'Mini Circle',
    badgeAr: 'شبه فردي',
    badgeEn: 'Semi-private',
    price: 50,
    studentsAr: 'من 2 إلى 3 طلاب',
    studentsEn: '2–3 students',
    durationAr: 'ساعة أو أقل',
    durationEn: 'Up to 60 minutes',
    recitationAr: 'اهتمام شبه فردي وخطة دقيقة',
    recitationEn: 'Near-private coaching & tailored pacing',
    featuresAr: [
      'طالبان أو ثلاثة فقط مع المعلم أو المعلمة',
      'مناسبة للإخوة أو الأصدقاء في نفس المستوى',
      'مرونة عالية في وتيرة الحفظ والتلقين',
    ],
    featuresEn: [
      'Only 2–3 learners with the instructor',
      'Great for siblings or peers at the same level',
      'High flexibility in memorization pacing',
    ],
  },
  {
    id: 'private',
    nameAr: 'الحصة الفردية',
    nameEn: 'Private Session',
    badgeAr: 'أعلى متابعة',
    badgeEn: '1-on-1 private',
    from: true,
    price: 100,
    studentsAr: 'طالب واحد فقط',
    studentsEn: '1 student (1-on-1)',
    durationAr: 'ساعة أو أقل',
    durationEn: 'Up to 60 minutes',
    recitationAr: 'الوقت بالكامل مخصص لك وحدك',
    recitationEn: '100% of the session dedicated to you',
    featuresAr: [
      'خطة مخصصة بالكامل (حفظ، تجويد، أو إجازة بالسند)',
      'أعلى مرونة في اختيار المواعيد',
      'تركيز كامل من المعلم طوال وقت الحصة',
    ],
    featuresEn: [
      'Fully personalized plan (Hifz, Tajweed, or Sanad Ijazah)',
      'Maximum scheduling flexibility',
      'Undivided instructor attention throughout the session',
    ],
  },
];

const SESSION_PACKS = [4, 8, 12, 24];

export default function PricingCalculatorSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [section, setSection] = useState('general');
  const [selectedPlanId, setSelectedPlanId] = useState('group');
  const [sessionCount, setSessionCount] = useState(8);

  const activePlan = CALCULATOR_PLANS.find((plan) => plan.id === selectedPlanId) || CALCULATOR_PLANS[1];
  const totalAmount = activePlan.price * sessionCount;

  return (
    <section className="wn-home-section wn-home-section--white" id="pricing-calculator">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <Calculator size={14} />
            {isAr ? 'حاسبة ومقارنة الباقات' : 'INTERACTIVE PLAN CALCULATOR'}
          </span>
          <h2>
            {isAr
              ? 'احسب تكلفة باقتك باختيار حجم الحلقة وعدد الحصص'
              : 'Calculate your package by circle size and session count'}
          </h2>
          <p>
            {isAr
              ? 'أسعار واضحة تبدأ من 10 جنيهات للحصة الواحدة. اختر القسم ونوع الحلقة وعدد الحصص لتظهر لك التكلفة الإجمالية فوراً.'
              : 'Transparent pricing starting from 10 EGP per session. Select your section, circle type, and session pack to see your exact total.'}
          </p>
        </div>

        <div className="wn-calc-shell">
          <div className="wn-calc-controls">
            {/* 1. Section Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">
                {isAr ? '١. اختر القسم التعليمي' : '1. Choose learning section'}
              </span>
              <div className="wn-calc-section-toggle" role="tablist" aria-label={isAr ? 'القسم التعليمي' : 'Learning section'}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === 'general'}
                  onClick={() => setSection('general')}
                  className={'wn-calc-section-btn' + (section === 'general' ? ' is-active' : '')}
                >
                  <Users size={17} />
                  <div>
                    <strong>{isAr ? 'قسم الرجال والأطفال' : 'Men & Children'}</strong>
                    <small>{isAr ? 'حلقات مقسمة حسب السن والمستوى' : 'Grouped by age and level'}</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === 'women'}
                  onClick={() => setSection('women')}
                  className={'wn-calc-section-btn wn-calc-section-btn--women' + (section === 'women' ? ' is-active' : '')}
                >
                  <Heart size={17} />
                  <div>
                    <strong>{isAr ? 'قسم السيدات' : 'Women’s Section'}</strong>
                    <small>{isAr ? 'معلمات مجازات وخصوصية تامة' : 'Certified female tutors only'}</small>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Plan Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">
                {isAr ? '٢. اختر نوع الحلقة (كلما قل العدد زاد وقت التسميع)' : '2. Choose circle size (smaller circle = more recitation time)'}
              </span>
              <div className="wn-calc-plans-grid" role="radiogroup" aria-label={isAr ? 'نوع الحلقة' : 'Circle type'}>
                {CALCULATOR_PLANS.map((plan) => {
                  const isSelected = plan.id === activePlan.id;
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={
                        'wn-calc-plan-option'
                        + (isSelected ? ' is-selected' : '')
                        + (plan.featured ? ' is-featured' : '')
                      }
                    >
                      <div className="wn-calc-plan-option__head">
                        <span className="wn-calc-plan-option__badge">
                          {plan.featured ? <Crown size={12} /> : null}
                          {isAr ? plan.badgeAr : plan.badgeEn}
                        </span>
                        <strong className="wn-calc-plan-option__price">
                          {plan.from ? (isAr ? 'من ' : 'from ') : ''}
                          {plan.price} <small>{isAr ? 'ج/حصة' : 'EGP'}</small>
                        </strong>
                      </div>
                      <h4>{isAr ? plan.nameAr : plan.nameEn}</h4>
                      <span className="wn-calc-plan-option__meta">
                        {isAr ? plan.studentsAr : plan.studentsEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Session Pack Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">
                {isAr ? '٣. اختر عدد الحصص في الباقة' : '3. Choose number of sessions in package'}
              </span>
              <div className="wn-calc-packs" role="radiogroup" aria-label={isAr ? 'عدد الحصص' : 'Number of sessions'}>
                {SESSION_PACKS.map((count) => {
                  const active = sessionCount === count;
                  return (
                    <button
                      type="button"
                      key={count}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSessionCount(count)}
                      className={'wn-calc-pack-btn' + (active ? ' is-active' : '')}
                    >
                      <strong>{count}</strong>
                      <span>{isAr ? (count === 12 ? 'حصة' : 'حصص') : 'sessions'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Summary Card */}
          <aside className="wn-calc-summary" aria-live="polite">
            <div className="wn-calc-summary__header">
              <span className="wn-calc-summary__pill">
                <Sparkles size={13} />
                {section === 'women'
                  ? (isAr ? 'قسم السيدات • معلمات مجازات' : 'Women’s Section • Female Tutors')
                  : (isAr ? 'قسم الرجال والأطفال' : 'Men & Children Section')}
              </span>
              <h3>{isAr ? activePlan.nameAr : activePlan.nameEn}</h3>
              <p>{isAr ? activePlan.recitationAr : activePlan.recitationEn}</p>
            </div>

            <div className="wn-calc-summary__pricing">
              <div className="wn-calc-summary__row">
                <span>{isAr ? 'سعر الحصة الواحدة' : 'Price per session'}</span>
                <strong>
                  {activePlan.from ? (isAr ? 'من ' : 'from ') : ''}
                  {activePlan.price} {isAr ? 'جنيه' : 'EGP'}
                </strong>
              </div>
              <div className="wn-calc-summary__row">
                <span>{isAr ? 'عدد الحصص المختارة' : 'Selected sessions'}</span>
                <strong>
                  {sessionCount} {isAr ? (sessionCount === 12 ? 'حصة' : 'حصص') : 'sessions'}
                </strong>
              </div>
              <div className="wn-calc-summary__total">
                <span>{isAr ? 'إجمالي الباقة' : 'Package total'}</span>
                <strong>
                  {activePlan.from ? (isAr ? 'من ' : 'from ') : ''}
                  {totalAmount} <em>{isAr ? 'جنيه' : 'EGP'}</em>
                </strong>
              </div>
            </div>

            <div className="wn-calc-summary__specs">
              <span>
                <Users size={15} />
                {isAr ? activePlan.studentsAr : activePlan.studentsEn}
              </span>
              <span>
                <Clock3 size={15} />
                {isAr ? activePlan.durationAr : activePlan.durationEn}
              </span>
            </div>

            <ul className="wn-calc-summary__features">
              {(isAr ? activePlan.featuresAr : activePlan.featuresEn).map((feature) => (
                <li key={feature}>
                  <Check size={15} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="wn-calc-summary__actions">
              <LocalizedLink to="/plans" locale={locale} className="wn-btn wn-btn--accent wn-btn--lg wn-btn--block">
                <span>{isAr ? 'انتقل لاختيار هذه الخطة' : 'Proceed with this plan'}</span>
                <ArrowIcon size={17} className="wn-btn__arrow" />
              </LocalizedLink>
              <LocalizedLink to="/free-trial" locale={locale} className="wn-btn wn-btn--outline-light wn-btn--sm wn-btn--block">
                <span>{isAr ? 'أو ابدأ بحصة تجريبية مجانية أولاً' : 'Or start with a free trial first'}</span>
              </LocalizedLink>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
