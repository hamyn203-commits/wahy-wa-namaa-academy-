'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'development';
process.env.LIVEKIT_API_KEY = 'qa-livekit-key';
process.env.LIVEKIT_API_SECRET = 'qa-livekit-secret-abcdefghijklmnopqrstuvwxyz';
process.env.LIVEKIT_URL = 'wss://qa.example.livekit.cloud';

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const LiveSession = require('../models/LiveSession');

const originalReadyState = mongoose.connection.readyState;

const oid = () => new mongoose.Types.ObjectId().toString();
const ids = {
  teacherUser: oid(),
  teacher: oid(),
  student: oid(),
  guardian: oid(),
  strangerGuardian: oid(),
  session: oid(),
};

const users = {
  teacher: { _id: ids.teacherUser, id: ids.teacherUser, email: 'teacher@example.test', role: 'teacher' },
  student: { _id: ids.student, id: ids.student, email: 'student@example.test', role: 'student' },
  guardian: { _id: ids.guardian, id: ids.guardian, email: 'guardian@example.test', role: 'guardian' },
  strangerGuardian: { _id: ids.strangerGuardian, id: ids.strangerGuardian, email: 'stranger@example.test', role: 'guardian' },
};

const teacherProfile = {
  _id: ids.teacher,
  user: ids.teacherUser,
  status: 'approved',
  isVerified: true,
};

const bookedSession = {
  _id: ids.session,
  teacher: ids.teacher,
  student: ids.student,
  status: 'accepted',
  scheduledAt: new Date().toISOString(),
  duration: 60,
  attendance: [],
  circle: null,
};

const liveSession = {
  _id: oid(),
  roomId: 'qa-room-1',
  session: ids.session,
  title: 'QA Live Room',
  isLive: true,
};

function q(value) {
  const query = {
    select() { return query; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return query;
}

const originalTeacherFindOne = Teacher.findOne;
const originalSessionFindById = Session.findById;
const originalGuardianFindOne = Guardian.findOne;
const originalLiveFindOne = LiveSession.findOne;
const originalUserFindById = User.findById;
const originalUserFind = User.find;
const originalSessionUpdateOne = Session.updateOne;

Teacher.findOne = (filter = {}) => {
  if (filter.user && String(filter.user) === ids.teacherUser) return q(teacherProfile);
  return q(null);
};

Session.findById = (id) => q(String(id) === ids.session ? bookedSession : null);

Guardian.findOne = (filter = {}) => {
  if (String(filter.user) === ids.guardian) {
    return q({
      user: ids.guardian,
      isActive: true,
      children: [{ student: ids.student }],
    });
  }
  if (String(filter.user) === ids.strangerGuardian) {
    return q({
      user: ids.strangerGuardian,
      isActive: true,
      children: [{ student: oid() }],
    });
  }
  return q(null);
};

LiveSession.findOne = (filter = {}) => q(filter.roomId === liveSession.roomId ? liveSession : null);

// The token route looks up the participant display name. Without this stub the
// query waits on a database that does not exist and the request never returns.
User.findById = (id) => {
  const found = Object.values(users).find((item) => String(item._id) === String(id));
  const value = found ? { _id: found._id, name: found.role + ' qa' } : null;
  const query = {
    select() { return query; },
    lean() { return query; },
    catch() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return query;
};
User.find = () => {
  const query = {
    select() { return query; },
    lean() { return query; },
    catch() { return Promise.resolve([]); },
    then(resolve, reject) { return Promise.resolve([]).then(resolve, reject); },
  };
  return query;
};
Session.updateOne = async () => ({ acknowledged: true, modifiedCount: 0 });

delete require.cache[require.resolve('../routes/live')];
const liveRouter = require('../routes/live');
const { generateAccessToken } = require('../middleware/auth');

// Compile every model used by the live route while disconnected. After that,
// simulate a connected database because all model IO in this test is stubbed.
mongoose.connection.readyState = 1;

async function call(base, user, body) {
  const response = await fetch(base + '/api/live/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + generateAccessToken(user),
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
  };
}

test('LiveKit room permissions are server-derived and fail closed', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/live', liveRouter);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    bookedSession.status = 'accepted';
    await new Promise((resolve) => server.close(resolve));
    Teacher.findOne = originalTeacherFindOne;
    Session.findById = originalSessionFindById;
    Guardian.findOne = originalGuardianFindOne;
    LiveSession.findOne = originalLiveFindOne;
    User.findById = originalUserFindById;
    User.find = originalUserFind;
    Session.updateOne = originalSessionUpdateOne;
    mongoose.connection.readyState = originalReadyState;
    delete require.cache[require.resolve('../routes/live')];
  });

  const base = 'http://127.0.0.1:' + server.address().port;

  const teacher = await call(base, users.teacher, { roomName: liveSession.roomId });
  assert.equal(teacher.status, 200);
  assert.equal(teacher.data.permissions.role, 'teacher');
  assert.equal(teacher.data.permissions.isHost, true);
  assert.equal(teacher.data.permissions.isObserver, false);
  assert.equal(teacher.data.permissions.canPublish, true);

  const teacherToken = jwt.decode(teacher.data.token);
  assert.equal(teacherToken.video.roomJoin, true);
  assert.equal(teacherToken.video.canPublish, true);
  assert.equal(teacherToken.video.canSubscribe, true);

  const student = await call(base, users.student, { roomName: liveSession.roomId });
  assert.equal(student.status, 200);
  assert.equal(student.data.permissions.role, 'student');
  assert.equal(student.data.permissions.isHost, false);
  assert.equal(student.data.permissions.isObserver, false);
  assert.equal(student.data.permissions.canPublish, true);

  const guardian = await call(base, users.guardian, { roomName: liveSession.roomId });
  assert.equal(guardian.status, 200);
  assert.equal(guardian.data.permissions.role, 'guardian');
  assert.equal(guardian.data.permissions.isHost, false);
  assert.equal(guardian.data.permissions.isObserver, true);
  assert.equal(guardian.data.permissions.canPublish, false);

  const guardianToken = jwt.decode(guardian.data.token);
  assert.equal(guardianToken.video.roomJoin, true);
  assert.equal(guardianToken.video.canPublish, false);
  assert.equal(guardianToken.video.canSubscribe, true);

  const stranger = await call(base, users.strangerGuardian, { roomName: liveSession.roomId });
  assert.equal(stranger.status, 403);

  bookedSession.status = 'pending';
  const pendingStudent = await call(base, users.student, { roomName: liveSession.roomId });
  assert.equal(pendingStudent.status, 403);
});
