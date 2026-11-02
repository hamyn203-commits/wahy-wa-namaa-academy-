// Mirrors backend/utils/studentTeacherLock.js. Once a tutor is recorded on a
// subscription, the student stays with that tutor; only cancelled or expired
// subscriptions release the lock. The backend enforces this on booking and
// payment; the UI uses it to close the tutor marketplace.
export const TEACHER_LOCK_STATUSES = Object.freeze([
  'pending_payment',
  'payment_review',
  'renewal_queued',
  'awaiting_placement',
  'placed',
  'active',
  'paused',
  'completed',
]);

export function teacherLockFromSubscriptions(subscriptions = []) {
  const locked = (Array.isArray(subscriptions) ? subscriptions : []).find((item) =>
    item?.preferredTeacher && TEACHER_LOCK_STATUSES.includes(item.status)
  );
  if (!locked) return null;
  const teacher = locked.preferredTeacher;
  return {
    teacherId: String(teacher?._id || teacher),
    teacher: typeof teacher === 'object' ? teacher : null,
    subscriptionId: String(locked._id || ''),
    status: locked.status,
  };
}

