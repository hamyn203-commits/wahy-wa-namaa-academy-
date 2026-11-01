'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decisionForTeacher } = require('../utils/teacherAccess');

test('teacher approval gate blocks applications until approved and verified', () => {
  const pending = decisionForTeacher({ status: 'pending', isVerified: false });
  assert.equal(pending.allowed, false);
  assert.equal(pending.code, 'TEACHER_APPROVAL_PENDING');

  const underReview = decisionForTeacher({ status: 'under-review', isVerified: false });
  assert.equal(underReview.allowed, false);
  assert.equal(underReview.code, 'TEACHER_APPLICATION_UNDER_REVIEW');

  const rejected = decisionForTeacher({ status: 'rejected', isVerified: false });
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.code, 'TEACHER_APPLICATION_REJECTED');

  const approvedButUnverified = decisionForTeacher({ status: 'approved', isVerified: false });
  assert.equal(approvedButUnverified.allowed, false);
  assert.equal(approvedButUnverified.code, 'TEACHER_APPROVAL_PENDING');

  const approved = decisionForTeacher({ status: 'approved', isVerified: true });
  assert.equal(approved.allowed, true);
  assert.equal(approved.status, 'approved');
});

test('teacher approval gate fails closed when a teacher profile is missing', () => {
  const missing = decisionForTeacher(null);
  assert.equal(missing.allowed, false);
  assert.equal(missing.status, 'pending');
  assert.equal(missing.code, 'TEACHER_APPROVAL_PENDING');
});

test('teacher approval gate exposes latest admin reviewNote and requestedChanges checklist items', () => {
  const underReviewWithFeedback = decisionForTeacher({
    status: 'under-review',
    isVerified: false,
    reviewNotes: [
      { note: 'ملاحظة أولى' },
      { note: 'يرجى إعادة رفع فيديو التلاوة بصوت أوضح' },
    ],
    reviewChecklist: [
      { key: 'recitation-video', status: 'changes-requested', note: 'الصوت منخفض في الدقيقة الأولى' },
      { key: 'id-card-front', status: 'approved', note: '' },
    ],
  });

  assert.equal(underReviewWithFeedback.allowed, false);
  assert.equal(underReviewWithFeedback.reviewNote, 'يرجى إعادة رفع فيديو التلاوة بصوت أوضح');
  assert.equal(underReviewWithFeedback.requestedChanges.length, 1);
  assert.equal(underReviewWithFeedback.requestedChanges[0].key, 'recitation-video');
  assert.equal(underReviewWithFeedback.requestedChanges[0].label, 'فيديو التلاوة');
  assert.equal(underReviewWithFeedback.requestedChanges[0].note, 'الصوت منخفض في الدقيقة الأولى');
});
