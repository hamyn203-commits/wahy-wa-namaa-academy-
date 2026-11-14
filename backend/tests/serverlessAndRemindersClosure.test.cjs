'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Readable } = require('node:stream');
const mongoose = require('mongoose');

process.env.FRONTEND_URL = 'https://wahywanamaa.com';

const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');
const { addMockTeacher } = require('../mockStore');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const GroupCircle = require('../models/GroupCircle');
const LiveSession = require('../models/LiveSession');
const TeacherTask = require('../models/TeacherTask');
const Progress = require('../models/Progress');
const RecitationReport = require('../models/RecitationReport');
const Guardian = require('../models/Guardian');
const whatsapp = require('../services/whatsapp');
const scheduler = require('../services/scheduler');
const objectStorage = require('../services/objectStorage');

function chainQuery(value) {
  const promise = Promise.resolve(value);
  const query = {
    select: () => query,
    populate: () => query,
    sort: () => query,
    limit: () => query,
    lean: () => promise,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return query;
}

test('Batch 3 Closure: WhatsApp URL resolution, group_circle scheduler idempotency, LiveKit batched access, direct audio storageRef, and live AI reports', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function apiJson(method, path, { token, body } = {}) {
    const headers = { Origin: 'https://wahywanamaa.com' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, { method, headers, body: payload });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const originals = {
    sessionFind: Session.find,
    sessionFindById: Session.findById,
    sessionUpdateOne: Session.updateOne,
    sessionExists: Session.exists,
    circleFindById: GroupCircle.findById,
    circleFind: GroupCircle.find,
    circleExists: GroupCircle.exists,
    userFind: User.find,
    userFindById: User.findById,
    guardianFindOne: Guardian.findOne,
    liveFind: LiveSession.find,
    teacherFindOne: Teacher.findOne,
    taskFind: TeacherTask.find,
    progressFind: Progress.find,
    reportCreate: RecitationReport.create,
    isOwned: objectStorage.isOwnedObjectReference,
    getPrivate: objectStorage.getPrivateObject,
  };

  try {
    // 1. WhatsApp URL resolver check
    const sampleId = '507f1f77bcf86cd799439101';
    assert.equal(
      whatsapp.resolveAbsoluteRoomUrl({ _id: sampleId, meetingLink: '/live/room_abc' }),
      'https://wahywanamaa.com/ar/live/room_abc'
    );
    assert.equal(
      whatsapp.resolveAbsoluteRoomUrl({ _id: sampleId, meetingLink: '/en/live/room_xyz' }),
      'https://wahywanamaa.com/en/live/room_xyz'
    );

    // 2. Group circle reminder scheduler: skips excused students & checks delivery.success before stamping
    const s1Id = '507f1f77bcf86cd799439111';
    const s2Id = '507f1f77bcf86cd799439112';
    const s3ExcusedId = '507f1f77bcf86cd799439113';
    const circleId = '507f1f77bcf86cd799439114';
    const groupSessionId = '507f1f77bcf86cd799439115';

    const sessionState = {
      _id: groupSessionId,
      circle: circleId,
      type: 'group_circle',
      status: 'accepted',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      meetingLink: '/live/group_room_1',
      attendance: [
        { student: s1Id, status: 'confirmed' },
        { student: s2Id, status: 'pending' },
        { student: s3ExcusedId, status: 'excused' },
      ],
      reminders: { dayBeforeSent: false, dayBeforeRecipients: [] },
    };

    let updateCalls = [];
    Session.find = () => chainQuery([sessionState]);
    Session.updateOne = async (_filter, updateDoc) => {
      updateCalls.push(updateDoc);
      if (updateDoc.$addToSet?.['reminders.dayBeforeRecipients']?.$each) {
        sessionState.reminders.dayBeforeRecipients.push(
          ...updateDoc.$addToSet['reminders.dayBeforeRecipients'].$each
        );
      }
      if (updateDoc.$set?.['reminders.dayBeforeSent']) {
        sessionState.reminders.dayBeforeSent = true;
      }
      return { modifiedCount: 1 };
    };
    GroupCircle.findById = () => chainQuery({ _id: circleId, students: [s1Id, s2Id, s3ExcusedId] });
    User.find = () => chainQuery([
      { _id: s1Id, name: 'Student 1', whatsappPhone: '+201011111111' },
      { _id: s2Id, name: 'Student 2', whatsappPhone: '+201022222222' },
    ]);
    Guardian.findOne = () => chainQuery(null);

    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.WHATSAPP_CLOUD_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.TWILIO_ACCOUNT_SID;
    try {
      const failedCount = await scheduler.process24HourReminders();
      assert.equal(failedCount, 0);
      assert.equal(sessionState.reminders.dayBeforeSent, false);
      assert.equal(updateCalls.length, 0);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }

    const okCount = await scheduler.process24HourReminders();
    assert.equal(okCount, 1);
    assert.equal(sessionState.reminders.dayBeforeSent, true);
    assert.equal(sessionState.reminders.dayBeforeRecipients.length, 2);

    // 3. GET /api/live/sessions batched filtering without N+1 queries
    const studentAToken = generateAccessToken({ id: s1Id, email: 's1@wahy.test', role: 'student' });
    const bookedSessionAId = '507f1f77bcf86cd799439121';
    const bookedSessionBId = '507f1f77bcf86cd799439122';

    let sessionFindBatchCalls = 0;
    LiveSession.find = () => chainQuery([
      {
        roomId: 'room_a',
        session: bookedSessionAId,
        title: 'Room A',
        toObject() { return { roomId: 'room_a', session: bookedSessionAId, title: 'Room A' }; },
      },
      {
        roomId: 'room_b',
        session: bookedSessionBId,
        title: 'Room B',
        toObject() { return { roomId: 'room_b', session: bookedSessionBId, title: 'Room B' }; },
      },
    ]);
    Session.find = () => {
      sessionFindBatchCalls += 1;
      return chainQuery([
        {
          _id: bookedSessionAId,
          student: s1Id,
          status: 'accepted',
          scheduledAt: new Date(Date.now() + 10 * 60 * 1000),
          duration: 60,
        },
        {
          _id: bookedSessionBId,
          student: s2Id,
          status: 'accepted',
          scheduledAt: new Date(Date.now() + 10 * 60 * 1000),
          duration: 60,
        },
      ]);
    };
    GroupCircle.find = () => chainQuery([]);

    const liveRes = await apiJson('GET', '/api/live/sessions', { token: studentAToken });
    assert.equal(liveRes.status, 200);
    assert.equal(liveRes.data.length, 1);
    assert.equal(liveRes.data[0].roomId, 'room_a');
    assert.equal(sessionFindBatchCalls, 1, 'Expected exactly 1 batched Session.find call');

    // 4. POST /api/ai/recitation-analyze direct storageRef ownership + magic bytes
    RecitationReport.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId() });
    objectStorage.isOwnedObjectReference = (ref, purpose, owner) =>
      String(ref).startsWith(`https://store.blob.vercel-storage.com/uploads/${purpose}/${String(owner).toLowerCase()}/`);

    const foreignRef = `https://store.blob.vercel-storage.com/uploads/recitation-audio/${s2Id.toLowerCase()}/audio.mp3`;
    const foreignRes = await apiJson('POST', '/api/ai/recitation-analyze', {
      token: studentAToken,
      body: { storageRef: foreignRef, contentType: 'audio/mpeg', filename: 'audio.mp3' },
    });
    assert.equal(foreignRes.status, 403);
    assert.equal(foreignRes.data.code, 'INVALID_AUDIO_STORAGE_REF');

    const ownRef = `https://store.blob.vercel-storage.com/uploads/recitation-audio/${s1Id.toLowerCase()}/audio.mp3`;
    objectStorage.getPrivateObject = async () => ({
      statusCode: 200,
      stream: Readable.from([Buffer.from('PLAIN_TEXT_NOT_MP3_BYTES_1234567890')]),
      blob: { contentType: 'audio/mpeg' },
    });
    const badMagic = await apiJson('POST', '/api/ai/recitation-analyze', {
      token: studentAToken,
      body: { storageRef: ownRef, contentType: 'audio/mpeg', filename: 'audio.mp3' },
    });
    assert.equal(badMagic.status, 400);
    assert.equal(badMagic.data.code, 'INVALID_AUDIO_MAGIC_BYTES');

    const validMp3 = Buffer.concat([
      Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      Buffer.alloc(64, 0),
    ]);
    objectStorage.getPrivateObject = async () => ({
      statusCode: 200,
      stream: Readable.from([validMp3]),
      blob: { contentType: 'audio/mpeg' },
    });
    const okAudio = await apiJson('POST', '/api/ai/recitation-analyze', {
      token: studentAToken,
      body: { storageRef: ownRef, contentType: 'audio/mpeg', filename: 'audio.mp3', surah: 'الفاتحة' },
    });
    assert.equal(okAudio.status, 200);
    assert.equal(typeof okAudio.data.overallScore, 'number');

    // 5. POST /api/ai/reports-generate teacher scope + live metrics
    const teacherUserId = '507f1f77bcf86cd799439131';
    const teacherProfileId = '507f1f77bcf86cd799439132';
    addMockTeacher({
      _id: teacherProfileId,
      user: teacherUserId,
      status: 'approved',
      isVerified: true,
    });
    const teacherToken = generateAccessToken({ id: teacherUserId, email: 't@wahy.test', role: 'teacher' });

    Teacher.findOne = () => chainQuery({ _id: teacherProfileId, applicationStatus: 'approved', isApproved: true });
    Session.exists = async ({ $or }) => {
      const target = $or?.[0]?.student;
      return target === s1Id ? { _id: '1' } : null;
    };
    GroupCircle.exists = async () => null;
    Session.find = () => chainQuery([
      {
        student: s1Id,
        status: 'completed',
        attendance: [],
        teacherEvaluation: { memorizationScore: 9, tajweedScore: 8 },
        studentReports: [],
      },
    ]);
    TeacherTask.find = () => chainQuery([{ status: 'done' }, { status: 'pending' }]);
    Progress.find = () => chainQuery([{ overallProgress: { percentage: 80 } }]);

    const unauthorizedReport = await apiJson('POST', '/api/ai/reports-generate', {
      token: teacherToken,
      body: { studentId: s2Id, period: 'monthly' },
    });
    assert.equal(unauthorizedReport.status, 403);
    assert.equal(unauthorizedReport.data.code, 'TEACHER_STUDENT_SCOPE_VIOLATION');

    const realReport = await apiJson('POST', '/api/ai/reports-generate', {
      token: teacherToken,
      body: { studentId: s1Id, period: 'monthly' },
    });
    assert.equal(realReport.status, 200);
    assert.equal(realReport.data.summary.attendance, 100);
    assert.equal(realReport.data.summary.homeworkCompletion, 50);
    assert.equal(realReport.data.summary.progress, 80);
    assert.equal(realReport.data.summary.averageScore, 85);
  } finally {
    Session.find = originals.sessionFind;
    Session.findById = originals.sessionFindById;
    Session.updateOne = originals.sessionUpdateOne;
    Session.exists = originals.sessionExists;
    GroupCircle.findById = originals.circleFindById;
    GroupCircle.find = originals.circleFind;
    GroupCircle.exists = originals.circleExists;
    User.find = originals.userFind;
    User.findById = originals.userFindById;
    Guardian.findOne = originals.guardianFindOne;
    LiveSession.find = originals.liveFind;
    Teacher.findOne = originals.teacherFindOne;
    TeacherTask.find = originals.taskFind;
    Progress.find = originals.progressFind;
    RecitationReport.create = originals.reportCreate;
    objectStorage.isOwnedObjectReference = originals.isOwned;
    objectStorage.getPrivateObject = originals.getPrivate;
    await new Promise((resolve) => server.close(resolve));
  }
});
