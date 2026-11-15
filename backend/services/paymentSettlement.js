'use strict';

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const PaymentWebhookEvent = require('../models/PaymentWebhookEvent');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const Certificate = require('../models/Certificate');
const { assertPaymentTransition } = require('../utils/paymentIntegrity');

function majorAmount(amountMinor) {
  return Number(amountMinor) / 100;
}

async function createEnrollmentForSettledPayment(payment, session) {
  const existing = await Enrollment.findOne({
    student: payment.student,
    course: payment.course,
  }).session(session);

  if (existing) {
    if (existing.status === 'cancelled') {
      existing.status = 'active';
      existing.payment = {
        amount: majorAmount(payment.amountMinor),
        currency: payment.currency,
        status: 'completed',
        transactionId: payment.providerTransactionId,
        paidAt: payment.settledAt || new Date(),
      };
      await existing.save({ session });
      await Course.updateOne(
        { _id: payment.course },
        { $inc: { 'stats.enrolled': 1 } },
        { session }
      );
      return { enrollment: existing, created: true };
    }
    return { enrollment: existing, created: false };
  }

  const docs = await Enrollment.create([{
    student: payment.student,
    course: payment.course,
    status: 'active',
    payment: {
      amount: majorAmount(payment.amountMinor),
      currency: payment.currency,
      status: 'completed',
      transactionId: payment.providerTransactionId,
      paidAt: payment.settledAt || new Date(),
    },
  }], { session });

  const enrollment = docs[0];

  await Progress.updateOne(
    { student: payment.student, course: payment.course },
    {
      $setOnInsert: {
        student: payment.student,
        course: payment.course,
        enrollment: enrollment._id,
      },
    },
    { upsert: true, session }
  );

  await Course.updateOne(
    { _id: payment.course },
    { $inc: { 'stats.enrolled': 1 } },
    { session }
  );

  return { enrollment, created: true };
}

async function applyPaymobTransaction({
  payment,
  classification,
  transactionId,
  amountMinor,
  session,
}) {
  const effectiveClassification = (
    classification === 'cancelled'
    && (payment.status === 'succeeded' || payment.status === 'partially_refunded')
  )
    ? 'refunded'
    : classification;

  if (effectiveClassification === 'pending' || effectiveClassification === 'ignored') {
    return { payment, enrollment: null, enrollmentCreated: false, changed: false };
  }

  if (effectiveClassification === 'succeeded') {
    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded' && payment.status !== 'refunded') {
      if (payment.status === 'created') {
        assertPaymentTransition('created', 'pending');
        payment.status = 'pending';
      }
      assertPaymentTransition(payment.status, 'succeeded');
      payment.status = 'succeeded';
      payment.settledAt = new Date();
      payment.failedAt = undefined;
      payment.providerTransactionId = String(transactionId);
      payment.failureCode = undefined;
      await payment.save({ session });
    }

    const fulfillment = await createEnrollmentForSettledPayment(payment, session);
    return {
      payment,
      enrollment: fulfillment.enrollment,
      enrollmentCreated: fulfillment.created,
      changed: true,
    };
  }

  if (effectiveClassification === 'failed') {
    if (
      payment.status === 'failed'
      || payment.status === 'succeeded'
      || payment.status === 'partially_refunded'
      || payment.status === 'refunded'
    ) {
      return { payment, enrollment: null, enrollmentCreated: false, changed: false };
    }
    assertPaymentTransition(payment.status, 'failed');
    payment.status = 'failed';
    payment.failedAt = new Date();
    payment.providerTransactionId = String(transactionId);
    payment.failureCode = 'PROVIDER_REPORTED_FAILURE';
    await payment.save({ session });
    return { payment, enrollment: null, enrollmentCreated: false, changed: true };
  }

  if (effectiveClassification === 'cancelled') {
    if (payment.status === 'cancelled') {
      return { payment, enrollment: null, enrollmentCreated: false, changed: false };
    }
    if (payment.status === 'created') {
      assertPaymentTransition('created', 'pending');
      payment.status = 'pending';
    }
    assertPaymentTransition(payment.status, 'cancelled');
    payment.status = 'cancelled';
    payment.cancelledAt = new Date();
    payment.providerTransactionId = String(transactionId);
    await payment.save({ session });
    return { payment, enrollment: null, enrollmentCreated: false, changed: true };
  }

  if (effectiveClassification === 'refunded') {
    if (payment.status === 'refunded') {
      return { payment, enrollment: null, enrollmentCreated: false, changed: false };
    }

    const totalPaidMinor = Math.max(0, Number(payment.amountMinor || 0));
    const currentRefundedMinor = Math.max(0, Number(payment.refundedAmountMinor || 0));
    const deltaMinor = Number.isFinite(Number(amountMinor)) && Number(amountMinor) > 0
      ? Math.round(Number(amountMinor))
      : Math.max(0, totalPaidMinor - currentRefundedMinor);
    const nextRefundedMinor = Math.min(totalPaidMinor, currentRefundedMinor + deltaMinor);

    if (totalPaidMinor > 0 && nextRefundedMinor < totalPaidMinor) {
      assertPaymentTransition(payment.status, 'partially_refunded');
      payment.status = 'partially_refunded';
      payment.refundedAmountMinor = nextRefundedMinor;
      payment.refundedAt = new Date();
      payment.providerTransactionId = String(transactionId);
      await payment.save({ session });
      return { payment, enrollment: null, enrollmentCreated: false, changed: true };
    }

    assertPaymentTransition(payment.status, 'refunded');
    payment.status = 'refunded';
    payment.refundedAmountMinor = totalPaidMinor;
    payment.refundedAt = new Date();
    payment.providerTransactionId = String(transactionId);
    await payment.save({ session });

    const enrollment = await Enrollment.findOne({
      student: payment.student,
      course: payment.course,
    }).session(session);

    if (enrollment) {
      const wasActive = enrollment.status !== 'cancelled';
      enrollment.status = 'cancelled';
      enrollment.payment.status = 'refunded';
      await enrollment.save({ session });

      if (wasActive && payment.course) {
        await Course.updateOne(
          { _id: payment.course, 'stats.enrolled': { $gt: 0 } },
          { $inc: { 'stats.enrolled': -1 } },
          { session }
        );
      }
    }

    if (
      payment.student
      && payment.course
      && (mongoose.connection.readyState === 1 || Certificate.updateMany !== mongoose.Model.updateMany)
    ) {
      await Certificate.updateMany(
        { student: payment.student, course: payment.course, status: 'active' },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            revocationReason: 'Payment refunded',
          },
        },
        { session }
      );
    }

    return { payment, enrollment, enrollmentCreated: false, changed: true };
  }

  return { payment, enrollment: null, enrollmentCreated: false, changed: false };
}

async function processPaymobWebhook({
  eventId,
  eventType,
  payloadHash,
  merchantReference,
  providerOrderId,
  amountMinor,
  currency,
  classification,
  transactionId,
}) {
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const event = new PaymentWebhookEvent({
        provider: 'paymob',
        eventId: String(eventId),
        eventType: String(eventType || 'TRANSACTION'),
        payloadHash,
        status: 'received',
      });
      await event.save({ session });

      if (!mongoose.Types.ObjectId.isValid(String(merchantReference || ''))) {
        event.status = 'ignored';
        event.failureCode = 'UNKNOWN_MERCHANT_REFERENCE';
        event.processedAt = new Date();
        await event.save({ session });
        result = { accepted: true, processed: false, reason: event.failureCode };
        return;
      }

      const payment = await Payment.findOne({
        _id: merchantReference,
        provider: 'paymob',
      }).session(session);

      if (!payment) {
        event.status = 'ignored';
        event.failureCode = 'PAYMENT_NOT_FOUND';
        event.processedAt = new Date();
        await event.save({ session });
        result = { accepted: true, processed: false, reason: event.failureCode };
        return;
      }

      event.payment = payment._id;

      const isRefundEvent = classification === 'refunded'
        || (classification === 'cancelled' && (payment.status === 'succeeded' || payment.status === 'partially_refunded'));
      const remainingRefundable = Math.max(0, Number(payment.amountMinor || 0) - Number(payment.refundedAmountMinor || 0));
      const amountMatches = isRefundEvent
        ? (
          Number.isFinite(Number(amountMinor))
          && Number(amountMinor) > 0
          && Number(amountMinor) <= Number(payment.amountMinor)
          && (remainingRefundable === 0 || Number(amountMinor) <= remainingRefundable)
        )
        : Number(amountMinor) === Number(payment.amountMinor);

      if (
        !amountMatches
        || String(currency || '').toUpperCase() !== String(payment.currency || '').toUpperCase()
        || (
          payment.providerOrderId
          && String(providerOrderId || '') !== String(payment.providerOrderId)
        )
      ) {
        event.status = 'failed';
        event.failureCode = 'PAYMENT_DETAILS_MISMATCH';
        event.processedAt = new Date();
        await event.save({ session });
        result = { accepted: true, processed: false, reason: event.failureCode };
        return;
      }

      let applied;
      try {
        applied = await applyPaymobTransaction({
          payment,
          classification,
          transactionId,
          amountMinor,
          session,
        });
      } catch (txErr) {
        if (txErr?.code === 'INVALID_PAYMENT_TRANSITION') {
          event.status = 'ignored';
          event.failureCode = 'INVALID_PAYMENT_TRANSITION';
          event.processedAt = new Date();
          await event.save({ session });
          result = { accepted: true, processed: false, reason: event.failureCode };
          return;
        }
        throw txErr;
      }

      event.status = classification === 'pending' || classification === 'ignored'
        ? 'ignored'
        : 'processed';
      event.processedAt = new Date();
      await event.save({ session });

      result = {
        accepted: true,
        processed: event.status === 'processed',
        paymentId: String(payment._id),
        paymentStatus: payment.status,
        enrollmentCreated: applied.enrollmentCreated,
        studentId: payment.student ? String(payment.student) : null,
        courseId: payment.course ? String(payment.course) : null,
      };
    });

    return result || { accepted: true, processed: false };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        accepted: true,
        processed: false,
        duplicate: true,
      };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  majorAmount,
  createEnrollmentForSettledPayment,
  applyPaymobTransaction,
  processPaymobWebhook,
};
