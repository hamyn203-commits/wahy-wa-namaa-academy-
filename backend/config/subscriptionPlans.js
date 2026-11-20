const { getTierForCountry } = require('./geoPricing');

const SESSION_PACKS = Object.freeze([4, 8, 12, 24]);
const SECTIONS = Object.freeze(['men_children', 'ladies']);

const PLANS = Object.freeze({
  community: Object.freeze({
    key: 'community',
    pricePerSessionMinor: 1000,
    minStudents: 15,
    maxStudents: 20,
    durationMinMinutes: 60,
    durationMaxMinutes: 120,
    name: { ar: 'الحلقة الاقتصادية الكبرى', en: 'Community Circle' },
    durationLabel: { ar: 'من ساعة إلى ساعتين', en: '1–2 hours' },
  }),
  group: Object.freeze({
    key: 'group',
    pricePerSessionMinor: 2000,
    minStudents: 5,
    maxStudents: 10,
    durationMinMinutes: 60,
    durationMaxMinutes: 120,
    name: { ar: 'الحلقة الجماعية', en: 'Group Circle' },
    durationLabel: { ar: 'من ساعة إلى ساعتين', en: '1–2 hours' },
  }),
  focused: Object.freeze({
    key: 'focused',
    pricePerSessionMinor: 3500,
    minStudents: 3,
    maxStudents: 5,
    durationMinMinutes: 90,
    durationMaxMinutes: 90,
    name: { ar: 'الحلقة المركزة', en: 'Focused Circle' },
    durationLabel: { ar: 'ساعة ونصف', en: '90 minutes' },
  }),
  mini: Object.freeze({
    key: 'mini',
    pricePerSessionMinor: 5000,
    minStudents: 2,
    maxStudents: 3,
    durationMinMinutes: null,
    durationMaxMinutes: 60,
    name: { ar: 'الحلقة المصغرة', en: 'Mini Circle' },
    durationLabel: { ar: 'ساعة أو أقل', en: 'Up to 60 minutes' },
  }),
  private: Object.freeze({
    key: 'private',
    pricePerSessionMinor: 10000,
    minStudents: 1,
    maxStudents: 1,
    durationMinMinutes: null,
    durationMaxMinutes: 60,
    name: { ar: 'الحصة الفردية', en: 'Private Session' },
    durationLabel: { ar: 'ساعة أو أقل', en: 'Up to 60 minutes' },
    fromPrice: true,
  }),
});

function getPlan(planKey) {
  return PLANS[String(planKey || '').trim()] || null;
}

function isSessionPack(value) {
  return SESSION_PACKS.includes(Number(value));
}

function isSection(value) {
  return SECTIONS.includes(String(value || '').trim());
}

// Legacy students registered before the division chooser remain eligible.
// New accounts with a declared division cannot bypass it in a direct API request.
function isCompatibleStudentSection(enrollmentSection, section) {
  return !isSection(enrollmentSection) || enrollmentSection === section;
}

function quoteSubscription({ planKey, sessionCount, countryCode = 'EG' }) {
  const plan = getPlan(planKey);
  const count = Number(sessionCount);

  if (!plan) {
    const error = new Error('الخطة غير موجودة');
    error.code = 'SUBSCRIPTION_PLAN_INVALID';
    throw error;
  }

  if (!isSessionPack(count)) {
    const error = new Error('عدد الحصص غير متاح');
    error.code = 'SUBSCRIPTION_PACK_INVALID';
    throw error;
  }

  const tier = getTierForCountry(countryCode);
  const regionalMinor = tier.pricesMinor[plan.key] ?? plan.pricePerSessionMinor;

  return {
    plan: { ...plan, pricePerSessionMinor: regionalMinor },
    sessionCount: count,
    currency: tier.currency,
    region: tier.region,
    countryCode: tier.countryCode,
    pricePerSessionMinor: regionalMinor,
    totalAmountMinor: regionalMinor * count,
  };
}

function publicPlanCatalog({ countryCode = 'EG' } = {}) {
  const tier = getTierForCountry(countryCode);
  return {
    currency: tier.currency,
    region: tier.region,
    countryCode: tier.countryCode,
    regionLabel: tier.regionLabel,
    localCurrencyHint: tier.localCurrencyHint,
    sessionPacks: [...SESSION_PACKS],
    sections: [...SECTIONS],
    plans: Object.values(PLANS).map((plan) => ({
      ...plan,
      pricePerSessionMinor: tier.pricesMinor[plan.key] ?? plan.pricePerSessionMinor,
    })),
  };
}

module.exports = {
  SESSION_PACKS,
  SECTIONS,
  PLANS,
  getPlan,
  isSessionPack,
  isSection,
  isCompatibleStudentSection,
  quoteSubscription,
  publicPlanCatalog,
};

