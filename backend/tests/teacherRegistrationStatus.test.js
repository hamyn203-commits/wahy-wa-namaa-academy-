'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = 'c3-teacher-status-access-secret-1234567890-abc';
process.env.JWT_REFRESH_SECRET = 'c3-teacher-status-refresh-secret-1234567890-abc';
delete process.env.MONGODB_URI;
delete process.env.MONGODB_URL;

const app = require('../app');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const AdminAuditLog = require('../models/AdminAuditLog');
const { getAccessSecret, generateAccessToken } = require('../middleware/auth');

function requestJson(server, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function chainable(result) {
  return {
    select() { return this; },
    lean: async () => result,
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

test('POST /api/teachers/application-status keeps polling after admin request-changes and reject revoke login sessions', async () => {
  const adminId = '507f1f77bcf86cd799439001';
  const teacherUserId = '507f1f77bcf86cd799439002';
  const teacherId = '507f1f77bcf86cd799439003';

  const originalReadyState = mongoose.connection.readyState;
  const originals = {
    userFindById: User.findById,
    userFindByIdAndUpdate: User.findByIdAndUpdate,
    teacherFindById: Teacher.findById,
    teacherFindOne: Teacher.findOne,
    auditCreate: AdminAuditLog.create,
  };

  let teacherUserDoc = {
    _id: teacherUserId,
    name: 'الشيخ أحمد',
    email: 'teacher.status.test@wahy.test',
    role: 'teacher',
    isActive: true,
    refreshTokenVersion: 0,
    sessionsRevokedAt: null,
  };

  let teacherDoc = {
    _id: teacherId,
    user: teacherUserId,
    status: 'pending',
    isVerified: false,
    updatedAt: new Date('2026-11-19T07:00:00Z'),
    reviewNotes: [],
    reviewChecklist: [
      { key: 'recitation-video', status: 'changes-requested', note: 'يرجى تحسين جودة الصوت' },
    ],
    media: {},
    async save() {
      this.updatedAt = new Date();
      return this;
    },
  };

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

  User.findById = (id) => {
    if (String(id) === adminId) {
      return chainable({
        _id: adminId,
        role: 'admin',
        isActive: true,
        refreshTokenVersion: 0,
        sessionsRevokedAt: null,
      });
    }
    if (String(id) === teacherUserId) {
      return chainable({ ...teacherUserDoc });
    }
    return chainable(null);
  };

  User.findByIdAndUpdate = (id, update) => {
    if (String(id) === teacherUserId) {
      if (update?.$inc?.refreshTokenVersion) {
        teacherUserDoc.refreshTokenVersion += Number(update.$inc.refreshTokenVersion);
      }
      if (update?.$set?.sessionsRevokedAt) {
        teacherUserDoc.sessionsRevokedAt = update.$set.sessionsRevokedAt;
      }
      return chainable({ ...teacherUserDoc });
    }
    return chainable(null);
  };

  Teacher.findById = (id) => {
    if (String(id) === teacherId) return Promise.resolve(teacherDoc);
    return Promise.resolve(null);
  };

  Teacher.findOne = (query) => {
    if (
      query &&
      String(query._id) === teacherId &&
      String(query.user) === teacherUserId
    ) {
      return chainable({ ...teacherDoc });
    }
    return chainable(null);
  };

  AdminAuditLog.create = async (payload) => ({ _id: '507f1f77bcf86cd799439099', ...payload });

  const adminToken = generateAccessToken({
    _id: adminId,
    email: 'admin.status.test@wahy.test',
    role: 'admin',
    refreshTokenVersion: 0,
  });

  // Issue both a polling token AND a normal teacher login token BEFORE review revokes sessions.
  const issuedAtBeforeRevoke = Math.floor(Date.now() / 1000) - 60;
  const applicationStatusToken = jwt.sign(
    {
      purpose: 'teacher-application-status',
      userId: teacherUserId,
      teacherId,
      email: teacherUserDoc.email,
      iat: issuedAtBeforeRevoke,
    },
    getAccessSecret(),
    { expiresIn: '7d' }
  );
  const teacherLoginToken = jwt.sign(
    {
      typ: 'access',
      id: teacherUserId,
      email: teacherUserDoc.email,
      role: 'teacher',
      v: 0,
      iat: issuedAtBeforeRevoke,
    },
    getAccessSecret(),
    { expiresIn: '1h' }
  );

  const server = app.listen(0);
  try {
    // 1. Admin requests changes -> sets sessionsRevokedAt on teacher user and moves teacher to under-review
    const reqChangesRes = await requestJson(
      server,
      'PUT',
      `/api/teachers/admin/${teacherId}/review`,
      { action: 'request-changes', note: 'أعد رفع فيديو التلاوة بصوت واضح' },
      adminToken
    );
    assert.equal(reqChangesRes.status, 200);
    assert.equal(reqChangesRes.body?.applicationStatus, 'under-review');
    assert.ok(teacherUserDoc.sessionsRevokedAt instanceof Date);

    // 2. Normal login token issued before request-changes MUST still be revoked by auth middleware
    const revokedAuthRes = await requestJson(
      server,
      'GET',
      '/api/auth/me',
      null,
      teacherLoginToken
    );
    assert.equal(revokedAuthRes.status, 401);

    // 3. Dedicated application-status polling token MUST still succeed and surface under-review feedback
    const pollChangesRes = await requestJson(
      server,
      'POST',
      '/api/teachers/application-status',
      { token: applicationStatusToken }
    );
    assert.equal(pollChangesRes.status, 200);
    assert.equal(pollChangesRes.body?.applicationStatus, 'under-review');
    assert.equal(pollChangesRes.body?.approved, false);
    assert.equal(pollChangesRes.body?.reviewNote, 'أعد رفع فيديو التلاوة بصوت واضح');
    assert.equal(pollChangesRes.body?.requestedChanges?.length, 1);
    assert.equal(pollChangesRes.body?.requestedChanges?.[0]?.key, 'recitation-video');

    // 4. Admin rejects application -> sets sessionsRevokedAt again and moves teacher to rejected
    const rejectRes = await requestJson(
      server,
      'PUT',
      `/api/teachers/admin/${teacherId}/review`,
      { action: 'reject', note: 'عدم استيفاء شروط التلاوة' },
      adminToken
    );
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body?.applicationStatus, 'rejected');

    // 5. Same applicationStatusToken continues to report rejected status and note
    const pollRejectRes = await requestJson(
      server,
      'POST',
      '/api/teachers/application-status',
      { token: applicationStatusToken }
    );
    assert.equal(pollRejectRes.status, 200);
    assert.equal(pollRejectRes.body?.applicationStatus, 'rejected');
    assert.equal(pollRejectRes.body?.approved, false);
    assert.equal(pollRejectRes.body?.reviewNote, 'عدم استيفاء شروط التلاوة');

    // 6. Wrong-purpose token and inactive account still fail closed
    const wrongPurposeRes = await requestJson(
      server,
      'POST',
      '/api/teachers/application-status',
      { token: teacherLoginToken }
    );
    assert.equal(wrongPurposeRes.status, 400);

    teacherUserDoc = { ...teacherUserDoc, isActive: false };
    const inactiveRes = await requestJson(
      server,
      'POST',
      '/api/teachers/application-status',
      { token: applicationStatusToken }
    );
    assert.equal(inactiveRes.status, 403);
  } finally {
    server.close();
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    User.findById = originals.userFindById;
    User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
    Teacher.findById = originals.teacherFindById;
    Teacher.findOne = originals.teacherFindOne;
    AdminAuditLog.create = originals.auditCreate;
  }
});
