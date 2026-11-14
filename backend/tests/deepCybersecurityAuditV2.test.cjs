'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';

const mongoose = require('mongoose');

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const GuardianInvitation = require('../models/GuardianInvitation');
const StudentSubscription = require('../models/StudentSubscription');
const TrialRequest = require('../models/TrialRequest');
const GroupCircle = require('../models/GroupCircle');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { Quiz, QuizAttempt } = require('../models/Quiz');
const VerificationCode = require('../models/VerificationCode');
const VideoAsset = require('../models/VideoAsset');
const Notification = require('../models/Notification');
const googleIdentity = require('../services/googleIdentity');
const { generateAccessToken } = require('../middleware/auth');
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
  student: oid(),
  guardian1: oid(),
  guardian2: oid(),
  course: oid(),
  quizLesson: oid(),
  foreignLesson: oid(),
  quiz: oid(),
  trial: oid(),
  circle: oid(),
};

const userStore = new Map();

function seedUsers() {
  userStore.clear();
  userStore.set(ids.admin, {
    _id: ids.admin,
    id: ids.admin,
    name: 'Security Admin',
    email: 'sec-admin@wahy.test',
    role: 'admin',
    isActive: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.teacherUser, {
    _id: ids.teacherUser,
    id: ids.teacherUser,
    name: 'Approved Teacher',
    email: 'sec-teacher@wahy.test',
    role: 'teacher',
    isActive: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.student, {
    _id: ids.student,
    id: ids.student,
    name: 'Security Student',
    email: 'sec-student@wahy.test',
    phone: '01000000000',
    phoneNormalized: '+20100000000',
    role: 'student',
    isActive: true,
    age: 22,
    gender: 'male',
    enrollmentSection: 'men',
    preferredTrack: 'memorization',
    guardianLinkCode: 'WN-ABCDEF12',
    onboarding: { required: false, completed: true, trackSelected: true },
    refreshTokenVersion: 0,
  });
  userStore.set(ids.guardian1, {
    _id: ids.guardian1,
    id: ids.guardian1,
    name: 'Guardian One',
    email: 'guardian1@wahy.test',
    phone: '01011111111',
    phoneNormalized: '+201011111111',
    role: 'guardian',
    isActive: true,
    refreshTokenVersion: 0,
  });
  userStore.set(ids.guardian2, {
    _id: ids.guardian2,
    id: ids.guardian2,
    name: 'Guardian Two',
    email: 'guardian2@wahy.test',
    phone: '01022222222',
    phoneNormalized: '+201022222222',
    role: 'guardian',
    isActive: true,
    refreshTokenVersion: 0,
  });
}

seedUsers();

User.findById = (id) => {
  const doc = userStore.get(String(id)) || null;
  if (!doc) return chainableQuery(null);
  return chainableQuery({
    ...doc,
    async save() {
      userStore.set(String(doc._id), { ...doc, ...this });
      return this;
    },
  });
};

Notification.createAndSend = async () => ({ success: true });

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function apiJson(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

test('CRIT-01: GET /api/women/teachers strips KYC documents, earnings, reviewNotes, and PII while capping limit <= 50', async () => {
  const sensitiveTeacher = {
    _id: ids.teacherProfile,
    status: 'approved',
    isVerified: true,
    user: {
      _id: ids.teacherUser,
      name: 'Ustadha Fatima',
      email: 'private-teacher@wahy.test',
      phone: '+201099999999',
      avatar: '/avatar.jpg',
      bio: 'Certified Tajweed Tutor',
    },
    personalInfo: {
      fullName: 'Ustadha Fatima',
      gender: 'female',
      country: 'EG',
      city: 'Cairo',
      phone: '+201099999999',
      whatsapp: '+201099999999',
      address: '12 Private Street, Cairo',
    },
    documents: {
      idCardFront: 'private/teachers/id-front.pdf',
      ijazat: ['private/teachers/ijazah-1.pdf'],
    },
    earnings: { total: 45000, pending: 2500, withdrawn: 42500 },
    reviewNotes: [{ note: 'Internal admin KYC note', reviewer: ids.admin }],
    reviewChecklist: { identityApproved: true },
    media: {
      profilePhoto: '/uploads/teachers/public/photo.jpg',
      introductionVideo: '/uploads/teachers/public/intro.mp4',
    },
  };

  Teacher.find = () => chainableQuery([sensitiveTeacher]);
  Teacher.countDocuments = async () => 1;

  const { status, data } = await apiJson('GET', '/api/women/teachers?limit=999');
  assert.equal(status, 200);
  assert.equal(data.pagination.limit, 50, 'limit must be capped at 50');
  assert.equal(data.teachers.length, 1);

  const exposed = data.teachers[0];
  assert.equal(exposed.documents, undefined, 'KYC documents must never leak');
  assert.equal(exposed.earnings, undefined, 'Teacher earnings must never leak');
  assert.equal(exposed.reviewNotes, undefined, 'Admin reviewNotes must never leak');
  assert.equal(exposed.reviewChecklist, undefined, 'Admin reviewChecklist must never leak');
  assert.equal(exposed.personalInfo?.phone, undefined, 'Private phone must never leak');
  assert.equal(exposed.personalInfo?.address, undefined, 'Home address must never leak');
  assert.equal(exposed.user?.email, undefined, 'Teacher email must never leak');
  assert.equal(exposed.user?.phone, undefined, 'Teacher user phone must never leak');
});

test('CRIT-02 & HIGH-08: POST /api/guardian/link-child atomically consumes linkCode at most once under Promise.all concurrency', async () => {
  seedUsers();
  GuardianInvitation.findOne = () => chainableQuery(null);

  let storedCode = 'WN-ABCDEF12';
  User.findOne = (filter = {}) => {
    if (filter._id) {
      const u = userStore.get(String(filter._id));
      if (!u || (filter.role && u.role !== filter.role)) return chainableQuery(null);
      return chainableQuery({ ...u, async save() { return this; } });
    }
    return chainableQuery(null);
  };
  User.updateOne = async () => ({ modifiedCount: 1 });
  User.findOneAndUpdate = (filter, update) => {
    if (filter.role === 'student' && filter.guardianLinkCode && filter.guardianLinkCode === storedCode) {
      if (update?.$unset?.guardianLinkCode) {
        storedCode = null;
      }
      const student = userStore.get(ids.student);
      return chainableQuery({ ...student });
    }
    return chainableQuery(null);
  };
  User.findByIdAndUpdate = async (id) => userStore.get(String(id)) || null;

  const guardianProfiles = new Map();
  function makeGuardianProfile(uid) {
    return {
      _id: oid(),
      user: uid,
      children: [],
      async addChild(studentId, relationship, permissions) {
        this.children.push({ student: studentId, relationship, permissions });
        guardianProfiles.set(String(uid), this);
        return this;
      },
      async save() {
        guardianProfiles.set(String(uid), this);
        return this;
      },
    };
  }
  Guardian.findOne = (filter) => {
    const uid = String(filter.user || '');
    if (!guardianProfiles.has(uid)) {
      guardianProfiles.set(uid, makeGuardianProfile(uid));
    }
    return chainableQuery(guardianProfiles.get(uid));
  };

  const token1 = generateAccessToken({ _id: ids.guardian1, role: 'guardian', email: 'guardian1@wahy.test' });
  const token2 = generateAccessToken({ _id: ids.guardian2, role: 'guardian', email: 'guardian2@wahy.test' });

  const responses = await Promise.all(
    Array.from({ length: 5 }, (_, idx) => apiJson('POST', '/api/guardian/link-child', {
      token: idx % 2 === 0 ? token1 : token2,
      body: { studentCode: 'WN-ABCDEF12', relationship: 'father' },
    }))
  );

  const succeeded = responses.filter((r) => r.status === 201);
  const rejected = responses.filter((r) => r.status === 404);
  assert.equal(succeeded.length, 1, 'Exactly one concurrent guardian link request may consume the single-use code');
  assert.equal(rejected.length, 4, 'All losing concurrent link attempts must fail with 404');
});

test('CRIT-03 & CRIT-04: POST /api/auth/google blocks teacher self-signup and sanitizes pre-registered unverified Gmail accounts', async () => {
  const originalVerify = googleIdentity.verifyGoogleCredential;
  let cancelledInvites = 0;

  try {
    googleIdentity.verifyGoogleCredential = async () => ({
      sub: 'google-sub-victim-100',
      email: 'victim.owner@gmail.com',
      emailVerified: true,
      name: 'Real Gmail Owner',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
    });

    // 1. Self-registering as teacher via Google must fail closed (400)
    const teacherAttempt = await apiJson('POST', '/api/auth/google', {
      body: { credential: 'mock-id-token', role: 'teacher' },
    });
    assert.equal(teacherAttempt.status, 400);
    assert.equal(teacherAttempt.data.code, 'GOOGLE_ROLE_NOT_ALLOWED');

    // 2. Claiming an attacker-planted unverified @gmail.com account rotates password & revokes attacker sessions
    const squattedAccount = {
      _id: oid(),
      name: 'Attacker Squat',
      email: 'victim.owner@gmail.com',
      password: 'AttackerKnownPassword123!',
      role: 'student',
      isActive: true,
      emailVerified: false,
      googleSubject: undefined,
      refreshTokenVersion: 2,
      guardianContact: { name: 'Attacker', phone: '+201000000099', relationship: 'father' },
      onboarding: { required: false, completed: true },
      async save() { return this; },
    };

    User.findOne = (filter = {}) => {
      if (filter.googleSubject) return chainableQuery(null);
      if (filter.email === 'victim.owner@gmail.com') return chainableQuery(squattedAccount);
      return chainableQuery(null);
    };
    GuardianInvitation.updateMany = async () => {
      cancelledInvites += 1;
      return { modifiedCount: 1 };
    };

    const claimRes = await apiJson('POST', '/api/auth/google', {
      body: { credential: 'mock-id-token', role: 'student' },
    });

    assert.equal(claimRes.status, 200);
    assert.notEqual(squattedAccount.password, 'AttackerKnownPassword123!', 'Attacker password must be rotated');
    assert.equal(squattedAccount.refreshTokenVersion, 3, 'Attacker refresh tokens must be invalidated');
    assert.equal(squattedAccount.guardianContact.phone, '', 'Attacker-planted guardian phone must be wiped');
    assert.equal(cancelledInvites, 1, 'Pending attacker guardian invitations must be cancelled');
  } finally {
    googleIdentity.verifyGoogleCredential = originalVerify;
  }
});

test('CRIT-06 & CRIT-07: POST /api/sessions/regular requires active private subscription and PUT /api/trials/:id/assess never enrolls unpaid students into GroupCircle', async () => {
  seedUsers();
  Teacher.findOne = (filter = {}) => {
    if (String(filter.user) === ids.teacherUser) {
      return chainableQuery({ _id: ids.teacherProfile, user: ids.teacherUser, status: 'approved', isVerified: true });
    }
    if (String(filter._id) === ids.teacherProfile) {
      return chainableQuery({
        _id: ids.teacherProfile,
        user: ids.teacherUser,
        status: 'approved',
        isVerified: true,
        personalInfo: { gender: 'male', fullName: 'Sheikh Omar' },
      });
    }
    return chainableQuery(null);
  };
  StudentSubscription.findOne = () => chainableQuery(null);
  Session.findOne = () => chainableQuery({ _id: oid(), status: 'completed' });

  const studentToken = generateAccessToken({ _id: ids.student, role: 'student', email: 'sec-student@wahy.test' });
  const unpaidBooking = await apiJson('POST', '/api/sessions/regular', {
    token: studentToken,
    body: {
      teacherId: ids.teacherProfile,
      scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      duration: 60,
    },
  });
  assert.equal(unpaidBooking.status, 403);
  assert.equal(unpaidBooking.data.code, 'SUBSCRIPTION_REQUIRED');

  // CRIT-07: Assessing a trial with assignCircleId must only store recommendedCircle, never mutate GroupCircle.students
  let circleMutated = false;
  GroupCircle.findByIdAndUpdate = async () => {
    circleMutated = true;
    return null;
  };
  GroupCircle.updateOne = async () => {
    circleMutated = true;
    return { modifiedCount: 1 };
  };
  GroupCircle.findById = () => chainableQuery({
    _id: ids.circle,
    name: 'حلقة الإتقان',
    code: 'CIR-101',
    teacher: ids.teacherProfile,
    status: 'active',
  });

  const trialDoc = {
    _id: ids.trial,
    student: ids.student,
    assignedTeacher: ids.teacherProfile,
    status: 'scheduled',
    assessment: {},
    async save() { return this; },
  };
  TrialRequest.findById = () => chainableQuery(trialDoc);

  const teacherToken = generateAccessToken({ _id: ids.teacherUser, role: 'teacher', email: 'sec-teacher@wahy.test' });
  const assessRes = await apiJson('PUT', `/api/trials/${ids.trial}/assess`, {
    token: teacherToken,
    body: {
      level: 'intermediate',
      recommendedTrack: 'memorization',
      assignedCircleId: ids.circle,
      notes: 'Good Makharij',
    },
  });

  assert.equal(assessRes.status, 200);
  assert.equal(circleMutated, false, 'Trial assessment must never push unpaid students into GroupCircle');
  assert.equal(String(trialDoc.assessment.assignedCircle), ids.circle);
});

test('CRIT-09: Enrollment.updateProgress blocks foreign/unpublished lessons and 0-lesson NaN certificates; LMS blocks unpassed quiz completion', async () => {
  Course.findById = async () => ({
    _id: ids.course,
    slug: 'tajweed-101',
    status: 'published',
    certificate: { enabled: true },
  });

  // 1. 0-lesson course cannot forge a certificate or NaN progress
  Lesson.find = () => chainableQuery([]);
  const emptyCourseEnrollment = new Enrollment({
    student: ids.student,
    course: ids.course,
    status: 'active',
  });
  await assert.rejects(
    () => emptyCourseEnrollment.updateProgress(ids.foreignLesson, 100),
    (err) => err.statusCode === 400
  );
  assert.equal(emptyCourseEnrollment.progress.percentage, 0);
  assert.equal(Boolean(emptyCourseEnrollment.certificate?.issued), false);

  // 2. Foreign lessonId rejected even when course has published lessons
  Lesson.find = () => chainableQuery([{ _id: ids.quizLesson }]);
  await assert.rejects(
    () => emptyCourseEnrollment.updateProgress(ids.foreignLesson, 100),
    (err) => err.statusCode === 400
  );

  // 3. POST /api/lms/course/:slug/lesson/:lessonId/complete blocks quiz lesson without passed QuizAttempt
  Course.findOne = () => chainableQuery({
    _id: ids.course,
    slug: 'tajweed-101',
    status: 'published',
    certificate: { enabled: true },
  });
  Lesson.findOne = () => chainableQuery({
    _id: ids.quizLesson,
    course: ids.course,
    type: 'quiz',
    isPublished: true,
    content: { quiz: ids.quiz },
  });
  Enrollment.findOne = () => chainableQuery(emptyCourseEnrollment);
  Quiz.findOne = () => chainableQuery({ _id: ids.quiz, status: 'published' });
  QuizAttempt.findOne = () => chainableQuery(null);

  const studentToken = generateAccessToken({ _id: ids.student, role: 'student', email: 'sec-student@wahy.test' });
  const completeQuizRes = await apiJson('POST', `/api/lms/course/tajweed-101/lesson/${ids.quizLesson}/complete`, {
    token: studentToken,
    body: {},
  });
  assert.equal(completeQuizRes.status, 400);
  assert.equal(completeQuizRes.data.code, 'QUIZ_NOT_PASSED');
});

test('CRIT-10: POST /api/translate enforces JWT authentication and rejects non-string payloads', async () => {
  const unauth = await apiJson('POST', '/api/translate', {
    body: { text: 'السلام عليكم', targetLang: 'en' },
  });
  assert.equal(unauth.status, 401);

  const studentToken = generateAccessToken({ _id: ids.student, role: 'student', email: 'sec-student@wahy.test' });
  const badType = await apiJson('POST', '/api/translate', {
    token: studentToken,
    body: { text: { $gt: '' }, targetLang: 'en' },
  });
  assert.equal(badType.status, 400);
});

test('CRIT-12: POST /api/admin/upload blocks teacher role (403) and rejects SVG / magic-byte spoofing (400)', async () => {
  seedUsers();
  Teacher.findOne = () => chainableQuery({
    _id: ids.teacherProfile,
    user: ids.teacherUser,
    status: 'approved',
    isVerified: true,
  });

  const teacherToken = generateAccessToken({ _id: ids.teacherUser, role: 'teacher', email: 'sec-teacher@wahy.test' });
  const adminToken = generateAccessToken({ _id: ids.admin, role: 'admin', email: 'sec-admin@wahy.test' });

  const teacherForm = new FormData();
  teacherForm.append('file', new Blob(['<svg onload="alert(1)"></svg>'], { type: 'image/svg+xml' }), 'xss.svg');
  const teacherRes = await fetch(`${baseUrl}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: teacherForm,
  });
  assert.equal(teacherRes.status, 403, 'Teachers must never access /api/admin/upload');

  // Admin uploading HTML disguised as image/png must fail validateMagicBytes
  const spoofedForm = new FormData();
  spoofedForm.append('file', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), 'evil.png');
  const spoofedRes = await fetch(`${baseUrl}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: spoofedForm,
  });
  const spoofedData = await spoofedRes.json().catch(() => ({}));
  assert.equal(spoofedRes.status, 400);
  assert.equal(spoofedData.code, 'INVALID_FILE_MAGIC_BYTES');
});

test('HIGH-03: POST /api/auth/verify-code atomically caps concurrent OTP brute-force attempts under Promise.all', async () => {
  const targetEmail = 'otp-target@wahy.test';
  const realCode = '839201';
  const codeHash = crypto.createHash('sha256').update(`${targetEmail}:${realCode}`).digest('hex');

  let otpDoc = {
    _id: oid(),
    email: targetEmail,
    codeHash,
    method: 'email',
    expires: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
  };

  VerificationCode.findOneAndUpdate = (filter) => {
    if (!otpDoc || filter.email !== targetEmail) return chainableQuery(null);
    otpDoc = { ...otpDoc, attempts: otpDoc.attempts + 1 };
    return chainableQuery({ ...otpDoc });
  };
  VerificationCode.deleteOne = async () => {
    otpDoc = null;
    return { deletedCount: 1 };
  };
  VerificationCode.findOneAndDelete = async () => {
    const prev = otpDoc;
    otpDoc = null;
    return prev;
  };

  // Fire 8 concurrent wrong guesses followed by the real code
  const guesses = await Promise.all(
    Array.from({ length: 8 }, (_, idx) => apiJson('POST', '/api/auth/verify-code', {
      body: { email: targetEmail, code: `10000${idx}` },
    }))
  );

  const statuses = guesses.map((g) => g.status);
  assert.ok(statuses.every((s) => s === 400 || s === 429), 'Every wrong guess must fail closed');
  assert.ok(statuses.includes(429), 'Concurrent guesses exceeding 5 attempts must trigger 429 lockout');

  // Even presenting the real code afterwards must fail because the OTP record was burned at 5 attempts
  const lateRealAttempt = await apiJson('POST', '/api/auth/verify-code', {
    body: { email: targetEmail, code: realCode },
  });
  assert.equal(lateRealAttempt.status, 400);
});

test('HIGH-16: GET /api/videos?category=nonexistent never calls VideoAsset.insertMany on empty filtered queries', async () => {
  let insertManyCalled = false;
  VideoAsset.insertMany = async () => {
    insertManyCalled = true;
    throw new Error('VideoAsset.insertMany must never be called from GET /api/videos');
  };
  VideoAsset.find = () => chainableQuery([]);
  VideoAsset.countDocuments = async () => 0;
  VideoAsset.estimatedDocumentCount = async () => 6;

  const res = await apiJson('GET', '/api/videos?category=nonexistent_category');
  assert.equal(res.status, 200);
  assert.equal(insertManyCalled, false, 'GET /api/videos must be strictly read-only');
  assert.deepEqual(res.data.videos, []);
});
