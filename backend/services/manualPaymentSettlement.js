'use strict';

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Session = require('../models/Session');
const StudentSubscription = require('../models/StudentSubscription');
const GroupCircle = require('../models/GroupCircle');
const User = require('../models/User');
const { isRunningCircle, circleStatusForCount, operationalCapacity } = require('./subscriptionCircleLifecycle');
const { getPlan } = require('../config/subscriptionPlans');
const { assertPaymentTransition } = require('../utils/paymentIntegrity');
const { createEnrollmentForSettledPayment } = require('./paymentSettlement');

async function syncUpcomingCircleAttendance(circleId, studentId, fromDate, session) {
  if (mongoose.connection.readyState === 1 || Session.updateMany !== mongoose.Model.updateMany) {
    await Session.updateMany(
      {
        circle: circleId,
        status: { $in: ['pending', 'accepted'] },
        scheduledAt: { $gt: fromDate },
        'attendance.student': { $ne: studentId },
      },
      { $push: { attendance: { student: studentId, status: 'pending' } } },
      { session }
    );
  }
}

async function processManualPaymentReview({
  paymentId,
  adminId,
  action,
  note = '',
}) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['approve', 'reject'].includes(normalizedAction)) {
    const error = new Error('Invalid manual payment review action');
    error.code = 'INVALID_REVIEW_ACTION';
    throw error;
  }

  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        _id: paymentId,
        provider: 'manual',
        kind: { $in: ['course_enrollment', 'subscription'] },
      }).session(session);

      if (!payment) {
        const error = new Error('Payment not found');
        error.code = 'PAYMENT_NOT_FOUND';
        throw error;
      }

      if (payment.status !== 'pending') {
        const error = new Error('Payment has already been reviewed');
        error.code = 'PAYMENT_ALREADY_REVIEWED';
        throw error;
      }

      payment.manual.reviewedAt = new Date();
      payment.manual.reviewedBy = adminId;
      payment.manual.reviewAction = normalizedAction;
      payment.manual.reviewNote = String(note || '').trim().slice(0, 500);

      if (normalizedAction === 'approve') {
        let subscription = null;
        if (payment.kind === 'course_enrollment') {
          if (mongoose.connection.readyState === 1 || Course.findOne !== mongoose.Model.findOne) {
            const targetCourse = await Course.findOne({
              _id: payment.course,
              status: 'published',
            }).session(session);
            if (!targetCourse) {
              const error = new Error('Course is no longer published or available');
              error.code = 'COURSE_UNAVAILABLE';
              error.status = 409;
              throw error;
            }
          }
          const alreadyEnrolled = await Enrollment.findOne({
            student: payment.student,
            course: payment.course,
          }).session(session);
          if (alreadyEnrolled && alreadyEnrolled.status !== 'cancelled') {
            const error = new Error('Student is already enrolled in this course');
            error.code = 'ALREADY_ENROLLED';
            throw error;
          }
        } else if (payment.kind === 'subscription') {
          subscription = await StudentSubscription.findOne({
            _id: payment.subscription,
            student: payment.student,
          }).session(session);

          if (!subscription) {
            const error = new Error('Subscription not found for payment');
            error.code = 'SUBSCRIPTION_NOT_FOUND';
            throw error;
          }

          if (
            subscription.status
            && !['payment_review', 'pending_payment'].includes(String(subscription.status))
          ) {
            const error = new Error('Subscription is not awaiting payment review');
            error.code = 'SUBSCRIPTION_NOT_IN_REVIEW';
            error.status = 409;
            throw error;
          }

          if (
            subscription.totalAmountMinor !== undefined
            && Number(payment.amountMinor) !== Number(subscription.totalAmountMinor)
          ) {
            const error = new Error('Payment amount does not match subscription totalAmountMinor');
            error.code = 'PAYMENT_AMOUNT_MISMATCH';
            error.status = 409;
            throw error;
          }

          if (
            subscription.currency !== undefined
            && String(payment.currency || '').toUpperCase() !== String(subscription.currency || '').toUpperCase()
          ) {
            const error = new Error('Payment currency does not match subscription currency');
            error.code = 'PAYMENT_CURRENCY_MISMATCH';
            error.status = 409;
            throw error;
          }
        }

        assertPaymentTransition(payment.status, 'succeeded');
        payment.status = 'succeeded';
        payment.settledAt = new Date();
        payment.providerTransactionId = `manual-review:${payment._id}`;
        payment.failureCode = undefined;
        await payment.save({ session });

        if (payment.kind === 'subscription') {

          const paidAt = new Date();
          let renewalQueued = false;
          let renewalActivated = false;
          let renewalCircleId = subscription.circle ? String(subscription.circle) : null;

          if (subscription.renewalOf) {
            const source = await StudentSubscription.findOne({
              _id: subscription.renewalOf,
              student: payment.student,
            }).session(session);

            if (
              source
              && ['active', 'placed', 'paused'].includes(source.status)
              && Number(source.sessionsRemaining || 0) > 0
              && subscription.circle
            ) {
              subscription.status = 'renewal_queued';
              subscription.renewalQueuedAt = paidAt;
              renewalQueued = true;
            } else if (source?.status === 'completed' && subscription.circle) {
              const circle = await GroupCircle.findById(subscription.circle).session(session);
              const plan = getPlan(subscription.planKey);

              if (
                circle
                && plan
                && !['paused', 'completed'].includes(circle.status)
                && circle.subscriptionPlanKey === subscription.planKey
                && (!circle.subscriptionSection || circle.subscriptionSection === subscription.section)
                && String(circle.teacher) === String(subscription.preferredTeacher)
                && (circle.students || []).length < operationalCapacity(circle, plan)
              ) {
                const alreadyMember = (circle.students || []).some(
                  (studentId) => String(studentId) === String(payment.student)
                );
                if (!alreadyMember) circle.students.push(payment.student);

                circle.capacity = operationalCapacity(circle, plan);
                circle.status = circleStatusForCount(circle, plan);

                await circle.save({ session });
                await User.updateOne(
                  { _id: payment.student },
                  { $set: { circle: circle._id } },
                  { session }
                );

                subscription.placedAt = paidAt;
                subscription.status = isRunningCircle(circle) ? 'active' : 'placed';
                if (subscription.status === 'active') {
                  subscription.startedAt = paidAt;
                  renewalActivated = true;
                  await syncUpcomingCircleAttendance(circle._id, payment.student, paidAt, session);
                }
              } else {
                subscription.status = 'awaiting_placement';
              }
            } else {
              subscription.status = 'awaiting_placement';
            }
          } else {
            subscription.status = 'awaiting_placement';
          }

          subscription.payment = payment._id;
          subscription.paidAt = paidAt;
          await subscription.save({ session });

          result = {
            paymentId: String(payment._id),
            paymentStatus: payment.status,
            enrollmentId: null,
            enrollmentCreated: false,
            studentId: payment.student ? String(payment.student) : null,
            courseId: null,
            subscriptionId: String(subscription._id),
            subscriptionStatus: subscription.status,
            awaitingPlacement: subscription.status === 'awaiting_placement',
            renewalQueued,
            renewalActivated,
            renewalCircleId,
          };
          return;
        }

        const fulfillment = await createEnrollmentForSettledPayment(payment, session);
        result = {
          paymentId: String(payment._id),
          paymentStatus: payment.status,
          enrollmentId: fulfillment.enrollment ? String(fulfillment.enrollment._id) : null,
          enrollmentCreated: fulfillment.created,
          studentId: payment.student ? String(payment.student) : null,
          courseId: payment.course ? String(payment.course) : null,
          subscriptionId: null,
          awaitingPlacement: false,
        };
        return;
      }

      assertPaymentTransition(payment.status, 'failed');
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.failureCode = 'MANUAL_PAYMENT_REJECTED';
      await payment.save({ session });

      if (payment.kind === 'subscription' && payment.subscription) {
        let shouldResetSubscription = true;
        let nextSubStatus = 'pending_payment';
        let isRenewal = false;

        if (mongoose.connection.readyState === 1 || StudentSubscription.findOne !== mongoose.Model.findOne) {
          const targetSub = await StudentSubscription.findOne({
            _id: payment.subscription,
            student: payment.student,
          }).session(session);
          if (
            !targetSub
            || targetSub.status !== 'payment_review'
            || (targetSub.payment && String(targetSub.payment) !== String(payment._id))
          ) {
            shouldResetSubscription = false;
          } else {
            isRenewal = Boolean(targetSub?.renewalOf);

            const otherPendingSub = await StudentSubscription.findOne({
              student: payment.student,
              status: 'pending_payment',
              _id: { $ne: payment.subscription },
            }).session(session);

            if (otherPendingSub) {
              nextSubStatus = 'cancelled';
            }
          }
        }

        if (shouldResetSubscription) {
          await StudentSubscription.updateOne(
            {
              _id: payment.subscription,
              student: payment.student,
              status: 'payment_review',
              $or: [{ payment: payment._id }, { payment: null }, { payment: { $exists: false } }],
            },
            {
              $set: { status: nextSubStatus },
              $unset: {
                payment: 1,
                paidAt: 1,
                ...(!isRenewal ? { preferredTeacher: 1 } : {}),
              },
            },
            { session }
          );
        }
      }

      result = {
        paymentId: String(payment._id),
        paymentStatus: payment.status,
        enrollmentId: null,
        enrollmentCreated: false,
        studentId: payment.student ? String(payment.student) : null,
        courseId: payment.course ? String(payment.course) : null,
        subscriptionId: payment.subscription ? String(payment.subscription) : null,
        awaitingPlacement: false,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  processManualPaymentReview,
};

