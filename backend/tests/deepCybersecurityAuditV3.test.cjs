'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/wahy_round3_unit';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.ALLOW_ADMIN_BOOTSTRAP = 'true';
process.env.ADMIN_BOOTSTRAP_SECRET = 'round3-bootstrap-secret-0123456789-abcdef';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';

const mongoose = require('mongoose');

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const GuardianInvitation = require('../models/GuardianInvitation');
const StudentSubscription = require('../models/StudentSubscription');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const { Assignment, AssignmentSubmission } = require('../models/Assignment');
const { Quiz, QuizAttempt } = require('../models/Quiz');
const TeacherLedger = require('../models/TeacherLedger');
const GroupCircle = require('../models/GroupCircle');
const TrialRequest = require('../models/TrialRequest');
const Notification = require('../models/Notification');

const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
const { applyPaymobTransaction } = require('../services/paymentSettlement');
const { processManualPaymentReview } = require('../services/manualPaymentSettlement');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const app = require('../app');

mongoose.connection.readyState = 1;

const oid = () => new mongoose.Types.ObjectId().toString();

function chainableQuery(value) {
  const q = {
    select() { return q; },
    populate() { return q; },
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    session() { return q; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return q;
}

let server;
let baseUrl = '';

const ids = {
  admin: oid(),
  preRegAdmin: oid(),
  teacherUser: oid(),
  teacherProfile: oid(),
  maleTeacherProfile: oid(),
  minorStudent: oid(),
  adultStudent: oid(),
  guardianUser: oid(),
  course: oid(),
  assignment: oid(),
  quiz: oid(),
  circle: oid(),
};

const userStore = new Map();

function resetUsers() {
  userStore.clear();
  userStore.set(ids.admin, {
    _id: ids.admin,
    id: ids.admin,
    name: 'Sole Admin',
    email: 'sole-admin@wahy.test',
    role: 'admin',
    isActive: true,
    emailVerified: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.preRegAdmin, {
    _id: ids.preRegAdmin,
    id: ids.preRegAdmin,
    name: 'Attacker PreReg',
    email: 'future-admin@wahy.test',
    role: 'student',
    isActive: true,
    emailVerified: false,
    googleSubject: 'attacker-google-sub',
    whatsappPhone: '+201099999999',
    refreshTokenVersion: 0,
  });
  userStore.set(ids.teacherUser, {
    _id: ids.teacherUser,
    id: ids.teacherUser,
    name: 'Approved Female Teacher',
    email: 'female-teacher@wahy.test',
    role: 'teacher',
    gender: 'female',
    age: 29,
    isActive: true,
    emailVerified: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.minorStudent, {
    _id: ids.minorStudent,
    id: ids.minorStudent,
    name: 'Minor Student',
    email: 'minor@wahy.test',
    phone: '01012345678',
    phoneNormalized: '+201012345678',
    role: 'student',
    gender: 'male',
    age: 11,
    enrollmentSection: 'men_children',
    isActive: true,
    onboarding: { required: true, completed: true, trackSelected: true },
    refreshTokenVersion: 0,
  });
  userStore.set(ids.adultStudent, {
    _id: ids.adultStudent,
    id: ids.adultStudent,
    name: 'Adult Student',
    email: 'adult@wahy.test',
    phone: '01087654321',
    phoneNormalized: '+201087654321',
    role: 'student',
    gender: 'male',
    age: 25,
    enrollmentSection: 'men_children',
    isActive: true,
    onboarding: { required: false, completed: true, trackSelected: true },
    refreshTokenVersion: 0,
  });
  userStore.set(ids.guardianUser, {
    _id: ids.guardianUser,
    id: ids.guardianUser,
    name: 'Guardian Account',
    email: 'guardian-v3@wahy.test',
    phone: '01055555555',
    phoneNormalized: '+201055555555',
    role: 'guardian',
    isActive: true,
    refreshTokenVersion: 0,
  });
}

resetUsers();

function makeMutableUserDoc(raw) {
  if (!raw) return null;
  const doc = {
    ...raw,
    set(path, val) {
      const parts = String(path).split('.');
      let cur = this;
      for (let i = 0; i < parts.length - 1; i += 1) {
        cur[parts[i]] = cur[parts[i]] && typeof cur[parts[i]] === 'object' ? { ...cur[parts[i]] } : {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = val;
    },
    toObject() {
      const copy = { ...this };
      delete copy.save;
      delete copy.set;
      delete copy.toObject;
      delete copy.toJSON;
      return copy;
    },
    toJSON() {
      return this.toObject();
    },
    async save() {
      userStore.set(String(this._id), this.toObject());
      return this;
    },
  };
  return doc;
}

User.findById = (id) => chainableQuery(makeMutableUserDoc(userStore.get(String(id)) || null));
User.findOne = (filter = {}) => {
  for (const raw of userStore.values()) {
    let ok = true;
    if (filter.email && raw.email !== filter.email) ok = false;
    if (filter.role && raw.role !== filter.role) ok = false;
    if (filter.isActive !== undefined) {
      if (typeof filter.isActive === 'object' && filter.isActive.$ne !== undefined) {
        if (raw.isActive === filter.isActive.$ne) ok = false;
      } else if (raw.isActive !== filter.isActive) {
        ok = false;
      }
    }
    if (filter._id && typeof filter._id === 'object' && filter._id.$ne) {
      if (String(raw._id) === String(filter._id.$ne)) ok = false;
    }
    if (ok) return chainableQuery(makeMutableUserDoc(raw));
  }
  return chainableQuery(null);
};
User.countDocuments = async (filter = {}) => {
  let count = 0;
  for (const raw of userStore.values()) {
    if (filter.role && raw.role !== filter.role) continue;
    if (filter.isActive !== undefined && raw.isActive !== filter.isActive) continue;
    if (filter._id?.$ne && String(raw._id) === String(filter._id.$ne)) continue;
    count += 1;
  }
  return count;
};
User.findByIdAndUpdate = (id, update = {}) => {
  const existing = userStore.get(String(id));
  if (!existing) return chainableQuery(null);
  const next = { ...existing };
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      next[k] = v;
    }
  }
  if (update.$inc?.refreshTokenVersion) {
    next.refreshTokenVersion = Number(next.refreshTokenVersion || 0) + update.$inc.refreshTokenVersion;
  }
  userStore.set(String(id), next);
  return chainableQuery(makeMutableUserDoc(next));
};
User.findOneAndUpdate = (filter = {}, update = {}) => {
  for (const [id, raw] of userStore.entries()) {
    if (filter._id && String(raw._id) !== String(filter._id)) continue;
    if (filter.isActive?.$ne !== undefined && raw.isActive === filter.isActive.$ne) continue;
    if (filter.refreshTokenVersion !== undefined && Number(raw.refreshTokenVersion || 0) !== Number(filter.refreshTokenVersion)) {
      continue;
    }
    if (filter.consumedRefreshJtis?.$ne !== undefined) {
      const list = Array.isArray(raw.consumedRefreshJtis) ? raw.consumedRefreshJtis : [];
      if (list.includes(filter.consumedRefreshJtis.$ne)) continue;
    }
    const next = { ...raw };
    if (update.$inc?.refreshTokenVersion) {
      next.refreshTokenVersion = Number(next.refreshTokenVersion || 0) + update.$inc.refreshTokenVersion;
    }
    if (update.$push?.consumedRefreshJtis) {
      const prevList = Array.isArray(next.consumedRefreshJtis) ? [...next.consumedRefreshJtis] : [];
      const pushSpec = update.$push.consumedRefreshJtis;
      if (pushSpec && Array.isArray(pushSpec.$each)) {
        prevList.push(...pushSpec.$each);
        if (typeof pushSpec.$slice === 'number' && pushSpec.$slice < 0) {
          next.consumedRefreshJtis = prevList.slice(pushSpec.$slice);
        } else {
          next.consumedRefreshJtis = prevList;
        }
      } else {
        prevList.push(pushSpec);
        next.consumedRefreshJtis = prevList;
      }
    }
    if (update.$set) Object.assign(next, update.$set);
    userStore.set(id, next);
    return chainableQuery(makeMutableUserDoc(next));
  }
  return chainableQuery(null);
};

Teacher.findOne = (filter = {}) => {
  if (filter.user && typeof filter.user === 'object' && !(filter.user instanceof mongoose.Types.ObjectId) && !filter.user.$in) {
    throw new mongoose.Error.CastError('ObjectId', filter.user, 'user');
  }
  if (String(filter.user || '') === ids.teacherUser || String(filter._id || '') === ids.teacherProfile) {
    return chainableQuery({
      _id: ids.teacherProfile,
      user: ids.teacherUser,
      status: 'approved',
      isVerified: true,
      hourlyRate: 100,
      personalInfo: { fullName: 'Approved Female Teacher', gender: 'female' },
    });
  }
  return chainableQuery(null);
};

Notification.createAndSend = async () => ({ success: true });
Guardian.updateMany = async () => ({ modifiedCount: 0 });
GuardianInvitation.updateMany = async () => ({ modifiedCount: 0 });

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ============================================================================
// 1. V3-CRIT-03: Refunded Course Certificate Revocation Schema Match
// ============================================================================
test('V3-CRIT-03: refunding a settled course payment revokes Certificate using { student, status: "revoked" }', async () => {
  let capturedFilter = null;
  let capturedUpdate = null;
  const origEnrollmentFindOne = Enrollment.findOne;
  const origCourseUpdateOne = Course.updateOne;
  const origCertUpdateMany = Certificate.updateMany;

  try {
    Enrollment.findOne = () => chainableQuery({
      status: 'active',
      payment: { status: 'completed' },
      async save() { return this; },
    });
    Course.updateOne = async () => ({ modifiedCount: 1 });
    Certificate.updateMany = async (filter, update) => {
      capturedFilter = filter;
      capturedUpdate = update;
      return { modifiedCount: 1 };
    };

    const fakePayment = {
      _id: oid(),
      status: 'succeeded',
      student: ids.adultStudent,
      course: ids.course,
      async save() { return this; },
    };

    await applyPaymobTransaction({
      payment: fakePayment,
      classification: 'refunded',
      transactionId: 'tx-refund-999',
      session: null,
    });

    assert.ok(capturedFilter, 'Certificate.updateMany must be invoked');
    assert.equal(String(capturedFilter.student), ids.adultStudent, 'Must query Certificate by student field (not non-existent user field)');
    assert.equal(capturedFilter.user, undefined, 'Must not query non-existent Certificate.user field');
    assert.equal(capturedUpdate?.$set?.status, 'revoked', 'Must set Certificate.status = "revoked"');
  } finally {
    Enrollment.findOne = origEnrollmentFindOne;
    Course.updateOne = origCourseUpdateOne;
    Certificate.updateMany = origCertUpdateMany;
  }
});

// ============================================================================
// 2. V3-CRIT-02: Manual Subscription Payment Review Rejects Amount Mismatch
// ============================================================================
test('V3-CRIT-02: processManualPaymentReview rejects subscription activation when payment.amountMinor !== subscription.totalAmountMinor', async () => {
  const origStartSession = mongoose.startSession;
  const origPaymentFindOne = Payment.findOne;
  const origSubFindOne = StudentSubscription.findOne;

  try {
    mongoose.startSession = async () => ({
      async withTransaction(fn) { return fn(); },
      async endSession() {},
    });
    const subId = oid();
    Payment.findOne = () => chainableQuery({
      _id: oid(),
      provider: 'manual',
      kind: 'subscription',
      status: 'pending',
      student: ids.adultStudent,
      subscription: subId,
      amountMinor: 4000, // 40 EGP paid
      currency: 'EGP',
      manual: {},
      async save() { return this; },
    });
    StudentSubscription.findOne = () => chainableQuery({
      _id: subId,
      student: ids.adultStudent,
      planKey: 'private',
      section: 'men_children',
      sessionCount: 16,
      sessionsRemaining: 16,
      totalAmountMinor: 160000, // Upgraded via TOCTOU to 1,600 EGP!
      currency: 'EGP',
      status: 'payment_review',
      async save() { return this; },
    });

    await assert.rejects(
      () => processManualPaymentReview({
        paymentId: oid(),
        adminId: ids.admin,
        action: 'approve',
        note: 'Looks like a valid 40 EGP receipt',
      }),
      (err) => err && (err.code === 'PAYMENT_AMOUNT_MISMATCH' || /mismatch|amount/i.test(err.message)),
      'Manual review must fail closed when Payment.amountMinor does not match StudentSubscription.totalAmountMinor'
    );
  } finally {
    mongoose.startSession = origStartSession;
    Payment.findOne = origPaymentFindOne;
    StudentSubscription.findOne = origSubFindOne;
  }
});

// ============================================================================
// 3. V3-CRIT-01: Zero-Attendee Group Circle Self-Completion Blocked for Teacher
// ============================================================================
test('V3-CRIT-01: teacher cannot self-complete a group_circle session when 0 students attended', async () => {
  const SubscriptionUsage = require('../models/SubscriptionUsage');
  const origSessionFindOne = Session.findOne;
  const origSessionCount = Session.countDocuments;
  const origSessionAgg = Session.aggregate;
  const origTeacherFindById = Teacher.findById;
  const origTeacherFindByIdAndUpdate = Teacher.findByIdAndUpdate;
  const origCircleFindById = GroupCircle.findById;
  const origUsageFindOne = SubscriptionUsage.findOne;
  const origUsageCreate = SubscriptionUsage.create;
  let ledgerCalled = false;
  const origLedgerFindOneAndUpdate = TeacherLedger.findOneAndUpdate;

  try {
    const sessId = oid();
    Session.findOne = () => chainableQuery({
      _id: sessId,
      teacher: ids.teacherProfile,
      circle: ids.circle,
      type: 'group_circle',
      status: 'accepted',
      scheduledAt: new Date(Date.now() - 65 * 60 * 1000),
      duration: 60,
      attendance: [
        { student: ids.adultStudent, status: 'excused', eligibleForCompensation: true },
      ],
      earnings: { amount: 0, status: 'pending' },
      async save() { return this; },
    });
    Session.countDocuments = async () => 1;
    Session.aggregate = async () => [{ totalMinutes: 60 }];
    GroupCircle.findById = () => chainableQuery({ _id: ids.circle, students: [ids.adultStudent] });
    SubscriptionUsage.findOne = () => chainableQuery(null);
    SubscriptionUsage.create = async () => ({});
    Teacher.findById = () => chainableQuery({
      _id: ids.teacherProfile,
      user: ids.teacherUser,
      hourlyRate: 100,
    });
    Teacher.findByIdAndUpdate = () => chainableQuery({});
    TeacherLedger.findOneAndUpdate = async () => {
      ledgerCalled = true;
      return {};
    };

    const token = generateAccessToken({ _id: ids.teacherUser, email: 'female-teacher@wahy.test', role: 'teacher', refreshTokenVersion: 0 });
    const res = await fetch(`${baseUrl}/api/sessions/${sessId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ evaluation: {} }),
    });

    assert.equal(res.status, 409, 'Zero-attendee group_circle session must be rejected with 409');
    assert.equal(ledgerCalled, false, 'TeacherLedger must NOT be credited for a zero-attendance group session');
  } finally {
    Session.findOne = origSessionFindOne;
    Session.countDocuments = origSessionCount;
    Session.aggregate = origSessionAgg;
    GroupCircle.findById = origCircleFindById;
    SubscriptionUsage.findOne = origUsageFindOne;
    SubscriptionUsage.create = origUsageCreate;
    Teacher.findById = origTeacherFindById;
    Teacher.findByIdAndUpdate = origTeacherFindByIdAndUpdate;
    TeacherLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
  }
});

// ============================================================================
// 4. V3-CRIT-04: Paid Course Media Must Not Stream Unauthenticated via /api/uploads/public
// ============================================================================
test('V3-CRIT-04: GET /api/uploads/public rejects course-media references to prevent unauthenticated paid video exfiltration', async () => {
  const res = await fetch(`${baseUrl}/api/uploads/public?ref=${encodeURIComponent('uploads/course-media/paid-course/secret-lesson.mp4')}`);
  assert.equal(res.status, 403, 'course-media must not be served publicly without authentication/enrollment check');
});

// ============================================================================
// 5. V3-CRIT-05: Admin Bootstrap Must Not Preserve Pre-Registered Student Refresh Sessions
// ============================================================================
test('V3-CRIT-05: /api/setup/ensure-admin either blocks pre-registered student accounts or rotates refreshTokenVersion & clears googleSubject', async () => {
  resetUsers();
  // Remove existing admin so bootstrap can run
  userStore.delete(ids.admin);

  const preRegRefresh = generateRefreshToken(userStore.get(ids.preRegAdmin));
  const res = await fetch(`${baseUrl}/api/setup/ensure-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-bootstrap-secret': process.env.ADMIN_BOOTSTRAP_SECRET,
    },
    body: JSON.stringify({
      name: 'Real Admin',
      email: 'future-admin@wahy.test',
      password: 'UltraStrongAdminPassword123!',
    }),
  });

  if (res.status === 200) {
    // If promoted, old pre-registered refresh cookie MUST NOT mint an admin accessToken!
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `wn_refresh=${encodeURIComponent(preRegRefresh)}`,
        Origin: 'http://localhost:5173',
      },
    });
    assert.equal(refreshRes.status, 401, 'Pre-registered student refresh cookie must be invalidated upon admin promotion');
    const updated = userStore.get(ids.preRegAdmin);
    assert.equal(updated.googleSubject, undefined, 'Pre-planted googleSubject must be cleared');
  } else {
    assert.equal(res.status, 409, 'Refusing to promote pre-registered non-admin account is also safe');
  }
  resetUsers();
});

// ============================================================================
// 6. V3-HIGH-02: Minor Cannot Self-Mutate Age/Gender Post-Onboarding
// ============================================================================
test('V3-HIGH-02: PATCH /api/auth/onboarding blocks self-mutation of age/gender once onboarding is completed', async () => {
  resetUsers();
  const minorToken = generateAccessToken(userStore.get(ids.minorStudent));
  const res = await fetch(`${baseUrl}/api/auth/onboarding`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${minorToken}`,
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify({
      name: 'Minor Student',
      phone: '01012345678',
      age: 22, // Attempting to escape minor safeguarding!
      gender: 'female', // Attempting to cross gender section!
    }),
  });

  assert.equal(res.status, 403, 'Completed profile must forbid self-service age/gender changes');
  assert.equal(userStore.get(ids.minorStudent).age, 11);
  assert.equal(userStore.get(ids.minorStudent).gender, 'male');
});

// ============================================================================
// 7. V3-HIGH-03: safeguarding.js Must Fail Closed When Age or Gender Is Missing
// ============================================================================
test('V3-HIGH-03: assertGenderAndAgeCompatibility fails closed when student gender or age is unset', () => {
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: '', age: null },
      section: 'ladies',
    }),
    'Unset gender must NOT be allowed into ladies section'
  );

  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: null },
      teacher: { personalInfo: { gender: 'female' } },
    }),
    'Male student with unknown age must NOT bypass adult cross-gender 1-on-1 check'
  );

  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { gender: 'male', age: null },
      circleGender: 'boys',
    }),
    'Student with unknown age must NOT enter minor boys circle'
  );
});

// ============================================================================
// 8. V3-HIGH-06: Revoked Refresh Token Cannot Perpetually Kill New Sessions via /api/auth/logout
// ============================================================================
test('V3-HIGH-06: POST /api/auth/logout ignores already-revoked refresh tokens (preventing perpetual logout DoS)', async () => {
  resetUsers();
  // User is currently on refreshTokenVersion = 5, while attacker holds stale v = 0 token
  const current = { ...userStore.get(ids.adultStudent), refreshTokenVersion: 5 };
  userStore.set(ids.adultStudent, current);
  const staleRevokedRefresh = generateRefreshToken({ _id: ids.adultStudent, refreshTokenVersion: 0 });

  const res = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: `wn_refresh=${encodeURIComponent(staleRevokedRefresh)}`,
      Origin: 'http://localhost:5173',
    },
  });
  assert.equal(res.status, 200);
  assert.equal(
    userStore.get(ids.adultStudent).refreshTokenVersion,
    5,
    'Stale revoked refresh token must NOT increment refreshTokenVersion and kill active v=5 sessions'
  );
});

// ============================================================================
// 9. V3-HIGH-07: Authenticated Teacher Upload Token Must Not Throw CastError in getTeacherAccessDecision
// ============================================================================
test('V3-HIGH-07: POST /api/uploads/blob validates teacher access without throwing CastError and checks refreshTokenVersion', async () => {
  resetUsers();
  const prevDriver = process.env.STORAGE_DRIVER;
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.STORAGE_DRIVER = 'vercel-blob';
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_testtoken123_secret456';

  try {
    // 1) Active teacher token (v: 0) must NOT fail on getTeacherAccessDecision CastError;
    //    we test verifyClientIdentity indirectly via revoked token (v: 0 vs user v: 2) AND active teacher token
    userStore.set(ids.teacherUser, { ...userStore.get(ids.teacherUser), refreshTokenVersion: 2 });
    const revokedTeacherAccess = generateAccessToken({
      _id: ids.teacherUser,
      email: 'female-teacher@wahy.test',
      role: 'teacher',
      refreshTokenVersion: 0,
    });

    const res = await fetch(`${baseUrl}/api/uploads/blob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blob.generate-client-token',
        payload: {
          pathname: `uploads/teacher-public/${ids.teacherUser}/intro.mp4`,
          clientPayload: JSON.stringify({
            purpose: 'teacher-public',
            filename: 'intro.mp4',
            accessToken: revokedTeacherAccess,
            size: 1024 * 1024,
            contentType: 'video/mp4',
          }),
          multipart: false,
        },
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400, 'Revoked access token must be rejected during blob upload token generation');
    assert.match(String(body.error || ''), /revoked|expired|inactive|UPLOAD_AUTHORIZATION/i);
  } finally {
    if (prevDriver === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = prevDriver;
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  }
});

// ============================================================================
// 10. V3-HIGH-13: Guardian Report Generation Must Not Leak Another Child's Report
// ============================================================================
test('V3-HIGH-13: POST /api/guardians/report/:studentId does not leak a sibling report when generateReport returns null', async () => {
  resetUsers();
  const origGuardianFindOne = Guardian.findOne;
  const siblingId = oid();

  try {
    Guardian.findOne = () => chainableQuery({
      _id: oid(),
      user: ids.guardianUser,
      isActive: true,
      children: [
        {
          student: ids.minorStudent,
          relationship: 'father',
          permissions: { viewProgress: true, viewGrades: true, viewAttendance: true },
        },
      ],
      reports: [
        {
          childId: siblingId, // Unlinked / revoked sibling report!
          type: 'weekly',
          generatedAt: new Date(),
          summary: { secretSiblingData: 'CONFIDENTIAL_SIBLING_QUIZ_99' },
          courses: [{ title: 'Secret Course', quizzes: [{ score: 99 }] }],
        },
      ],
      async generateReport() {
        return null; // Child has 0 LMS enrollments
      },
    });

    const guardianToken = generateAccessToken(userStore.get(ids.guardianUser));
    const res = await fetch(`${baseUrl}/api/guardians/report/${ids.minorStudent}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guardianToken}`,
      },
      body: JSON.stringify({ type: 'weekly' }),
    });

    const body = await res.json();
    const serialized = JSON.stringify(body);
    assert.ok(
      !serialized.includes('CONFIDENTIAL_SIBLING_QUIZ_99') && !serialized.includes('Secret Course'),
      'Must NEVER return another child report from guardian.reports[length - 1]'
    );
  } finally {
    Guardian.findOne = origGuardianFindOne;
  }
});

// ============================================================================
// 11. V3-HIGH-14: Sole Active Admin Cannot Self-Deactivate via /api/auth/privacy/delete-request
// ============================================================================
test('V3-HIGH-14: POST /api/auth/privacy/delete-request refuses immediate deactivation of the last active admin', async () => {
  resetUsers();
  const adminToken = generateAccessToken(userStore.get(ids.admin));
  const res = await fetch(`${baseUrl}/api/auth/privacy/delete-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      Origin: 'http://localhost:5173',
    },
    body: JSON.stringify({
      reason: 'Testing accidental lockout',
      deactivateImmediately: true,
    }),
  });

  assert.equal(res.status, 409, 'Last active admin must be prevented from self-deactivation');
  assert.equal(userStore.get(ids.admin).isActive, true);
});

// ============================================================================
// 12. V3-HIGH-15: Empty Assignment Submission Rejected & Quiz my-attempts Respects showResults
// ============================================================================
test('V3-HIGH-15a: POST /api/assignments/:id/submit rejects empty {} payload', async () => {
  resetUsers();
  const origAssignFindById = Assignment.findById;
  const origEnrollFindOne = Enrollment.findOne;
  const origSubCount = AssignmentSubmission.countDocuments;
  const origSubCreate = AssignmentSubmission.create;
  const origSubFind = AssignmentSubmission.find;
  const origSubFindOne = AssignmentSubmission.findOne;

  try {
    Assignment.findById = () => chainableQuery({
      _id: ids.assignment,
      course: ids.course,
      status: 'published',
      submissionTypes: ['text', 'file'],
      settings: { allowLateSubmission: true, maxAttempts: 3 },
      stats: { submissions: 0 },
      async save() { return this; },
    });
    Enrollment.findOne = () => chainableQuery({ _id: oid(), status: 'active' });
    AssignmentSubmission.countDocuments = async () => 0;
    AssignmentSubmission.find = () => chainableQuery([]);
    AssignmentSubmission.findOne = () => chainableQuery(null);
    AssignmentSubmission.create = async (data) => ({ _id: oid(), ...data });

    const studentToken = generateAccessToken(userStore.get(ids.adultStudent));
    const res = await fetch(`${baseUrl}/api/assignments/${ids.assignment}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400, 'Empty assignment submission payload must be rejected with 400');
  } finally {
    Assignment.findById = origAssignFindById;
    Enrollment.findOne = origEnrollFindOne;
    AssignmentSubmission.countDocuments = origSubCount;
    AssignmentSubmission.create = origSubCreate;
    AssignmentSubmission.find = origSubFind;
    AssignmentSubmission.findOne = origSubFindOne;
  }
});

test('V3-HIGH-15b: GET /api/quizzes/my-attempts/list hides answers and score when quiz.settings.showResults is "manual"', async () => {
  resetUsers();
  const origAttemptFind = QuizAttempt.find;

  try {
    const attemptDoc = {
      _id: oid(),
      student: ids.adultStudent,
      score: 50,
      percentage: 50,
      isPassed: false,
      answers: [{ questionIndex: 0, selectedOption: 1, isCorrect: true, pointsEarned: 10 }],
      quiz: {
        _id: ids.quiz,
        title: { ar: 'اختبار التجويد' },
        settings: { showResults: 'manual', showCorrectAnswers: false },
      },
      toObject() {
        const copy = { ...this };
        delete copy.toObject;
        return copy;
      },
    };
    QuizAttempt.find = () => chainableQuery([attemptDoc]);

    const studentToken = generateAccessToken(userStore.get(ids.adultStudent));
    const res = await fetch(`${baseUrl}/api/quizzes/my-attempts/list`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    const list = await res.json();
    assert.equal(Array.isArray(list), true);
    assert.equal(list[0].answers?.[0]?.isCorrect, undefined, 'Per-question isCorrect must not leak when showResults is manual');
    assert.equal(list[0].score, undefined, 'Score must not leak when showResults is manual');
  } finally {
    QuizAttempt.find = origAttemptFind;
  }
});

// ============================================================================
// 13. V3-HIGH-06b: Refresh Token JTI Rotation & Concurrent Replay Theft Detection
// ============================================================================
test('V3-HIGH-06b: concurrent /api/auth/refresh with same refresh JTI rotates once and revokes session family on replay', async () => {
  resetUsers();
  const initialRefresh = generateRefreshToken(userStore.get(ids.adultStudent));

  const first = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `wn_refresh=${encodeURIComponent(initialRefresh)}`,
      Origin: 'http://localhost:5173',
    },
  });
  assert.equal(first.status, 200, 'First refresh with valid JTI must succeed');

  // Replaying the already-rotated refresh token concurrently must fail and trigger reuse revocation!
  const replays = await Promise.all([1, 2, 3].map(() => fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `wn_refresh=${encodeURIComponent(initialRefresh)}`,
      Origin: 'http://localhost:5173',
    },
  })));
  for (const r of replays) {
    assert.equal(r.status, 401, 'Replayed refresh token JTI must be rejected with 401');
  }
  assert.ok(
    Number(userStore.get(ids.adultStudent).refreshTokenVersion || 0) >= 1,
    'Refresh token reuse detection must increment refreshTokenVersion to revoke stolen token family'
  );
});
