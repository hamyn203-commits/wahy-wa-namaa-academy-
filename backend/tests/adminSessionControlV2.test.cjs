'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'development';

const User = require('../models/User');
const Session = require('../models/Session');
const LiveSession = require('../models/LiveSession');
const Review = require('../models/Review');
const AdminAuditLog = require('../models/AdminAuditLog');

const originalReadyState = mongoose.connection.readyState;
const oid = () => new mongoose.Types.ObjectId().toString();

function chainQuery(rows) {
  const query = {
    populate() { return query; },
    select() { return query; },
    sort() { return query; },
    limit() { return query; },
    lean() { return query; },
    catch() { return Promise.resolve(rows); },
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
  return query;
}

test('Admin Sessions Command Center V2 returns accurate live telemetry, 1-on-1 teacherEvaluation reports, ratings, and audit-logged admin actions', async (t) => {
  const ids = {
    admin: oid(),
    student: oid(),
    teacherUser: oid(),
    teacher: oid(),
    liveTrialSession: oid(),
    pendingRegularSession: oid(),
    evaluatedTrialSession: oid(),
    unreportedCompletedSession: oid(),
  };

  const users = {
    admin: { _id: ids.admin, id: ids.admin, email: 'admin@example.test', role: 'admin' },
    student: { _id: ids.student, id: ids.student, email: 'student@example.test', role: 'student' },
  };

  const origUserFindById = User.findById;
  const origSessionFind = Session.find;
  const origSessionCount = Session.countDocuments;
  const origSessionFindById = Session.findById;
  const origLiveFind = LiveSession.find;
  const origReviewFind = Review.find;
  const origAuditCreate = AdminAuditLog.create;

  const auditLogs = [];
  const nowIso = new Date().toISOString();

  const sessionStore = new Map([
    [
      ids.liveTrialSession,
      {
        _id: ids.liveTrialSession,
        type: 'trial',
        status: 'accepted',
        scheduledAt: nowIso,
        duration: 30,
        timezone: 'Africa/Cairo',
        student: { _id: ids.student, name: 'حسام أمين', email: 'hossam@example.test' },
        teacher: {
          _id: ids.teacher,
          user: { _id: ids.teacherUser, name: 'الشيخ محمد عبدالله', email: 't@example.test' },
          personalInfo: { fullName: 'الشيخ محمد عبدالله' },
        },
        attendance: [],
        studentReports: [],
        meetingLink: `/live/session_${ids.liveTrialSession}`,
      },
    ],
    [
      ids.pendingRegularSession,
      {
        _id: ids.pendingRegularSession,
        type: 'regular',
        status: 'pending',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        duration: 60,
        timezone: 'Africa/Cairo',
        student: { _id: ids.student, name: 'حسام الفقي', email: 'feki@example.test' },
        teacher: {
          _id: ids.teacher,
          user: { _id: ids.teacherUser, name: 'الشيخ محمد عبدالله', email: 't@example.test' },
          personalInfo: { fullName: 'الشيخ محمد عبدالله' },
        },
        attendance: [],
        studentReports: [],
        async save() {
          return this;
        },
      },
    ],
    [
      ids.evaluatedTrialSession,
      {
        _id: ids.evaluatedTrialSession,
        type: 'trial',
        status: 'completed',
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        timezone: 'Africa/Cairo',
        student: { _id: ids.student, name: 'عمر خالد', email: 'omar@example.test' },
        teacher: {
          _id: ids.teacher,
          user: { _id: ids.teacherUser, name: 'الشيخ محمد عبدالله', email: 't@example.test' },
          personalInfo: { fullName: 'الشيخ محمد عبدالله' },
        },
        teacherEvaluation: {
          memorization: 5,
          tajweed: 4,
          surahRecited: 'سورة الملك',
          recommendedLevel: 'intermediate',
          recommendedTrack: 'memorization',
          overallNotes: 'تلاوة متقنة جداً',
        },
        studentFeedback: {
          rating: 5,
          comment: 'شرح رائع',
          wouldContinue: true,
        },
        attendance: [],
        studentReports: [],
      },
    ],
    [
      ids.unreportedCompletedSession,
      {
        _id: ids.unreportedCompletedSession,
        type: 'regular',
        status: 'completed',
        scheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        duration: 60,
        timezone: 'Africa/Cairo',
        student: { _id: ids.student, name: 'بلال أحمد', email: 'bilal@example.test' },
        teacher: {
          _id: ids.teacher,
          user: { _id: ids.teacherUser, name: 'الشيخ محمد عبدالله', email: 't@example.test' },
          personalInfo: { fullName: 'الشيخ محمد عبدالله' },
        },
        attendance: [],
        studentReports: [],
      },
    ],
  ]);

  User.findById = (id) => {
    const u = Object.values(users).find((item) => String(item._id) === String(id));
    return chainQuery(u ? { ...u, isActive: true } : null);
  };

  Session.find = (filter = {}) => {
    let list = Array.from(sessionStore.values());
    if (filter.status && typeof filter.status === 'string') {
      list = list.filter((s) => s.status === filter.status);
    }
    if (filter.type && typeof filter.type === 'string') {
      list = list.filter((s) => s.type === filter.type);
    }
    return chainQuery(list);
  };

  Session.countDocuments = async (filter = {}) => {
    if (filter.status === 'pending') return 1;
    if (filter.status === 'accepted' && filter.scheduledAt?.$lt) return 0;
    if (filter.status === 'completed' && filter.$and) return 1;
    if (filter.status === 'completed') return 2;
    return sessionStore.size;
  };

  Session.findById = (id) => chainQuery(sessionStore.get(String(id)) || null);

  LiveSession.find = () =>
    chainQuery([
      {
        session: ids.liveTrialSession,
        roomId: 'room_live_trial_1',
        isLive: true,
        endedAt: null,
        classroomState: {
          mushaf: { page: 582 },
          engagement: { totalStars: 6 },
          controls: { sessionEnded: false },
        },
      },
    ]);

  Review.find = () =>
    chainQuery([
      {
        session: ids.evaluatedTrialSession,
        student: ids.student,
        rating: 5,
        comment: 'بارك الله في الشيخ',
      },
    ]);

  AdminAuditLog.create = async (entry) => {
    auditLogs.push(entry);
    return entry;
  };

  delete require.cache[require.resolve('../routes/admin')];
  const adminRouter = require('../routes/admin');
  const { generateAccessToken } = require('../middleware/auth');
  mongoose.connection.readyState = 1;

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    User.findById = origUserFindById;
    Session.find = origSessionFind;
    Session.countDocuments = origSessionCount;
    Session.findById = origSessionFindById;
    LiveSession.find = origLiveFind;
    Review.find = origReviewFind;
    AdminAuditLog.create = origAuditCreate;
    mongoose.connection.readyState = originalReadyState;
    delete require.cache[require.resolve('../routes/admin')];
  });

  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, path, user, body) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + generateAccessToken(user),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  // 1. Non-admin fails closed with 403
  const forbidden = await call('GET', '/api/admin/session-control?focus=all', users.student);
  assert.equal(forbidden.status, 403);

  // 2. Admin reads rich Session Command Center payload
  const allRes = await call('GET', '/api/admin/session-control?focus=all', users.admin);
  assert.equal(allRes.status, 200);
  assert.equal(allRes.data.summary.liveCount, 1);
  assert.equal(allRes.data.summary.pendingCount, 1);
  assert.equal(allRes.data.summary.missingReportsCount, 1);
  assert.equal(allRes.data.summary.avgRating, 5);

  const byId = new Map(allRes.data.sessions.map((s) => [String(s._id), s]));

  // Live session has active telemetry & canObserveLive = true
  const liveRow = byId.get(ids.liveTrialSession);
  assert.equal(liveRow.liveRoom.isLive, true);
  assert.equal(liveRow.liveRoom.mushafPage, 582);
  assert.equal(liveRow.liveRoom.totalStars, 6);
  assert.equal(liveRow.canObserveLive, true);

  // Pending session NEVER exposes fake observer entry before acceptance
  const pendingRow = byId.get(ids.pendingRegularSession);
  assert.equal(pendingRow.canObserveLive, false);

  // Evaluated 1-on-1 trial session accurately reports hasTeacherReport = true & reportCount = 1 + studentRating
  const evalRow = byId.get(ids.evaluatedTrialSession);
  assert.equal(evalRow.hasTeacherReport, true);
  assert.equal(evalRow.reportCount, 1);
  assert.equal(evalRow.teacherEvaluation.surahRecited, 'سورة الملك');
  assert.equal(evalRow.studentRating.average, 5);
  assert.equal(evalRow.studentRating.wouldContinue, true);

  // Unreported 1-on-1 completed session accurately reports hasTeacherReport = false
  const unreportedRow = byId.get(ids.unreportedCompletedSession);
  assert.equal(unreportedRow.hasTeacherReport, false);
  assert.equal(unreportedRow.reportCount, 0);

  // 3. Admin nudges teacher & confirms pending session with audit trail
  const nudgeRes = await call(
    'POST',
    `/api/admin/session-control/${ids.pendingRegularSession}/nudge-teacher`,
    users.admin,
    { note: 'يرجى تأكيد موعد الطالب' }
  );
  assert.equal(nudgeRes.status, 200);

  const acceptRes = await call(
    'PUT',
    `/api/admin/session-control/${ids.pendingRegularSession}/status`,
    users.admin,
    { status: 'accepted', reason: 'تأكيد إداري للموعد' }
  );
  assert.equal(acceptRes.status, 200);
  assert.equal(sessionStore.get(ids.pendingRegularSession).status, 'accepted');
  assert.ok(sessionStore.get(ids.pendingRegularSession).meetingLink);
  assert.ok(auditLogs.some((a) => a.action === 'session-control.nudge-teacher'));
  assert.ok(auditLogs.some((a) => a.action === 'session-control.status.accepted'));
});
