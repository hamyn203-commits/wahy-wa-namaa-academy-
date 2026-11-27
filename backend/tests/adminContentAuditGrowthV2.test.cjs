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
const Course = require('../models/Course');
const Blog = require('../models/Blog');
const AdminAuditLog = require('../models/AdminAuditLog');
const JobApplication = require('../models/JobApplication');
const Donation = require('../models/Donation');

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

test('PUT /api/admin/courses/:id and PUT /api/admin/blog/:id support full instructor/programs/slug/excerpt editing with audit logging', async () => {
  const origUserFindById = User.findById;
  const origCourseFindById = Course.findById;
  const origBlogFindById = Blog.findById;
  const origAuditCreate = AdminAuditLog.create;

  const adminId = new mongoose.Types.ObjectId().toString();
  const courseId = new mongoose.Types.ObjectId().toString();
  const instructorId = new mongoose.Types.ObjectId().toString();
  const blogId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });
  const audits = [];

  User.findById = (id) => (
    String(id) === adminId
      ? makeQuery({ _id: adminId, role: 'admin', isActive: true, tokenVersion: 0 })
      : makeQuery(null)
  );
  AdminAuditLog.create = async (doc) => {
    audits.push(doc);
    return doc;
  };

  const mutableCourse = {
    _id: courseId,
    slug: 'old-slug',
    title: { ar: 'قديم', en: 'Old' },
    description: { ar: 'وصف قديم', en: 'Old desc' },
    price: 10,
    programs: ['general'],
    status: 'published',
    save: async () => {},
  };
  Course.findById = () => makeQuery(mutableCourse);

  const mutablePost = {
    _id: blogId,
    slug: 'old-post',
    title: { ar: 'مقال قديم', en: 'Old post' },
    excerpt: { ar: 'مقتطف قديم', en: '' },
    content: { ar: 'محتوى قديم', en: '' },
    featured: false,
    status: 'published',
    save: async () => {},
  };
  Blog.findById = () => makeQuery(mutablePost);

  try {
    // Reject invalid instructorId
    const badInstructor = await request(`/api/admin/courses/${courseId}`, {
      method: 'PUT',
      token: adminToken,
      body: { instructorId: 'not-an-objectid' },
    });
    assert.equal(badInstructor.status, 400);

    // Update course instructor, slug, programs, and EGP pricing
    const updatedCourse = await request(`/api/admin/courses/${courseId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        titleAr: 'دورة التجويد المحدثة',
        slug: 'Updated Tajweed 2026',
        instructorId,
        programs: ['kids', 'women', 'invalid_program'],
        price: 19,
        priceEgp: 199,
        descAr: 'وصف محدث شامل',
      },
    });
    assert.equal(updatedCourse.status, 200);
    assert.equal(mutableCourse.slug, 'updated-tajweed-2026');
    assert.equal(String(mutableCourse.instructor), instructorId);
    assert.deepEqual(mutableCourse.programs, ['kids', 'women']);
    assert.equal(mutableCourse.regionalPrices.EG, 199);

    // Update blog slug, clear excerpt, set featured
    const updatedBlog = await request(`/api/admin/blog/${blogId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        slug: 'New Blog Slug',
        titleAr: 'عنوان محدث',
        excerptAr: '',
        contentAr: 'محتوى جديد ومفصل',
        featured: true,
      },
    });
    assert.equal(updatedBlog.status, 200);
    assert.equal(mutablePost.slug, 'new-blog-slug');
    assert.equal(mutablePost.excerpt.ar, '');
    assert.equal(mutablePost.content.ar, 'محتوى جديد ومفصل');
    assert.equal(mutablePost.featured, true);
    assert.ok(audits.some((a) => a.action === 'course.updated'));
    assert.ok(audits.some((a) => a.action === 'blog.updated'));
  } finally {
    User.findById = origUserFindById;
    Course.findById = origCourseFindById;
    Blog.findById = origBlogFindById;
    AdminAuditLog.create = origAuditCreate;
  }
});

test('Audit search, Careers status validation/audit, and Donations search enforce safe filters', async () => {
  const origReady = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  const origUserFindById = User.findById;
  const origAuditFind = AdminAuditLog.find;
  const origAuditCreate = AdminAuditLog.create;
  const origAppFind = JobApplication.find;
  const origAppCount = JobApplication.countDocuments;
  const origAppUpdate = JobApplication.findByIdAndUpdate;
  const origDonFind = Donation.find;
  const origDonCount = Donation.countDocuments;

  const adminId = new mongoose.Types.ObjectId().toString();
  const appId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });
  const audits = [];

  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  User.findById = (id) => (
    String(id) === adminId
      ? makeQuery({ _id: adminId, role: 'admin', isActive: true, tokenVersion: 0 })
      : makeQuery(null)
  );

  let capturedAuditFilter = null;
  AdminAuditLog.find = (filter) => {
    capturedAuditFilter = filter;
    return makeQuery([{ _id: new mongoose.Types.ObjectId(), action: 'course.updated', entityType: 'course' }]);
  };
  AdminAuditLog.create = async (doc) => {
    audits.push(doc);
    return doc;
  };

  let capturedAppFilter = null;
  JobApplication.find = (filter) => {
    capturedAppFilter = filter;
    return makeQuery([{ _id: appId, name: 'متقدم', position: 'quran-teacher', status: 'new' }]);
  };
  JobApplication.countDocuments = async () => 1;
  JobApplication.findByIdAndUpdate = async (_id, update) => ({
    _id: appId,
    position: 'quran-teacher',
    status: update.status,
  });

  let capturedDonFilter = null;
  Donation.find = (filter) => {
    capturedDonFilter = filter;
    return makeQuery([{ _id: new mongoose.Types.ObjectId(), name: 'متبرع كريم', amount: 100, currency: 'USD', status: 'confirmed' }]);
  };
  Donation.countDocuments = async () => 1;

  try {
    const auditRes = await request('/api/admin/audit?q=course.updated&entityType=course&limit=50', { token: adminToken });
    assert.equal(auditRes.status, 200);
    assert.equal(auditRes.data.total, 1);
    assert.equal(capturedAuditFilter.entityType, 'course');
    assert.ok(Array.isArray(capturedAuditFilter.$or));

    const badAppId = await request('/api/careers/applications/invalid-id/status', {
      method: 'PUT',
      token: adminToken,
      body: { status: 'interview' },
    });
    assert.equal(badAppId.status, 400);

    const okAppStatus = await request(`/api/careers/applications/${appId}/status`, {
      method: 'PUT',
      token: adminToken,
      body: { status: 'interview' },
    });
    assert.equal(okAppStatus.status, 200);
    assert.ok(audits.some((a) => a.action === 'career_application.status.interview'));

    const appsRes = await request('/api/careers/applications?q=متقدم&status=new', { token: adminToken });
    assert.equal(appsRes.status, 200);
    assert.equal(capturedAppFilter.status, 'new');
    assert.ok(Array.isArray(capturedAppFilter.$or));

    const donRes = await request('/api/donations?q=متبرع&status=confirmed', { token: adminToken });
    assert.equal(donRes.status, 200);
    assert.equal(capturedDonFilter.status, 'confirmed');
    assert.ok(Array.isArray(capturedDonFilter.$or));
  } finally {
    if (origReady) Object.defineProperty(mongoose.connection, 'readyState', origReady);
    User.findById = origUserFindById;
    AdminAuditLog.find = origAuditFind;
    AdminAuditLog.create = origAuditCreate;
    JobApplication.find = origAppFind;
    JobApplication.countDocuments = origAppCount;
    JobApplication.findByIdAndUpdate = origAppUpdate;
    Donation.find = origDonFind;
    Donation.countDocuments = origDonCount;
  }
});

test('Blog schema avoids invalid compound multikey+text index and POST /api/admin/blog self-heals legacy index + supports featured', async () => {
  // Ensure no compound text index mixes 'text' with non-text multikey 'tags: 1'
  for (const [spec] of Blog.schema.indexes()) {
    const values = Object.values(spec);
    if (values.includes('text')) {
      assert.notEqual(spec.tags, 1, 'Compound text index must not combine text with multikey tags: 1');
    }
  }

  const origUserFindById = User.findById;
  const origBlogCreate = Blog.create;
  const origAuditCreate = AdminAuditLog.create;
  const origCollection = Blog.collection;

  const adminId = new mongoose.Types.ObjectId().toString();
  const adminToken = generateAccessToken({ id: adminId, role: 'admin', tokenVersion: 0 });
  User.findById = (id) => (
    String(id) === adminId
      ? makeQuery({ _id: adminId, name: 'مشرف الاختبار', role: 'admin', isActive: true, tokenVersion: 0 })
      : makeQuery(null)
  );
  AdminAuditLog.create = async (doc) => doc;

  let attempts = 0;
  let droppedIndex = null;
  let createdPayload = null;
  Object.defineProperty(Blog, 'collection', {
    value: {
      dropIndex: async (name) => {
        droppedIndex = name;
      },
    },
    configurable: true,
  });
  Blog.create = async (payload) => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("Field 'tags' of text index contains an array in document");
    }
    createdPayload = payload;
    return { _id: new mongoose.Types.ObjectId(), ...payload };
  };

  try {
    const res = await request('/api/admin/blog', {
      method: 'POST',
      token: adminToken,
      body: {
        slug: 'Self Heal Post',
        titleAr: 'مقال معالجة الفهرس',
        excerptAr: 'مقتطف',
        contentAr: 'محتوى المقال',
        featured: true,
      },
    });
    assert.equal(res.status, 201);
    assert.equal(attempts, 2);
    assert.equal(droppedIndex, 'title.ar_text_title.en_text_tags_1');
    assert.equal(createdPayload.slug, 'self-heal-post');
    assert.equal(createdPayload.featured, true);
  } finally {
    User.findById = origUserFindById;
    Blog.create = origBlogCreate;
    AdminAuditLog.create = origAuditCreate;
    Object.defineProperty(Blog, 'collection', { value: origCollection, configurable: true });
  }
});
