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

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';

function isLiveKitConfigured() {
  return Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

async function createToken({ roomName, identity, participantName, canPublish }) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: participantName,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: canPublish,
  });

  return at.toJwt();
}

async function sessionIncludesStudent(session, studentId) {
  if (!session || !studentId) return false;
  const id = String(studentId);

  if (session.student && String(session.student) === id) return true;
  if (session.attendance?.some((entry) => entry.student && String(entry.student) === id)) return true;

  if (session.circle) {
    return Boolean(await GroupCircle.exists({ _id: session.circle, students: studentId }));
  }

  return false;
}

async function getRoomAccess(liveSession, user) {
  if (!liveSession || !user) {
    return { allowed: false, isHost: false, isObserver: false, bookedSession: null };
  }

  if (user.role === 'admin') {
    const bookedSession = liveSession.session
      ? await Session.findById(liveSession.session).select('student teacher circle scheduledAt duration timezone status')
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
    const guardian = await Guardian.findOne({ user: user.id, isActive: true }).select('children.student');
    if (!guardian) {
      return { allowed: false, isHost: false, isObserver: true, bookedSession };
    }

    let assigned = false;
    for (const child of guardian.children || []) {
      if (await sessionIncludesStudent(bookedSession, child.student)) {
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
  if (bookedSession?.circle) {
    const circle = await GroupCircle.findById(bookedSession.circle).select('students title').lean().catch(() => null);
    if (Array.isArray(circle?.students)) {
      for (const sid of circle.students) {
        if (sid) studentIds.add(String(sid));
      }
    }
  }
  let roster = [];
  if (studentIds.size > 0) {
    const users = await User.find({ _id: { $in: Array.from(studentIds) } }).select('_id name').lean().catch(() => []);
    roster = users.map((u) => ({
      id: `student:${u._id}`,
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
  let liveSession = await LiveSession.findOne({ roomId });
  if (!liveSession && mongoose.Types.ObjectId.isValid(roomId)) {
    liveSession = await LiveSession.findOne({ session: roomId });
  }
  if (!liveSession) return { liveSession: null, access: null };

  const access = await getRoomAccess(liveSession, user);
  if (!access.allowed || !access.isHost) return { liveSession, access };

  return { liveSession, access };
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
    return res.status(201).json({ ...presentLiveSession(session), configured: isLiveKitConfigured() });
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

    let liveSession = await LiveSession.findOne({ roomId: roomName });
    if (!liveSession && mongoose.Types.ObjectId.isValid(roomName)) {
      liveSession = await LiveSession.findOne({ session: roomName });
    }

    if (!liveSession && mongoose.Types.ObjectId.isValid(roomName)) {
      const bookedSession = await Session.findById(roomName).select('_id student circle teacher scheduledAt duration status');
      if (bookedSession && bookedSession.status === 'accepted') {
        const accessWindow = sessionParticipantWindow(bookedSession);
        if (accessWindow.within) {
          const roomId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
          await syncBookedSessionLiveLink(bookedSession, liveSession.roomId);
        }
      }
    }

    if (!liveSession) return res.status(404).json({ message: 'Session not found' });

    const access = await getRoomAccess(liveSession, req.user);
    if (!access.allowed) {
      return res.status(403).json({ message: 'You are not assigned to this live session' });
    }

    const role = req.user.role;
    const canPublish = role === 'student' || role === 'teacher' || role === 'admin';
    // Never expose the account email to other participants; use the display name.
    const participantUser = await User.findById(req.user.id).select('name').lean().catch(() => null);
    const participantName = String(participantUser?.name || req.body?.participantName || role).trim().slice(0, 80) || role;
    const identity = `${role}:${req.user.id}`;

    const token = await createToken({ roomName: liveSession.roomId, identity, participantName, canPublish });
    const sessionContext = await buildSessionContext(liveSession, access.bookedSession);
    return res.json({
      token,
      roomId: liveSession.roomId,
      serverUrl: LIVEKIT_URL,
      sessionContext,
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

router.get('/sessions', verifyAccessToken, async (req, res) => {
  try {
    const allSessions = await LiveSession.find().sort({ createdAt: -1 }).limit(100);
    const visible = [];

    for (const liveSession of allSessions) {
      const access = await getRoomAccess(liveSession, req.user);
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

    const roomId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
    let liveSession = await LiveSession.findOne({ roomId: req.params.roomId });
    if (!liveSession && mongoose.Types.ObjectId.isValid(req.params.roomId)) {
      liveSession = await LiveSession.findOne({ session: req.params.roomId });
    }
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

    await liveSession.deleteOne();
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

module.exports = router;
