'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

function requestJson(baseUrl, method, pathname, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      `${baseUrl}${pathname}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('MushafProgress API supports color-coded annotations, 30-Juz Khatmah certification, and strict RBAC', async (t) => {
  const prevEnv = {
    DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT,
    ALLOW_MOCK_MODE: process.env.ALLOW_MOCK_MODE,
  };
  process.env.DISABLE_RATE_LIMIT = 'true';
  process.env.ALLOW_MOCK_MODE = 'true';

  delete require.cache[require.resolve('../routes/mushafProgress')];
  delete require.cache[require.resolve('../app')];
  const { generateAccessToken } = require('../middleware/auth');
  const { addMockTeacher } = require('../mockStore');
  const app = require('../app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve('../routes/mushafProgress')];
    delete require.cache[require.resolve('../app')];
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const studentAId = '507f1f77bcf86cd799439011';
  const studentBId = '507f1f77bcf86cd799439012';
  const teacherUserId = '507f1f77bcf86cd799439021';
  addMockTeacher({
    _id: '507f1f77bcf86cd799439099',
    user: teacherUserId,
    status: 'approved',
    isVerified: true,
    personalInfo: { fullName: 'الشيخ أحمد' },
  });
  const teacherToken = generateAccessToken({ _id: teacherUserId, role: 'teacher', name: 'الشيخ أحمد' });
  const unapprovedTeacherToken = generateAccessToken({ _id: '507f1f77bcf86cd799439022', role: 'teacher', name: 'معلم غير معتمد' });
  const studentAToken = generateAccessToken({ _id: studentAId, role: 'student', name: 'عمر' });
  const studentBToken = generateAccessToken({ _id: studentBId, role: 'student', name: 'يوسف' });

  // 1) Unauthenticated access & unapproved teacher rejected
  const unauth = await requestJson(baseUrl, 'GET', '/api/mushaf-progress/my');
  assert.equal(unauth.status, 401);
  const unapproved = await requestJson(baseUrl, 'POST', `/api/mushaf-progress/student/${studentAId}/annotations`, {
    token: unapprovedTeacherToken,
    body: { surahNumber: 67, ayahNumber: 1, type: 'memorization' },
  });
  assert.equal(unapproved.status, 403);

  // 2) Teacher creates a color-coded Tajweed annotation for student A
  const created = await requestJson(baseUrl, 'POST', `/api/mushaf-progress/student/${studentAId}/annotations`, {
    token: teacherToken,
    body: {
      surahNumber: 67,
      surahName: 'سورة الملك',
      ayahNumber: 3,
      wordText: 'مِن تَفَاوُتٍ',
      type: 'tajweed',
      note: 'انتبه لغنة الإخفاء الحقيقي بمقدار حركتين',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.success, true);
  assert.equal(created.body.annotations.length, 1);
  assert.equal(created.body.summary.openAnnotationsCount, 1);
  const annotationId = created.body.annotations[0]._id;

  // 3) Teacher certifies Juz 30 as mastered
  const certified = await requestJson(baseUrl, 'PUT', `/api/mushaf-progress/student/${studentAId}/khatmah/30`, {
    token: teacherToken,
    body: { status: 'mastered' },
  });
  assert.equal(certified.status, 200);
  assert.equal(certified.body.khatmahJuz.length, 30);
  assert.equal(certified.body.summary.masteredCount, 1);
  assert.equal(certified.body.summary.memorizedCount, 1);

  // 4) Student A reads their own Khatmah + teacher annotations
  const studentOwn = await requestJson(baseUrl, 'GET', '/api/mushaf-progress/my', { token: studentAToken });
  assert.equal(studentOwn.status, 200);
  assert.equal(studentOwn.body.annotations.length, 1);
  assert.equal(studentOwn.body.summary.masteredCount, 1);

  // 5) Student B CANNOT read Student A's Mushaf progress (IDOR blocked)
  const idorRead = await requestJson(baseUrl, 'GET', `/api/mushaf-progress/student/${studentAId}`, { token: studentBToken });
  assert.equal(idorRead.status, 403);

  // 6) Student CANNOT certify their own Juz or create annotations
  const studentWrite = await requestJson(baseUrl, 'PUT', `/api/mushaf-progress/student/${studentAId}/khatmah/29`, {
    token: studentAToken,
    body: { status: 'mastered' },
  });
  assert.equal(studentWrite.status, 403);

  // 7) Teacher marks annotation as resolved
  const resolved = await requestJson(baseUrl, 'PATCH', `/api/mushaf-progress/student/${studentAId}/annotations/${annotationId}`, {
    token: teacherToken,
    body: { resolved: true },
  });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.summary.openAnnotationsCount, 0);
});
