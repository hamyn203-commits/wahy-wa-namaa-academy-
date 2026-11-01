const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const StudentSubscription = require('../models/StudentSubscription');
const GroupCircle = require('../models/GroupCircle');
const { protect, authorize } = require('../middleware/auth');
const meetingService = require('../services/meetingService');
const { meetingVisibleToRole, sessionParticipantWindow } = require('../services/sessionAccess');
const { calculateSessionEarning, ensureSessionEarning } = require('../services/teacherFinance');
const { settleSubscriptionUsageForSession } = require('../services/subscriptionUsage');
const { getPlan } = require('../config/subscriptionPlans');
const {
  parseRequestedDateTime,
  teacherAvailabilityDecision,
  overlaps,
  generateTeacherSlotStarts,
  safeTimeZone,
} = require('../services/sessionScheduling');
const {
  notifyTeacherForSessionRequest,
  notifySessionAccepted,
  notifyGuardiansForStudent,
  notifyUser,
} = require('../utils/notify');

const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

const MAX_TRIAL_SESSIONS_PER_STUDENT = 3;
const TRIAL_CONSUMING_STATUSES = ['pending', 'accepted', 'completed'];

async function validateBookingSlot({ teacher, scheduledAt, timezone, duration = 60 }) {
  const resolved = parseRequestedDateTime(scheduledAt, timezone);
  if (!resolved) {
    return {
      ok: false,
      status: 400,
      error: 'موعد الحصة غير صحيح',
      code: 'INVALID_SESSION_TIME',
    };
  }

  if (resolved.getTime() <= Date.now()) {
    return {
      ok: false,
      status: 400,
      error: 'اختر موعدًا مستقبليًا للحصة',
      code: 'SESSION_TIME_IN_PAST',
    };
  }

  const availability = teacherAvailabilityDecision(teacher, resolved, duration);
  if (!availability.allowed) {
    return {
      ok: false,
      status: 409,
      error: 'هذا الموعد خارج أوقات توفر المعلم',
      code: availability.code || 'TEACHER_UNAVAILABLE',
      teacherTimezone: availability.timeZone,
    };
  }

  const activeSessions = await Session.find({
    teacher: teacher._id,
    status: { $in: ['pending', 'accepted'] },
  }).select('scheduledAt duration');

  const conflict = (activeSessions || []).find((session) => (
    overlaps(
      resolved,
      duration,
      session.scheduledAt,
      session.duration || 60,
    )
  ));

  if (conflict) {
    return {
      ok: false,
      status: 409,
      error: 'هذا الموعد يتعارض مع حصة أخرى لدى المعلم',
      code: 'TEACHER_SLOT_CONFLICT',
    };
  }

  return {
    ok: true,
    scheduledAt: resolved,
    timezone: timezone || availability.timeZone || safeTimeZone(teacher.availabilityTimezone),
  };
}

router.get('/available-slots/:teacherId', async (req, res) => {
  try {
    const teacher = await Teacher.findOne({
      _id: req.params.teacherId,
      status: 'approved',
      isVerified: true,
    }).select('availability availabilityTimezone');

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found or not available' });
    }

    const days = Math.min(21, Math.max(1, Number(req.query.days || 14)));
    const duration = 60;
    const generated = generateTeacherSlotStarts(teacher, {
      days,
      intervalMinutes: 30,
      durationMinutes: duration,
    });

    if (!generated.length) {
      return res.json({
        configured: Array.isArray(teacher.availability) && teacher.availability.length > 0,
        teacherTimezone: safeTimeZone(teacher.availabilityTimezone),
        slots: [],
      });
    }

    const activeSessions = await Session.find({
      teacher: teacher._id,
      status: { $in: ['pending', 'accepted'] },
    }).select('scheduledAt duration');

    const slots = generated
      .filter((slot) => !(activeSessions || []).some((session) => (
        overlaps(slot.startsAt, slot.duration, session.scheduledAt, session.duration || 60)
      )))
      .map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        duration: slot.duration,
        teacherLocalDate: slot.teacherLocalDate,
        teacherLocalTime: slot.teacherLocalTime,
      }));

    return res.json({
      configured: true,
      teacherTimezone: safeTimeZone(teacher.availabilityTimezone),
      slots,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

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


router.post('/trial', protect, authorize('student'), async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('name phone onboarding preferredTrack');
    if (!student?.name?.trim() || !student?.phone?.trim()
        || (student.onboarding?.required && !student.onboarding.completed)) {
      return res.status(403).json({ code: 'PROFILE_INCOMPLETE', error: 'Complete your student profile before booking' });
    }
    if (student.onboarding?.trackSelected !== true) {
      return res.status(403).json({ code: 'TRACK_REQUIRED', error: 'Select your learning track before booking' });
    }

    const { teacherId, scheduledAt, timezone, notes } = req.body;

    const teacher = await Teacher.findOne({ 
      _id: teacherId, 
      status: 'approved', 
      isVerified: true 
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found or not available' });
    }

    const trialUsed = await Session.countDocuments({
      student: req.user.id,
      type: 'trial',
      status: { $in: TRIAL_CONSUMING_STATUSES },
    });
    const trialRemaining = Math.max(0, MAX_TRIAL_SESSIONS_PER_STUDENT - trialUsed);

    if (trialUsed >= MAX_TRIAL_SESSIONS_PER_STUDENT) {
      return res.status(409).json({
        error: 'لقد استخدمت الحد الأقصى من الحصص التجريبية. اشترك للاستمرار في رحلتك.',
        code: 'TRIAL_LIMIT_REACHED',
        trialAllowance: {
          limit: MAX_TRIAL_SESSIONS_PER_STUDENT,
          used: trialUsed,
          remaining: 0,
        },
        nextActions: ['subscribe', 'continue-with-teacher'],
      });
    }

    const completedTrial = await Session.findOne({
      student: req.user.id,
      teacher: teacherId,
      type: 'trial',
      status: 'completed',
    });

    if (completedTrial) {
      return res.status(409).json({
        error: 'Trial already completed with this teacher',
        code: 'TRIAL_ALREADY_COMPLETED_WITH_TEACHER',
        existingSession: {
          _id: completedTrial._id,
          teacher: completedTrial.teacher,
          status: completedTrial.status,
          scheduledAt: completedTrial.scheduledAt,
          type: completedTrial.type,
        },
        nextActions: ['continue-with-teacher', 'try-another-teacher'],
      });
    }

    const existingTrial = await Session.findOne({
      student: req.user.id,
      teacher: teacherId,
      type: 'trial',
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingTrial) {
      return res.status(409).json({
        error: 'You already have an active trial session with this teacher',
        code: 'TRIAL_ALREADY_EXISTS',
        existingSession: {
          _id: existingTrial._id,
          teacher: existingTrial.teacher,
          status: existingTrial.status,
          scheduledAt: existingTrial.scheduledAt,
          timezone: existingTrial.timezone,
          type: existingTrial.type,
        },
      });
    }

    const booking = await validateBookingSlot({
      teacher,
      scheduledAt,
      timezone,
      duration: 60,
    });
    if (!booking.ok) {
      return res.status(booking.status).json({
        error: booking.error,
        code: booking.code,
        teacherTimezone: booking.teacherTimezone,
      });
    }

    const session = await Session.create({
      student: req.user.id,
      teacher: teacherId,
      type: 'trial',
      scheduledAt: booking.scheduledAt,
      timezone: booking.timezone || timezone || 'Africa/Cairo',
      notes,
      status: 'pending'
    });

    try {
      await notifyTeacherForSessionRequest(session, teacher.user);
    } catch (e) {
      console.warn('Session request notification:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Trial session request sent successfully',
      session,
      trialAllowance: {
        limit: MAX_TRIAL_SESSIONS_PER_STUDENT,
        used: trialUsed + 1,
        remaining: Math.max(0, trialRemaining - 1),
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


router.post('/group-circle', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { circleId, scheduledAt, timezone, duration, notes } = req.body;
    const circle = await GroupCircle.findById(circleId);

    if (!circle) {
      return res.status(404).json({ error: 'الحلقة غير موجودة', code: 'CIRCLE_NOT_FOUND' });
    }
    if (!['active', 'full'].includes(circle.status)) {
      return res.status(409).json({
        error: 'لا يمكن جدولة حصة قبل تحديد المواعيد وبدء الحلقة من الإدارة',
        code: 'CIRCLE_NOT_ACTIVE',
        status: circle.status,
      });
    }

    const teacher = await Teacher.findOne({
      _id: circle.teacher,
      status: 'approved',
      isVerified: true,
    });

    if (!teacher) {
      return res.status(409).json({ error: 'معلم الحلقة غير متاح', code: 'CIRCLE_TEACHER_UNAVAILABLE' });
    }

    if (req.user.role === 'teacher' && String(teacher.user) !== String(req.user.id)) {
      return res.status(403).json({ error: 'غير مصرح بجدولة حصة لهذه الحلقة' });
    }

    const plan = getPlan(circle.subscriptionPlanKey);
    if (!plan) {
      return res.status(400).json({ error: 'خطة الحلقة غير صحيحة', code: 'CIRCLE_PLAN_INVALID' });
    }

    const requestedDuration = Number(duration || plan.durationMinMinutes || plan.durationMaxMinutes || 60);
    const minDuration = Number(plan.durationMinMinutes || 1);
    const maxDuration = Number(plan.durationMaxMinutes || 60);

    if (
      !Number.isFinite(requestedDuration)
      || requestedDuration < minDuration
      || requestedDuration > maxDuration
    ) {
      return res.status(400).json({
        error: `مدة الحصة لهذه الخطة يجب أن تكون بين ${minDuration} و${maxDuration} دقيقة`,
        code: 'GROUP_SESSION_DURATION_INVALID',
        minDuration,
        maxDuration,
      });
    }

    const booking = await validateBookingSlot({
      teacher,
      scheduledAt,
      timezone,
      duration: requestedDuration,
    });

    if (!booking.ok) {
      return res.status(booking.status).json({
        error: booking.error,
        code: booking.code,
        teacherTimezone: booking.teacherTimezone,
      });
    }

    const duplicate = await Session.findOne({
      circle: circle._id,
      scheduledAt: booking.scheduledAt,
      status: { $in: ['pending', 'accepted'] },
    }).select('_id');

    if (duplicate) {
      return res.status(409).json({
        error: 'يوجد بالفعل حصة لهذه الحلقة في نفس الموعد',
        code: 'GROUP_SESSION_ALREADY_EXISTS',
        sessionId: String(duplicate._id),
      });
    }

    const activeSubscriptions = await StudentSubscription.find({ circle: circle._id, student: { $in: circle.students }, status: 'active', sessionsRemaining: { $gt: 0 } }).select('student').lean();
    const rosterIds = [...new Set(activeSubscriptions.map(item => String(item.student)))];
    if (!rosterIds.length) return res.status(409).json({ error: 'لا يوجد طلاب برصيد نشط لجدولة هذه الحصة', code: 'CIRCLE_NO_ACTIVE_STUDENTS' });
    const attendance = rosterIds.map((studentId) => ({
      student: studentId,
      status: 'pending',
      eligibleForCompensation: false,
    }));

    const session = await Session.create({
      circle: circle._id,
      teacher: teacher._id,
      type: 'group_circle',
      status: 'accepted',
      scheduledAt: booking.scheduledAt,
      timezone: booking.timezone || timezone || circle.timezone || 'Africa/Cairo',
      duration: requestedDuration,
      notes: String(notes || '').trim().slice(0, 1500),
      attendance,
    });

    meetingService.attachToSession(session, req.body.provider || process.env.DEFAULT_MEETING_PROVIDER || 'jitsi');
    await session.save();

    const notifications = rosterIds.flatMap((studentId) => ([
      notifySessionAccepted(session, studentId, session.meetingLink),
      notifyGuardiansForStudent(studentId, {
        type: 'session-accepted',
        title: { ar: 'تم جدولة حصة الحلقة', en: 'Circle session scheduled' },
        message: {
          ar: 'تم جدولة حصة جديدة في الحلقة. راجع لوحة المتابعة لمعرفة الموعد.',
          en: 'A new circle session has been scheduled. Check the dashboard for details.',
        },
        data: { session: session._id, actionUrl: '/guardian/dashboard' },
        priority: 'high',
      }),
    ]));
    await Promise.allSettled(notifications);

    if (req.user.role === 'admin') {
      notifyUser(teacher.user, {
        type: 'system',
        title: { ar: 'تم جدولة حصة جديدة لحلقتك', en: 'A new circle session was scheduled' },
        message: {
          ar: `تمت جدولة حصة جديدة لـ ${circle.name} بواسطة الإدارة.`,
          en: `Administration scheduled a new session for ${circle.name}.`,
        },
        data: {
          actionUrl: '/teacher/dashboard?tab=sessions',
          metadata: { circleId: String(circle._id), sessionId: String(session._id) },
        },
      }).catch(() => {});
    }

    return res.status(201).json({ success: true, session });
  } catch (error) {
    return res.status(400).json({
      error: error.message || 'فشل جدولة حصة الحلقة',
      code: error.code || 'GROUP_SESSION_CREATE_FAILED',
    });
  }
});

router.post('/regular', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { teacherId, scheduledAt, timezone, notes } = req.body;
    const teacher = await Teacher.findOne({ _id: teacherId, status: 'approved', isVerified: true });
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found or not available' });
    }

    const prior = await Session.findOne({
      student: req.user.id,
      teacher: teacherId,
      status: 'completed',
    });
    if (!prior) {
      return res.status(400).json({ error: 'يجب إجراء حصة تجريبية أو حصة سابقة مع هذا المعلم أولاً' });
    }

    const existing = await Session.findOne({
      student: req.user.id,
      teacher: teacherId,
      type: 'regular',
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      return res.status(400).json({ error: 'لديك حصة منتظمة قيد الانتظار أو مقبولة مع هذا المعلم' });
    }

    const booking = await validateBookingSlot({
      teacher,
      scheduledAt,
      timezone,
      duration: 60,
    });
    if (!booking.ok) {
      return res.status(booking.status).json({
        error: booking.error,
        code: booking.code,
        teacherTimezone: booking.teacherTimezone,
      });
    }

    const session = await Session.create({
      student: req.user.id,
      teacher: teacherId,
      type: 'regular',
      scheduledAt: booking.scheduledAt,
      timezone: booking.timezone || timezone || 'Africa/Cairo',
      notes,
      status: 'pending',
    });

    try {
      await notifyTeacherForSessionRequest(session, teacher.user);
    } catch (e) {
      console.warn('Regular session notification:', e.message);
    }

    res.status(201).json({ success: true, message: 'تم إرسال طلب الحصة', session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/my-sessions', protect, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;

    if (isMockMode && !isDBConnected()) {
      return res.json({
        sessions: [],
        pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 },
      });
    }

    const filter = {};

    if (req.user.role === 'student') {
      const student = await User.findById(req.user.id).select('circle').lean();
      filter.$or = [
        { student: req.user.id },
        { 'attendance.student': req.user.id },
        ...(student?.circle ? [{ circle: student.circle }] : []),
      ];
    } else if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id });
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher profile not found' });
      }
      filter.teacher = teacher._id;
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }


    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .populate('student', 'name email avatar')
        .populate({
          path: 'teacher',
          populate: { path: 'user', select: 'name email avatar' }
        })
        .populate('attendance.student', 'name email avatar')
        .populate('circle', 'name code status schedule timezone subscriptionPlanKey')
        .populate('attendance.student', 'name email avatar')
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Session.countDocuments(filter)
    ]);

    const presentedSessions = sessions.map((session) => {
      const value = typeof session.toObject === 'function' ? session.toObject() : { ...session };
      const meetingVisible = meetingVisibleToRole(value, req.user.role);
      const windowState = sessionParticipantWindow(value);
      const started = Boolean(value.scheduledAt) && new Date(value.scheduledAt).getTime() <= Date.now();
      const phase = !windowState.valid
        ? 'invalid'
        : Date.now() < windowState.opensAt.getTime()
          ? 'early'
          : Date.now() > windowState.closesAt.getTime()
            ? 'expired'
            : 'open';

      return {
        ...value,
        meetingAvailable: Boolean(value.meetingLink) && meetingVisible,
        meetingLink: meetingVisible ? value.meetingLink : undefined,
        lifecycle: {
          serverNow: new Date().toISOString(),
          started,
          canComplete: req.user.role === 'teacher' && value.status === 'accepted' && started,
          joinPhase: phase,
          joinOpen: value.status === 'accepted' && windowState.within,
          opensAt: windowState.opensAt,
          closesAt: windowState.closesAt,
        },
      };
    });

    res.json({
      sessions: presentedSessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/attendance', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    if (!records.length) {
      return res.status(400).json({ error: 'أرسل حالة حضور طالب واحد على الأقل', code: 'ATTENDANCE_RECORDS_REQUIRED' });
    }

    const session = await Session.findById(req.params.id);
    if (!session || session.type !== 'group_circle') {
      return res.status(404).json({ error: 'الحصة الجماعية غير موجودة', code: 'GROUP_SESSION_NOT_FOUND' });
    }
    if (session.status !== 'accepted') {
      return res.status(409).json({ error: 'لا يمكن تعديل الحضور بعد إغلاق الحصة', code: 'ATTENDANCE_SESSION_CLOSED' });
    }
    if (new Date(session.scheduledAt).getTime() > Date.now()) {
      return res.status(409).json({
        error: 'تسجيل الحضور يفتح عند بداية موعد الحصة',
        code: 'ATTENDANCE_NOT_OPEN',
      });
    }

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacher || String(teacher._id) !== String(session.teacher)) {
        return res.status(403).json({ error: 'غير مصرح بتعديل حضور هذه الحلقة' });
      }
    }

    const rosterIds = new Set(
      (session.attendance || [])
        .filter((entry) => entry.student)
        .map((entry) => String(entry.student?._id || entry.student))
    );

    for (const record of records) {
      const studentId = String(record?.studentId || '');
      const status = String(record?.status || '');
      if (!rosterIds.has(studentId)) {
        return res.status(400).json({ error: 'الطالب غير موجود في كشف هذه الحصة', code: 'ATTENDANCE_STUDENT_NOT_IN_ROSTER' });
      }
      if (!['attended', 'absent'].includes(status)) {
        return res.status(400).json({ error: 'حالة الحضور يجب أن تكون حضر أو غاب', code: 'ATTENDANCE_STATUS_INVALID' });
      }

      const entry = session.attendance.find(
        (item) => item.student && String(item.student?._id || item.student) === studentId
      );
      if (!entry) continue;

      if (status === 'absent' && entry.status === 'excused' && entry.eligibleForCompensation) {
        continue;
      }

      entry.status = status;
      if (status === 'attended') {
        entry.eligibleForCompensation = false;
        entry.excuseReason = undefined;
        entry.excusedAt = undefined;
      }
    }

    await session.save();
    await session.populate('attendance.student', 'name email avatar');

    return res.json({
      success: true,
      attendance: session.attendance,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل تحديث الحضور' });
  }
});

router.put('/:id/respond', protect, authorize('teacher'), async (req, res) => {
  try {
    const { action, rescheduledDate, rescheduleTimezone, reason } = req.body;

    if (!['accept', 'reject', 'reschedule'].includes(action)) {
      return res.status(400).json({ error: 'Invalid session response action' });
    }

    const teacher = await Teacher.findOne({ user: req.user.id });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const session = await Session.findOne({
      _id: req.params.id,
      teacher: teacher._id
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only pending requests can be accepted, rejected, or rescheduled.
    // Replaying an accepted action must not send the student another notification.
    if (session.status !== 'pending') {
      if (action === 'accept' && session.status === 'accepted') {
        return res.json({ success: true, session, alreadyAccepted: true });
      }
      return res.status(409).json({
        error: 'لا يمكن تعديل قرار الحصة بعد تغيّر حالتها',
        code: 'SESSION_ALREADY_DECIDED',
        status: session.status,
      });
    }

    if (action === 'accept') {
      session.status = 'accepted';
      const provider = req.body.provider || process.env.DEFAULT_MEETING_PROVIDER || 'jitsi';
      meetingService.attachToSession(session, provider);
    } else if (action === 'reject') {
      session.status = 'rejected';
      session.cancellationReason = reason;
    } else if (action === 'reschedule') {
      const timezone = safeTimeZone(
        rescheduleTimezone
        || session.timezone
        || teacher.availabilityTimezone
        || 'Africa/Cairo'
      );
      const proposedDate = parseRequestedDateTime(rescheduledDate, timezone);
      if (!proposedDate || proposedDate.getTime() <= Date.now()) {
        return res.status(400).json({
          error: 'A valid future reschedule date is required',
          code: 'INVALID_RESCHEDULE_TIME',
          timezone,
        });
      }

      const availability = teacherAvailabilityDecision(teacher, proposedDate, session.duration || 60);
      if (!availability.allowed) {
        return res.status(409).json({
          error: 'هذا الموعد خارج أوقات توفر المعلم',
          code: availability.code || 'TEACHER_UNAVAILABLE',
          teacherTimezone: availability.timeZone || timezone,
        });
      }

      const otherSessions = await Session.find({
        _id: { $ne: session._id },
        teacher: teacher._id,
        status: { $in: ['pending', 'accepted'] },
      }).select('scheduledAt duration');

      const conflict = (otherSessions || []).find((other) => overlaps(
        proposedDate,
        session.duration || 60,
        other.scheduledAt,
        other.duration || 60,
      ));
      if (conflict) {
        return res.status(409).json({
          error: 'هذا الموعد يتعارض مع حصة أخرى لدى المعلم',
          code: 'TEACHER_SLOT_CONFLICT',
        });
      }

      const source = session.toObject();
      delete source._id;
      delete source.createdAt;
      delete source.updatedAt;
      delete source.meetingLink;
      delete source.recordingUrl;

      const newSession = await Session.create({
        ...source,
        scheduledAt: proposedDate,
        timezone,
        status: 'pending',
        rescheduledFrom: session._id,
        cancellationReason: undefined,
      });
      
      session.status = 'cancelled';
      session.cancellationReason = 'Rescheduled';
      await session.save();

      try {
        const arTime = proposedDate.toLocaleString('ar-EG', { timeZone: timezone });
        const enTime = proposedDate.toLocaleString('en-US', { timeZone: timezone });
        const payload = {
          type: 'session-rescheduled',
          title: { ar: 'اقتراح موعد جديد للحصة', en: 'New session time proposed' },
          message: {
            ar: `اقترح المعلم موعدًا جديدًا: ${arTime} (${timezone})`,
            en: `Your tutor proposed a new time: ${enTime} (${timezone})`,
          },
          data: {
            session: newSession._id,
            actionUrl: `/student/dashboard?tab=${newSession.type === 'trial' ? 'trials' : 'sessions'}&session=${newSession._id}`,
          },
          priority: 'high',
        };
        await notifyUser(session.student, payload);
        await notifyGuardiansForStudent(session.student, {
          ...payload,
          data: { ...payload.data, actionUrl: '/guardian/dashboard' },
        });
      } catch (e) {
        console.warn('Session reschedule notification:', e.message);
      }

      return res.json({ success: true, session: newSession });
    }

    await session.save();

    try {
      if (action === 'accept') {
        await notifySessionAccepted(session, session.student, session.meetingLink);
        await notifyGuardiansForStudent(session.student, {
          type: 'session-accepted',
          title: { ar: 'تم تأكيد حصة الطالب', en: 'Student session confirmed' },
          message: {
            ar: `تم تأكيد الحصة بتاريخ ${new Date(session.scheduledAt).toLocaleString('ar-EG', { timeZone: safeTimeZone(session.timezone) })} (${safeTimeZone(session.timezone)})`,
            en: `The session was confirmed for ${new Date(session.scheduledAt).toLocaleString('en-US', { timeZone: safeTimeZone(session.timezone) })} (${safeTimeZone(session.timezone)})`,
          },
          data: { session: session._id, actionUrl: '/guardian/dashboard' },
          priority: 'high',
        });
      } else if (action === 'reject') {
        const payload = {
          type: 'session-rejected',
          title: { ar: 'تم رفض الحصة', en: 'Session rejected' },
          message: {
            ar: reason || 'لم يتم قبول طلب الحصة',
            en: reason || 'Your session request was not accepted',
          },
          data: {
            session: session._id,
            actionUrl: `/student/dashboard?tab=${session.type === 'trial' ? 'trials' : 'sessions'}`,
          },
        };
        await notifyUser(session.student, payload);
        await notifyGuardiansForStudent(session.student, {
          ...payload,
          data: { ...payload.data, actionUrl: '/guardian/dashboard' },
        });
      }
    } catch (e) {
      console.warn('Session respond notification:', e.message);
    }

    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/complete', protect, authorize('teacher'), async (req, res) => {
  try {
    const { evaluation } = req.body;
    const teacher = await Teacher.findOne({ user: req.user.id });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const session = await Session.findOne({
      _id: req.params.id,
      teacher: teacher._id,
      status: { $in: ['accepted', 'completed'] },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or unavailable for completion' });
    }

    const HOURLY_RATE = Number(teacher.hourlyRate || 50);
    const sessionDuration = Math.max(1, Number(session.duration || 60));
    const SESSION_RATE = calculateSessionEarning(HOURLY_RATE, sessionDuration);
    const scheduledAt = new Date(session.scheduledAt);
    const now = new Date();

    if (session.status !== 'completed' && scheduledAt.getTime() > now.getTime()) {
      return res.status(409).json({
        error: 'لا يمكن إنهاء الحصة قبل موعد بدايتها',
        code: 'SESSION_NOT_STARTED',
        scheduledAt: session.scheduledAt,
      });
    }

    if (session.type === 'group_circle') {
      const unresolved = (session.attendance || []).filter((entry) => (
        ['pending', 'confirmed'].includes(String(entry.status || 'pending'))
      ));
      if (unresolved.length) {
        return res.status(409).json({
          error: 'حدّد حضر أو غاب لكل طالب قبل إنهاء الحصة',
          code: 'ATTENDANCE_INCOMPLETE',
          unresolvedStudentIds: unresolved.map((entry) => String(entry.student?._id || entry.student)),
        });
      }
    }

    if (session.type === 'group_circle' && session.status !== 'completed') {
      const unresolvedAttendance = (session.attendance || []).filter(
        (entry) => ['pending', 'confirmed'].includes(entry.status)
      );

      if (unresolvedAttendance.length) {
        return res.status(409).json({
          error: 'يجب تسجيل الحضور النهائي لكل طلاب الحلقة قبل إنهاء الحصة',
          code: 'GROUP_ATTENDANCE_INCOMPLETE',
          unresolvedCount: unresolvedAttendance.length,
        });
      }
    }

    const blockedAttendance = session.student
      ? session.attendance?.find((entry) => (
          entry.student
          && String(entry.student) === String(session.student)
          && ['absent', 'excused'].includes(entry.status)
        ))
      : null;

    if (session.status !== 'completed' && blockedAttendance) {
      return res.status(409).json({
        error: 'لا يمكن اعتماد الحصة كحصة مكتملة لأن حالة الطالب غياب/اعتذار',
        code: 'SESSION_ATTENDANCE_NOT_ELIGIBLE',
        attendanceStatus: blockedAttendance.status,
      });
    }

    const wasAlreadyCompleted = session.status === 'completed';

    if (!wasAlreadyCompleted) {
      session.status = 'completed';
      session.teacherEvaluation = evaluation || {};
      session.earnings.amount = SESSION_RATE;
      session.earnings.status = 'pending';
      await session.save();
      if (session.type === 'trial') {
        const validLevels = ['beginner', 'intermediate', 'advanced', 'ijazah'];
        const validTracks = ['memorization', 'tajweed_ijazah', 'kids_foundation'];
        const recLevel = validLevels.includes(evaluation?.recommendedLevel) ? evaluation.recommendedLevel : undefined;
        const recTrack = validTracks.includes(evaluation?.recommendedTrack) ? evaluation.recommendedTrack : undefined;
        if (session.student && (recLevel || recTrack)) {
          const userUpdate = {};
          if (recLevel) userUpdate.currentLevel = recLevel;
          if (recTrack) userUpdate.preferredTrack = recTrack;
          await User.findByIdAndUpdate(session.student, { $set: userUpdate }).catch(() => {});
        }
        try {
          const TrialRequest = require('../models/TrialRequest');
          await TrialRequest.findOneAndUpdate(
            { scheduledSession: session._id },
            {
              $set: {
                status: 'completed',
                'assessment.evaluatedBy': teacher._id,
                ...(recLevel ? { 'assessment.level': recLevel } : {}),
                ...(recTrack ? { 'assessment.recommendedTrack': recTrack } : {}),
                ...(evaluation?.overallNotes ? { 'assessment.notes': String(evaluation.overallNotes).slice(0, 2000) } : {}),
                'assessment.evaluatedAt': new Date(),
              },
            }
          );
        } catch { /* ignore if no TrialRequest */ }
      }
      if (false)
      await session.save();
    }

    // Ledger is the canonical source of truth for all new teacher earnings.
    await ensureSessionEarning({
      sessionId: session._id,
      teacherId: teacher._id,
      amount: session.earnings?.amount || SESSION_RATE,
      currency: 'EGP',
      attendeesCount: session.student ? 1 : Math.max(1, session.attendance?.length || 0),
      notes: session.type === 'trial'
        ? 'حصة تجريبية مكتملة'
        : session.type === 'group_circle'
          ? 'حصة جماعية مكتملة'
          : 'حصة منتظمة مكتملة',
    });

    const subscriptionUsage = session.type === 'group_circle'
      ? await settleSubscriptionUsageForSession(session)
      : null;

    // Keep non-financial teacher counters deterministic and retry-safe.
    const [completedCount, durationAgg] = await Promise.all([
      Session.countDocuments({ teacher: teacher._id, status: 'completed' }),
      Session.aggregate([
        { $match: { teacher: teacher._id, status: 'completed' } },
        { $group: { _id: null, totalMinutes: { $sum: { $ifNull: ['$duration', 60] } } } },
      ]),
    ]);

    await Teacher.findByIdAndUpdate(teacher._id, {
      $set: {
        'stats.totalSessions': completedCount,
        'stats.totalHours': Math.round(((durationAgg[0]?.totalMinutes || 0) / 60) * 100) / 100,
      },
    });

    if (wasAlreadyCompleted) {
      return res.json({
        success: true,
        session,
        subscriptionUsage,
        alreadyCompleted: true,
        message: 'الحصة مكتملة بالفعل وتم التحقق من استحقاقها المالي',
      });
    }

    const { processReferralFirstSession } = require('./referrals');
    if (session.student) {
      processReferralFirstSession(session.student.toString()).catch(() => {});
    } else if (session.type === 'group_circle') {
      for (const entry of session.attendance || []) {
        if (entry.student) {
          processReferralFirstSession(String(entry.student)).catch(() => {});
        }
      }
    }

    try {
      const isTrial = session.type === 'trial';
      const trialUsed = isTrial
        ? await Session.countDocuments({
            student: session.student,
            type: 'trial',
            status: { $in: TRIAL_CONSUMING_STATUSES },
          })
        : 0;
      const trialRemaining = isTrial
        ? Math.max(0, MAX_TRIAL_SESSIONS_PER_STUDENT - trialUsed)
        : 0;
      const payload = {
        type: 'session-completed',
        title: {
          ar: isTrial ? 'اكتملت حصتك التجريبية' : 'اكتملت حصتك',
          en: isTrial ? 'Your trial session is complete' : 'Your session is complete',
        },
        message: {
          ar: isTrial
            ? (trialRemaining > 0
              ? `أحسنت. يمكنك الاشتراك والاستمرار مع نفس المعلم، أو استخدام ${trialRemaining} حصة تجريبية متبقية مع معلمين آخرين.`
              : 'أحسنت. استخدمت حصصك التجريبية الثلاث. اشترك الآن للاستمرار مع المعلم المناسب.')
            : 'تم تسجيل الحصة كمكتملة ويمكنك مراجعة التقييم والواجب.',
          en: isTrial
            ? (trialRemaining > 0
              ? `You can subscribe and continue with this tutor, or use your ${trialRemaining} remaining trial session(s) with other tutors.`
              : 'You have used all three trial sessions. Subscribe to continue with your tutor.')
            : 'The session is complete. Review your evaluation and homework.',
        },
        data: {
          session: session._id,
          actionUrl: isTrial
            ? `/student/dashboard?tab=trials&postTrial=${session._id}`
            : '/student/dashboard?tab=evaluations',
          ...(isTrial ? {
            trialAllowance: {
              limit: MAX_TRIAL_SESSIONS_PER_STUDENT,
              used: trialUsed,
              remaining: trialRemaining,
            },
          } : {}),
        },
        priority: 'high',
      };

      if (session.student) {
        await notifyUser(session.student, payload);
        await notifyGuardiansForStudent(session.student, {
          ...payload,
          title: {
            ar: isTrial ? 'اكتملت الحصة التجريبية للطالب' : 'اكتملت حصة الطالب',
            en: isTrial ? 'Student trial session completed' : 'Student session completed',
          },
          data: { ...payload.data, actionUrl: '/guardian/dashboard' },
        });
      } else if (session.type === 'group_circle') {
        const studentIds = [...new Set(
          (session.attendance || [])
            .filter((entry) => entry.student)
            .map((entry) => String(entry.student))
        )];

        await Promise.allSettled(
          studentIds.flatMap((studentId) => ([
            notifyUser(studentId, {
              ...payload,
              title: { ar: 'اكتملت حصة الحلقة', en: 'Circle session completed' },
              message: {
                ar: 'تم تسجيل حصة الحلقة كمكتملة وتحديث رصيد حصصك حسب حالة الحضور.',
                en: 'The circle session was completed and your session balance was updated based on attendance.',
              },
              data: { ...payload.data, actionUrl: '/student/dashboard?tab=sessions' },
            }),
            notifyGuardiansForStudent(studentId, {
              ...payload,
              title: { ar: 'اكتملت حصة الحلقة للطالب', en: 'Student circle session completed' },
              message: {
                ar: 'تم تسجيل حصة الحلقة كمكتملة وتحديث رصيد الطالب حسب الحضور.',
                en: 'The circle session was completed and the learner balance was updated based on attendance.',
              },
              data: { ...payload.data, actionUrl: '/guardian/dashboard' },
            }),
          ]))
        );
      }
    } catch (e) {
      console.warn('Session completion notification:', e.message);
    }

    return res.json({ success: true, session, subscriptionUsage });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/:id/feedback', protect, authorize('student'), async (req, res) => {
  try {
    const { rating, comment, wouldContinue } = req.body;

    const session = await Session.findOne({
      _id: req.params.id,
      status: 'completed'
    });

    if (!session || !(await sessionIncludesStudent(session, req.user.id))) {
      return res.status(404).json({ error: 'Completed session not found' });
    }

    if (session.type === 'group_circle') {
      if (!Array.isArray(session.studentFeedbacks)) session.studentFeedbacks = [];
      const existingIndex = session.studentFeedbacks.findIndex(
        (entry) => entry.student && String(entry.student) === String(req.user.id)
      );
      const feedback = {
        student: req.user.id,
        rating,
        comment,
        wouldContinue,
        submittedAt: new Date(),
      };
      if (existingIndex >= 0) {
        session.studentFeedbacks[existingIndex] = feedback;
      } else {
        session.studentFeedbacks.push(feedback);
      }
    } else {
      if (!session.student || String(session.student) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Not your session' });
      }
      session.studentFeedback = { rating, comment, wouldContinue };
    }

    await session.save();

    res.json({ success: true, session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .populate('student', 'name email')
        .populate({
          path: 'teacher',
          populate: { path: 'user', select: 'name email' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Session.countDocuments(filter)
    ]);

    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PATCH /api/sessions/:id/attendance
// @desc    Teacher/admin final attendance manager for group sessions
// @access  Private (Teacher, Admin)
router.patch('/:id/attendance', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'الحصة غير موجودة', code: 'SESSION_NOT_FOUND' });
    }
    if (session.type !== 'group_circle') {
      return res.status(400).json({
        error: 'إدارة الحضور الجماعي متاحة لحصص الجروب فقط',
        code: 'GROUP_ATTENDANCE_ONLY',
      });
    }
    if (session.status !== 'accepted') {
      return res.status(409).json({
        error: 'لا يمكن تعديل الحضور بعد إغلاق الحصة',
        code: 'GROUP_ATTENDANCE_LOCKED',
      });
    }

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacher || String(session.teacher) !== String(teacher._id)) {
        return res.status(403).json({ error: 'غير مصرح بإدارة حضور هذه الحلقة' });
      }
    }

    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    if (!records.length) {
      return res.status(400).json({
        error: 'أرسل حالات الحضور للطلاب',
        code: 'ATTENDANCE_RECORDS_REQUIRED',
      });
    }

    const allowed = new Set(['attended', 'absent', 'excused']);
    const rosterIds = new Set(
      (session.attendance || [])
        .filter((entry) => entry.student)
        .map((entry) => String(entry.student?._id || entry.student))
    );

    for (const record of records) {
      const studentId = String(record?.studentId || '').trim();
      const nextStatus = String(record?.status || '').trim();

      if (!rosterIds.has(studentId)) {
        return res.status(403).json({
          error: 'لا يمكن تعديل حضور طالب غير مسجل في هذه الحصة',
          code: 'ATTENDANCE_STUDENT_NOT_IN_ROSTER',
        });
      }
      if (!allowed.has(nextStatus)) {
        return res.status(400).json({
          error: 'حالة الحضور غير صحيحة',
          code: 'ATTENDANCE_STATUS_INVALID',
        });
      }

      const entry = session.attendance.find(
        (item) => item.student && String(item.student?._id || item.student) === studentId
      );
      if (!entry) continue;

      const protectedEligibleExcuse = entry.status === 'excused' && entry.eligibleForCompensation === true;

      if (nextStatus === 'attended') {
        entry.status = 'attended';
        entry.eligibleForCompensation = false;
        entry.excuseReason = '';
        entry.excusedAt = undefined;
      } else if (nextStatus === 'absent') {
        if (protectedEligibleExcuse) {
          entry.status = 'excused';
          entry.eligibleForCompensation = true;
        } else {
          entry.status = 'absent';
          entry.eligibleForCompensation = false;
          entry.excuseReason = '';
          entry.excusedAt = undefined;
        }
      } else {
        entry.status = 'excused';
        entry.excuseReason = String(record?.excuseReason || entry.excuseReason || 'اعتذار مسجل بواسطة المعلم')
          .trim()
          .slice(0, 500);
        entry.excusedAt = entry.excusedAt || new Date();
        entry.eligibleForCompensation = protectedEligibleExcuse;
      }
    }

    await session.save();
    await session.populate('attendance.student', 'name email avatar');

    return res.json({
      success: true,
      attendance: session.attendance,
      unresolved: session.attendance.filter((entry) => ['pending', 'confirmed'].includes(entry.status)).length,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || 'فشل تحديث الحضور',
      code: error.code || 'GROUP_ATTENDANCE_UPDATE_FAILED',
    });
  }
});

// @route   POST /api/sessions/:id/rsvp
// @desc    Confirm attendance or excuse absence (with 6-hour policy check)
// @access  Private (Student, Guardian, Admin)
router.post('/:id/rsvp', protect, async (req, res) => {
  try {
    const { status, excuseReason } = req.body;
    const studentId = req.body.studentId || req.user.id;

    if (!status || !['confirmed', 'excused'].includes(status)) {
      return res.status(400).json({ error: 'الحالة غير صالحة. يجب أن تكون confirmed أو excused' });
    }

    if (isMockMode && (!isDBConnected() || !isValidObjectId(req.params.id))) {
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const diffHours = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const eligibleForCompensation = status === 'excused' && diffHours >= 6;

      const { setMockSessionRsvp } = require('../mockStore');
      setMockSessionRsvp(req.params.id, {
        status: status === 'confirmed' ? 'confirmed' : 'excused',
        excuseReason: excuseReason || (status === 'confirmed' ? 'تأكيد الحضور مسبقاً' : ''),
        eligibleForCompensation
      });

      return res.json({
        success: true,
        message: status === 'confirmed'
          ? 'تم تأكيد الحضور بنجاح'
          : (eligibleForCompensation
              ? 'تم قبول الاعتذار مسبقاً واحتساب حق التعويض (قبل الموعد بأكثر من 6 ساعات)'
              : 'تم تسجيل الاعتذار المتأخر (أقل من 6 ساعات - لا يشمل التعويض)'),
        status,
        eligibleForCompensation,
        compensationEligible: eligibleForCompensation,
        lateExcuse: status === 'excused' && !eligibleForCompensation,
        diffHours: Math.round(diffHours * 10) / 10,
        attendance: {
          student: studentId,
          status: status === 'confirmed' ? 'confirmed' : 'excused',
          eligibleForCompensation,
          compensationEligible: eligibleForCompensation,
          excuseReason: excuseReason || (status === 'confirmed' ? 'تأكيد الحضور مسبقاً' : '')
        }
      });
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }

    const belongsToSession = await sessionIncludesStudent(session, studentId);
    if (!belongsToSession) {
      return res.status(403).json({ error: 'الطالب غير مسجل في هذه الحصة' });
    }

    // Verify actor permission: the student, their linked guardian, or an admin.
    if (req.user.role !== 'admin' && String(req.user.id) !== String(studentId)) {
      const Guardian = require('../models/Guardian');
      const guardian = await Guardian.findOne({ user: req.user.id, 'children.student': studentId });
      if (!guardian) {
        return res.status(403).json({ error: 'غير مصرح بتعديل حضور هذا الطالب' });
      }
    }

    const now = new Date();
    const scheduledTime = new Date(session.scheduledAt);
    const diffHours = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    let eligibleForCompensation = false;
    let lateExcuse = false;

    if (status === 'excused') {
      if (diffHours >= 6) {
        eligibleForCompensation = true;
      } else {
        lateExcuse = true;
      }
    }

    // Update or insert attendance record for this student
    if (!session.attendance) {
      session.attendance = [];
    }

    const existingIndex = session.attendance.findIndex(
      (a) => a.student && a.student.toString() === studentId.toString()
    );

    const attendanceStatus = status === 'confirmed' ? 'confirmed' : 'excused';

    const attendanceRecord = {
      student: studentId,
      status: attendanceStatus,
      excuseReason: excuseReason || (status === 'confirmed' ? 'تأكيد الحضور مسبقاً' : ''),
      excusedAt: status === 'excused' ? now : undefined,
      eligibleForCompensation
    };

    if (existingIndex > -1) {
      session.attendance[existingIndex].status = attendanceStatus;
      session.attendance[existingIndex].excuseReason = attendanceRecord.excuseReason;
      if (status === 'excused') {
        session.attendance[existingIndex].excusedAt = now;
        session.attendance[existingIndex].eligibleForCompensation = eligibleForCompensation;
      }
    } else {
      session.attendance.push(attendanceRecord);
    }

    await session.save();

    // Update student model if exists
    const Student = require('../models/Student');
    const studentRecord = await Student.findOne({ user: studentId });
    if (studentRecord) {
      studentRecord.lastUpdate = status === 'excused' ? (eligibleForCompensation ? 'معتذر (مستحق تعويض)' : 'معتذر (متأخر)') : 'مؤكد الحضور';
      await studentRecord.save();
    }

    res.json({
      success: true,
      message: status === 'confirmed'
        ? 'تم تأكيد الحضور بنجاح'
        : (eligibleForCompensation
            ? 'تم قبول الاعتذار بنجاح ومستحق لحصة تعويضية (قبل 6 ساعات)'
            : 'تم تسجيل الاعتذار، ولكنه اعتذار متأخر (أقل من 6 ساعات قبل موعد الحصة)'),
      status,
      eligibleForCompensation,
      compensationEligible: eligibleForCompensation,
      lateExcuse,
      diffHours: Math.round(diffHours * 10) / 10
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/sessions/:id/report
// @desc    Save session evaluation report and immediately dispatch WhatsApp report card
// @access  Private (Teacher, Admin)
router.post('/:id/report', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { studentReports } = req.body;
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacher || String(session.teacher) !== String(teacher._id)) {
        return res.status(403).json({ error: 'غير مصرح بكتابة تقرير لهذه الحصة' });
      }
    }

    const reportsInput = Array.isArray(studentReports) ? studentReports : [req.body];
    if (reportsInput.length === 0 || (!reportsInput[0].student && !session.student)) {
      return res.status(400).json({ error: 'بيانات التقرير أو معرف الطالب مطلوبة' });
    }

    const { sendSessionReport } = require('../services/whatsapp');
    const { resolveGuardianOrStudentPhone } = require('../services/scheduler');
    const User = require('../models/User');

    if (!session.studentReports) {
      session.studentReports = [];
    }

    const results = [];

    for (const reportItem of reportsInput) {
      const studentId = reportItem.student || reportItem.studentId || session.student;
      if (!studentId) continue;

      if (!(await sessionIncludesStudent(session, studentId))) {
        return res.status(403).json({ error: 'لا يمكن إضافة تقرير لطالب غير مسجل في هذه الحصة' });
      }

      const studentUser = await User.findById(studentId).select('name phone whatsappPhone guardian');
      if (!studentUser) {
        return res.status(404).json({ error: 'الطالب غير موجود' });
      }

      const memScore = reportItem.memorizationScore != null ? Number(reportItem.memorizationScore) : undefined;
      const tajScore = reportItem.tajweedScore != null ? Number(reportItem.tajweedScore) : undefined;

      const reportData = {
        student: studentId,
        memorizationScore: memScore,
        tajweedScore: tajScore,
        surahRecited: reportItem.surahRecited || '',
        fromAyah: reportItem.fromAyah ? Number(reportItem.fromAyah) : undefined,
        toAyah: reportItem.toAyah ? Number(reportItem.toAyah) : undefined,
        nextHomework: reportItem.nextHomework || reportItem.homework || '',
        notes: reportItem.notes || '',
        sentToWhatsApp: false,
        sentAt: undefined
      };

      // Dispatch WhatsApp report to guardian/student
      try {
        const recipientPhone = await resolveGuardianOrStudentPhone(studentUser);
        if (recipientPhone) {
          const waResult = await sendSessionReport(session, studentUser, reportData, recipientPhone);
          if (waResult?.success) {
            reportData.sentToWhatsApp = true;
            reportData.sentAt = new Date();
          }
        } else {
          console.warn(`⚠️ [Session Report] No phone found for student ${studentUser?.name} (${studentId})`);
        }
      } catch (waErr) {
        console.error('❌ [Session Report] WhatsApp dispatch failed:', waErr.message);
      }

      // Upsert report in session.studentReports
      const existingIdx = session.studentReports.findIndex(
        (r) => r.student && r.student.toString() === studentId.toString()
      );
      if (existingIdx > -1) {
        session.studentReports[existingIdx] = { ...session.studentReports[existingIdx].toObject(), ...reportData };
      } else {
        session.studentReports.push(reportData);
      }

      results.push({
        studentId,
        studentName: studentUser?.name,
        sentToWhatsApp: reportData.sentToWhatsApp
      });
    }

    await session.save();

    res.json({
      success: true,
      message: 'تم حفظ تقرير الحصة وإرساله بنجاح',
      sessionReports: session.studentReports,
      dispatchSummary: results
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

