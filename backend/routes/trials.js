const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TrialRequest = require('../models/TrialRequest');
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const GroupCircle = require('../models/GroupCircle');
const User = require('../models/User');
const { protect, authorize, readAccessTokenIfValid } = require('../middleware/auth');
const meetingService = require('../services/meetingService');
const { notifyUser, notifyAdmins, notifyTeacherForSessionRequest } = require('../utils/notify');
const { logAdminAction } = require('../services/adminAudit');
const {
  parseRequestedDateTime,
  teacherAvailabilityDecision,
  generateTeacherSlotStarts,
  overlaps,
  safeTimeZone,
} = require('../services/sessionScheduling');
const { sessionParticipantWindow } = require('../services/sessionAccess');
const { requireActiveGuardianProfile } = require('../utils/guardianSafeguarding');
const rateLimit = require('express-rate-limit');

const publicTrialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.TRIAL_RATE_LIMIT_MAX || 8),
  message: { error: 'Too many trial requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

const MOCK_TRIALS = [
  {
    _id: 'mock-trial-1',
    studentName: 'عمر خالد',
    guardianName: 'خالد عبد الرحمن',
    whatsappPhone: '+201012345678',
    phone: '+201012345678',
    email: 'khaled@example.com',
    age: 10,
    gender: 'male',
    preferredTrack: 'memorization',
    preferredTeacherGender: 'male',
    country: 'مصر',
    city: 'القاهرة',
    status: 'pending',
    createdAt: new Date().toISOString()
  }
];

// Phone & WhatsApp sanitization helper
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  return String(rawPhone).replace(/[^\d+]/g, '').trim();
}

const VALID_TIME_SLOTS = new Set(['morning', 'afternoon', 'evening', 'flexible']);
const VALID_PREFERRED_DAYS = new Set(['today', 'tomorrow', 'weekend', 'custom']);

// The public form sends preferredPeriod/preferredDay/customDate while older
// clients send preferredTimeSlot/preferredDate. Accept both shapes.
function resolvePreferredSchedule(body = {}) {
  const rawSlot = String(body.preferredTimeSlot || body.preferredPeriod || '').trim();
  const preferredTimeSlot = VALID_TIME_SLOTS.has(rawSlot) ? rawSlot : 'evening';
  const rawDay = String(body.preferredDay || '').trim();
  const preferredDay = VALID_PREFERRED_DAYS.has(rawDay) ? rawDay : '';

  let preferredDate;
  const explicit = body.preferredDate || (preferredDay === 'custom' ? body.customDate : undefined);
  if (explicit) {
    const parsed = new Date(explicit);
    if (!Number.isNaN(parsed.getTime())) preferredDate = parsed;
  } else if (preferredDay) {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    if (preferredDay === 'tomorrow') base.setDate(base.getDate() + 1);
    if (preferredDay === 'weekend') {
      const daysUntilFriday = (5 - base.getDay() + 7) % 7 || 7;
      base.setDate(base.getDate() + daysUntilFriday);
    }
    preferredDate = base;
  }
  return { preferredTimeSlot, preferredDay, preferredDate };
}

const isObjectIdLike = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

// Resolve the platform student account for a trial request strictly via explicit authenticated link.
async function findStudentUserForTrial(trial) {
  if (trial?.studentUser) {
    const linked = await User.findById(trial.studentUser);
    if (linked && linked.role === 'student') return linked;
  }
  return null;
}

// @route   POST /api/trials
// @desc    Public trial booking funnel (No login required; links the account when signed in)
// @access  Public
router.post('/', publicTrialLimiter, readAccessTokenIfValid, async (req, res) => {
  try {
    const {
      studentName,
      guardianName,
      whatsappPhone,
      phone,
      whatsapp,
      email,
      age,
      gender,
      preferredTrack,
      preferredTeacherGender,
      country,
      city,
      notes
    } = req.body;

    // Strict validation
    if (!studentName || !studentName.trim()) {
      return res.status(400).json({ error: 'اسم الطالب مطلوب' });
    }

    const rawWhatsApp = whatsappPhone || whatsapp || phone;
    if (!rawWhatsApp || !String(rawWhatsApp).trim()) {
      return res.status(400).json({ error: 'رقم الواتساب مطلوب للتواصل وإرسال رابط الحصة' });
    }

    const cleanWhatsApp = normalizePhone(rawWhatsApp);
    if (cleanWhatsApp.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'يرجى إدخال رقم واتساب صحيح يبدأ بكود الدولة' });
    }

    if (!gender || !['male', 'female'].includes(gender)) {
      return res.status(400).json({ error: 'يرجى تحديد جنس الطالب بدقة (male أو female)' });
    }

    const parsedAge = parseInt(age, 10);
    if (!parsedAge || parsedAge < 4 || parsedAge > 100) {
      return res.status(400).json({ error: 'يجب أن يكون عمر الطالب بين 4 سنوات و 100 سنة' });
    }

    const cleanGuardianName = String(guardianName || '').trim();
    if (parsedAge < 18 && cleanGuardianName.length < 2) {
      return res.status(400).json({
        error: 'اسم ولي الأمر مطلوب للطلاب أقل من 18 سنة'
      });
    }

    const incomingTrack = preferredTrack || req.body.track || 'memorization';
    const trackMap = {
      'memorization': 'memorization',
      'ijaza': 'tajweed_ijazah',
      'tajweed_ijazah': 'tajweed_ijazah',
      'foundation': 'kids_foundation',
      'kids_foundation': 'kids_foundation'
    };
    const track = trackMap[incomingTrack] || 'memorization';

    const validTeacherGenders = ['male', 'female', 'any'];
    const teacherGender = validTeacherGenders.includes(preferredTeacherGender) ? preferredTeacherGender : 'any';

    const { preferredTimeSlot, preferredDay, preferredDate } = resolvePreferredSchedule(req.body);
    const currentLevel = String(req.body.currentLevel || '').trim().slice(0, 40);
    const referenceNumber = String(req.body.referenceNumber || '').trim().slice(0, 40) || undefined;
    const rawTeacherId = String(req.body.teacherId || req.body.preferredTeacherId || '').trim();

    if (isMockMode && !isDBConnected()) {
      const mockTrialId = 'mock-trial-' + Date.now();
      const mockDirectSession = rawTeacherId
        ? {
            _id: 'mock-session-direct-' + Date.now(),
            teacher: rawTeacherId,
            type: 'trial',
            status: 'pending',
            scheduledAt: req.body.scheduledAt
              ? new Date(req.body.scheduledAt)
              : (preferredDate || new Date(Date.now() + 86400000)),
            duration: 30,
            timezone: safeTimeZone(req.body.timezone || 'Africa/Cairo'),
          }
        : undefined;
      const mockObj = {
        _id: mockTrialId,
        studentName: studentName.trim(),
        guardianName: cleanGuardianName,
        whatsappPhone: cleanWhatsApp,
        age: parsedAge,
        gender,
        preferredTrack: track,
        preferredTimeSlot,
        preferredDay,
        preferredDate,
        currentLevel,
        referenceNumber,
        assignedTeacher: rawTeacherId || undefined,
        scheduledSession: mockDirectSession,
        studentUser: req.user?.role === 'student' ? req.user.id : undefined,
        submittedBy: req.user?.id,
        status: rawTeacherId ? 'scheduled' : 'pending',
        createdAt: new Date().toISOString()
      };
      MOCK_TRIALS.unshift(mockObj);
      return res.status(201).json({
        success: true,
        directTeacherAssigned: Boolean(rawTeacherId),
        message: rawTeacherId
          ? 'تم إرسال طلب الحصة التجريبية مباشرة إلى المعلم المختار بنجاح! سيصلك إشعار فور تأكيد الموعد.'
          : 'تم استقبال طلب الحصة التجريبية المجانية بنجاح! سيتواصل معك منسق الأكاديمية عبر الواتساب لتأكيد الموعد.',
        trialId: mockTrialId,
        trial: mockObj,
        ...(mockDirectSession ? { session: mockDirectSession } : {}),
      });
    }

    // Link the request to the signed-in account (student directly, guardian as submitter).
    const signedInId = req.user?.id && isObjectIdLike(req.user.id) ? req.user.id : undefined;

    // Direct-to-Teacher Flow: when the student/guardian explicitly selects a teacher,
    // route the trial session straight to that teacher without requiring admin assignment,
    // and send Administration an informational (FYI) notification only.
    if (rawTeacherId) {
      if (!isObjectIdLike(rawTeacherId)) {
        return res.status(400).json({ error: 'معرف المعلم المختار غير صالح', code: 'INVALID_TEACHER_ID' });
      }
      const chosenTeacher = await Teacher.findOne({
        _id: rawTeacherId,
        status: 'approved',
        isVerified: true,
      }).populate('user', 'name email');

      if (!chosenTeacher) {
        return res.status(404).json({ error: 'المعلم المختار غير موجود أو غير متاح حالياً' });
      }

      const linkedStudentDoc = signedInId && req.user?.role === 'student'
        ? await User.findById(signedInId).select('gender age enrollmentSection')
        : null;

      const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
      try {
        assertGenderAndAgeCompatibility({
          student: {
            gender: linkedStudentDoc?.gender || gender,
            age: linkedStudentDoc?.age ?? parsedAge,
          },
          teacher: chosenTeacher,
          section: linkedStudentDoc?.enrollmentSection || null,
        });
      } catch (sgErr) {
        return res.status(sgErr?.status || 403).json({
          error: String(sgErr?.publicMessage || sgErr?.message || 'لا يتوافق هذا الاختيار مع ضوابط الخصوصية والأمان بالأكاديمية'),
          code: sgErr?.code || 'SAFEGUARDING_VALIDATION_FAILED',
        });
      }

      const resolvedTimezone = safeTimeZone(
        req.body.timezone || chosenTeacher.availabilityTimezone || 'Africa/Cairo'
      );

      const activeSessions = await Session.find({
        teacher: chosenTeacher._id,
        status: { $in: ['pending', 'accepted', 'completed'] },
      }).select('scheduledAt duration');

      let sessionDate = null;
      if (req.body.scheduledAt) {
        sessionDate = parseRequestedDateTime(req.body.scheduledAt, resolvedTimezone);
        if (!sessionDate || sessionDate.getTime() <= Date.now()) {
          return res.status(400).json({
            error: 'يرجى اختيار موعد مستقبلي صحيح للحصة التجريبية',
            code: 'INVALID_SESSION_TIME',
          });
        }
        const availability = teacherAvailabilityDecision(chosenTeacher, sessionDate, 30);
        if (!availability.allowed) {
          return res.status(409).json({
            error: 'هذا الموعد خارج أوقات توفر المعلم المختار — يرجى اختيار وقت آخر',
            code: availability.code || 'TEACHER_UNAVAILABLE',
          });
        }
        const hasConflict = (activeSessions || []).some((s) =>
          overlaps(sessionDate, 30, s.scheduledAt, s.duration || 60)
        );
        if (hasConflict) {
          return res.status(409).json({
            error: 'هذا الموعد محجوز بالفعل لدى المعلم — يرجى اختيار موعد آخر',
            code: 'TEACHER_SLOT_CONFLICT',
          });
        }
      } else {
        // Auto-select the nearest open slot for this teacher matching preferredDate / preferredTimeSlot
        const hasConfiguredAvailability =
          Array.isArray(chosenTeacher.availability) && chosenTeacher.availability.length > 0;
        if (hasConfiguredAvailability) {
          const generated = generateTeacherSlotStarts(chosenTeacher, {
            days: 14,
            intervalMinutes: 30,
            durationMinutes: 30,
          }).filter(
            (slot) =>
              !(activeSessions || []).some((s) =>
                overlaps(slot.startsAt, 30, s.scheduledAt, s.duration || 60)
              )
          );
          if (generated.length > 0) {
            const targetDateKey = preferredDate
              ? preferredDate.toISOString().slice(0, 10)
              : '';
            const sameDay = targetDateKey
              ? generated.find((slot) => slot.teacherLocalDate === targetDateKey)
              : null;
            sessionDate = (sameDay || generated[0]).startsAt;
          }
        }
        if (!sessionDate) {
          const fallbackHour =
            preferredTimeSlot === 'morning' ? 10 : preferredTimeSlot === 'afternoon' ? 15 : 19;
          const baseDay = preferredDate && preferredDate.getTime() > Date.now()
            ? new Date(preferredDate)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);
          baseDay.setUTCHours(fallbackHour, 0, 0, 0);
          if (baseDay.getTime() <= Date.now() + 30 * 60 * 1000) {
            baseDay.setUTCDate(baseDay.getUTCDate() + 1);
          }
          // Shift by 30m increments if occupied
          for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidate = new Date(baseDay.getTime() + attempt * 30 * 60 * 1000);
            const occupied = (activeSessions || []).some((s) =>
              overlaps(candidate, 30, s.scheduledAt, s.duration || 60)
            );
            if (!occupied) {
              sessionDate = candidate;
              break;
            }
          }
          if (!sessionDate) {
            sessionDate = new Date(Date.now() + 26 * 60 * 60 * 1000);
          }
        }
      }

      const directSession = await Session.create({
        teacher: chosenTeacher._id,
        student: signedInId && req.user?.role === 'student' ? signedInId : undefined,
        type: 'trial',
        status: 'pending',
        scheduledAt: sessionDate,
        duration: 30,
        timezone: resolvedTimezone,
        agreedHourlyRate: Number(chosenTeacher.hourlyRate || 50),
        notes: notes ? String(notes).slice(0, 1500) : ('حصة تجريبية للطالب: ' + studentName.trim()),
      });

      const directTrial = new TrialRequest({
        studentName: studentName.trim(),
        guardianName: cleanGuardianName,
        whatsappPhone: cleanWhatsApp,
        phone: phone ? normalizePhone(phone) : cleanWhatsApp,
        email: email ? String(email).toLowerCase().trim() : '',
        age: parsedAge,
        gender,
        preferredTrack: track,
        preferredTeacherGender: chosenTeacher.personalInfo?.gender || teacherGender,
        country: country || 'مصر',
        city: city || 'القاهرة',
        preferredDate: sessionDate,
        preferredTimeSlot,
        preferredDay,
        currentLevel,
        referenceNumber,
        assignedTeacher: chosenTeacher._id,
        scheduledSession: directSession._id,
        studentUser: signedInId && req.user?.role === 'student' ? signedInId : undefined,
        submittedBy: signedInId,
        status: 'scheduled',
        notes: notes || '',
      });

      await directTrial.save();

      const teacherUserId = chosenTeacher.user?._id || chosenTeacher.user;
      const teacherName = chosenTeacher.personalInfo?.fullName || chosenTeacher.user?.name || 'المعلم';
      const localWhen = sessionDate.toLocaleString('ar-EG', { timeZone: resolvedTimezone });

      if (teacherUserId) {
        notifyTeacherForSessionRequest(directSession, teacherUserId).catch((notifyErr) =>
          console.warn('Direct trial teacher notification error:', notifyErr.message)
        );
      }

      notifyAdmins({
        type: 'system',
        title: {
          ar: 'إشعار محاضرة تجريبية مباشرة (للعلم)',
          en: 'Direct trial class booked (FYI)',
        },
        message: {
          ar: `اختار الطالب ${directTrial.studentName} المعلم ${teacherName} مباشرة لحصة تجريبية في موعد ${localWhen} (${resolvedTimezone}) — أُرسلت للمعلم مباشرة ولا تتطلب تعيين معلم من الإدارة.`,
          en: `${directTrial.studentName} booked a trial directly with ${teacherName} for ${sessionDate.toISOString()} — routed directly to the teacher.`,
        },
        data: { trialId: directTrial._id, session: directSession._id, actionUrl: '/admin/trials' },
        priority: 'medium',
      }).catch((notifyErr) => console.warn('Direct trial admin notification error:', notifyErr.message));

      return res.status(201).json({
        success: true,
        directTeacherAssigned: true,
        message: `تم إرسال طلب الحصة التجريبية مباشرة إلى ${teacherName}! سيصلك إشعار فور تأكيد المعلم للموعد.`,
        trialId: directTrial._id,
        trial: directTrial,
        session: directSession,
      });
    }

    const trial = new TrialRequest({
      studentName: studentName.trim(),
      guardianName: cleanGuardianName,
      whatsappPhone: cleanWhatsApp,
      phone: phone ? normalizePhone(phone) : cleanWhatsApp,
      email: email ? String(email).toLowerCase().trim() : '',
      age: parsedAge,
      gender,
      preferredTrack: track,
      preferredTeacherGender: teacherGender,
      country: country || 'مصر',
      city: city || 'القاهرة',
      preferredDate,
      preferredTimeSlot,
      preferredDay,
      currentLevel,
      referenceNumber,
      studentUser: signedInId && req.user.role === 'student' ? signedInId : undefined,
      submittedBy: signedInId,
      status: 'pending',
      notes: notes || ''
    });

    await trial.save();

    notifyAdmins({
      type: 'system',
      title: { ar: 'طلب حصة تجريبية جديد', en: 'New trial class request' },
      message: {
        ar: 'طلب حصة تجريبية جديد للطالب ' + trial.studentName + ' (' + parsedAge + ' سنة)',
        en: 'New trial class request for ' + trial.studentName + ' (age ' + parsedAge + ')',
      },
      data: { trialId: trial._id, actionUrl: '/admin/trials' },
      priority: 'high',
    }).catch((notifyErr) => console.warn('Trial admin notification error:', notifyErr.message));

    res.status(201).json({
      success: true,
      message: 'تم استقبال طلب الحصة التجريبية المجانية بنجاح! سيتواصل معك منسق الأكاديمية عبر الواتساب لتأكيد الموعد.',
      trialId: trial._id,
      trial
    });
  } catch (error) {
    res.status(400).json({ error: 'فشل تسجيل طلب الحصة التجريبية' });
  }
});

function sanitizeTrialForTeacher(item) {
  if (!item || typeof item !== 'object') return item;
  const raw = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  delete raw.phone;
  delete raw.whatsappPhone;
  delete raw.email;
  if (raw.studentUser && typeof raw.studentUser === 'object') {
    raw.studentUser = {
      _id: raw.studentUser._id,
      name: raw.studentUser.name,
    };
  }
  if (raw.scheduledSession && typeof raw.scheduledSession === 'object') {
    const canSeeMeeting = raw.scheduledSession.status === 'accepted'
      && sessionParticipantWindow(raw.scheduledSession).within;
    if (!canSeeMeeting) {
      const { meetingLink, ...restSession } = raw.scheduledSession;
      raw.scheduledSession = restSession;
    }
  }
  return raw;
}

// @route   GET /api/trials
// @desc    Get all trial requests with filters (status, track, gender, q, preferredTeacherGender)
// @access  Protected (admin, teacher)
router.get('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  const { status, track, gender, preferredTeacherGender, q, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const cleanSearch = String(q || '').trim().slice(0, 80);

  if (isMockMode && !isDBConnected()) {
    let filtered = [...MOCK_TRIALS];
    if (status && status !== 'all') filtered = filtered.filter((t) => t.status === status);
    if (track && track !== 'all') filtered = filtered.filter((t) => t.preferredTrack === track);
    if (gender && gender !== 'all') filtered = filtered.filter((t) => t.gender === gender);
    if (preferredTeacherGender && preferredTeacherGender !== 'all') {
      filtered = filtered.filter((t) => t.preferredTeacherGender === preferredTeacherGender);
    }
    if (cleanSearch) {
      const term = cleanSearch.toLowerCase();
      filtered = filtered.filter((t) =>
        [t.studentName, t.guardianName, t.whatsappPhone, t.email, t.referenceNumber]
          .some((val) => String(val || '').toLowerCase().includes(term))
      );
    }
    const mockSummary = {
      totalAll: MOCK_TRIALS.length,
      pending: MOCK_TRIALS.filter((t) => t.status === 'pending').length,
      scheduled: MOCK_TRIALS.filter((t) => t.status === 'scheduled').length,
      completed: MOCK_TRIALS.filter((t) => t.status === 'completed').length,
      no_show: MOCK_TRIALS.filter((t) => t.status === 'no_show').length,
      cancelled: MOCK_TRIALS.filter((t) => t.status === 'cancelled').length,
      linkedStudents: MOCK_TRIALS.filter((t) => Boolean(t.studentUser)).length,
    };
    return res.json({
      success: true,
      trials: filtered,
      ...(req.user.role === 'admin' ? { summary: mockSummary } : {}),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filtered.length,
        pages: 1,
      },
    });
  }
  try {
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (track && track !== 'all') filter.preferredTrack = track;
    if (gender && gender !== 'all') filter.gender = gender;
    if (
      req.user.role === 'admin'
      && preferredTeacherGender
      && ['male', 'female', 'any'].includes(String(preferredTeacherGender))
    ) {
      filter.preferredTeacherGender = String(preferredTeacherGender);
    }

    // Teachers may only access trial requests explicitly assigned to them.
    if (req.user.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacherDoc) {
        return res.status(403).json({ error: 'Teacher profile is required' });
      }
      filter.assignedTeacher = teacherDoc._id;
    }

    if (cleanSearch) {
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = req.user.role === 'admin'
        ? [
            { studentName: rx },
            { guardianName: rx },
            { whatsappPhone: rx },
            { phone: rx },
            { email: rx },
            { referenceNumber: rx },
          ]
        : [
            { studentName: rx },
            { guardianName: rx },
            { referenceNumber: rx },
          ];
    }

    const skip = (pageNum - 1) * limitNum;
    const canAggregateSummary =
      req.user.role === 'admin'
      && typeof TrialRequest.aggregate === 'function'
      && (Boolean(mongoose.connection?.db) || TrialRequest.aggregate !== mongoose.Model.aggregate);

    const [trials, total, aggRows] = await Promise.all([
      TrialRequest.find(filter)
        .populate({
          path: 'assignedTeacher',
          select: 'personalInfo academicInfo rating',
          populate: { path: 'user', select: 'name email' }
        })
        .populate('scheduledSession', 'scheduledAt meetingLink status meetingProvider')
        .populate('assessment.assignedCircle', 'name code track level')
        .populate('studentUser', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      TrialRequest.countDocuments(filter),
      canAggregateSummary
        ? Promise.resolve(
            TrialRequest.aggregate([
              {
                $group: {
                  _id: null,
                  totalAll: { $sum: 1 },
                  pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                  scheduled: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
                  completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                  no_show: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
                  cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                  linkedStudents: {
                    $sum: {
                      $cond: [{ $ne: [{ $ifNull: ['$studentUser', null] }, null] }, 1, 0],
                    },
                  },
                },
              },
            ])
          ).catch(() => [])
        : Promise.resolve(null),
    ]);

    const presentedTrials = req.user.role === 'teacher'
      ? (trials || []).map(sanitizeTrialForTeacher)
      : trials;

    let summary;
    if (req.user.role === 'admin') {
      const row = Array.isArray(aggRows) && aggRows[0] ? aggRows[0] : null;
      const list = Array.isArray(trials) ? trials : [];
      summary = row
        ? {
            totalAll: Number(row.totalAll || 0),
            pending: Number(row.pending || 0),
            scheduled: Number(row.scheduled || 0),
            completed: Number(row.completed || 0),
            no_show: Number(row.no_show || 0),
            cancelled: Number(row.cancelled || 0),
            linkedStudents: Number(row.linkedStudents || 0),
          }
        : {
            totalAll: Number(total || list.length),
            pending: list.filter((t) => t.status === 'pending').length,
            scheduled: list.filter((t) => t.status === 'scheduled').length,
            completed: list.filter((t) => t.status === 'completed').length,
            no_show: list.filter((t) => t.status === 'no_show').length,
            cancelled: list.filter((t) => t.status === 'cancelled').length,
            linkedStudents: list.filter((t) => Boolean(t.studentUser)).length,
          };
    }

    res.json({
      success: true,
      trials: presentedTrials,
      ...(summary ? { summary } : {}),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب طلبات الحصص التجريبية' });
  }
});

// @route   GET /api/trials/my
// @desc    Trial requests submitted by / linked to the signed-in student or guardian
// @access  Protected (student, guardian)
router.get('/my', protect, authorize('student', 'guardian'), requireActiveGuardianProfile, async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const mine = MOCK_TRIALS.filter((t) => String(t.studentUser || '') === String(req.user.id) || String(t.submittedBy || '') === String(req.user.id));
    return res.json({ success: true, trials: mine });
  }
  try {
    if (!isObjectIdLike(req.user.id)) return res.json({ success: true, trials: [] });
    const trials = await TrialRequest.find({
      $or: [{ studentUser: req.user.id }, { submittedBy: req.user.id }]
    })
      .select('studentName age gender preferredTrack preferredTimeSlot preferredDay preferredDate status referenceNumber scheduledSession assignedTeacher assessment.level assessment.recommendedTrack createdAt')
      .populate({ path: 'assignedTeacher', select: 'personalInfo.fullName user', populate: { path: 'user', select: 'name' } })
      .populate('scheduledSession', 'scheduledAt status meetingLink meetingProvider duration')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const safeTrials = (trials || []).map((item) => {
      if (!item?.scheduledSession || typeof item.scheduledSession !== 'object') return item;
      const canSeeMeeting = item.scheduledSession.status === 'accepted'
        && sessionParticipantWindow(item.scheduledSession).within;
      if (canSeeMeeting) return item;
      const { meetingLink, ...restSession } = item.scheduledSession;
      return { ...item, scheduledSession: restSession };
    });
    return res.json({ success: true, trials: safeTrials });
  } catch (error) {
    return res.status(500).json({ error: 'تعذر تحميل طلبات الحصص التجريبية' });
  }
});

// @route   GET /api/trials/by-session/:sessionId
// @desc    Resolve the trial request behind a trial Session (for the teacher evaluation flow)
// @access  Protected (teacher assigned to the trial, admin)
router.get('/by-session/:sessionId', protect, authorize('admin', 'teacher'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const trial = MOCK_TRIALS.find((t) => String(t.scheduledSession?._id || t.scheduledSession || '') === String(req.params.sessionId));
    return trial ? res.json({ success: true, trial }) : res.status(404).json({ error: 'لا يوجد طلب تجريبي مرتبط بهذه الحصة' });
  }
  try {
    if (!isObjectIdLike(req.params.sessionId)) return res.status(400).json({ error: 'معرف الحصة غير صالح' });
    const trial = await TrialRequest.findOne({ scheduledSession: req.params.sessionId })
      .select('studentName guardianName age gender preferredTrack currentLevel assignedTeacher status assessment notes')
      .lean();
    if (!trial) return res.status(404).json({ error: 'لا يوجد طلب تجريبي مرتبط بهذه الحصة' });
    if (req.user.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacherDoc || String(trial.assignedTeacher || '') !== String(teacherDoc._id)) {
        return res.status(403).json({ error: 'غير مصرح بالاطلاع على هذا الطلب' });
      }
    }
    return res.json({ success: true, trial });
  } catch (error) {
    return res.status(500).json({ error: 'تعذر تحميل بيانات الحصة التجريبية' });
  }
});

// @route   GET /api/trials/:id
// @desc    Get trial request details
// @access  Protected (admin, teacher)
router.get('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    if (!isObjectIdLike(req.params.id)) {
      return res.status(400).json({ error: 'معرف الطلب غير صالح' });
    }
    const trial = await TrialRequest.findById(req.params.id)
      .populate({
        path: 'assignedTeacher',
        select: 'personalInfo academicInfo rating user',
        populate: { path: 'user', select: 'name email phone' }
      })
      .populate('scheduledSession')
      .populate('assessment.assignedCircle')
      .populate('assessment.evaluatedBy', 'personalInfo user');

    if (!trial) {
      return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    }

    if (req.user.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (!teacherDoc || !trial.assignedTeacher || String(trial.assignedTeacher._id || trial.assignedTeacher) !== String(teacherDoc._id)) {
        return res.status(403).json({ error: 'غير مصرح بالاطلاع على هذا الطلب' });
      }
      return res.json({
        success: true,
        trial: sanitizeTrialForTeacher(trial),
      });
    }

    res.json({
      success: true,
      trial
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب تفاصيل الحصة التجريبية' });
  }
});

// @route   PUT /api/trials/:id/assign
// @desc    Assign teacher, schedule session & create Session record (Admin only)
// @access  Protected (admin only)
router.put('/:id/assign', protect, authorize('admin'), async (req, res) => {
  try {
    const { teacherId, scheduledAt, timezone, meetingProvider, notes } = req.body;

    if (!teacherId || !scheduledAt) {
      return res.status(400).json({ error: 'يجب تحديد المعلم وموعد الجلسة' });
    }

    if (isMockMode && !isDBConnected()) {
      const trial = MOCK_TRIALS.find(t => t._id === req.params.id) || MOCK_TRIALS[0];
      if (trial) {
        const mockTimezone = safeTimeZone(timezone || 'Africa/Cairo');
        const mockScheduledAt = parseRequestedDateTime(scheduledAt, mockTimezone);
        if (!mockScheduledAt || mockScheduledAt.getTime() <= Date.now()) {
          return res.status(400).json({ error: 'يجب اختيار موعد مستقبلي صحيح', code: 'INVALID_SESSION_TIME' });
        }
        trial.assignedTeacher = teacherId;
        trial.status = 'scheduled';
        const mockSessionId = 'mock-session-trial-' + Date.now();
        const session = {
          _id: mockSessionId,
          teacher: teacherId,
          type: 'trial',
          status: 'accepted',
          scheduledAt: mockScheduledAt,
          duration: 30,
          timezone: mockTimezone,
          meetingLink: `/live/session_${mockSessionId}`,
          meetingProvider: meetingProvider === 'zoom' && process.env.ZOOM_MEETING_BASE_URL ? 'zoom' : 'livekit'
        };
        trial.scheduledSession = session;
        if (notes) trial.notes = notes;
        return res.json({
          success: true,
          message: 'تم تعيين المعلم وجدولة الحصة التجريبية بنجاح',
          trial,
          session
        });
      }
      return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    }

    if (!isObjectIdLike(req.params.id) || !isObjectIdLike(teacherId)) {
      return res.status(400).json({ error: 'معرف الطلب أو المعلم غير صالح' });
    }

    const trial = await TrialRequest.findById(req.params.id);
    if (!trial) {
      return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    }
    if (['completed', 'cancelled'].includes(trial.status)) {
      return res.status(409).json({ error: 'لا يمكن جدولة طلب مكتمل أو ملغى', code: 'TRIAL_NOT_SCHEDULABLE' });
    }

    const teacher = await Teacher.findOne({
      _id: teacherId,
      status: 'approved',
      isVerified: true
    }).populate('user');
    if (!teacher) {
      return res.status(404).json({ error: 'المعلم المحدد غير موجود أو غير متاح' });
    }

    // Attempt to match or find student User account (explicit link, email, or phone)
    const studentUser = await findStudentUserForTrial(trial);

    const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
    assertGenderAndAgeCompatibility({
      student: {
        gender: trial.gender || studentUser?.gender,
        age: trial.age ?? studentUser?.age,
      },
      teacher,
    });
    if (studentUser && (studentUser.gender || studentUser.age != null)) {
      assertGenderAndAgeCompatibility({
        student: {
          gender: studentUser.gender || trial.gender,
          age: studentUser.age ?? trial.age,
        },
        teacher,
      });
    }

    const resolvedTimezone = safeTimeZone(timezone || teacher.availabilityTimezone || 'Africa/Cairo');
    const sessionDate = parseRequestedDateTime(scheduledAt, resolvedTimezone);
    if (!sessionDate || sessionDate.getTime() <= Date.now()) {
      return res.status(400).json({
        error: 'يجب اختيار موعد مستقبلي صحيح',
        code: 'INVALID_SESSION_TIME',
        timezone: resolvedTimezone,
      });
    }

    const availability = teacherAvailabilityDecision(teacher, sessionDate, 30);
    if (!availability.allowed) {
      return res.status(409).json({
        error: 'هذا الموعد خارج أوقات توفر المعلم',
        code: availability.code || 'TEACHER_UNAVAILABLE',
        teacherTimezone: availability.timeZone || resolvedTimezone,
      });
    }

    const activeSessions = await Session.find({
      teacher: teacher._id,
      status: { $in: ['pending', 'accepted', 'completed'] },
      // A rescheduled trial must not conflict with its own previous session.
      ...(trial.scheduledSession ? { _id: { $ne: trial.scheduledSession } } : {}),
    }).select('scheduledAt duration');
    const conflict = (activeSessions || []).find((active) => overlaps(
      sessionDate,
      30,
      active.scheduledAt,
      active.duration || 60,
    ));
    if (conflict) {
      return res.status(409).json({
        error: 'هذا الموعد يتعارض مع حصة أخرى لدى المعلم',
        code: 'TEACHER_SLOT_CONFLICT',
      });
    }

    // Rescheduling: cancel the previously generated session so it does not linger.
    const previousSessionId = trial.scheduledSession;
    if (previousSessionId) {
      await Session.findByIdAndUpdate(previousSessionId, { status: 'cancelled' });
    }

    const provider = meetingProvider || process.env.DEFAULT_MEETING_PROVIDER || 'livekit';

    // Create session record in Session model
    const session = new Session({
      teacher: teacher._id,
      student: studentUser ? studentUser._id : undefined,
      type: 'trial',
      status: 'accepted',
      scheduledAt: sessionDate,
      duration: 30, // Free trial standard duration: 30 mins
      timezone: resolvedTimezone,
      notes: notes || ('حصة تجريبية للطالب: ' + trial.studentName)
    });

    // Attach meeting link using meetingService
    meetingService.attachToSession(session, provider);
    await session.save();

    // Update TrialRequest record
    trial.assignedTeacher = teacher._id;
    trial.scheduledSession = session._id;
    if (studentUser && !trial.studentUser) trial.studentUser = studentUser._id;
    trial.status = 'scheduled';
    if (notes) trial.notes = notes;
    await trial.save();

    await logAdminAction({
      req,
      action: previousSessionId ? 'trial.rescheduled' : 'trial.assigned',
      entityType: 'trial_request',
      entityId: trial._id,
      reason: notes || '',
      metadata: {
        teacherId: String(teacher._id),
        sessionId: String(session._id),
        scheduledAt: sessionDate.toISOString(),
        studentLinked: Boolean(studentUser),
      },
    }).catch((auditErr) => console.warn('Trial assign audit error:', auditErr.message));

    const localWhen = sessionDate.toLocaleString('ar-EG', { timeZone: resolvedTimezone });

    // Notify teacher if user object exists
    if (teacher.user) {
      try {
        await notifyUser(teacher.user._id || teacher.user, {
          type: 'session-accepted',
          title: { ar: 'حصة تجريبية جديدة مسندة إليك', en: 'New trial class assigned to you' },
          message: {
            ar: 'تم تعيين حصة تجريبية للطالب ' + trial.studentName + ' في موعد ' + localWhen + ' (' + resolvedTimezone + ')',
            en: 'A trial class with ' + trial.studentName + ' was scheduled for ' + sessionDate.toISOString() + ' (' + resolvedTimezone + ')',
          },
          data: { session: session._id, trialId: trial._id, actionUrl: '/teacher/dashboard' }
        });
      } catch (notifyErr) {
        console.warn('Trial assign notification error:', notifyErr.message);
      }
    }

    // Notify the student account (and its linked guardians through the notification service)
    const notifyTargets = new Set();
    if (studentUser) notifyTargets.add(String(studentUser._id));
    if (trial.submittedBy) notifyTargets.add(String(trial.submittedBy));
    for (const targetId of notifyTargets) {
      notifyUser(targetId, {
        type: 'session-accepted',
        title: { ar: 'تم تأكيد موعد الحصة التجريبية', en: 'Your trial class is scheduled' },
        message: {
          ar: 'موعد الحصة التجريبية للطالب ' + trial.studentName + ': ' + localWhen + ' (' + resolvedTimezone + ')',
          en: 'Trial class for ' + trial.studentName + ' is scheduled for ' + sessionDate.toISOString() + ' (' + resolvedTimezone + ')',
        },
        data: { session: session._id, trialId: trial._id },
        priority: 'high',
      }).catch((notifyErr) => console.warn('Trial student notification error:', notifyErr.message));
    }

    res.json({
      success: true,
      message: 'تم تعيين المعلم وجدولة الحصة التجريبية بنجاح',
      trial,
      session,
      studentLinked: Boolean(studentUser),
    });
  } catch (error) {
    if (error?.status === 400 || error?.status === 403) {
      return res.status(error.status).json({
        error: String(error.publicMessage || error.message || 'تعذر تعيين المعلم بسبب ضوابط الحماية'),
        code: error.code || 'SAFEGUARDING_VALIDATION_FAILED',
      });
    }
    res.status(500).json({ error: 'فشل تعيين المعلم وجدولة الحصة' });
  }
});

// @route   PUT /api/trials/:id/status
// @desc    Mark a trial request as cancelled or no-show (Admin only)
// @access  Protected (admin only)
router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  const nextStatus = String(req.body?.status || '');
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  if (!['cancelled', 'no_show', 'pending'].includes(nextStatus)) {
    return res.status(400).json({ error: 'حالة غير صالحة', code: 'INVALID_TRIAL_STATUS' });
  }
  if (isMockMode && !isDBConnected()) {
    const trial = MOCK_TRIALS.find(t => t._id === req.params.id);
    if (!trial) return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    trial.status = nextStatus;
    return res.json({ success: true, trial });
  }
  try {
    if (!isObjectIdLike(req.params.id)) return res.status(400).json({ error: 'معرف الطلب غير صالح' });
    const trial = await TrialRequest.findById(req.params.id);
    if (!trial) return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    if (trial.status === 'completed') {
      return res.status(409).json({ error: 'لا يمكن تعديل حالة حصة مكتملة', code: 'TRIAL_ALREADY_COMPLETED' });
    }
    if (nextStatus === 'cancelled' && trial.scheduledSession) {
      await Session.findByIdAndUpdate(trial.scheduledSession, { status: 'cancelled' });
    }
    trial.status = nextStatus;
    if (reason) trial.notes = [trial.notes, reason].filter(Boolean).join('\n');
    await trial.save();
    await logAdminAction({
      req,
      action: 'trial.status.' + nextStatus,
      entityType: 'trial_request',
      entityId: trial._id,
      reason,
    }).catch((auditErr) => console.warn('Trial status audit error:', auditErr.message));
    return res.json({ success: true, trial });
  } catch (error) {
    return res.status(500).json({ error: 'تعذر تحديث حالة الطلب' });
  }
});

// @route   PUT /api/trials/:id/assess
// @desc    Record teacher assessment, mark trial completed, and auto-enroll into circle if provided
// @access  Protected (teacher, admin)
router.put('/:id/assess', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { level, recommendedTrack, notes, assignedCircleId } = req.body;

    if (isMockMode && !isDBConnected()) {
      const trial = MOCK_TRIALS.find(t => t._id === req.params.id) || MOCK_TRIALS[0];
      if (trial) {
        trial.status = 'completed';
        trial.assessment = {
          level: level || 'intermediate',
          recommendedTrack: recommendedTrack || trial.preferredTrack || 'memorization',
          notes: notes || '',
          assignedCircle: assignedCircleId || 'mock-circle-1',
          evaluatedAt: new Date()
        };
        return res.json({
          success: true,
          message: 'تم تسجيل تقييم الحصة التجريبية بنجاح وتحديث حالتها إلى مكتملة',
          trial,
          enrolledCircle: assignedCircleId ? { circleId: assignedCircleId, name: 'حلقة الإتقان' } : null,
          enrollmentNote: assignedCircleId ? 'تم إلحاق الطالب بالحلقة الجماعية بنجاح' : ''
        });
      }
      return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    }

    if (!isObjectIdLike(req.params.id)) {
      return res.status(400).json({ error: 'معرف الطلب غير صالح' });
    }
    if (assignedCircleId && !isObjectIdLike(assignedCircleId)) {
      return res.status(400).json({ error: 'معرف الحلقة غير صالح' });
    }
    const validLevels = ['beginner', 'intermediate', 'advanced', 'ijazah'];
    const validTracks = ['memorization', 'tajweed_ijazah', 'kids_foundation'];
    if (level && !validLevels.includes(level)) {
      return res.status(400).json({ error: 'مستوى غير صالح' });
    }
    if (recommendedTrack && !validTracks.includes(recommendedTrack)) {
      return res.status(400).json({ error: 'مسار غير صالح' });
    }

    const trial = await TrialRequest.findById(req.params.id);
    if (!trial) {
      return res.status(404).json({ error: 'طلب الحصة التجريبية غير موجود' });
    }

    // Resolve teacher profile
    let teacherProfileId = null;
    if (req.user.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: req.user.id });
      if (!teacherDoc) {
        return res.status(400).json({ error: 'لم يتم العثور على بروفايل المعلم الخاص بك' });
      }
      if (!trial.assignedTeacher || String(trial.assignedTeacher) !== String(teacherDoc._id)) {
        return res.status(403).json({ error: 'هذا الطلب التجريبي غير مسند إليك' });
      }
      teacherProfileId = teacherDoc._id;
    } else if (trial.assignedTeacher) {
      teacherProfileId = trial.assignedTeacher;
    }

    // Only a scheduled (or re-assessed completed) trial may be assessed. A
    // cancelled / no-show / never-scheduled request must never flip to
    // "completed" or overwrite the learner's level.
    if (!['scheduled', 'completed'].includes(trial.status)) {
      return res.status(409).json({
        error: 'لا يمكن تقييم طلب تجريبي غير مجدول أو ملغى أو مسجل كغياب',
        code: 'TRIAL_NOT_ASSESSABLE',
        status: trial.status,
      });
    }

    // Build assessment object
    trial.assessment = {
      evaluatedBy: teacherProfileId,
      level: level || 'beginner',
      recommendedTrack: recommendedTrack || trial.preferredTrack || 'memorization',
      notes: String(notes || '').slice(0, 2000),
      assignedCircle: assignedCircleId || undefined,
      evaluatedAt: new Date()
    };

    trial.status = 'completed';

    // The linked booked session must be completed through the session
    // completion flow (teacher evaluation + earning ledger) before assessment.
    if (trial.scheduledSession) {
      const linkedSession = await Session.findById(trial.scheduledSession);
      if (linkedSession) {
        if (linkedSession.scheduledAt && new Date(linkedSession.scheduledAt).getTime() > Date.now()) {
          return res.status(409).json({
            error: 'لا يمكن اعتماد تقييم الحصة التجريبية قبل موعد انعقادها',
            code: 'SESSION_NOT_STARTED',
          });
        }
        const absentOrExcused = (linkedSession.attendance || []).some(
          (entry) => ['absent', 'excused'].includes(String(entry.status || ''))
        );
        if (absentOrExcused || ['cancelled', 'no-show', 'rejected'].includes(linkedSession.status)) {
          return res.status(409).json({
            error: 'لا يمكن إكمال تقييم حصة تجريبية ملغاة أو مسجل بها غياب الطالب',
            code: 'SESSION_ATTENDANCE_NOT_ELIGIBLE',
          });
        }
        if (linkedSession.status !== 'completed') {
          return res.status(409).json({
            error: 'أنهِ الحصة التجريبية أولاً من لوحة الحصص (إنهاء + تقرير) ثم سجّل التقييم',
            code: 'SESSION_NOT_COMPLETED',
            sessionStatus: linkedSession.status,
          });
        }
      }
    }

    let enrolledCircle = null;
    let enrollmentNote = '';

    // Record circle recommendation only — actual circle enrollment strictly requires paid subscription placement.
    if (assignedCircleId) {
      const circle = await GroupCircle.findById(assignedCircleId).select('_id name code teacher status');
      if (!circle) {
        return res.status(404).json({ error: 'الحلقة المرشحة غير موجودة' });
      }
      if (
        req.user.role === 'teacher' &&
        String(circle.teacher) !== String(teacherProfileId)
      ) {
        return res.status(403).json({ error: 'لا يمكنك ترشيح حلقة لا تديرها' });
      }
      trial.assessment.assignedCircle = circle._id;
      enrollmentNote = 'تم حفظ توصية الحلقة ضمن التقييم؛ يتم التسكين الفعلي فور تفعيل الاشتراك المدفوع.';
    } else {
      trial.assessment.assignedCircle = undefined;
    }

    const studentUser = await findStudentUserForTrial(trial);
    if (studentUser && level) {
      studentUser.currentLevel = level;
      await studentUser.save();
    }

    await trial.save();

    if (req.user.role === 'admin') {
      await logAdminAction({
        req,
        action: 'trial.assessed',
        entityType: 'trial_request',
        entityId: trial._id,
        metadata: { level: trial.assessment.level, recommendedTrack: trial.assessment.recommendedTrack },
      }).catch((auditErr) => console.warn('Trial assess audit error:', auditErr.message));
    }

    res.json({
      success: true,
      message: 'تم تسجيل تقييم الحصة التجريبية بنجاح وتحديث حالتها إلى مكتملة',
      trial,
      enrolledCircle,
      enrollmentNote
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل تسجيل تقييم الحصة التجريبية' });
  }
});

module.exports = router;
