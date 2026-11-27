'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

const mongoose = require('mongoose');
const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const LiveSession = require('../models/LiveSession');
const Payment = require('../models/Payment');
const TeacherLedger = require('../models/TeacherLedger');
const ContactMessage = require('../models/ContactMessage');
const GuardianInvitation = require('../models/GuardianInvitation');
const TrialRequest = require('../models/TrialRequest');
const StudentSubscription = require('../models/StudentSubscription');
const SupportMessage = require('../models/SupportMessage');
const AdminAuditLog = require('../models/AdminAuditLog');
const SiteVisit = require('../models/SiteVisit');
const TeacherFunnelSession = require('../models/TeacherFunnelSession');

function makeQuery(value) {
  const q = {
    select() { return q; },
    populate() { return q; },
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
    catch(reject) { return Promise.resolve(value).catch(reject); },
  };
  return q;
}

const server = http.createServer(app);
let baseUrl = '';
const serverReady = new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, { method = 'GET', token, body } = {}) {
  await serverReady;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('GET /api/admin/command-center enforces admin RBAC and exposes livePulse + unread support & low-balance actions', async () => {
  const origReady = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origUserFindById = User.findById;
  const origTeacherCount = Teacher.countDocuments;
  const origTeacherFind = Teacher.find;
  const origPaymentCount = Payment.countDocuments;
  const origLedgerCount = TeacherLedger.countDocuments;
  const origContactCount = ContactMessage.countDocuments;
  const origGuardianCount = GuardianInvitation.countDocuments;
  const origSessionCount = Session.countDocuments;
  const origAuditFind = AdminAuditLog.find;
  const origTrialCount = TrialRequest.countDocuments;
  const origSubCount = StudentSubscription.countDocuments;
  const origSupportCount = SupportMessage.countDocuments;
  const origLiveCount = LiveSession.countDocuments;

  const adminId = new mongoose.Types.ObjectId().toString();
  const studentId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });
  const studentToken = generateAccessToken({ id: studentId, role: 'student', tokenVersion: 0 });

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  User.findById = (id) => {
    if (String(id) === adminId) return makeQuery({ _id: adminId, role: 'admin', isActive: true, tokenVersion: 0 });
    if (String(id) === studentId) return makeQuery({ _id: studentId, role: 'student', isActive: true, tokenVersion: 0 });
    return makeQuery(null);
  };
  Teacher.countDocuments = async () => 2;
  Teacher.find = () => makeQuery([]);
  Payment.countDocuments = async () => 1;
  TeacherLedger.countDocuments = async () => 0;
  ContactMessage.countDocuments = async () => 3;
  GuardianInvitation.countDocuments = async () => 0;
  Session.countDocuments = async (filter = {}) => {
    if (filter.status === 'completed' && filter.scheduledAt) return 5;
    if (filter.scheduledAt && !filter.status) return 8;
    return 0;
  };
  AdminAuditLog.find = () => makeQuery([
    {
      _id: new mongoose.Types.ObjectId(),
      actor: { name: 'المشرف العام' },
      action: 'trial.assigned',
      entityType: 'trial_request',
      reason: 'جدولة سريعة',
      createdAt: new Date(),
    },
  ]);
  TrialRequest.countDocuments = async () => 4;
  StudentSubscription.countDocuments = async (filter = {}) => {
    if (filter.status === 'awaiting_placement') return 2;
    if (filter.status === 'active') return 6;
    return 0;
  };
  SupportMessage.countDocuments = async () => 7;
  LiveSession.countDocuments = async () => 3;

  try {
    const forbidden = await request('/api/admin/command-center', { token: studentToken });
    assert.equal(forbidden.status, 403);

    const res = await request('/api/admin/command-center', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.livePulse.liveRoomsNow, 3);
    assert.equal(res.data.livePulse.todaySessionsTotal, 8);
    assert.equal(res.data.livePulse.todaySessionsCompleted, 5);
    assert.equal(res.data.livePulse.unreadSupportMessages, 7);
    assert.equal(res.data.livePulse.lowBalanceSubscriptions, 6);

    const supportAction = res.data.actions.find((a) => a.id === 'support-unread');
    const lowBalAction = res.data.actions.find((a) => a.id === 'low-balance-subscriptions');
    assert.ok(supportAction && supportAction.count === 7 && supportAction.severity === 'high');
    assert.ok(lowBalAction && lowBalAction.count === 6 && lowBalAction.severity === 'medium');
    assert.equal(res.data.recentAudit.length, 1);
  } finally {
    if (origReady) Object.defineProperty(mongoose.connection, 'readyState', origReady);
    User.findById = origUserFindById;
    Teacher.countDocuments = origTeacherCount;
    Teacher.find = origTeacherFind;
    Payment.countDocuments = origPaymentCount;
    TeacherLedger.countDocuments = origLedgerCount;
    ContactMessage.countDocuments = origContactCount;
    GuardianInvitation.countDocuments = origGuardianCount;
    Session.countDocuments = origSessionCount;
    AdminAuditLog.find = origAuditFind;
    TrialRequest.countDocuments = origTrialCount;
    StudentSubscription.countDocuments = origSubCount;
    SupportMessage.countDocuments = origSupportCount;
    LiveSession.countDocuments = origLiveCount;
  }
});

test('GET /api/sessions/available-slots/:teacherId supports ?duration=30 for 30-min trial slot picking', async () => {
  const origReady = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origTeacherFindOne = Teacher.findOne;
  const origSessionFind = Session.find;

  const teacherId = new mongoose.Types.ObjectId().toString();
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const allDaysAvailability = weekdays.map((day) => ({
    day,
    slots: [{ startTime: '18:00', endTime: '18:30' }],
  }));

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  Teacher.findOne = () => makeQuery({
    _id: teacherId,
    status: 'approved',
    isVerified: true,
    availabilityTimezone: 'UTC',
    availability: allDaysAvailability,
  });
  Session.find = () => makeQuery([]);

  try {
    // A 30-min availability window (18:00-18:30) yields 0 slots for 60m default, but >0 slots for duration=30!
    const res60 = await request(`/api/sessions/available-slots/${teacherId}?days=3`);
    assert.equal(res60.status, 200);
    assert.equal(res60.data.slots.length, 0);

    const res30 = await request(`/api/sessions/available-slots/${teacherId}?days=3&duration=30`);
    assert.equal(res30.status, 200);
    assert.ok(res30.data.slots.length >= 1, 'Expected 30-min slots inside 18:00-18:30 window');
    assert.equal(res30.data.slots[0].duration, 30);
  } finally {
    if (origReady) Object.defineProperty(mongoose.connection, 'readyState', origReady);
    Teacher.findOne = origTeacherFindOne;
    Session.find = origSessionFind;
  }
});

test('GET /api/trials returns summary + search for admin while preserving phone/email safeguarding for teachers', async () => {
  const origReady = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origUserFindById = User.findById;
  const origTeacherFindOne = Teacher.findOne;
  const origTrialFind = TrialRequest.find;
  const origTrialCount = TrialRequest.countDocuments;
  const origTrialAgg = TrialRequest.aggregate;

  const adminId = new mongoose.Types.ObjectId().toString();
  const teacherUserId = new mongoose.Types.ObjectId().toString();
  const teacherDocId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });
  const teacherToken = generateAccessToken({ id: teacherUserId, role: 'teacher', tokenVersion: 0 });

  let capturedFilter = null;
  const sampleTrials = [
    {
      _id: new mongoose.Types.ObjectId(),
      studentName: 'سارة محمود',
      guardianName: 'محمود حسن',
      whatsappPhone: '+201099887766',
      phone: '+201099887766',
      email: 'sara@example.com',
      age: 9,
      gender: 'female',
      preferredTrack: 'kids_foundation',
      status: 'pending',
      studentUser: { _id: new mongoose.Types.ObjectId(), name: 'سارة محمود', email: 'sara@example.com' },
    },
  ];

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  User.findById = (id) => {
    if (String(id) === adminId) return makeQuery({ _id: adminId, role: 'admin', isActive: true, tokenVersion: 0 });
    if (String(id) === teacherUserId) return makeQuery({ _id: teacherUserId, role: 'teacher', isActive: true, tokenVersion: 0 });
    return makeQuery(null);
  };
  Teacher.findOne = () => makeQuery({ _id: teacherDocId, status: 'approved', isVerified: true });
  TrialRequest.find = (filter) => {
    capturedFilter = filter;
    return makeQuery(sampleTrials);
  };
  TrialRequest.countDocuments = async () => 1;
  TrialRequest.aggregate = async () => [{
    totalAll: 12,
    pending: 4,
    scheduled: 5,
    completed: 2,
    no_show: 1,
    cancelled: 0,
    linkedStudents: 7,
  }];

  try {
    const adminRes = await request('/api/trials?q=0109988&status=pending', { token: adminToken });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.summary.pending, 4);
    assert.equal(adminRes.data.summary.linkedStudents, 7);
    assert.equal(adminRes.data.trials[0].whatsappPhone, '+201099887766');
    assert.ok(capturedFilter.$or.some((clause) => 'whatsappPhone' in clause));

    const teacherRes = await request('/api/trials?q=0109988', { token: teacherToken });
    assert.equal(teacherRes.status, 200);
    assert.equal(teacherRes.data.summary, undefined, 'Teachers must not receive global academy summary');
    assert.equal(teacherRes.data.trials[0].whatsappPhone, undefined, 'Teacher response must strip whatsappPhone');
    assert.equal(teacherRes.data.trials[0].email, undefined, 'Teacher response must strip email');
    assert.ok(
      !capturedFilter.$or.some((clause) => 'whatsappPhone' in clause || 'email' in clause),
      'Teacher search must not allow probing student phone or email'
    );
  } finally {
    if (origReady) Object.defineProperty(mongoose.connection, 'readyState', origReady);
    User.findById = origUserFindById;
    Teacher.findOne = origTeacherFindOne;
    TrialRequest.find = origTrialFind;
    TrialRequest.countDocuments = origTrialCount;
    TrialRequest.aggregate = origTrialAgg;
  }
});

test('Support inbox & Contact routes return unread/status summaries and audit contact status updates', async () => {
  const origUserFindById = User.findById;
  const origSupportAgg = SupportMessage.aggregate;
  const origContactFind = ContactMessage.find;
  const origContactCount = ContactMessage.countDocuments;
  const origContactAgg = ContactMessage.aggregate;
  const origContactUpdate = ContactMessage.findByIdAndUpdate;
  const origAuditCreate = AdminAuditLog.create;

  const adminId = new mongoose.Types.ObjectId().toString();
  const msgId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });
  const audits = [];

  User.findById = (id) => (
    String(id) === adminId
      ? makeQuery({ _id: adminId, name: 'Admin', role: 'admin', isActive: true, tokenVersion: 0 })
      : makeQuery(null)
  );
  SupportMessage.aggregate = async () => [
    {
      student: { _id: new mongoose.Types.ObjectId(), name: 'طالب 1', email: 's1@example.com', phone: '01011112222' },
      latest: { _id: new mongoose.Types.ObjectId(), senderRole: 'student', text: 'سؤال عن الباقة', createdAt: new Date() },
      unread: 3,
    },
    {
      student: { _id: new mongoose.Types.ObjectId(), name: 'طالب 2', email: 's2@example.com' },
      latest: { _id: new mongoose.Types.ObjectId(), senderRole: 'admin', text: 'تم التفعيل', createdAt: new Date() },
      unread: 0,
    },
  ];
  ContactMessage.find = () => makeQuery([
    { _id: msgId, name: 'ولي أمر', email: 'p@example.com', subject: 'استفسار', message: 'تفاصيل', status: 'new' },
  ]);
  ContactMessage.countDocuments = async () => 1;
  ContactMessage.aggregate = async () => [
    { _id: 'new', count: 2 },
    { _id: 'replied', count: 5 },
  ];
  ContactMessage.findByIdAndUpdate = async (_id, update) => ({
    _id: msgId,
    name: 'ولي أمر',
    status: update.status,
  });
  AdminAuditLog.create = async (entry) => {
    audits.push(entry);
    return entry;
  };

  try {
    const inboxRes = await request('/api/support/inbox', { token: adminToken });
    assert.equal(inboxRes.status, 200);
    assert.equal(inboxRes.data.summary.unreadConversations, 1);
    assert.equal(inboxRes.data.summary.unreadMessages, 3);
    assert.equal(inboxRes.data.conversations[0].student.email, 's1@example.com');

    const contactList = await request('/api/contact?q=استفسار&status=new', { token: adminToken });
    assert.equal(contactList.status, 200);
    assert.equal(contactList.data.summary.new, 2);
    assert.equal(contactList.data.summary.replied, 5);
    assert.equal(contactList.data.summary.totalAll, 7);

    const badStatusId = await request('/api/contact/not-an-oid/status', {
      method: 'PUT',
      token: adminToken,
      body: { status: 'read' },
    });
    assert.equal(badStatusId.status, 400);

    const statusUpdate = await request(`/api/contact/${msgId}/status`, {
      method: 'PUT',
      token: adminToken,
      body: { status: 'closed' },
    });
    assert.equal(statusUpdate.status, 200);
    assert.equal(statusUpdate.data.status, 'closed');
    assert.ok(audits.some((a) => a.action === 'contact_message.status.closed'));
  } finally {
    User.findById = origUserFindById;
    SupportMessage.aggregate = origSupportAgg;
    ContactMessage.find = origContactFind;
    ContactMessage.countDocuments = origContactCount;
    ContactMessage.aggregate = origContactAgg;
    ContactMessage.findByIdAndUpdate = origContactUpdate;
    AdminAuditLog.create = origAuditCreate;
  }
});

test('Analytics admin endpoints support maxStep filter and expose academyConversion metrics', async () => {
  const origUserFindById = User.findById;
  const origVisitAgg = SiteVisit.aggregate;
  const origVisitCount = SiteVisit.countDocuments;
  const origFunnelAgg = TeacherFunnelSession.aggregate;
  const origFunnelCount = TeacherFunnelSession.countDocuments;
  const origFunnelFind = TeacherFunnelSession.find;
  const origTrialCount = TrialRequest.countDocuments;
  const origSubCount = StudentSubscription.countDocuments;

  const adminId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });

  User.findById = () => makeQuery({ _id: adminId, role: 'admin', isActive: true, tokenVersion: 0 });
  SiteVisit.aggregate = async () => [];
  SiteVisit.countDocuments = async () => 0;
  TeacherFunnelSession.aggregate = async () => [];
  TeacherFunnelSession.countDocuments = async () => 1;

  let capturedFunnelMatch = null;
  TeacherFunnelSession.find = (match) => {
    capturedFunnelMatch = match;
    return makeQuery([{ sessionId: 'tf_step4', status: 'in_progress', maxStep: 4, fullName: 'معلم 4' }]);
  };
  TrialRequest.countDocuments = async (filter = {}) => {
    if (filter.status === 'scheduled') return 6;
    if (filter.status === 'completed') return 10;
    return 20;
  };
  StudentSubscription.countDocuments = async () => 15;

  try {
    const ov = await request('/api/analytics/admin/overview?days=30', { token: adminToken });
    assert.equal(ov.status, 200);
    assert.equal(ov.data.academyConversion.trialsRequested, 20);
    assert.equal(ov.data.academyConversion.trialsScheduled, 6);
    assert.equal(ov.data.academyConversion.trialsCompleted, 10);
    assert.equal(ov.data.academyConversion.trialCompletionRate, 50);
    assert.equal(ov.data.academyConversion.activeSubscriptions, 15);

    const fn = await request('/api/analytics/admin/teacher-funnel?days=30&status=in_progress&maxStep=4&limit=150', {
      token: adminToken,
    });
    assert.equal(fn.status, 200);
    assert.equal(capturedFunnelMatch.status, 'in_progress');
    assert.equal(capturedFunnelMatch.maxStep, 4);
    assert.equal(fn.data.pagination.limit, 150);
  } finally {
    User.findById = origUserFindById;
    SiteVisit.aggregate = origVisitAgg;
    SiteVisit.countDocuments = origVisitCount;
    TeacherFunnelSession.aggregate = origFunnelAgg;
    TeacherFunnelSession.countDocuments = origFunnelCount;
    TeacherFunnelSession.find = origFunnelFind;
    TrialRequest.countDocuments = origTrialCount;
    StudentSubscription.countDocuments = origSubCount;
  }
});
