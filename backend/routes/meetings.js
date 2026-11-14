const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const GroupCircle = require('../models/GroupCircle');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');
const meetingService = require('../services/meetingService');
const { sessionParticipantWindow } = require('../services/sessionAccess');

async function sessionIncludesStudent(session, studentId) {
  if (!session || !studentId) return false;
  const id = String(studentId);

  const directStudent = session.student?._id || session.student;
  if (directStudent && String(directStudent) === id) return true;

  if (session.attendance?.some((entry) => {
    const attendee = entry.student?._id || entry.student;
    return attendee && String(attendee) === id;
  })) {
    return true;
  }

  if (session.circle) {
    const circleId = session.circle?._id || session.circle;
    return Boolean(await GroupCircle.exists({ _id: circleId, students: studentId }));
  }

  return false;
}


router.get('/session/:id', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('student', 'name')
      .populate('attendance.student', 'name')
      .populate('circle', 'students')
      .populate({ path: 'teacher', select: 'personalInfo.fullName user', populate: { path: 'user', select: 'name' } });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const isStudent = req.user.role === 'student'
      ? await sessionIncludesStudent(session, req.user.id)
      : false;
    let isTeacher = false;
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id });
      isTeacher = teacher && String(session.teacher?._id || session.teacher) === String(teacher._id);
    }
    let isGuardianObserver = false;
    if (req.user.role === 'guardian') {
      const guardian = await Guardian.findOne({ user: req.user.id, isActive: true })
        .select('children.student children.permissions')
        .lean();
      for (const child of guardian?.children || []) {
        const canObserve = child?.permissions?.viewAttendance !== false || child?.permissions?.viewProgress !== false;
        if (canObserve && child?.student && (await sessionIncludesStudent(session, child.student))) {
          isGuardianObserver = true;
          break;
        }
      }
    }

    if (!isStudent && !isTeacher && !isGuardianObserver && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'admin') {
      if (!['accepted', 'completed'].includes(session.status)) {
        return res.status(400).json({ error: 'Meeting available only for accepted sessions' });
      }
    } else {
      if (session.status !== 'accepted') {
        return res.status(400).json({ error: 'Meeting available only for accepted sessions' });
      }
      const accessWindow = sessionParticipantWindow(session);
      if (!accessWindow.within) {
        return res.status(403).json({
          error: 'Meeting access is available only near the scheduled session time',
          code: 'MEETING_OUTSIDE_JOIN_WINDOW',
          opensAt: accessWindow.opensAt,
          closesAt: accessWindow.closesAt,
        });
      }
    }

    let meeting;
    if (session.meetingLink) {
      meeting = { url: session.meetingLink, provider: session.meetingProvider || 'jitsi' };
    } else {
      meeting = meetingService.attachToSession(session);
      await session.save();
    }

    res.json({
      session: { _id: session._id, scheduledAt: session.scheduledAt, status: session.status },
      meeting,
      isObserver: isGuardianObserver,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/session/:id/regenerate', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { provider } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.status !== 'accepted') {
      return res.status(400).json({ error: 'Meeting links can only be regenerated for accepted sessions' });
    }

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id });
      if (!teacher || String(session.teacher) !== String(teacher._id)) {
        return res.status(403).json({ error: 'Not your session' });
      }
    }

    const meeting = meetingService.attachToSession(session, provider);
    await session.save();

    res.json({ success: true, meetingLink: session.meetingLink, meeting });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/providers', protect, (_req, res) => {
  res.json({
    providers: meetingService.PROVIDERS,
    default: process.env.DEFAULT_MEETING_PROVIDER || 'jitsi',
  });
});

module.exports = router;
