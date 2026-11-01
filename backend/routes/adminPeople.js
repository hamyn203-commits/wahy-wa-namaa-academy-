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
const { protect, authorize } = require('../middleware/auth');
const { maskPhone } = require('../utils/phone');
const { logAdminAction } = require('../services/adminAudit');

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('name email phone whatsappPhone gender age currentLevel customLevel memorizedJuz memorizationDetails preferredTrack circle avatar bio isActive emailVerified lastLogin preferences createdAt updatedAt')
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

router.put('/students/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const { currentLevel, preferredTrack, memorizedJuz, memorizationDetails, isActive, adminReason } = req.body || {};
    if (typeof currentLevel === 'string' && currentLevel.trim()) student.currentLevel = currentLevel.trim();
    if (typeof preferredTrack === 'string' && preferredTrack.trim()) student.preferredTrack = preferredTrack.trim();
    if (memorizedJuz !== undefined && Number.isFinite(Number(memorizedJuz))) {
      student.memorizedJuz = Math.max(0, Math.min(30, Number(memorizedJuz)));
    }
    if (typeof memorizationDetails === 'string') student.memorizationDetails = memorizationDetails.trim().slice(0, 500);
    if (typeof isActive === 'boolean') student.isActive = isActive;

    await student.save();

    await logAdminAction({
      req,
      action: 'student.admin-profile.updated',
      entityType: 'student',
      entityId: String(student._id),
      reason: String(adminReason || 'تحديث ملف الطالب من Student 360').trim().slice(0, 200),
      metadata: {
        fields: ['currentLevel', 'preferredTrack', 'memorizedJuz', 'memorizationDetails', 'isActive']
          .filter((key) => req.body?.[key] !== undefined),
      },
    }).catch(() => {});

    return res.json({ success: true, student });
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
