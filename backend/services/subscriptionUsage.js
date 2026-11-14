'use strict';

const mongoose = require('mongoose');
const GroupCircle = require('../models/GroupCircle');
const StudentSubscription = require('../models/StudentSubscription');
const SubscriptionUsage = require('../models/SubscriptionUsage');
const Session = require('../models/Session');
const User = require('../models/User');
const { circleStatusForCount } = require('./subscriptionCircleLifecycle');
const { notifyUser } = require('../utils/notify');

function attendanceDecision(entry) {
  const status = String(entry?.status || 'pending');
  const eligible = Boolean(entry?.eligibleForCompensation);

  if (status === 'excused' && eligible) {
    return { outcome: 'compensated', reason: 'eligible_excuse' };
  }
  if (status === 'excused') {
    return { outcome: 'consumed', reason: 'late_excuse' };
  }
  if (status === 'absent') {
    return { outcome: 'consumed', reason: 'absent' };
  }
  if (status === 'attended') {
    return { outcome: 'consumed', reason: 'attended' };
  }
  if (status === 'confirmed') {
    return { outcome: 'consumed', reason: 'confirmed' };
  }
  return { outcome: 'consumed', reason: 'pending' };
}

function shouldSendLowBalance(subscription, prepaidRenewal) {
  return subscription.sessionsRemaining === 2 && !subscription.lowBalanceNotifiedAt && !prepaidRenewal;
}

function attachOptionalSession(query, dbSession) {
  if (dbSession && query && typeof query.session === 'function') {
    return query.session(dbSession);
  }
  return query;
}

async function settleRegularSessionSubscriptionUsage(sessionDoc) {
  if (
    mongoose.connection
    && mongoose.connection.readyState !== 1
    && StudentSubscription.findOne === mongoose.Model?.findOne
  ) {
    return { processed: false, usages: [], activatedRenewals: [] };
  }

  const studentId = String(sessionDoc.student?._id || sessionDoc.student);
  const teacherId = sessionDoc.teacher?._id || sessionDoc.teacher;
  const now = new Date();
  const canTransact = typeof mongoose.startSession === 'function'
    && (!mongoose.connection || Boolean(mongoose.connection.client));
  const dbSession = canTransact ? await mongoose.startSession() : null;
  let result = null;
  let notificationTarget = null;
  let activatedRenewal = null;

  const execute = async (activeSession) => {
    notificationTarget = null;
    activatedRenewal = null;

    const existingUsage = await attachOptionalSession(SubscriptionUsage.findOne({
      student: studentId,
      session: sessionDoc._id,
    }), activeSession);
    if (existingUsage) {
      result = {
        studentId,
        subscriptionId: String(existingUsage.subscription),
        outcome: existingUsage.outcome,
        alreadyProcessed: true,
      };
      return;
    }

    const query = {
      student: studentId,
      planKey: 'private',
      status: { $in: ['active', 'placed'] },
      sessionsRemaining: { $gt: 0 },
    };
    if (teacherId) {
      query.$or = [{ preferredTeacher: teacherId }, { preferredTeacher: null }];
    }

    const subscription = await attachOptionalSession(StudentSubscription.findOne(query), activeSession);
    if (!subscription || subscription.sessionsRemaining <= 0) {
      const err = new Error('لا يوجد اشتراك فردي نشط برصيد متاح لإتمام هذه الحصة');
      err.publicMessage = err.message;
      err.code = 'NO_ACTIVE_PRIVATE_SUBSCRIPTION';
      err.status = 409;
      throw err;
    }

    if (subscription.status === 'placed') {
      subscription.status = 'active';
      subscription.startedAt = subscription.startedAt || now;
    }

    const usagePayload = {
      subscription: subscription._id,
      student: studentId,
      session: sessionDoc._id,
      circle: subscription.circle || null,
      outcome: 'consumed',
      reason: 'attended',
      processedAt: now,
    };
    if (activeSession) {
      await SubscriptionUsage.create([usagePayload], { session: activeSession });
    } else {
      await SubscriptionUsage.create(usagePayload);
    }

    subscription.sessionsUsed = Number(subscription.sessionsUsed || 0) + 1;
    subscription.sessionsRemaining -= 1;

    if (subscription.sessionsRemaining === 0) {
      subscription.status = 'completed';
      subscription.completedAt = now;
    }

    const prepaidRenewal = subscription.sessionsRemaining <= 2
      ? await attachOptionalSession(StudentSubscription.findOne({
          student: studentId,
          renewalOf: subscription._id,
          status: 'renewal_queued',
        }), activeSession)
      : null;
    const lowBalanceAlert = shouldSendLowBalance(subscription, prepaidRenewal);
    if (lowBalanceAlert) subscription.lowBalanceNotifiedAt = now;
    await subscription.save(activeSession ? { session: activeSession } : undefined);

    let renewalActivated = false;
    if (subscription.status === 'completed' && prepaidRenewal) {
      prepaidRenewal.status = 'active';
      prepaidRenewal.circle = subscription.circle || prepaidRenewal.circle || null;
      prepaidRenewal.placedAt = prepaidRenewal.placedAt || now;
      prepaidRenewal.startedAt = now;
      await prepaidRenewal.save(activeSession ? { session: activeSession } : undefined);
      renewalActivated = true;
      activatedRenewal = { studentId, subscriptionId: String(prepaidRenewal._id) };
    }

    result = {
      studentId,
      subscriptionId: String(subscription._id),
      outcome: 'consumed',
      remaining: subscription.sessionsRemaining,
      completed: subscription.status === 'completed',
      renewalActivated,
    };

    if (lowBalanceAlert || subscription.status === 'completed') {
      notificationTarget = {
        studentId,
        remaining: subscription.sessionsRemaining,
        completed: subscription.status === 'completed',
        renewalActivated,
      };
    }
  };

  try {
    if (dbSession) {
      await dbSession.withTransaction(async () => execute(dbSession));
    } else {
      await execute(null);
    }
  } catch (error) {
    if (error?.code === 11000) {
      return {
        processed: true,
        usages: [{ studentId, skipped: true, reason: 'ALREADY_PROCESSED_CONCURRENTLY' }],
        activatedRenewals: [],
      };
    }
    throw error;
  } finally {
    if (dbSession) {
      await dbSession.endSession();
    }
  }

  if (notificationTarget) {
    await notifyUser(notificationTarget.studentId, {
      type: 'system',
      title: notificationTarget.renewalActivated
        ? { ar: 'بدأت باقتك المجددة تلقائيًا', en: 'Your renewed package is now active' }
        : notificationTarget.completed
          ? { ar: 'اكتملت باقة حصصك', en: 'Your session package is complete' }
          : { ar: 'رصيد حصصك أوشك على النفاد', en: 'Your session balance is running low' },
      message: notificationTarget.completed
        ? {
            ar: 'تم استخدام جميع حصص الباقة الفردية. يمكنك اختيار باقة جديدة للاستمرار.',
            en: 'All sessions in your private package have been used.',
          }
        : {
            ar: `متبقي لك ${notificationTarget.remaining} حصة في باقتك الفردية.`,
            en: `You have ${notificationTarget.remaining} private session(s) remaining.`,
          },
      data: {
        actionUrl: '/student/dashboard?tab=sessions',
        metadata: {
          remainingSessions: notificationTarget.remaining,
          sessionId: String(sessionDoc._id),
        },
      },
      priority: notificationTarget.completed ? 'high' : 'medium',
    }).catch(() => {});
  }

  return {
    processed: true,
    usages: result ? [result] : [],
    activatedRenewals: activatedRenewal ? [activatedRenewal] : [],
  };
}

async function settleSubscriptionUsageForSession(sessionDoc) {
  if (!sessionDoc || sessionDoc.status !== 'completed') {
    return { processed: false, usages: [] };
  }
  if (sessionDoc.type === 'regular' && sessionDoc.student) {
    return settleRegularSessionSubscriptionUsage(sessionDoc);
  }
  if (sessionDoc.type !== 'group_circle' || !sessionDoc.circle) {
    return { processed: false, usages: [] };
  }

  const circleId = sessionDoc.circle?._id || sessionDoc.circle;
  const circle = await GroupCircle.findById(circleId).select('students').lean();
  if (!circle) {
    const error = new Error('Circle not found for subscription usage');
    error.code = 'CIRCLE_NOT_FOUND';
    throw error;
  }

  const attendanceByStudent = new Map(
    (sessionDoc.attendance || [])
      .filter((entry) => entry?.student)
      .map((entry) => [String(entry.student), entry])
  );

  const scheduledStudentIds = (sessionDoc.attendance || [])
    .filter((entry) => entry?.student)
    .map((entry) => String(entry.student));
  const studentIds = [...new Set(
    scheduledStudentIds.length
      ? scheduledStudentIds
      : (circle.students || []).map(String)
  )];
  const now = new Date();
  const results = [];
  const notificationTargets = [];
  const activatedRenewals = [];

  for (const studentId of studentIds) {
    const dbSession = await mongoose.startSession();
    try {
      let result = null;
      let notificationTarget = null;
      let activatedRenewal = null;

      await dbSession.withTransaction(async () => {
        notificationTarget = null;
        activatedRenewal = null;
        // Serialize settlement within this circle. A concurrent transaction retries
        // with a fresh snapshot, including any renewal activated by its predecessor.
        await GroupCircle.updateOne({ _id: circleId }, { $inc: { subscriptionUsageVersion: 1 } }, { session: dbSession });
        const existingUsage = await SubscriptionUsage.findOne({
          student: studentId, session: sessionDoc._id,
        }).session(dbSession);
        if (existingUsage) {
          result = { studentId, subscriptionId: String(existingUsage.subscription),
            outcome: existingUsage.outcome, alreadyProcessed: true };
          return;
        }
        const subscription = await StudentSubscription.findOne({
          student: studentId, circle: circleId, status: 'active',
        }).session(dbSession);
        if (!subscription || subscription.sessionsRemaining <= 0) {
          result = { studentId, skipped: true, reason: 'NO_ACTIVE_SUBSCRIPTION' };
          return;
        }

        const decision = attendanceDecision(attendanceByStudent.get(studentId));

        await SubscriptionUsage.create([{
          subscription: subscription._id,
          student: studentId,
          session: sessionDoc._id,
          circle: circleId,
          outcome: decision.outcome,
          reason: decision.reason,
          processedAt: now,
        }], { session: dbSession });

        if (decision.outcome === 'compensated') {
          result = {
            studentId,
            subscriptionId: String(subscription._id),
            outcome: 'compensated',
            remaining: subscription.sessionsRemaining,
          };
          return;
        }

        subscription.sessionsUsed += 1;
        subscription.sessionsRemaining -= 1;

        if (subscription.sessionsRemaining === 0) {
          subscription.status = 'completed';
          subscription.completedAt = now;
        }

        const prepaidRenewal = subscription.sessionsRemaining <= 2
          ? await StudentSubscription.findOne({ student: studentId, renewalOf: subscription._id, status: 'renewal_queued' }).session(dbSession)
          : null;
        const lowBalanceAlert = shouldSendLowBalance(subscription, prepaidRenewal);
        if (lowBalanceAlert) subscription.lowBalanceNotifiedAt = now;
        await subscription.save({ session: dbSession });

        let renewalActivated = false;
        if (subscription.status === 'completed') {
          const queuedRenewal = prepaidRenewal;

          if (queuedRenewal) {
            queuedRenewal.status = 'active';
            queuedRenewal.circle = circleId;
            queuedRenewal.placedAt = queuedRenewal.placedAt || now;
            queuedRenewal.startedAt = now;
            await queuedRenewal.save({ session: dbSession });
            renewalActivated = true;
            activatedRenewal = { studentId, subscriptionId: String(queuedRenewal._id) };
          } else {
            await GroupCircle.updateOne(
              { _id: circleId },
              { $pull: { students: studentId } },
              { session: dbSession }
            );
            await User.updateOne(
              { _id: studentId, circle: circleId },
              { $unset: { circle: 1 } },
              { session: dbSession }
            );
            await Session.updateMany(
              {
                _id: { $ne: sessionDoc._id },
                circle: circleId,
                status: { $in: ['pending', 'accepted'] },
                scheduledAt: { $gt: now },
              },
              { $pull: { attendance: { student: studentId } } },
              { session: dbSession }
            );
          }
        }

        result = {
          studentId,
          subscriptionId: String(subscription._id),
          outcome: 'consumed',
          remaining: subscription.sessionsRemaining,
          completed: subscription.status === 'completed',
          renewalActivated,
        };

        if (lowBalanceAlert || subscription.status === 'completed') {
          notificationTarget = {
            studentId,
            remaining: subscription.sessionsRemaining,
            completed: subscription.status === 'completed',
            renewalActivated,
          };
        }
      });
      if (notificationTarget) notificationTargets.push(notificationTarget);
      if (activatedRenewal) activatedRenewals.push(activatedRenewal);

      if (result) results.push(result);
    } catch (error) {
      if (error?.code === 11000) {
        results.push({ studentId, skipped: true, reason: 'ALREADY_PROCESSED_CONCURRENTLY' });
      } else {
        throw error;
      }
    } finally {
      await dbSession.endSession();
    }
  }

  const refreshedCircle = await GroupCircle.findById(circleId)
    .select('students capacity subscriptionPlanKey status')
    .lean();
  if (refreshedCircle) {
    const nextStatus = circleStatusForCount(refreshedCircle);
    if (nextStatus !== refreshedCircle.status) {
      await GroupCircle.updateOne({ _id: circleId, status: refreshedCircle.status, students: refreshedCircle.students }, { $set: { status: nextStatus } });
    }
  }

  await Promise.allSettled(
    notificationTargets.map((target) => notifyUser(target.studentId, {
      type: 'system',
      title: target.renewalActivated
        ? { ar: 'بدأت باقتك المجددة تلقائيًا', en: 'Your renewed package is now active' }
        : target.completed
          ? { ar: 'اكتملت باقة حصصك', en: 'Your session package is complete' }
          : { ar: 'رصيد حصصك أوشك على النفاد', en: 'Your session balance is running low' },
      message: target.renewalActivated
        ? {
            ar: 'اكتملت الباقة السابقة وتم تفعيل الباقة المجددة تلقائيًا مع نفس الجروب والمعلم.',
            en: 'Your previous package ended and the prepaid renewal activated automatically with the same group and tutor.',
          }
        : target.completed
          ? {
              ar: 'تم استخدام جميع حصص الباقة. يمكنك اختيار باقة جديدة للاستمرار.',
              en: 'All sessions in your package have been used. Choose a new package to continue.',
            }
          : {
              ar: `متبقي لك ${target.remaining} حصة في باقتك. جدّد اشتراكك للاستمرار مع نفس المعلم والمجموعة.`,
              en: `You have only ${target.remaining} session(s) left in your current package.`,
            },
      data: {
        actionUrl: '/student/dashboard?tab=sessions',
        metadata: {
          remainingSessions: target.remaining,
          sessionId: String(sessionDoc._id),
        },
      },
      priority: target.completed ? 'high' : 'medium',
    }))
  );

  return { processed: true, usages: results, activatedRenewals };
}

module.exports = {
  attendanceDecision,
  shouldSendLowBalance,
  settleRegularSessionSubscriptionUsage,
  settleSubscriptionUsageForSession,
};


