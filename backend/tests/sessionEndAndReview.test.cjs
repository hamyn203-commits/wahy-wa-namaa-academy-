'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'development';
process.env.LIVEKIT_API_KEY = 'qa-livekit-key';
process.env.LIVEKIT_API_SECRET = 'qa-livekit-secret-abcdefghijklmnopqrstuvwxyz';
process.env.LIVEKIT_URL = 'wss://qa.example.livekit.cloud';

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const LiveSession = require('../models/LiveSession');
const Review = require('../models/Review');

const originalReadyState = mongoose.connection.readyState;
const oid = () => new mongoose.Types.ObjectId().toString();

function q(value) {
  const query = {
    select() { return query; },
    populate() { return query; },
    lean() { return query; },
    catch() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return query;
}

test('Teacher ending session closes learner room immediately and enables post-session review for trial, regular, and group_circle', async (t) => {
  const ids = {
    teacherUser: oid(),
    teacher: oid(),
    trialStudent: oid(),
    groupStudentA: oid(),
    groupStudentB: oid(),
    strangerStudent: oid(),
    trialSession: oid(),
    regularSession: oid(),
    groupSession: oid(),
    futureSession: oid(),
  };

  const users = {
    teacher: { _id: ids.teacherUser, id: ids.teacherUser, email: 't@example.test', role: 'teacher' },
    trialStudent: { _id: ids.trialStudent, id: ids.trialStudent, email: 'trial@example.test', role: 'student' },
    groupStudentA: { _id: ids.groupStudentA, id: ids.groupStudentA, email: 'ga@example.test', role: 'student' },
    groupStudentB: { _id: ids.groupStudentB, id: ids.groupStudentB, email: 'gb@example.test', role: 'student' },
    stranger: { _id: ids.strangerStudent, id: ids.strangerStudent, email: 'stranger@example.test', role: 'student' },
  };

  const origTeacherFindOne = Teacher.findOne;
  const origTeacherFindById = Teacher.findById;
  const origSessionFindById = Session.findById;
  const origSessionFindOne = Session.findOne;
  const origGuardianFindOne = Guardian.findOne;
  const origLiveFindOne = LiveSession.findOne;
  const origLiveUpdateOne = LiveSession.updateOne;
  const origUserFindById = User.findById;
  const origUserFind = User.find;
  const origReviewFindOne = Review.findOne;
  const origReviewCreate = Review.create;
  const origUpdateTeacherRating = Review.updateTeacherRating;

  const sessionsStore = new Map();

  const makeSessionDoc = (doc) => ({
    ...doc,
    async save() {
      sessionsStore.set(String(this._id), this);
      return this;
    },
  });

  // 1. Early-started Trial Session (scheduled 10 mins from now, within 30-min join window)
  sessionsStore.set(
    ids.trialSession,
    makeSessionDoc({
      _id: ids.trialSession,
      type: 'trial',
      status: 'accepted',
      student: ids.trialStudent,
      teacher: ids.teacher,
      scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      duration: 30,
      attendance: [],
    })
  );

  // 2. Completed Regular 1-on-1 Session
  sessionsStore.set(
    ids.regularSession,
    makeSessionDoc({
      _id: ids.regularSession,
      type: 'regular',
      status: 'completed',
      student: ids.trialStudent,
      teacher: ids.teacher,
      scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      duration: 60,
      attendance: [],
    })
  );

  // 3. Group Circle Session (no `session.student`, learners in `attendance`)
  sessionsStore.set(
    ids.groupSession,
    makeSessionDoc({
      _id: ids.groupSession,
      type: 'group_circle',
      status: 'completed',
      student: undefined,
      teacher: ids.teacher,
      scheduledAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      duration: 60,
      attendance: [
        { student: ids.groupStudentA, status: 'attended' },
        { student: ids.groupStudentB, status: 'attended' },
      ],
      studentFeedbacks: [],
    })
  );

  // 4. Future Accepted Session that has NOT started or ended
  sessionsStore.set(
    ids.futureSession,
    makeSessionDoc({
      _id: ids.futureSession,
      type: 'regular',
      status: 'accepted',
      student: ids.trialStudent,
      teacher: ids.teacher,
      scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      duration: 60,
      attendance: [],
    })
  );

  const trialLiveDoc = {
    _id: oid(),
    roomId: 'qa-trial-end-room',
    session: ids.trialSession,
    title: 'حصة تجريبية',
    subject: 'quran',
    isLive: true,
    endedAt: null,
    classroomState: {},
    async save() {
      return this;
    },
  };

  const createdReviews = [];
  let ratingUpdatesCount = 0;

  Teacher.findOne = (filter = {}) => {
    if (String(filter.user) === ids.teacherUser) {
      return q({ _id: ids.teacher, user: ids.teacherUser, personalInfo: { fullName: 'الشيخ محمود الحصري' }, status: 'approved', isVerified: true });
    }
    return q(null);
  };
  Teacher.findById = (id) => {
    if (String(id) === ids.teacher) {
      return q({ _id: ids.teacher, user: ids.teacherUser, personalInfo: { fullName: 'الشيخ محمود الحصري' } });
    }
    return q(null);
  };
  Session.findById = (id) => q(sessionsStore.get(String(id)) || null);
  Session.findOne = (filter = {}) => {
    const doc = sessionsStore.get(String(filter._id || ''));
    if (!doc) return q(null);
    if (filter.status) {
      const allowed = Array.isArray(filter.status.$in) ? filter.status.$in : [filter.status];
      if (!allowed.includes(doc.status)) return q(null);
    }
    return q(doc);
  };
  Guardian.findOne = () => q(null);
  LiveSession.findOne = (filter = {}) => {
    if (filter.roomId === trialLiveDoc.roomId || String(filter.session) === ids.trialSession) {
      return q(trialLiveDoc);
    }
    return q(null);
  };
  LiveSession.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
  User.findById = (id) => {
    const found = Object.values(users).find((u) => String(u._id) === String(id));
    return q(found ? { _id: found._id, name: found.role, role: found.role, isActive: true } : null);
  };
  User.find = () => q([{ _id: ids.trialStudent, name: 'طالب التجريبي' }]);

  Review.findOne = async (filter = {}) =>
    createdReviews.find(
      (r) => String(r.student) === String(filter.student) && String(r.session) === String(filter.session)
    ) || null;
  Review.create = async (payload) => {
    const item = { _id: oid(), ...payload };
    createdReviews.push(item);
    return item;
  };
  Review.updateTeacherRating = async () => {
    ratingUpdatesCount += 1;
  };

  delete require.cache[require.resolve('../routes/live')];
  delete require.cache[require.resolve('../routes/reviews')];
  delete require.cache[require.resolve('../routes/sessions')];
  const liveRouter = require('../routes/live');
  const reviewsRouter = require('../routes/reviews');
  const sessionsRouter = require('../routes/sessions');
  const { generateAccessToken } = require('../middleware/auth');
  mongoose.connection.readyState = 1;

  const app = express();
  app.use(express.json());
  app.use('/api/live', liveRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/sessions', sessionsRouter);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Teacher.findOne = origTeacherFindOne;
    Teacher.findById = origTeacherFindById;
    Session.findById = origSessionFindById;
    Session.findOne = origSessionFindOne;
    Guardian.findOne = origGuardianFindOne;
    LiveSession.findOne = origLiveFindOne;
    LiveSession.updateOne = origLiveUpdateOne;
    User.findById = origUserFindById;
    User.find = origUserFind;
    Review.findOne = origReviewFindOne;
    Review.create = origReviewCreate;
    Review.updateTeacherRating = origUpdateTeacherRating;
    mongoose.connection.readyState = originalReadyState;
    delete require.cache[require.resolve('../routes/live')];
    delete require.cache[require.resolve('../routes/reviews')];
    delete require.cache[require.resolve('../routes/sessions')];
  });

  const base = 'http://127.0.0.1:' + server.address().port;
  const req = async (method, path, user, body) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + generateAccessToken(user),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  // A. Before ending: future session cannot be reviewed prematurely
  const prematureReview = await req('POST', '/api/reviews', users.trialStudent, {
    sessionId: ids.futureSession,
    rating: 5,
    comment: 'محاولة مبكرة',
  });
  assert.equal(prematureReview.status, 404);

  // B. Teacher ends the live trial classroom -> propagates sessionEnded = true immediately
  const endRes = await req('POST', `/api/live/sessions/${trialLiveDoc.roomId}/end`, users.teacher);
  assert.equal(endRes.status, 200);
  assert.equal(endRes.data.sessionEnded, true);
  assert.equal(endRes.data.classroomState.controls.sessionEnded, true);
  assert.equal(endRes.data.sessionContext.sessionType, 'trial');
  assert.equal(endRes.data.sessionContext.teacherName, 'الشيخ محمود الحصري');

  // C. Trial student polls state -> sees sessionEnded = true + teacherName (even when session becomes completed!)
  const studentPoll1 = await req('GET', `/api/live/sessions/${trialLiveDoc.roomId}/state`, users.trialStudent);
  assert.equal(studentPoll1.status, 200);
  assert.equal(studentPoll1.data.sessionEnded, true);
  assert.equal(studentPoll1.data.classroomState.controls.sessionEnded, true);
  assert.equal(studentPoll1.data.sessionContext.sessionId, ids.trialSession);

  // Student cannot mint a new LiveKit token once room ended
  const blockedToken = await req('POST', '/api/live/token', users.trialStudent, {
    roomName: trialLiveDoc.roomId,
  });
  assert.equal(blockedToken.status, 403);
  assert.equal(blockedToken.data.code, 'SESSION_ENDED');

  // Stranger student still gets 403 on state read
  const strangerPoll = await req('GET', `/api/live/sessions/${trialLiveDoc.roomId}/state`, users.stranger);
  assert.equal(strangerPoll.status, 403);

  // D. Trial student immediately rates teacher BEFORE teacher finishes completing evaluation form!
  const trialReview = await req('POST', '/api/reviews', users.trialStudent, {
    sessionId: ids.trialSession,
    rating: 5,
    comment: 'حصة تجريبية ممتازة جداً',
    wouldContinue: true,
  });
  assert.equal(trialReview.status, 201);
  assert.equal(sessionsStore.get(ids.trialSession).studentFeedback.rating, 5);
  assert.equal(sessionsStore.get(ids.trialSession).studentFeedback.wouldContinue, true);

  // Even after teacher marks session status = 'completed', state endpoint still cleanly reports sessionEnded = true
  sessionsStore.get(ids.trialSession).status = 'completed';
  const studentPollAfterComplete = await req('GET', `/api/live/sessions/${trialLiveDoc.roomId}/state`, users.trialStudent);
  assert.equal(studentPollAfterComplete.status, 200);
  assert.equal(studentPollAfterComplete.data.sessionEnded, true);

  // E. Regular 1-on-1 session review succeeds
  const regularReview = await req('POST', '/api/reviews', users.trialStudent, {
    sessionId: ids.regularSession,
    rating: 4,
    comment: 'مراجعة طيبة',
  });
  assert.equal(regularReview.status, 201);

  // F. Group Circle session: BOTH enrolled learners succeed, stranger fails closed!
  const strangerGroupAttempt = await req('POST', '/api/reviews', users.stranger, {
    sessionId: ids.groupSession,
    rating: 5,
  });
  assert.equal(strangerGroupAttempt.status, 404);

  const groupReviewA = await req('POST', '/api/reviews', users.groupStudentA, {
    sessionId: ids.groupSession,
    rating: 5,
    comment: 'حلقة جماعية مباركة',
    wouldContinue: true,
  });
  assert.equal(groupReviewA.status, 201);

  const groupReviewB = await req('POST', '/api/reviews', users.groupStudentB, {
    sessionId: ids.groupSession,
    rating: 5,
    comment: 'تنظيم رائع للأدوار',
    wouldContinue: true,
  });
  assert.equal(groupReviewB.status, 201);

  const groupFeedbackB = await req('PUT', `/api/sessions/${ids.groupSession}/feedback`, users.groupStudentB, {
    rating: 5,
    comment: 'تنظيم رائع للأدوار',
    wouldContinue: true,
  });
  assert.equal(groupFeedbackB.status, 200);
  assert.equal(sessionsStore.get(ids.groupSession).studentFeedbacks.length, 2);
  assert.equal(ratingUpdatesCount, 4);
});
