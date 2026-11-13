const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

const coursesUploadDir = path.join(__dirname, '..', 'uploads', 'courses');
if (process.env.FILE_STORAGE_DRIVER !== 'external') {
  if (!fs.existsSync(coursesUploadDir)) fs.mkdirSync(coursesUploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /video|image|pdf|mp4|webm|jpeg|jpg|png/.test(file.mimetype);
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
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
  }
});

router.put('/session-control/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'الحصة غير موجودة' });

    const { status, reason } = req.body || {};
    if (!['completed', 'cancelled', 'no-show'].includes(status)) {
      return res.status(400).json({ error: 'حالة الحصة غير مدعومة' });
    }

    session.status = status;
    if (status === 'cancelled' && reason) {
      session.cancellationReason = String(reason).trim().slice(0, 500);
    }
    await session.save();

    await logAdminAction({
      req,
      action: `session-control.status.${status}`,
      entityType: 'session',
      entityId: String(session._id),
      reason: String(reason || `تحديث حالة الحصة إلى ${status} من مركز التحكم`).trim().slice(0, 200),
      metadata: { status },
    }).catch(() => {});

    return res.json({ success: true, session });
  } catch (error) {
    return res.status(400).json({ error: error.message });
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
    return res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

const VALID_TEACHER_SPECIALIZATIONS = new Set([
  'children', 'adults', 'women', 'non-arabic', 'tajweed', 'ijaza', 'arabic-language',
]);
const VALID_TEACHER_LANGUAGES = new Set([
  'arabic', 'english', 'french', 'german', 'turkish', 'urdu', 'indonesian', 'malay',
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
        status: autoApprove ? 'approved' : 'pending',
        isVerified: Boolean(autoApprove),
        hourlyRate: Math.max(0, Number(hourlyRate ?? 50)),
        isFeatured: Boolean(isFeatured),
        languages: normalizedLangs.length ? normalizedLangs : ['arabic'],
      });
      return res.status(201).json({
        user: { id: mockUser._id, name: mockUser.name, email: mockUser.email },
        teacher: { ...mockTeacher, user: mockUser },
        reviewRequired: !autoApprove,
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

    if (autoApprove) {
      teacher.status = 'approved';
      teacher.isVerified = true;
      teacher.reviewCompletedAt = new Date();
      await teacher.save();
    }

    await logAdminAction({
      req,
      action: 'teacher.created-by-admin',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: autoApprove
        ? 'تم إنشاء ملف معلم من الإدارة مع اعتماد مباشر.'
        : 'تم إنشاء ملف معلم من الإدارة بحالة pending.',
      metadata: { requestedAutoApprove: Boolean(autoApprove), status: teacher.status },
    }).catch(() => {});

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email },
      teacher,
      reviewRequired: !autoApprove,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
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

      if (status === 'approved' && mockTeacher.status !== 'approved' && !adminDirectOverride) {
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

    if (status === 'approved' && teacher.status !== 'approved' && !adminDirectOverride) {
      return res.status(409).json({
        error: 'اعتماد المعلم يتم فقط من مركز المراجعة بعد إكمال Approval Gate',
        code: 'USE_TEACHER_REVIEW_GATE',
      });
    }

    const userDoc = await User.findById(teacher.user).select('+password');
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
      if (typeof isActive === 'boolean') {
        userDoc.isActive = isActive;
      }
      if (newPassword && String(newPassword).trim()) {
        if (String(newPassword).trim().length < 8) {
          return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
        }
        userDoc.password = String(newPassword).trim();
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
      if (typeof isVerified === 'boolean') {
        teacher.isVerified = isVerified;
      } else {
        teacher.isVerified = status === 'approved';
      }
      if (status === 'approved' && !teacher.reviewCompletedAt) {
        teacher.reviewCompletedAt = new Date();
      }
    } else if (typeof isVerified === 'boolean') {
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
    res.status(400).json({ error: error.message });
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
    const teacher = await Teacher.findById(req.params.id).populate('user', 'name email role');
    if (!teacher) return res.status(404).json({ error: 'المعلم غير موجود' });

    const replacementTeacherId = req.body?.replacementTeacherId || req.query?.replacementTeacherId;
    const forceDelete = Boolean(req.body?.force || req.query?.force === 'true');
    const teacherCircles = await GroupCircle.find({ teacher: teacher._id });

    if (teacherCircles.length > 0) {
      if (replacementTeacherId) {
        const replacement = await Teacher.findById(replacementTeacherId);
        if (!replacement) {
          return res.status(404).json({ error: 'المعلم البديل غير موجود' });
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
    return res.status(400).json({ error: error.message });
  }
});

router.post('/upload', protect, authorize('admin', 'teacher'), upload.single('file'), async (req, res) => {
  const directFile = req.body?.storageFile && typeof req.body.storageFile === 'object'
    ? req.body.storageFile
    : null;

  if (directFile?.url) {
    if (!objectStorage.referenceMatches(directFile.url, 'course-media', req.user.id)) {
      return res.status(400).json({ error: 'Invalid uploaded media reference' });
    }
    return res.json({
      url: objectStorage.publicProxyUrl(directFile.url),
      source: objectStorage.getDriver(),
      filename: directFile.name,
      mimetype: directFile.contentType,
      size: directFile.size,
    });
  }

  if (!req.file) return res.status(400).json({ error: 'لم يُرفع ملف' });
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
  try {
    if (process.env.FILE_STORAGE_DRIVER === 'external') {
      return res.status(503).json({ error: 'External file storage is not configured yet', code: 'FILE_STORAGE_NOT_READY' });
    }

    const filePath = path.join(coursesUploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const rel = `/uploads/courses/${filename}`;
    const url = `${API_PUBLIC}${rel}`;
    return res.json({ url, path: rel, source: 'local', filename, mimetype: req.file.mimetype, size: req.file.size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/courses', protect, authorize('admin'), async (req, res) => {
  try {
    const courses = await Course.find()
      .populate({ path: 'instructor', populate: { path: 'user', select: 'name' } })
      .sort({ updatedAt: -1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/courses', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      titleAr, titleEn, descAr, descEn, slug, category = 'quran', level = 'beginner',
      price = 0, instructorId, image = '/courses/default.jpg', status = 'published', programs = [],
    } = req.body;

    if (!titleAr || !slug || !instructorId) {
      return res.status(400).json({ error: 'العنوان والرابط والمعلم مطلوبة' });
    }
    const course = await Course.create({
      title: { ar: titleAr, en: titleEn || titleAr },
      description: { ar: descAr || titleAr, en: descEn || titleEn || titleAr },
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
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
    res.status(201).json(course);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/courses/:id', protect, authorize('admin'), async (req, res) => {
  try {
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
    res.json(course);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/courses/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Lesson.deleteMany({ course: req.params.id });
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الدورة' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/courses/:id/lessons', protect, authorize('admin'), async (req, res) => {
  try {
    const lessons = await Lesson.find({ course: req.params.id }).sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/courses/:id/lessons', protect, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });

    const {
      titleAr, titleEn, slug, type = 'video', duration = 10,
      videoUrl, youtubeUrl, textAr, textEn, order, isPublished = true,
    } = req.body;

    const count = await Lesson.countDocuments({ course: course._id });
    const videoSrc = videoUrl || youtubeUrl || '';
    const provider = youtubeUrl || videoSrc.includes('youtube') ? 'youtube' : 'self-hosted';

    const lesson = await Lesson.create({
      title: { ar: titleAr, en: titleEn || titleAr },
      slug: (slug || `lesson-${count + 1}`).toLowerCase(),
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
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/lessons/:id', protect, authorize('admin'), async (req, res) => {
  try {
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
      lesson.content.video = { ...lesson.content.video, url: videoUrl };
    }
    if (textAr && lesson.type === 'text') {
      lesson.content.text = { ...lesson.content.text, ar: textAr };
    }
    await lesson.save();
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/lessons/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
    await Course.updateOne({ _id: lesson.course }, { $pull: { lessons: lesson._id } });
    res.json({ message: 'تم حذف الدرس' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/blog', protect, authorize('admin'), async (req, res) => {
  try {
    const posts = await Blog.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/blog', protect, authorize('admin'), async (req, res) => {
  try {
    const { slug, titleAr, titleEn, excerptAr, contentAr, coverImage, category, status = 'published' } = req.body;
    const post = await Blog.create({
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      title: { ar: titleAr, en: titleEn || titleAr },
      excerpt: { ar: excerptAr || '', en: excerptAr || '' },
      content: { ar: contentAr || '', en: contentAr || '' },
      coverImage: coverImage || '',
      category: category || 'general',
      author: req.user.id,
      authorName: req.user.name,
      status,
    });
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/blog/:id', protect, authorize('admin'), async (req, res) => {
  try {
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
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/blog/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف المقال' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/withdrawals', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    return res.json({ withdrawals: [] });
  }
  try {
    const status = req.query.status || 'pending';
    const filter = status === 'all' ? {} : { status };
    const withdrawals = await WithdrawRequest.find(filter)
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email' } })
      .sort({ createdAt: -1 });
    res.json({ withdrawals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/withdrawals/:id', protect, authorize('admin'), async (req, res) => {
  if (isMockMode && !isDBConnected()) {
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
    const { action, adminNote } = req.body;
    const withdrawal = await WithdrawRequest.findById(req.params.id);
    if (!withdrawal) return res.status(404).json({ error: 'طلب غير موجود' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً' });
    }

    const teacher = await Teacher.findById(withdrawal.teacher);
    if (!teacher) return res.status(404).json({ error: 'المعلم غير موجود' });

    if (action === 'approve') {
      if (teacher.earnings.pendingEarnings < withdrawal.amount) {
        return res.status(400).json({ error: 'رصيد المعلم غير كافٍ' });
      }
      teacher.earnings.pendingEarnings -= withdrawal.amount;
      teacher.earnings.withdrawnEarnings += withdrawal.amount;
      await teacher.save();
      withdrawal.status = 'approved';
    } else if (action === 'reject') {
      withdrawal.status = 'rejected';
    } else {
      return res.status(400).json({ error: 'action يجب أن يكون approve أو reject' });
    }

    if (adminNote) withdrawal.adminNote = adminNote;
    await withdrawal.save();
    res.json({ success: true, withdrawal });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
