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
const LiveSession = require('../models/LiveSession');
const Review = require('../models/Review');
const AdminAuditLog = require('../models/AdminAuditLog');
const { protect, authorize } = require('../middleware/auth');
const objectStorage = require('../services/objectStorage');
const { logAdminAction } = require('../services/adminAudit');
const { sessionParticipantWindow } = require('../services/sessionAccess');
const meetingService = require('../services/meetingService');
const { notifyUser, notifySessionAccepted } = require('../utils/notify');
const {
  calculateSessionEarning,
  ensureSessionEarning,
  processTeacherPayout,
} = require('../services/teacherFinance');
const { settleSubscriptionUsageForSession } = require('../services/subscriptionUsage');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
const { normalizePhone, syntheticPhoneEmail } = require('../utils/phone');

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
  findMockUserByPhone,
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

function buildMissingReportMongoFilter() {
  return {
    status: 'completed',
    $and: [
      {
        $or: [
          { studentReports: { $exists: false } },
          { studentReports: { $size: 0 } },
        ],
      },
      {
        $or: [
          { type: 'group_circle' },
          {
            'teacherEvaluation.memorization': { $exists: false },
            'teacherEvaluation.tajweed': { $exists: false },
            'teacherEvaluation.overallNotes': { $in: [null, ''] },
            'teacherEvaluation.surahRecited': { $in: [null, ''] },
            'teacherEvaluation.recommendedLevel': { $exists: false },
          },
        ],
      },
    ],
  };
}

function hasSessionTeacherReport(session) {
  if (!session) return false;
  if (Array.isArray(session.studentReports) && session.studentReports.length > 0) {
    return true;
  }
  if (session.type === 'group_circle') {
    return false;
  }
  const ev = session.teacherEvaluation;
  if (!ev || typeof ev !== 'object') return false;
  return Boolean(
    ev.memorization != null ||
    ev.tajweed != null ||
    ev.attendance != null ||
    ev.behavior != null ||
    ev.commitment != null ||
    (typeof ev.surahRecited === 'string' && ev.surahRecited.trim()) ||
    (typeof ev.overallNotes === 'string' && ev.overallNotes.trim()) ||
    (typeof ev.nextHomework === 'string' && ev.nextHomework.trim()) ||
    ev.recommendedLevel ||
    ev.recommendedTrack ||
    (Array.isArray(ev.assignedHomework) && ev.assignedHomework.length > 0)
  );
}

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
      Session.countDocuments(buildMissingReportMongoFilter()),
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
    return res.json({
      focus,
      count: 0,
      summary: {
        liveCount: 0,
        todayTotal: 0,
        todayCompleted: 0,
        overdueCount: 0,
        pendingCount: 0,
        missingReportsCount: 0,
        avgRating: 0,
        ratedCount: 0,
      },
      sessions: [],
    });
  }
  try {
    const now = new Date();
    const allowedFocuses = new Set(['all', 'live', 'today', 'overdue', 'pending', 'missing-reports']);
    const focus = String(req.query.focus || 'all').trim();
    if (!allowedFocuses.has(focus)) {
      return res.status(400).json({ error: 'Invalid session control focus' });
    }

    const typeFilter = String(req.query.type || 'all').trim();
    const statusFilter = String(req.query.status || 'all').trim();
    const searchQuery = String(req.query.q || '').trim().slice(0, 120);
    const limitNum = Math.min(200, Math.max(20, Number.parseInt(req.query.limit, 10) || 150));

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const canQueryAuxModels =
      Boolean(mongoose.connection?.db) ||
      LiveSession.find !== mongoose.Model.find;

    // Discover actively live room session IDs first (fast indexed query)
    let activeLiveDocs = [];
    if (canQueryAuxModels) {
      activeLiveDocs = await LiveSession.find({
        isLive: true,
        endedAt: null,
        session: { $ne: null },
      })
        .select('session roomId isLive endedAt classroomState updatedAt')
        .lean()
        .catch(() => []);
    }
    const activeLiveSessionIds = activeLiveDocs
      .filter((ls) => !ls?.classroomState?.controls?.sessionEnded && ls?.session)
      .map((ls) => ls.session);

    const filter = {};
    if (focus === 'overdue') {
      Object.assign(filter, { status: 'accepted', scheduledAt: { $lt: now } });
    } else if (focus === 'pending') {
      filter.status = 'pending';
    } else if (focus === 'today') {
      filter.scheduledAt = { $gte: startOfToday, $lt: endOfToday };
    } else if (focus === 'live') {
      const windowLookback = new Date(now.getTime() - 120 * 60 * 1000);
      const windowLookahead = new Date(now.getTime() + 30 * 60 * 1000);
      filter.$or = [
        ...(activeLiveSessionIds.length ? [{ _id: { $in: activeLiveSessionIds } }] : []),
        {
          status: 'accepted',
          scheduledAt: { $gte: windowLookback, $lte: windowLookahead },
        },
      ];
    } else if (focus === 'missing-reports') {
      Object.assign(filter, buildMissingReportMongoFilter());
    }

    if (typeFilter !== 'all' && ['trial', 'regular', 'group_circle', 'assessment'].includes(typeFilter)) {
      filter.type = typeFilter;
    }
    if (
      statusFilter !== 'all' &&
      ['pending', 'accepted', 'completed', 'cancelled', 'rejected', 'no-show'].includes(statusFilter)
    ) {
      filter.status = statusFilter;
    }

    const [
      sessions,
      todayTotal,
      todayCompleted,
      overdueCount,
      pendingCount,
      missingReportsCount,
    ] = await Promise.all([
      Session.find(filter)
        .populate('student', 'name email phone avatar')
        .populate({
          path: 'teacher',
          select: 'personalInfo.fullName user media.profilePhoto hourlyRate',
          populate: { path: 'user', select: 'name email avatar' },
        })
        .populate('circle', 'name code')
        .populate('attendance.student', 'name email avatar')
        .sort({ scheduledAt: ['overdue', 'pending', 'today', 'live'].includes(focus) ? 1 : -1 })
        .limit(limitNum)
        .lean(),
      Session.countDocuments({ scheduledAt: { $gte: startOfToday, $lt: endOfToday } }),
      Session.countDocuments({
        scheduledAt: { $gte: startOfToday, $lt: endOfToday },
        status: 'completed',
      }),
      Session.countDocuments({ status: 'accepted', scheduledAt: { $lt: now } }),
      Session.countDocuments({ status: 'pending' }),
      Session.countDocuments(buildMissingReportMongoFilter()),
    ]);

    const sessionIds = sessions.map((s) => s._id).filter(Boolean);
    const [liveDocs, reviewDocs] =
      sessionIds.length > 0 && canQueryAuxModels
        ? await Promise.all([
            LiveSession.find({ session: { $in: sessionIds } })
              .select('session roomId isLive endedAt classroomState updatedAt')
              .lean()
              .catch(() => []),
            Review.find({ session: { $in: sessionIds } })
              .select('session student rating comment createdAt')
              .lean()
              .catch(() => []),
          ])
        : [[], []];

    const liveBySessionId = new Map(liveDocs.map((ls) => [String(ls.session), ls]));
    const reviewsBySessionId = new Map();
    for (const rev of reviewDocs) {
      const key = String(rev.session);
      if (!reviewsBySessionId.has(key)) reviewsBySessionId.set(key, []);
      reviewsBySessionId.get(key).push(rev);
    }

    let ratingSumAll = 0;
    let ratedSessionsCount = 0;

    let rows = sessions.map((session) => {
      const sid = String(session._id);
      const liveDoc = liveBySessionId.get(sid) || null;
      const roomEnded = Boolean(liveDoc?.endedAt || liveDoc?.classroomState?.controls?.sessionEnded);
      const isActivelyLive = Boolean(liveDoc?.isLive && !roomEnded && session.status === 'accepted');
      const win = sessionParticipantWindow(session);
      const canObserveLive = Boolean(
        session.status === 'accepted' && !roomEnded && (isActivelyLive || win.within)
      );

      const attendanceList = Array.isArray(session.attendance) ? session.attendance : [];
      const attendanceSummary = {
        total: attendanceList.length,
        attended: attendanceList.filter((e) => e?.status === 'attended').length,
        absent: attendanceList.filter((e) => e?.status === 'absent').length,
        excused: attendanceList.filter((e) => e?.status === 'excused').length,
        unresolved: attendanceList.filter((e) =>
          ['pending', 'confirmed'].includes(String(e?.status || 'pending'))
        ).length,
      };

      const hasReport = hasSessionTeacherReport(session);
      const reportCount =
        (session.studentReports || []).length || (hasReport ? 1 : 0);

      // Combine Review collection + Session inline studentFeedback/studentFeedbacks
      const revs = reviewsBySessionId.get(sid) || [];
      let ratingAvg = 0;
      let ratingCount = 0;
      let primaryComment = '';
      let wouldContinue = null;

      if (revs.length > 0) {
        ratingCount = revs.length;
        ratingAvg =
          Math.round((revs.reduce((acc, r) => acc + Number(r.rating || 0), 0) / revs.length) * 10) / 10;
        primaryComment = revs.find((r) => r.comment)?.comment || '';
      } else if (session.type === 'group_circle' && Array.isArray(session.studentFeedbacks) && session.studentFeedbacks.length > 0) {
        ratingCount = session.studentFeedbacks.length;
        ratingAvg =
          Math.round(
            (session.studentFeedbacks.reduce((acc, f) => acc + Number(f.rating || 0), 0) / ratingCount) * 10
          ) / 10;
        primaryComment = session.studentFeedbacks.find((f) => f.comment)?.comment || '';
      } else if (session.studentFeedback?.rating) {
        ratingCount = 1;
        ratingAvg = Number(session.studentFeedback.rating);
        primaryComment = session.studentFeedback.comment || '';
      }

      if (session.studentFeedback && typeof session.studentFeedback.wouldContinue === 'boolean') {
        wouldContinue = session.studentFeedback.wouldContinue;
      } else if (Array.isArray(session.studentFeedbacks) && session.studentFeedbacks.length > 0) {
        const cont = session.studentFeedbacks.find((f) => typeof f.wouldContinue === 'boolean');
        if (cont) wouldContinue = cont.wouldContinue;
      }

      if (ratingCount > 0 && ratingAvg > 0) {
        ratingSumAll += ratingAvg;
        ratedSessionsCount += 1;
      }

      const ev = session.teacherEvaluation || null;
      const teacherEvaluationSummary = hasReport && ev
        ? {
            memorization: ev.memorization ?? null,
            tajweed: ev.tajweed ?? null,
            attendance: ev.attendance ?? null,
            surahRecited: ev.surahRecited || '',
            fromAyah: ev.fromAyah ?? null,
            toAyah: ev.toAyah ?? null,
            nextHomework: ev.nextHomework || '',
            overallNotes: ev.overallNotes || '',
            recommendedLevel: ev.recommendedLevel || '',
            recommendedTrack: ev.recommendedTrack || '',
          }
        : null;

      return {
        _id: session._id,
        shortCode: `#${sid.slice(-4).toUpperCase()}`,
        type: session.type || 'regular',
        status: session.status,
        scheduledAt: session.scheduledAt,
        duration: session.duration || 60,
        timezone: session.timezone || 'Africa/Cairo',
        student: session.student
          ? {
              _id: session.student._id,
              name: session.student.name,
              email: session.student.email,
              phone: session.student.phone,
              avatar: session.student.avatar,
            }
          : null,
        teacher: session.teacher
          ? {
              _id: session.teacher._id,
              userId: session.teacher.user?._id || session.teacher.user || null,
              name: session.teacher.user?.name || session.teacher.personalInfo?.fullName || 'معلم',
              email: session.teacher.user?.email || '',
              avatar: session.teacher.media?.profilePhoto || session.teacher.user?.avatar || '',
            }
          : null,
        circle: session.circle ? { _id: session.circle._id, name: session.circle.name, code: session.circle.code || '' } : null,
        attendance: attendanceList.map((entry) => ({
          studentId: entry?.student?._id || entry?.student || null,
          studentName: entry?.student?.name || 'طالب',
          studentEmail: entry?.student?.email || '',
          status: entry?.status || 'pending',
          excuseReason: entry?.excuseReason || '',
          eligibleForCompensation: Boolean(entry?.eligibleForCompensation),
        })),
        attendanceCount: attendanceList.length,
        attendanceSummary,
        hasTeacherReport: hasReport,
        reportCount,
        teacherEvaluation: teacherEvaluationSummary,
        studentRating:
          ratingCount > 0
            ? {
                count: ratingCount,
                average: ratingAvg,
                comment: primaryComment,
                wouldContinue,
              }
            : null,
        liveRoom: {
          provisioned: Boolean(liveDoc),
          roomId: liveDoc?.roomId || session.roomId || sid,
          isLive: isActivelyLive,
          sessionEnded: roomEnded,
          mushafPage: liveDoc?.classroomState?.mushaf?.page || null,
          totalStars: liveDoc?.classroomState?.engagement?.totalStars || 0,
          endedAt: liveDoc?.endedAt || null,
        },
        canObserveLive,
        joinWindowPhase: !win.valid
          ? 'invalid'
          : now.getTime() < win.opensAt.getTime()
            ? 'early'
            : now.getTime() > win.closesAt.getTime()
              ? 'expired'
              : 'open',
        meetingAvailable: Boolean(session.meetingLink),
        roomId: liveDoc?.roomId || session.roomId || sid,
        recordingAvailable: Boolean(session.recordingUrl),
        financial: {
          amount: Number(session.earnings?.amount || 0),
          status: session.earnings?.status || 'pending',
          agreedHourlyRate: session.agreedHourlyRate ?? session.teacher?.hourlyRate ?? null,
        },
        cancellationReason: session.cancellationReason || '',
        notes: session.notes || '',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });

    if (focus === 'live') {
      rows = rows.filter((r) => r.liveRoom.isLive || r.canObserveLive);
    }

    if (searchQuery) {
      const needle = searchQuery.toLowerCase().replace(/^#/, '');
      rows = rows.filter((r) => {
        const hay = [
          String(r._id),
          r.shortCode,
          r.student?.name,
          r.student?.email,
          r.student?.phone,
          r.teacher?.name,
          r.teacher?.email,
          r.circle?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    await logAdminAction({
      req,
      action: 'session-control.viewed',
      entityType: 'session-control',
      entityId: focus,
      reason: `Admin opened session control: ${focus}`,
      metadata: { focus, resultCount: rows.length },
    }).catch(() => {});

    return res.json({
      focus,
      count: rows.length,
      summary: {
        liveCount: activeLiveSessionIds.length,
        todayTotal,
        todayCompleted,
        overdueCount,
        pendingCount,
        missingReportsCount,
        avgRating: ratedSessionsCount > 0 ? Math.round((ratingSumAll / ratedSessionsCount) * 10) / 10 : 0,
        ratedCount: ratedSessionsCount,
      },
      sessions: rows,
    });
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
    if (!['accepted', 'completed', 'cancelled', 'no-show'].includes(status)) {
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

    if (status === 'accepted') {
      if (session.status !== 'pending') {
        return res.status(409).json({
          error: 'يمكن تأكيد الحصص المعلقة فقط',
          code: 'SESSION_NOT_PENDING',
        });
      }
      session.status = 'accepted';
      if (!session.meetingLink) {
        meetingService.attachToSession(session);
      }
      await session.save();
      if (Boolean(mongoose.connection?.db) && session.student) {
        notifySessionAccepted(session, session.student).catch(() => {});
      }
    } else if (status === 'completed') {
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

    // Close any open LiveSession room when admin finalizes a session
    if (['completed', 'cancelled', 'no-show'].includes(status) && Boolean(mongoose.connection?.db)) {
      try {
        const ls = await LiveSession.findOne({ session: session._id });
        if (ls && (ls.isLive || !ls.endedAt)) {
          const { applyHostStatePatch } = require('../services/classroomStateService');
          ls.isLive = false;
          ls.endedAt = ls.endedAt || new Date();
          ls.classroomState = applyHostStatePatch(ls.classroomState, {
            controls: { sessionEnded: true, endedAtMs: Date.now() },
          });
          if (typeof ls.markModified === 'function') ls.markModified('classroomState');
          await ls.save();
        }
      } catch {
        // non-blocking
      }
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

router.post('/session-control/:id/nudge-teacher', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }
    const session = await Session.findById(req.params.id)
      .populate('teacher', 'user personalInfo.fullName')
      .populate('student', 'name')
      .populate('circle', 'name')
      .lean();
    if (!session) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }
    const teacherUserId = session.teacher?.user?._id || session.teacher?.user;
    if (!teacherUserId) {
      return res.status(400).json({ error: 'لا يوجد حساب معلم مرتبط بهذه الحصة' });
    }

    const learnerLabel = session.circle?.name || session.student?.name || 'الطالب';
    const customNote = String(req.body?.note || '').trim().slice(0, 300);
    const titleAr =
      session.status === 'pending'
        ? 'تذكير إداري: تأكيد موعد حصة معلّقة'
        : session.status === 'accepted'
          ? 'تذكير إداري: إغلاق الحصة ورصد التقييم'
          : 'تذكير إداري: استكمال التقرير التربوي للحصة';
    const msgAr =
      customNote ||
      (session.status === 'pending'
        ? `يرجى مراجعة وتأكيد حصة (${learnerLabel}) المعلقة في أقرب وقت.`
        : `يرجى استكمال إجراءات الإغلاق والتقييم التربوي لحصة (${learnerLabel}).`);

    const Notification = require('../models/Notification');
    if (Boolean(mongoose.connection?.db) || Notification.create !== mongoose.Model.create) {
      await notifyUser(teacherUserId, {
        type: 'system',
        title: { ar: titleAr, en: 'Admin Reminder: Session Follow-up' },
        message: { ar: msgAr, en: msgAr },
        data: {
          session: session._id,
          actionUrl: `/teacher/dashboard?tab=sessions&evaluate=${session._id}`,
        },
        priority: 'high',
      }).catch(() => {});
    }

    await logAdminAction({
      req,
      action: 'session-control.nudge-teacher',
      entityType: 'session',
      entityId: String(session._id),
      reason: msgAr.slice(0, 200),
      metadata: { status: session.status, teacherId: String(session.teacher?._id || '') },
    }).catch(() => {});

    return res.json({ success: true, message: 'تم إرسال التذكير الفوري للمعلم بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
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

router.get('/teachers/directory', protect, authorize('admin'), async (req, res) => {
  try {
    const requestedStatus = String(req.query.status || 'approved').trim();
    const gender = ['male', 'female'].includes(req.query.gender) ? req.query.gender : 'all';
    const visibility = ['public', 'hidden'].includes(req.query.visibility) ? req.query.visibility : 'all';
    const q = String(req.query.q || '').trim().slice(0, 120);
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(60, Number.parseInt(req.query.limit, 10) || 24));

    if (isMockMode && !isDBConnected()) {
      const allTeachers = getMockTeachers().map((t) => ({
        ...t,
        user: findMockUserById(t.user?._id || t.user) || { _id: t.user, name: t.personalInfo?.fullName || 'معلم', email: '' },
      }));
      const counts = {
        approved: allTeachers.filter((t) => t.status === 'approved').length,
        pendingReview: allTeachers.filter((t) => ['pending', 'under-review'].includes(t.status)).length,
        suspended: allTeachers.filter((t) => t.status === 'suspended').length,
        rejected: allTeachers.filter((t) => t.status === 'rejected').length,
      };
      const filtered = allTeachers.filter((t) => {
        if (requestedStatus === 'approved' && t.status !== 'approved') return false;
        if (requestedStatus === 'pending' && !['pending', 'under-review'].includes(t.status)) return false;
        if (requestedStatus === 'archived' && !['suspended', 'rejected'].includes(t.status)) return false;
        if (['suspended', 'rejected', 'under-review'].includes(requestedStatus) && t.status !== requestedStatus) return false;
        if (gender !== 'all' && t.personalInfo?.gender !== gender) return false;
        if (visibility === 'public' && t.isPublic === false) return false;
        if (visibility === 'hidden' && t.isPublic !== false) return false;
        if (q) {
          const lower = q.toLowerCase();
          return [t.personalInfo?.fullName, t.user?.name, t.user?.email, t.personalInfo?.country, t.personalInfo?.city]
            .some((val) => String(val || '').toLowerCase().includes(lower));
        }
        return true;
      });
      const total = filtered.length;
      const teachers = filtered.slice((page - 1) * limit, page * limit).map((t) => ({
        ...t,
        operationalMetrics: {
          activeCirclesCount: 0,
          enrolledStudentsCount: 0,
          lockedSubscriptionsCount: 0,
          pendingSessionsCount: 0,
          overdueSessionsCount: 0,
          missingReportsCount: 0,
        },
      }));
      return res.json({
        teachers,
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
        counts,
      });
    }

    const filter = {};
    if (requestedStatus === 'approved') {
      filter.status = 'approved';
      filter.isVerified = true;
    } else if (requestedStatus === 'pending') {
      filter.status = { $in: ['pending', 'under-review'] };
    } else if (requestedStatus === 'archived') {
      filter.status = { $in: ['suspended', 'rejected'] };
    } else if (['suspended', 'rejected', 'under-review'].includes(requestedStatus)) {
      filter.status = requestedStatus;
    }

    if (gender !== 'all') {
      filter['personalInfo.gender'] = gender;
    }
    if (visibility === 'public') {
      filter.isPublic = { $ne: false };
    } else if (visibility === 'hidden') {
      filter.isPublic = false;
    }

    if (q) {
      const escaped = q.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const matchedUsers = await User.find({
        role: 'teacher',
        $or: [{ name: regex }, { email: regex }, { phone: regex }],
      }).select('_id').limit(100).lean();
      const matchedUserIds = matchedUsers.map((u) => u._id);
      filter.$or = [
        { 'personalInfo.fullName': regex },
        { 'personalInfo.country': regex },
        { 'personalInfo.city': regex },
        { 'personalInfo.phone': regex },
        ...(matchedUserIds.length ? [{ user: { $in: matchedUserIds } }] : []),
        ...(mongoose.Types.ObjectId.isValid(q) ? [{ _id: q }] : []),
      ];
    }

    const [
      rawTeachers,
      total,
      approvedCount,
      pendingReviewCount,
      suspendedCount,
      rejectedCount,
    ] = await Promise.all([
      Teacher.find(filter)
        .select('-documents -storageOwner')
        .populate('user', 'name email phone avatar isActive lastLogin')
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Teacher.countDocuments(filter),
      Teacher.countDocuments({ status: 'approved', isVerified: true }),
      Teacher.countDocuments({ status: { $in: ['pending', 'under-review'] } }),
      Teacher.countDocuments({ status: 'suspended' }),
      Teacher.countDocuments({ status: 'rejected' }),
    ]);

    const teacherIds = rawTeachers.map((t) => t._id);
    const now = new Date();
    const canAggregate = Boolean(mongoose.connection?.db) || GroupCircle.aggregate !== mongoose.Model.aggregate;

    const [circleAgg, subAgg, pendingSessAgg, overdueSessAgg, missingReportAgg] = teacherIds.length && canAggregate
      ? await Promise.all([
          GroupCircle.aggregate([
            { $match: { teacher: { $in: teacherIds }, status: { $nin: ['completed', 'cancelled'] } } },
            {
              $group: {
                _id: '$teacher',
                circlesCount: { $sum: 1 },
                studentsCount: { $sum: { $size: { $ifNull: ['$students', []] } } },
              },
            },
          ]).catch(() => []),
          StudentSubscription.aggregate([
            {
              $match: {
                preferredTeacher: { $in: teacherIds },
                status: { $in: ['awaiting_placement', 'placed', 'active', 'paused'] },
              },
            },
            { $group: { _id: '$preferredTeacher', count: { $sum: 1 } } },
          ]).catch(() => []),
          Session.aggregate([
            { $match: { teacher: { $in: teacherIds }, status: 'pending' } },
            { $group: { _id: '$teacher', count: { $sum: 1 } } },
          ]).catch(() => []),
          Session.aggregate([
            { $match: { teacher: { $in: teacherIds }, status: 'accepted', scheduledAt: { $lt: now } } },
            { $group: { _id: '$teacher', count: { $sum: 1 } } },
          ]).catch(() => []),
          Session.aggregate([
            { $match: { teacher: { $in: teacherIds }, ...buildMissingReportMongoFilter() } },
            { $group: { _id: '$teacher', count: { $sum: 1 } } },
          ]).catch(() => []),
        ])
      : [[], [], [], [], []];

    const circleMap = new Map(circleAgg.map((r) => [String(r._id), r]));
    const subMap = new Map(subAgg.map((r) => [String(r._id), r.count]));
    const pendingSessMap = new Map(pendingSessAgg.map((r) => [String(r._id), r.count]));
    const overdueSessMap = new Map(overdueSessAgg.map((r) => [String(r._id), r.count]));
    const missingRepMap = new Map(missingReportAgg.map((r) => [String(r._id), r.count]));

    const teachers = rawTeachers.map((t) => {
      const tid = String(t._id);
      const circleStats = circleMap.get(tid);
      return {
        ...t,
        operationalMetrics: {
          activeCirclesCount: circleStats?.circlesCount || 0,
          enrolledStudentsCount: circleStats?.studentsCount || 0,
          lockedSubscriptionsCount: subMap.get(tid) || 0,
          pendingSessionsCount: pendingSessMap.get(tid) || 0,
          overdueSessionsCount: overdueSessMap.get(tid) || 0,
          missingReportsCount: missingRepMap.get(tid) || 0,
        },
      };
    });

    return res.json({
      teachers,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: {
        approved: approvedCount,
        pendingReview: pendingReviewCount,
        suspended: suspendedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/teachers/:id/impact', protect, authorize('admin'), async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockTeacher = findMockTeacherById(req.params.id);
      if (!mockTeacher) return res.status(404).json({ error: 'المعلم غير موجود' });
      const circles = getMockCircles().filter((c) => String(c.teacher) === String(mockTeacher._id) && c.status !== 'completed');
      const compatibleTeachers = getMockTeachers()
        .filter((t) => String(t._id) !== String(mockTeacher._id) && t.status === 'approved' && t.personalInfo?.gender === mockTeacher.personalInfo?.gender)
        .map((t) => ({ _id: t._id, name: t.personalInfo?.fullName || 'معلم', gender: t.personalInfo?.gender }));
      return res.json({
        teacherId: String(mockTeacher._id),
        circles: circles.map((c) => ({ _id: c._id, name: c.name, studentCount: (c.students || []).length, status: c.status })),
        activeCirclesCount: circles.length,
        futureSessionsCount: 0,
        upcomingSessionsCount: 0,
        lockedSubscriptionsCount: getMockSubscriptions().filter((s) => String(s.preferredTeacher) === String(mockTeacher._id)).length,
        replacementTeachers: compatibleTeachers,
        compatibleTeachers,
      });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }
    const teacher = await Teacher.findById(req.params.id).select('personalInfo status isVerified').lean();
    if (!teacher) return res.status(404).json({ error: 'المعلم غير موجود' });

    const [circles, upcomingSessionsCount, lockedSubscriptionsCount, compatibleTeachers] = await Promise.all([
      GroupCircle.find({ teacher: teacher._id, status: { $nin: ['completed', 'cancelled'] } })
        .select('_id name code status gender subscriptionSection students')
        .lean(),
      Session.countDocuments({
        teacher: teacher._id,
        status: { $in: ['pending', 'accepted'] },
        scheduledAt: { $gt: new Date() },
      }),
      StudentSubscription.countDocuments({
        preferredTeacher: teacher._id,
        status: { $nin: ['cancelled', 'expired', 'completed'] },
      }),
      Teacher.find({
        _id: { $ne: teacher._id },
        status: 'approved',
        isVerified: true,
        ...(teacher.personalInfo?.gender ? { 'personalInfo.gender': teacher.personalInfo.gender } : {}),
      })
        .select('_id personalInfo.fullName personalInfo.gender user')
        .populate('user', 'name email')
        .sort({ isFeatured: -1, createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const formattedCompatible = compatibleTeachers.map((t) => ({
      _id: t._id,
      name: t.personalInfo?.fullName || t.user?.name || 'معلم',
      email: t.user?.email || '',
      gender: t.personalInfo?.gender || 'male',
    }));

    return res.json({
      teacherId: String(teacher._id),
      circles: circles.map((c) => ({
        _id: c._id,
        name: c.name,
        code: c.code,
        status: c.status,
        studentCount: Array.isArray(c.students) ? c.students.length : 0,
      })),
      activeCirclesCount: circles.length,
      futureSessionsCount: upcomingSessionsCount,
      upcomingSessionsCount,
      lockedSubscriptionsCount,
      replacementTeachers: formattedCompatible,
      compatibleTeachers: formattedCompatible,
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
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
      hourlyRate = 50, isFeatured = false, isPublic = true, autoApprove = false,
    } = req.body;

    const rawEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    if (rawEmail && (rawEmail.length > 254 || !/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$/.test(rawEmail))) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
    }
    const effectiveEmail = rawEmail || (normalizedPhone ? syntheticPhoneEmail(normalizedPhone, 'teacher') : '');

    if (!name || !effectiveEmail || !password) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف (أو البريد الإلكتروني) وكلمة المرور مطلوبة' });
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
      if (findMockUserByEmail(effectiveEmail) || (!rawEmail && normalizedPhone && findMockUserByPhone(normalizedPhone))) {
        return res.status(409).json({ error: 'البريد أو رقم الهاتف مسجل مسبقاً' });
      }
      const mockUser = addMockUser({
        name: String(name).trim(),
        email: effectiveEmail,
        password,
        phone: normalizedPhone || String(phone || '+201000000000').trim(),
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
        isPublic: isPublic !== false,
        languages: normalizedLangs.length ? normalizedLangs : ['arabic'],
      });
      return res.status(201).json({
        user: { id: mockUser._id, name: mockUser.name, email: mockUser.email },
        teacher: { ...mockTeacher, user: mockUser },
        reviewRequired: true,
      });
    }

    const existingTeacherUser = await User.findOne({
      $or: [
        { email: effectiveEmail },
        ...(normalizedPhone ? [{ role: 'teacher', phoneNormalized: normalizedPhone }] : []),
      ],
    });
    if (existingTeacherUser) {
      return res.status(409).json({ error: 'البريد أو رقم الهاتف مسجل مسبقاً' });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: effectiveEmail,
      password,
      phone: normalizedPhone || String(phone || '+201000000000').trim(),
      whatsappPhone: String(whatsapp || phone || '').trim(),
      gender: gender === 'female' ? 'female' : 'male',
      age: Math.min(80, Math.max(18, Number(age) || 30)),
      bio: String(bio || '').trim().slice(0, 500),
      role: 'teacher',
      isActive: true,
      emailVerified: true,
    });

    const uploadedFiles = req.body?.uploadedFiles && typeof req.body.uploadedFiles === 'object'
      ? req.body.uploadedFiles
      : {};
    const resolveAdminUpload = (field, purpose, fallback) => {
      const ref = String(uploadedFiles[field]?.url || uploadedFiles[field]?.pathname || uploadedFiles[field] || '').trim();
      if (!ref) return fallback;
      if (!objectStorage.isOwnedObjectReference(ref, purpose, req.user.id)) {
        const err = new Error('ملف مرفوع غير صالح أو لا يخص جلسة الإدارة الحالية');
        err.status = 400;
        throw err;
      }
      return ref;
    };

    const resolvedProfilePhoto = resolveAdminUpload('profilePhoto', 'teacher-public', PLACEHOLDER);
    const resolvedRecitationVideo = resolveAdminUpload('recitationVideo', 'teacher-public', PLACEHOLDER);
    const resolvedIntroVideo = resolveAdminUpload('introductionVideo', 'teacher-public', '');
    const resolvedMethodVideo = resolveAdminUpload('teachingMethodVideo', 'teacher-public', '');
    const resolvedIdFront = resolveAdminUpload('idCardFront', 'teacher-private', 'not-provided');
    const resolvedIdBack = resolveAdminUpload('idCardBack', 'teacher-private', 'not-provided');
    const hasAdminExternalAsset = [
      resolvedProfilePhoto,
      resolvedRecitationVideo,
      resolvedIntroVideo,
      resolvedMethodVideo,
      resolvedIdFront,
      resolvedIdBack,
    ].some((v) => v && v !== PLACEHOLDER && v !== 'not-provided');

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
      documents: {
        idCard: resolvedIdFront !== 'not-provided' ? resolvedIdFront : PLACEHOLDER,
        idCardFront: resolvedIdFront,
        idCardBack: resolvedIdBack,
        graduationCertificate: PLACEHOLDER,
      },
      media: {
        profilePhoto: resolvedProfilePhoto,
        introductionVideo: resolvedIntroVideo,
        recitationVideo: resolvedRecitationVideo,
        teachingMethodVideo: resolvedMethodVideo,
      },
      ...(hasAdminExternalAsset ? { storageOwner: String(req.user.id) } : {}),
      status: 'pending',
      isVerified: false,
      hourlyRate: Math.max(0, Number(hourlyRate ?? 50)),
      isFeatured: Boolean(isFeatured),
      isPublic: isPublic !== false,
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
        hourlyRate, isFeatured, isPublic, gender, status, isVerified,
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
      if (typeof isPublic === 'boolean') mockTeacher.isPublic = isPublic;
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
      hourlyRate, isFeatured, isPublic, gender, status, isVerified,
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
    if (typeof isPublic === 'boolean') teacher.isPublic = isPublic;

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
        const replacementTeacherId = String(req.body?.replacementTeacherId || '').trim();
        if (replacementTeacherId && mongoose.Types.ObjectId.isValid(replacementTeacherId)) {
          if (String(replacementTeacherId) === String(teacher._id)) {
            return res.status(400).json({ error: 'لا يمكن تعيين نفس المعلم الموقوف كبديل' });
          }
          const replacement = await Teacher.findById(replacementTeacherId);
          if (!replacement || replacement.status !== 'approved' || replacement.isVerified !== true) {
            return res.status(409).json({
              error: 'يجب أن يكون المعلم البديل معتمداً وموثقاً قبل نقل الحلقات والطلاب إليه',
              code: 'REPLACEMENT_TEACHER_NOT_APPROVED',
            });
          }
          const activeCircles = await GroupCircle.find({
            teacher: teacher._id,
            status: { $nin: ['completed', 'cancelled'] },
          }).select('gender subscriptionSection');
          for (const circle of activeCircles) {
            try {
              assertGenderAndAgeCompatibility({
                teacher: replacement,
                circleGender: circle.gender,
                section: circle.subscriptionSection,
              });
            } catch (safeguardErr) {
              return res.status(409).json({
                error: safeguardErr.publicMessage || 'جنس المعلم البديل غير متوافق مع إحدى حلقات المعلم',
                code: 'GENDER_SEPARATION_VIOLATION',
              });
            }
          }
          await Promise.all([
            GroupCircle.updateMany(
              { teacher: teacher._id, status: { $nin: ['completed', 'cancelled'] } },
              { $set: { teacher: replacement._id } }
            ),
            Session.updateMany(
              {
                teacher: teacher._id,
                status: { $in: ['pending', 'accepted'] },
                scheduledAt: { $gt: new Date() },
              },
              { $set: { teacher: replacement._id } }
            ),
            StudentSubscription.updateMany(
              {
                preferredTeacher: teacher._id,
                status: { $nin: ['cancelled', 'expired', 'completed'] },
              },
              { $set: { preferredTeacher: replacement._id } }
            ),
          ]);
        } else {
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
      price = 0, priceEgp, compareAtUsd, compareAtEgp,
      instructorId, image = '/courses/default.jpg', status = 'published', programs = [],
    } = req.body;

    const cleanTitleAr = String(titleAr || '').trim();
    const cleanSlug = String(slug || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanTitleAr || !cleanSlug || !instructorId) {
      return res.status(400).json({ error: 'العنوان والرابط والمعلم مطلوبة' });
    }
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({ error: 'معرف المعلم غير صالح' });
    }

    const { buildRegionalCoursePrices } = require('../config/coursePricing');
    const { regionalPrices, compareAtPrices } = buildRegionalCoursePrices({
      priceUsd: price,
      priceEgp,
      compareAtUsd,
      compareAtEgp,
    });

    const course = await Course.create({
      title: { ar: cleanTitleAr, en: String(titleEn || cleanTitleAr).trim() },
      description: { ar: String(descAr || cleanTitleAr).trim(), en: String(descEn || titleEn || cleanTitleAr).trim() },
      slug: cleanSlug,
      category,
      level,
      price: Math.max(0, Number(price || 0)),
      currency: 'USD',
      ...(regionalPrices ? { regionalPrices } : {}),
      ...(compareAtPrices ? { compareAtPrices } : {}),
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

router.post('/courses/seed-official-catalog', protect, authorize('admin'), async (req, res) => {
  try {
    const requestedInstructorId = req.body?.instructorId;
    let instructor = null;
    if (requestedInstructorId && mongoose.Types.ObjectId.isValid(String(requestedInstructorId))) {
      instructor = await Teacher.findOne({ _id: requestedInstructorId, status: 'approved' }).select('_id');
    }
    if (!instructor) {
      instructor = await Teacher.findOne({ status: 'approved' }).sort({ isFeatured: -1, createdAt: 1 }).select('_id');
    }
    if (!instructor) {
      return res.status(400).json({
        error: 'يجب اعتماد معلم واحد على الأقل قبل نشر كتالوج الدورات الرسمي',
        code: 'APPROVED_INSTRUCTOR_REQUIRED',
      });
    }

    const { OFFICIAL_ACADEMY_COURSES } = require('../config/coursePricing');
    let createdCount = 0;
    let updatedCount = 0;

    for (const spec of OFFICIAL_ACADEMY_COURSES) {
      let course = await Course.findOne({ slug: spec.slug });
      if (!course) {
        course = await Course.create({
          title: spec.title,
          description: spec.description,
          slug: spec.slug,
          category: spec.category,
          programs: [...spec.programs],
          level: spec.level,
          price: spec.price,
          currency: spec.currency,
          regionalPrices: spec.regionalPrices ? { ...spec.regionalPrices } : undefined,
          compareAtPrices: spec.compareAtPrices ? { ...spec.compareAtPrices } : undefined,
          duration: spec.duration,
          durationInHours: spec.durationInHours,
          instructor: instructor._id,
          image: spec.image,
          learningOutcomes: spec.learningOutcomes,
          status: 'published',
          publishedAt: new Date(),
          certificate: { enabled: true },
          stats: { enrolled: 0, completed: 0, rating: { average: 0, count: 0 } },
        });
        createdCount += 1;
      } else {
        course.title = spec.title;
        course.description = spec.description;
        course.category = spec.category;
        course.programs = [...spec.programs];
        course.level = spec.level;
        course.price = spec.price;
        course.currency = spec.currency;
        course.regionalPrices = spec.regionalPrices ? { ...spec.regionalPrices } : undefined;
        course.compareAtPrices = spec.compareAtPrices ? { ...spec.compareAtPrices } : undefined;
        course.duration = spec.duration;
        course.durationInHours = spec.durationInHours;
        course.image = spec.image;
        course.learningOutcomes = spec.learningOutcomes;
        if (!course.publishedAt) course.publishedAt = new Date();
        course.status = 'published';
        await course.save();
        updatedCount += 1;
      }

      const existingLessonsCount = await Lesson.countDocuments({ course: course._id });
      if (existingLessonsCount === 0 && Array.isArray(spec.starterLessons) && spec.starterLessons.length > 0) {
        const insertedLessons = await Lesson.insertMany(
          spec.starterLessons.map((lessonSpec) => ({
            title: lessonSpec.title,
            slug: lessonSpec.slug,
            course: course._id,
            order: lessonSpec.order,
            type: lessonSpec.type || 'text',
            duration: lessonSpec.duration || 15,
            isFree: Boolean(lessonSpec.isFree),
            isPublished: true,
            publishedAt: new Date(),
            content: { text: lessonSpec.text },
          }))
        );
        course.lessons = insertedLessons.map((item) => item._id);
        await course.save();
      }
    }

    await logAdminAction({
      req,
      action: 'course.official_catalog_seeded',
      entityType: 'course',
      entityId: instructor._id,
      metadata: { createdCount, updatedCount, totalCatalog: OFFICIAL_ACADEMY_COURSES.length },
    });

    return res.status(200).json({
      message: 'تم نشر وتحديث كتالوج الدورات الرسمي بنجاح',
      createdCount,
      updatedCount,
      totalCatalog: OFFICIAL_ACADEMY_COURSES.length,
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/courses/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح' });
    }
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });

    const { titleAr, titleEn, descAr, descEn, price, priceEgp, compareAtUsd, compareAtEgp, status, image } = req.body;
    if (titleAr) { course.title.ar = titleAr; if (!titleEn) course.title.en = titleAr; }
    if (titleEn) course.title.en = titleEn;
    if (descAr) course.description.ar = descAr;
    if (descEn) course.description.en = descEn;
    if (price != null) course.price = price;
    if (priceEgp !== undefined) {
      const { buildRegionalCoursePrices } = require('../config/coursePricing');
      const { regionalPrices, compareAtPrices } = buildRegionalCoursePrices({
        priceUsd: price != null ? price : course.price,
        priceEgp,
        compareAtUsd,
        compareAtEgp,
      });
      if (regionalPrices) course.regionalPrices = regionalPrices;
      if (compareAtPrices) course.compareAtPrices = compareAtPrices;
    }
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
