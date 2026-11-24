'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  SESSION_PACKS,
  SECTIONS,
  isActivePlan,
  getPlan,
  quoteSubscription,
  isCompatibleStudentSection,
  publicPlanCatalog,
} = require('../config/subscriptionPlans');

test('subscription catalog exposes the four profitable active plans with volume-discount anchors and hides legacy plans', () => {
  const catalog = publicPlanCatalog();

  assert.deepEqual(catalog.sessionPacks, [4, 8, 12, 24]);
  assert.deepEqual(catalog.sections, ['men_children', 'ladies']);
  assert.equal(catalog.currency, 'EGP');
  assert.equal(catalog.plans.length, 4);
  assert.deepEqual(catalog.plans.map((p) => p.key), ['focused', 'mini', 'private', 'private_intensive']);

  assert.equal(isActivePlan('focused'), true);
  assert.equal(isActivePlan('mini'), true);
  assert.equal(isActivePlan('private'), true);
  assert.equal(isActivePlan('private_intensive'), true);
  assert.equal(isActivePlan('community'), false);
  assert.equal(isActivePlan('group'), false);

  assert.equal(getPlan('focused').pricePerSessionMinor, 1900);
  assert.equal(getPlan('focused').basePricePerSessionMinor, 2500);
  assert.equal(getPlan('focused').minStudents, 3);
  assert.equal(getPlan('focused').maxStudents, 5);
  assert.equal(getPlan('focused').durationMinMinutes, 45);
  assert.equal(getPlan('focused').durationMaxMinutes, 45);
  assert.deepEqual(getPlan('focused').allowedSessionPacks, [8, 12, 24]);

  assert.equal(getPlan('mini').pricePerSessionMinor, 3500);
  assert.equal(getPlan('mini').basePricePerSessionMinor, 4500);
  assert.equal(getPlan('mini').minStudents, 2);
  assert.equal(getPlan('mini').maxStudents, 3);
  assert.equal(getPlan('mini').durationMinMinutes, 45);
  assert.equal(getPlan('mini').durationMaxMinutes, 45);
  assert.deepEqual(getPlan('mini').allowedSessionPacks, [8, 12, 24]);

  assert.equal(getPlan('private').pricePerSessionMinor, 6000);
  assert.equal(getPlan('private').basePricePerSessionMinor, 8500);
  assert.equal(getPlan('private').maxStudents, 1);
  assert.equal(getPlan('private').durationMinMinutes, 30);
  assert.equal(getPlan('private').durationMaxMinutes, 30);
  assert.deepEqual(getPlan('private').allowedSessionPacks, [4, 8, 12, 24]);

  assert.equal(getPlan('private_intensive').pricePerSessionMinor, 11000);
  assert.equal(getPlan('private_intensive').basePricePerSessionMinor, 15000);
  assert.equal(getPlan('private_intensive').maxStudents, 1);
  assert.equal(getPlan('private_intensive').durationMinMinutes, 60);
  assert.equal(getPlan('private_intensive').durationMaxMinutes, 60);
  assert.deepEqual(getPlan('private_intensive').allowedSessionPacks, [4, 8, 12, 24]);

  assert.equal(catalog.plans[0].maxSavingsPercent, 24);
  assert.equal(catalog.plans[2].maxSavingsPercent, 29);

  // Legacy plans remain resolvable via getPlan() for existing renewals and circles
  assert.equal(getPlan('community').minStudents, 15);
  assert.equal(getPlan('group').minStudents, 5);

  assert.deepEqual(SESSION_PACKS, [4, 8, 12, 24]);
  assert.deepEqual(SECTIONS, ['men_children', 'ladies']);
});

test('subscription quote enforces progressive pack discounts across all four plans and blocks 4-session group packs', () => {
  const expectedEgPacks = {
    focused: { 8: 2500, 12: 2000, 24: 1900 },
    mini: { 8: 4500, 12: 3900, 24: 3500 },
    private: { 4: 8500, 8: 7500, 12: 6900, 24: 6000 },
    private_intensive: { 4: 15000, 8: 13500, 12: 12500, 24: 11000 },
  };

  for (const [planKey, packMap] of Object.entries(expectedEgPacks)) {
    for (const [countStr, expectedMinor] of Object.entries(packMap)) {
      const count = Number(countStr);
      const quote = quoteSubscription({ planKey, sessionCount: count, countryCode: 'EG' });
      assert.equal(quote.pricePerSessionMinor, expectedMinor);
      assert.equal(quote.totalAmountMinor, expectedMinor * count);
    }
  }

  assert.throws(
    () => quoteSubscription({ planKey: 'focused', sessionCount: 4 }),
    (error) => error.code === 'SUBSCRIPTION_PACK_INVALID'
  );

  assert.throws(
    () => quoteSubscription({ planKey: 'mini', sessionCount: 4 }),
    (error) => error.code === 'SUBSCRIPTION_PACK_INVALID'
  );
});

test('subscription quote rejects unknown plans and arbitrary package sizes', () => {
  assert.throws(
    () => quoteSubscription({ planKey: 'fake', sessionCount: 8 }),
    (error) => error.code === 'SUBSCRIPTION_PLAN_INVALID'
  );

  assert.throws(
    () => quoteSubscription({ planKey: 'private', sessionCount: 7 }),
    (error) => error.code === 'SUBSCRIPTION_PACK_INVALID'
  );
});

test('a saved learner division is enforced while legacy students retain their existing choices', () => {
  assert.equal(isCompatibleStudentSection('ladies', 'ladies'), true);
  assert.equal(isCompatibleStudentSection('ladies', 'men_children'), false);
  assert.equal(isCompatibleStudentSection('men_children', 'ladies'), false);
  assert.equal(isCompatibleStudentSection('men_children', 'men_children'), true);
  assert.equal(isCompatibleStudentSection(undefined, 'ladies'), true);
  assert.equal(isCompatibleStudentSection(null, 'men_children'), true);
});
