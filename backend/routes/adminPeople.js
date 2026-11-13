const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Payment = require('../models/Payment');
const TeacherTask = require('../models/TeacherTask');
const Guardian = require('../models/Guardian');
const GuardianInvitation = require('../models/GuardianInvitation');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const Notification = require('../models/Notification');
const TeacherUpdate = require('../models/TeacherUpdate');
const AdminAuditLog = require('../models/AdminAuditLog');
const StudentSubscription = require('../models/StudentSubscription');
const GroupCircle = require('../models/GroupCircle');
const { getSubscriptionPlan } = require('../config/subscriptionPlans');
const { protect, authorize } = require('../middleware/auth');
const { maskPhone } = require('../utils/phone');
const { logAdminAction } = require('../services/adminAudit');
const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;
const {
  addMockUser,
  findMockUserByEmail,
  findMockUserById,
  updateMockUser,
  getMockUsers,
  deleteMockUser,
  getMockTeachers,
  findMockCircleById,
  getMockSubscriptions,
  addMockSubscription,
} = require('../mockStore');

function escapeRegex(value) {
  return String(value || '').replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
}

function teacherName(teacher) {
  return teacher?.user?.name || teacher?.personalInfo?.fullName || 'معلم الأكاديمية';
}

function studentSessionRow(session, studentId) {
  const attendance = (session.attendance || []).find(
    (entry) => entry.student && String(entry.student) === String(studentId),
  );
  const report = (session.studentReports || []).find(
    (entry) => entry.student && String(entry.student) === String(studentId),
  );

  return {
    _id: session._id,
    type: session.type,
    status: session.status,
    scheduledAt: session.scheduledAt,
    duration: session.duration,
    timezone: session.timezone,
    teacher: {
      id: session.teacher?._id || null,
      name: teacherName(session.teacher),
      avatar: session.teacher?.media?.profilePhoto || session.teacher?.user?.avatar || '',
    },
    circle: session.circle ? { id: session.circle._id, name: session.circle.name } : null,
    attendanceStatus: attendance?.status || null,
    report: report ? {
      memorizationScore: report.memorizationScore,
      tajweedScore: report.tajweedScore,
      surahRecited: report.surahRecited,
      fromAyah: report.fromAyah,
      toAyah: report.toAyah,
      nextHomework: report.nextHomework,
      notes: report.notes,
      sentAt: report.sentAt,
    } : null,
    teacherEvaluation: session.teacherEvaluation || null,
    studentFeedback: session.studentFeedback || null,
    meetingProvider: session.meetingProvider,
    meetingAvailable: Boolean(session.meetingLink),
    recordingAvailable: Boolean(session.recordingUrl),
    notes: session.notes || '',
    cancellationReason: session.cancellationReason || '',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

router.use(protect, authorize('admin'));

// Admin-only directory. Paginated and intentionally excludes sensitive family data.
router.get('/directory', async (req, res) => {
  try {
    const role = ['student', 'guardian'].includes(req.query.role) ? req.query.role : 'all';
    const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : 'all';
    const q = String(req.query.q || '').trim().slice(0, 120);
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 15));
    if (isMockMode && !isDBConnected()) {
      const allUsers = getMockUsers();
      const filtered = allUsers.filter((u) => {
        if (role === 'all' && !['student', 'guardian'].includes(u.role)) return false;
        if (role !== 'all' && u.role !== role) return false;
        if (status === 'active' && u.isActive === false) return false;
        if (status === 'inactive' && u.isActive !== false) return false;
        if (q) {
          const lower = q.toLowerCase();
          return (
            String(u.name || '').toLowerCase().includes(lower)
            || String(u.email || '').toLowerCase().includes(lower)
            || String(u.phone || '').toLowerCase().includes(lower)
            || String(u._id || '').toLowerCase().includes(lower)
          );
        }
        return true;
      });
      const total = filtered.length;
      const people = filtered.slice((page - 1) * limit, page * limit);
      return res.json({
        people,
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
        counts: {
          student: allUsers.filter((u) => u.role === 'student').length,
          guardian: allUsers.filter((u) => u.role === 'guardian').length,
        },
      });
    }
    const filter = {
      role: role === 'all' ? { $in: ['student', 'guardian'] } : role,
      ...(status === 'active' ? { isActive: { $ne: false } } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
    };
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
      if (mongoose.Types.ObjectId.isValid(q)) filter.$or.push({ _id: q });
    }
    const [people, total, studentCount, guardianCount] = await Promise.all([
      User.find(filter).select('_id name email role isActive createdAt lastLogin')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'guardian' }),
    ]);
    return res.json({
      people, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)),
      counts: { student: studentCount, guardian: guardianCount },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load people directory' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 120);
    if (q.length < 2) {
      return res.json({ query: q, people: [], sessions: [], payments: [] });
    }
    if (isMockMode && !isDBConnected()) {
      const lower = q.toLowerCase();
      const mockTeachers = getMockTeachers();
      const people = getMockUsers()
        .filter((u) => (
          String(u.name || '').toLowerCase().includes(lower)
          || String(u.email || '').toLowerCase().includes(lower)
          || String(u.phone || '').toLowerCase().includes(lower)
        ))
        .map((u) => {
          const t = mockTeachers.find((item) => String(item.user?._id || item.user) === String(u._id));
          return {
            ...u,
            teacherProfileId: t?._id || null,
            teacherStatus: t?.status || null,
            teacherVerified: t?.isVerified ?? null,
          };
        });
      return res.json({ query: q, people, sessions: [], payments: [] });
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const isObjectId = mongoose.Types.ObjectId.isValid(q);

    const people = await User.find({
      role: { $in: ['student', 'guardian', 'teacher'] },
      $or: [
        { name: regex },
        { email: regex },
        { phone: regex },
        ...(isObjectId ? [{ _id: q }] : []),
      ],
    })
      .select('name email phone role avatar isActive lastLogin createdAt')
      .limit(30)
      .lean();

    const teacherUserIds = people
      .filter((person) => person.role === 'teacher')
      .map((person) => person._id);

    const teacherProfiles = teacherUserIds.length
      ? await Teacher.find({ user: { $in: teacherUserIds } })
          .select('_id user status isVerified personalInfo.fullName')
          .lean()
      : [];

    const teacherByUser = new Map(
      teacherProfiles.map((teacher) => [String(teacher.user), teacher]),
    );

    const normalizedPeople = people.map((person) => {
      const profile = person.role === 'teacher'
        ? teacherByUser.get(String(person._id))
        : null;

      return {
        ...person,
        teacherProfileId: profile?._id || null,
        teacherStatus: profile?.status || null,
        teacherVerified: profile?.isVerified || false,
      };
    });

    let exactSession = null;
    let exactPayment = null;
    let exactTeacher = null;

    if (isObjectId) {
      [exactSession, exactPayment, exactTeacher] = await Promise.all([
        Session.findById(q)
          .populate('student', 'name email')
          .populate({
            path: 'teacher',
            select: 'personalInfo.fullName user',
            populate: { path: 'user', select: 'name email' },
          })
          .select('student teacher type status scheduledAt duration')
          .lean(),
        Payment.findById(q)
          .populate('student', 'name email')
          .populate('course', 'title slug')
          .select('student course kind provider amountMinor currency status createdAt settledAt')
          .lean(),
        Teacher.findById(q)
          .select('_id user status isVerified personalInfo.fullName')
          .lean(),
      ]);

      if (
        exactTeacher
        && !normalizedPeople.some((person) => String(person.teacherProfileId) === String(exactTeacher._id))
      ) {
        const teacherUser = await User.findById(exactTeacher.user)
          .select('name email phone role avatar isActive lastLogin createdAt')
          .lean();

        if (teacherUser) {
          normalizedPeople.unshift({
            ...teacherUser,
            teacherProfileId: exactTeacher._id,
            teacherStatus: exactTeacher.status,
            teacherVerified: exactTeacher.isVerified,
          });
        }
      }
    }

    return res.json({
      query: q,
      people: normalizedPeople,
      sessions: exactSession ? [{
        _id: exactSession._id,
        student: exactSession.student,
        teacher: exactSession.teacher,
        type: exactSession.type,
        status: exactSession.status,
        scheduledAt: exactSession.scheduledAt,
        duration: exactSession.duration,
      }] : [],
      payments: exactPayment ? [exactPayment] : [],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/guardian-links', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').trim();
    const allowed = new Set(['pending', 'accepted', 'rejected', 'cancelled', 'expired', 'all']);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid guardian invitation status' });
    }
    if (isMockMode && !isDBConnected()) {
      return res.json({ status, count: 0, invitations: [] });
    }

    const filter = status === 'all' ? {} : { status };
    if (status === 'pending') filter.expiresAt = { $gt: new Date() };

    const invitations = await GuardianInvitation.find(filter)
      .select('+guardianPhone')
      .populate('student', 'name email phone avatar currentLevel preferredTrack isActive')
      .populate('respondedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    await logAdminAction({
      req,
      action: 'guardian-links.viewed',
      entityType: 'guardian-links',
      entityId: status,
      reason: `Admin opened guardian link requests: ${status}`,
      metadata: { status, resultCount: invitations.length },
    }).catch(() => {});

    return res.json({
      status,
      count: invitations.length,
      invitations: invitations.map((invitation) => ({
        _id: invitation._id,
        student: invitation.student,
        relationship: invitation.relationship,
        status: invitation.status,
        source: invitation.source,
        phoneMasked: maskPhone(invitation.guardianPhone),
        respondedBy: invitation.respondedBy,
        respondedAt: invitation.respondedAt,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockStudent = findMockUserById(req.params.id);
      if (!mockStudent || mockStudent.role !== 'student') {
        return res.status(404).json({ error: 'Student not found' });
      }
      const circleDoc = mockStudent.circle ? findMockCircleById(mockStudent.circle) : null;
      const subs = getMockSubscriptions()
        .filter((s) => String(s.student?._id || s.student) === String(mockStudent._id))
        .map((s) => ({
          ...s,
          circle: s.circle ? findMockCircleById(s.circle) : null,
        }));
      return res.json({
        student: {
          ...mockStudent,
          circle: circleDoc ? { _id: circleDoc._id, name: circleDoc.name, status: circleDoc.status } : null,
        },
        summary: {
          totalSessions: 0,
          completedSessions: 0,
          upcomingSessions: 0,
          homeworkTotal: 0,
          homeworkCompleted: 0,
          settledPayments: subs.length,
          activeSubscriptions: subs.filter((s) => ['active', 'placed', 'awaiting_placement'].includes(s.status)).length,
        },
        guardians: [],
        guardianInvitations: [],
        sessions: [],
        homework: [],
        subscriptions: subs,
        enrollments: [],
        payments: [],
        progress: null,
        notifications: [],
        teacherUpdates: [],
        audit: [],
      });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('name email phone whatsappPhone gender enrollmentSection age currentLevel customLevel memorizedJuz memorizationDetails preferredTrack circle avatar bio isActive emailVerified lastLogin preferences createdAt updatedAt')
      .populate('circle', 'name status')
      .lean();

    if (!student) return res.status(404).json({ error: 'Student not found' });

    await logAdminAction({
      req,
      action: 'student.360.viewed',
      entityType: 'student',
      entityId: student._id,
      reason: String(req.query.reason || 'student-360-review').slice(0, 200),
      metadata: { source: 'admin-people-360' },
    });

    const studentId = student._id;

    const [
      sessions,
      tasks,
      guardians,
      invitations,
      enrollments,
      payments,
      progress,
      notifications,
      updates,
      subscriptions,
      audit,
    ] = await Promise.all([
      Session.find({
        $or: [
          { student: studentId },
          { 'attendance.student': studentId },
          { 'studentReports.student': studentId },
        ],
      })
        .populate({
          path: 'teacher',
          select: 'personalInfo.fullName media.profilePhoto user',
          populate: { path: 'user', select: 'name avatar email' },
        })
        .populate('circle', 'name')
        .sort({ scheduledAt: -1 })
        .limit(150)
        .lean(),
      TeacherTask.find({ student: studentId })
        .populate({
          path: 'teacher',
          select: 'personalInfo.fullName user',
          populate: { path: 'user', select: 'name' },
        })
        .sort({ createdAt: -1 })
        .limit(150)
        .lean(),
      Guardian.find({ 'children.student': studentId, isActive: { $ne: false } })
        .populate('user', 'name email phone avatar isActive lastLogin createdAt')
        .lean(),
      GuardianInvitation.find({ student: studentId })
        .select('+guardianPhone')
        .populate('respondedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Enrollment.find({ student: studentId })
        .populate('course', 'title slug category level image')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Payment.find({ student: studentId })
        .populate('course', 'title slug')
        .populate('subscription', 'planKey sessionCount pricingSnapshot')
        .select('kind provider providerReference course subscription amountMinor currency status manual.method manual.submittedAt manual.reviewedAt manual.reviewAction manual.reviewNote createdAt settledAt failedAt cancelledAt refundedAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Progress.find({ student: studentId })
        .populate('course', 'title slug')
        .select('course overallProgress milestones streak strengths weaknesses lastUpdated createdAt updatedAt')
        .sort({ lastUpdated: -1 })
        .limit(50)
        .lean(),
      Notification.find({ user: studentId })
        .select('type title message priority channels.inApp isRead readAt status createdAt data.actionUrl')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      TeacherUpdate.find({ 'audience.students': studentId, isPublished: true })
        .populate('teacher', 'personalInfo.fullName')
        .select('teacher title message videos.name videos.size videos.contentType publishedAt createdAt')
        .sort({ publishedAt: -1 })
        .limit(50)
        .lean(),
      StudentSubscription.find({ student: studentId })
        .populate('circle', 'name code status')
        .populate({
          path: 'preferredTeacher',
          select: 'personalInfo.fullName user',
          populate: { path: 'user', select: 'name' },
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      AdminAuditLog.find({ entityType: 'student', entityId: String(studentId) })
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const sessionRows = sessions.map((session) => studentSessionRow(session, studentId));

    const guardianRows = guardians.map((profile) => {
      const child = (profile.children || []).find(
        (entry) => entry.student && String(entry.student) === String(studentId),
      );
      return {
        guardianProfileId: profile._id,
        user: profile.user,
        relationship: child?.relationship || 'guardian',
        permissions: child?.permissions || {},
        addedAt: child?.addedAt || null,
      };
    });

    const taskRows = tasks.map((task) => ({
      _id: task._id,
      teacher: {
        id: task.teacher?._id || null,
        name: teacherName(task.teacher),
      },
      session: task.session,
      type: task.type,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      status: task.status,
      submissionAvailable: Boolean(task.submissionFile),
      teacherFeedback: task.teacherFeedback || '',
      reviewedAt: task.reviewedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));

    const invitationRows = invitations.map((invitation) => ({
      _id: invitation._id,
      relationship: invitation.relationship,
      status: invitation.status,
      source: invitation.source,
      phoneMasked: maskPhone(invitation.guardianPhone),
      respondedBy: invitation.respondedBy,
      respondedAt: invitation.respondedAt,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    }));

    return res.json({
      student,
      summary: {
        totalSessions: sessionRows.length,
        completedSessions: sessionRows.filter((session) => session.status === 'completed').length,
        absentSessions: sessionRows.filter((session) => session.attendanceStatus === 'absent').length,
        pendingHomework: taskRows.filter((task) => task.status === 'pending').length,
        submittedHomework: taskRows.filter((task) => task.status === 'submitted').length,
        guardians: guardianRows.length,
        activeEnrollments: enrollments.filter((entry) => entry.status === 'active').length,
        settledPayments: payments.filter((entry) => Boolean(entry.settledAt)).length,
        activeSubscriptions: subscriptions.filter((sub) => ['active', 'placed', 'awaiting_placement'].includes(sub.status)).length,
      },
      guardians: guardianRows,
      guardianInvitations: invitationRows,
      sessions: sessionRows,
      homework: taskRows,
      subscriptions,
      enrollments,
      payments,
      progress,
      notifications,
      teacherUpdates: updates.map((update) => ({
        _id: update._id,
        teacher: update.teacher,
        title: update.title,
        message: update.message,
        videoCount: (update.videos || []).length,
        publishedAt: update.publishedAt,
        createdAt: update.createdAt,
      })),
      audit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const VALID_STUDENT_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'ijazah']);
const VALID_STUDENT_TRACKS = new Set(['memorization', 'tajweed_ijazah', 'kids_foundation']);
const VALID_ENROLLMENT_SECTIONS = new Set(['men_children', 'ladies']);

router.post('/students', async (req, res) => {
  try {
    const {
      name, email, password, phone = '', whatsappPhone = '',
      gender = 'male', age = 12, enrollmentSection,
      currentLevel = 'beginner', customLevel = '',
      preferredTrack = 'memorization', memorizedJuz = 0,
      memorizationDetails = '', bio = '', isActive = true,
      createSubscription = false, planKey = 'group', sessionCount = 8, preferredTeacherId = null,
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });
    }
    if (String(password).trim().length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const resolvedGender = gender === 'female' ? 'female' : 'male';
    const resolvedSection = VALID_ENROLLMENT_SECTIONS.has(enrollmentSection)
      ? enrollmentSection
      : (resolvedGender === 'female' ? 'ladies' : 'men_children');

    if (isMockMode && !isDBConnected()) {
      if (findMockUserByEmail(normalizedEmail)) {
        return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
      }
      const mockStudent = addMockUser({
        name: String(name).trim(),
        email: normalizedEmail,
        password: String(password).trim(),
        phone: String(phone || '').trim() || undefined,
        whatsappPhone: String(whatsappPhone || phone || '').trim(),
        role: 'student',
        gender: resolvedGender,
        enrollmentSection: resolvedSection,
        age: Math.min(100, Math.max(4, Number(age) || 12)),
        currentLevel: VALID_STUDENT_LEVELS.has(currentLevel) ? currentLevel : 'beginner',
        customLevel: String(customLevel || '').trim().slice(0, 120),
        preferredTrack: VALID_STUDENT_TRACKS.has(preferredTrack) ? preferredTrack : 'memorization',
        memorizedJuz: Math.max(0, Math.min(30, Number(memorizedJuz) || 0)),
        memorizationDetails: String(memorizationDetails || '').trim().slice(0, 500),
        bio: String(bio || '').trim().slice(0, 500),
        isActive: Boolean(isActive),
        emailVerified: true,
        createdAt: new Date(),
      });
      let createdSub = null;
      if (createSubscription) {
        const plan = getSubscriptionPlan(planKey);
        const validCount = [4, 8, 12, 24].includes(Number(sessionCount)) ? Number(sessionCount) : 8;
        const pricePerSessionMinor = (plan?.pricePerSessionEgp || 55) * 100;
        createdSub = addMockSubscription({
          student: mockStudent._id,
          planKey: plan?.key || 'group',
          section: resolvedSection,
          sessionCount: validCount,
          sessionsUsed: 0,
          sessionsRemaining: validCount,
          currency: 'EGP',
          pricePerSessionMinor,
          totalAmountMinor: pricePerSessionMinor * validCount,
          status: 'awaiting_placement',
          preferredTeacher: preferredTeacherId || null,
          paidAt: new Date(),
        });
      }
      return res.status(201).json({
        success: true,
        student: mockStudent,
        subscription: createdSub,
      });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
    }

    const student = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password).trim(),
      phone: String(phone || '').trim() || undefined,
      whatsappPhone: String(whatsappPhone || phone || '').trim(),
      role: 'student',
      gender: resolvedGender,
      enrollmentSection: resolvedSection,
      age: Math.min(100, Math.max(4, Number(age) || 12)),
      currentLevel: VALID_STUDENT_LEVELS.has(currentLevel) ? currentLevel : 'beginner',
      customLevel: String(customLevel || '').trim().slice(0, 120),
      preferredTrack: VALID_STUDENT_TRACKS.has(preferredTrack) ? preferredTrack : 'memorization',
      memorizedJuz: Math.max(0, Math.min(30, Number(memorizedJuz) || 0)),
      memorizationDetails: String(memorizationDetails || '').trim().slice(0, 500),
      bio: String(bio || '').trim().slice(0, 500),
      isActive: Boolean(isActive),
      emailVerified: true,
      onboarding: {
        required: false,
        completed: true,
        trackSelected: true,
      },
    });

    let createdSubscription = null;
    if (createSubscription) {
      const plan = getSubscriptionPlan(planKey);
      const validCount = [4, 8, 12, 24].includes(Number(sessionCount)) ? Number(sessionCount) : 8;
      if (plan) {
        const pricePerSessionMinor = plan.pricePerSessionEgp * 100;
        createdSubscription = await StudentSubscription.create({
          student: student._id,
          planKey: plan.key,
          section: resolvedSection,
          sessionCount: validCount,
          sessionsUsed: 0,
          sessionsRemaining: validCount,
          currency: 'EGP',
          pricePerSessionMinor,
          totalAmountMinor: pricePerSessionMinor * validCount,
          status: 'awaiting_placement',
          preferredTeacher: preferredTeacherId && mongoose.Types.ObjectId.isValid(preferredTeacherId)
            ? preferredTeacherId
            : null,
          paidAt: new Date(),
          pricingSnapshot: {
            minStudents: plan.minStudents,
            maxStudents: plan.maxStudents,
            durationMinMinutes: plan.durationMinMinutes,
            durationMaxMinutes: plan.durationMaxMinutes,
            nameAr: plan.nameAr,
            nameEn: plan.nameEn,
            durationLabelAr: plan.durationLabelAr,
            durationLabelEn: plan.durationLabelEn,
          },
        });
      }
    }

    await logAdminAction({
      req,
      action: 'student.created-by-admin',
      entityType: 'student',
      entityId: String(student._id),
      reason: 'إضافة حساب طالب جديد من لوحة الإدارة',
      metadata: {
        gender: student.gender,
        currentLevel: student.currentLevel,
        preferredTrack: student.preferredTrack,
        subscriptionCreated: Boolean(createdSubscription),
      },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      student,
      subscription: createdSubscription,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/students/:id', async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockStudent = findMockUserById(req.params.id);
      if (!mockStudent || mockStudent.role !== 'student') {
        return res.status(404).json({ error: 'الطالب غير موجود' });
      }
      const {
        name, email, newPassword, phone, whatsappPhone,
        gender, age, enrollmentSection,
        currentLevel, customLevel, preferredTrack,
        memorizedJuz, memorizationDetails, bio, isActive,
      } = req.body || {};
      if (typeof name === 'string' && name.trim()) mockStudent.name = name.trim();
      if (typeof email === 'string' && email.trim()) mockStudent.email = email.toLowerCase().trim();
      if (phone !== undefined) mockStudent.phone = String(phone || '').trim();
      if (whatsappPhone !== undefined) mockStudent.whatsappPhone = String(whatsappPhone || '').trim();
      if (gender === 'male' || gender === 'female') mockStudent.gender = gender;
      if (enrollmentSection && VALID_ENROLLMENT_SECTIONS.has(enrollmentSection)) mockStudent.enrollmentSection = enrollmentSection;
      if (age !== undefined && Number.isFinite(Number(age))) mockStudent.age = Number(age);
      if (currentLevel && VALID_STUDENT_LEVELS.has(currentLevel)) mockStudent.currentLevel = currentLevel;
      if (typeof customLevel === 'string') mockStudent.customLevel = customLevel.trim();
      if (preferredTrack && VALID_STUDENT_TRACKS.has(preferredTrack)) mockStudent.preferredTrack = preferredTrack;
      if (memorizedJuz !== undefined && Number.isFinite(Number(memorizedJuz))) mockStudent.memorizedJuz = Number(memorizedJuz);
      if (typeof memorizationDetails === 'string') mockStudent.memorizationDetails = memorizationDetails.trim();
      if (typeof bio === 'string') mockStudent.bio = bio.trim();
      if (typeof isActive === 'boolean') mockStudent.isActive = isActive;
      if (newPassword && String(newPassword).trim().length >= 8) mockStudent.password = String(newPassword).trim();
      return res.json({ success: true, student: mockStudent });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const student = await User.findOne({ _id: req.params.id, role: 'student' }).select('+password');
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const {
      name, email, newPassword, phone, whatsappPhone,
      gender, age, enrollmentSection,
      currentLevel, customLevel, preferredTrack,
      memorizedJuz, memorizationDetails, bio, isActive, adminReason,
    } = req.body || {};

    if (typeof name === 'string' && name.trim()) {
      student.name = name.trim();
    }
    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== student.email) {
        const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: student._id } });
        if (existing) {
          return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل لحساب آخر' });
        }
        student.email = normalizedEmail;
      }
    }
    if (phone !== undefined) {
      student.phone = String(phone || '').trim() || undefined;
    }
    if (whatsappPhone !== undefined) {
      student.whatsappPhone = String(whatsappPhone || '').trim();
    }
    if (gender === 'male' || gender === 'female') {
      student.gender = gender;
    }
    if (enrollmentSection !== undefined && VALID_ENROLLMENT_SECTIONS.has(enrollmentSection)) {
      student.enrollmentSection = enrollmentSection;
    }
    if (age !== undefined && Number.isFinite(Number(age))) {
      student.age = Math.min(100, Math.max(4, Number(age)));
    }
    if (typeof currentLevel === 'string' && VALID_STUDENT_LEVELS.has(currentLevel.trim())) {
      student.currentLevel = currentLevel.trim();
    }
    if (typeof customLevel === 'string') {
      student.customLevel = customLevel.trim().slice(0, 120);
    }
    if (typeof preferredTrack === 'string' && VALID_STUDENT_TRACKS.has(preferredTrack.trim())) {
      student.preferredTrack = preferredTrack.trim();
    }
    if (memorizedJuz !== undefined && Number.isFinite(Number(memorizedJuz))) {
      student.memorizedJuz = Math.max(0, Math.min(30, Number(memorizedJuz)));
    }
    if (typeof memorizationDetails === 'string') {
      student.memorizationDetails = memorizationDetails.trim().slice(0, 500);
    }
    if (typeof bio === 'string') {
      student.bio = bio.trim().slice(0, 500);
    }
    if (typeof isActive === 'boolean') {
      student.isActive = isActive;
    }
    if (newPassword && String(newPassword).trim()) {
      if (String(newPassword).trim().length < 8) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
      }
      student.password = String(newPassword).trim();
    }

    await student.save();

    await logAdminAction({
      req,
      action: 'student.admin-profile.updated',
      entityType: 'student',
      entityId: String(student._id),
      reason: String(adminReason || 'تحديث ملف الطالب من Student 360').trim().slice(0, 200),
      metadata: {
        fields: Object.keys(req.body || {}).filter((key) => !['newPassword', 'password', 'adminReason'].includes(key)),
        passwordChanged: Boolean(newPassword && String(newPassword).trim()),
      },
    }).catch(() => {});

    return res.json({ success: true, student });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockStudent = findMockUserById(req.params.id);
      if (!mockStudent || mockStudent.role !== 'student') {
        return res.status(404).json({ error: 'الطالب غير موجود' });
      }
      deleteMockUser(req.params.id);
      return res.json({ success: true, deletedId: String(req.params.id) });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const studentId = student._id;
    const studentName = student.name;
    const studentEmail = student.email;

    await Promise.all([
      GroupCircle.updateMany({ students: studentId }, { $pull: { students: studentId } }),
      Guardian.updateMany({ 'children.student': studentId }, { $pull: { children: { student: studentId } } }),
      User.updateMany({ children: studentId }, { $pull: { children: studentId } }),
      StudentSubscription.updateMany(
        { student: studentId, status: { $nin: ['completed', 'cancelled'] } },
        { $set: { status: 'cancelled', circle: null } }
      ),
      Session.updateMany(
        { student: studentId, type: { $ne: 'group' }, status: { $in: ['pending', 'accepted', 'scheduled'] } },
        { $set: { status: 'cancelled' } }
      ),
    ]);

    await User.findByIdAndDelete(studentId);

    await logAdminAction({
      req,
      action: 'student.deleted-by-admin',
      entityType: 'student',
      entityId: String(studentId),
      reason: String(req.body?.reason || req.query?.reason || 'حذف حساب الطالب من الإدارة').trim().slice(0, 200),
      metadata: { studentName, studentEmail },
    }).catch(() => {});

    return res.json({ success: true, deletedId: String(studentId) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/guardians/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid guardian id' });
    }

    const guardianUser = await User.findOne({ _id: req.params.id, role: 'guardian' })
      .select('name email phone +phoneNormalized avatar bio isActive emailVerified lastLogin preferences createdAt updatedAt')
      .lean();

    if (!guardianUser) return res.status(404).json({ error: 'Guardian not found' });

    await logAdminAction({
      req,
      action: 'guardian.360.viewed',
      entityType: 'guardian',
      entityId: guardianUser._id,
      reason: String(req.query.reason || 'family-360-review').slice(0, 200),
      metadata: { source: 'admin-people-360' },
    });

    const profile = await Guardian.findOne({ user: guardianUser._id })
      .populate('children.student', 'name email phone avatar currentLevel preferredTrack circle isActive lastLogin createdAt')
      .lean();

    const normalizedPhone = guardianUser.phoneNormalized || '';
    const invitationFilter = {
      $or: [
        { respondedBy: guardianUser._id },
        ...(normalizedPhone ? [{ guardianPhoneNormalized: normalizedPhone }] : []),
      ],
    };

    const invitations = await GuardianInvitation.find(invitationFilter)
      .select('+guardianPhone +guardianPhoneNormalized')
      .populate('student', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const children = (profile?.children || []).filter((entry) => entry.student?._id);
    const childIds = children.map((entry) => entry.student._id);
    const circleIds = children.map((entry) => entry.student.circle).filter(Boolean);

    const [sessions, tasks, audit] = await Promise.all([
      childIds.length
        ? Session.find({
            $or: [
              { student: { $in: childIds } },
              { circle: { $in: circleIds } },
              { 'attendance.student': { $in: childIds } },
              { 'studentReports.student': { $in: childIds } },
            ],
          })
            .select('student circle status type scheduledAt attendance studentReports')
            .sort({ scheduledAt: -1 })
            .limit(300)
            .lean()
        : [],
      childIds.length
        ? TeacherTask.find({ student: { $in: childIds } })
            .select('student status dueDate createdAt')
            .sort({ createdAt: -1 })
            .limit(300)
            .lean()
        : [],
      AdminAuditLog.find({ entityType: 'guardian', entityId: String(guardianUser._id) })
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const now = new Date();

    const childRows = children.map((entry) => {
      const childId = String(entry.student._id);
      const childCircleId = entry.student.circle ? String(entry.student.circle) : null;

      const childSessions = sessions.filter((session) => (
        (session.student && String(session.student) === childId)
        || (childCircleId && session.circle && String(session.circle) === childCircleId)
        || (session.attendance || []).some(
          (attendance) => attendance.student && String(attendance.student) === childId,
        )
        || (session.studentReports || []).some(
          (report) => report.student && String(report.student) === childId,
        )
      ));

      const childTasks = tasks.filter(
        (task) => task.student && String(task.student) === childId,
      );

      const nextSession = childSessions
        .filter(
          (session) => new Date(session.scheduledAt) >= now
            && ['pending', 'accepted'].includes(session.status),
        )
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null;

      return {
        student: entry.student,
        relationship: entry.relationship,
        permissions: entry.permissions || {},
        addedAt: entry.addedAt,
        summary: {
          sessions: childSessions.length,
          completedSessions: childSessions.filter((session) => session.status === 'completed').length,
          pendingHomework: childTasks.filter((task) => task.status === 'pending').length,
          submittedHomework: childTasks.filter((task) => task.status === 'submitted').length,
          nextSession: nextSession ? {
            _id: nextSession._id,
            scheduledAt: nextSession.scheduledAt,
            type: nextSession.type,
            status: nextSession.status,
          } : null,
        },
      };
    });

    const safeGuardian = { ...guardianUser };
    delete safeGuardian.phoneNormalized;

    return res.json({
      guardian: safeGuardian,
      profile: profile ? {
        _id: profile._id,
        notificationPreferences: profile.notificationPreferences,
        settings: profile.settings,
        lastLogin: profile.lastLogin,
        isActive: profile.isActive,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      } : null,
      summary: {
        children: childRows.length,
        pendingInvitations: invitations.filter((invitation) => invitation.status === 'pending').length,
        activeChildren: childRows.filter((child) => child.student?.isActive !== false).length,
      },
      children: childRows,
      invitations: invitations.map((invitation) => ({
        _id: invitation._id,
        student: invitation.student,
        relationship: invitation.relationship,
        status: invitation.status,
        source: invitation.source,
        phoneMasked: maskPhone(invitation.guardianPhone),
        respondedAt: invitation.respondedAt,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })),
      audit,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
