'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

const mongoose = require('mongoose');
const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');
const AdminAuditLog = require('../models/AdminAuditLog');
const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Blog = require('../models/Blog');

function makeQuery(value) {
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

test('AdminAuditLog blocks updates on existing records (append-only)', async () => {
  const doc = new AdminAuditLog({
    actor: new mongoose.Types.ObjectId(),
    action: 'test_action',
    entityType: 'test',
    entityId: '123',
  });

  // For a new doc, pre('save') should allow it
  assert.equal(doc.isNew, true);
  await new Promise((resolve, reject) => {
    doc.validate().then(() => resolve()).catch(reject);
  });

  // Emulate an existing document that was already saved
  doc.isNew = false;
  doc.action = 'tampered_action';

  // Attempting to save should trigger the append-only error
  await assert.rejects(
    async () => {
      // In Mongoose schema middleware, doc.$__save or running pre hooks
      await new Promise((resolve, reject) => {
        // Trigger save hooks manually if not connected to live Mongo
        const middleware = AdminAuditLog.schema.s.hooks;
        middleware.execPre('save', doc, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
    (err) => {
      assert.match(err.message, /Admin audit log entries are append-only/);
      return true;
    }
  );
});

const origReadyState = mongoose.connection.readyState;
const origUserFindById = User.findById;
const origAuditCreate = AdminAuditLog.create;
const origCourseCreate = Course.create;
const origCourseFindById = Course.findById;
const origCourseFindByIdAndUpdate = Course.findByIdAndUpdate;
const origCourseFindByIdAndDelete = Course.findByIdAndDelete;
const origCourseUpdateOne = Course.updateOne;
const origEnrollmentExists = Enrollment.exists;
const origPaymentExists = Payment.exists;
const origLessonCount = Lesson.countDocuments;
const origLessonCreate = Lesson.create;
const origLessonFindById = Lesson.findById;
const origLessonFindByIdAndDelete = Lesson.findByIdAndDelete;
const origLessonDeleteMany = Lesson.deleteMany;
const origLessonFind = Lesson.find;
const origBlogCreate = Blog.create;
const origBlogFindById = Blog.findById;
const origBlogFindByIdAndDelete = Blog.findByIdAndDelete;

let server;

after(async () => {
  mongoose.connection.readyState = origReadyState;
  User.findById = origUserFindById;
  AdminAuditLog.create = origAuditCreate;
  Course.create = origCourseCreate;
  Course.findById = origCourseFindById;
  Course.findByIdAndUpdate = origCourseFindByIdAndUpdate;
  Course.findByIdAndDelete = origCourseFindByIdAndDelete;
  Course.updateOne = origCourseUpdateOne;
  Enrollment.exists = origEnrollmentExists;
  Payment.exists = origPaymentExists;
  Lesson.countDocuments = origLessonCount;
  Lesson.create = origLessonCreate;
  Lesson.findById = origLessonFindById;
  Lesson.findByIdAndDelete = origLessonFindByIdAndDelete;
  Lesson.deleteMany = origLessonDeleteMany;
  Lesson.find = origLessonFind;
  Blog.create = origBlogCreate;
  Blog.findById = origBlogFindById;
  Blog.findByIdAndDelete = origBlogFindByIdAndDelete;
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('admin course, lesson, and blog CRUD validate ObjectIds/fields, return 404 on missing delete, and emit AdminAuditLog', async () => {
  const oid = () => new mongoose.Types.ObjectId().toString();
  const adminId = oid();
  const studentId = oid();
  const instructorId = oid();
  const courseId = oid();
  const lessonId = oid();
  const blogId = oid();
  const missingBlogId = oid();

  const auditCalls = [];
  mongoose.connection.readyState = 1;
  User.findById = (id) => {
    if (String(id) === adminId) {
      return makeQuery({ _id: adminId, id: adminId, name: 'Admin Reviewer', role: 'admin', isActive: true });
    }
    if (String(id) === studentId) {
      return makeQuery({ _id: studentId, id: studentId, name: 'Student User', role: 'student', isActive: true });
    }
    return makeQuery(null);
  };
  AdminAuditLog.create = async (entry) => {
    auditCalls.push(entry);
    return { _id: oid(), ...entry };
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminToken = generateAccessToken({ _id: adminId, role: 'admin' });
  const studentToken = generateAccessToken({ _id: studentId, role: 'student' });

  const request = (urlPath, method, body, token = adminToken) => fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // RBAC check: non-admin must receive 403
  const forbidden = await request('/api/admin/blog', 'POST', { slug: 'test', titleAr: 'عنوان' }, studentToken);
  assert.equal(forbidden.status, 403);

  // Invalid ObjectId checks (400)
  for (const [urlPath, method, payload] of [
    ['/api/admin/courses', 'POST', { titleAr: 'دورة', slug: 'c-1', instructorId: 'invalid-id' }],
    ['/api/admin/courses/not-valid-oid', 'PUT', { status: 'draft' }],
    ['/api/admin/courses/not-valid-oid', 'DELETE', undefined],
    ['/api/admin/courses/not-valid-oid/lessons', 'GET', undefined],
    ['/api/admin/courses/not-valid-oid/lessons', 'POST', { titleAr: 'درس 1' }],
    ['/api/admin/lessons/not-valid-oid', 'PUT', { titleAr: 'تعديل' }],
    ['/api/admin/lessons/not-valid-oid', 'DELETE', undefined],
    ['/api/admin/blog/not-valid-oid', 'PUT', { status: 'draft' }],
    ['/api/admin/blog/not-valid-oid', 'DELETE', undefined],
  ]) {
    const res = await request(urlPath, method, payload);
    assert.equal(res.status, 400, `Expected 400 for ${method} ${urlPath}`);
  }

  // Required-field checks on blog & lesson
  const missingBlogFields = await request('/api/admin/blog', 'POST', { titleAr: '   ' });
  assert.equal(missingBlogFields.status, 400);

  Course.findById = () => makeQuery({ _id: courseId, slug: 'c-1', lessons: [], save: async () => {} });
  const missingLessonTitle = await request(`/api/admin/courses/${courseId}/lessons`, 'POST', { titleAr: '   ' });
  assert.equal(missingLessonTitle.status, 400);

  // Course CRUD + Audit
  Course.create = async (doc) => ({ _id: courseId, ...doc });
  const createCourseRes = await request('/api/admin/courses', 'POST', {
    titleAr: 'دورة التجويد',
    slug: 'Tajweed Course',
    instructorId,
  });
  assert.equal(createCourseRes.status, 201);

  const mutableCourse = {
    _id: courseId,
    slug: 'tajweed-course',
    status: 'draft',
    lessons: [],
    title: { ar: 'دورة التجويد', en: 'Tajweed' },
    description: { ar: 'وصف', en: 'Desc' },
    save: async () => {},
  };
  Course.findById = () => makeQuery(mutableCourse);
  const updateCourseRes = await request(`/api/admin/courses/${courseId}`, 'PUT', { status: 'published' });
  assert.equal(updateCourseRes.status, 200);

  // Lesson CRUD + Audit
  Lesson.countDocuments = async () => 0;
  Lesson.create = async (doc) => ({ _id: lessonId, ...doc });
  const createLessonRes = await request(`/api/admin/courses/${courseId}/lessons`, 'POST', {
    titleAr: 'الدرس الأول',
    type: 'text',
    textAr: 'محتوى الدرس',
  });
  assert.equal(createLessonRes.status, 201);

  const mutableLesson = {
    _id: lessonId,
    course: courseId,
    type: 'text',
    title: { ar: 'الدرس الأول', en: 'Lesson 1' },
    content: { text: { ar: 'محتوى' } },
    save: async () => {},
  };
  Lesson.findById = () => makeQuery(mutableLesson);
  const updateLessonRes = await request(`/api/admin/lessons/${lessonId}`, 'PUT', { titleAr: 'الدرس المعدل' });
  assert.equal(updateLessonRes.status, 200);

  Lesson.findByIdAndDelete = async () => mutableLesson;
  Course.updateOne = async () => ({ modifiedCount: 1 });
  const deleteLessonRes = await request(`/api/admin/lessons/${lessonId}`, 'DELETE');
  assert.equal(deleteLessonRes.status, 200);

  // Delete course (clean delete when no enrollments/payments)
  Enrollment.exists = async () => null;
  Payment.exists = async () => null;
  Lesson.deleteMany = async () => ({ deletedCount: 0 });
  Course.findByIdAndDelete = async () => mutableCourse;
  const deleteCourseRes = await request(`/api/admin/courses/${courseId}`, 'DELETE');
  assert.equal(deleteCourseRes.status, 200);

  // Blog CRUD + 404 on missing delete + Audit
  Blog.create = async (doc) => ({ _id: blogId, ...doc });
  const createBlogRes = await request('/api/admin/blog', 'POST', {
    slug: 'My Post',
    titleAr: 'مقال مهم',
    contentAr: 'نص المقال',
  });
  assert.equal(createBlogRes.status, 201);

  const mutableBlog = {
    _id: blogId,
    slug: 'my-post',
    status: 'published',
    title: { ar: 'مقال مهم', en: 'Post' },
    content: { ar: 'نص' },
    excerpt: { ar: '' },
    save: async () => {},
  };
  Blog.findById = () => makeQuery(mutableBlog);
  const updateBlogRes = await request(`/api/admin/blog/${blogId}`, 'PUT', { status: 'draft' });
  assert.equal(updateBlogRes.status, 200);

  Blog.findByIdAndDelete = async (id) => (String(id) === blogId ? mutableBlog : null);
  const deleteMissingBlogRes = await request(`/api/admin/blog/${missingBlogId}`, 'DELETE');
  assert.equal(deleteMissingBlogRes.status, 404);

  const deleteBlogRes = await request(`/api/admin/blog/${blogId}`, 'DELETE');
  assert.equal(deleteBlogRes.status, 200);

  assert.deepEqual(
    auditCalls.map((entry) => [entry.action, entry.entityType, String(entry.actor)]),
    [
      ['course.created', 'course', adminId],
      ['course.updated', 'course', adminId],
      ['lesson.created', 'lesson', adminId],
      ['lesson.updated', 'lesson', adminId],
      ['lesson.deleted', 'lesson', adminId],
      ['course.deleted', 'course', adminId],
      ['blog.created', 'blog', adminId],
      ['blog.updated', 'blog', adminId],
      ['blog.deleted', 'blog', adminId],
    ]
  );
});
