'use strict';

const StudentSubscription = require('../models/StudentSubscription');

// Once a student commits to a tutor (the tutor is recorded on a subscription
// when the transfer proof is submitted), the student stays with that tutor.
// Only cancelled or expired subscriptions release the lock; changing tutor
// afterwards is an admin decision.
const TEACHER_LOCK_STATUSES = Object.freeze([
  'pending_payment',
  'payment_review',
  'renewal_queued',
  'awaiting_placement',
  'placed',
  'active',
  'paused',
  'completed',
]);

function teacherIdOf(value) {
  if (!value) return '';
  return String(value._id || value);
}

async function findStudentTeacherLock(studentId) {
  if (!studentId) return null;
  const subscription = await StudentSubscription.findOne({
    student: studentId,
    preferredTeacher: { $ne: null },
    status: { $in: TEACHER_LOCK_STATUSES },
  })
    .sort({ createdAt: -1 })
    .select('_id preferredTeacher status')
    .lean();

  if (!subscription?.preferredTeacher) return null;
  return {
    teacherId: teacherIdOf(subscription.preferredTeacher),
    subscriptionId: String(subscription._id),
    status: subscription.status,
  };
}

function isTeacherAllowedForLock(lock, teacherId) {
  if (!lock) return true;
  return lock.teacherId === teacherIdOf(teacherId);
}

function teacherLockedResponse(lock) {
  return {
    error: 'تم تسكينك مع معلمك بالفعل. لتغيير المعلم تواصل مع إدارة الأكاديمية.',
    code: 'STUDENT_TEACHER_LOCKED',
    lockedTeacherId: lock?.teacherId || null,
  };
}

module.exports = {
  TEACHER_LOCK_STATUSES,
  findStudentTeacherLock,
  isTeacherAllowedForLock,
  teacherLockedResponse,
};

