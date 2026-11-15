'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/wahy_round4_unit';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id-v4.apps.googleusercontent.com';

const mongoose = require('mongoose');

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const GuardianInvitation = require('../models/GuardianInvitation');
const StudentSubscription = require('../models/StudentSubscription');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const { Quiz, QuizAttempt } = require('../models/Quiz');
const TeacherLedger = require('../models/TeacherLedger');
const WithdrawRequest = require('../models/WithdrawRequest');
const GroupCircle = require('../models/GroupCircle');
const Notification = require('../models/Notification');

const googleIdentity = require('../services/googleIdentity');
const objectStorage = require('../services/objectStorage');
const meetingService = require('../services/meetingService');
const { calculateTeacherBalance, processTeacherPayout } = require('../services/teacherFinance');
const { applyPaymobTransaction } = require('../services/paymentSettlement');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
const { inspectChatSafety } = require('../utils/chatSafety');
const { normalizePhone } = require('../utils/phone');
const { getConfigurationReadiness } = require('../config/readiness');
const {
  generateAccessToken,
  generateRefreshToken,
  getAccessSecret,
} = require('../middleware/auth');
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
  teacherUser: oid(),
  teacherProfile: oid(),
  suspendedTeacherUser: oid(),
  suspendedTeacherProfile: oid(),
  minorStudent: oid(),
  preOnboardStudent: oid(),
  adultStudent: oid(),
  guardianUser: oid(),
  course: oid(),
  quiz: oid(),
  circle: oid(),
  session: oid(),
};

const userStore = new Map();

function resetUsers() {
  userStore.clear();
  userStore.set(ids.admin, {
    _id: ids.admin,
    id: ids.admin,
    name: 'Platform Admin',
    email: 'admin-v4@wahy.test',
    role: 'admin',
    isActive: true,
    emailVerified: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.teacherUser, {
    _id: ids.teacherUser,
    id: ids.teacherUser,
    name: 'Approved Teacher',
    email: 'teacher-v4@wahy.test',
    role: 'teacher',
    gender: 'male',
    age: 34,
    isActive: true,
    emailVerified: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.suspendedTeacherUser, {
    _id: ids.suspendedTeacherUser,
    id: ids.suspendedTeacherUser,
    name: 'Suspended Teacher',
    email: 'suspended.teacher@gmail.com',
    role: 'teacher',
    gender: 'male',
    age: 36,
    isActive: true,
    emailVerified: false,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.minorStudent, {
    _id: ids.minorStudent,
    id: ids.minorStudent,
    name: 'Linked Minor Student',
    email: 'linked.minor@gmail.com',
    phone: '01012345678',
    phoneNormalized: '+201012345678',
    role: 'student',
    gender: 'female',
    age: 11,
    guardian: ids.guardianUser,
    guardianContact: { name: 'Parent', phone: '+201055555555', relationship: 'mother' },
    enrollmentSection: 'ladies',
    isActive: true,
    emailVerified: false,
    onboarding: { required: true, completed: true, trackSelected: true },
    refreshTokenVersion: 0,
  });
  userStore.set(ids.preOnboardStudent, {
    _id: ids.preOnboardStudent,
    id: ids.preOnboardStudent,
    name: 'PreOnboard Student',
    email: 'preonboard@gmail.com',
    role: 'student',
    age: undefined,
    gender: undefined,
    guardianLinkCode: 'PREONB99',
    isActive: true,
    emailVerified: true,
    onboarding: { required: true, completed: false },
    refreshTokenVersion: 0,
  });
  userStore.set(ids.adultStudent, {
    _id: ids.adultStudent,
    id: ids.adultStudent,
    name: 'Adult Student',
    email: 'adult-v4@wahy.test',
    phone: '01087654321',
    phoneNormalized: '+201087654321',
    role: 'student',
    gender: 'male',
    age: 24,
    enrollmentSection: 'men_children',
    isActive: true,
    emailVerified: true,
    failedLoginAttempts: 0,
    lockUntil: null,
    onboarding: { required: false, completed: true, trackSelected: true },
    refreshTokenVersion: 0,
    async comparePassword(candidate) {
      return candidate === 'CorrectPassword123!';
    },
  });
  userStore.set(ids.guardianUser, {
    _id: ids.guardianUser,
    id: ids.guardianUser,
    name: 'Guardian User',
    email: 'guardian-v4@wahy.test',
    phone: '01055555555',
    phoneNormalized: '+201055555555',
    role: 'guardian',
    children: [ids.minorStudent],
    isActive: true,
    emailVerified: false,
    refreshTokenVersion: 0,
  });
}

resetUsers();

function makeMutableUserDoc(raw) {
  if (!raw) return null;
  const doc = {
    ...raw,
    set(p, val) {
      const parts = String(p).split('.');
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
      userStore.set(String(this._id), { ...userStore.get(String(this._id)), ...this.toObject() });
      return this;
    },
  };
  return doc;
}

User.findById = (id) => chainableQuery(makeMutableUserDoc(userStore.get(String(id)) || null));
User.findOne = (filter = {}) => {
  for (const raw of userStore.values()) {
    let ok = true;
    if (filter.googleSubject && raw.googleSubject !== filter.googleSubject) ok = false;
    if (filter.email && raw.email !== filter.email) ok = false;
    if (filter.role && raw.role !== filter.role) ok = false;
    if (filter._id && String(raw._id) !== String(filter._id)) ok = false;
    if (ok) return chainableQuery(makeMutableUserDoc(raw));
  }
  return chainableQuery(null);
};
User.findByIdAndUpdate = (id, update = {}) => {
  const existing = userStore.get(String(id));
  if (!existing) return chainableQuery(null);
  const next = { ...existing };
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      next[k] = Number(next[k] || 0) + Number(v);
    }
  }
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      next[k] = v;
    }
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) {
      delete next[k];
    }
  }
  userStore.set(String(id), next);
  return chainableQuery(makeMutableUserDoc(next));
};
User.findOneAndUpdate = (filter = {}, update = {}) => {
  for (const [id, raw] of userStore.entries()) {
    if (filter._id && String(raw._id) !== String(filter._id)) continue;
    if (filter.role && raw.role !== filter.role) continue;
    if (filter.guardianLinkCode && raw.guardianLinkCode !== filter.guardianLinkCode) continue;
    if (filter.age?.$gte !== undefined && !(Number(raw.age) >= filter.age.$gte)) continue;
    if (Array.isArray(filter.$nor)) {
      const violated = filter.$nor.some((cond) => {
        if (cond.age?.$gt !== undefined && cond.age?.$lt !== undefined) {
          return Number(raw.age) > cond.age.$gt && Number(raw.age) < cond.age.$lt;
        }
        return false;
      });
      if (violated) continue;
    }
    if (filter.refreshTokenVersion !== undefined && Number(raw.refreshTokenVersion || 0) !== Number(filter.refreshTokenVersion)) {
      continue;
    }
    if (filter.consumedRefreshJtis?.$ne !== undefined) {
      const list = Array.isArray(raw.consumedRefreshJtis) ? raw.consumedRefreshJtis : [];
      if (list.includes(filter.consumedRefreshJtis.$ne)) continue;
    }
    const next = { ...raw };
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        next[k] = Number(next[k] || 0) + Number(v);
      }
    }
    if (update.$push?.consumedRefreshJtis) {
      const prevList = Array.isArray(next.consumedRefreshJtis) ? [...next.consumedRefreshJtis] : [];
      const pushSpec = update.$push.consumedRefreshJtis;
      if (pushSpec && Array.isArray(pushSpec.$each)) {
        prevList.push(...pushSpec.$each);
        next.consumedRefreshJtis = typeof pushSpec.$slice === 'number' && pushSpec.$slice < 0
          ? prevList.slice(pushSpec.$slice)
          : prevList;
      } else {
        prevList.push(pushSpec);
        next.consumedRefreshJtis = prevList;
      }
    }
    if (update.$set) Object.assign(next, update.$set);
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) delete next[k];
    }
    userStore.set(id, next);
    return chainableQuery(makeMutableUserDoc(next));
  }
  return chainableQuery(null);
};

Teacher.findOne = (filter = {}) => {
  const userId = String(filter.user || '');
  const profileId = String(filter._id || '');
  if (userId === ids.teacherUser || profileId === ids.teacherProfile) {
    return chainableQuery({
      _id: ids.teacherProfile,
      user: ids.teacherUser,
      status: 'approved',
      isVerified: true,
      hourlyRate: 100,
      personalInfo: { fullName: 'Approved Teacher', gender: 'male' },
    });
  }
  if (userId === ids.suspendedTeacherUser || profileId === ids.suspendedTeacherProfile) {
    return chainableQuery({
      _id: ids.suspendedTeacherProfile,
      user: ids.suspendedTeacherUser,
      status: 'suspended',
      isVerified: false,
      hourlyRate: 100,
      personalInfo: { fullName: 'Suspended Teacher', gender: 'male' },
    });
  }
  return chainableQuery(null);
};

Notification.createAndSend = async () => ({ success: true });
Notification.countDocuments = async () => 0;
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
// 1. V4-CRIT-01: Purpose-Scoped JWTs Must Never Pass `protect` Without Account
// ============================================================================
test('V4-CRIT-01: teacher-email-verification JWT is rejected with 401 when sent as Authorization: Bearer', async () => {
  resetUsers();
  const verificationToken = jwt.sign(
    {
      email: 'disposable-attacker@example.test',
      purpose: 'teacher-email-verification',
      jti: crypto.randomUUID(),
    },
    getAccessSecret(),
    { expiresIn: '30m', algorithm: 'HS256' }
  );

  const res = await fetch(`${baseUrl}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${verificationToken}` },
  });

  assert.equal(res.status, 401, 'Purpose-scoped verification JWT must NEVER pass protect middleware');
});

// ============================================================================
// 2. V4-CRIT-02: Google OAuth Must Not Wipe Linked Minor Demographics or Downgrade Teachers
// ============================================================================
test('V4-CRIT-02: POST /api/auth/google blocks suspended teacher role downgrade and preserves linked minor guardian & demographics', async () => {
  resetUsers();
  const origVerify = googleIdentity.verifyGoogleCredential;

  try {
    // Part A: Suspended teacher attempting Google sign-in as student
    googleIdentity.verifyGoogleCredential = async () => ({
      sub: 'google-sub-suspended-teacher',
      email: 'suspended.teacher@gmail.com',
      emailVerified: true,
      name: 'Suspended Teacher',
      picture: '',
    });

    const teacherRes = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ credential: 'mock-cred', role: 'student' }),
    });

    assert.ok([403, 409].includes(teacherRes.status), 'Suspended teacher must be blocked on Google sign-in');
    assert.equal(
      userStore.get(ids.suspendedTeacherUser).role,
      'teacher',
      'Suspended teacher role must NEVER be overwritten to student'
    );

    // Part B: Minor student already linked to guardian attempting Google sign-in to wipe age/gender/guardian
    googleIdentity.verifyGoogleCredential = async () => ({
      sub: 'google-sub-minor-student',
      email: 'linked.minor@gmail.com',
      emailVerified: true,
      name: 'Minor Escape Attempt',
      picture: '',
    });

    const minorRes = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ credential: 'mock-cred', role: 'student' }),
    });

    assert.equal(minorRes.status, 409, 'Account with established guardian link must require password verification before Google linking');
    const savedMinor = userStore.get(ids.minorStudent);
    assert.equal(savedMinor.age, 11, 'Minor locked age must NOT be wiped');
    assert.equal(savedMinor.gender, 'female', 'Minor locked gender must NOT be wiped');
    assert.equal(savedMinor.guardian, ids.guardianUser, 'Accepted guardian link must NOT be detached');
  } finally {
    googleIdentity.verifyGoogleCredential = origVerify;
  }
});

// ============================================================================
// 3. V4-CRIT-03: GuardianInvitation 'student-onboarding' Enum & Pre-Onboarding LinkCode Gate
// ============================================================================
test('V4-CRIT-03: GuardianInvitation accepts source="student-onboarding" and pre-onboarding student (age=undefined) cannot be linked via linkCode', async () => {
  resetUsers();
  const invite = new GuardianInvitation({
    student: ids.minorStudent,
    guardianPhone: '+201055555555',
    guardianPhoneNormalized: '+201055555555',
    relationship: 'mother',
    linkCode: 'ONBOARD123',
    source: 'student-onboarding',
    expiresAt: new Date(Date.now() + 86400000),
  });
  await invite.validate();

  const origInviteFindOne = GuardianInvitation.findOne;
  const origGuardianFindOne = Guardian.findOne;
  try {
    GuardianInvitation.findOne = () => chainableQuery(null);
    Guardian.findOne = () => chainableQuery({
      _id: oid(),
      user: ids.guardianUser,
      children: [],
      async addChild() { return this; },
      async save() { return this; },
    });

    const guardianToken = generateAccessToken(userStore.get(ids.guardianUser));
    const res = await fetch(`${baseUrl}/api/guardian/link-child`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guardianToken}`,
      },
      body: JSON.stringify({ studentCode: 'PREONB99', relationship: 'father' }),
    });

    assert.notEqual(res.status, 201, 'Pre-onboarding student with undefined age must NOT be linkable via unverified adult linkCode');
  } finally {
    GuardianInvitation.findOne = origInviteFindOne;
    Guardian.findOne = origGuardianFindOne;
  }
});

// ============================================================================
// 4. V4-CRIT-04: /api/meetings Cannot Downgrade LiveKit Classrooms to Public Jitsi or Invent Random Zoom IDs
// ============================================================================
test('V4-CRIT-04: meetingService never fabricates public zoom.us/j/<random> or meet.jit.si rooms and teachers cannot downgrade LiveKit classrooms', async () => {
  resetUsers();
  const generated = meetingService.generateMeetingLink(ids.session, 'zoom');
  assert.ok(!String(generated.url || '').includes('zoom.us/j/'), 'Must never invent random real Zoom meeting IDs');
  assert.ok(!String(generated.url || '').includes('meet.jit.si'), 'Must never downgrade classrooms to unmoderated public Jitsi rooms');

  const origSessionFindById = Session.findById;
  try {
    const sessionDoc = {
      _id: ids.session,
      teacher: ids.teacherProfile,
      student: ids.minorStudent,
      status: 'accepted',
      scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
      duration: 60,
      meetingLink: `/live/session_${ids.session}`,
      meetingProvider: 'livekit',
      async save() { return this; },
    };
    Session.findById = () => chainableQuery(sessionDoc);

    const teacherToken = generateAccessToken(userStore.get(ids.teacherUser));
    const res = await fetch(`${baseUrl}/api/meetings/session/${ids.session}/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ provider: 'jitsi' }),
    });

    assert.ok(
      !String(sessionDoc.meetingLink || '').includes('meet.jit.si'),
      'Teacher must NOT be able to overwrite safeguarded LiveKit session with public Jitsi link'
    );
    assert.ok([403, 200].includes(res.status));
  } finally {
    Session.findById = origSessionFindById;
  }
});

// ============================================================================
// 5. V4-CRIT-05: Teacher Withdrawn Earnings Must Never Be Double-Deducted After Payout Processing
// ============================================================================
test('V4-CRIT-05: calculateTeacherBalance does not double-deduct withdrawnEarnings after processTeacherPayout', async () => {
  const origTeacherFindById = Teacher.findById;
  const origTeacherFindByIdAndUpdate = Teacher.findByIdAndUpdate;
  const origTeacherUpdateOne = Teacher.updateOne;
  const origLedgerFindById = TeacherLedger.findById;
  const origLedgerExists = TeacherLedger.exists;
  const origLedgerFindOneAndUpdate = TeacherLedger.findOneAndUpdate;
  const origLedgerAggregate = TeacherLedger.aggregate;
  const origWithdrawFind = WithdrawRequest.find;
  const origStartSession = mongoose.startSession;

  const ledgerRows = [];
  const teacherState = {
    _id: ids.teacherProfile,
    earnings: {
      totalEarned: 1000,
      pendingEarnings: 0,
      withdrawnEarnings: 0,
    },
  };

  try {
    Teacher.findById = () => chainableQuery({
      ...teacherState,
      earnings: { ...teacherState.earnings },
    });
    Teacher.findByIdAndUpdate = (_id, update) => {
      if (update?.$inc?.['earnings.withdrawnEarnings']) {
        teacherState.earnings.withdrawnEarnings += update.$inc['earnings.withdrawnEarnings'];
      }
      return chainableQuery({ ...teacherState, earnings: { ...teacherState.earnings } });
    };
    Teacher.updateOne = async (_filter, update) => {
      if (update?.$inc?.['earnings.withdrawnEarnings']) {
        teacherState.earnings.withdrawnEarnings += update.$inc['earnings.withdrawnEarnings'];
      }
      if (update?.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
          if (k === 'earnings.pendingEarnings') teacherState.earnings.pendingEarnings = v;
          if (k === 'earnings.ledgerMigratedAt') teacherState.earnings.ledgerMigratedAt = v;
        }
      }
      return { modifiedCount: 1 };
    };
    WithdrawRequest.find = () => chainableQuery([
      {
        _id: oid(),
        teacher: ids.teacherProfile,
        amount: 400,
        method: 'vodafone_cash',
        accountInfo: '01012345678',
        status: 'pending',
        async save() { return this; },
      },
    ]);
    TeacherLedger.findById = (id) => chainableQuery(
      ledgerRows.find((r) => String(r._id) === String(id)) || null
    );
    TeacherLedger.exists = async (filter = {}) => {
      const found = ledgerRows.some((row) => {
        if (filter.teacher && String(row.teacher) !== String(filter.teacher)) return false;
        if (filter.idempotencyKey?.$exists === false && row.idempotencyKey !== undefined) return false;
        if (filter.type?.$in && !filter.type.$in.includes(row.type)) return false;
        return true;
      });
      return found ? { _id: oid() } : null;
    };
    TeacherLedger.findOneAndUpdate = (filter = {}, update = {}, opts = {}) => {
      let existing = ledgerRows.find((row) => {
        if (filter._id && String(row._id) !== String(filter._id)) return false;
        if (filter.idempotencyKey && row.idempotencyKey !== filter.idempotencyKey) return false;
        if (filter.type && row.type !== filter.type) return false;
        if (filter.status?.$in && !filter.status.$in.includes(row.status)) return false;
        return true;
      });
      if (!existing && opts.upsert) {
        existing = { _id: oid(), ...(update.$setOnInsert || {}), ...(update.$set || {}) };
        ledgerRows.push(existing);
        return chainableQuery(existing);
      }
      if (existing && update.$set) {
        Object.assign(existing, update.$set);
      }
      return chainableQuery(existing || null);
    };
    TeacherLedger.aggregate = (pipeline = []) => {
      const group = new Map();
      for (const row of ledgerRows) {
        if (row.status === 'cancelled' || row.status === 'rejected') continue;
        const key = `${row.currency || 'EGP'}:${row.type}:${row.status}`;
        const prev = group.get(key) || {
          _id: { currency: row.currency || 'EGP', type: row.type, status: row.status },
          totalMinor: 0,
          count: 0,
        };
        prev.totalMinor += Math.round(Number(row.amount || 0) * 100);
        prev.count += 1;
        group.set(key, prev);
      }
      const arr = [...group.values()];
      arr.session = () => Promise.resolve(arr);
      return arr;
    };
    mongoose.startSession = async () => ({
      async withTransaction(fn) { return fn(); },
      async endSession() {},
    });

    // Step 1: Initial balance calculation migrates 1000 earned + 400 pending withdraw => available 600
    const beforePayout = await calculateTeacherBalance(ids.teacherProfile);
    assert.equal(beforePayout.EGP.available, 600);

    // Step 2: Admin processes the 400 EGP pending payout to completed
    const pendingRow = ledgerRows.find((r) => r.type === 'payout' && r.status === 'pending');
    assert.ok(pendingRow, 'Migrated pending withdrawal must exist');
    await processTeacherPayout({
      payoutId: pendingRow._id,
      targetStatus: 'completed',
      adminUserId: ids.admin,
      referenceNumber: 'TX-400',
    });

    // Step 3: Subsequent balance check MUST still show available = 600, withdrawn = 400 (NOT 200 / 800!)
    const afterPayout = await calculateTeacherBalance(ids.teacherProfile);
    assert.equal(afterPayout.EGP.withdrawn, 400, 'Withdrawn total must be 400, NOT double-counted as 800');
    assert.equal(afterPayout.EGP.available, 600, 'Available balance must remain 600, NOT drop to 200');
  } finally {
    Teacher.findById = origTeacherFindById;
    Teacher.findByIdAndUpdate = origTeacherFindByIdAndUpdate;
    Teacher.updateOne = origTeacherUpdateOne;
    TeacherLedger.findById = origLedgerFindById;
    TeacherLedger.exists = origLedgerExists;
    TeacherLedger.findOneAndUpdate = origLedgerFindOneAndUpdate;
    TeacherLedger.aggregate = origLedgerAggregate;
    WithdrawRequest.find = origWithdrawFind;
    mongoose.startSession = origStartSession;
  }
});

// ============================================================================
// 6. V4-CRIT-06 & V4-HIGH-10: Paymob Failed->Succeeded Card Retry & Partial Refund Preservation
// ============================================================================
test('V4-CRIT-06 & V4-HIGH-10: Paymob allows failed->succeeded card retry and partial refunds do not revoke active course access', async () => {
  const origEnrollmentFindOne = Enrollment.findOne;
  const origEnrollmentCreate = Enrollment.create;
  const origProgressUpdateOne = Progress.updateOne;
  const origCourseUpdateOne = Course.updateOne;
  const origCertUpdateMany = Certificate.updateMany;

  let activeEnrollment = null;
  let certRevokedCount = 0;

  try {
    Enrollment.findOne = () => chainableQuery(activeEnrollment);
    Enrollment.create = async (docs) => {
      const item = Array.isArray(docs) ? docs[0] : docs;
      activeEnrollment = {
        ...item,
        status: 'active',
        payment: { ...(item.payment || {}), status: 'completed' },
        async save() { return this; },
      };
      return Array.isArray(docs) ? [activeEnrollment] : activeEnrollment;
    };
    Progress.updateOne = async () => ({ modifiedCount: 1 });
    Course.updateOne = async () => ({ modifiedCount: 1 });
    Certificate.updateMany = async () => {
      certRevokedCount += 1;
      return { modifiedCount: 1 };
    };

    const payment = {
      _id: oid(),
      kind: 'course_enrollment',
      provider: 'paymob',
      student: ids.adultStudent,
      course: ids.course,
      amountMinor: 10000,
      refundedAmountMinor: 0,
      currency: 'EGP',
      status: 'created',
      async save() { return this; },
    };

    // 1) First card declines -> failed
    await applyPaymobTransaction({
      payment,
      classification: 'failed',
      transactionId: 'tx-decline-1',
      amountMinor: 10000,
    });
    assert.equal(payment.status, 'failed');

    // 2) Second card on same checkout intention succeeds -> MUST settle & create enrollment!
    const retryResult = await applyPaymobTransaction({
      payment,
      classification: 'succeeded',
      transactionId: 'tx-success-2',
      amountMinor: 10000,
    });
    assert.equal(payment.status, 'succeeded', 'Second card success after initial decline must settle payment');
    assert.equal(retryResult.enrollmentCreated, true);
    assert.equal(activeEnrollment.status, 'active');

    // 3) Partial refund (3000 of 10000) MUST NOT cancel enrollment or revoke certificate!
    await applyPaymobTransaction({
      payment,
      classification: 'refunded',
      transactionId: 'tx-partial-refund-3',
      amountMinor: 3000,
    });
    assert.equal(activeEnrollment.status, 'active', 'Partial refund must NOT cancel active course enrollment');
    assert.equal(certRevokedCount, 0, 'Partial refund must NOT revoke earned certificate');

    // 4) Remaining refund (7000 of 10000 -> total 10000) cancels enrollment and revokes certificate!
    await applyPaymobTransaction({
      payment,
      classification: 'refunded',
      transactionId: 'tx-final-refund-4',
      amountMinor: 7000,
    });
    assert.equal(payment.status, 'refunded');
    assert.equal(activeEnrollment.status, 'cancelled');
    assert.equal(certRevokedCount, 1);
  } finally {
    Enrollment.findOne = origEnrollmentFindOne;
    Enrollment.create = origEnrollmentCreate;
    Progress.updateOne = origProgressUpdateOne;
    Course.updateOne = origCourseUpdateOne;
    Certificate.updateMany = origCertUpdateMany;
  }
});

// ============================================================================
// 7. V4-CRIT-07: Safeguarding Fails Closed Even When onboarding.required === false & Admin Circle Add Requires Paid Subscription
// ============================================================================
test('V4-CRIT-07: safeguarding rejects unset gender/age regardless of onboarding.required and admin circle add refuses unpaid phantom subscriptions', async () => {
  assert.throws(
    () => assertGenderAndAgeCompatibility({
      student: { _id: oid(), onboarding: { required: false } },
      teacher: { personalInfo: { gender: 'male' } },
    }),
    (err) => err?.code === 'PROFILE_DEMOGRAPHICS_REQUIRED',
    'Missing student gender/age must NEVER fail open even when onboarding.required === false'
  );

  resetUsers();
  const origCircleFindById = GroupCircle.findById;
  const origSubFindOne = StudentSubscription.findOne;
  const origStartSession = mongoose.startSession;

  try {
    GroupCircle.findById = () => chainableQuery({
      _id: ids.circle,
      name: 'Men Circle',
      gender: 'men',
      targetAgeGroup: 'adults',
      subscriptionSection: 'men_children',
      subscriptionPlanKey: 'group',
      teacher: { _id: ids.teacherProfile, personalInfo: { gender: 'male' } },
      students: [],
      capacity: 6,
      status: 'forming',
      async save() { return this; },
    });
    StudentSubscription.findOne = () => chainableQuery(null);
    mongoose.startSession = async () => ({
      async withTransaction(fn) { return fn(); },
      async endSession() {},
    });

    const adminToken = generateAccessToken(userStore.get(ids.admin));
    const res = await fetch(`${baseUrl}/api/subscriptions/admin/circles/${ids.circle}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ studentId: ids.adultStudent, sessionCount: 8 }),
    });

    assert.equal(res.status, 409, 'Admin circle add without paid subscription or explicit scholarship flag must reject with 409');
  } finally {
    GroupCircle.findById = origCircleFindById;
    StudentSubscription.findOne = origSubFindOne;
    mongoose.startSession = origStartSession;
  }
});

// ============================================================================
// 8. V4-HIGH-01: 30 Refresh Rotations Must Not Evict Stolen Refresh JTI
// ============================================================================
test('V4-HIGH-01: rotating refresh token 30 times does NOT evict stolen initial JTI from reuse detection', async () => {
  resetUsers();
  const origNativeMarker = User.findOneAndUpdate;
  // Simulate native Mongoose path by aligning reference temporarily
  const origModelRef = mongoose.Model.findOneAndUpdate;
  mongoose.Model.findOneAndUpdate = origNativeMarker;

  try {
    const stolenToken = generateRefreshToken(userStore.get(ids.adultStudent));
    let currentCookie = `wn_refresh=${encodeURIComponent(stolenToken)}`;

    for (let i = 0; i < 30; i += 1) {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Cookie: currentCookie,
          Origin: 'http://localhost:5173',
        },
      });
      assert.equal(res.status, 200, `Rotation #${i + 1} must succeed`);
      const setCookie = res.headers.get('set-cookie') || '';
      const match = setCookie.match(/wn_refresh=([^;]+)/);
      assert.ok(match, 'Refresh response must rotate cookie');
      currentCookie = `wn_refresh=${match[1]}`;
    }

    // Replaying the initial token after 30 legitimate refreshes MUST still trigger theft revocation!
    const replay = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `wn_refresh=${encodeURIComponent(stolenToken)}`,
        Origin: 'http://localhost:5173',
      },
    });
    assert.equal(replay.status, 401, 'Stolen JTI must still be rejected after 30 rotations');
    assert.ok(
      Number(userStore.get(ids.adultStudent).refreshTokenVersion || 0) >= 1,
      'Session family must be revoked on delayed JTI replay'
    );
  } finally {
    mongoose.Model.findOneAndUpdate = origModelRef;
  }
});

// ============================================================================
// 9. V4-HIGH-02 & V4-HIGH-03: vercel.json Preserves Upload CSP Sandbox & assertUploadPath Blocks '..'
// ============================================================================
test('V4-HIGH-02 & V4-HIGH-03: vercel.json excludes /api/ and /uploads/ from SPA CSP overwrite and assertUploadPath blocks traversal', () => {
  const vercelJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  const spaCspRule = (vercelJson.headers || []).find((rule) =>
    (rule.headers || []).some((h) => h.key === 'Content-Security-Policy' && String(h.value).includes("script-src 'self'"))
  );
  assert.ok(spaCspRule, 'SPA CSP rule must exist in vercel.json');
  assert.notEqual(
    spaCspRule.source,
    '/(.*)',
    'SPA CSP header must NOT match /(.*) and overwrite /api/uploads/public sandbox CSP'
  );

  assert.throws(
    () => objectStorage.assertUploadPath(`uploads/teacher-public/${ids.teacherUser}/../other/evil.png`, 'teacher-public', ids.teacherUser),
    'assertUploadPath must reject path traversal segments (..)'
  );
});

// ============================================================================
// 10. V4-HIGH-05: Production Readiness & Cron Reject Weak Placeholder CRON_SECRET
// ============================================================================
test('V4-HIGH-05: production readiness and /api/cron/reminders reject placeholder CRON_SECRET from .env.example', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevCron = process.env.CRON_SECRET;
  const prevVercel = process.env.VERCEL;
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';
  process.env.CRON_SECRET = 'change-me-production-cron-secret';

  try {
    const readiness = getConfigurationReadiness();
    assert.equal(readiness.schedulerConfigured, false, 'Weak placeholder CRON_SECRET must NOT count as configured in production');

    const res = await fetch(`${baseUrl}/api/cron/reminders`, {
      headers: { Authorization: 'Bearer change-me-production-cron-secret' },
    });
    assert.notEqual(res.status, 200, 'Cron endpoint must reject weak placeholder CRON_SECRET in production');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prevCron;
    if (prevVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevVercel;
  }
});

// ============================================================================
// 11. V4-HIGH-07 & V4-HIGH-08: Atomic Password Change Lockout & Phone Normalization Edge Cases
// ============================================================================
test('V4-HIGH-07 & V4-HIGH-08: concurrent /change-password failures atomically lock account and normalizePhone canonicalizes +2001... & bare international numbers', async () => {
  assert.equal(normalizePhone('+2001012345678'), '+201012345678');
  assert.equal(normalizePhone('002001012345678'), '+201012345678');
  assert.equal(normalizePhone('966501234567'), '+966501234567');

  resetUsers();
  const token = generateAccessToken(userStore.get(ids.adultStudent));
  await Promise.all(
    Array.from({ length: 6 }, () => fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword999!',
        newPassword: 'NewValidPassword123!',
      }),
    }))
  );

  const updatedUser = userStore.get(ids.adultStudent);
  assert.ok(Number(updatedUser.failedLoginAttempts || 0) >= 5, 'Concurrent wrong passwords must atomically accumulate >= 5 attempts');
  assert.ok(Boolean(updatedUser.lockUntil), 'Account must be locked after 5 concurrent failed password-change attempts');
});

// ============================================================================
// 12. V4-HIGH-12 & V4-HIGH-13: Teacher Cannot Zero Published Course Price & Unstarted Quiz Hides Questions
// ============================================================================
test('V4-HIGH-12 & V4-HIGH-13: teacher cannot mutate published course price to 0 and GET /api/quizzes/:id hides questions before attempt start', async () => {
  resetUsers();
  const origCourseFindById = Course.findById;
  const origCourseFindByIdAndUpdate = Course.findByIdAndUpdate;
  const origQuizFindById = Quiz.findById;
  const origAttemptFind = QuizAttempt.find;
  const origEnrollFindOne = Enrollment.findOne;

  try {
    Course.findById = () => chainableQuery({
      _id: ids.course,
      instructor: ids.teacherProfile,
      status: 'published',
      price: 600,
      async save() { return this; },
    });
    Course.findByIdAndUpdate = (_id, update) => chainableQuery({
      _id: ids.course,
      instructor: ids.teacherProfile,
      status: 'published',
      price: update?.price ?? 600,
    });

    const teacherToken = generateAccessToken(userStore.get(ids.teacherUser));
    const priceRes = await fetch(`${baseUrl}/api/courses/${ids.course}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ price: 0 }),
    });
    assert.equal(priceRes.status, 403, 'Instructor must NOT be allowed to set price=0 on a published paid course');

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const quizObj = {
      _id: ids.quiz,
      course: { _id: ids.course, title: 'Tajweed', instructor: ids.teacherUser },
      lesson: null,
      status: 'published',
      availableFrom: futureDate,
      settings: { timeLimit: 15, maxAttempts: 1, showCorrectAnswers: false },
      questions: [
        { question: { ar: 'سؤال سري قبل موعد الاختبار' }, options: [{ text: 'أ', isCorrect: true }] },
      ],
      isAvailableNow() { return false; },
      toObject() {
        const copy = { ...this };
        delete copy.toObject;
        delete copy.isAvailableNow;
        return copy;
      },
    };
    Quiz.findById = () => chainableQuery(quizObj);
    QuizAttempt.find = () => chainableQuery([]);
    Enrollment.findOne = () => chainableQuery({ _id: oid(), status: 'active' });

    const studentToken = generateAccessToken(userStore.get(ids.adultStudent));
    const quizRes = await fetch(`${baseUrl}/api/quizzes/${ids.quiz}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(quizRes.status, 200);
    const quizBody = await quizRes.json();
    assert.equal(
      Array.isArray(quizBody.questions) ? quizBody.questions.length : 0,
      0,
      'Unstarted / future-scheduled quiz must NOT leak questions array to student'
    );
  } finally {
    Course.findById = origCourseFindById;
    Course.findByIdAndUpdate = origCourseFindByIdAndUpdate;
    Quiz.findById = origQuizFindById;
    QuizAttempt.find = origAttemptFind;
    Enrollment.findOne = origEnrollFindOne;
  }
});

// ============================================================================
// 13. V4-HIGH-14 & V4-HIGH-17: Fullwidth Unicode Chat Safety & Clarity Privacy Exclusion
// ============================================================================
test('V4-HIGH-14 & V4-HIGH-17: inspectChatSafety catches NFKC fullwidth digits/domains and analytics blocks Clarity on private/minor/KYC routes', async () => {
  assert.equal(inspectChatSafety('رقمي ０１０１２３４５６７８').isSafe, false, 'Fullwidth digits must be caught');
  assert.equal(inspectChatSafety('تواصل عبر ｗａ．ｍｅ/201012345678').isSafe, false, 'Fullwidth domain must be caught');
  assert.equal(inspectChatSafety('راسلني user＠gmail．com').isSafe, false, 'Fullwidth email must be caught');

  const analyticsSrc = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'utils', 'analytics.js'), 'utf8');
  assert.match(
    analyticsSrc,
    /admin[\s\S]*student[\s\S]*teacher[\s\S]*guardian[\s\S]*live|isPublicMarketingPath/i,
    'Microsoft Clarity must be blocked across admin KYC, payment, teacher OTP, and minor classroom routes'
  );

  const origSessionFind = Session.find;
  try {
    Session.find = () => chainableQuery([
      {
        _id: ids.session,
        type: 'trial',
        status: 'completed',
        scheduledAt: new Date(),
        duration: 60,
        timezone: 'Africa/Cairo',
        agreedHourlyRate: 90,
        earnings: { amount: 90, status: 'pending' },
        teacherEvaluation: {
          attendance: 5,
          memorization: 4,
          tajweed: 5,
          behavior: 5,
          commitment: 5,
          surahRecited: 'سورة الفاتحة',
          overallNotes: 'تقرير Playwright آلي للتحقق من دورة الحصة',
        },
        studentReports: [
          { student: ids.adultStudent, notes: 'تقرير Playwright آلي للتحقق من دورة الحصة' },
          { student: ids.minorStudent, notes: 'تقرير طالب آخر سري' },
        ],
        teacher: {
          _id: ids.teacherProfile,
          personalInfo: { fullName: 'Approved Teacher', gender: 'male' },
          user: { _id: ids.teacherUser, name: 'Approved Teacher' },
        },
      },
    ]);
    const studentToken = generateAccessToken(userStore.get(ids.adultStudent));
    const evalRes = await fetch(`${baseUrl}/api/students/dashboard/evaluations`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(evalRes.status, 200);
    const evalBody = await evalRes.json();
    assert.equal(evalBody.evaluations.length, 1);
    const evDoc = evalBody.evaluations[0];
    assert.equal(evDoc.earnings, undefined, 'Teacher earnings must be stripped from student evaluations DTO');
    assert.equal(evDoc.agreedHourlyRate, undefined, 'agreedHourlyRate must be stripped from student evaluations DTO');
    assert.equal(evDoc.teacherEvaluation.overallNotes, 'تقرير Playwright آلي للتحقق من دورة الحصة');
    assert.equal(evDoc.teacherEvaluation.attendance, 5);
    assert.equal(evDoc.studentReports.length, 1, 'Only caller own report may be returned');
    assert.equal(String(evDoc.studentReports[0].student), String(ids.adultStudent));
  } finally {
    Session.find = origSessionFind;
  }
});
