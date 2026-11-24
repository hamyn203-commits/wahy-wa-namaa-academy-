'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const StudentSubscription = require('../models/StudentSubscription');
const { quoteSubscription } = require('../config/subscriptionPlans');

test('focused & private_intensive checkout snapshots validate 3-5 / 1-on-1 capacities and integer minor pricing', async () => {
  const expectedTotals = { 8: 20000, 12: 24000, 24: 45600 };
  for (const sessionCount of [8, 12, 24]) {
    const quote = quoteSubscription({ planKey: 'focused', sessionCount });
    const subscription = new StudentSubscription({
      student: new mongoose.Types.ObjectId(),
      planKey: 'focused',
      section: 'men_children',
      sessionCount,
      sessionsUsed: 0,
      sessionsRemaining: sessionCount,
      pricePerSessionMinor: quote.pricePerSessionMinor,
      totalAmountMinor: quote.totalAmountMinor,
      pricingSnapshot: {
        minStudents: quote.plan.minStudents,
        maxStudents: quote.plan.maxStudents,
        durationMinMinutes: quote.plan.durationMinMinutes,
        durationMaxMinutes: quote.plan.durationMaxMinutes,
      },
    });
    await subscription.validate();
    assert.equal(subscription.pricingSnapshot.minStudents, 3);
    assert.equal(subscription.pricingSnapshot.maxStudents, 5);
    assert.equal(subscription.pricingSnapshot.durationMaxMinutes, 45);
    assert.equal(subscription.totalAmountMinor, expectedTotals[sessionCount]);
  }

  const intensiveQuote = quoteSubscription({ planKey: 'private_intensive', sessionCount: 12 });
  const intensiveSub = new StudentSubscription({
    student: new mongoose.Types.ObjectId(),
    planKey: 'private_intensive',
    section: 'ladies',
    sessionCount: 12,
    sessionsUsed: 0,
    sessionsRemaining: 12,
    pricePerSessionMinor: intensiveQuote.pricePerSessionMinor,
    totalAmountMinor: intensiveQuote.totalAmountMinor,
    pricingSnapshot: {
      minStudents: intensiveQuote.plan.minStudents,
      maxStudents: intensiveQuote.plan.maxStudents,
      durationMinMinutes: intensiveQuote.plan.durationMinMinutes,
      durationMaxMinutes: intensiveQuote.plan.durationMaxMinutes,
    },
  });
  await intensiveSub.validate();
  assert.equal(intensiveSub.totalAmountMinor, 150000);
});
