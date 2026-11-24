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

test('subscription catalog exposes the four profitable active plans and hides legacy community/group plans', () => {
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

  assert.equal(getPlan('focused').pricePerSessionMinor, 2000);
  assert.equal(getPlan('focused').minStudents, 3);
  assert.equal(getPlan('focused').maxStudents, 5);
  assert.equal(getPlan('focused').durationMinMinutes, 45);
  assert.equal(getPlan('focused').durationMaxMinutes, 45);
  assert.deepEqual(getPlan('focused').allowedSessionPacks, [8, 12, 24]);

  assert.equal(getPlan('mini').pricePerSessionMinor, 4500);
  assert.equal(getPlan('mini').minStudents, 2);
  assert.equal(getPlan('mini').maxStudents, 3);
  assert.equal(getPlan('mini').durationMinMinutes, 45);
  assert.equal(getPlan('mini').durationMaxMinutes, 45);
  assert.deepEqual(getPlan('mini').allowedSessionPacks, [8, 12, 24]);

  assert.equal(getPlan('private').pricePerSessionMinor, 8000);
  assert.equal(getPlan('private').maxStudents, 1);
  assert.equal(getPlan('private').durationMinMinutes, 30);
  assert.equal(getPlan('private').durationMaxMinutes, 30);
  assert.deepEqual(getPlan('private').allowedSessionPacks, [4, 8, 12, 24]);

  assert.equal(getPlan('private_intensive').pricePerSessionMinor, 15000);
  assert.equal(getPlan('private_intensive').maxStudents, 1);
  assert.equal(getPlan('private_intensive').durationMinMinutes, 60);
  assert.equal(getPlan('private_intensive').durationMaxMinutes, 60);
  assert.deepEqual(getPlan('private_intensive').allowedSessionPacks, [4, 8, 12, 24]);

  // Legacy plans remain resolvable via getPlan() for existing renewals and circles
  assert.equal(getPlan('community').minStudents, 15);
  assert.equal(getPlan('group').minStudents, 5);

  assert.deepEqual(SESSION_PACKS, [4, 8, 12, 24]);
  assert.deepEqual(SECTIONS, ['men_children', 'ladies']);
});

test('subscription quote enforces 8/12/24 minimum packs on group/dual circles and tiered 25/20 EGP pricing on focused', () => {
  // Focused: 8 sessions -> 25 EGP (2500 minor, total 20000); 12 & 24 -> 20 EGP (2000 minor)
  const focused8 = quoteSubscription({ planKey: 'focused', sessionCount: 8, countryCode: 'EG' });
  assert.equal(focused8.pricePerSessionMinor, 2500);
  assert.equal(focused8.totalAmountMinor, 20000);

  const focused12 = quoteSubscription({ planKey: 'focused', sessionCount: 12, countryCode: 'EG' });
  assert.equal(focused12.pricePerSessionMinor, 2000);
  assert.equal(focused12.totalAmountMinor, 24000);

  const focused24 = quoteSubscription({ planKey: 'focused', sessionCount: 24, countryCode: 'EG' });
  assert.equal(focused24.pricePerSessionMinor, 2000);
  assert.equal(focused24.totalAmountMinor, 48000);

  assert.throws(
    () => quoteSubscription({ planKey: 'focused', sessionCount: 4 }),
    (error) => error.code === 'SUBSCRIPTION_PACK_INVALID'
  );

  assert.throws(
    () => quoteSubscription({ planKey: 'mini', sessionCount: 4 }),
    (error) => error.code === 'SUBSCRIPTION_PACK_INVALID'
  );

  const mini12 = quoteSubscription({ planKey: 'mini', sessionCount: 12 });
  assert.equal(mini12.pricePerSessionMinor, 4500);
  assert.equal(mini12.totalAmountMinor, 54000);

  for (const count of [4, 8, 12, 24]) {
    const priv = quoteSubscription({ planKey: 'private', sessionCount: count });
    assert.equal(priv.pricePerSessionMinor, 8000);
    assert.equal(priv.totalAmountMinor, 8000 * count);

    const privInt = quoteSubscription({ planKey: 'private_intensive', sessionCount: count });
    assert.equal(privInt.pricePerSessionMinor, 15000);
    assert.equal(privInt.totalAmountMinor, 15000 * count);
  }
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
