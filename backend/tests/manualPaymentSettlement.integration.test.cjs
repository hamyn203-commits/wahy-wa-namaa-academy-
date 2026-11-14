'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const StudentSubscription = require('../models/StudentSubscription');

const oid = () => new mongoose.Types.ObjectId();

function querySession(value) {
  return {
    session() {
      return Promise.resolve(value);
    },
  };
}

test('manual payment approval creates exactly one enrollment and repeated review fails closed', async () => {
  const studentId = oid();
  const courseId = oid();
  const paymentId = oid();
  const adminId = oid();
  const enrollmentId = oid();

  const payment = {
    _id: paymentId,
    provider: 'manual',
    kind: 'course_enrollment',
    student: studentId,
    course: courseId,
    amountMinor: 12500,
    currency: 'EGP',
    status: 'pending',
    manual: {},
    async save() {
      return this;
    },
  };

  let enrollment = null;
  let enrollmentCreateCount = 0;
  let progressUpsertCount = 0;
  let courseIncrementCount = 0;

  const originalStartSession = mongoose.startSession;
  const originalPaymentFindOne = Payment.findOne;
  const originalEnrollmentFindOne = Enrollment.findOne;
  const originalEnrollmentCreate = Enrollment.create;
  const originalProgressUpdateOne = Progress.updateOne;
  const originalCourseUpdateOne = Course.updateOne;

  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      return fn();
    },
    async endSession() {},
  });

  Payment.findOne = () => querySession(payment);
  Enrollment.findOne = () => querySession(enrollment);
  Enrollment.create = async (docs) => {
    enrollmentCreateCount += 1;
    enrollment = {
      _id: enrollmentId,
      ...docs[0],
    };
    return [enrollment];
  };
  Progress.updateOne = async () => {
    progressUpsertCount += 1;
    return { acknowledged: true };
  };
  Course.updateOne = async () => {
    courseIncrementCount += 1;
    return { acknowledged: true };
  };

  delete require.cache[require.resolve('../services/paymentSettlement')];
  delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  const { processManualPaymentReview } = require('../services/manualPaymentSettlement');

  try {
    const approved = await processManualPaymentReview({
      paymentId,
      adminId,
      action: 'approve',
      note: 'Funds verified in bank account',
    });

    assert.equal(approved.paymentStatus, 'succeeded');
    assert.equal(approved.enrollmentCreated, true);
    assert.equal(approved.enrollmentId, String(enrollmentId));
    assert.equal(payment.status, 'succeeded');
    assert.equal(payment.manual.reviewAction, 'approve');
    assert.equal(String(payment.manual.reviewedBy), String(adminId));
    assert.equal(enrollmentCreateCount, 1);
    assert.equal(progressUpsertCount, 1);
    assert.equal(courseIncrementCount, 1);

    await assert.rejects(
      () => processManualPaymentReview({
        paymentId,
        adminId,
        action: 'approve',
        note: 'Second approval must fail',
      }),
      (error) => {
        assert.equal(error.code, 'PAYMENT_ALREADY_REVIEWED');
        return true;
      }
    );

    assert.equal(enrollmentCreateCount, 1);
    assert.equal(progressUpsertCount, 1);
    assert.equal(courseIncrementCount, 1);
  } finally {
    mongoose.startSession = originalStartSession;
    Payment.findOne = originalPaymentFindOne;
    Enrollment.findOne = originalEnrollmentFindOne;
    Enrollment.create = originalEnrollmentCreate;
    Progress.updateOne = originalProgressUpdateOne;
    Course.updateOne = originalCourseUpdateOne;
    delete require.cache[require.resolve('../services/paymentSettlement')];
    delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  }
});

test('manual payment rejection grants no enrollment', async () => {
  const studentId = oid();
  const courseId = oid();
  const paymentId = oid();
  const adminId = oid();

  const payment = {
    _id: paymentId,
    provider: 'manual',
    kind: 'course_enrollment',
    student: studentId,
    course: courseId,
    amountMinor: 9900,
    currency: 'EGP',
    status: 'pending',
    manual: {},
    async save() {
      return this;
    },
  };

  let enrollmentCreateCount = 0;

  const originalStartSession = mongoose.startSession;
  const originalPaymentFindOne = Payment.findOne;
  const originalEnrollmentCreate = Enrollment.create;

  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      return fn();
    },
    async endSession() {},
  });

  Payment.findOne = () => querySession(payment);
  Enrollment.create = async () => {
    enrollmentCreateCount += 1;
    return [];
  };

  delete require.cache[require.resolve('../services/paymentSettlement')];
  delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  const { processManualPaymentReview } = require('../services/manualPaymentSettlement');

  try {
    const rejected = await processManualPaymentReview({
      paymentId,
      adminId,
      action: 'reject',
      note: 'Funds not received',
    });

    assert.equal(rejected.paymentStatus, 'failed');
    assert.equal(rejected.enrollmentCreated, false);
    assert.equal(rejected.enrollmentId, null);
    assert.equal(payment.status, 'failed');
    assert.equal(payment.failureCode, 'MANUAL_PAYMENT_REJECTED');
    assert.equal(payment.manual.reviewAction, 'reject');
    assert.equal(enrollmentCreateCount, 0);
  } finally {
    mongoose.startSession = originalStartSession;
    Payment.findOne = originalPaymentFindOne;
    Enrollment.create = originalEnrollmentCreate;
    delete require.cache[require.resolve('../services/paymentSettlement')];
    delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  }
});


test('subscription payment approval moves subscription to awaiting placement without course enrollment', async () => {
  const studentId = oid();
  const subscriptionId = oid();
  const paymentId = oid();
  const adminId = oid();

  const payment = {
    _id: paymentId,
    provider: 'manual',
    kind: 'subscription',
    student: studentId,
    subscription: subscriptionId,
    amountMinor: 48000,
    currency: 'EGP',
    status: 'pending',
    manual: {},
    async save() {
      return this;
    },
  };

  const subscription = {
    _id: subscriptionId,
    student: studentId,
    status: 'payment_review',
    payment: paymentId,
    paidAt: null,
    async save() {
      return this;
    },
  };

  const originalStartSession = mongoose.startSession;
  const originalPaymentFindOne = Payment.findOne;
  const originalSubscriptionFindOne = StudentSubscription.findOne;

  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      return fn();
    },
    async endSession() {},
  });

  Payment.findOne = () => querySession(payment);
  StudentSubscription.findOne = () => querySession(subscription);

  delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  const { processManualPaymentReview } = require('../services/manualPaymentSettlement');

  try {
    const approved = await processManualPaymentReview({
      paymentId,
      adminId,
      action: 'approve',
      note: 'Subscription funds verified',
    });

    assert.equal(approved.paymentStatus, 'succeeded');
    assert.equal(approved.awaitingPlacement, true);
    assert.equal(approved.subscriptionId, String(subscriptionId));
    assert.equal(approved.enrollmentCreated, false);
    assert.equal(subscription.status, 'awaiting_placement');
    assert.equal(String(subscription.payment), String(paymentId));
    assert.ok(subscription.paidAt instanceof Date);
  } finally {
    mongoose.startSession = originalStartSession;
    Payment.findOne = originalPaymentFindOne;
    StudentSubscription.findOne = originalSubscriptionFindOne;
    delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  }
});

test('subscription payment rejection returns subscription to pending payment', async () => {
  const studentId = oid();
  const subscriptionId = oid();
  const paymentId = oid();
  const adminId = oid();

  const payment = {
    _id: paymentId,
    provider: 'manual',
    kind: 'subscription',
    student: studentId,
    subscription: subscriptionId,
    amountMinor: 8000,
    currency: 'EGP',
    status: 'pending',
    manual: {},
    async save() {
      return this;
    },
  };

  let subscriptionUpdate = null;
  const originalStartSession = mongoose.startSession;
  const originalPaymentFindOne = Payment.findOne;
  const originalSubscriptionUpdateOne = StudentSubscription.updateOne;

  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      return fn();
    },
    async endSession() {},
  });

  Payment.findOne = () => querySession(payment);
  StudentSubscription.updateOne = async (...args) => {
    subscriptionUpdate = args;
    return { acknowledged: true, modifiedCount: 1 };
  };

  delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  const { processManualPaymentReview } = require('../services/manualPaymentSettlement');

  try {
    const rejected = await processManualPaymentReview({
      paymentId,
      adminId,
      action: 'reject',
      note: 'Transfer not received',
    });

    assert.equal(rejected.paymentStatus, 'failed');
    assert.equal(rejected.awaitingPlacement, false);
    assert.equal(rejected.subscriptionId, String(subscriptionId));
    assert.ok(subscriptionUpdate);
    assert.deepEqual(subscriptionUpdate[1].$set, { status: 'pending_payment' });
    assert.deepEqual(subscriptionUpdate[1].$unset, { payment: 1, paidAt: 1, preferredTeacher: 1 });
  } finally {
    mongoose.startSession = originalStartSession;
    Payment.findOne = originalPaymentFindOne;
    StudentSubscription.updateOne = originalSubscriptionUpdateOne;
    delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  }
});


test('approved early renewal is queued until the current package is exhausted', async () => {
  const studentId = oid();
  const sourceId = oid();
  const renewalId = oid();
  const circleId = oid();
  const teacherId = oid();
  const paymentId = oid();
  const adminId = oid();

  const payment = {
    _id: paymentId,
    provider: 'manual',
    kind: 'subscription',
    student: studentId,
    subscription: renewalId,
    amountMinor: 16000,
    currency: 'EGP',
    status: 'pending',
    manual: {},
    async save() { return this; },
  };

  const renewal = {
    _id: renewalId,
    student: studentId,
    renewalOf: sourceId,
    circle: circleId,
    preferredTeacher: teacherId,
    status: 'payment_review',
    payment: paymentId,
    paidAt: null,
    renewalQueuedAt: null,
    async save() { return this; },
  };

  const source = {
    _id: sourceId,
    student: studentId,
    circle: circleId,
    preferredTeacher: teacherId,
    status: 'active',
    sessionsRemaining: 1,
  };

  const originalStartSession = mongoose.startSession;
  const originalPaymentFindOne = Payment.findOne;
  const originalSubscriptionFindOne = StudentSubscription.findOne;

  mongoose.startSession = async () => ({
    async withTransaction(fn) { return fn(); },
    async endSession() {},
  });

  Payment.findOne = () => querySession(payment);
  StudentSubscription.findOne = (query) => {
    const id = String(query?._id || '');
    return querySession(id === String(renewalId) ? renewal : source);
  };

  delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  const { processManualPaymentReview } = require('../services/manualPaymentSettlement');

  try {
    const approved = await processManualPaymentReview({
      paymentId,
      adminId,
      action: 'approve',
      note: 'Renewal funds verified',
    });

    assert.equal(approved.paymentStatus, 'succeeded');
    assert.equal(approved.renewalQueued, true);
    assert.equal(approved.awaitingPlacement, false);
    assert.equal(approved.subscriptionStatus, 'renewal_queued');
    assert.equal(renewal.status, 'renewal_queued');
    assert.equal(String(renewal.circle), String(circleId));
    assert.ok(renewal.renewalQueuedAt instanceof Date);
  } finally {
    mongoose.startSession = originalStartSession;
    Payment.findOne = originalPaymentFindOne;
    StudentSubscription.findOne = originalSubscriptionFindOne;
    delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  }
});


test('paid renewal queues while the current package still has remaining sessions', async () => {
  const studentId = oid();
  const sourceSubscriptionId = oid();
  const renewalSubscriptionId = oid();
  const circleId = oid();
  const teacherId = oid();
  const paymentId = oid();
  const adminId = oid();

  const payment = {
    _id: paymentId,
    provider: 'manual',
    kind: 'subscription',
    student: studentId,
    subscription: renewalSubscriptionId,
    amountMinor: 16000,
    currency: 'EGP',
    status: 'pending',
    manual: {},
    async save() {
      return this;
    },
  };

  const renewal = {
    _id: renewalSubscriptionId,
    student: studentId,
    renewalOf: sourceSubscriptionId,
    circle: circleId,
    preferredTeacher: teacherId,
    status: 'payment_review',
    payment: paymentId,
    paidAt: null,
    renewalQueuedAt: null,
    async save() {
      return this;
    },
  };

  const source = {
    _id: sourceSubscriptionId,
    student: studentId,
    circle: circleId,
    preferredTeacher: teacherId,
    status: 'active',
    sessionsRemaining: 2,
  };

  const originalStartSession = mongoose.startSession;
  const originalPaymentFindOne = Payment.findOne;
  const originalSubscriptionFindOne = StudentSubscription.findOne;

  mongoose.startSession = async () => ({
    async withTransaction(fn) {
      return fn();
    },
    async endSession() {},
  });

  Payment.findOne = () => querySession(payment);
  StudentSubscription.findOne = (query) => {
    if (String(query?._id) === String(renewalSubscriptionId)) return querySession(renewal);
    if (String(query?._id) === String(sourceSubscriptionId)) return querySession(source);
    return querySession(null);
  };

  delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  const { processManualPaymentReview } = require('../services/manualPaymentSettlement');

  try {
    const approved = await processManualPaymentReview({
      paymentId,
      adminId,
      action: 'approve',
      note: 'Renewal funds verified',
    });

    assert.equal(approved.paymentStatus, 'succeeded');
    assert.equal(approved.renewalQueued, true);
    assert.equal(approved.awaitingPlacement, false);
    assert.equal(approved.subscriptionStatus, 'renewal_queued');
    assert.equal(renewal.status, 'renewal_queued');
    assert.ok(renewal.paidAt instanceof Date);
    assert.ok(renewal.renewalQueuedAt instanceof Date);
    assert.equal(String(renewal.circle), String(circleId));
  } finally {
    mongoose.startSession = originalStartSession;
    Payment.findOne = originalPaymentFindOne;
    StudentSubscription.findOne = originalSubscriptionFindOne;
    delete require.cache[require.resolve('../services/manualPaymentSettlement')];
  }
});
