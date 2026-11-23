'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');
const { addMockUser, addMockTeacher, deleteMockTeacher, deleteMockUser } = require('../mockStore');

function requestJson(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined
      ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
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

test('admin can toggle teacher public visibility (isPublic) without revoking approval or admin access', async () => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const teacherUserId = new mongoose.Types.ObjectId().toString();
  const teacherId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({
    id: new mongoose.Types.ObjectId().toString(),
    role: 'admin',
    email: 'admin@wahywanamaa.test',
  });
  const studentToken = generateAccessToken({
    id: new mongoose.Types.ObjectId().toString(),
    role: 'student',
    email: 'student@wahywanamaa.test',
  });

  addMockUser({
    _id: teacherUserId,
    name: 'الأستاذة مريم حسن',
    email: `vis-teacher-${Date.now()}@wahywanamaa.test`,
    password: 'StrongPassword123!',
    role: 'teacher',
    isActive: true,
    emailVerified: true,
  });

  addMockTeacher({
    _id: teacherId,
    id: teacherId,
    user: teacherUserId,
    personalInfo: {
      fullName: 'الأستاذة مريم حسن',
      gender: 'female',
      country: 'مصر',
      city: 'القاهرة',
      phone: '+201001112233',
    },
    academicInfo: {
      university: 'جامعة الأزهر',
      faculty: 'الدراسات الإسلامية',
      graduationYear: 2019,
      specialization: 'تحفيظ قرآن',
      qualification: 'إجازة',
    },
    quranInfo: {
      memorizedParts: 30,
      teachingExperience: 6,
      specializations: ['women', 'tajweed'],
    },
    languages: ['arabic'],
    status: 'approved',
    isVerified: true,
    isFeatured: true,
    isPublic: true,
    rating: { average: 5, count: 10 },
  });

  try {
    // 1. Visible by default on public directory, featured list, and public profile
    const listBefore = await requestJson(server, 'GET', '/api/teachers?limit=50');
    assert.equal(listBefore.status, 200);
    assert.ok(listBefore.body.teachers.some((t) => String(t._id) === teacherId));

    const featuredBefore = await requestJson(server, 'GET', '/api/teachers/featured');
    assert.equal(featuredBefore.status, 200);
    assert.ok(featuredBefore.body.some((t) => String(t._id) === teacherId));

    const profileBefore = await requestJson(server, 'GET', `/api/teachers/${teacherId}`);
    assert.equal(profileBefore.status, 200);
    assert.equal(String(profileBefore.body._id), teacherId);

    // 2. Non-admin cannot change teacher public visibility
    const studentToggle = await requestJson(server, 'PUT', `/api/admin/teachers/${teacherId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { isPublic: false },
    });
    assert.equal(studentToggle.status, 403);

    // 3. Admin hides teacher from public listings
    const hideRes = await requestJson(server, 'PUT', `/api/admin/teachers/${teacherId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isPublic: false },
    });
    assert.equal(hideRes.status, 200);
    assert.equal(hideRes.body.isPublic, false);
    assert.equal(hideRes.body.status, 'approved');
    assert.equal(hideRes.body.isVerified, true);

    // 4. Hidden teacher disappears from public directory, featured list, and direct public profile
    const listHidden = await requestJson(server, 'GET', '/api/teachers?limit=50');
    assert.equal(listHidden.status, 200);
    assert.equal(listHidden.body.teachers.some((t) => String(t._id) === teacherId), false);

    const featuredHidden = await requestJson(server, 'GET', '/api/teachers/featured');
    assert.equal(featuredHidden.status, 200);
    assert.equal(featuredHidden.body.some((t) => String(t._id) === teacherId), false);

    const profileHidden = await requestJson(server, 'GET', `/api/teachers/${teacherId}`);
    assert.equal(profileHidden.status, 404);

    // 5. Hidden teacher STILL appears in admin approved teachers list with isPublic: false
    const adminList = await requestJson(server, 'GET', '/api/admin/teachers/approved', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminList.status, 200);
    const adminTeacher = adminList.body.find((t) => String(t._id) === teacherId);
    assert.ok(adminTeacher, 'Hidden teacher must remain visible in admin teachers list');
    assert.equal(adminTeacher.isPublic, false);
    assert.equal(adminTeacher.status, 'approved');

    // 6. Admin restores public visibility
    const showRes = await requestJson(server, 'PUT', `/api/admin/teachers/${teacherId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isPublic: true },
    });
    assert.equal(showRes.status, 200);
    assert.equal(showRes.body.isPublic, true);

    const profileRestored = await requestJson(server, 'GET', `/api/teachers/${teacherId}`);
    assert.equal(profileRestored.status, 200);

    const featuredRestored = await requestJson(server, 'GET', '/api/teachers/featured');
    assert.equal(featuredRestored.status, 200);
    assert.ok(featuredRestored.body.some((t) => String(t._id) === teacherId));
  } finally {
    deleteMockTeacher(teacherId);
    deleteMockUser(teacherUserId);
    await new Promise((resolve) => server.close(resolve));
  }
});
