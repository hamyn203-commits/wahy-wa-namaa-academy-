'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId().toString();

function queryOf(value) {
  const query = {
    select() { return query; },
    populate() { return query; },
    sort() { return query; },
    limit() { return query; },
    skip() { return query; },
    distinct() { return Promise.resolve(value); },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
    catch(reject) { return Promise.resolve(value).catch(reject); },
  };
  return query;
}

async function requestJson(baseUrl, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
  };
}

test('teacher-feedback-audio upload policy and TeacherTask privacy schema enforce constraints', () => {
  const { PURPOSES, validateUploadMetadata } = require('../config/uploadPolicy');
  const TeacherTask = require('../models/TeacherTask');

  assert.deepEqual(PURPOSES['teacher-feedback-audio'].roles, ['teacher']);
  assert.equal(PURPOSES['teacher-feedback-audio'].maxBytes, 10 * 1024 * 1024);

  const valid = validateUploadMetadata({
    purpose: 'teacher-feedback-audio',
    role: 'teacher',
    filename: 'feedback-note.webm',
    contentType: 'audio/webm',
    size: 512_000,
  });
  assert.equal(valid.contentType, 'audio/webm');

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-feedback-audio',
      role: 'student',
      filename: 'feedback-note.webm',
      contentType: 'audio/webm',
      size: 512_000,
    }),
    /Not allowed for this upload purpose/
  );

  assert.throws(
    () => validateUploadMetadata({
      purpose: 'teacher-feedback-audio',
      role: 'teacher',
      filename: 'feedback-note.webm',
      contentType: 'audio/webm',
      size: 11 * 1024 * 1024,
    }),
    /Invalid file size/
  );

  assert.equal(TeacherTask.schema.path('teacherFeedbackAudio').options.select, false);
  assert.ok(TeacherTask.schema.path('hasTeacherFeedbackAudio'));
  assert.ok(TeacherTask.schema.path('circle'));
});

test('teacher dashboard merges group circles, strips student PII, redacts peer reports, and bulk-assigns circle tasks', async (t) => {
  const User = require('../models/User');
  const Teacher = require('../models/Teacher');
  const Session = require('../models/Session');
  const GroupCircle = require('../models/GroupCircle');
  const TeacherTask = require('../models/TeacherTask');
  const Guardian = require('../models/Guardian');
  const Notification = require('../models/Notification');

  const original = {
    readyState: mongoose.connection.readyState,
    UserFindById: User.findById,
    UserFind: User.find,
    TeacherFindOne: Teacher.findOne,
    SessionFind: Session.find,
    SessionExists: Session.exists,
    GroupCircleFind: GroupCircle.find,
    GroupCircleFindOne: GroupCircle.findOne,
    GroupCircleExists: GroupCircle.exists,
    TeacherTaskFind: TeacherTask.find,
    TeacherTaskCreate: TeacherTask.create,
    GuardianFind: Guardian.find,
    NotificationCreateAndSend: Notification.createAndSend,
  };

  const teacherUserId = oid();
  const teacherId = oid();
  const circleId = oid();
  const otherCircleId = oid();
  const studentAId = oid();
  const studentBId = oid();
  const strangerId = oid();
  const groupSessionId = oid();
  const taskDocs = [];
  const sentNotifications = [];

  const usersById = new Map([
    [teacherUserId, { _id: teacherUserId, id: teacherUserId, email: 'sheikh@test.local', name: 'الشيخ أحمد', role: 'teacher', isActive: true }],
    [studentAId, { _id: studentAId, name: 'عمر محمد', avatar: '', email: 'omar@secret.test', phone: '+20100000001', currentLevel: 'intermediate', preferredTrack: 'memorization', role: 'student', isActive: true }],
    [studentBId, { _id: studentBId, name: 'يوسف علي', avatar: '', email: 'youssef@secret.test', phone: '+20100000002', currentLevel: 'beginner', preferredTrack: 'memorization', role: 'student', isActive: true }],
    [strangerId, { _id: strangerId, name: 'طالب خارجي', email: 'stranger@secret.test', role: 'student', isActive: true }],
  ]);

  const circleDoc = {
    _id: circleId,
    name: 'حلقة الفرقان',
    teacher: teacherId,
    status: 'active',
    track: 'memorization',
    level: 'intermediate',
    students: [
      usersById.get(studentAId),
      usersById.get(studentBId),
    ],
  };

  const completedGroupSession = {
    _id: groupSessionId,
    teacher: teacherId,
    type: 'group_circle',
    status: 'completed',
    scheduledAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    duration: 60,
    circle: { _id: circleId, name: 'حلقة الفرقان', status: 'active' },
    attendance: [
      { student: usersById.get(studentAId), status: 'attended' },
      { student: usersById.get(studentBId), status: 'attended' },
    ],
    teacherEvaluation: {
      attendance: 5,
      memorization: 5,
      tajweed: 4,
      surahRecited: 'سورة الملك',
      overallNotes: 'حفظ متقن للحلقة',
    },
    studentReports: [
      { student: studentAId, memorizationScore: 10, tajweedScore: 8, surahRecited: 'سورة الملك', notes: 'ممتاز يا عمر' },
      { student: studentBId, memorizationScore: 4, tajweedScore: 4, surahRecited: 'سورة الملك', notes: 'تقرير خاص بطالب آخر' },
    ],
  };

  User.findById = (id) => {
    const doc = usersById.get(String(id)) || null;
    if (!doc) return queryOf(null);
    return queryOf({
      _id: doc._id,
      name: doc.name,
      avatar: doc.avatar || '',
      currentLevel: doc.currentLevel,
      preferredTrack: doc.preferredTrack,
      role: doc.role,
      isActive: doc.isActive,
      preferences: {},
    });
  };
  User.find = () => queryOf([usersById.get(studentAId), usersById.get(studentBId)]);
  Teacher.findOne = (filter = {}) => queryOf(String(filter.user) === teacherUserId ? { _id: teacherId, user: teacherUserId, status: 'approved', isVerified: true } : null);

  Session.find = (filter = {}) => {
    const filterStr = JSON.stringify(filter);
    if (filterStr.includes(strangerId)) return queryOf([]);
    if (filter.type === 'group_circle' && filterStr.includes('attendance.student')) {
      return queryOf({ distinct: async () => [studentAId, studentBId] });
    }
    return {
      ...queryOf([completedGroupSession]),
      distinct: async () => [],
      populate() { return this; },
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean() { return Promise.resolve([completedGroupSession]); },
    };
  };
  Session.exists = async (filter = {}) => {
    const target = String(filter.student || filter['attendance.student'] || '');
    return target === studentAId || target === studentBId;
  };

  GroupCircle.find = (filter = {}) => {
    if (filter.students && String(filter.students) === strangerId) return queryOf([]);
    return queryOf([circleDoc]);
  };
  GroupCircle.findOne = (filter = {}) => {
    if (String(filter._id) === circleId && String(filter.teacher) === teacherId) {
      return queryOf({ _id: circleId, name: 'حلقة الفرقان', students: [studentAId, studentBId] });
    }
    return queryOf(null);
  };
  GroupCircle.exists = async (filter = {}) => String(filter.students) === studentAId || String(filter.students) === studentBId;

  TeacherTask.find = () => queryOf(taskDocs);
  TeacherTask.create = async (payload) => {
    const created = {
      _id: oid(),
      ...payload,
      status: 'pending',
      createdAt: new Date(),
      toObject() { return { ...this }; },
    };
    taskDocs.push(created);
    return created;
  };

  Guardian.find = () => queryOf([]);
  Notification.createAndSend = async (userId, payload) => {
    sentNotifications.push({ userId: String(userId), ...payload });
    return null;
  };

  delete require.cache[require.resolve('../routes/teacherDashboard')];
  const teacherDashboardRouter = require('../routes/teacherDashboard');
  mongoose.connection.readyState = 1;
  const { generateAccessToken } = require('../middleware/auth');

  const app = express();
  app.use(express.json());
  app.use('/api/teachers/dashboard', teacherDashboardRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const teacherToken = generateAccessToken(usersById.get(teacherUserId));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    User.findById = original.UserFindById;
    User.find = original.UserFind;
    Teacher.findOne = original.TeacherFindOne;
    Session.find = original.SessionFind;
    Session.exists = original.SessionExists;
    GroupCircle.find = original.GroupCircleFind;
    GroupCircle.findOne = original.GroupCircleFindOne;
    GroupCircle.exists = original.GroupCircleExists;
    TeacherTask.find = original.TeacherTaskFind;
    TeacherTask.create = original.TeacherTaskCreate;
    Guardian.find = original.GuardianFind;
    Notification.createAndSend = original.NotificationCreateAndSend;
    mongoose.connection.readyState = original.readyState;
    delete require.cache[require.resolve('../routes/teacherDashboard')];
  });

  // 1. Active students include group circle students without PII
  const activeRes = await requestJson(baseUrl, '/api/teachers/dashboard/active-students', { token: teacherToken });
  assert.equal(activeRes.status, 200);
  assert.equal(activeRes.data.students.length, 2);
  const studentA = activeRes.data.students.find((s) => String(s._id) === studentAId);
  assert.ok(studentA);
  assert.equal(studentA.circles[0].name, 'حلقة الفرقان');
  assert.equal('email' in studentA, false);
  assert.equal('phone' in studentA, false);

  // 2. Summary forbids unowned student & redacts peer reports + PII for owned circle student
  const forbiddenSummary = await requestJson(baseUrl, `/api/teachers/dashboard/students/${strangerId}/summary`, { token: teacherToken });
  assert.equal(forbiddenSummary.status, 403);

  const summaryRes = await requestJson(baseUrl, `/api/teachers/dashboard/students/${studentAId}/summary`, { token: teacherToken });
  assert.equal(summaryRes.status, 200);
  assert.equal('email' in summaryRes.data.student, false);
  assert.deepEqual(summaryRes.data.quranSummary.recitedSurahs, ['سورة الملك']);
  assert.equal(summaryRes.data.sessions[0].progressReport.notes, 'ممتاز يا عمر');
  assert.equal(summaryRes.data.sessions[0].studentReports, undefined);

  // 3. Bulk task assignment rejects unowned circle & creates per-student tasks for owned circle
  const forbiddenTask = await requestJson(baseUrl, '/api/teachers/dashboard/tasks', {
    method: 'POST',
    token: teacherToken,
    body: { circleId: otherCircleId, type: 'memorization', title: 'اختبار حلقة غير مسندة' },
  });
  assert.equal(forbiddenTask.status, 403);

  const bulkTaskRes = await requestJson(baseUrl, '/api/teachers/dashboard/tasks', {
    method: 'POST',
    token: teacherToken,
    body: { circleId, type: 'memorization', title: 'تسميع سورة الملك 1-15' },
  });
  assert.equal(bulkTaskRes.status, 201);
  assert.equal(bulkTaskRes.data.count, 2);
  assert.equal(taskDocs.length, 2);
  assert.equal(sentNotifications.filter((n) => n.type === 'homework-assigned').length, 2);
});

test('student evaluations include group circles with peer redaction, homework deduplicates, and feedback audio enforces ownership', async (t) => {
  const User = require('../models/User');
  const Teacher = require('../models/Teacher');
  const Session = require('../models/Session');
  const TeacherTask = require('../models/TeacherTask');
  const HomeworkSubmission = require('../models/HomeworkSubmission');

  const original = {
    readyState: mongoose.connection.readyState,
    UserFindById: User.findById,
    SessionFind: Session.find,
    TeacherTaskFind: TeacherTask.find,
    TeacherTaskFindById: TeacherTask.findById,
    HomeworkSubmissionFind: HomeworkSubmission.find,
    TeacherFindOne: Teacher.findOne,
  };

  const studentAId = oid();
  const studentBId = oid();
  const strangerId = oid();
  const teacherId = oid();
  const teacherUserId = oid();
  const circleId = oid();
  const oneOnOneSessionId = oid();
  const groupSessionId = oid();
  const taskId = oid();

  const usersById = new Map([
    [studentAId, { _id: studentAId, id: studentAId, email: 'a@test.local', name: 'أحمد', role: 'student', isActive: true }],
    [strangerId, { _id: strangerId, id: strangerId, email: 'stranger@test.local', name: 'أجنبي', role: 'student', isActive: true }],
  ]);

  const groupEvalSession = {
    _id: groupSessionId,
    type: 'group_circle',
    status: 'completed',
    scheduledAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    duration: 60,
    timezone: 'Africa/Cairo',
    circle: { _id: circleId, name: 'حلقة النور' },
    teacher: {
      _id: teacherId,
      personalInfo: { fullName: 'الشيخ يوسف', country: 'Egypt', gender: 'male' },
      rating: { average: 5, count: 10 },
      user: { _id: teacherUserId, name: 'الشيخ يوسف', avatar: '' },
    },
    attendance: [
      { student: studentAId, status: 'attended' },
      { student: studentBId, status: 'attended' },
    ],
    teacherEvaluation: {
      attendance: 5,
      memorization: 5,
      tajweed: 5,
      surahRecited: 'سورة الواقعة',
    },
    studentReports: [
      { student: studentAId, memorizationScore: 10, tajweedScore: 9, surahRecited: 'سورة الواقعة', notes: 'تقرير أحمد الشخصي' },
      { student: studentBId, memorizationScore: 3, tajweedScore: 3, surahRecited: 'سورة الواقعة', notes: 'سر طالب آخر لا يجب كشفه' },
    ],
  };

  const legacySessionWithTask = {
    _id: oneOnOneSessionId,
    student: studentAId,
    status: 'completed',
    teacherEvaluation: {
      assignedHomework: [{ type: 'memorization', description: 'سورة المزمل', status: 'pending' }],
    },
  };

  const mirroredTask = {
    _id: taskId,
    session: oneOnOneSessionId,
    student: studentAId,
    teacher: teacherId,
    circle: { _id: circleId, name: 'حلقة النور' },
    type: 'memorization',
    title: 'واجب المزمل',
    description: 'سورة المزمل 1-10',
    status: 'done',
    hasTeacherFeedbackAudio: true,
    teacherFeedbackDuration: 18,
    teacherFeedbackAudio: 'https://blob.example/private-teacher-audio.webm',
  };

  User.findById = (id) => {
    const doc = usersById.get(String(id)) || null;
    return queryOf(doc ? { _id: doc._id, role: doc.role, isActive: true, name: doc.name } : null);
  };
  Session.find = (filter = {}) => {
    if (filter['teacherEvaluation.assignedHomework.0']) {
      return queryOf([legacySessionWithTask]);
    }
    return queryOf([groupEvalSession]);
  };
  TeacherTask.find = () => queryOf([mirroredTask]);
  TeacherTask.findById = (id) => queryOf(String(id) === taskId ? mirroredTask : null);
  HomeworkSubmission.find = () => queryOf([]);
  Teacher.findOne = () => queryOf(null);

  delete require.cache[require.resolve('../routes/studentDashboard')];
  delete require.cache[require.resolve('../routes/homework')];
  const studentDashboardRouter = require('../routes/studentDashboard');
  const homeworkRouter = require('../routes/homework');
  mongoose.connection.readyState = 1;
  const { generateAccessToken } = require('../middleware/auth');

  const app = express();
  app.use(express.json());
  app.use('/api/students/dashboard', studentDashboardRouter);
  app.use('/api/homework', homeworkRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const studentAToken = generateAccessToken(usersById.get(studentAId));
  const strangerToken = generateAccessToken(usersById.get(strangerId));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    User.findById = original.UserFindById;
    Session.find = original.SessionFind;
    TeacherTask.find = original.TeacherTaskFind;
    TeacherTask.findById = original.TeacherTaskFindById;
    HomeworkSubmission.find = original.HomeworkSubmissionFind;
    Teacher.findOne = original.TeacherFindOne;
    mongoose.connection.readyState = original.readyState;
    delete require.cache[require.resolve('../routes/studentDashboard')];
    delete require.cache[require.resolve('../routes/homework')];
  });

  // 1. Group circle evaluations appear with peer reports redacted
  const evalRes = await requestJson(baseUrl, '/api/students/dashboard/evaluations', { token: studentAToken });
  assert.equal(evalRes.status, 200);
  assert.equal(evalRes.data.evaluations.length, 1);
  assert.equal(evalRes.data.evaluations[0].circle.name, 'حلقة النور');
  assert.equal(evalRes.data.evaluations[0].studentReports.length, 1);
  assert.equal(evalRes.data.evaluations[0].studentReports[0].notes, 'تقرير أحمد الشخصي');

  // 2. Homework list deduplicates legacy session assignedHomework backed by TeacherTask & hides raw storage reference
  const hwRes = await requestJson(baseUrl, '/api/homework/student', { token: studentAToken });
  assert.equal(hwRes.status, 200);
  assert.equal(hwRes.data.homework.length, 1);
  assert.equal(hwRes.data.homework[0].title, 'واجب المزمل');
  assert.equal(hwRes.data.homework[0].circleName, 'حلقة النور');
  assert.equal(hwRes.data.homework[0].hasTeacherFeedbackAudio, true);
  assert.equal(hwRes.data.homework[0].teacherFeedbackDuration, 18);
  assert.equal(hwRes.data.homework[0].teacherFeedbackAudio, undefined);

  // 3. Feedback audio endpoint blocks unauthorized student
  const audioForbiddenRes = await requestJson(baseUrl, `/api/homework/tasks/${taskId}/feedback-audio`, { token: strangerToken });
  assert.equal(audioForbiddenRes.status, 403);
});

test('sessions allow student reschedule acceptance and pending request cancellation with state guards', async (t) => {
  const User = require('../models/User');
  const Teacher = require('../models/Teacher');
  const Session = require('../models/Session');
  const Guardian = require('../models/Guardian');
  const Notification = require('../models/Notification');

  const original = {
    readyState: mongoose.connection.readyState,
    UserFindById: User.findById,
    TeacherFindById: Teacher.findById,
    SessionFindOne: Session.findOne,
    GuardianFind: Guardian.find,
    NotificationCreateAndSend: Notification.createAndSend,
  };

  const studentId = oid();
  const teacherId = oid();
  const teacherUserId = oid();
  const regularPendingId = oid();
  const rescheduledPendingId = oid();
  const alreadyAcceptedId = oid();
  const sentNotifications = [];

  const sessionsMap = new Map([
    [
      regularPendingId,
      {
        _id: regularPendingId,
        student: studentId,
        teacher: teacherId,
        type: 'regular',
        status: 'pending',
        timezone: 'Africa/Cairo',
        scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        async save() { return this; },
      },
    ],
    [
      rescheduledPendingId,
      {
        _id: rescheduledPendingId,
        student: studentId,
        teacher: teacherId,
        type: 'regular',
        status: 'pending',
        rescheduledFrom: oid(),
        timezone: 'Africa/Cairo',
        scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        async save() { return this; },
      },
    ],
    [
      alreadyAcceptedId,
      {
        _id: alreadyAcceptedId,
        student: studentId,
        teacher: teacherId,
        type: 'regular',
        status: 'accepted',
        scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        async save() { return this; },
      },
    ],
  ]);

  User.findById = (id) => {
    if (String(id) === studentId) {
      return queryOf({ _id: studentId, name: 'سعد', role: 'student', isActive: true, preferences: {} });
    }
    if (String(id) === teacherUserId) {
      return queryOf({ _id: teacherUserId, name: 'الشيخ حسن', role: 'teacher', isActive: true, preferences: {} });
    }
    return queryOf(null);
  };
  Teacher.findById = (id) => queryOf(String(id) === teacherId ? { _id: teacherId, user: teacherUserId } : null);
  Session.findOne = (filter = {}) => {
    const doc = sessionsMap.get(String(filter._id));
    if (!doc || String(doc.student) !== String(filter.student)) return queryOf(null);
    return queryOf(doc);
  };
  Guardian.find = () => queryOf([]);
  Notification.createAndSend = async (userId, payload) => {
    sentNotifications.push({ userId: String(userId), ...payload });
    return null;
  };

  delete require.cache[require.resolve('../routes/sessions')];
  const sessionsRouter = require('../routes/sessions');
  mongoose.connection.readyState = 1;
  const { generateAccessToken } = require('../middleware/auth');

  const app = express();
  app.use(express.json());
  app.use('/api/sessions', sessionsRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const studentToken = generateAccessToken({ _id: studentId, id: studentId, email: 'saad@test.local', role: 'student' });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    User.findById = original.UserFindById;
    Teacher.findById = original.TeacherFindById;
    Session.findOne = original.SessionFindOne;
    Guardian.find = original.GuardianFind;
    Notification.createAndSend = original.NotificationCreateAndSend;
    mongoose.connection.readyState = original.readyState;
    delete require.cache[require.resolve('../routes/sessions')];
  });

  // 1. Rejects accept-reschedule on non-rescheduled pending session
  const notRescheduledRes = await requestJson(baseUrl, `/api/sessions/${regularPendingId}/accept-reschedule`, {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(notRescheduledRes.status, 409);
  assert.equal(notRescheduledRes.data.code, 'RESCHEDULE_NOT_ACCEPTABLE');

  // 2. Accepts rescheduled pending session & notifies teacher
  const acceptRes = await requestJson(baseUrl, `/api/sessions/${rescheduledPendingId}/accept-reschedule`, {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.data.session.status, 'accepted');
  assert.ok(acceptRes.data.session.meetingLink);
  assert.ok(sentNotifications.some((n) => n.userId === teacherUserId && n.type === 'session-accepted'));

  // 3. Rejects cancel-request on already accepted session
  const cancelAcceptedRes = await requestJson(baseUrl, `/api/sessions/${alreadyAcceptedId}/cancel-request`, {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(cancelAcceptedRes.status, 409);
  assert.equal(cancelAcceptedRes.data.code, 'SESSION_NOT_PENDING');

  // 4. Cancels pending session request & notifies teacher
  const cancelPendingRes = await requestJson(baseUrl, `/api/sessions/${regularPendingId}/cancel-request`, {
    method: 'POST',
    token: studentToken,
    body: { reason: 'تعارض وقت' },
  });
  assert.equal(cancelPendingRes.status, 200);
  assert.equal(cancelPendingRes.data.session.status, 'cancelled');
  assert.ok(sentNotifications.some((n) => n.userId === teacherUserId && n.type === 'session-cancelled'));
});
