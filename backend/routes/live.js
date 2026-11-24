const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');
const LiveSession = require('../models/LiveSession');
const User = require('../models/User');
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');
const GroupCircle = require('../models/GroupCircle');
const { verifyAccessToken, requireRole } = require('../middleware/auth');
const { sessionParticipantWindow } = require('../services/sessionAccess');
const {
  applyHostStatePatch,
  recordStudentGameAnswer,
  recordActiveListenerBell,
  recordStudentWhiteboardAction,
  presentClassroomState,
} = require('../services/classroomStateService');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';

function isLiveKitConfigured() {
  return Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

async function createToken({ roomName, identity, participantName, canPublish, isObserver = false }) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: isObserver ? 'مراقب ولي الأمر' : participantName,
    ttl: '2h',
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: canPublish,
    ...(isObserver ? { hidden: true } : {}),
  });

  return at.toJwt();
}

async function sessionIncludesStudent(session, studentId) {
  if (!session || !studentId) return false;
  const id = String(studentId);

  if (session.student && String(session.student) === id) return true;
  if (session.attendance?.some((entry) => entry.student && String(entry.student) === id)) return true;

  // Group-circle lessons: `attendance` is the authoritative paid roster.
  // Circle membership alone (paused / zero-credit students) never grants a seat.
  return false;
}

async function getRoomAccess(liveSession, user) {
  if (!liveSession || !user) {
    return { allowed: false, isHost: false, isObserver: false, bookedSession: null };
  }

  if (user.role === 'admin') {
    const bookedSession = liveSession.session
      ? await Session.findById(liveSession.session).select('student teacher circle attendance scheduledAt duration timezone status')
      : null;
    return { allowed: true, isHost: true, isObserver: false, bookedSession };
  }

  if (!liveSession.session) {
    return { allowed: false, isHost: false, isObserver: false, bookedSession: null };
  }

  const bookedSession = await Session.findById(liveSession.session)
    .select('student teacher circle attendance scheduledAt duration timezone status');

  if (!bookedSession || bookedSession.status !== 'accepted') {
    return { allowed: false, isHost: false, isObserver: false, bookedSession };
  }

  if (user.role === 'teacher') {
    const teacher = await Teacher.findOne({ user: user.id }).select('_id');
    const allowed = Boolean(teacher && String(bookedSession.teacher) === String(teacher._id))
      && sessionParticipantWindow(bookedSession).within;
    return { allowed, isHost: allowed, isObserver: false, bookedSession };
  }

  if (user.role === 'student') {
    const assigned = await sessionIncludesStudent(bookedSession, user.id);
    const allowed = assigned && sessionParticipantWindow(bookedSession).within;
    return { allowed, isHost: false, isObserver: false, bookedSession };
  }

  if (user.role === 'guardian') {
    const guardian = await Guardian.findOne({ user: user.id, isActive: true }).select('children.student children.permissions');
    if (!guardian) {
      return { allowed: false, isHost: false, isObserver: true, bookedSession };
    }

    let assigned = false;
    for (const child of guardian.children || []) {
      const canObserve = child?.permissions?.viewAttendance !== false;
      if (canObserve && (await sessionIncludesStudent(bookedSession, child.student))) {
        assigned = true;
        break;
      }
    }

    const allowed = assigned && sessionParticipantWindow(bookedSession).within;
    return { allowed, isHost: false, isObserver: true, bookedSession };
  }

  // Supervisors need an explicit future assignment model; fail closed until then.
  return { allowed: false, isHost: false, isObserver: false, bookedSession };
}

function presentLiveSession(liveSession, access) {
  const value = typeof liveSession.toObject === 'function'
    ? liveSession.toObject()
    : { ...liveSession };

  return {
    ...value,
    scheduledAt: access?.bookedSession?.scheduledAt || value.scheduledAt,
    timezone: access?.bookedSession?.timezone || value.timezone || 'Africa/Cairo',
    canManage: Boolean(access?.isHost),
    isObserver: Boolean(access?.isObserver),
  };
}

async function buildSessionContext(liveSession, bookedSession) {
  if (!liveSession) return null;
  const studentIds = new Set();
  if (bookedSession?.student) {
    studentIds.add(String(bookedSession.student));
  }
  if (Array.isArray(bookedSession?.attendance)) {
    for (const entry of bookedSession.attendance) {
      if (entry?.student) studentIds.add(String(entry.student));
    }
  }
  let roster = [];
  if (studentIds.size > 0) {
    const users = await User.find({ _id: { $in: Array.from(studentIds) } }).select('_id name').lean().catch(() => []);
    roster = users.map((u) => ({
      id: `student:${u._id}`,
      userId: String(u._id),
      name: String(u.name || 'طالب').trim(),
      avatar: String(u.name || 'ط').trim().charAt(0) || 'ط',
    }));
  }
  return {
    sessionId: bookedSession?._id ? String(bookedSession._id) : null,
    title: liveSession.title || 'حلقة تعليمية',
    subject: liveSession.subject || 'quran',
    scheduledAt: bookedSession?.scheduledAt || liveSession.scheduledAt || null,
    duration: bookedSession?.duration || 60,
    roster,
  };
}

async function syncBookedSessionLiveLink(bookedSession, roomId) {
  if (!bookedSession?._id || !roomId) return;
  await Session.updateOne(
    { _id: bookedSession._id, status: 'accepted' },
    {
      $set: {
        meetingLink: `/live/${roomId}`,
        meetingProvider: 'livekit',
      },
    },
  );
}

async function canManageRoom(roomId, user) {
  const liveSession = await findLiveSessionByRoomOrSession(roomId);
  if (!liveSession) return { liveSession: null, access: null };

  const access = await getRoomAccess(liveSession, user);
  if (!access.allowed || !access.isHost) return { liveSession, access };

  return { liveSession, access };
}

// Booked sessions store their academy room link as `/live/session_<sessionId>`
// (meetingService) while API callers may also pass the raw 24-hex session id.
// Random provisioned rooms use `session_<32-hex>` and never collide with this.
function bookedSessionIdFromRoomName(roomName) {
  const value = String(roomName || '').trim();
  if (mongoose.Types.ObjectId.isValid(value) && /^[a-f0-9]{24}$/i.test(value)) return value;
  const match = value.match(/^session_([a-f0-9]{24})$/i);
  return match ? match[1] : null;
}

async function findLiveSessionByRoomOrSession(roomName) {
  const value = String(roomName || '').trim().slice(0, 128);
  if (!value) return null;
  let liveSession = await LiveSession.findOne({ roomId: value });
  if (liveSession) return liveSession;
  const bookedId = bookedSessionIdFromRoomName(value);
  if (bookedId) liveSession = await LiveSession.findOne({ session: bookedId });
  return liveSession || null;
}

router.get('/status', (_req, res) => {
  res.json({ configured: isLiveKitConfigured() });
});

router.post('/demo-room', verifyAccessToken, requireRole('admin'), async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Route not found' });
  }

  try {
    const roomId = `demo-${Date.now()}`;
    const session = await LiveSession.create({
      roomId,
      createdBy: req.user.id,
      title: 'غرفة تطوير — وَحْيٌ وَنَمَاء',
      description: 'Development-only LiveKit room',
      subject: 'quran',
      isLive: false,
      participants: 0,
    });
    return res.status(201).json({
      ...presentLiveSession(session, { isHost: true, isObserver: false }),
      configured: isLiveKitConfigured(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create demo room' });
  }
});

router.post('/token', verifyAccessToken, async (req, res) => {
  try {
    const { roomName } = req.body;
    if (!roomName) return res.status(400).json({ message: 'Room name is required' });

    if (!isLiveKitConfigured()) {
      return res.status(503).json({ message: 'LiveKit is not configured' });
    }

    let liveSession = await findLiveSessionByRoomOrSession(roomName);
    const bookedIdFromRoom = bookedSessionIdFromRoomName(roomName);

    if (!liveSession && bookedIdFromRoom) {
      const bookedSession = await Session.findById(bookedIdFromRoom).select('_id student circle teacher attendance scheduledAt duration timezone status type');
      if (bookedSession && bookedSession.status === 'accepted') {
        const preflightAccess = await getRoomAccess({ session: bookedSession._id }, req.user);
        if (!preflightAccess.allowed) {
          return res.status(403).json({ message: 'You are not assigned to this live session' });
        }
        const roomId = `session_${crypto.randomBytes(16).toString('hex')}`;
        try {
          liveSession = await LiveSession.create({
            roomId,
            session: bookedSession._id,
            createdBy: req.user.id,
            title: bookedSession.type === 'trial' ? 'حصة تجريبية' : 'حلقة تعليمية',
            description: 'غرفة الأكاديمية المباشرة الموحدة',
            subject: 'quran',
            isLive: false,
            participants: 0,
          });
        } catch (createError) {
          // Teacher and student may join at the same instant: the unique
          // `session` index lets exactly one room win; everyone reuses it.
          if (createError?.code !== 11000) throw createError;
          liveSession = await LiveSession.findOne({ session: bookedSession._id });
        }
        if (liveSession) await syncBookedSessionLiveLink(bookedSession, liveSession.roomId);
      }
    }

    if (!liveSession) return res.status(404).json({ message: 'Session not found' });

    const access = await getRoomAccess(liveSession, req.user);
    if (!access.allowed) {
      return res.status(403).json({ message: 'You are not assigned to this live session' });
    }

    const role = req.user.role;
    const canPublish = !access.isObserver && (role === 'student' || role === 'teacher' || role === 'admin');
    // Never expose the account email to other participants; use the display name.
    const participantUser = await User.findById(req.user.id).select('name').lean().catch(() => null);
    const participantName = String(participantUser?.name || req.body?.participantName || role).trim().slice(0, 80) || role;
    const identity = `${role}:${req.user.id}`;

    const token = await createToken({
      roomName: liveSession.roomId,
      identity,
      participantName,
      canPublish,
      isObserver: Boolean(access.isObserver),
    });
    const sessionContext = await buildSessionContext(liveSession, access.bookedSession);
    return res.json({
      token,
      roomId: liveSession.roomId,
      serverUrl: LIVEKIT_URL,
      sessionContext,
      classroomState: presentClassroomState(liveSession.classroomState, {
        isHost: access.isHost,
        viewerUserId: req.user.id,
      }),
      permissions: {
        role,
        isHost: access.isHost,
        isObserver: access.isObserver,
        canPublish,
      },
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ message: 'Failed to generate token' });
  }
});

function evaluateRoomAccessSync(liveSession, user, { sessionMap, circleStudentsMap, teacherId, guardianChildIds }) {
  if (!liveSession || !user) {
    return { allowed: false, isHost: false, isObserver: false, bookedSession: null };
  }

  const bookedSession = liveSession.session
    ? sessionMap.get(String(liveSession.session)) || null
    : null;

  if (user.role === 'admin') {
    return { allowed: true, isHost: true, isObserver: false, bookedSession };
  }

  if (!liveSession.session || !bookedSession || bookedSession.status !== 'accepted') {
    return { allowed: false, isHost: false, isObserver: false, bookedSession };
  }

  if (!sessionParticipantWindow(bookedSession).within) {
    return {
      allowed: false,
      isHost: false,
      isObserver: user.role === 'guardian',
      bookedSession,
    };
  }

  const includesStudent = (sid) => {
    if (!sid) return false;
    const idStr = String(sid);
    if (bookedSession.student && String(bookedSession.student) === idStr) return true;
    if (bookedSession.attendance?.some((entry) => entry.student && String(entry.student) === idStr)) return true;
    return false;
  };

  if (user.role === 'teacher') {
    const allowed = Boolean(teacherId && String(bookedSession.teacher) === String(teacherId));
    return { allowed, isHost: allowed, isObserver: false, bookedSession };
  }

  if (user.role === 'student') {
    const allowed = includesStudent(user.id);
    return { allowed, isHost: false, isObserver: false, bookedSession };
  }

  if (user.role === 'guardian') {
    const allowed = (guardianChildIds || []).some((childId) => includesStudent(childId));
    return { allowed, isHost: false, isObserver: true, bookedSession };
  }

  return { allowed: false, isHost: false, isObserver: false, bookedSession };
}

router.get('/sessions', verifyAccessToken, async (req, res) => {
  try {
    let liveFilter = {};
    const [teacherDoc, guardianDoc] = await Promise.all([
      req.user.role === 'teacher'
        ? Teacher.findOne({ user: req.user.id }).select('_id').lean()
        : Promise.resolve(null),
      req.user.role === 'guardian'
        ? Guardian.findOne({ user: req.user.id, isActive: true }).select('children.student children.permissions').lean()
        : Promise.resolve(null),
    ]);

    let preloadedSessions = null;
    if (req.user.role !== 'admin') {
      let candidateSessionFilter = null;
      if (req.user.role === 'teacher') {
        if (!teacherDoc?._id) return res.json([]);
        candidateSessionFilter = { teacher: teacherDoc._id, status: 'accepted' };
      } else if (req.user.role === 'student') {
        const circles = await GroupCircle.find({ students: req.user.id }).select('_id').lean();
        const circleIdsForStudent = circles.map((c) => c._id);
        candidateSessionFilter = {
          status: 'accepted',
          $or: [
            { student: req.user.id },
            { 'attendance.student': req.user.id },
            ...(circleIdsForStudent.length ? [{ circle: { $in: circleIdsForStudent } }] : []),
          ],
        };
      } else if (req.user.role === 'guardian') {
        const permittedChildIds = (guardianDoc?.children || [])
          .filter((c) => c?.student && c?.permissions?.viewAttendance !== false)
          .map((c) => c.student);
        if (!permittedChildIds.length) return res.json([]);
        const circles = await GroupCircle.find({ students: { $in: permittedChildIds } }).select('_id').lean();
        const circleIdsForChildren = circles.map((c) => c._id);
        candidateSessionFilter = {
          status: 'accepted',
          $or: [
            { student: { $in: permittedChildIds } },
            { 'attendance.student': { $in: permittedChildIds } },
            ...(circleIdsForChildren.length ? [{ circle: { $in: circleIdsForChildren } }] : []),
          ],
        };
      } else {
        return res.json([]);
      }

      preloadedSessions = await Session.find(candidateSessionFilter)
        .select('student teacher circle attendance scheduledAt duration timezone status')
        .lean();
      if (!preloadedSessions.length) return res.json([]);
      liveFilter = { session: { $in: preloadedSessions.map((s) => s._id) } };
    }

    const allSessions = await LiveSession.find(liveFilter).sort({ createdAt: -1 }).limit(100);
    if (allSessions.length === 0) {
      return res.json([]);
    }

    const bookedIds = Array.from(
      new Set(allSessions.map((ls) => (ls.session ? String(ls.session) : null)).filter(Boolean))
    );

    const bookedDocs = preloadedSessions
      ? preloadedSessions.filter((s) => bookedIds.includes(String(s._id)))
      : (bookedIds.length > 0
          ? await Session.find({ _id: { $in: bookedIds } })
              .select('student teacher circle attendance scheduledAt duration timezone status')
              .lean()
          : []);

    const sessionMap = new Map(bookedDocs.map((s) => [String(s._id), s]));
    const circleIds = Array.from(
      new Set(bookedDocs.map((s) => (s.circle ? String(s.circle) : null)).filter(Boolean))
    );

    const circleDocs = circleIds.length > 0
      ? await GroupCircle.find({ _id: { $in: circleIds } }).select('students').lean()
      : [];
    const circleStudentsMap = new Map(
      circleDocs.map((c) => [String(c._id), new Set((c.students || []).map((id) => String(id)))])
    );

    const teacherId = teacherDoc?._id ? String(teacherDoc._id) : null;
    const guardianChildIds = (guardianDoc?.children || [])
      .filter((c) => c?.student && c?.permissions?.viewAttendance !== false)
      .map((c) => String(c.student))
      .filter(Boolean);

    const visible = [];
    for (const liveSession of allSessions) {
      const access = evaluateRoomAccessSync(liveSession, req.user, {
        sessionMap,
        circleStudentsMap,
        teacherId,
        guardianChildIds,
      });
      if (access.allowed) {
        visible.push(presentLiveSession(liveSession, access));
      }
    }

    return res.json(visible);
  } catch (error) {
    console.error('Live session list error:', error.message);
    return res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

router.post('/sessions', verifyAccessToken, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { title, description, subject, sessionId } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    let bookedSession = null;

    if (req.user.role === 'teacher') {
      if (!sessionId) {
        return res.status(400).json({ message: 'A booked session is required for teacher live rooms' });
      }

      const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacher) return res.status(404).json({ message: 'Teacher profile not found' });

      bookedSession = await Session.findOne({
        _id: sessionId,
        teacher: teacher._id,
        status: 'accepted',
      }).select('_id student circle teacher scheduledAt duration status');

      if (!bookedSession) {
        return res.status(403).json({ message: 'This booked session is not assigned to you or is not accepted' });
      }
      const accessWindow = sessionParticipantWindow(bookedSession);
      if (!accessWindow.within) {
        return res.status(403).json({
          message: 'The academy room opens 30 minutes before the lesson and closes one hour after its duration',
          code: 'MEETING_OUTSIDE_JOIN_WINDOW',
          opensAt: accessWindow.opensAt,
          closesAt: accessWindow.closesAt,
        });
      }
    } else if (sessionId) {
      bookedSession = await Session.findById(sessionId).select('_id student circle teacher scheduledAt status');
      if (!bookedSession) return res.status(404).json({ message: 'Booked session not found' });
    }

    if (bookedSession) {
      const existing = await LiveSession.findOne({ session: bookedSession._id });
      if (existing) {
        await syncBookedSessionLiveLink(bookedSession, existing.roomId);
        const access = await getRoomAccess(existing, req.user);
        return res.status(200).json(presentLiveSession(existing, access));
      }
    }

    const roomId = `session_${crypto.randomBytes(16).toString('hex')}`;
    const liveSession = await LiveSession.create({
      roomId,
      session: bookedSession?._id,
      createdBy: req.user.id,
      title: String(title).slice(0, 160),
      description: String(description || '').slice(0, 1000),
      subject: String(subject || 'general').slice(0, 80),
      isLive: false,
      participants: 0,
    });

    if (bookedSession) {
      await syncBookedSessionLiveLink(bookedSession, liveSession.roomId);
    }

    const access = await getRoomAccess(liveSession, req.user);
    return res.status(201).json(presentLiveSession(liveSession, access));
  } catch (error) {
    console.error('Create live session error:', error.message);
    return res.status(500).json({ message: 'Failed to create session' });
  }
});

router.get('/sessions/:roomId', verifyAccessToken, async (req, res) => {
  try {
    const liveSession = await findLiveSessionByRoomOrSession(req.params.roomId);
    if (!liveSession) return res.status(404).json({ message: 'Session not found' });

    const access = await getRoomAccess(liveSession, req.user);
    if (!access.allowed) {
      return res.status(403).json({ message: 'You are not assigned to this live session' });
    }

    const sessionContext = await buildSessionContext(liveSession, access.bookedSession);
    return res.json({ ...presentLiveSession(liveSession, access), sessionContext });
  } catch {
    return res.status(500).json({ message: 'Failed to get session' });
  }
});

router.delete('/sessions/:roomId', verifyAccessToken, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { liveSession, access } = await canManageRoom(req.params.roomId, req.user);
    if (!liveSession) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed || !access?.isHost) return res.status(403).json({ message: 'Not authorized' });

    const linkedSessionId = liveSession.session;
    const deletedRoomPath = `/live/${liveSession.roomId}`;
    await liveSession.deleteOne();
    if (linkedSessionId) {
      await Session.updateOne(
        { _id: linkedSessionId, meetingLink: deletedRoomPath },
        { $unset: { meetingLink: 1 } }
      ).catch(() => {});
    }
    return res.json({ message: 'Session deleted successfully' });
  } catch {
    return res.status(500).json({ message: 'Failed to delete session' });
  }
});

router.patch('/sessions/:roomId/live', verifyAccessToken, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { liveSession, access } = await canManageRoom(req.params.roomId, req.user);
    if (!liveSession) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed || !access?.isHost) return res.status(403).json({ message: 'Not authorized' });

    liveSession.isLive = Boolean(req.body.isLive);
    await liveSession.save();

    const sessionContext = await buildSessionContext(liveSession, access.bookedSession);
    return res.json({ ...presentLiveSession(liveSession, access), sessionContext });
  } catch {
    return res.status(500).json({ message: 'Failed to update session' });
  }
});

async function resolveAuthorizedRoomForState(roomName, user) {
  let liveSession = await findLiveSessionByRoomOrSession(roomName);
  const bookedIdFromRoom = bookedSessionIdFromRoomName(roomName);

  if (!liveSession && bookedIdFromRoom) {
    const bookedSession = await Session.findById(bookedIdFromRoom)
      .select('_id student circle teacher attendance scheduledAt duration timezone status type');
    if (bookedSession && bookedSession.status === 'accepted') {
      const preflightAccess = await getRoomAccess({ session: bookedSession._id }, user);
      if (!preflightAccess.allowed) {
        return { liveSession: null, access: preflightAccess, notFound: false };
      }
      const roomId = `session_${crypto.randomBytes(16).toString('hex')}`;
      try {
        liveSession = await LiveSession.create({
          roomId,
          session: bookedSession._id,
          createdBy: user.id,
          title: bookedSession.type === 'trial' ? 'حصة تجريبية' : 'حلقة تعليمية',
          description: 'غرفة الأكاديمية المباشرة الموحدة',
          subject: 'quran',
          isLive: false,
          participants: 0,
          classroomState: {},
        });
      } catch (createError) {
        if (createError?.code !== 11000) throw createError;
        liveSession = await LiveSession.findOne({ session: bookedSession._id });
      }
      if (liveSession) await syncBookedSessionLiveLink(bookedSession, liveSession.roomId);
    }
  }

  if (!liveSession) {
    return { liveSession: null, access: null, notFound: true };
  }

  const access = await getRoomAccess(liveSession, user);
  return { liveSession, access, notFound: false };
}

async function persistClassroomState(liveSession, nextState) {
  liveSession.classroomState = nextState;
  if (typeof liveSession.markModified === 'function') {
    liveSession.markModified('classroomState');
  }
  if (typeof liveSession.save === 'function') {
    await liveSession.save();
  } else if (liveSession._id && typeof LiveSession.updateOne === 'function') {
    await LiveSession.updateOne(
      { _id: liveSession._id },
      { $set: { classroomState: nextState } }
    ).catch(() => {});
  }
}

router.get('/sessions/:roomId/state', verifyAccessToken, async (req, res) => {
  try {
    const { liveSession, access, notFound } = await resolveAuthorizedRoomForState(req.params.roomId, req.user);
    if (notFound) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed) {
      return res.status(403).json({ message: 'You are not assigned to this live session' });
    }

    const sessionContext = await buildSessionContext(liveSession, access.bookedSession);
    return res.json({
      roomId: liveSession.roomId,
      canManage: Boolean(access.isHost),
      isObserver: Boolean(access.isObserver),
      permissions: {
        role: req.user.role,
        isHost: Boolean(access.isHost),
        isObserver: Boolean(access.isObserver),
        canPublish: !access.isObserver && ['student', 'teacher', 'admin'].includes(req.user.role),
      },
      sessionContext,
      classroomState: presentClassroomState(liveSession.classroomState, {
        isHost: Boolean(access.isHost),
        viewerUserId: req.user.id,
      }),
    });
  } catch {
    return res.status(500).json({ message: 'Failed to load classroom state' });
  }
});

router.patch('/sessions/:roomId/state', verifyAccessToken, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { liveSession, access, notFound } = await resolveAuthorizedRoomForState(req.params.roomId, req.user);
    if (notFound) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed || !access?.isHost) {
      return res.status(403).json({ message: 'Not authorized to manage classroom state' });
    }

    const nextState = applyHostStatePatch(liveSession.classroomState, req.body || {});
    await persistClassroomState(liveSession, nextState);

    return res.json({
      roomId: liveSession.roomId,
      classroomState: presentClassroomState(nextState, {
        isHost: true,
        viewerUserId: req.user.id,
      }),
    });
  } catch {
    return res.status(500).json({ message: 'Failed to update classroom state' });
  }
});

router.post('/sessions/:roomId/game-answer', verifyAccessToken, requireRole('student'), async (req, res) => {
  try {
    const { liveSession, access, notFound } = await resolveAuthorizedRoomForState(req.params.roomId, req.user);
    if (notFound) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed || access?.isObserver) {
      return res.status(403).json({ message: 'You are not assigned as an active learner in this session' });
    }

    const participantUser = await User.findById(req.user.id).select('name').lean().catch(() => null);
    const studentName = String(participantUser?.name || req.user.name || 'طالب').trim().slice(0, 80);

    const outcome = recordStudentGameAnswer(liveSession.classroomState, {
      studentId: req.user.id,
      studentName,
      answer: req.body?.answer,
    });

    if (!outcome.ok) {
      return res.status(outcome.status || 400).json({ message: outcome.message });
    }

    await persistClassroomState(liveSession, outcome.state);

    return res.status(201).json({
      submission: outcome.submission,
      classroomState: presentClassroomState(outcome.state, {
        isHost: false,
        viewerUserId: req.user.id,
      }),
    });
  } catch {
    return res.status(500).json({ message: 'Failed to submit game answer' });
  }
});

router.post('/sessions/:roomId/listener-bell', verifyAccessToken, requireRole('student'), async (req, res) => {
  try {
    const { liveSession, access, notFound } = await resolveAuthorizedRoomForState(req.params.roomId, req.user);
    if (notFound) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed || access?.isObserver) {
      return res.status(403).json({ message: 'You are not assigned as an active learner in this session' });
    }

    const participantUser = await User.findById(req.user.id).select('name').lean().catch(() => null);
    const studentName = String(participantUser?.name || req.user.name || 'طالب').trim().slice(0, 80);

    const outcome = recordActiveListenerBell(liveSession.classroomState, {
      studentId: req.user.id,
      studentName,
      page: req.body?.page,
      ayahKey: req.body?.ayahKey,
    });

    if (!outcome.ok) {
      return res.status(outcome.status || 400).json({ message: outcome.message });
    }

    await persistClassroomState(liveSession, outcome.state);

    return res.status(201).json({
      alert: outcome.alert,
      classroomState: presentClassroomState(outcome.state, {
        isHost: false,
        viewerUserId: req.user.id,
      }),
    });
  } catch {
    return res.status(500).json({ message: 'Failed to send active listener alert' });
  }
});

router.post('/sessions/:roomId/whiteboard-action', verifyAccessToken, requireRole('student'), async (req, res) => {
  try {
    const { liveSession, access, notFound } = await resolveAuthorizedRoomForState(req.params.roomId, req.user);
    if (notFound) return res.status(404).json({ message: 'Session not found' });
    if (!access?.allowed || access?.isObserver) {
      return res.status(403).json({ message: 'You are not assigned as an active learner in this session' });
    }

    const participantUser = await User.findById(req.user.id).select('name').lean().catch(() => null);
    const studentName = String(participantUser?.name || req.user.name || 'طالب').trim().slice(0, 80);

    const outcome = recordStudentWhiteboardAction(liveSession.classroomState, {
      studentId: req.user.id,
      studentName,
      actionPayload: req.body || {},
    });

    if (!outcome.ok) {
      return res.status(outcome.status || 400).json({ message: outcome.message });
    }

    await persistClassroomState(liveSession, outcome.state);

    return res.status(201).json({
      classroomState: presentClassroomState(outcome.state, {
        isHost: false,
        viewerUserId: req.user.id,
      }),
    });
  } catch {
    return res.status(500).json({ message: 'Failed to update whiteboard' });
  }
});

module.exports = router;
