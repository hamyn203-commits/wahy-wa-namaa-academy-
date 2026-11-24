const { getTierForCountry } = require('./geoPricing');

const SESSION_PACKS = Object.freeze([4, 8, 12, 24]);
const SECTIONS = Object.freeze(['men_children', 'ladies']);

const PLANS = Object.freeze({
  focused: Object.freeze({
    key: 'focused',
    category: 'group_focused',
    pricePerSessionMinor: 2000,
    minStudents: 3,
    maxStudents: 5,
    durationMinMinutes: 45,
    durationMaxMinutes: 45,
    allowedSessionPacks: Object.freeze([8, 12, 24]),
    name: { ar: 'الحلقة الجماعية المركّزة', en: 'Focused Group Circle' },
    durationLabel: { ar: '45 دقيقة', en: '45 minutes' },
    fromPrice: true,
  }),
  mini: Object.freeze({
    key: 'mini',
    category: 'siblings_dual',
    pricePerSessionMinor: 4500,
    minStudents: 2,
    maxStudents: 3,
    durationMinMinutes: 45,
    durationMaxMinutes: 45,
    allowedSessionPacks: Object.freeze([8, 12, 24]),
    name: { ar: 'حلقة الإخوة والثنائية', en: 'Siblings & Dual Circle' },
    durationLabel: { ar: '45 دقيقة', en: '45 minutes' },
  }),
  private: Object.freeze({
    key: 'private',
    category: 'individual',
    pricePerSessionMinor: 8000,
    minStudents: 1,
    maxStudents: 1,
    durationMinMinutes: 30,
    durationMaxMinutes: 30,
    allowedSessionPacks: Object.freeze([4, 8, 12, 24]),
    name: { ar: 'الباقة الفردية المركّزة (1-on-1)', en: 'Focused Private 1-on-1 (30 min)' },
    durationLabel: { ar: '30 دقيقة', en: '30 minutes' },
  }),
  private_intensive: Object.freeze({
    key: 'private_intensive',
    category: 'individual',
    pricePerSessionMinor: 15000,
    minStudents: 1,
    maxStudents: 1,
    durationMinMinutes: 60,
    durationMaxMinutes: 60,
    allowedSessionPacks: Object.freeze([4, 8, 12, 24]),
    name: { ar: 'الفردية المكثّفة والإجازة (1-on-1)', en: 'Intensive Private & Ijazah (60 min)' },
    durationLabel: { ar: '60 دقيقة', en: '60 minutes' },
  }),
});

// Retained strictly so existing legacy subscribers, renewals, and historical circles keep working.
const LEGACY_PLANS = Object.freeze({
  community: Object.freeze({
    key: 'community',
    category: 'legacy_group',
    pricePerSessionMinor: 1000,
    minStudents: 15,
    maxStudents: 20,
    durationMinMinutes: 60,
    durationMaxMinutes: 120,
    allowedSessionPacks: Object.freeze([4, 8, 12, 24]),
    name: { ar: 'الحلقة الاقتصادية الكبرى', en: 'Community Circle' },
    durationLabel: { ar: 'من ساعة إلى ساعتين', en: '1–2 hours' },
  }),
  group: Object.freeze({
    key: 'group',
    category: 'legacy_group',
    pricePerSessionMinor: 2000,
    minStudents: 5,
    maxStudents: 10,
    durationMinMinutes: 60,
    durationMaxMinutes: 120,
    allowedSessionPacks: Object.freeze([4, 8, 12, 24]),
    name: { ar: 'الحلقة الجماعية', en: 'Group Circle' },
    durationLabel: { ar: 'من ساعة إلى ساعتين', en: '1–2 hours' },
  }),
});

function isActivePlan(planKey) {
  return Boolean(PLANS[String(planKey || '').trim()]);
}

function getPlan(planKey) {
  const cleanKey = String(planKey || '').trim();
  return PLANS[cleanKey] || LEGACY_PLANS[cleanKey] || null;
}

function isSessionPack(value, plan = null) {
  const count = Number(value);
  if (!SESSION_PACKS.includes(count)) return false;
  if (plan && Array.isArray(plan.allowedSessionPacks)) {
    return plan.allowedSessionPacks.includes(count);
  }
  return true;
}

function isSection(value) {
  return SECTIONS.includes(String(value || '').trim());
}

// Legacy students registered before the division chooser remain eligible.
// New accounts with a declared division cannot bypass it in a direct API request.
function isCompatibleStudentSection(enrollmentSection, section) {
  return !isSection(enrollmentSection) || enrollmentSection === section;
}

function resolvePriceMinorForPack(tier, plan, sessionCount) {
  const packOverride = tier?.packPricesMinor?.[plan.key]?.[Number(sessionCount)];
  if (Number.isSafeInteger(packOverride) && packOverride > 0) {
    return packOverride;
  }
  return tier?.pricesMinor?.[plan.key] ?? plan.pricePerSessionMinor;
}

function quoteSubscription({ planKey, sessionCount, countryCode = 'EG' }) {
  const plan = getPlan(planKey);
  const count = Number(sessionCount);

  if (!plan) {
    const error = new Error('الخطة غير موجودة');
    error.code = 'SUBSCRIPTION_PLAN_INVALID';
    throw error;
  }

  if (!isSessionPack(count, plan)) {
    const error = new Error(
      Array.isArray(plan.allowedSessionPacks) && !plan.allowedSessionPacks.includes(4)
        ? 'الحلقات الجماعية والثنائية متاحة باشتراك شهري 8 أو 12 أو 24 حصة فقط'
        : 'عدد الحصص غير متاح'
    );
    error.code = 'SUBSCRIPTION_PACK_INVALID';
    throw error;
  }

  const tier = getTierForCountry(countryCode);
  const regionalMinor = resolvePriceMinorForPack(tier, plan, count);

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
    plans: Object.values(PLANS).map((plan) => {
      const basePriceMinor = tier.pricesMinor[plan.key] ?? plan.pricePerSessionMinor;
      const packMap = tier.packPricesMinor?.[plan.key] || null;
      return {
        ...plan,
        pricePerSessionMinor: basePriceMinor,
        packPricesMinor: packMap ? { ...packMap } : null,
      };
    }),
  };
}

module.exports = {
  SESSION_PACKS,
  SECTIONS,
  PLANS,
  LEGACY_PLANS,
  isActivePlan,
  getPlan,
  isSessionPack,
  isSection,
  isCompatibleStudentSection,
  quoteSubscription,
  publicPlanCatalog,
};
