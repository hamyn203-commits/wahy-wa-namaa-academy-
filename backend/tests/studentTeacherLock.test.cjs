'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const StudentSubscription = require('../models/StudentSubscription');
const {
  TEACHER_LOCK_STATUSES,
  findStudentTeacherLock,
  isTeacherAllowedForLock,
  teacherLockedResponse,
} = require('../utils/studentTeacherLock');

function stubFindOne(result, capture = {}) {
  const original = StudentSubscription.findOne;
  StudentSubscription.findOne = (filter) => {
    capture.filter = filter;
    const chain = {
      sort: () => chain,
      select: () => chain,
      lean: async () => result,
    };
    return chain;
  };
  return () => { StudentSubscription.findOne = original; };
}

test('student teacher lock covers every committed status and releases on cancel/expire', () => {
  for (const status of ['pending_payment', 'payment_review', 'awaiting_placement', 'placed', 'active', 'paused', 'completed', 'renewal_queued']) {
    assert.ok(TEACHER_LOCK_STATUSES.includes(status), status);
  }
  assert.equal(TEACHER_LOCK_STATUSES.includes('cancelled'), false);
  assert.equal(TEACHER_LOCK_STATUSES.includes('expired'), false);
});

test('student teacher lock is read only from subscriptions with a chosen tutor', async () => {
  const capture = {};
  const restore = stubFindOne({ _id: 'sub-1', preferredTeacher: 'teacher-a', status: 'placed' }, capture);
  try {
    const lock = await findStudentTeacherLock('student-1');
    assert.deepEqual(lock, { teacherId: 'teacher-a', subscriptionId: 'sub-1', status: 'placed' });
    assert.equal(capture.filter.student, 'student-1');
    assert.deepEqual(capture.filter.preferredTeacher, { $ne: null });
    assert.deepEqual(capture.filter.status.$in, [...TEACHER_LOCK_STATUSES]);
  } finally {
    restore();
  }
});

test('students without a chosen tutor are not locked', async () => {
  const restore = stubFindOne(null);
  try {
    assert.equal(await findStudentTeacherLock('student-2'), null);
    assert.equal(await findStudentTeacherLock(''), null);
  } finally {
    restore();
  }
});

test('locked students may only book or pay for their own tutor', () => {
  const lock = { teacherId: 'teacher-a', subscriptionId: 'sub-1', status: 'active' };
  assert.equal(isTeacherAllowedForLock(null, 'teacher-b'), true);
  assert.equal(isTeacherAllowedForLock(lock, 'teacher-a'), true);
  assert.equal(isTeacherAllowedForLock(lock, { _id: 'teacher-a' }), true);
  assert.equal(isTeacherAllowedForLock(lock, 'teacher-b'), false);

  const body = teacherLockedResponse(lock);
  assert.equal(body.code, 'STUDENT_TEACHER_LOCKED');
  assert.equal(body.lockedTeacherId, 'teacher-a');
});

