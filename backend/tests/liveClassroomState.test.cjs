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

const originalReadyState = mongoose.connection.readyState;
const oid = () => new mongoose.Types.ObjectId().toString();

const ids = {
  teacherUser: oid(),
  otherTeacherUser: oid(),
  teacher: oid(),
  otherTeacher: oid(),
  student1: oid(),
  student2: oid(),
  strangerStudent: oid(),
  guardian: oid(),
  session: oid(),
};

const users = {
  teacher: { _id: ids.teacherUser, id: ids.teacherUser, email: 't@example.test', role: 'teacher' },
  otherTeacher: { _id: ids.otherTeacherUser, id: ids.otherTeacherUser, email: 't2@example.test', role: 'teacher' },
  student1: { _id: ids.student1, id: ids.student1, email: 's1@example.test', role: 'student' },
  student2: { _id: ids.student2, id: ids.student2, email: 's2@example.test', role: 'student' },
  strangerStudent: { _id: ids.strangerStudent, id: ids.strangerStudent, email: 'stranger@example.test', role: 'student' },
  guardian: { _id: ids.guardian, id: ids.guardian, email: 'g@example.test', role: 'guardian' },
};

function q(value) {
  const query = {
    select() { return query; },
    lean() { return query; },
    catch() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return query;
}

test('Live classroom state sync, Hifz veil, anti-cheat games, and active-listener bell enforce RBAC', async (t) => {
  const origTeacherFindOne = Teacher.findOne;
  const origSessionFindById = Session.findById;
  const origGuardianFindOne = Guardian.findOne;
  const origLiveFindOne = LiveSession.findOne;
  const origLiveUpdateOne = LiveSession.updateOne;
  const origUserFindById = User.findById;
  const origUserFind = User.find;

  const liveDoc = {
    _id: oid(),
    roomId: 'qa-classroom-sync-1',
    session: ids.session,
    title: 'حلقة سورة الملك',
    subject: 'quran',
    isLive: true,
    classroomState: {},
  };

  const bookedSession = {
    _id: ids.session,
    teacher: ids.teacher,
    student: ids.student1,
    attendance: [{ student: ids.student2 }],
    status: 'accepted',
    scheduledAt: new Date().toISOString(),
    duration: 60,
  };

  Teacher.findOne = (filter = {}) => {
    if (String(filter.user) === ids.teacherUser) {
      return q({ _id: ids.teacher, user: ids.teacherUser, status: 'approved', isVerified: true });
    }
    if (String(filter.user) === ids.otherTeacherUser) {
      return q({ _id: ids.otherTeacher, user: ids.otherTeacherUser, status: 'approved', isVerified: true });
    }
    return q(null);
  };
  Session.findById = (id) => q(String(id) === ids.session ? bookedSession : null);
  Guardian.findOne = (filter = {}) => {
    if (String(filter.user) === ids.guardian) {
      return q({ user: ids.guardian, isActive: true, children: [{ student: ids.student1 }] });
    }
    return q(null);
  };
  LiveSession.findOne = (filter = {}) => q(filter.roomId === liveDoc.roomId ? liveDoc : null);
  LiveSession.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
  User.findById = (id) => {
    const found = Object.values(users).find((item) => String(item._id) === String(id));
    if (!found) return q(null);
    const names = {
      [ids.teacherUser]: 'الشيخ أحمد',
      [ids.otherTeacherUser]: 'الشيخ خالد',
      [ids.student1]: 'عمر',
      [ids.student2]: 'بلال',
      [ids.strangerStudent]: 'غريب',
      [ids.guardian]: 'ولي أمر عمر',
    };
    return q({ _id: found._id, name: names[String(id)] || found.role, role: found.role, isActive: true });
  };
  User.find = () => q([
    { _id: ids.student1, name: 'عمر' },
    { _id: ids.student2, name: 'بلال' },
  ]);

  delete require.cache[require.resolve('../routes/live')];
  const liveRouter = require('../routes/live');
  const { generateAccessToken } = require('../middleware/auth');
  mongoose.connection.readyState = 1;

  const app = express();
  app.use(express.json());
  app.use('/api/live', liveRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    Teacher.findOne = origTeacherFindOne;
    Session.findById = origSessionFindById;
    Guardian.findOne = origGuardianFindOne;
    LiveSession.findOne = origLiveFindOne;
    LiveSession.updateOne = origLiveUpdateOne;
    User.findById = origUserFindById;
    User.find = origUserFind;
    mongoose.connection.readyState = originalReadyState;
    delete require.cache[require.resolve('../routes/live')];
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

  // 1. Unassigned student & unassigned teacher are blocked (fail closed)
  const strangerRead = await req('GET', `/api/live/sessions/${liveDoc.roomId}/state`, users.strangerStudent);
  assert.equal(strangerRead.status, 403);

  const wrongTeacherPatch = await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.otherTeacher, {
    mushaf: { page: 562 },
  });
  assert.equal(wrongTeacherPatch.status, 403);

  // 2. Host teacher syncs Mushaf page, Golden word pointer, Hifz veil, and launches a live game round
  const hostPatch = await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher, {
    mushaf: {
      page: 562,
      surahNumber: 67,
      ayahKey: '67:2',
      wordIndex: 3,
      wordText: 'أَحْسَنُ',
      hifzVeilMode: 'full',
      peekWordKey: '67:2:3',
      peekDurationMs: 3500,
    },
    activeGame: {
      roundId: 'round_mulk_1',
      status: 'active',
      mode: 'missing_word',
      prompt: 'لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ _____',
      surahName: 'سورة الملك',
      ayahNumber: 2,
      options: ['عَمَلًا', 'قَوْلًا', 'صَبْرًا', 'ذِكْرًا'],
      correctAnswer: 'عَمَلًا',
      explanation: 'الآية الثانية من سورة الملك: أيكم أحسن عملاً',
      durationSec: 25,
    },
    reaction: {
      badgeKey: 'mashallah',
      label: 'ما شاء الله تبارك الله',
      emoji: '🌟',
      targetStudentId: ids.student1,
      starsDelta: 2,
    },
  });
  assert.equal(hostPatch.status, 200);
  assert.equal(hostPatch.data.classroomState.mushaf.page, 562);
  assert.equal(hostPatch.data.classroomState.mushaf.hifzVeilMode, 'full');
  assert.equal(hostPatch.data.classroomState.activeGame.correctAnswer, 'عَمَلًا');
  assert.ok(hostPatch.data.classroomState.engagement.visitedPages.includes(562));

  // 3. Student reads state -> gets synced Mushaf & game prompt, but correctAnswer is REDACTED while active!
  const studentState = await req('GET', `/api/live/sessions/${liveDoc.roomId}/state`, users.student1);
  assert.equal(studentState.status, 200);
  assert.equal(studentState.data.classroomState.mushaf.page, 562);
  assert.equal(studentState.data.classroomState.mushaf.wordText, 'أَحْسَنُ');
  assert.equal(studentState.data.classroomState.activeGame.status, 'active');
  assert.equal(studentState.data.classroomState.activeGame.correctAnswer, '');
  assert.equal(studentState.data.classroomState.activeGame.explanation, '');

  // 4. Guardian observer cannot submit game answers
  const guardianAttempt = await req('POST', `/api/live/sessions/${liveDoc.roomId}/game-answer`, users.guardian, {
    answer: 'عَمَلًا',
  });
  assert.equal(guardianAttempt.status, 403);

  // 5. Student 1 submits correct answer -> gets +3 stars (first correct!) & duplicate answer is blocked (409)
  const s1Answer = await req('POST', `/api/live/sessions/${liveDoc.roomId}/game-answer`, users.student1, {
    answer: 'عَمَلًا',
  });
  assert.equal(s1Answer.status, 201);
  assert.equal(s1Answer.data.submission.isCorrect, true);
  assert.equal(s1Answer.data.submission.starsAwarded, 3);

  const s1Dup = await req('POST', `/api/live/sessions/${liveDoc.roomId}/game-answer`, users.student1, {
    answer: 'عَمَلًا',
  });
  assert.equal(s1Dup.status, 409);

  // 6. Student 2 rings Active Listener Bell -> only Host sees all listener alerts; teacher rewards listener!
  const s2Bell = await req('POST', `/api/live/sessions/${liveDoc.roomId}/listener-bell`, users.student2, {
    page: 562,
    ayahKey: '67:2',
  });
  assert.equal(s2Bell.status, 201);

  const s1AfterBell = await req('GET', `/api/live/sessions/${liveDoc.roomId}/state`, users.student1);
  assert.equal(s1AfterBell.data.classroomState.engagement.activeListenerAlerts.length, 0);

  const teacherAfterBell = await req('GET', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher);
  assert.equal(teacherAfterBell.data.classroomState.engagement.activeListenerAlerts.length, 1);

  const rewardBell = await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher, {
    rewardListenerAlertId: s2Bell.data.alert.id,
    activeGame: { status: 'revealed' },
  });
  assert.equal(rewardBell.status, 200);
  assert.equal(rewardBell.data.classroomState.engagement.activeListenerAlerts.length, 0);
  assert.equal(rewardBell.data.classroomState.engagement.studentStars[ids.student2], 1);

  // 7. Once revealed, student now sees correctAnswer and explanation!
  const s2Revealed = await req('GET', `/api/live/sessions/${liveDoc.roomId}/state`, users.student2);
  assert.equal(s2Revealed.data.classroomState.activeGame.status, 'revealed');
  assert.equal(s2Revealed.data.classroomState.activeGame.correctAnswer, 'عَمَلًا');
  assert.ok(s2Revealed.data.classroomState.activeGame.explanation.includes('سورة الملك'));

  // 8. Whiteboard permissions: teacher_only blocks students; all_miniboards isolates boards & rewards +2 stars!
  const blockedDraw = await req('POST', `/api/live/sessions/${liveDoc.roomId}/whiteboard-action`, users.student1, {
    addStroke: { d: 'M100 100L200 200', colorKey: 'emerald', width: 4 },
  });
  assert.equal(blockedDraw.status, 403);

  const openMiniBoards = await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher, {
    whiteboard: {
      mode: 'miniboards',
      permission: 'all_miniboards',
      ayahText: 'فَسَيَكْفِيكَهُمُ اللَّهُ',
      stripTashkeel: true,
      teleport: true,
    },
  });
  assert.equal(openMiniBoards.status, 200);
  assert.equal(openMiniBoards.data.classroomState.whiteboard.permission, 'all_miniboards');

  const s1Board = await req('POST', `/api/live/sessions/${liveDoc.roomId}/whiteboard-action`, users.student1, {
    addStroke: { d: 'M120 140L240 160', colorKey: 'madd', width: 5 },
    addStamp: { glyph: 'َ', x: 400, y: 260, colorKey: 'madd' },
  });
  assert.equal(s1Board.status, 201);

  const s2Board = await req('POST', `/api/live/sessions/${liveDoc.roomId}/whiteboard-action`, users.student2, {
    addStroke: { d: 'M300 300L420 310', colorKey: 'ghunnah', width: 5 },
  });
  assert.equal(s2Board.status, 201);
  // Student 2 sees ONLY their own mini-board, NOT Student 1's board!
  assert.ok(s2Board.data.classroomState.whiteboard.studentBoards[ids.student2]);
  assert.equal(s2Board.data.classroomState.whiteboard.studentBoards[ids.student1], undefined);

  // Teacher sees BOTH students' mini-boards and awards Student 1 a star badge (+2 stars)
  const teacherBoards = await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher, {
    whiteboard: {
      reviewStudentBoard: { studentId: ids.student1, badge: 'star' },
    },
  });
  assert.equal(teacherBoards.status, 200);
  assert.ok(teacherBoards.data.classroomState.whiteboard.studentBoards[ids.student1]);
  assert.ok(teacherBoards.data.classroomState.whiteboard.studentBoards[ids.student2]);
  assert.equal(teacherBoards.data.classroomState.whiteboard.studentBoards[ids.student1].badge, 'star');

  // 9. Freeze Student Boards (423) + Student Mushaf Pointer permission gate (403 until allowed -> 201)
  await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher, {
    whiteboard: { boardsFrozen: true },
  });
  const frozenAttempt = await req('POST', `/api/live/sessions/${liveDoc.roomId}/whiteboard-action`, users.student1, {
    clearMine: true,
  });
  assert.equal(frozenAttempt.status, 423);

  const lockedPointer = await req('POST', `/api/live/sessions/${liveDoc.roomId}/student-pointer`, users.student1, {
    page: 562,
    ayahKey: '67:2',
    wordIndex: 1,
    wordText: 'خَلَقَ',
  });
  assert.equal(lockedPointer.status, 403);

  await req('PATCH', `/api/live/sessions/${liveDoc.roomId}/state`, users.teacher, {
    controls: {
      studentPointerAllowed: true,
      micPolicy: 'reciter_only',
      activeReciterUserId: ids.student1,
      cameraAllowed: false,
      chatMode: 'teacher_only',
      followTeacherTab: true,
    },
  });

  const allowedPointer = await req('POST', `/api/live/sessions/${liveDoc.roomId}/student-pointer`, users.student1, {
    page: 562,
    ayahKey: '67:2',
    wordIndex: 1,
    wordText: 'خَلَقَ',
  });
  assert.equal(allowedPointer.status, 201);
  assert.equal(allowedPointer.data.classroomState.mushaf.studentPointer.wordText, 'خَلَقَ');
});
