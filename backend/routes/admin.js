const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateMagicBytes } = require('../utils/magicBytes');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const Blog = require('../models/Blog');
const WithdrawRequest = require('../models/WithdrawRequest');
const Payment = require('../models/Payment');
const TeacherLedger = require('../models/TeacherLedger');
const ContactMessage = require('../models/ContactMessage');
const GuardianInvitation = require('../models/GuardianInvitation');
const GroupCircle = require('../models/GroupCircle');
const StudentSubscription = require('../models/StudentSubscription');
const AdminAuditLog = require('../models/AdminAuditLog');
const { protect, authorize } = require('../middleware/auth');
const objectStorage = require('../services/objectStorage');
const { logAdminAction } = require('../services/adminAudit');
const {
  calculateSessionEarning,
  ensureSessionEarning,
  processTeacherPayout,
} = require('../services/teacherFinance');
const { settleSubscriptionUsageForSession } = require('../services/subscriptionUsage');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');

const coursesUploadDir = path.join(__dirname, '..', 'uploads', 'courses');
if (process.env.FILE_STORAGE_DRIVER !== 'external') {
  if (!fs.existsSync(coursesUploadDir)) fs.mkdirSync(coursesUploadDir, { recursive: true });
}

const ADMIN_UPLOAD_MIMES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
]);

const ADMIN_UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp4', '.webm']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const mime = String(file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    const ok = ADMIN_UPLOAD_MIMES.has(mime) && ADMIN_UPLOAD_EXTENSIONS.has(ext);
    cb(ok ? null : new Error('نوع الملف غير مدعوم'), ok);
  },
});

const mongoose = require('mongoose');
const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;
const {
  addMockUser,
  findMockUserByEmail,
  findMockUserById,
  updateMockUser,
  getMockUsers,
  deleteMockUser,
  addMockTeacher,
  findMockTeacherById,
  updateMockTeacher,
  deleteMockTeacher,
  getMockTeachers,
  getMockCircles,
  getMockSubscriptions,
} = require('../mockStore');

const PLACEHOLDER = '/uploads/teachers/placeholder.jpg';
const API_PUBLIC = process.env.API_PUBLIC_URL || 'https://wahy-wa-namaa-api.vercel.app';

router.get('/', protect, authorize('admin'), (_req, res) => {
  res.json({ ok: true, module: 'admin', version: 2 });
});

router.get('/command-center', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    return res.json({
      summary: {
        totalPendingActions: 0,
        criticalActions: 0,
      },
      actions: [],
      recentAudit: [],
    });
  }

  try {
    const now = new Date();
    const [
      pendingTeachers,
      pendingManualPayments,
      pendingPayouts,
      newMessages,
      pendingGuardianInvitations,
      overdueAcceptedSessions,
      completedWithoutReports,
      recentTeachers,
      recentAudit,
      pendingTrialRequests,
      awaitingPlacementSubscriptions,
    ] = await Promise.all([
      Teacher.countDocuments({ status: { $in: ['pending', 'under-review'] } }),
      Payment.countDocuments({
        provider: 'manual',
        kind: { $in: ['course_enrollment', 'subscription'] },
        status: 'pending',
      }),
      TeacherLedger.countDocuments({
        type: 'payout',
        status: { $in: ['pending', 'processing'] },
      }),
      ContactMessage.countDocuments({ status: 'new' }),
      GuardianInvitation.countDocuments({
        status: 'pending',
        expiresAt: { $gt: now },
      }),
      Session.countDocuments({
        status: 'accepted',
        scheduledAt: { $lt: now },
      }),
      Session.countDocuments({
        status: 'completed',
        $or: [
          { studentReports: { $exists: false } },
          { studentReports: { $size: 0 } },
        ],
      }),
      Teacher.find({ status: { $in: ['pending', 'under-review'] } })
        .populate('user', 'name email')
        .select('user personalInfo status createdAt reviewStartedAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AdminAuditLog.find()
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      require('../models/TrialRequest').countDocuments({ status: 'pending' }),
      require('../models/StudentSubscription').countDocuments({ status: 'awaiting_placement' }),
    ]);

    const actions = [
      {
        id: 'teacher-review',
        label: 'معلمون ينتظرون المراجعة',
        count: pendingTeachers,
        severity: pendingTeachers ? 'high' : 'ok',
        actionUrl: '/admin?tab=teachers',
      },
      {
        id: 'manual-payments',
        label: 'إثباتات دفع تحتاج مراجعة',
        count: pendingManualPayments,
        severity: pendingManualPayments ? 'high' : 'ok',
        actionUrl: '/admin/payments',
      },
      {
        id: 'payouts',
        label: 'سحوبات المعلمين',
        count: pendingPayouts,
        severity: pendingPayouts ? 'medium' : 'ok',
        actionUrl: '/admin?tab=withdrawals',
      },
      {
        id: 'messages',
        label: 'رسائل جديدة',
        count: newMessages,
        severity: newMessages ? 'medium' : 'ok',
        actionUrl: '/admin?tab=messages',
      },
      {
        id: 'guardian-links',
        label: 'طلبات ربط أولياء الأمور',
        count: pendingGuardianInvitations,
        severity: 'info',
        actionUrl: '/admin?tab=people&focus=guardian-links',
      },
      {
        id: 'overdue-sessions',
        label: 'حصص انتهى موعدها ولم تُغلق',
        count: overdueAcceptedSessions,
        severity: overdueAcceptedSessions ? 'high' : 'ok',
        actionUrl: '/admin?tab=sessions&focus=overdue',
      },
      {
        id: 'missing-session-reports',
        label: 'حصص مكتملة بدون تقرير طالب',
        count: completedWithoutReports,
        severity: completedWithoutReports ? 'medium' : 'ok',
        actionUrl: '/admin?tab=sessions&focus=missing-reports',
      },
      {
        id: 'trial-requests',
        label: 'طلبات حصص تجريبية بانتظار تعيين معلم',
        count: pendingTrialRequests,
        severity: pendingTrialRequests ? 'high' : 'ok',
        actionUrl: '/admin/trials',
      },
      {
        id: 'awaiting-placement',
        label: 'اشتراكات مدفوعة بانتظار التسكين في حلقة',
        count: awaitingPlacementSubscriptions,
        severity: awaitingPlacementSubscriptions ? 'high' : 'ok',
        actionUrl: '/admin/subscriptions',
      },
    ];

    const totalPendingActions = actions.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const criticalActions = actions
      .filter((item) => item.severity === 'high')
      .reduce((sum, item) => sum + Number(item.count || 0), 0);

    return res.json({
      summary: {
        totalPendingActions,
        criticalActions,
      },
      actions,
      recentTeachers,
      recentAudit: recentAudit.map((entry) => ({
        _id: entry._id,
        actor: entry.actor,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reason: entry.reason,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/session-control', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const focus = String(req.query.focus || 'all').trim();
    return res.json({ focus, count: 0, sessions: [] });
  }
  try {
    const now = new Date();
    const focus = String(req.query.focus || 'all').trim();
    const filter = {};

    if (focus === 'overdue') {
      Object.assign(filter, { status: 'accepted', scheduledAt: { $lt: now } });
    } else if (focus === 'missing-reports') {
      Object.assign(filter, {
        status: 'completed',
        $or: [
          { studentReports: { $exists: false } },
          { studentReports: { $size: 0 } },
        ],
      });
    } else if (focus !== 'all') {
      return res.status(400).json({ error: 'Invalid session control focus' });
    }

    const sessions = await Session.find(filter)
      .populate('student', 'name email phone avatar')
      .populate({
        path: 'teacher',
        select: 'personalInfo.fullName user media.profilePhoto',
        populate: { path: 'user', select: 'name email avatar' },
      })
      .populate('circle', 'name')
      .sort({ scheduledAt: focus === 'overdue' ? 1 : -1 })
      .limit(150)
      .lean();

    const rows = sessions.map((session) => ({
      _id: session._id,
      type: session.type,
      status: session.status,
      scheduledAt: session.scheduledAt,
      duration: session.duration,
      timezone: session.timezone,
      student: session.student ? {
        _id: session.student._id,
        name: session.student.name,
        email: session.student.email,
        phone: session.student.phone,
        avatar: session.student.avatar,
      } : null,
      teacher: session.teacher ? {
        _id: session.teacher._id,
        name: session.teacher.user?.name || session.teacher.personalInfo?.fullName || 'معلم',
        email: session.teacher.user?.email || '',
        avatar: session.teacher.media?.profilePhoto || session.teacher.user?.avatar || '',
      } : null,
      circle: session.circle ? { _id: session.circle._id, name: session.circle.name } : null,
      attendanceCount: (session.attendance || []).length,
      reportCount: (session.studentReports || []).length,
      meetingAvailable: Boolean(session.meetingLink),
      roomId: session.roomId || String(session._id),
      recordingAvailable: Boolean(session.recordingUrl),
      cancellationReason: session.cancellationReason || '',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    await logAdminAction({
      req,
      action: 'session-control.viewed',
      entityType: 'session-control',
      entityId: focus,
      reason: `Admin opened session control: ${focus}`,
      metadata: { focus, resultCount: rows.length },
    }).catch(() => {});

    return res.json({ focus, count: rows.length, sessions: rows });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/session-control/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'الحصة غير موجودة' });

    const { status, reason, resolvePendingAttendanceAs } = req.body || {};
    if (!['completed', 'cancelled', 'no-show'].includes(status)) {
      return res.status(400).json({ error: 'حالة الحصة غير مدعومة' });
    }

    const wasAlreadyCompleted = session.status === 'completed';

    if (wasAlreadyCompleted && status !== 'completed') {
      return res.status(409).json({
        error: 'لا يمكن إلغاء أو تعديل حالة حصة مكتملة بعد تسويتها مالياً',
        code: 'COMPLETED_SESSION_IMMUTABLE',
      });
    }

    let subscriptionUsage = null;

    if (status === 'completed') {
      if (!wasAlreadyCompleted && session.status !== 'accepted') {
        return res.status(409).json({
          error: 'لا يمكن إغلاق الحصة كمكتملة إلا إذا كانت مقبولة ومجدولة (accepted)',
          code: 'SESSION_NOT_ACCEPTED',
          currentStatus: session.status,
        });
      }
      if (!wasAlreadyCompleted && session.scheduledAt && new Date(session.scheduledAt).getTime() > Date.now()) {
        return res.status(409).json({
          error: 'لا يمكن إنهاء الحصة قبل موعد بدايتها',
          code: 'SESSION_NOT_STARTED',
          scheduledAt: session.scheduledAt,
        });
      }

      if (session.type === 'group_circle' && !wasAlreadyCompleted) {
        const unresolved = (session.attendance || []).filter(
          (entry) => ['pending', 'confirmed'].includes(String(entry.status || 'pending'))
        );
        if (unresolved.length) {
          if (['attended', 'absent'].includes(resolvePendingAttendanceAs)) {
            for (const entry of session.attendance || []) {
              if (['pending', 'confirmed'].includes(String(entry.status || 'pending'))) {
                entry.status = resolvePendingAttendanceAs;
              }
            }
          } else {
            return res.status(409).json({
              error: 'يجب حسم حضور طلاب الحلقة قبل إغلاق الحصة كمكتملة',
              code: 'GROUP_ATTENDANCE_INCOMPLETE',
              unresolvedCount: unresolved.length,
            });
          }
        }
      }

      const teacher = session.teacher ? await Teacher.findById(session.teacher) : null;
      const hourlyRate = Number(session.agreedHourlyRate ?? teacher?.hourlyRate ?? 50);
      const sessionDuration = Math.max(1, Number(session.duration || 60));
      const sessionRate = calculateSessionEarning(hourlyRate, sessionDuration);
      const attendedCount = (session.attendance || []).filter((entry) => entry.status === 'attended').length;
      const oneOnOneStudentAttendance = session.student
        ? (session.attendance || []).find(
            (entry) => entry.student && String(entry.student) === String(session.student)
          )
        : null;
      const hasEligibleRegularExcuse = Boolean(
        session.type === 'regular'
        && oneOnOneStudentAttendance?.status === 'excused'
        && oneOnOneStudentAttendance?.eligibleForCompensation === true
      );

      // A 1-on-1 lesson the student excused early (credit preserved) never took
      // place: closing it as "completed" would pay the teacher while the
      // student keeps the credit. The admin must cancel it instead.
      if (!wasAlreadyCompleted && hasEligibleRegularExcuse) {
        return res.status(409).json({
          error: 'اعتذر الطالب مبكراً عن هذه الحصة الفردية؛ لا يمكن إغلاقها كمكتملة. استخدم الإلغاء بدلاً من ذلك.',
          code: 'SESSION_EXCUSED_IN_ADVANCE',
        });
      }

      if (!wasAlreadyCompleted) {
        session.status = 'completed';
        session.earnings = session.earnings || {};
        session.earnings.amount = (session.type === 'group_circle' && attendedCount === 0)
          ? 0
          : (session.earnings.amount || sessionRate);
        session.earnings.status = session.earnings.status || 'pending';
        if (typeof session.validate === 'function') {
          await session.validate();
        }
      }

      if (
        (session.type === 'group_circle' || session.type === 'regular')
        && !hasEligibleRegularExcuse
      ) {
        subscriptionUsage = await settleSubscriptionUsageForSession(session);
      }

      if (!wasAlreadyCompleted) {
        await session.save();
      }

      if (session.teacher && !(session.type === 'group_circle' && attendedCount === 0)) {
        await ensureSessionEarning({
          sessionId: session._id,
          teacherId: session.teacher,
          amount: session.earnings?.amount || sessionRate,
          currency: 'EGP',
          attendeesCount: session.student ? 1 : Math.max(0, attendedCount),
          notes: session.type === 'trial'
            ? 'حصة تجريبية مكتملة (إغلاق إداري)'
            : session.type === 'group_circle'
              ? 'حصة جماعية مكتملة (إغلاق إداري)'
              : 'حصة منتظمة مكتملة (إغلاق إداري)',
        });
      }

      if (teacher?._id) {
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
      }

      if (!wasAlreadyCompleted) {
        const { processReferralFirstSession } = require('./referrals');
        if (
          session.student
          && (!oneOnOneStudentAttendance || !['absent', 'excused'].includes(oneOnOneStudentAttendance.status))
        ) {
          processReferralFirstSession(String(session.student)).catch(() => {});
        } else if (session.type === 'group_circle') {
          for (const entry of session.attendance || []) {
            if (entry.status === 'attended' && entry.student) {
              processReferralFirstSession(String(entry.student)).catch(() => {});
            }
          }
        }
      }
    } else {
      session.status = status;
      if (status === 'cancelled' && reason) {
        session.cancellationReason = String(reason).trim().slice(0, 500);
      }
      await session.save();
    }

    await logAdminAction({
      req,
      action: `session-control.status.${status}`,
      entityType: 'session',
      entityId: String(session._id),
      reason: String(reason || `تحديث حالة الحصة إلى ${status} من مركز التحكم`).trim().slice(0, 200),
      metadata: { status, wasAlreadyCompleted },
    }).catch(() => {});

    return res.json({
      success: true,
      session,
      ...(subscriptionUsage ? { subscriptionUsage } : {}),
    });
  } catch (error) {
    console.error('Admin session-control status update error:', error);
    return res.status(400).json({ error: 'تعذر تحديث حالة الحصة حالياً' });
  }
});

router.get('/audit', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    return res.json({ entries: [] });
  }
  try {
    const filter = {};
    if (req.query.entityType) filter.entityType = String(req.query.entityType);
    if (req.query.entityId) filter.entityId = String(req.query.entityId);
    if (req.query.action) filter.action = String(req.query.action);

    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const entries = await AdminAuditLog.find(filter)
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ entries });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/stats', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const mockUsers = getMockUsers();
    const mockTeachers = getMockTeachers();
    const mockCircles = getMockCircles();
    return res.json({
      totalStudents: mockUsers.filter((u) => u.role === 'student').length,
      totalTeachers: mockTeachers.filter((t) => t.status === 'approved').length,
      totalSessions: 0,
      totalCourses: 0,
      totalEnrollments: 0,
      pendingTeachers: mockTeachers.filter((t) => ['pending', 'under-review'].includes(t.status)).length,
      totalCircles: mockCircles.length,
      pendingTrials: 0,
      totalHours: 0,
      totalEarnings: 0,
    });
  }
  try {
    const GroupCircle = require('../models/GroupCircle');
    const TrialRequest = require('../models/TrialRequest');
    const [totalStudents, approvedTeachers, pendingTeachers, totalSessions, totalCourses, totalEnrollments, totalCircles, pendingTrials] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Teacher.countDocuments({ status: 'approved', isVerified: true }),
      Teacher.countDocuments({ status: { $in: ['pending', 'under-review'] } }),
      Session.countDocuments({ status: 'completed' }),
      Course.countDocuments({ status: 'published' }),
      Enrollment.countDocuments({ status: 'active' }),
      GroupCircle.countDocuments({ status: { $ne: 'completed' } }),
      TrialRequest.countDocuments({ status: 'pending' }),
    ]);
    const earningsAgg = await Session.aggregate([
      { $match: { status: 'completed', 'earnings.amount': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$earnings.amount' } } },
    ]);
    res.json({
      totalStudents,
      totalTeachers: approvedTeachers,
      totalSessions,
      totalCourses,
      totalEnrollments,
      pendingTeachers,
      totalCircles,
      pendingTrials,
      totalHours: Math.round(totalSessions * 0.75),
      totalEarnings: earningsAgg[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/teachers/approved', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const list = getMockTeachers()
      .filter((t) => t.status === 'approved')
      .map((t) => ({
        ...t,
        user: findMockUserById(t.user?._id || t.user) || { _id: t.user, name: t.personalInfo?.fullName || 'معلم', email: '' },
      }));
    return res.json(list);
  }
  try {
    const teachers = await Teacher.find({ status: 'approved', isVerified: true })
      .select('-documents -storageOwner')
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/teachers/pending', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const list = getMockTeachers()
      .filter((t) => ['pending', 'under-review'].includes(t.status))
      .map((t) => ({
        ...t,
        user: findMockUserById(t.user?._id || t.user) || { _id: t.user, name: t.personalInfo?.fullName || 'معلم', email: '' },
      }));
    return res.json(list);
  }
  try {
    const teachers = await Teacher.find({ status: { $in: ['pending', 'under-review'] } })
      .select('-documents -storageOwner')
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/donations', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    return res.json({ donations: [], pagination: { page: 1, limit: 20, total: 0 } });
  }
  try {
    const Donation = require('../models/Donation');
    const donations = await Donation.find().sort({ createdAt: -1 }).limit(50);
    res.json({ donations, pagination: { page: 1, limit: 50, total: donations.length } });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

const VALID_TEACHER_SPECIALIZATIONS = new Set([
  'children', 'adults', 'women', 'non-arabic', 'tajweed', 'ijaza', 'arabic-language',
]);
const VALID_TEACHER_LANGUAGES = new Set([
  'arabic', 'english', 'french', 'german', 'turkish', 'urdu', 'indonesian', 'malay', 'kurdish',
]);
const VALID_TEACHER_STATUSES = new Set([
  'pending', 'under-review', 'approved', 'rejected', 'suspended',
]);

router.post('/teachers', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      name, email, password, phone = '+201000000000', whatsapp = '', telegram = '',
      country = 'مصر', city = 'القاهرة', address = '',
      gender = 'male', age = 30, bio = '',
      university = 'الأزهر', faculty = 'الشريعة', graduationYear = 2015,
      specialization = 'تحفيظ', qualification = 'إجازة في القرآن',
      memorizedParts = 30, teachingExperience = 5, numberOfIjazat = 0,
      ijazaType = '', sheikhName = '', sanad = '',
      specializations = ['tajweed', 'children'],
      languages = ['arabic', 'english'],
      hourlyRate = 50, isFeatured = false, autoApprove = false,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }

    const normalizedSpecs = Array.isArray(specializations)
      ? specializations.filter((item) => VALID_TEACHER_SPECIALIZATIONS.has(item))
      : ['tajweed', 'children'];
    const normalizedLangs = Array.isArray(languages)
      ? languages.filter((item) => VALID_TEACHER_LANGUAGES.has(item))
      : ['arabic', 'english'];

    if (isMockMode && !isDBConnected()) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (findMockUserByEmail(normalizedEmail)) {
        return res.status(409).json({ error: 'البريد مسجل مسبقاً' });
      }
      const mockUser = addMockUser({
        name: String(name).trim(),
        email: normalizedEmail,
        password,
        phone: String(phone || '+201000000000').trim(),
        whatsappPhone: String(whatsapp || phone || '').trim(),
        gender: gender === 'female' ? 'female' : 'male',
        age: Math.min(80, Math.max(18, Number(age) || 30)),
        bio: String(bio || '').trim().slice(0, 500),
        role: 'teacher',
        isActive: true,
        emailVerified: true,
      });
      const mockTeacher = addMockTeacher({
        user: mockUser._id,
        personalInfo: {
          fullName: String(name).trim(),
          age: Math.min(80, Math.max(18, Number(age) || 30)),
          gender: gender === 'female' ? 'female' : 'male',
          country: String(country || 'مصر').trim(),
          city: String(city || 'القاهرة').trim(),
          address: String(address || '').trim(),
          phone: String(phone || '+201000000000').trim(),
          whatsapp: String(whatsapp || phone || '').trim(),
          telegram: String(telegram || '').trim(),
        },
        academicInfo: {
          university: String(university || 'الأزهر').trim(),
          faculty: String(faculty || 'الشريعة').trim(),
          graduationYear: Number(graduationYear) || 2015,
          specialization: String(specialization || 'تحفيظ').trim(),
          qualification: String(qualification || 'إجازة في القرآن').trim(),
        },
        quranInfo: {
          memorizedParts: Math.min(30, Math.max(0, Number(memorizedParts ?? 30))),
          teachingExperience: Math.max(0, Number(teachingExperience ?? 5)),
          numberOfIjazat: Math.max(0, Number(numberOfIjazat ?? 0)),
          ijazaType: String(ijazaType || '').trim(),
          sheikhName: String(sheikhName || '').trim(),
          sanad: String(sanad || '').trim(),
          specializations: normalizedSpecs.length ? normalizedSpecs : ['tajweed', 'children'],
        },
        documents: { idCard: PLACEHOLDER, graduationCertificate: PLACEHOLDER },
        media: {
          profilePhoto: PLACEHOLDER,
          introductionVideo: PLACEHOLDER,
          recitationVideo: PLACEHOLDER,
          teachingMethodVideo: PLACEHOLDER,
        },
        status: 'pending',
        isVerified: false,
        hourlyRate: Math.max(0, Number(hourlyRate ?? 50)),
        isFeatured: Boolean(isFeatured),
        languages: normalizedLangs.length ? normalizedLangs : ['arabic'],
      });
      return res.status(201).json({
        user: { id: mockUser._id, name: mockUser.name, email: mockUser.email },
        teacher: { ...mockTeacher, user: mockUser },
        reviewRequired: true,
      });
    }

    if (await User.findOne({ email: String(email).toLowerCase().trim() })) {
      return res.status(409).json({ error: 'البريد مسجل مسبقاً' });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password,
      phone: String(phone || '+201000000000').trim(),
      whatsappPhone: String(whatsapp || phone || '').trim(),
      gender: gender === 'female' ? 'female' : 'male',
      age: Math.min(80, Math.max(18, Number(age) || 30)),
      bio: String(bio || '').trim().slice(0, 500),
      role: 'teacher',
      isActive: true,
      emailVerified: true,
    });

    const teacher = await Teacher.create({
      user: user._id,
      personalInfo: {
        fullName: String(name).trim(),
        age: Math.min(80, Math.max(18, Number(age) || 30)),
        gender: gender === 'female' ? 'female' : 'male',
        country: String(country || 'مصر').trim(),
        city: String(city || 'القاهرة').trim(),
        address: String(address || '').trim(),
        phone: String(phone || '+201000000000').trim(),
        whatsapp: String(whatsapp || phone || '').trim(),
        telegram: String(telegram || '').trim(),
      },
      academicInfo: {
        university: String(university || 'الأزهر').trim(),
        faculty: String(faculty || 'الشريعة').trim(),
        graduationYear: Number(graduationYear) || 2015,
        specialization: String(specialization || 'تحفيظ').trim(),
        qualification: String(qualification || 'إجازة في القرآن').trim(),
      },
      quranInfo: {
        memorizedParts: Math.min(30, Math.max(0, Number(memorizedParts ?? 30))),
        teachingExperience: Math.max(0, Number(teachingExperience ?? 5)),
        numberOfIjazat: Math.max(0, Number(numberOfIjazat ?? 0)),
        ijazaType: String(ijazaType || '').trim(),
        sheikhName: String(sheikhName || '').trim(),
        sanad: String(sanad || '').trim(),
        specializations: normalizedSpecs.length ? normalizedSpecs : ['tajweed', 'children'],
      },
      documents: { idCard: PLACEHOLDER, graduationCertificate: PLACEHOLDER },
      media: {
        profilePhoto: PLACEHOLDER,
        introductionVideo: PLACEHOLDER,
        recitationVideo: PLACEHOLDER,
        teachingMethodVideo: PLACEHOLDER,
      },
      status: 'pending',
      isVerified: false,
      hourlyRate: Math.max(0, Number(hourlyRate ?? 50)),
      isFeatured: Boolean(isFeatured),
      languages: normalizedLangs.length ? normalizedLangs : ['arabic'],
    });

    await logAdminAction({
      req,
      action: 'teacher.created-by-admin',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: 'تم إنشاء ملف معلم من الإدارة بحالة pending بانتظار استكمال المراجعة.',
      metadata: { requestedAutoApprove: Boolean(autoApprove), status: teacher.status },
    }).catch(() => {});

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email },
      teacher,
      reviewRequired: true,
    });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/teachers/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockTeacher = findMockTeacherById(req.params.id);
      if (!mockTeacher) return res.status(404).json({ error: 'المعلم غير موجود' });
      const {
        name, fullName, email, newPassword, bio, isActive,
        hourlyRate, isFeatured, gender, status, isVerified,
        country, city, address, phone, whatsapp, telegram, age,
        university, faculty, graduationYear, specialization, qualification,
        memorizedParts, teachingExperience, numberOfIjazat, ijazaType, sheikhName, sanad,
        specializations, languages, availabilityTimezone,
        personalInfo = {}, academicInfo = {}, quranInfo = {},
        adminDirectOverride = false,
      } = req.body;

      if (status === 'approved' && mockTeacher.status !== 'approved') {
        return res.status(409).json({
          error: 'اعتماد المعلم يتم فقط من مركز المراجعة بعد إكمال Approval Gate',
          code: 'USE_TEACHER_REVIEW_GATE',
        });
      }
      const mockUser = findMockUserById(mockTeacher.user?._id || mockTeacher.user);
      const resolvedName = String(fullName ?? name ?? personalInfo.fullName ?? '').trim();
      const resolvedEmail = email !== undefined ? String(email).toLowerCase().trim() : undefined;
      if (mockUser) {
        if (resolvedEmail && resolvedEmail !== mockUser.email) mockUser.email = resolvedEmail;
        if (resolvedName) mockUser.name = resolvedName;
        if (phone ?? personalInfo.phone) mockUser.phone = String(phone ?? personalInfo.phone).trim();
        if (whatsapp ?? personalInfo.whatsapp) mockUser.whatsappPhone = String(whatsapp ?? personalInfo.whatsapp).trim();
        if (bio !== undefined) mockUser.bio = String(bio || '').trim().slice(0, 500);
        if (typeof isActive === 'boolean') mockUser.isActive = isActive;
        if (newPassword && String(newPassword).trim().length >= 8) mockUser.password = String(newPassword).trim();
      }
      mockTeacher.personalInfo = {
        ...mockTeacher.personalInfo,
        ...personalInfo,
        ...(resolvedName ? { fullName: resolvedName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
        ...(telegram !== undefined ? { telegram } : {}),
        ...(country !== undefined ? { country } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(age !== undefined ? { age: Number(age) } : {}),
      };
      mockTeacher.academicInfo = {
        ...mockTeacher.academicInfo,
        ...academicInfo,
        ...(university !== undefined ? { university } : {}),
        ...(faculty !== undefined ? { faculty } : {}),
        ...(graduationYear !== undefined ? { graduationYear: Number(graduationYear) } : {}),
        ...(specialization !== undefined ? { specialization } : {}),
        ...(qualification !== undefined ? { qualification } : {}),
      };
      mockTeacher.quranInfo = {
        ...mockTeacher.quranInfo,
        ...quranInfo,
        ...(memorizedParts !== undefined ? { memorizedParts: Number(memorizedParts) } : {}),
        ...(teachingExperience !== undefined ? { teachingExperience: Number(teachingExperience) } : {}),
        ...(numberOfIjazat !== undefined ? { numberOfIjazat: Number(numberOfIjazat) } : {}),
        ...(ijazaType !== undefined ? { ijazaType } : {}),
        ...(sheikhName !== undefined ? { sheikhName } : {}),
        ...(sanad !== undefined ? { sanad } : {}),
        ...(Array.isArray(specializations) ? { specializations } : {}),
      };
      if (Array.isArray(languages) && languages.length) mockTeacher.languages = languages;
      if (availabilityTimezone) mockTeacher.availabilityTimezone = availabilityTimezone;
      if (hourlyRate !== undefined) mockTeacher.hourlyRate = Number(hourlyRate);
      if (typeof isFeatured === 'boolean') mockTeacher.isFeatured = isFeatured;
      if (status && VALID_TEACHER_STATUSES.has(status)) {
        mockTeacher.status = status;
        mockTeacher.isVerified = typeof isVerified === 'boolean' ? isVerified : status === 'approved';
      }
      return res.json({ ...mockTeacher, user: mockUser });
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'المعلم غير موجود' });

    const {
      name, fullName, email, newPassword, bio, isActive,
      hourlyRate, isFeatured, gender, status, isVerified,
      country, city, address, phone, whatsapp, telegram, age,
      university, faculty, graduationYear, specialization, qualification,
      memorizedParts, teachingExperience, numberOfIjazat, ijazaType, sheikhName, sanad,
      specializations, languages, availabilityTimezone,
      personalInfo = {}, academicInfo = {}, quranInfo = {},
      adminDirectOverride = false,
    } = req.body;

    if (status === 'approved' && teacher.status !== 'approved') {
      return res.status(409).json({
        error: 'اعتماد المعلم يتم فقط من مركز المراجعة بعد إكمال Approval Gate',
        code: 'USE_TEACHER_REVIEW_GATE',
      });
    }

    const userDoc = await User.findById(teacher.user).select('+password +refreshTokenVersion +sessionsRevokedAt');
    const resolvedName = String(fullName ?? name ?? personalInfo.fullName ?? '').trim();
    const resolvedEmail = email !== undefined ? String(email).toLowerCase().trim() : undefined;
    const resolvedPhone = phone ?? personalInfo.phone;
    const resolvedWhatsapp = whatsapp ?? personalInfo.whatsapp;
    const resolvedTelegram = telegram ?? personalInfo.telegram;
    const resolvedCountry = country ?? personalInfo.country;
    const resolvedCity = city ?? personalInfo.city;
    const resolvedAddress = address ?? personalInfo.address;
    const resolvedGender = gender ?? personalInfo.gender;
    const resolvedAge = age ?? personalInfo.age;

    if (userDoc) {
      if (resolvedEmail && resolvedEmail !== userDoc.email) {
        const existingEmail = await User.findOne({ email: resolvedEmail, _id: { $ne: userDoc._id } });
        if (existingEmail) {
          return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل لحساب آخر' });
        }
        userDoc.email = resolvedEmail;
        userDoc.googleSubject = undefined;
        userDoc.emailVerified = false;
      }
      if (resolvedName) userDoc.name = resolvedName;
      if (resolvedPhone !== undefined && String(resolvedPhone).trim()) {
        userDoc.phone = String(resolvedPhone).trim();
      }
      if (resolvedWhatsapp !== undefined) {
        userDoc.whatsappPhone = String(resolvedWhatsapp || '').trim();
      }
      if (bio !== undefined) {
        userDoc.bio = String(bio || '').trim().slice(0, 500);
      }
      if (resolvedGender === 'male' || resolvedGender === 'female') {
        userDoc.gender = resolvedGender;
      }
      if (resolvedAge !== undefined && Number.isFinite(Number(resolvedAge))) {
        userDoc.age = Math.min(80, Math.max(18, Number(resolvedAge)));
      }
      let shouldRevokeSessions = false;
      if (typeof isActive === 'boolean') {
        if (isActive === false && userDoc.isActive !== false) {
          shouldRevokeSessions = true;
        }
        userDoc.isActive = isActive;
      }
      if (status && ['suspended', 'rejected', 'pending', 'under-review'].includes(status) && teacher.status === 'approved') {
        shouldRevokeSessions = true;
      }
      if (newPassword && String(newPassword).trim()) {
        if (String(newPassword).trim().length < 8) {
          return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
        }
        userDoc.password = String(newPassword).trim();
        shouldRevokeSessions = true;
      }
      if (shouldRevokeSessions) {
        userDoc.refreshTokenVersion = Number(userDoc.refreshTokenVersion || 0) + 1;
        userDoc.sessionsRevokedAt = new Date();
      }
      await userDoc.save();
    }

    if (resolvedName) teacher.personalInfo.fullName = resolvedName;
    if (resolvedPhone !== undefined && String(resolvedPhone).trim()) {
      teacher.personalInfo.phone = String(resolvedPhone).trim();
    }
    if (resolvedWhatsapp !== undefined) {
      teacher.personalInfo.whatsapp = String(resolvedWhatsapp || '').trim();
    }
    if (resolvedTelegram !== undefined) {
      teacher.personalInfo.telegram = String(resolvedTelegram || '').trim();
    }
    if (resolvedCountry !== undefined && String(resolvedCountry).trim()) {
      teacher.personalInfo.country = String(resolvedCountry).trim();
    }
    if (resolvedCity !== undefined && String(resolvedCity).trim()) {
      teacher.personalInfo.city = String(resolvedCity).trim();
    }
    if (resolvedAddress !== undefined) {
      teacher.personalInfo.address = String(resolvedAddress || '').trim();
    }
    if (resolvedGender === 'male' || resolvedGender === 'female') {
      if (resolvedGender !== teacher.personalInfo?.gender) {
        const canQueryModel = (Model) => Boolean(require('mongoose').connection?.db) || Model.find !== require('mongoose').Model.find;
        const existingCircles = !canQueryModel(GroupCircle) ? [] : await GroupCircle.find({
          teacher: teacher._id,
          status: { $nin: ['completed', 'cancelled'] },
        }).select('gender subscriptionSection');
        const candidateTeacher = { personalInfo: { gender: resolvedGender } };
        try {
          for (const circle of existingCircles) {
            assertGenderAndAgeCompatibility({
              teacher: candidateTeacher,
              circleGender: circle.gender,
              section: circle.subscriptionSection,
            });
          }
          // Open 1-on-1 lessons and tutor-locked subscriptions must remain
          // gender-compatible with the teacher's new gender as well.
          const openOneToOne = !canQueryModel(Session) ? [] : await Session.find({
            teacher: teacher._id,
            type: { $in: ['trial', 'regular'] },
            status: { $in: ['pending', 'accepted'] },
          }).populate('student', 'gender age enrollmentSection');
          for (const openSession of openOneToOne || []) {
            if (!openSession?.student) continue;
            assertGenderAndAgeCompatibility({
              student: openSession.student,
              teacher: candidateTeacher,
              section: openSession.student.enrollmentSection || null,
            });
          }
          const lockedSubscriptions = !canQueryModel(StudentSubscription) ? [] : await StudentSubscription.find({
            preferredTeacher: teacher._id,
            status: { $nin: ['cancelled', 'expired', 'exhausted'] },
          }).populate('student', 'gender age enrollmentSection');
          for (const lockedSub of lockedSubscriptions || []) {
            if (!lockedSub?.student) continue;
            assertGenderAndAgeCompatibility({
              student: lockedSub.student,
              teacher: candidateTeacher,
              section: lockedSub.section || lockedSub.student.enrollmentSection || null,
            });
          }
        } catch (safeguardErr) {
          return res.status(409).json({
            error: safeguardErr.publicMessage || 'لا يمكن تغيير جنس المعلم لوجود حلقات أو حصص أو اشتراكات نشطة غير متوافقة',
            code: safeguardErr.code || 'GENDER_SEPARATION_VIOLATION',
          });
        }
      }
      teacher.personalInfo.gender = resolvedGender;
    }
    if (resolvedAge !== undefined && Number.isFinite(Number(resolvedAge))) {
      teacher.personalInfo.age = Math.min(80, Math.max(18, Number(resolvedAge)));
    }

    const resolvedUniversity = university ?? academicInfo.university;
    const resolvedFaculty = faculty ?? academicInfo.faculty;
    const resolvedGradYear = graduationYear ?? academicInfo.graduationYear;
    const resolvedSpec = specialization ?? academicInfo.specialization;
    const resolvedQual = qualification ?? academicInfo.qualification;

    if (resolvedUniversity !== undefined && String(resolvedUniversity).trim()) {
      teacher.academicInfo.university = String(resolvedUniversity).trim();
    }
    if (resolvedFaculty !== undefined && String(resolvedFaculty).trim()) {
      teacher.academicInfo.faculty = String(resolvedFaculty).trim();
    }
    if (resolvedGradYear !== undefined && Number.isFinite(Number(resolvedGradYear))) {
      teacher.academicInfo.graduationYear = Number(resolvedGradYear);
    }
    if (resolvedSpec !== undefined && String(resolvedSpec).trim()) {
      teacher.academicInfo.specialization = String(resolvedSpec).trim();
    }
    if (resolvedQual !== undefined && String(resolvedQual).trim()) {
      teacher.academicInfo.qualification = String(resolvedQual).trim();
    }

    const resolvedMemParts = memorizedParts ?? quranInfo.memorizedParts;
    const resolvedExp = teachingExperience ?? quranInfo.teachingExperience;
    const resolvedIjazatCount = numberOfIjazat ?? quranInfo.numberOfIjazat;
    const resolvedIjazaType = ijazaType ?? quranInfo.ijazaType;
    const resolvedSheikh = sheikhName ?? quranInfo.sheikhName;
    const resolvedSanad = sanad ?? quranInfo.sanad;
    const resolvedSpecsList = specializations ?? quranInfo.specializations;

    if (resolvedMemParts !== undefined && Number.isFinite(Number(resolvedMemParts))) {
      teacher.quranInfo.memorizedParts = Math.min(30, Math.max(0, Number(resolvedMemParts)));
    }
    if (resolvedExp !== undefined && Number.isFinite(Number(resolvedExp))) {
      teacher.quranInfo.teachingExperience = Math.max(0, Number(resolvedExp));
    }
    if (resolvedIjazatCount !== undefined && Number.isFinite(Number(resolvedIjazatCount))) {
      teacher.quranInfo.numberOfIjazat = Math.max(0, Number(resolvedIjazatCount));
    }
    if (resolvedIjazaType !== undefined) {
      teacher.quranInfo.ijazaType = String(resolvedIjazaType || '').trim();
    }
    if (resolvedSheikh !== undefined) {
      teacher.quranInfo.sheikhName = String(resolvedSheikh || '').trim();
    }
    if (resolvedSanad !== undefined) {
      teacher.quranInfo.sanad = String(resolvedSanad || '').trim();
    }
    if (Array.isArray(resolvedSpecsList)) {
      teacher.quranInfo.specializations = resolvedSpecsList.filter((item) => VALID_TEACHER_SPECIALIZATIONS.has(item));
    }

    if (Array.isArray(languages)) {
      const filteredLangs = languages.filter((item) => VALID_TEACHER_LANGUAGES.has(item));
      if (filteredLangs.length) teacher.languages = filteredLangs;
    }
    if (availabilityTimezone && String(availabilityTimezone).trim()) {
      teacher.availabilityTimezone = String(availabilityTimezone).trim();
    }
    if (hourlyRate != null && Number.isFinite(Number(hourlyRate)) && Number(hourlyRate) >= 0) {
      teacher.hourlyRate = Number(hourlyRate);
    }
    if (typeof isFeatured === 'boolean') teacher.isFeatured = isFeatured;

    if (status && VALID_TEACHER_STATUSES.has(status)) {
      teacher.status = status;
      teacher.isVerified = status === 'approved' ? (typeof isVerified === 'boolean' ? isVerified : true) : false;
      if (status === 'approved' && !teacher.reviewCompletedAt) {
        teacher.reviewCompletedAt = new Date();
      }
      if (['suspended', 'rejected'].includes(status)) {
        if (userDoc) {
          userDoc.refreshTokenVersion = Number(userDoc.refreshTokenVersion || 0) + 1;
          userDoc.sessionsRevokedAt = new Date();
          await userDoc.save();
        }
        if (Boolean(require('mongoose').connection?.db) || Session.updateMany !== require('mongoose').Model.updateMany) {
          await Session.updateMany(
            {
              teacher: teacher._id,
              status: { $in: ['pending', 'accepted'] },
              scheduledAt: { $gt: new Date() },
            },
            { $set: { status: 'cancelled', cancellationReason: 'Teacher deactivated' } }
          ).catch(() => {});
        }
        if (Boolean(require('mongoose').connection?.db) || StudentSubscription.updateMany !== require('mongoose').Model.updateMany) {
          await StudentSubscription.updateMany(
            {
              preferredTeacher: teacher._id,
              status: { $nin: ['cancelled', 'expired'] },
            },
            { $set: { preferredTeacher: null } }
          ).catch(() => {});
        }
      }
    } else if (typeof isVerified === 'boolean') {
      if (isVerified === true && teacher.status !== 'approved') {
        return res.status(409).json({
          error: 'لا يمكن توثيق المعلم قبل اعتماده عبر بوابة المراجعة',
          code: 'USE_TEACHER_REVIEW_GATE',
        });
      }
      teacher.isVerified = isVerified;
    }

    await teacher.save();

    await logAdminAction({
      req,
      action: 'teacher.admin-profile.updated',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: String(req.body.adminReason || 'تحديث شامل لملف المعلم من الإدارة').trim(),
      metadata: {
        fields: Object.keys(req.body).filter((key) => !['newPassword', 'password', 'adminReason'].includes(key)),
        passwordChanged: Boolean(newPassword && String(newPassword).trim()),
      },
    }).catch(() => {});

    const populatedTeacher = await Teacher.findById(teacher._id)
      .populate('user', 'name email phone whatsappPhone avatar bio isActive createdAt lastLogin');
    res.json(populatedTeacher || teacher);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/teachers/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockTeacher = findMockTeacherById(req.params.id);
      if (!mockTeacher) return res.status(404).json({ error: 'المعلم غير موجود' });
      const userId = mockTeacher.user?._id || mockTeacher.user;
      deleteMockTeacher(req.params.id);
      if (userId) deleteMockUser(userId);
      return res.json({ success: true, deletedId: String(req.params.id) });
    }
    const teacher = await Teacher.findById(req.params.id)
      .select('+storageOwner documents media personalInfo status user isVerified')
      .populate('user', 'name email role');
    if (!teacher) return res.status(404).json({ error: 'المعلم غير موجود' });

    const replacementTeacherId = req.body?.replacementTeacherId || req.query?.replacementTeacherId;
    const forceDelete = Boolean(req.body?.force || req.query?.force === 'true');
    const teacherCircles = await GroupCircle.find({ teacher: teacher._id });

    if (teacherCircles.length > 0) {
      if (replacementTeacherId) {
        if (String(replacementTeacherId) === String(teacher._id)) {
          return res.status(400).json({ error: 'لا يمكن تعيين نفس المعلم المحذوف كبديل' });
        }
        const replacement = await Teacher.findById(replacementTeacherId);
        if (!replacement) {
          return res.status(404).json({ error: 'المعلم البديل غير موجود' });
        }
        if (replacement.status !== 'approved' || replacement.isVerified !== true) {
          return res.status(409).json({
            error: 'يجب أن يكون المعلم البديل معتمداً وموثقاً قبل نقل الحلقات إليه',
            code: 'REPLACEMENT_TEACHER_NOT_APPROVED',
          });
        }
        for (const circle of teacherCircles) {
          try {
            assertGenderAndAgeCompatibility({
              teacher: replacement,
              circleGender: circle.gender,
              section: circle.subscriptionSection,
            });
          } catch (safeguardErr) {
            return res.status(409).json({
              error: safeguardErr.publicMessage || 'جنس المعلم البديل غير متوافق مع جنس إحدى الحلقات المسجلة',
              code: 'GENDER_SEPARATION_VIOLATION',
            });
          }
        }
        await GroupCircle.updateMany({ teacher: teacher._id }, { $set: { teacher: replacement._id } });
      } else {
        const activeWithStudents = teacherCircles.filter((c) => Array.isArray(c.students) && c.students.length > 0);
        if (activeWithStudents.length > 0 && !forceDelete) {
          return res.status(409).json({
            error: `لا يمكن حذف المعلم لأن لديه ${activeWithStudents.length} حلقة مسجل بها طلاب. يمكنك تغيير معلم الحلقة أولاً أو تأكيد الحذف الشامل.`,
            code: 'TEACHER_HAS_ACTIVE_CIRCLES',
            circlesCount: activeWithStudents.length,
          });
        }
        const circleIds = teacherCircles.map((c) => c._id);
        await User.updateMany({ circle: { $in: circleIds } }, { $unset: { circle: 1 } });
        await StudentSubscription.updateMany(
          { circle: { $in: circleIds }, status: { $in: ['placed', 'active', 'paused'] } },
          { $set: { circle: null, status: 'awaiting_placement' } }
        );
        await GroupCircle.deleteMany({ _id: { $in: circleIds } });
      }
    }

    await StudentSubscription.updateMany(
      { preferredTeacher: teacher._id },
      { $set: { preferredTeacher: null } }
    );
    await Session.updateMany(
      { teacher: teacher._id, status: { $in: ['pending', 'accepted', 'scheduled'] } },
      { $set: { status: 'cancelled' } }
    );

    const teacherId = String(teacher._id);
    const teacherName = teacher.personalInfo?.fullName || teacher.user?.name || '';
    const teacherEmail = teacher.user?.email || '';
    const linkedUserId = teacher.user?._id || teacher.user;

    try {
      const { resolveOwnedTeacherAssets } = require('../utils/teacherAssetLifecycle');
      const lifecycle = resolveOwnedTeacherAssets({ teacher, user: teacher.user });
      await Promise.allSettled(
        (lifecycle.resolved || []).map((asset) => objectStorage.deleteOwnedObject(asset.reference, asset.purpose, asset.owner))
      );
    } catch {
      // Best-effort storage purge during hard delete; do not block DB account removal if legacy refs exist.
    }

    await Teacher.findByIdAndDelete(teacher._id);
    if (linkedUserId) {
      await User.deleteOne({ _id: linkedUserId, role: 'teacher' });
    }

    await logAdminAction({
      req,
      action: 'teacher.deleted-by-admin',
      entityType: 'teacher',
      entityId: teacherId,
      reason: String(req.body?.reason || req.query?.reason || 'حذف حساب المعلم من الإدارة').trim(),
      metadata: { teacherName, teacherEmail, forceDelete },
    }).catch(() => {});

    return res.json({ success: true, deletedId: teacherId });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/upload', protect, authorize('admin'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: safeErrorMessage(err, status) });
    }
    return next();
  });
}, async (req, res) => {
  const directFile = req.body?.storageFile && typeof req.body.storageFile === 'object'
    ? req.body.storageFile
    : null;

  if (directFile?.url) {
    if (!objectStorage.isOwnedObjectReference(directFile.url, 'course-media', req.user.id)) {
      return res.status(400).json({ error: 'Invalid uploaded media reference' });
    }
    const directMime = String(directFile.contentType || '').split(';', 1)[0].trim().toLowerCase();
    const directExt = path.extname(objectStorage.extractPathname(directFile.url)).toLowerCase();
    if (!ADMIN_UPLOAD_MIMES.has(directMime) || !ADMIN_UPLOAD_EXTENSIONS.has(directExt)) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
    }
    return res.json({
      url: objectStorage.publicProxyUrl(directFile.url),
      source: objectStorage.getDriver(),
      filename: String(directFile.name || 'media').slice(0, 180),
      mimetype: directMime,
      size: Number(directFile.size || 0),
    });
  }

  if (!req.file) return res.status(400).json({ error: 'لم يُرفع ملف' });
  const normalizedMime = String(req.file.mimetype || '').split(';', 1)[0].trim().toLowerCase();
  const canonicalExt = ADMIN_UPLOAD_MIMES.get(normalizedMime);
  if (!canonicalExt) {
    return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
  }
  const magicCheck = validateMagicBytes(req.file.buffer, normalizedMime);
  if (!magicCheck.valid) {
    return res.status(400).json({ error: 'محتوى الملف لا يطابق الصيغة المعلنة', code: 'INVALID_FILE_MAGIC_BYTES' });
  }

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${canonicalExt}`;
  try {
    if (process.env.FILE_STORAGE_DRIVER === 'external' || ['vercel-blob', 's3'].includes(objectStorage.getDriver())) {
      return res.status(503).json({ error: 'External file storage is not configured yet', code: 'FILE_STORAGE_NOT_READY' });
    }

    const filePath = path.join(coursesUploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const rel = `/uploads/courses/${filename}`;
    const url = `${API_PUBLIC}${rel}`;
    return res.json({ url, path: rel, source: 'local', filename, mimetype: normalizedMime, size: req.file.size });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/courses', protect, authorize('admin'), async (req, res) => {
  try {
    const courses = await Course.find()
      .populate({ path: 'instructor', populate: { path: 'user', select: 'name' } })
      .sort({ updatedAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/courses', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      titleAr, titleEn, descAr, descEn, slug, category = 'quran', level = 'beginner',
      price = 0, instructorId, image = '/courses/default.jpg', status = 'published', programs = [],
    } = req.body;

    const cleanTitleAr = String(titleAr || '').trim();
    const cleanSlug = String(slug || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanTitleAr || !cleanSlug || !instructorId) {
      return res.status(400).json({ error: 'العنوان والرابط والمعلم مطلوبة' });
    }
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({ error: 'معرف المعلم غير صالح' });
    }
    const course = await Course.create({
      title: { ar: cleanTitleAr, en: String(titleEn || cleanTitleAr).trim() },
      description: { ar: String(descAr || cleanTitleAr).trim(), en: String(descEn || titleEn || cleanTitleAr).trim() },
      slug: cleanSlug,
      category,
      level,
      price,
      currency: 'USD',
      duration: '3 months',
      durationInHours: 20,
      instructor: instructorId,
      image,
      status,
      programs: Array.isArray(programs) ? programs : [],
      publishedAt: status === 'published' ? new Date() : undefined,
      certificate: { enabled: true },
      stats: { enrolled: 0, rating: { average: 0, count: 0 } },
    });
    await logAdminAction({
      req,
      action: 'course.created',
      entityType: 'course',
      entityId: course._id,
      metadata: { slug: course.slug, status: course.status },
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/courses/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح' });
    }
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });

    const { titleAr, titleEn, descAr, descEn, price, status, image } = req.body;
    if (titleAr) { course.title.ar = titleAr; if (!titleEn) course.title.en = titleAr; }
    if (titleEn) course.title.en = titleEn;
    if (descAr) course.description.ar = descAr;
    if (descEn) course.description.en = descEn;
    if (price != null) course.price = price;
    if (image) course.image = image;
    if (status) {
      course.status = status;
      if (status === 'published' && !course.publishedAt) course.publishedAt = new Date();
    }
    await course.save();
    await logAdminAction({
      req,
      action: 'course.updated',
      entityType: 'course',
      entityId: course._id,
      metadata: { slug: course.slug, status: course.status },
    });
    res.json(course);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/courses/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح' });
    }
    const existingCourse = await Course.findById(req.params.id);
    if (!existingCourse) return res.status(404).json({ error: 'الدورة غير موجودة' });

    const [hasEnrollment, hasPayment] = await Promise.all([
      Enrollment.exists({ course: req.params.id, status: { $in: ['active', 'completed'] } }),
      Payment.exists({ course: req.params.id, status: { $in: ['pending', 'succeeded'] } }),
    ]);
    if (hasEnrollment || hasPayment) {
      await Course.findByIdAndUpdate(req.params.id, { $set: { status: 'archived' } });
      await logAdminAction({
        req,
        action: 'course.archived',
        entityType: 'course',
        entityId: req.params.id,
        metadata: { slug: existingCourse.slug },
      });
      return res.json({
        message: 'تمت أرشفة الدورة بدلاً من الحذف النهائي لوجود طلاب أو مدفوعات مرتبطة بها',
        archived: true,
      });
    }
    await Lesson.deleteMany({ course: req.params.id });
    await Course.findByIdAndDelete(req.params.id);
    await logAdminAction({
      req,
      action: 'course.deleted',
      entityType: 'course',
      entityId: req.params.id,
      metadata: { slug: existingCourse.slug },
    });
    res.json({ message: 'تم حذف الدورة' });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/courses/:id/lessons', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح' });
    }
    const lessons = await Lesson.find({ course: req.params.id }).sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

function isSafeLessonVideoSource(raw) {
  const val = String(raw || '').trim();
  if (!val) return true;
  if (val.startsWith('/uploads/') || val.startsWith('uploads/course-media/')) return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

router.post('/courses/:id/lessons', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح' });
    }
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });

    const {
      titleAr, titleEn, slug, type = 'video', duration = 10,
      videoUrl, youtubeUrl, textAr, textEn, order, isPublished = true,
    } = req.body;

    const cleanTitleAr = String(titleAr || '').trim();
    if (!cleanTitleAr) {
      return res.status(400).json({ error: 'عنوان الدرس مطلوب' });
    }

    const count = await Lesson.countDocuments({ course: course._id });
    const videoSrc = String(videoUrl || youtubeUrl || '').trim();
    if (type === 'video' && videoSrc && !isSafeLessonVideoSource(videoSrc)) {
      return res.status(400).json({ error: 'رابط الفيديو غير آمن. استخدم رابط HTTPS صالح أو ملف الدورة المرفوع' });
    }
    const provider = youtubeUrl || videoSrc.includes('youtube') ? 'youtube' : 'self-hosted';

    const lesson = await Lesson.create({
      title: { ar: cleanTitleAr, en: String(titleEn || cleanTitleAr).trim() },
      slug: String(slug || `lesson-${count + 1}`).trim().toLowerCase(),
      course: course._id,
      order: order ?? count + 1,
      type,
      duration,
      isPublished,
      publishedAt: isPublished ? new Date() : undefined,
      content: type === 'video'
        ? { video: { url: videoSrc, provider, duration: duration * 60 } }
        : { text: { ar: textAr || '', en: textEn || '' } },
    });

    course.lessons.push(lesson._id);
    await course.save();
    await logAdminAction({
      req,
      action: 'lesson.created',
      entityType: 'lesson',
      entityId: lesson._id,
      metadata: { courseId: String(course._id), type },
    });
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/lessons/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدرس غير صالح' });
    }
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });

    const { titleAr, titleEn, videoUrl, textAr, isPublished, order } = req.body;
    if (titleAr) lesson.title.ar = titleAr;
    if (titleEn) lesson.title.en = titleEn;
    if (order != null) lesson.order = order;
    if (isPublished != null) {
      lesson.isPublished = isPublished;
      if (isPublished) lesson.publishedAt = new Date();
    }
    if (videoUrl && lesson.type === 'video') {
      if (!isSafeLessonVideoSource(videoUrl)) {
        return res.status(400).json({ error: 'رابط الفيديو غير آمن. استخدم رابط HTTPS صالح أو ملف الدورة المرفوع' });
      }
      lesson.content.video = { ...lesson.content.video, url: String(videoUrl).trim() };
    }
    if (textAr && lesson.type === 'text') {
      lesson.content.text = { ...lesson.content.text, ar: textAr };
    }
    await lesson.save();
    await logAdminAction({
      req,
      action: 'lesson.updated',
      entityType: 'lesson',
      entityId: lesson._id,
      metadata: { courseId: String(lesson.course || '') },
    });
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/lessons/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدرس غير صالح' });
    }
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    await Course.updateOne({ _id: lesson.course }, { $pull: { lessons: lesson._id } });
    await logAdminAction({
      req,
      action: 'lesson.deleted',
      entityType: 'lesson',
      entityId: lesson._id,
      metadata: { courseId: String(lesson.course || '') },
    });
    res.json({ message: 'تم حذف الدرس' });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/blog', protect, authorize('admin'), async (req, res) => {
  try {
    const posts = await Blog.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/blog', protect, authorize('admin'), async (req, res) => {
  try {
    const { slug, titleAr, titleEn, excerptAr, contentAr, coverImage, category, status = 'published' } = req.body;
    const cleanTitleAr = String(titleAr || '').trim();
    const cleanSlug = String(slug || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanTitleAr || !cleanSlug) {
      return res.status(400).json({ error: 'العنوان والرابط مطلوبان' });
    }
    let authorName = req.user.name;
    if (!authorName) {
      const adminUser = await User.findById(req.user.id).select('name').lean();
      authorName = adminUser?.name || 'إدارة الأكاديمية';
    }
    const post = await Blog.create({
      slug: cleanSlug,
      title: { ar: cleanTitleAr, en: String(titleEn || cleanTitleAr).trim() },
      excerpt: { ar: excerptAr || '', en: excerptAr || '' },
      content: { ar: contentAr || '', en: contentAr || '' },
      coverImage: coverImage || '',
      category: category || 'general',
      author: req.user.id,
      authorName,
      status,
    });
    await logAdminAction({
      req,
      action: 'blog.created',
      entityType: 'blog',
      entityId: post._id,
      metadata: { slug: post.slug, status: post.status },
    });
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/blog/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف المقال غير صالح' });
    }
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'المقال غير موجود' });
    const { titleAr, titleEn, contentAr, excerptAr, status, featured, coverImage } = req.body;
    if (titleAr) post.title.ar = titleAr;
    if (titleEn) post.title.en = titleEn;
    if (contentAr) post.content.ar = contentAr;
    if (excerptAr) post.excerpt.ar = excerptAr;
    if (status) post.status = status;
    if (featured != null) post.featured = featured;
    if (coverImage) post.coverImage = coverImage;
    await post.save();
    await logAdminAction({
      req,
      action: 'blog.updated',
      entityType: 'blog',
      entityId: post._id,
      metadata: { slug: post.slug, status: post.status },
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/blog/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف المقال غير صالح' });
    }
    const post = await Blog.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'المقال غير موجود' });
    await logAdminAction({
      req,
      action: 'blog.deleted',
      entityType: 'blog',
      entityId: post._id,
      metadata: { slug: post.slug },
    });
    res.json({ message: 'تم حذف المقال' });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/withdrawals', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected() && process.env.FORCE_REAL_FINANCE_IN_TEST !== 'true') {
    return res.json({ withdrawals: [] });
  }
  try {
    const rawStatus = String(req.query.status || 'pending').trim();
    const mappedStatus = rawStatus === 'approved' ? 'completed' : rawStatus;
    const filter = {
      type: 'payout',
      ...(mappedStatus === 'all' ? {} : { status: mappedStatus }),
    };
    const entries = await TeacherLedger.find(filter)
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email' } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const withdrawals = entries.map((entry) => ({
      ...entry,
      method: entry.payoutMethod === 'bank_transfer' ? 'bank' : entry.payoutMethod,
      accountInfo: entry.payoutDetails?.phone
        || entry.payoutDetails?.ipaAddress
        || entry.payoutDetails?.bankAccountNumber
        || entry.payoutDetails?.paypalEmail
        || '',
      status: entry.status === 'completed' ? 'approved' : entry.status,
      adminNote: entry.notes || '',
    }));
    res.json({ withdrawals });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.patch('/withdrawals/:id', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected() && process.env.FORCE_REAL_FINANCE_IN_TEST !== 'true') {
    return res.json({
      success: true,
      withdrawal: {
        _id: req.params.id,
        status: req.body.action === 'approve' ? 'approved' : 'rejected',
        adminNote: req.body.adminNote || ''
      }
    });
  }
  try {
    const { action, adminNote, referenceNumber, receiptUrl } = req.body || {};
    const targetStatus = action === 'approve'
      ? 'completed'
      : action === 'reject'
        ? 'rejected'
        : action === 'processing'
          ? 'processing'
          : null;
    if (!targetStatus) {
      return res.status(400).json({ error: 'action يجب أن يكون approve أو reject' });
    }

    const payout = await processTeacherPayout({
      payoutId: req.params.id,
      targetStatus,
      adminUserId: req.user.id,
      referenceNumber,
      receiptUrl,
      notes: adminNote,
    });

    await logAdminAction({
      req,
      action: 'payout_processed',
      entityType: 'TeacherLedger',
      entityId: payout._id,
      reason: String(adminNote || '').trim().slice(0, 500) || `معالجة سحب أرباح (${targetStatus})`,
      metadata: {
        status: targetStatus,
        amount: payout.amount,
        currency: payout.currency,
        teacherId: payout.teacher?._id || payout.teacher,
        payoutMethod: payout.payoutMethod,
        referenceNumber: payout.referenceNumber,
      },
    }).catch(() => {});

    res.json({
      success: true,
      withdrawal: {
        _id: payout._id,
        teacher: payout.teacher,
        amount: payout.amount,
        currency: payout.currency,
        method: payout.payoutMethod === 'bank_transfer' ? 'bank' : payout.payoutMethod,
        status: payout.status === 'completed' ? 'approved' : payout.status,
        adminNote: payout.notes || '',
        referenceNumber: payout.referenceNumber || '',
      },
      payout,
    });
  } catch (error) {
    const status = error?.status || 400;
    res.status(status).json({
      error: error?.publicMessage || safeErrorMessage(error, status),
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

module.exports = router;
