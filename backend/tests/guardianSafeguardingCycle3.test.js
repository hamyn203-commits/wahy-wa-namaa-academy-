'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');
const Session = require('../models/Session');
const LiveSession = require('../models/LiveSession');
const { generateAccessToken } = require('../middleware/auth');
const guardianRouter = require('../routes/guardian');
const {
  isWithinGuardianJoinWindow,
  resolveGuardianSessionMeetingLink,
  verifyPhoneInvitationCodeRequirement,
} = guardianRouter;
const {
  findChildAccess,
  hasChildPermission,
  filterReportForPermissions,
} = require('../utils/guardianSafeguarding');
const {
  assertGenderAndAgeCompatibility,
  isMinorStudent,
  minorHasActiveGuardian,
} = require('../utils/safeguarding');

function makeQuery(value) {
  const q = {
    select() { return q; },
    populate() { return q; },
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return q;
}

// ============================================================================
// 1. Guardian Permission Filtering & Deactivated Profile Fail-Closed
// ============================================================================
test('deactivated guardian profile is denied linked-child access and permissions', () => {
  const deactivatedGuardian = {
    isActive: false,
    children: [
      {
        student: 'student-a',
        permissions: {
          viewProgress: true,
          viewGrades: true,
          viewAttendance: true,
          receiveNotifications: true,
          approveEnrollments: true,
        },
      },
    ],
  };

  assert.equal(findChildAccess(deactivatedGuardian, 'student-a'), null);
  assert.equal(hasChildPermission(deactivatedGuardian, 'student-a', 'viewProgress'), false);
  assert.equal(hasChildPermission(deactivatedGuardian, 'student-a', 'viewGrades'), false);
  assert.equal(hasChildPermission(deactivatedGuardian, 'student-a', 'viewAttendance'), false);
});

test('findChildAccess defaults approveEnrollments fail-closed while preserving explicit boolean flags', () => {
  const guardian = {
    isActive: true,
    children: [
      {
        student: { _id: 'student-1' },
        permissions: {
          viewProgress: true,
          viewGrades: false,
        },
      },
    ],
  };

  const access = findChildAccess(guardian, 'student-1');
  assert.ok(access);
  assert.equal(access.permissions.viewProgress, true);
  assert.equal(access.permissions.viewGrades, false);
  assert.equal(access.permissions.viewAttendance, true);
  assert.equal(access.permissions.approveEnrollments, false);
});

test('filterReportForPermissions redacts progress, attendance, and grades independently without mutating source', () => {
  const original = {
    _id: 'rep-1',
    summary: { ar: 'ملخص أسبوعي', en: 'Weekly summary' },
    data: {
      progress: 82,
      assignments: { completed: 4, pending: 1 },
      achievements: 3,
      attendance: 95,
      quizzes: { taken: 2, averageScore: 88 },
    },
  };

  const gradesOnly = filterReportForPermissions(original, {
    viewProgress: false,
    viewAttendance: false,
    viewGrades: true,
  });
  assert.equal(gradesOnly.summary, undefined);
  assert.equal(gradesOnly.data.progress, undefined);
  assert.equal(gradesOnly.data.assignments, undefined);
  assert.equal(gradesOnly.data.achievements, undefined);
  assert.equal(gradesOnly.data.attendance, undefined);
  assert.deepEqual(gradesOnly.data.quizzes, { taken: 2, averageScore: 88 });

  const attendanceOnly = filterReportForPermissions(original, {
    viewProgress: false,
    viewAttendance: true,
    viewGrades: false,
  });
  assert.equal(attendanceOnly.data.attendance, 95);
  assert.equal(attendanceOnly.data.quizzes, undefined);
  assert.equal(attendanceOnly.data.progress, undefined);

  // Original report object must remain unmutated
  assert.equal(original.data.progress, 82);
  assert.equal(original.data.attendance, 95);
  assert.equal(original.summary.en, 'Weekly summary');
});

// ============================================================================
// 2. Minor Safeguarding & Gender Separation Matrix
// ============================================================================
test('assertGenderAndAgeCompatibility enforces full gender and minor age separation matrix', () => {
  // Missing student demographics fail closed (403)
  assert.throws(
    () => assertGenderAndAgeCompatibility({ student: { gender: '', age: 12 }, section: 'men_children' }),
    (err) => err.code === 'PROFILE_DEMOGRAPHICS_REQUIRED' && err.status === 403
  );

  // Unknown teacher gender fails closed (409)
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 10 },
      teacher: { personalInfo: {} },
    }),
    (err) => err.code === 'TEACHER_GENDER_REQUIRED' && err.status === 409
  );

  // Ladies section rules
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: 10 },
      section: 'ladies',
    }),
    (err) => err.code === 'SECTION_GENDER_MISMATCH'
  );
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 22 },
      teacher: { personalInfo: { gender: 'male' } },
      section: 'ladies',
    }),
    (err) => err.code === 'LADIES_SECTION_TEACHER_MISMATCH'
  );
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 22 },
      teacher: { personalInfo: { gender: 'female' } },
      section: 'ladies',
      circleGender: 'kids_mixed',
    }),
    (err) => err.code === 'GENDER_MISMATCH'
  );
  assert.equal(
    assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 22 },
      teacher: { personalInfo: { gender: 'female' } },
      section: 'ladies',
      circleGender: 'women',
    }),
    true
  );

  // men_children section rejects adult female but allows minor female and male
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 18 },
      section: 'men_children',
    }),
    (err) => err.code === 'SECTION_GENDER_MISMATCH'
  );
  assert.equal(
    assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 11 },
      teacher: { personalInfo: { gender: 'female' } },
      section: 'men_children',
      circleGender: 'kids_mixed',
    }),
    true
  );

  // Cross-gender 1-on-1 teacher separation
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: 18 },
      teacher: { personalInfo: { gender: 'female' } },
    }),
    (err) => err.code === 'ADULT_MALE_FEMALE_TEACHER_FORBIDDEN'
  );
  assert.equal(
    assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: 17 },
      teacher: { personalInfo: { gender: 'female' } },
    }),
    true
  );
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'female', age: 18 },
      teacher: { personalInfo: { gender: 'male' } },
    }),
    (err) => err.code === 'ADULT_FEMALE_MALE_TEACHER_FORBIDDEN'
  );

  // Circle age boundaries
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: 13 },
      circleGender: 'kids_mixed',
    }),
    (err) => err.code === 'KIDS_CIRCLE_AGE_EXCEEDED'
  );
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: 18 },
      circleGender: 'boys',
    }),
    (err) => err.code === 'AGE_GROUP_MISMATCH'
  );
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: 17 },
      circleGender: 'men',
    }),
    (err) => err.code === 'AGE_GROUP_MISMATCH'
  );
});

test('isMinorStudent and minorHasActiveGuardian require an active linked guardian for <18 students', async () => {
  assert.equal(isMinorStudent({ age: 17 }), true);
  assert.equal(isMinorStudent({ age: 18 }), false);
  assert.equal(isMinorStudent({ age: null }), false);

  assert.equal(await minorHasActiveGuardian({ _id: 'adult-1', age: 20 }), true);
  assert.equal(await minorHasActiveGuardian({ age: 14 }), false);

  const origExists = Guardian.exists;
  let capturedFilter = null;
  Guardian.exists = async (filter) => {
    capturedFilter = filter;
    return String(filter['children.student']) === 'minor-linked' ? { _id: 'g-1' } : null;
  };
  try {
    assert.equal(await minorHasActiveGuardian({ _id: 'minor-unlinked', age: 12 }), false);
    assert.equal(await minorHasActiveGuardian({ _id: 'minor-linked', age: 12 }), true);
    assert.deepEqual(capturedFilter.isActive, { $ne: false });
  } finally {
    Guardian.exists = origExists;
  }
});

// ============================================================================
// 3. Join-Window meetingLink Gating & timingSafeEqual Invitation Code Check
// ============================================================================
test('isWithinGuardianJoinWindow and resolveGuardianSessionMeetingLink enforce strict window boundaries', () => {
  const scheduledAt = new Date('2026-11-20T10:00:00.000Z');
  const acceptedSession = { status: 'accepted', scheduledAt, duration: 60 };

  // Non-accepted or malformed sessions never open
  assert.equal(isWithinGuardianJoinWindow({ status: 'pending', scheduledAt, duration: 60 }, scheduledAt), false);
  assert.equal(isWithinGuardianJoinWindow({ status: 'completed', scheduledAt, duration: 60 }, scheduledAt), false);
  assert.equal(isWithinGuardianJoinWindow({ status: 'cancelled', scheduledAt, duration: 60 }, scheduledAt), false);
  assert.equal(isWithinGuardianJoinWindow({ status: 'accepted', scheduledAt: 'not-a-date', duration: 60 }, scheduledAt), false);

  // 31 minutes before start -> closed
  const tooEarly = new Date(scheduledAt.getTime() - 31 * 60 * 1000);
  assert.equal(isWithinGuardianJoinWindow(acceptedSession, tooEarly), false);
  assert.equal(resolveGuardianSessionMeetingLink(acceptedSession, 'room-xyz', tooEarly), null);

  // 30 minutes before start -> open
  const windowOpen = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
  assert.equal(isWithinGuardianJoinWindow(acceptedSession, windowOpen), true);
  assert.equal(resolveGuardianSessionMeetingLink(acceptedSession, 'room-xyz', windowOpen), '/live/room-xyz');

  // Missing liveRoomId -> null even inside window
  assert.equal(resolveGuardianSessionMeetingLink(acceptedSession, null, scheduledAt), null);

  // 60 minutes after end -> open; 61 minutes after end -> closed
  const endMs = scheduledAt.getTime() + 60 * 60 * 1000;
  assert.equal(isWithinGuardianJoinWindow(acceptedSession, new Date(endMs + 60 * 60 * 1000)), true);
  const tooLate = new Date(endMs + 61 * 60 * 1000);
  assert.equal(isWithinGuardianJoinWindow(acceptedSession, tooLate), false);
  assert.equal(resolveGuardianSessionMeetingLink(acceptedSession, 'room-xyz', tooLate), null);
});

test('verifyPhoneInvitationCodeRequirement requires matching linkCode via timingSafeEqual when phone is unverified or duplicated', async () => {
  const origFind = User.find;
  User.find = () => makeQuery([{ _id: 'g-1' }]);
  try {
    const unverifiedUser = { _id: 'g-1', phone: '01012345678', phoneVerified: false };
    const invitation = { linkCode: 'WN-AB12CD34' };

    const missing = await verifyPhoneInvitationCodeRequirement(unverifiedUser, '+201012345678', invitation, '');
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'GUARDIAN_CODE_REQUIRED');

    const wrongLen = await verifyPhoneInvitationCodeRequirement(unverifiedUser, '+201012345678', invitation, 'WN-AB12');
    assert.equal(wrongLen.ok, false);

    const wrongCode = await verifyPhoneInvitationCodeRequirement(unverifiedUser, '+201012345678', invitation, 'WN-00000000');
    assert.equal(wrongCode.ok, false);

    const validLower = await verifyPhoneInvitationCodeRequirement(unverifiedUser, '+201012345678', invitation, 'wn-ab12cd34');
    assert.equal(validLower.ok, true);
  } finally {
    User.find = origFind;
  }
});

// ============================================================================
// 4. End-to-End HTTP RBAC & /api/guardian/upcoming-sessions Join-Window Gating
// ============================================================================
let server;
let baseUrl;
const origReadyState = mongoose.connection.readyState;
const origUserFindById = User.findById;
const origUserFind = User.find;
const origTeacherFindOne = Teacher.findOne;
const origGuardianFindOne = Guardian.findOne;
const origSessionFind = Session.find;
const origLiveSessionFind = LiveSession.find;

after(async () => {
  mongoose.connection.readyState = origReadyState;
  User.findById = origUserFindById;
  User.find = origUserFind;
  Teacher.findOne = origTeacherFindOne;
  Guardian.findOne = origGuardianFindOne;
  Session.find = origSessionFind;
  LiveSession.find = origLiveSessionFind;
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('HTTP RBAC isolates guardian endpoints and gates meetingLink outside the join window', async () => {
  const oid = () => new mongoose.Types.ObjectId().toString();
  const guardianId = oid();
  const studentId = oid();
  const teacherId = oid();
  const adminId = oid();
  const futureSessionId = oid();
  const activeSessionId = oid();

  const usersById = new Map([
    [guardianId, { _id: guardianId, id: guardianId, name: 'Guardian User', role: 'guardian', isActive: true }],
    [studentId, { _id: studentId, id: studentId, name: 'Minor Student', role: 'student', isActive: true, age: 12 }],
    [teacherId, { _id: teacherId, id: teacherId, name: 'Teacher User', role: 'teacher', isActive: true }],
    [adminId, { _id: adminId, id: adminId, name: 'Admin User', role: 'admin', isActive: true }],
  ]);

  mongoose.connection.readyState = 1;
  User.findById = (id) => makeQuery(usersById.get(String(id)) || null);
  User.find = () => makeQuery([{ _id: studentId, name: 'Minor Student', circle: null }]);
  Teacher.findOne = () => makeQuery({ _id: oid(), user: teacherId, status: 'approved', isVerified: true });
  Guardian.findOne = () => makeQuery({
    user: guardianId,
    isActive: true,
    children: [
      {
        student: studentId,
        relationship: 'father',
        permissions: {
          viewProgress: true,
          viewGrades: true,
          viewAttendance: true,
          receiveNotifications: true,
          approveEnrollments: false,
        },
      },
    ],
  });

  const nowMs = Date.now();
  Session.find = () => makeQuery([
    {
      _id: futureSessionId,
      student: studentId,
      scheduledAt: new Date(nowMs + 3 * 60 * 60 * 1000).toISOString(),
      duration: 60,
      status: 'accepted',
      type: 'regular',
      teacher: { _id: oid(), personalInfo: { fullName: 'الشيخ أحمد', phone: '01099999999' }, user: { name: 'الشيخ أحمد' } },
      attendance: [],
    },
    {
      _id: activeSessionId,
      student: studentId,
      scheduledAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
      duration: 60,
      status: 'accepted',
      type: 'regular',
      teacher: { _id: oid(), personalInfo: { fullName: 'الشيخ أحمد', phone: '01099999999' }, user: { name: 'الشيخ أحمد' } },
      attendance: [],
    },
  ]);

  LiveSession.find = () => makeQuery([
    { session: futureSessionId, roomId: 'room-future-secret' },
    { session: activeSessionId, roomId: 'room-active-open' },
  ]);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const studentToken = generateAccessToken({ _id: studentId, role: 'student' });
  const teacherToken = generateAccessToken({ _id: teacherId, role: 'teacher' });
  const guardianToken = generateAccessToken({ _id: guardianId, role: 'guardian' });

  // 4-role isolation checks
  for (const token of [studentToken, teacherToken]) {
    const forbidden = await fetch(`${baseUrl}/api/guardian/upcoming-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(forbidden.status, 403);
  }

  const guardianSelfGrant = await fetch(`${baseUrl}/api/guardians/permissions/${studentId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${guardianToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissions: { approveEnrollments: true } }),
  });
  assert.equal(guardianSelfGrant.status, 403);

  // Guardian upcoming sessions response: meetingLink gated & teacherPhone never exposed
  const res = await fetch(`${baseUrl}/api/guardian/upcoming-sessions`, {
    headers: { Authorization: `Bearer ${guardianToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.sessions.length, 2);

  const futurePayload = body.sessions.find((s) => String(s._id) === futureSessionId);
  const activePayload = body.sessions.find((s) => String(s._id) === activeSessionId);

  assert.equal(futurePayload.meetingLink, null);
  assert.equal(activePayload.meetingLink, '/live/room-active-open');
  assert.equal(futurePayload.instanceKey, `${futureSessionId}:${studentId}`);
  assert.equal(futurePayload.teacher.phone, undefined);
  assert.equal(futurePayload.teacherPhone, undefined);
});
