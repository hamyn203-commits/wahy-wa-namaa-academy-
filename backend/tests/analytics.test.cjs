'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

const mongoose = require('mongoose');
const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');
const SiteVisit = require('../models/SiteVisit');
const TeacherFunnelSession = require('../models/TeacherFunnelSession');
const User = require('../models/User');

function makeQuery(value) {
  const q = {
    select() { return q; },
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return q;
}

const server = http.createServer(app);
let baseUrl = '';

const serverReady = new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  await serverReady;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('POST /api/analytics/visit records normalized mobile-app & web visits and ignores /admin', async () => {
  const origCreate = SiteVisit.create;
  const recorded = [];
  SiteVisit.create = async (doc) => {
    recorded.push(doc);
    return doc;
  };

  try {
    // 1) Android app visit with header platform
    const r1 = await request('/api/analytics/visit', {
      method: 'POST',
      headers: { 'X-App-Platform': 'android', 'X-App-Version': '1.2.0' },
      body: {
        visitorId: 'v_android_1',
        sessionId: 's_android_1',
        path: '/ar/plans',
        source: 'whatsapp',
      },
    });
    assert.equal(r1.status, 202);
    assert.equal(r1.data.ok, true);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].path, '/plans');
    assert.equal(recorded[0].locale, 'ar');
    assert.equal(recorded[0].platform, 'android');
    assert.equal(recorded[0].appVersion, '1.2.0');
    assert.equal(recorded[0].deviceType, 'mobile');
    assert.equal(recorded[0].source, 'whatsapp');
    assert.ok(Number.isInteger(recorded[0].hourLocal) && recorded[0].hourLocal >= 0 && recorded[0].hourLocal <= 23);
    assert.ok(!String(recorded[0].ipHash).includes('127.0.0.1'), 'Raw IP must never be stored');

    // 2) Internal /admin visit is ignored
    const r2 = await request('/api/analytics/visit', {
      method: 'POST',
      body: { path: '/ar/admin?tab=analytics' },
    });
    assert.equal(r2.status, 202);
    assert.equal(r2.data.ignored, true);
    assert.equal(recorded.length, 1);
  } finally {
    SiteVisit.create = origCreate;
  }
});

test('POST /api/analytics/teacher-funnel tracks visited -> in_progress -> submitted and strips passwords', async () => {
  const origFindOne = TeacherFunnelSession.findOne;
  const origFindOneAndUpdate = TeacherFunnelSession.findOneAndUpdate;
  const store = new Map();

  TeacherFunnelSession.findOne = async ({ sessionId }) => store.get(sessionId) || null;
  TeacherFunnelSession.findOneAndUpdate = async ({ sessionId }, update) => {
    const prev = store.get(sessionId) || { ...(update.$setOnInsert || {}) };
    const next = { ...prev, ...(update.$set || {}) };
    store.set(sessionId, next);
    return next;
  };

  try {
    // Missing sessionId -> 400
    const bad = await request('/api/analytics/teacher-funnel', {
      method: 'POST',
      body: { step: 1 },
    });
    assert.equal(bad.status, 400);

    // Step 1 open only -> status = visited
    const open = await request('/api/analytics/teacher-funnel', {
      method: 'POST',
      body: { sessionId: 'tf_session_001', visitorId: 'v_1', event: 'page_open', step: 1, source: 'facebook' },
    });
    assert.equal(open.status, 202);
    assert.equal(open.data.status, 'visited');
    assert.equal(open.data.maxStep, 1);

    // Halfway with contact info + accidental password field -> status = in_progress, password stripped
    const mid = await request('/api/analytics/teacher-funnel', {
      method: 'POST',
      body: {
        sessionId: 'tf_session_001',
        visitorId: 'v_1',
        event: 'step_3',
        step: 3,
        touchedFieldsCount: 6,
        fullName: 'الشيخ أحمد محمد',
        email: 'AHMED@example.com',
        phone: '01001234567',
        password: 'SuperSecretPassword123!',
        verificationCode: '123456',
      },
    });
    assert.equal(mid.status, 202);
    assert.equal(mid.data.status, 'in_progress');
    assert.equal(mid.data.maxStep, 3);
    const savedMid = store.get('tf_session_001');
    assert.equal(savedMid.fullName, 'الشيخ أحمد محمد');
    assert.equal(savedMid.email, 'ahmed@example.com');
    assert.equal(savedMid.password, undefined);
    assert.equal(savedMid.verificationCode, undefined);

    // Submitted -> status = submitted
    const done = await request('/api/analytics/teacher-funnel', {
      method: 'POST',
      body: { sessionId: 'tf_session_001', visitorId: 'v_1', event: 'submitted', step: 5, emailVerified: true },
    });
    assert.equal(done.status, 202);
    assert.equal(done.data.status, 'submitted');
    assert.equal(done.data.maxStep, 5);

    // Subsequent stray event must NOT regress submitted back to in_progress
    const late = await request('/api/analytics/teacher-funnel', {
      method: 'POST',
      body: { sessionId: 'tf_session_001', visitorId: 'v_1', event: 'step_2', step: 2 },
    });
    assert.equal(late.status, 202);
    assert.equal(late.data.status, 'submitted');
    assert.equal(late.data.maxStep, 5);
  } finally {
    TeacherFunnelSession.findOne = origFindOne;
    TeacherFunnelSession.findOneAndUpdate = origFindOneAndUpdate;
  }
});

test('Admin analytics endpoints enforce admin RBAC and return peak hours + funnel data', async () => {
  const origUserFindById = User.findById;
  const origVisitAgg = SiteVisit.aggregate;
  const origVisitCount = SiteVisit.countDocuments;
  const origFunnelAgg = TeacherFunnelSession.aggregate;
  const origFunnelCount = TeacherFunnelSession.countDocuments;
  const origFunnelFind = TeacherFunnelSession.find;

  const adminId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const adminToken = generateAccessToken({ id: adminId.toString(), role: 'admin', tokenVersion: 0 });
  const studentToken = generateAccessToken({ id: studentId.toString(), role: 'student', tokenVersion: 0 });

  User.findById = (id) => {
    const str = String(id);
    if (str === adminId.toString()) {
      return makeQuery({ _id: adminId, role: 'admin', isActive: true, tokenVersion: 0 });
    }
    if (str === studentId.toString()) {
      return makeQuery({ _id: studentId, role: 'student', isActive: true, tokenVersion: 0 });
    }
    return makeQuery(null);
  };

  let visitAggCall = 0;
  SiteVisit.aggregate = async () => {
    visitAggCall += 1;
    switch (visitAggCall) {
      case 1: return [{ totalVisits: 120, uniqueVisitors: 54 }];
      case 2: return [{ todayVisits: 18, todayUniqueVisitors: 11 }];
      case 3: return [{ hour: 21, visits: 35, uniqueVisitors: 20 }, { hour: 10, visits: 8, uniqueVisitors: 6 }];
      case 4: return [{ date: '2026-11-20', visits: 18, uniqueVisitors: 11 }];
      case 5: return [{ dayOfWeek: 5, visits: 40 }];
      case 6: return [{ platform: 'web', visits: 95, uniqueVisitors: 44 }, { platform: 'android', visits: 25, uniqueVisitors: 10 }];
      case 7: return [{ deviceType: 'mobile', visits: 85 }, { deviceType: 'desktop', visits: 35 }];
      case 8: return [{ path: '/', visits: 60, uniqueVisitors: 35 }];
      case 9: return [{ source: 'whatsapp', visits: 50 }];
      default: return [];
    }
  };
  SiteVisit.countDocuments = async () => 22;

  let funnelAggCall = 0;
  TeacherFunnelSession.aggregate = async () => {
    funnelAggCall += 1;
    // Call 1 comes from /admin/overview; calls 2-4 come from /admin/teacher-funnel
    if (funnelAggCall === 1) {
      return [
        { _id: 'visited', count: 10 },
        { _id: 'in_progress', count: 6 },
        { _id: 'submitted', count: 4 },
      ];
    }
    if (funnelAggCall === 2) {
      return [
        { _id: 'visited', count: 10 },
        { _id: 'in_progress', count: 6 },
        { _id: 'submitted', count: 4 },
      ];
    }
    if (funnelAggCall === 3) {
      return [{
        total: 20, step1: 20, step2: 10, step3: 8, step4: 6, step5: 4, submitted: 4,
        stoppedAt1Empty: 10, stoppedAt1Started: 0, stoppedAt2: 2, stoppedAt3: 2, stoppedAt4: 2, stoppedAt5: 0,
      }];
    }
    return [{ source: 'whatsapp', total: 14, submitted: 3 }];
  };
  TeacherFunnelSession.countDocuments = async () => 2;
  TeacherFunnelSession.find = () => makeQuery([
    { sessionId: 'tf_1', status: 'in_progress', maxStep: 4, fullName: 'أحمد علي', phone: '01001112223', platform: 'web' },
    { sessionId: 'tf_2', status: 'visited', maxStep: 1, fullName: '', platform: 'android' },
  ]);

  try {
    // Unauthenticated -> 401
    const unauth = await request('/api/analytics/admin/overview');
    assert.equal(unauth.status, 401);

    // Non-admin -> 403
    const forbidden = await request('/api/analytics/admin/overview', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(forbidden.status, 403);

    const forbiddenFunnel = await request('/api/analytics/admin/teacher-funnel', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(forbiddenFunnel.status, 403);

    // Admin overview -> 200 with peakHour === 21 & all 4 platforms present
    const ov = await request('/api/analytics/admin/overview?days=30', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(ov.status, 200);
    assert.equal(ov.data.summary.totalVisits, 120);
    assert.equal(ov.data.summary.peakHour.hour, 21);
    assert.equal(ov.data.summary.peakHour.visits, 35);
    assert.equal(ov.data.hourlyDistribution.length, 24);
    assert.deepEqual(ov.data.byPlatform.map((p) => p.platform), ['web', 'pwa', 'android', 'ios']);
    assert.equal(ov.data.teacherFunnelSummary.total, 20);
    assert.equal(ov.data.teacherFunnelSummary.completionRate, 20);

    // Admin teacher funnel -> 200 with summary, 6 step buckets, and sessions
    const fn = await request('/api/analytics/admin/teacher-funnel?days=30', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(fn.status, 200);
    assert.equal(fn.data.summary.total, 20);
    assert.equal(fn.data.summary.visitedOnly, 10);
    assert.equal(fn.data.summary.inProgress, 6);
    assert.equal(fn.data.summary.submitted, 4);
    assert.equal(fn.data.stepBreakdown.length, 6);
    assert.equal(fn.data.sessions.length, 2);
  } finally {
    User.findById = origUserFindById;
    SiteVisit.aggregate = origVisitAgg;
    SiteVisit.countDocuments = origVisitCount;
    TeacherFunnelSession.aggregate = origFunnelAgg;
    TeacherFunnelSession.countDocuments = origFunnelCount;
    TeacherFunnelSession.find = origFunnelFind;
  }
});
