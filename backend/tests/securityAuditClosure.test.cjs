'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../app');
const { generateAccessToken, getAccessSecret } = require('../middleware/auth');
const { addMockTeacher } = require('../mockStore');
const Guardian = require('../models/Guardian');
const Session = require('../models/Session');
const TeacherTask = require('../models/TeacherTask');
const Teacher = require('../models/Teacher');
const GroupCircle = require('../models/GroupCircle');
const Notification = require('../models/Notification');

function requestJson(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined
      ? (Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)))
      : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          ...(payload && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
          ...(payload ? { 'Content-Length': payload.length } : {}),
          ...headers,
        },
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
          resolve({ status: res.statusCode, headers: res.headers, body: json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('Batch 1 Security Closure: Express 5 query/body sanitizer, guardian RBAC & redaction, teacher notification isolation, and password policy', async () => {
  const server = app.listen(0);
  const originals = {
    guardianFind: Guardian.find,
    guardianFindOne: Guardian.findOne,
    sessionCount: Session.countDocuments,
    sessionFind: Session.find,
    taskCount: TeacherTask.countDocuments,
    teacherFindOne: Teacher.findOne,
    circleFind: GroupCircle.find,
    notificationSendBulk: Notification.sendBulk,
    notificationCount: Notification.countDocuments,
    notificationAggregate: Notification.aggregate,
    notificationFind: Notification.find,
  };

  try {
    const studentId = '507f1f77bcf86cd799439021';
    const otherStudentId = '507f1f77bcf86cd799439022';
    const guardianUserId = '507f1f77bcf86cd799439023';
    const teacherUserId = '507f1f77bcf86cd799439024';
    const teacherProfileId = '507f1f77bcf86cd799439025';
    const adminUserId = '507f1f77bcf86cd799439026';

    addMockTeacher({
      _id: teacherProfileId,
      user: teacherUserId,
      status: 'approved',
      isVerified: true,
    });

    const studentToken = generateAccessToken({ id: studentId, email: 's1@example.com', role: 'student' });
    const otherStudentToken = generateAccessToken({ id: otherStudentId, email: 's2@example.com', role: 'student' });
    const guardianToken = generateAccessToken({ id: guardianUserId, email: 'g1@example.com', role: 'guardian' });
    const teacherToken = generateAccessToken({ id: teacherUserId, email: 't1@example.com', role: 'teacher' });
    const adminToken = generateAccessToken({ id: adminUserId, email: 'a1@example.com', role: 'admin' });

    // 1. Express 5 req.query + req.body NoSQL operator & XSS sanitization on real mounted sub-routers
    let capturedNotifFilter = null;
    Notification.find = (filter) => {
      capturedNotifFilter = filter;
      const chain = {
        populate: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: async () => [],
      };
      return chain;
    };
    Notification.countDocuments = async () => 0;

    const querySanitizeRes = await requestJson(
      server,
      'GET',
      '/api/notifications?$where=evil&type=%3Cscript%3Ealert(1)%3C/script%3Esystem',
      {
        headers: { Authorization: `Bearer ${studentToken}` },
      }
    );
    assert.equal(querySanitizeRes.status, 200);
    assert.equal(capturedNotifFilter.type, 'system');

    let capturedBulkPayload = null;
    Notification.sendBulk = async (ids, payload) => {
      capturedBulkPayload = payload;
      return ids.map((id) => ({ user: id, ...payload }));
    };
    const bodySanitizeRes = await requestJson(server, 'POST', '/api/notifications/send', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        userIds: [studentId],
        notification: {
          title: '<script>evil()</script>عنوان آمن',
          message: '<img onerror=alert(1)>رسالة آمنة',
          $where: 'malicious()',
        },
      },
    });
    assert.equal(bodySanitizeRes.status, 201);
    assert.equal(capturedBulkPayload.title.ar.includes('<script'), false);
    assert.equal(capturedBulkPayload.message.ar.includes('onerror='), false);
    assert.equal(Object.prototype.hasOwnProperty.call(capturedBulkPayload, '$where'), false);

    // 2. Guardian cannot self-escalate permissions via PUT /api/guardians/permissions/:studentId
    const selfEscalateRes = await requestJson(server, 'PUT', `/api/guardians/permissions/${studentId}`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
      body: { permissions: { viewGrades: true, approveEnrollments: true } },
    });
    assert.equal(selfEscalateRes.status, 403);

    // Other student cannot modify another student's guardian permissions
    const crossStudentRes = await requestJson(server, 'PUT', `/api/guardians/permissions/${studentId}`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
      body: { permissions: { viewGrades: true } },
    });
    assert.equal(crossStudentRes.status, 403);

    // Owning student CAN update their linked guardian's permissions
    let updatedPermissionsArgs = null;
    Guardian.find = async () => [
      {
        _id: '507f1f77bcf86cd799439099',
        children: [{ student: studentId }],
        updatePermissions: async (sid, perms) => {
          updatedPermissionsArgs = { sid, perms };
        },
      },
    ];
    const ownerGrantRes = await requestJson(server, 'PUT', `/api/guardians/permissions/${studentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { permissions: { viewGrades: true, viewAttendance: true } },
    });
    assert.equal(ownerGrantRes.status, 200);
    assert.deepEqual(updatedPermissionsArgs, {
      sid: studentId,
      perms: { viewGrades: true, viewAttendance: true },
    });

    // 3. Guardian weekly-summary redacts meetingLink, recordingUrl, classmate attendance, and grades when viewGrades=false
    Guardian.findOne = async () => ({
      user: guardianUserId,
      children: [
        {
          student: studentId,
          permissions: {
            viewProgress: true,
            viewAttendance: true,
            viewGrades: false,
            receiveNotifications: true,
            approveEnrollments: false,
          },
        },
      ],
    });
    Session.countDocuments = async () => 2;
    TeacherTask.countDocuments = async () => 1;
    Session.find = () => ({
      populate: () => ({
        sort: () => ({
          limit: async () => [
            {
              _id: '507f1f77bcf86cd799439088',
              type: 'group_circle',
              status: 'completed',
              scheduledAt: new Date().toISOString(),
              duration: 45,
              timezone: 'Africa/Cairo',
              meetingLink: '/live/secret-room-link',
              recordingUrl: 'https://private.blob/secret.mp4',
              report: { rating: 5, notes: 'Private grade note' },
              teacherEvaluation: { memorizationScore: 98 },
              attendance: [
                { student: studentId, status: 'attended' },
                { student: otherStudentId, status: 'absent' },
              ],
              teacher: { _id: teacherProfileId, user: { name: 'الشيخ أحمد' } },
            },
          ],
        }),
      }),
    });

    const summaryRes = await requestJson(server, 'GET', `/api/guardians/child/${studentId}/weekly-summary`, {
      headers: { Authorization: `Bearer ${guardianToken}` },
    });
    assert.equal(summaryRes.status, 200);
    assert.equal(summaryRes.body.recentSessions.length, 1);
    const redactedSession = summaryRes.body.recentSessions[0];
    assert.equal(redactedSession.meetingLink, undefined);
    assert.equal(redactedSession.recordingUrl, undefined);
    assert.equal(redactedSession.attendance, undefined);
    assert.equal(redactedSession.report, undefined);
    assert.equal(redactedSession.teacherEvaluation, undefined);
    assert.equal(redactedSession.attendanceStatus, 'attended');
    assert.equal(redactedSession.teacher.name, 'الشيخ أحمد');

    // 4. Teacher notification broadcast is strictly scoped to teacher's active students & safe internal URLs
    Teacher.findOne = () => ({
      select: async () => ({ _id: teacherProfileId }),
    });
    Session.find = (filter) => ({
      distinct: async (field) => (field === 'student' && String(filter.teacher) === teacherProfileId ? [studentId] : []),
    });
    GroupCircle.find = () => ({
      select: async () => [],
    });
    Notification.sendBulk = async (ids, payload) => ids.map((id) => ({ user: id, ...payload }));

    // Unauthorized student target -> 403
    const unauthorizedNotifyRes = await requestJson(server, 'POST', '/api/notifications/send', {
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        userIds: [otherStudentId],
        notification: { title: 'تنبيه', message: 'رسالة غير مصرح بها' },
      },
    });
    assert.equal(unauthorizedNotifyRes.status, 403);
    assert.equal(unauthorizedNotifyRes.body?.code, 'TEACHER_STUDENT_SCOPE_VIOLATION');

    // External phishing actionUrl -> 400
    const phishingNotifyRes = await requestJson(server, 'POST', '/api/notifications/send', {
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        userIds: [studentId],
        notification: {
          title: 'تنبيه',
          message: 'اضغط هنا',
          data: { actionUrl: 'https://evil-phish.example.com/login' },
        },
      },
    });
    assert.equal(phishingNotifyRes.status, 400);

    // Authorized student target with safe payload -> 201 and external channels forced off for teacher
    const validNotifyRes = await requestJson(server, 'POST', '/api/notifications/send', {
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        userIds: [studentId],
        notification: {
          title: 'مراجعة السورة',
          message: 'يرجى مراجعة سورة الملك قبل الحصة القادمة',
          channels: { email: { enabled: true }, sms: { enabled: true } },
          data: { actionUrl: '/ar/student/dashboard' },
        },
      },
    });
    assert.equal(validNotifyRes.status, 201);
    assert.deepEqual(validNotifyRes.body.notifications[0].channels, { inApp: { enabled: true } });

    // 5. Admin send-all rejects arbitrary filter fields
    const unsafeSendAllRes = await requestJson(server, 'POST', '/api/notifications/send-all', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        filter: { email: 'victim@example.com' },
        notification: { title: 'عام', message: 'اختبار' },
      },
    });
    assert.equal(unsafeSendAllRes.status, 400);

    // 6. Notification stats casts user ID to ObjectId in aggregate $match
    let capturedPipeline = null;
    Notification.countDocuments = async () => 3;
    Notification.aggregate = async (pipeline) => {
      capturedPipeline = pipeline;
      return [{ _id: 'system', count: 3 }];
    };
    Notification.find = () => ({
      sort: () => ({ limit: async () => [] }),
    });
    const statsRes = await requestJson(server, 'GET', '/api/notifications/stats', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(statsRes.status, 200);
    assert.ok(capturedPipeline?.[0]?.$match?.user instanceof mongoose.Types.ObjectId);
    assert.equal(String(capturedPipeline[0].$match.user), studentId);

    // 7. Teacher registration enforces >= 8 character password policy
    const verificationToken = jwt.sign(
      { email: 'weakpass-teacher@example.com', purpose: 'teacher-email-verification' },
      getAccessSecret(),
      { expiresIn: '10m' }
    );
    const weakTeacherRes = await requestJson(server, 'POST', '/api/teachers/register', {
      body: {
        email: 'weakpass-teacher@example.com',
        password: '123',
        verificationToken,
        personalInfo: JSON.stringify({ fullName: 'معلم اختبار', phone: '+201012345678', age: 30, gender: 'male', address: 'القاهرة' }),
        academicInfo: JSON.stringify({ university: 'الأزهر', faculty: 'أصول الدين', graduationYear: 2020, qualification: 'ليسانس' }),
        quranInfo: JSON.stringify({ memorizedParts: 30, teachingExperience: 3, specializations: ['hifz'] }),
      },
    });
    assert.equal(weakTeacherRes.status, 400);
    assert.match(String(weakTeacherRes.body?.error || ''), /at least 8 characters/i);
  } finally {
    Guardian.find = originals.guardianFind;
    Guardian.findOne = originals.guardianFindOne;
    Session.countDocuments = originals.sessionCount;
    Session.find = originals.sessionFind;
    TeacherTask.countDocuments = originals.taskCount;
    Teacher.findOne = originals.teacherFindOne;
    GroupCircle.find = originals.circleFind;
    Notification.sendBulk = originals.notificationSendBulk;
    Notification.countDocuments = originals.notificationCount;
    Notification.aggregate = originals.notificationAggregate;
    Notification.find = originals.notificationFind;
    await new Promise((resolve) => server.close(resolve));
  }
});
