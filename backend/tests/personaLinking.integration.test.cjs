'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

const mongoose = require('mongoose');

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const LiveSession = require('../models/LiveSession');
const Notification = require('../models/Notification');
const TeacherLedger = require('../models/TeacherLedger');
const AdminAuditLog = require('../models/AdminAuditLog');
const StudentSubscription = require('../models/StudentSubscription');
const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');

// Compile the full application while disconnected. Only after every model has
// been registered do we simulate an available DB; model IO is stubbed below.
mongoose.connection.readyState = 1;

const oid = () => new mongoose.Types.ObjectId().toString();
const ids = {
  admin: oid(),
  teacherUser: oid(),
  teacher: oid(),
  student: oid(),
  guardian: oid(),
};

const users = new Map([
  [ids.admin, { _id: ids.admin, id: ids.admin, name: 'QA Admin', role: 'admin', isActive: true }],
  [ids.teacherUser, { _id: ids.teacherUser, id: ids.teacherUser, name: 'QA Teacher', role: 'teacher', isActive: true }],
  [ids.student, {
    _id: ids.student,
    id: ids.student,
    name: 'QA Student',
    role: 'student',
    isActive: true,
    phone: '01000000000',
    onboarding: { required: false, completed: true, trackSelected: true },
    circle: null,
  }],
  [ids.guardian, { _id: ids.guardian, id: ids.guardian, name: 'QA Guardian', role: 'guardian', isActive: true }],
]);

const teacher = {
  _id: ids.teacher,
  user: ids.teacherUser,
  status: 'pending',
  isVerified: false,
  personalInfo: { fullName: 'QA Teacher', phone: '01000000000' },
  media: { profilePhoto: '/qa.jpg' },
};

const guardian = {
  user: ids.guardian,
  children: [{
    student: ids.student,
    relationship: 'father',
    permissions: { viewAttendance: true, viewProgress: true, viewGrades: true, receiveNotifications: true },
  }],
};

const sessions = [];

function query(value) {
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

function matchSession(s, filter = {}) {
  if (filter._id && String(s._id) !== String(filter._id)) return false;
  if (filter.student && String(s.student) !== String(filter.student)) return false;
  if (filter.teacher && String(s.teacher) !== String(filter.teacher)) return false;
  if (filter.type && s.type !== filter.type) return false;
  if (filter.status) {
    if (typeof filter.status === 'string' && s.status !== filter.status) return false;
    if (filter.status.$in && !filter.status.$in.includes(s.status)) return false;
  }
  return true;
}

Teacher.findOne = (filter = {}) => {
  if (filter.user && String(filter.user) === ids.teacherUser) return query(teacher);
  if (filter._id && String(filter._id) === ids.teacher) {
    if (filter.status && filter.status !== teacher.status) return query(null);
    if (filter.isVerified !== undefined && filter.isVerified !== teacher.isVerified) return query(null);
    return query(teacher);
  }
  return query(null);
};

Teacher.find = (filter = {}) => {
  const pending = filter.status?.$in?.includes(teacher.status);
  return query(pending ? [{ ...teacher, user: { name: 'QA Teacher', email: 'qa@example.test' } }] : []);
};

Teacher.findById = (id) => query(String(id) === ids.teacher ? teacher : null);

Teacher.findByIdAndUpdate = async (id, update) => {
  if (String(id) !== ids.teacher) return null;
  teacher.status = update.status ?? teacher.status;
  teacher.isVerified = update.isVerified ?? teacher.isVerified;
  return teacher;
};

User.findById = (id) => query({
  ...users.get(String(id)),
  preferences: { notifications: { email: false, push: false } },
});

User.findByIdAndUpdate = (id) => query(users.get(String(id)) || null);

User.find = (filter = {}) => {
  const wanted = (filter._id?.$in || []).map(String);
  return query(wanted.map((id) => users.get(id)).filter(Boolean).map((u) => ({ _id: u._id, name: u.name, circle: null })));
};

Session.create = async (data) => {
  const doc = {
    _id: oid(),
    student: data.student,
    teacher: data.teacher,
    type: data.type,
    status: data.status || 'pending',
    scheduledAt: data.scheduledAt,
    timezone: data.timezone,
    notes: data.notes,
    attendance: [],
    earnings: { amount: 0, status: 'pending' },
    async save() { return this; },
  };
  sessions.push(doc);
  return doc;
};

Session.findOne = (filter = {}) => query(sessions.find((s) => matchSession(s, filter)) || null);

Session.find = (filter = {}) => {
  if (filter.$or) {
    return query(sessions.map((s) => ({
      ...s,
      teacher: {
        _id: ids.teacher,
        personalInfo: { fullName: 'QA Teacher' },
        media: { profilePhoto: '/qa.jpg' },
        user: { name: 'QA Teacher', avatar: null },
      },
    })));
  }
  return query(sessions.filter((s) => matchSession(s, filter)));
};

Session.countDocuments = async (filter = {}) => sessions.filter((s) => matchSession(s, filter)).length;
Session.aggregate = async () => [{
  totalMinutes: sessions
    .filter((session) => session.status === 'completed')
    .reduce((sum, session) => sum + Number(session.duration || 60), 0),
}];

const ledgerEntries = [];
TeacherLedger.exists = async (filter = {}) => ledgerEntries.some((entry) => (
  (!filter.teacher || String(entry.teacher) === String(filter.teacher))
  && (!filter.idempotencyKey || entry.idempotencyKey === filter.idempotencyKey)
));
TeacherLedger.findOneAndUpdate = async (filter = {}, update = {}) => {
  let entry = ledgerEntries.find((item) => item.idempotencyKey === filter.idempotencyKey);
  if (!entry && update.$setOnInsert) {
    entry = { _id: oid(), ...update.$setOnInsert };
    ledgerEntries.push(entry);
  }
  return entry || null;
};
TeacherLedger.findOne = (filter = {}) => query(
  ledgerEntries.find((entry) => entry.idempotencyKey === filter.idempotencyKey) || null,
);

Guardian.findOne = (filter = {}) => query(String(filter.user) === ids.guardian ? guardian : null);
Guardian.find = (filter = {}) => {
  const studentId = filter.children?.$elemMatch?.student;
  if (!studentId || String(studentId) === ids.student) {
    return query([{ user: ids.guardian }]);
  }
  return query([]);
};
LiveSession.find = () => query([]);
// The QA student has not chosen a tutor on any subscription, so no tutor lock applies.
StudentSubscription.findOne = () => query(null);
const notifications = [];
Notification.createAndSend = async (userId, payload) => {
  notifications.push({ userId: String(userId), ...payload });
  return { success: true };
};

const auditEntries = [];
AdminAuditLog.create = async (payload) => {
  const entry = { _id: oid(), ...payload, createdAt: new Date() };
  auditEntries.push(entry);
  return entry;
};

const auth = (id) => generateAccessToken(users.get(id));

async function call(base, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

test('four-persona state linking works through real HTTP routes', async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;

  const adminToken = auth(ids.admin);
  const teacherToken = auth(ids.teacherUser);
  const studentToken = auth(ids.student);
  const guardianToken = auth(ids.guardian);

  const blocked = await call(base, '/api/sessions/my-sessions?type=trial', { token: teacherToken });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'TEACHER_APPROVAL_PENDING');

  const pending = await call(base, '/api/admin/teachers/pending', { token: adminToken });
  assert.equal(pending.status, 200);
  assert.equal(pending.data.length, 1);

  Object.assign(teacher, {
    personalInfo: {
      fullName: 'QA Teacher',
      age: 30,
      gender: 'male',
      country: 'Egypt',
      city: 'Cairo',
      phone: '01000000000',
    },
    academicInfo: {
      university: 'QA University',
      faculty: 'QA Faculty',
      graduationYear: 2020,
      specialization: 'Quran',
      qualification: 'BA',
    },
    quranInfo: { memorizedParts: 30, teachingExperience: 5, specializations: ['tajweed'] },
    documents: {
      idCardFront: '/qa-id-front.jpg',
      idCardBack: '/qa-id-back.jpg',
      graduationCertificateAvailable: false,
      tajweedCertificatesAvailable: false,
      ijazatAvailable: false,
    },
    media: {
      profilePhoto: '/qa.jpg',
      introductionVideo: '/qa-intro.mp4',
      recitationVideo: '/qa-recitation.mp4',
      teachingMethodVideo: '/qa-method.mp4',
    },
    reviewChecklist: [
      'personal-info', 'academic-info', 'quran-profile', 'profile-photo',
      'introduction-video', 'recitation-video', 'teaching-method-video',
      'id-card-front', 'id-card-back',
    ].map((key) => ({ key, status: 'approved' })),
    reviewNotes: [],
    save: async function saveTeacherFixture() { return this; },
  });

  const approved = await call(base, '/api/teachers/admin/' + ids.teacher + '/review', {
    method: 'PUT',
    token: adminToken,
    body: { action: 'approve', note: 'QA approval' },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.applicationStatus, 'approved');

  const unblocked = await call(base, '/api/sessions/my-sessions?type=trial', { token: teacherToken });
  assert.equal(unblocked.status, 200);

  const createTrial = await call(base, '/api/sessions/trial', {
    method: 'POST',
    token: studentToken,
    body: {
      teacherId: ids.teacher,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      timezone: 'Africa/Cairo',
      notes: 'QA trial',
    },
  });
  assert.equal(createTrial.status, 201);
  assert.equal(createTrial.data.session.status, 'pending');
  assert.deepEqual(createTrial.data.trialAllowance, { limit: 3, used: 1, remaining: 2 });

  const requestNotification = notifications.find((item) => item.type === 'session-request');
  assert.ok(requestNotification);
  assert.equal(requestNotification.userId, ids.teacherUser);
  assert.match(String(requestNotification.data?.actionUrl || ''), /\/teacher\/dashboard\?tab=trials&session=/);

  const duplicateTrial = await call(base, '/api/sessions/trial', {
    method: 'POST',
    token: studentToken,
    body: {
      teacherId: ids.teacher,
      scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      timezone: 'Africa/Cairo',
      notes: 'Duplicate QA trial',
    },
  });
  assert.equal(duplicateTrial.status, 409);
  assert.equal(duplicateTrial.data.code, 'TRIAL_ALREADY_EXISTS');
  assert.equal(String(duplicateTrial.data.existingSession?._id), String(createTrial.data.session._id));
  assert.equal(duplicateTrial.data.existingSession?.status, 'pending');

  const teacherView = await call(base, '/api/sessions/my-sessions?type=trial&status=pending', { token: teacherToken });
  assert.equal(teacherView.status, 200);
  assert.equal(teacherView.data.sessions.length, 1);

  const sessionId = String(sessions[0]._id);
  const accept = await call(base, '/api/sessions/' + sessionId + '/respond', {
    method: 'PUT',
    token: teacherToken,
    body: { action: 'accept', provider: 'jitsi' },
  });
  assert.equal(accept.status, 200);
  assert.equal(accept.data.session.status, 'accepted');
  const acceptedNoticeCount = notifications.filter((item) => item.type === 'session-accepted' && item.userId === ids.student).length;
  assert.equal(acceptedNoticeCount, 1);

  const replayAccept = await call(base, '/api/sessions/' + sessionId + '/respond', {
    method: 'PUT',
    token: teacherToken,
    body: { action: 'accept', provider: 'jitsi' },
  });
  assert.equal(replayAccept.status, 200);
  assert.equal(replayAccept.data.alreadyAccepted, true);
  assert.equal(notifications.filter((item) => item.type === 'session-accepted' && item.userId === ids.student).length, acceptedNoticeCount);

  const invalidReject = await call(base, '/api/sessions/' + sessionId + '/respond', {
    method: 'PUT',
    token: teacherToken,
    body: { action: 'reject', reason: 'QA invalid status transition' },
  });
  assert.equal(invalidReject.status, 409);
  assert.equal(invalidReject.data.code, 'SESSION_ALREADY_DECIDED');
  assert.equal(sessions[0].status, 'accepted');

  const studentView = await call(base, '/api/sessions/my-sessions?type=trial', { token: studentToken });
  assert.equal(studentView.status, 200);
  assert.equal(studentView.data.sessions[0].status, 'accepted');

  const guardianView = await call(base, '/api/guardian/upcoming-sessions', { token: guardianToken });
  assert.equal(guardianView.status, 200);
  assert.equal(guardianView.data.sessions.length, 1);
  assert.equal(guardianView.data.sessions[0].status, 'accepted');
  assert.equal(guardianView.data.sessions[0].teacher.name, 'QA Teacher');

  const regularBeforeCompletion = await call(base, '/api/sessions/regular', {
    method: 'POST',
    token: studentToken,
    body: {
      teacherId: ids.teacher,
      scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      timezone: 'Africa/Cairo',
    },
  });
  assert.equal(regularBeforeCompletion.status, 400);

  const earlyComplete = await call(base, '/api/sessions/' + sessionId + '/complete', {
    method: 'PUT',
    token: teacherToken,
    body: {
      evaluation: {
        attendance: 5,
        memorization: 5,
        tajweed: 5,
        behavior: 5,
        commitment: 5,
        surahRecited: 'QA Surah',
        fromAyah: 1,
        toAyah: 2,
        nextHomework: 'QA Homework',
        overallNotes: 'QA complete',
      },
    },
  });
  assert.equal(earlyComplete.status, 409);
  assert.equal(earlyComplete.data.code, 'SESSION_NOT_STARTED');

  sessions[0].scheduledAt = new Date(Date.now() - 60000).toISOString();

  const completeTrial = await call(base, '/api/sessions/' + sessionId + '/complete', {
    method: 'PUT',
    token: teacherToken,
    body: {
      evaluation: {
        attendance: 5,
        memorization: 5,
        tajweed: 5,
        behavior: 5,
        commitment: 5,
        surahRecited: 'QA Surah',
        fromAyah: 1,
        toAyah: 2,
        nextHomework: 'QA Homework',
        overallNotes: 'QA complete',
      },
    },
  });
  assert.equal(completeTrial.status, 200);
  assert.equal(completeTrial.data.session.status, 'completed');
  assert.equal(completeTrial.data.session.teacherEvaluation.surahRecited, 'QA Surah');
  assert.equal(completeTrial.data.session.teacherEvaluation.nextHomework, 'QA Homework');
  assert.equal(
    ledgerEntries.filter((entry) => entry.idempotencyKey === `session:${sessionId}:earning`).length,
    1,
  );

  const sameTeacherTrialAgain = await call(base, '/api/sessions/trial', {
    method: 'POST',
    token: studentToken,
    body: {
      teacherId: ids.teacher,
      scheduledAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      timezone: 'Africa/Cairo',
    },
  });
  assert.equal(sameTeacherTrialAgain.status, 409);
  assert.equal(sameTeacherTrialAgain.data.code, 'TRIAL_ALREADY_COMPLETED_WITH_TEACHER');
  assert.deepEqual(sameTeacherTrialAgain.data.nextActions, ['continue-with-teacher', 'try-another-teacher']);

  const regularAfterCompletion = await call(base, '/api/sessions/regular', {
    method: 'POST',
    token: studentToken,
    body: {
      teacherId: ids.teacher,
      scheduledAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      timezone: 'Africa/Cairo',
    },
  });
  assert.equal(regularAfterCompletion.status, 201);
  assert.equal(regularAfterCompletion.data.session.type, 'regular');
  assert.equal(regularAfterCompletion.data.session.status, 'pending');

  sessions.push(
    {
      _id: oid(),
      student: ids.student,
      teacher: oid(),
      type: 'trial',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      _id: oid(),
      student: ids.student,
      teacher: oid(),
      type: 'trial',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
  );

  const fourthTrialBlocked = await call(base, '/api/sessions/trial', {
    method: 'POST',
    token: studentToken,
    body: {
      teacherId: ids.teacher,
      scheduledAt: new Date(Date.now() + 6 * 86400000).toISOString(),
      timezone: 'Africa/Cairo',
    },
  });
  assert.equal(fourthTrialBlocked.status, 409);
  assert.equal(fourthTrialBlocked.data.code, 'TRIAL_LIMIT_REACHED');
  assert.deepEqual(fourthTrialBlocked.data.trialAllowance, { limit: 3, used: 3, remaining: 0 });
});
