'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/wahy_test_mocked';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const { generateAccessToken } = require('../middleware/auth');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const GroupCircle = require('../models/GroupCircle');
const Session = require('../models/Session');
const StudentSubscription = require('../models/StudentSubscription');
const AdminAuditLog = require('../models/AdminAuditLog');
const objectStorage = require('../services/objectStorage');
const { ownerCandidates } = require('../utils/teacherAssetLifecycle');

const adminPeopleRouter = require('../routes/adminPeople');
const adminRouter = require('../routes/admin');
const teachersRouter = require('../routes/teachers');

function oid() {
  return new mongoose.Types.ObjectId().toString();
}

function chainable(value) {
  const q = {
    select: () => q,
    populate: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    lean: async () => value,
    catch: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
}

describe('Admin Students & Teachers V2 Behavioral Regressions', () => {
  let server;
  let baseUrl;

  const adminId = oid();
  const studentRoleId = oid();
  const adminToken = generateAccessToken({
    _id: adminId,
    email: 'admin@wahy.test',
    role: 'admin',
    refreshTokenVersion: 0,
  });
  const studentToken = generateAccessToken({
    _id: studentRoleId,
    email: 'student@wahy.test',
    role: 'student',
    refreshTokenVersion: 0,
  });

  const originals = {};

  before(async () => {
    originals.userFindOne = User.findOne;
    originals.userFindById = User.findById;
    originals.userUpdateOne = User.updateOne;
    originals.teacherFindOne = Teacher.findOne;
    originals.teacherFindById = Teacher.findById;
    originals.teacherFind = Teacher.find;
    originals.circleFind = GroupCircle.find;
    originals.circleFindById = GroupCircle.findById;
    originals.circleCount = GroupCircle.countDocuments;
    originals.circleUpdateMany = GroupCircle.updateMany;
    originals.circleUpdateOne = GroupCircle.updateOne;
    originals.sessionCount = Session.countDocuments;
    originals.sessionUpdateMany = Session.updateMany;
    originals.subFindOne = StudentSubscription.findOne;
    originals.subCreate = StudentSubscription.create;
    originals.subCount = StudentSubscription.countDocuments;
    originals.subUpdateMany = StudentSubscription.updateMany;
    originals.auditCreate = AdminAuditLog.create;
    originals.isOwnedObjectReference = objectStorage.isOwnedObjectReference;

    AdminAuditLog.create = async () => ({ _id: oid() });

    const app = express();
    app.use(express.json());
    app.use('/api/admin/people', adminPeopleRouter);
    app.use('/api/admin', adminRouter);
    app.use('/api/teachers', teachersRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    User.findOne = originals.userFindOne;
    User.findById = originals.userFindById;
    User.updateOne = originals.userUpdateOne;
    Teacher.findOne = originals.teacherFindOne;
    Teacher.findById = originals.teacherFindById;
    Teacher.find = originals.teacherFind;
    GroupCircle.find = originals.circleFind;
    GroupCircle.findById = originals.circleFindById;
    GroupCircle.countDocuments = originals.circleCount;
    GroupCircle.updateMany = originals.circleUpdateMany;
    GroupCircle.updateOne = originals.circleUpdateOne;
    Session.countDocuments = originals.sessionCount;
    Session.updateMany = originals.sessionUpdateMany;
    StudentSubscription.findOne = originals.subFindOne;
    StudentSubscription.create = originals.subCreate;
    StudentSubscription.countDocuments = originals.subCount;
    StudentSubscription.updateMany = originals.subUpdateMany;
    AdminAuditLog.create = originals.auditCreate;
    objectStorage.isOwnedObjectReference = originals.isOwnedObjectReference;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    User.findOne = originals.userFindOne;
    User.findById = originals.userFindById;
    Teacher.findOne = originals.teacherFindOne;
    Teacher.findById = originals.teacherFindById;
    Teacher.find = originals.teacherFind;
    GroupCircle.find = originals.circleFind;
    StudentSubscription.findOne = originals.subFindOne;
    StudentSubscription.create = originals.subCreate;
    objectStorage.isOwnedObjectReference = originals.isOwnedObjectReference;
  });

  async function requestJson(method, path, { token = adminToken, body } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }

  it('blocks non-admin roles from accessing new people & teacher admin endpoints (403)', async () => {
    const targetId = oid();
    const subId = oid();
    const checks = await Promise.all([
      requestJson('GET', '/api/admin/people/directory', { token: studentToken }),
      requestJson('PATCH', `/api/admin/people/students/${targetId}/subscriptions/${subId}`, {
        token: studentToken,
        body: { action: 'restore-credit', reason: 'attempt' },
      }),
      requestJson('POST', `/api/admin/people/students/${targetId}/scholarships`, {
        token: studentToken,
        body: { planKey: 'group', sessionCount: 8, reason: 'attempt' },
      }),
      requestJson('GET', '/api/admin/teachers/directory', { token: studentToken }),
      requestJson('GET', `/api/admin/teachers/${targetId}/impact`, { token: studentToken }),
      requestJson('PUT', `/api/teachers/admin/${targetId}/assets`, {
        token: studentToken,
        body: { uploadedFiles: {} },
      }),
      requestJson('PUT', `/api/teachers/admin/${targetId}/review-checklist-bulk`, {
        token: studentToken,
        body: { keys: ['personal-info'] },
      }),
    ]);

    for (const response of checks) {
      assert.equal(response.status, 403);
    }
  });

  it('enforces audit reason, credit invariants, and gender safeguarding on subscription admin mutations', async () => {
    const studentId = oid();
    const subId = oid();
    const maleTeacherId = oid();
    const femaleTeacherId = oid();

    const adultFemaleStudent = {
      _id: studentId,
      role: 'student',
      gender: 'female',
      age: 22,
      enrollmentSection: 'ladies',
    };

    let savedCount = 0;
    const mockSub = {
      _id: subId,
      student: studentId,
      planKey: 'group',
      section: 'ladies',
      sessionCount: 8,
      sessionsUsed: 2,
      sessionsRemaining: 6,
      status: 'active',
      circle: null,
      preferredTeacher: null,
      save: async function save() {
        savedCount += 1;
        return this;
      },
    };

    User.findOne = () => chainable(adultFemaleStudent);
    StudentSubscription.findOne = () => chainable(mockSub);
    Session.updateMany = async () => ({ modifiedCount: 0 });

    // 1. Missing audit reason -> 400
    const missingReason = await requestJson('PATCH', `/api/admin/people/students/${studentId}/subscriptions/${subId}`, {
      body: { action: 'restore-credit', reason: '' },
    });
    assert.equal(missingReason.status, 400);
    assert.equal(missingReason.body.code, 'AUDIT_REASON_REQUIRED');

    // 2. Restore +1 credit preserves sessionsUsed + sessionsRemaining <= sessionCount
    const restored = await requestJson('PATCH', `/api/admin/people/students/${studentId}/subscriptions/${subId}`, {
      body: { action: 'restore-credit', reason: 'تعويض انقطاع تقني موثق' },
    });
    assert.equal(restored.status, 200);
    assert.equal(mockSub.sessionsUsed, 1);
    assert.equal(mockSub.sessionsRemaining, 7);
    assert.equal(savedCount, 1);

    // 3. Cross-gender tutor assignment blocked by safeguarding -> 400 with safeguarding code
    Teacher.findOne = () => chainable({
      _id: maleTeacherId,
      status: 'approved',
      isVerified: true,
      personalInfo: { gender: 'male', fullName: 'الشيخ أحمد' },
    });
    const forbiddenTutor = await requestJson('PATCH', `/api/admin/people/students/${studentId}/subscriptions/${subId}`, {
      body: {
        action: 'change-teacher',
        preferredTeacherId: maleTeacherId,
        reason: 'محاولة تعيين معلم رجل لطالبة بالغة',
      },
    });
    assert.equal(forbiddenTutor.status, 400);
    assert.equal(forbiddenTutor.body.code, 'LADIES_SECTION_TEACHER_MISMATCH');

    // 4. Gender-compatible female tutor succeeds -> 200
    Teacher.findOne = () => chainable({
      _id: femaleTeacherId,
      status: 'approved',
      isVerified: true,
      personalInfo: { gender: 'female', fullName: 'المعلمة مريم' },
    });
    const validTutor = await requestJson('PATCH', `/api/admin/people/students/${studentId}/subscriptions/${subId}`, {
      body: {
        action: 'change-teacher',
        preferredTeacherId: femaleTeacherId,
        reason: 'نقل الطالبة لمعلمة متوافقة',
      },
    });
    assert.equal(validTutor.status, 200);
    assert.equal(String(mockSub.preferredTeacher), femaleTeacherId);
  });

  it('issues zero-amount scholarship subscriptions and prevents duplicate open subscriptions', async () => {
    const studentId = oid();
    User.findOne = () => chainable({
      _id: studentId,
      role: 'student',
      gender: 'male',
      age: 14,
      enrollmentSection: 'men_children',
    });

    // Existing open subscription -> 409
    StudentSubscription.findOne = () => chainable({ _id: oid(), status: 'active' });
    const duplicate = await requestJson('POST', `/api/admin/people/students/${studentId}/scholarships`, {
      body: { planKey: 'group', sessionCount: 8, reason: 'منحة حفظ متميز' },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'SUBSCRIPTION_ALREADY_OPEN');

    // No open subscription -> 201 with isScholarship=true & 0 minor units
    StudentSubscription.findOne = () => chainable(null);
    let capturedPayload = null;
    StudentSubscription.create = async (doc) => {
      capturedPayload = doc;
      return { _id: oid(), ...doc };
    };

    const granted = await requestJson('POST', `/api/admin/people/students/${studentId}/scholarships`, {
      body: { planKey: 'focused', sessionCount: 12, reason: 'منحة تفوق قرآني معتمدة' },
    });
    assert.equal(granted.status, 201);
    assert.equal(capturedPayload.isScholarship, true);
    assert.equal(capturedPayload.pricePerSessionMinor, 0);
    assert.equal(capturedPayload.totalAmountMinor, 0);
    assert.equal(capturedPayload.sessionCount, 12);
    assert.equal(capturedPayload.sessionsRemaining, 12);
  });

  it('computes teacher impact and safely transfers circles/sessions/subscriptions on suspension', async () => {
    const oldTeacherId = oid();
    const replacementId = oid();
    const incompatibleFemaleId = oid();
    const circleId = oid();
    const teacherUserId = oid();

    const teacherStore = new Map([
      [oldTeacherId, {
        _id: oldTeacherId,
        user: teacherUserId,
        status: 'approved',
        isVerified: true,
        personalInfo: { fullName: 'الشيخ خالد', gender: 'male' },
        academicInfo: {},
        quranInfo: { specializations: ['tajweed'] },
        languages: ['arabic'],
        save: async function save() { return this; },
      }],
      [replacementId, {
        _id: replacementId,
        status: 'approved',
        isVerified: true,
        personalInfo: { fullName: 'الشيخ محمود', gender: 'male' },
      }],
      [incompatibleFemaleId, {
        _id: incompatibleFemaleId,
        status: 'approved',
        isVerified: true,
        personalInfo: { fullName: 'المعلمة سارة', gender: 'female' },
      }],
    ]);

    Teacher.findById = (id) => chainable(teacherStore.get(String(id)) || null);
    GroupCircle.find = () => chainable([
      {
        _id: circleId,
        name: 'حلقة الفجر للرجال',
        status: 'active',
        gender: 'men',
        subscriptionSection: 'men_children',
        students: [oid(), oid()],
      },
    ]);
    Session.countDocuments = async () => 4;
    StudentSubscription.countDocuments = async () => 2;
    Teacher.find = () => chainable([
      {
        _id: replacementId,
        personalInfo: { fullName: 'الشيخ محمود', gender: 'male' },
        user: { name: 'محمود', email: 'mahmoud@wahy.test' },
      },
    ]);

    const impact = await requestJson('GET', `/api/admin/teachers/${oldTeacherId}/impact`);
    assert.equal(impact.status, 200);
    assert.equal(impact.body.activeCirclesCount, 1);
    assert.equal(impact.body.futureSessionsCount, 4);
    assert.equal(impact.body.lockedSubscriptionsCount, 2);
    assert.equal(impact.body.replacementTeachers.length, 1);

    let transferredCircles = 0;
    let transferredSessions = 0;
    let transferredSubs = 0;
    GroupCircle.updateMany = async () => { transferredCircles += 1; return { modifiedCount: 1 }; };
    Session.updateMany = async () => { transferredSessions += 1; return { modifiedCount: 4 }; };
    StudentSubscription.updateMany = async () => { transferredSubs += 1; return { modifiedCount: 2 }; };

    // Cross-gender replacement rejected before mutating circles
    User.findById = () => chainable({ _id: teacherUserId, isActive: true, save: async () => {} });

    const badTransfer = await requestJson('PUT', `/api/admin/teachers/${oldTeacherId}`, {
      body: {
        status: 'suspended',
        replacementTeacherId: incompatibleFemaleId,
        adminDirectOverride: true,
        adminReason: 'اختبار حماية توافق الجنس عند النقل',
      },
    });
    assert.equal(badTransfer.status, 409);
    assert.equal(badTransfer.body.code, 'GENDER_SEPARATION_VIOLATION');
    assert.equal(transferredCircles, 0);

    // Compatible replacement transfers circles, future sessions, and preferredTeacher locks
    const okTransfer = await requestJson('PUT', `/api/admin/teachers/${oldTeacherId}`, {
      body: {
        status: 'suspended',
        replacementTeacherId: replacementId,
        adminDirectOverride: true,
        adminReason: 'إجازة معلم ونقل الحلقات للشيخ محمود',
      },
    });
    assert.equal(okTransfer.status, 200);
    assert.equal(transferredCircles, 1);
    assert.equal(transferredSessions, 1);
    assert.equal(transferredSubs, 1);
  });

  it('tracks multi-owner storage candidates and supports admin direct asset upload & bulk checklist approval', async () => {
    const teacherId = oid();
    const teacherUserId = oid();
    const mockTeacher = {
      _id: teacherId,
      user: teacherUserId,
      storageOwner: 'invite@wahy.test',
      status: 'pending',
      isVerified: false,
      personalInfo: { fullName: 'الشيخ ياسر', age: 32, gender: 'male', phone: '+201012345678', country: 'EG', city: 'Cairo' },
      academicInfo: { university: 'الأزهر', faculty: 'أصول الدين', graduationYear: 2016, specialization: 'قراءات', qualification: 'ليسانس' },
      quranInfo: { memorizedParts: 30, teachingExperience: 6, specializations: ['tajweed'] },
      media: {
        profilePhoto: 'placeholder.jpg',
        recitationVideo: 'placeholder.mp4',
      },
      documents: {
        idCardFront: '',
        idCardBack: '',
      },
      reviewChecklist: [],
      markModified: () => {},
      save: async function save() { return this; },
    };

    Teacher.findById = () => chainable(mockTeacher);

    // Unowned storage reference rejected -> 400
    objectStorage.isOwnedObjectReference = () => false;
    const unowned = await requestJson('PUT', `/api/teachers/admin/${teacherId}/assets`, {
      body: {
        uploadedFiles: {
          profilePhoto: { url: 'https://evil.example/uploads/teacher-public/other/photo.jpg' },
        },
      },
    });
    assert.equal(unowned.status, 400);
    assert.equal(unowned.body.code, 'INVALID_ASSET_OWNER');

    // Admin-owned storage reference accepted and appended to storageOwner
    objectStorage.isOwnedObjectReference = (_ref, purpose, owner) => (
      (purpose === 'teacher-public' || purpose === 'teacher-private') && String(owner) === adminId
    );

    const uploaded = await requestJson('PUT', `/api/teachers/admin/${teacherId}/assets`, {
      body: {
        uploadedFiles: {
          profilePhoto: { url: `https://blob.vercel-storage.com/uploads/teacher-public/${adminId}/photo.jpg` },
          recitationVideo: { url: `https://blob.vercel-storage.com/uploads/teacher-public/${adminId}/recite.mp4` },
          idCardFront: { url: `https://blob.vercel-storage.com/uploads/teacher-private/${adminId}/id-front.jpg` },
        },
        reason: 'رفع ملفات المعلم مباشرة من الإدارة',
      },
    });
    assert.equal(uploaded.status, 200);
    assert.ok(uploaded.body.updatedFields.includes('media.profilePhoto'));
    assert.ok(uploaded.body.updatedFields.includes('media.recitationVideo'));
    assert.ok(uploaded.body.updatedFields.includes('documents.idCardFront'));

    // Verify ownerCandidates parses both original invite owner and adminId
    const candidates = ownerCandidates(mockTeacher);
    assert.ok(candidates.includes('invite@wahy.test'));
    assert.ok(candidates.includes(adminId));

    // Bulk checklist approval marks available items approved in one request
    const bulk = await requestJson('PUT', `/api/teachers/admin/${teacherId}/review-checklist-bulk`, {
      body: {
        keys: ['personal-info', 'academic-info', 'quran-profile', 'profile-photo', 'recitation-video', 'id-card-front'],
        note: 'اعتماد جماعي بعد المراجعة',
      },
    });
    assert.equal(bulk.status, 200);
    assert.ok(bulk.body.appliedKeys.length >= 5);
    assert.equal(
      mockTeacher.reviewChecklist.find((item) => item.key === 'profile-photo')?.status,
      'approved'
    );
    assert.equal(
      mockTeacher.reviewChecklist.find((item) => item.key === 'recitation-video')?.status,
      'approved'
    );
  });
});
