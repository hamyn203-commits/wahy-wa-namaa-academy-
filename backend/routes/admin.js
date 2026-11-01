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
    return res.json({
      totalStudents: 0,
      totalTeachers: 0,
      totalSessions: 0,
      totalCourses: 0,
      totalEnrollments: 0,
      pendingTeachers: 0,
      totalCircles: 0,
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
    return res.json([]);
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
    return res.json([]);
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

router.post('/teachers', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      name, email, password, phone = '+201000000000', country = 'مصر', city = 'القاهرة',
      gender = 'male', age = 30, university = 'الأزهر', specialization = 'تحفيظ',
      hourlyRate = 50, autoApprove = false,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: 'البريد مسجل مسبقاً' });
    }

    const user = await User.create({ name, email, password, phone, role: 'teacher' });
    const teacher = await Teacher.create({
      user: user._id,
      personalInfo: { fullName: name, age, gender, country, city, phone },
      academicInfo: {
        university,
        faculty: 'الشريعة',
        graduationYear: 2015,
        specialization,
        qualification: 'إجازة في القرآن',
      },
      quranInfo: { memorizedParts: 30, teachingExperience: 5, specializations: ['tajweed', 'children'] },
      documents: { idCard: PLACEHOLDER, graduationCertificate: PLACEHOLDER },
      media: {
        profilePhoto: PLACEHOLDER,
        introductionVideo: PLACEHOLDER,
        recitationVideo: PLACEHOLDER,
        teachingMethodVideo: PLACEHOLDER,
      },
      status: 'pending',
      isVerified: false,
      hourlyRate,
      languages: ['arabic', 'english'],
    });

    await logAdminAction({
      req,
      action: 'teacher.created-by-admin',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: autoApprove
        ? 'تم تجاهل autoApprove؛ يجب إكمال مراجعة الملف قبل الاعتماد.'
        : 'تم إنشاء ملف معلم من الإدارة بحالة pending.',
      metadata: { requestedAutoApprove: Boolean(autoApprove) },
    }).catch(() => {});

    res.status(201).json({
      user: { id: user._id, name, email },
      teacher,
      reviewRequired: true,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/teachers/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'المعلم غير موجود' });

    const { name, hourlyRate, isFeatured, gender, status, country, city, phone } = req.body;
    if (status === 'approved' && teacher.status !== 'approved') {
      return res.status(409).json({
        error: 'اعتماد المعلم يتم فقط من مركز المراجعة بعد إكمال Approval Gate',
        code: 'USE_TEACHER_REVIEW_GATE',
      });
    }

    if (name) {
      await User.findByIdAndUpdate(teacher.user, { name, phone });
      teacher.personalInfo.fullName = name;
    }
    if (phone) teacher.personalInfo.phone = phone;
    if (country) teacher.personalInfo.country = country;
    if (city) teacher.personalInfo.city = city;
    if (gender === 'male' || gender === 'female') teacher.personalInfo.gender = gender;
    if (hourlyRate != null && Number.isFinite(Number(hourlyRate)) && Number(hourlyRate) >= 0) teacher.hourlyRate = Number(hourlyRate);
    if (typeof isFeatured === 'boolean') teacher.isFeatured = isFeatured;
    if (status) {
      teacher.status = status;
      teacher.isVerified = false;
    }
    await teacher.save();

    await logAdminAction({
      req,
      action: 'teacher.admin-profile.updated',
      entityType: 'teacher',
      entityId: teacher._id,
      reason: String(req.body.adminReason || '').trim(),
      metadata: {
        fields: ['name', 'hourlyRate', 'isFeatured', 'gender', 'status', 'country', 'city', 'phone']
          .filter((key) => req.body[key] !== undefined),
      },
    }).catch(() => {});

    res.json(teacher);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
