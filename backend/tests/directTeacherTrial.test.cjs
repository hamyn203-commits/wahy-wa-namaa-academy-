const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret-for-direct-trial-only-32ch';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-direct-trial-only-32ch';

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const StudentSubscription = require('../models/StudentSubscription');
const TrialRequest = require('../models/TrialRequest');
const Notification = require('../models/Notification');
const { generateAccessToken } = require('../middleware/auth');
const app = require('../app');

function chainable(value) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(value).catch(onRejected);
    },
  };
}

function postJson(port, urlPath, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body || {}), 'utf8');
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* ignore */ }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

test('Trial booking with selected teacher routes directly to teacher, creates Session + scheduled TrialRequest, and notifies Admin as FYI', async () => {
  const ids = {
    adminUser: new mongoose.Types.ObjectId().toString(),
    teacherUser: new mongoose.Types.ObjectId().toString(),
    teacherProfile: new mongoose.Types.ObjectId().toString(),
    femaleTeacherProfile: new mongoose.Types.ObjectId().toString(),
    studentUser: new mongoose.Types.ObjectId().toString(),
  };

  const users = new Map([
    [ids.adminUser, { _id: ids.adminUser, name: 'Admin', email: 'admin@test.local', role: 'admin', isActive: true, refreshTokenVersion: 0 }],
    [ids.teacherUser, { _id: ids.teacherUser, name: 'الشيخ أحمد', email: 'teacher@test.local', role: 'teacher', isActive: true, refreshTokenVersion: 0 }],
    [ids.studentUser, {
      _id: ids.studentUser,
      name: 'طالب مجتهد',
      email: 'student@test.local',
      phone: '+201012345678',
      whatsappPhone: '+201012345678',
      age: 22,
      gender: 'male',
      role: 'student',
      isActive: true,
      refreshTokenVersion: 0,
      preferredTrack: 'memorization',
      onboarding: { required: true, completed: true, trackSelected: false },
      set(path, val) {
        if (path === 'onboarding.trackSelected') this.onboarding.trackSelected = val;
      },
      save() { return Promise.resolve(this); },
    }],
  ]);

  const teachers = new Map([
    [ids.teacherProfile, {
      _id: ids.teacherProfile,
      user: users.get(ids.teacherUser),
      status: 'approved',
      isVerified: true,
      hourlyRate: 60,
      availability: [],
      availabilityTimezone: 'Africa/Cairo',
      personalInfo: { fullName: 'الشيخ أحمد المجاز', gender: 'male' },
    }],
    [ids.femaleTeacherProfile, {
      _id: ids.femaleTeacherProfile,
      user: { _id: new mongoose.Types.ObjectId().toString(), name: 'المعلمة فاطمة' },
      status: 'approved',
      isVerified: true,
      hourlyRate: 60,
      availability: [],
      availabilityTimezone: 'Africa/Cairo',
      personalInfo: { fullName: 'المعلمة فاطمة', gender: 'female' },
    }],
  ]);

  const createdSessions = [];
  const createdTrials = [];
  const sentNotifications = [];

  const origReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origUserFindById = User.findById;
  const origUserFind = User.find;
  const origTeacherFindOne = Teacher.findOne;
  const origSessionFind = Session.find;
  const origSessionFindOne = Session.findOne;
  const origSessionCount = Session.countDocuments;
  const origSessionCreate = Session.create;
  const origSubFindOne = StudentSubscription.findOne;
  const origTrialSave = TrialRequest.prototype.save;
  const origTrialCreate = TrialRequest.create;
  const origNotifyCreate = Notification.createAndSend;

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  User.findById = (id) => chainable(users.get(String(id)) || null);
  User.find = (filter = {}) => {
    if (filter.role === 'admin') return chainable([users.get(ids.adminUser)]);
    return chainable([]);
  };
  Teacher.findOne = (filter = {}) => {
    if (filter._id) return chainable(teachers.get(String(filter._id)) || null);
    if (filter.user) {
      for (const t of teachers.values()) {
        if (String(t.user?._id || t.user) === String(filter.user)) return chainable(t);
      }
    }
    return chainable(null);
  };
  Session.find = () => chainable(createdSessions);
  Session.findOne = () => chainable(null);
  Session.countDocuments = async () => createdSessions.length;
  Session.create = async (doc) => {
    const saved = { _id: new mongoose.Types.ObjectId(), ...doc };
    createdSessions.push(saved);
    return saved;
  };
  StudentSubscription.findOne = () => chainable(null);
  TrialRequest.prototype.save = async function saveStub() {
    if (!this._id) this._id = new mongoose.Types.ObjectId();
    createdTrials.push(this.toObject ? this.toObject() : { ...this });
    return this;
  };
  TrialRequest.create = async (doc) => {
    const saved = { _id: new mongoose.Types.ObjectId(), ...doc };
    createdTrials.push(saved);
    return saved;
  };
  Notification.createAndSend = async (userId, payload) => {
    sentNotifications.push({ userId: String(userId), ...payload });
    return payload;
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const studentToken = generateAccessToken(users.get(ids.studentUser), { mobile: true });
    const tomorrowIso = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

    // 1. Mobile / Web POST /api/trials WITH teacherId routes directly to teacher (no admin assignment needed!)
    const directRes = await postJson(
      port,
      '/api/trials',
      {
        studentName: 'طالب مجتهد',
        whatsappPhone: '+201012345678',
        age: 22,
        gender: 'male',
        preferredTrack: 'memorization',
        teacherId: ids.teacherProfile,
        scheduledAt: tomorrowIso,
        timezone: 'Africa/Cairo',
      },
      { Authorization: `Bearer ${studentToken}` }
    );

    assert.equal(directRes.status, 201, `Expected 201, got ${directRes.status}: ${directRes.text}`);
    assert.equal(directRes.json?.directTeacherAssigned, true);
    assert.equal(String(directRes.json?.trial?.assignedTeacher), ids.teacherProfile);
    assert.equal(directRes.json?.trial?.status, 'scheduled', 'Trial must be scheduled directly, NOT left pending for admin teacher selection');
    assert.equal(createdSessions.length, 1, 'A direct Session must be created for the chosen teacher');
    assert.equal(String(createdSessions[0].teacher), ids.teacherProfile);
    assert.equal(createdSessions[0].status, 'pending');

    await new Promise((r) => setTimeout(r, 30));
    assert.ok(
      sentNotifications.some((n) => n.userId === ids.teacherUser && n.type === 'session-request'),
      'Chosen teacher must receive immediate session-request notification'
    );
    assert.ok(
      sentNotifications.some((n) => n.userId === ids.adminUser && n.type === 'system'),
      'Admin must receive informational FYI notification about the direct trial class'
    );

    // 2. Cross-gender adult safeguarding still fails closed with 403!
    const crossGenderRes = await postJson(
      port,
      '/api/trials',
      {
        studentName: 'طالب بالغ',
        whatsappPhone: '+201099998888',
        age: 24,
        gender: 'male',
        preferredTrack: 'memorization',
        teacherId: ids.femaleTeacherProfile,
      }
    );
    assert.ok(
      [400, 403].includes(crossGenderRes.status),
      `Cross-gender adult 1-on-1 direct trial selection must fail closed (got ${crossGenderRes.status})`
    );

    // 3. POST /api/trials WITHOUT teacherId stays pending for Admin to choose a teacher
    const unassignedRes = await postJson(port, '/api/trials', {
      studentName: 'طالب بدون اختيار معلم',
      whatsappPhone: '+201055554444',
      age: 20,
      gender: 'male',
      preferredTrack: 'memorization',
    });
    assert.equal(unassignedRes.status, 201);
    assert.equal(Boolean(unassignedRes.json?.directTeacherAssigned), false);
    assert.equal(unassignedRes.json?.trial?.status, 'pending');
    assert.equal(unassignedRes.json?.trial?.assignedTeacher, undefined);

    // 4. Website POST /api/sessions/trial works even when trackSelected was false, syncs TrialRequest & notifies Admin
    sentNotifications.length = 0;
    const webDirectRes = await postJson(
      port,
      '/api/sessions/trial',
      {
        teacherId: ids.teacherProfile,
        scheduledAt: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString(),
        timezone: 'Africa/Cairo',
        notes: 'حجز مباشر من صفحة المعلم',
      },
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(webDirectRes.status, 201, `Expected 201 on /api/sessions/trial, got ${webDirectRes.status}: ${webDirectRes.text}`);
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(
      sentNotifications.some((n) => n.userId === ids.teacherUser && n.type === 'session-request'),
      'Teacher must be notified on /api/sessions/trial'
    );
    assert.ok(
      sentNotifications.some((n) => n.userId === ids.adminUser && n.type === 'system'),
      'Admin must receive FYI notification on /api/sessions/trial'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (origReadyState) Object.defineProperty(mongoose.connection, 'readyState', origReadyState);
    User.findById = origUserFindById;
    User.find = origUserFind;
    Teacher.findOne = origTeacherFindOne;
    Session.find = origSessionFind;
    Session.findOne = origSessionFindOne;
    Session.countDocuments = origSessionCount;
    Session.create = origSessionCreate;
    StudentSubscription.findOne = origSubFindOne;
    TrialRequest.prototype.save = origTrialSave;
    TrialRequest.create = origTrialCreate;
    Notification.createAndSend = origNotifyCreate;
  }
});
