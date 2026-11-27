const { safeErrorMessage } = require('../utils/safeError');
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
const { getPlan: getSubscriptionPlan } = require('../config/subscriptionPlans');
const { protect, authorize } = require('../middleware/auth');
const { maskPhone } = require('../utils/phone');
const { logAdminAction } = require('../services/adminAudit');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
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

// Admin-only directory. Paginated and enriched with operational summaries.
router.get('/directory', async (req, res) => {
  try {
    const role = ['student', 'guardian'].includes(req.query.role) ? req.query.role : 'all';
    const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : 'all';
    const section = ['men_children', 'ladies'].includes(req.query.section) ? req.query.section : 'all';
    const track = ['memorization', 'tajweed_ijazah', 'kids_foundation'].includes(req.query.track) ? req.query.track : 'all';
    const focus = ['all', 'awaiting_placement', 'low_balance', 'unassigned', 'minors_without_guardian'].includes(req.query.focus)
      ? req.query.focus
      : 'all';
    const q = String(req.query.q || '').trim().slice(0, 120);
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 15));

    if (isMockMode && !isDBConnected()) {
      const allUsers = getMockUsers();
      const mockSubs = getMockSubscriptions();
      const mockTeachers = getMockTeachers();
      const filtered = allUsers.filter((u) => {
        if (role === 'all' && !['student', 'guardian'].includes(u.role)) return false;
        if (role !== 'all' && u.role !== role) return false;
        if (status === 'active' && u.isActive === false) return false;
        if (status === 'inactive' && u.isActive !== false) return false;
        if (section !== 'all' && u.role === 'student') {
          const resolvedSec = u.enrollmentSection || (u.gender === 'female' ? 'ladies' : 'men_children');
          if (resolvedSec !== section) return false;
        }
        if (track !== 'all' && u.role === 'student' && (u.preferredTrack || 'memorization') !== track) return false;
        const openSub = u.role === 'student'
          ? mockSubs.find((s) => String(s.student?._id || s.student) === String(u._id) && ['awaiting_placement', 'placed', 'active', 'paused'].includes(s.status))
          : null;
        if (focus === 'awaiting_placement' && (!openSub || openSub.status !== 'awaiting_placement')) return false;
        if (focus === 'low_balance' && (!openSub || !['active', 'placed'].includes(openSub.status) || Number(openSub.sessionsRemaining ?? 99) > 2)) return false;
        if (focus === 'unassigned' && (u.role !== 'student' || u.circle || openSub?.circle)) return false;
        if (focus === 'minors_without_guardian' && (u.role !== 'student' || Number(u.age ?? 18) >= 18 || u.guardian)) return false;
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
      const people = filtered.slice((page - 1) * limit, page * limit).map((u) => {
        const circleDoc = u.circle ? findMockCircleById(u.circle) : null;
        const sub = u.role === 'student'
          ? mockSubs.find((s) => String(s.student?._id || s.student) === String(u._id) && ['awaiting_placement', 'placed', 'active', 'paused'].includes(s.status))
          : null;
        const prefTeacher = sub?.preferredTeacher
          ? mockTeachers.find((t) => String(t._id) === String(sub.preferredTeacher?._id || sub.preferredTeacher))
          : null;
        return {
          ...u,
          circle: circleDoc ? { _id: circleDoc._id, name: circleDoc.name, status: circleDoc.status } : null,
          activeSubscription: sub ? {
            _id: sub._id,
            planKey: sub.planKey,
            status: sub.status,
            sessionsRemaining: sub.sessionsRemaining,
            sessionCount: sub.sessionCount,
            isScholarship: Boolean(sub.isScholarship),
            teacherName: prefTeacher?.personalInfo?.fullName || null,
          } : null,
        };
      });
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
        pulse: {
          awaitingPlacement: mockSubs.filter((s) => s.status === 'awaiting_placement').length,
          lowBalance: mockSubs.filter((s) => ['active', 'placed'].includes(s.status) && Number(s.sessionsRemaining ?? 99) <= 2).length,
          minorsWithoutGuardian: allUsers.filter((u) => u.role === 'student' && u.isActive !== false && Number(u.age ?? 18) < 18 && !u.guardian).length,
        },
      });
    }

    const canQueryAux = Boolean(mongoose.connection?.db) || StudentSubscription.distinct !== mongoose.Model.distinct;
    let focusStudentIds = null;

    if (canQueryAux && focus !== 'all') {
      if (focus === 'awaiting_placement') {
        focusStudentIds = await StudentSubscription.distinct('student', { status: 'awaiting_placement' });
      } else if (focus === 'low_balance') {
        focusStudentIds = await StudentSubscription.distinct('student', {
          status: { $in: ['active', 'placed'] },
          sessionsRemaining: { $lte: 2 },
        });
      } else if (focus === 'minors_without_guardian') {
        const linkedMinorIds = await Guardian.distinct('children.student', { isActive: { $ne: false } });
        focusStudentIds = { excludeIds: linkedMinorIds, minorsOnly: true };
      }
    }

    const effectiveRole = focus !== 'all' ? 'student' : role;
    const filter = {
      role: effectiveRole === 'all' ? { $in: ['student', 'guardian'] } : effectiveRole,
      ...(status === 'active' ? { isActive: { $ne: false } } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
    };

    if (section !== 'all') {
      if (section === 'ladies') {
        filter.$and = [...(filter.$and || []), { $or: [{ enrollmentSection: 'ladies' }, { enrollmentSection: { $exists: false }, gender: 'female' }] }];
      } else {
        filter.$and = [...(filter.$and || []), { $or: [{ enrollmentSection: 'men_children' }, { enrollmentSection: { $exists: false }, gender: { $ne: 'female' } }] }];
      }
    }
    if (track !== 'all') {
      filter.preferredTrack = track;
    }
    if (focus === 'unassigned') {
      filter.$and = [...(filter.$and || []), { $or: [{ circle: null }, { circle: { $exists: false } }] }];
    } else if (Array.isArray(focusStudentIds)) {
      filter._id = { $in: focusStudentIds };
    } else if (focusStudentIds?.minorsOnly) {
      filter.age = { $lt: 18 };
      if (focusStudentIds.excludeIds.length > 0) {
        filter._id = { $nin: focusStudentIds.excludeIds };
      }
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      const searchOr = [{ name: regex }, { email: regex }, { phone: regex }, { whatsappPhone: regex }];
      if (mongoose.Types.ObjectId.isValid(q)) searchOr.push({ _id: q });
      filter.$and = [...(filter.$and || []), { $or: searchOr }];
    }

    const [rawPeople, total, studentCount, guardianCount] = await Promise.all([
      User.find(filter)
        .select('_id name email phone whatsappPhone role gender enrollmentSection age currentLevel preferredTrack circle isActive createdAt lastLogin')
        .populate('circle', 'name code status')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'guardian' }),
    ]);

    let pulse = { awaitingPlacement: 0, lowBalance: 0, minorsWithoutGuardian: 0 };
    let people = rawPeople || [];

    if (canQueryAux) {
      const studentPageIds = people.filter((p) => p.role === 'student').map((p) => p._id);
      const guardianPageIds = people.filter((p) => p.role === 'guardian').map((p) => p._id);

      const [
        pageSubs,
        studentGuardianDocs,
        guardianDocs,
        awaitingStudentIds,
        lowBalanceStudentIds,
        linkedChildIds,
      ] = await Promise.all([
        studentPageIds.length
          ? StudentSubscription.find({
              student: { $in: studentPageIds },
              status: { $in: ['awaiting_placement', 'placed', 'active', 'paused', 'payment_review'] },
            })
              .sort({ createdAt: -1 })
              .populate({
                path: 'preferredTeacher',
                select: 'personalInfo.fullName user',
                populate: { path: 'user', select: 'name' },
              })
              .select('student planKey status sessionsRemaining sessionCount isScholarship preferredTeacher pricingSnapshot')
              .lean()
              .catch(() => [])
          : [],
        studentPageIds.length
          ? Guardian.find({ 'children.student': { $in: studentPageIds }, isActive: { $ne: false } })
              .select('children.student')
              .lean()
              .catch(() => [])
          : [],
        guardianPageIds.length
          ? Guardian.find({ user: { $in: guardianPageIds } })
              .select('user children.student')
              .lean()
              .catch(() => [])
          : [],
        StudentSubscription.distinct('student', { status: 'awaiting_placement' }).catch(() => []),
        StudentSubscription.distinct('student', {
          status: { $in: ['active', 'placed'] },
          sessionsRemaining: { $lte: 2 },
        }).catch(() => []),
        Guardian.distinct('children.student', { isActive: { $ne: false } }).catch(() => []),
      ]);

      const minorsWithoutGuardian = await User.countDocuments({
        role: 'student',
        isActive: { $ne: false },
        age: { $lt: 18 },
        ...(linkedChildIds.length ? { _id: { $nin: linkedChildIds } } : {}),
      }).catch(() => 0);

      pulse = {
        awaitingPlacement: awaitingStudentIds.length,
        lowBalance: lowBalanceStudentIds.length,
        minorsWithoutGuardian,
      };

      const subByStudent = new Map();
      for (const sub of pageSubs) {
        const sid = String(sub.student);
        if (!subByStudent.has(sid)) {
          subByStudent.set(sid, {
            _id: sub._id,
            planKey: sub.planKey,
            planNameAr: sub.pricingSnapshot?.nameAr || '',
            planNameEn: sub.pricingSnapshot?.nameEn || '',
            status: sub.status,
            sessionsRemaining: sub.sessionsRemaining,
            sessionCount: sub.sessionCount,
            isScholarship: Boolean(sub.isScholarship),
            teacherId: sub.preferredTeacher?._id || null,
            teacherName: sub.preferredTeacher ? teacherName(sub.preferredTeacher) : null,
          });
        }
      }

      const guardianCountByStudent = new Map();
      for (const gDoc of studentGuardianDocs) {
        for (const child of gDoc.children || []) {
          const cid = String(child.student);
          guardianCountByStudent.set(cid, (guardianCountByStudent.get(cid) || 0) + 1);
        }
      }

      const childrenCountByGuardian = new Map();
      for (const gDoc of guardianDocs) {
        childrenCountByGuardian.set(String(gDoc.user), (gDoc.children || []).length);
      }

      people = people.map((person) => {
        const pid = String(person._id);
        if (person.role === 'student') {
          return {
            ...person,
            activeSubscription: subByStudent.get(pid) || null,
            guardiansCount: guardianCountByStudent.get(pid) || 0,
          };
        }
        return {
          ...person,
          childrenCount: childrenCountByGuardian.get(pid) || 0,
        };
      });
    }

    return res.json({
      people,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: { student: studentCount, guardian: guardianCount },
      pulse,
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
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
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
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
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
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
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
    const resolvedAge = Math.min(100, Math.max(4, Number(age) || 12));

    // Admin-created accounts obey the same gender-separation and section rules
    // as self-registration (an adult male can never be filed under "ladies").
    try {
      assertGenderAndAgeCompatibility({
        student: { gender: resolvedGender, age: resolvedAge },
        section: resolvedSection,
      });
    } catch (safeguardErr) {
      return res.status(safeguardErr.status || 400).json({
        error: safeguardErr.publicMessage || 'بيانات القسم لا تتوافق مع جنس وعمر الطالب',
        code: safeguardErr.code || 'SAFEGUARDING_VIOLATION',
      });
    }

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
        age: resolvedAge,
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

    // A preferred tutor must exist, be approved, and be gender-compatible.
    let verifiedPreferredTeacherId = null;
    if (createSubscription && preferredTeacherId) {
      if (!mongoose.Types.ObjectId.isValid(String(preferredTeacherId))) {
        return res.status(400).json({ error: 'معرف المعلم المفضل غير صالح', code: 'INVALID_PREFERRED_TEACHER' });
      }
      const preferredTeacher = await Teacher.findOne({
        _id: preferredTeacherId,
        status: 'approved',
        isVerified: true,
      }).select('personalInfo.gender');
      if (!preferredTeacher) {
        return res.status(404).json({ error: 'المعلم المفضل غير موجود أو غير معتمد', code: 'PREFERRED_TEACHER_NOT_FOUND' });
      }
      try {
        assertGenderAndAgeCompatibility({
          student: { gender: resolvedGender, age: resolvedAge },
          teacher: preferredTeacher,
          section: resolvedSection,
        });
      } catch (safeguardErr) {
        return res.status(safeguardErr.status || 400).json({
          error: safeguardErr.publicMessage || 'المعلم المفضل لا يتوافق مع جنس وعمر الطالب',
          code: safeguardErr.code || 'SAFEGUARDING_VIOLATION',
        });
      }
      verifiedPreferredTeacherId = preferredTeacher._id;
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
      age: resolvedAge,
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
          preferredTeacher: verifiedPreferredTeacherId,
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
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
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
    const student = await User.findOne({ _id: req.params.id, role: 'student' }).select('+password +refreshTokenVersion +sessionsRevokedAt +guardianLinkCode');
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
        student.googleSubject = undefined;
        student.emailVerified = false;
      }
    }
    if (phone !== undefined) {
      student.phone = String(phone || '').trim() || undefined;
    }
    if (whatsappPhone !== undefined) {
      student.whatsappPhone = String(whatsappPhone || '').trim();
    }
    const demographicsEdited = (
      gender === 'male'
      || gender === 'female'
      || (enrollmentSection !== undefined && VALID_ENROLLMENT_SECTIONS.has(enrollmentSection))
      || (age !== undefined && Number.isFinite(Number(age)))
    );
    if (gender === 'male' || gender === 'female') {
      student.gender = gender;
    }
    if (enrollmentSection !== undefined && VALID_ENROLLMENT_SECTIONS.has(enrollmentSection)) {
      student.enrollmentSection = enrollmentSection;
    }
    if (age !== undefined && Number.isFinite(Number(age))) {
      student.age = Math.min(100, Math.max(4, Number(age)));
    }
    if ((Number(student.age) > 0 && Number(student.age) < 18) || student.enrollmentSection === 'children') {
      student.guardianLinkCode = undefined;
    }
    if (demographicsEdited) {
      try {
        if (student.gender && student.age != null && student.enrollmentSection) {
          assertGenderAndAgeCompatibility({
            student,
            section: student.enrollmentSection,
          });
        }
        if (Boolean(mongoose.connection?.db) || GroupCircle.find !== mongoose.Model.find) {
          const activeCircles = await GroupCircle.find({
            students: student._id,
            status: { $nin: ['completed'] },
          }).populate('teacher', 'personalInfo.gender');
          for (const circle of activeCircles || []) {
            assertGenderAndAgeCompatibility({
              student,
              teacher: circle.teacher,
              circleGender: circle.gender,
              section: student.enrollmentSection,
            });
          }
        }
        if (Boolean(mongoose.connection?.db) || Session.find !== mongoose.Model.find) {
          const activeSessions = await Session.find({
            $or: [{ student: student._id }, { 'attendance.student': student._id }],
            status: { $in: ['pending', 'accepted'] },
          }).populate('teacher', 'personalInfo.gender');
          for (const activeSession of activeSessions || []) {
            assertGenderAndAgeCompatibility({
              student,
              teacher: activeSession.teacher,
              section: student.enrollmentSection,
            });
          }
        }
        // Open subscriptions locked to a preferred tutor must stay compatible
        // too (e.g. a boy edited to adulthood while locked to a female tutor).
        if (Boolean(mongoose.connection?.db) || StudentSubscription.find !== mongoose.Model.find) {
          const lockedSubscriptions = await StudentSubscription.find({
            student: student._id,
            preferredTeacher: { $ne: null },
            status: { $nin: ['cancelled', 'expired', 'exhausted'] },
          }).populate('preferredTeacher', 'personalInfo.gender');
          for (const lockedSub of lockedSubscriptions || []) {
            if (!lockedSub?.preferredTeacher) continue;
            assertGenderAndAgeCompatibility({
              student,
              teacher: lockedSub.preferredTeacher,
              section: student.enrollmentSection,
            });
          }
        }
      } catch (compatErr) {
        return res.status(409).json({
          error: String(compatErr.publicMessage || compatErr.message || 'بيانات العمر أو الجنس تتعارض مع حلقة أو حصة نشطة للطالب'),
          code: compatErr.code || 'STUDENT_DEMOGRAPHICS_PLACEMENT_CONFLICT',
        });
      }
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
    let shouldRevokeSessions = false;
    if (typeof isActive === 'boolean') {
      if (isActive === false && student.isActive !== false) {
        shouldRevokeSessions = true;
      }
      student.isActive = isActive;
    }
    if (newPassword && String(newPassword).trim()) {
      if (String(newPassword).trim().length < 8) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
      }
      student.password = String(newPassword).trim();
      shouldRevokeSessions = true;
    }
    if (shouldRevokeSessions) {
      student.refreshTokenVersion = Number(student.refreshTokenVersion || 0) + 1;
      student.sessionsRevokedAt = new Date();
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
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
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
      GuardianInvitation.updateMany({ student: studentId, status: 'pending' }, { $set: { status: 'cancelled' } }),
      User.updateMany({ children: studentId }, { $pull: { children: studentId } }),
      StudentSubscription.updateMany(
        { student: studentId, status: { $nin: ['completed', 'cancelled'] } },
        { $set: { status: 'cancelled', circle: null } }
      ),
      Session.updateMany(
        { student: studentId, type: { $ne: 'group_circle' }, status: { $in: ['pending', 'accepted', 'scheduled'] } },
        { $set: { status: 'cancelled' } }
      ),
      Session.updateMany(
        { type: 'group_circle', status: { $in: ['pending', 'accepted', 'scheduled'] }, 'attendance.student': studentId },
        { $pull: { attendance: { student: studentId } } }
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
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
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
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.patch('/students/:id/subscriptions/:subId', async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) {
      return res.status(400).json({
        error: 'يرجى كتابة سبب واضح للتعديل في سجل التدقيق (3 أحرف على الأقل)',
        code: 'AUDIT_REASON_REQUIRED',
      });
    }

    if (isMockMode && !isDBConnected()) {
      const mockStudent = findMockUserById(req.params.id);
      if (!mockStudent || mockStudent.role !== 'student') {
        return res.status(404).json({ error: 'الطالب غير موجود' });
      }
      const sub = getMockSubscriptions().find(
        (s) => String(s._id) === String(req.params.subId) && String(s.student?._id || s.student) === String(mockStudent._id)
      );
      if (!sub) return res.status(404).json({ error: 'الاشتراك غير موجود' });

      if (action === 'change-teacher') {
        sub.preferredTeacher = req.body?.preferredTeacherId || null;
      } else if (action === 'restore-credit') {
        if (Number(sub.sessionsUsed || 0) <= 0) {
          return res.status(409).json({ error: 'لا توجد حصص مستهلكة لاستعادتها في هذه الباقة', code: 'NO_CONSUMED_CREDITS' });
        }
        sub.sessionsUsed = Math.max(0, Number(sub.sessionsUsed || 0) - 1);
        sub.sessionsRemaining = Number(sub.sessionsRemaining || 0) + 1;
        if (sub.status === 'completed') sub.status = sub.circle ? 'active' : 'awaiting_placement';
      } else if (action === 'deduct-credit') {
        if (Number(sub.sessionsRemaining || 0) <= 0) {
          return res.status(409).json({ error: 'لا يوجد رصيد متبقٍ لخصمه', code: 'NO_REMAINING_CREDITS' });
        }
        sub.sessionsUsed = Number(sub.sessionsUsed || 0) + 1;
        sub.sessionsRemaining = Math.max(0, Number(sub.sessionsRemaining || 0) - 1);
        if (sub.sessionsRemaining === 0) sub.status = 'completed';
      } else if (action === 'set-status') {
        const nextStatus = String(req.body?.status || '').trim();
        if (!['paused', 'active', 'cancelled'].includes(nextStatus)) {
          return res.status(400).json({ error: 'الحالة المطلوبة غير مدعومة' });
        }
        sub.status = nextStatus === 'active' && !sub.circle ? 'awaiting_placement' : nextStatus;
        if (nextStatus === 'cancelled') sub.circle = null;
      } else {
        return res.status(400).json({ error: 'إجراء الاشتراك غير مدعوم' });
      }
      return res.json({ success: true, subscription: sub });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.subId)) {
      return res.status(400).json({ error: 'معرف الطالب أو الاشتراك غير صالح' });
    }

    const [student, sub] = await Promise.all([
      User.findOne({ _id: req.params.id, role: 'student' }),
      StudentSubscription.findOne({ _id: req.params.subId, student: req.params.id }),
    ]);

    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    if (!sub) return res.status(404).json({ error: 'الاشتراك غير موجود' });

    const now = new Date();
    let auditAction = 'student.subscription.updated';
    const metadata = { subscriptionId: String(sub._id), action };

    if (action === 'change-teacher') {
      const rawTeacherId = String(req.body?.preferredTeacherId || '').trim();
      if (!rawTeacherId) {
        const previousTeacher = sub.preferredTeacher ? String(sub.preferredTeacher) : null;
        sub.preferredTeacher = null;
        auditAction = 'student.subscription.teacher-unlocked';
        metadata.previousTeacher = previousTeacher;
      } else {
        if (!mongoose.Types.ObjectId.isValid(rawTeacherId)) {
          return res.status(400).json({ error: 'معرف المعلم غير صالح', code: 'INVALID_TEACHER_ID' });
        }
        const nextTeacher = await Teacher.findOne({
          _id: rawTeacherId,
          status: 'approved',
          isVerified: true,
        }).select('personalInfo.gender personalInfo.fullName');
        if (!nextTeacher) {
          return res.status(404).json({ error: 'المعلم المختار غير موجود أو غير معتمد', code: 'TEACHER_NOT_APPROVED' });
        }
        try {
          assertGenderAndAgeCompatibility({
            student,
            teacher: nextTeacher,
            section: sub.section || student.enrollmentSection,
          });
        } catch (safeguardErr) {
          return res.status(safeguardErr.status || 409).json({
            error: safeguardErr.publicMessage || 'المعلم المختار لا يتوافق مع جنس وعمر الطالب',
            code: safeguardErr.code || 'SAFEGUARDING_VIOLATION',
          });
        }

        if (sub.circle) {
          const currentCircle = await GroupCircle.findById(sub.circle).select('teacher students').lean();
          if (currentCircle && String(currentCircle.teacher) !== String(nextTeacher._id)) {
            await Promise.all([
              GroupCircle.updateOne({ _id: sub.circle }, { $pull: { students: student._id } }),
              User.updateOne({ _id: student._id, circle: sub.circle }, { $unset: { circle: 1 } }),
              Session.updateMany(
                {
                  circle: sub.circle,
                  status: { $in: ['pending', 'accepted'] },
                  scheduledAt: { $gt: now },
                },
                { $pull: { attendance: { student: student._id } } }
              ),
            ]);
            sub.circle = null;
            if (['placed', 'active'].includes(sub.status)) {
              sub.status = 'awaiting_placement';
            }
            metadata.detachedFromCircle = String(currentCircle._id);
          }
        }

        await Session.updateMany(
          {
            student: student._id,
            type: 'regular',
            status: { $in: ['pending', 'accepted'] },
            scheduledAt: { $gt: now },
          },
          { $set: { teacher: nextTeacher._id } }
        );

        sub.preferredTeacher = nextTeacher._id;
        auditAction = 'student.subscription.teacher-changed';
        metadata.nextTeacherId = String(nextTeacher._id);
      }
      await sub.save();
    } else if (action === 'restore-credit') {
      if (Number(sub.sessionsUsed || 0) <= 0) {
        return res.status(409).json({
          error: 'لا توجد حصص مستهلكة لاستعادتها كتعويض في هذه الباقة (الرصيد كامل بالفعل)',
          code: 'NO_CONSUMED_CREDITS',
        });
      }
      sub.sessionsUsed = Math.max(0, Number(sub.sessionsUsed) - 1);
      sub.sessionsRemaining = Math.min(sub.sessionCount, Number(sub.sessionsRemaining) + 1);
      if (sub.status === 'completed' && sub.sessionsRemaining > 0) {
        sub.status = sub.circle ? 'active' : 'awaiting_placement';
        sub.completedAt = undefined;
      }
      await sub.save();
      auditAction = 'student.subscription.credit-restored';
      metadata.sessionsRemaining = sub.sessionsRemaining;
    } else if (action === 'deduct-credit') {
      if (Number(sub.sessionsRemaining || 0) <= 0) {
        return res.status(409).json({
          error: 'لا يوجد رصيد حصص متبقٍ لخصمه من هذه الباقة',
          code: 'NO_REMAINING_CREDITS',
        });
      }
      sub.sessionsUsed = Math.min(sub.sessionCount, Number(sub.sessionsUsed || 0) + 1);
      sub.sessionsRemaining = Math.max(0, Number(sub.sessionsRemaining) - 1);
      if (sub.sessionsRemaining === 0) {
        sub.status = 'completed';
        sub.completedAt = now;
      }
      await sub.save();
      auditAction = 'student.subscription.credit-deducted';
      metadata.sessionsRemaining = sub.sessionsRemaining;
    } else if (action === 'upgrade-package') {
      const nextCount = Number(req.body?.sessionCount);
      if (![4, 8, 12, 24].includes(nextCount) || nextCount < Number(sub.sessionsUsed || 0)) {
        return res.status(400).json({
          error: 'حجم الباقة الجديد غير صالح أو أقل من عدد الحصص المستهلكة فعلياً',
          code: 'INVALID_PACKAGE_SIZE',
        });
      }
      sub.sessionCount = nextCount;
      sub.sessionsRemaining = nextCount - Number(sub.sessionsUsed || 0);
      if (!sub.isScholarship) {
        sub.totalAmountMinor = Number(sub.pricePerSessionMinor || 0) * nextCount;
      }
      if (sub.status === 'completed' && sub.sessionsRemaining > 0) {
        sub.status = sub.circle ? 'active' : 'awaiting_placement';
      }
      await sub.save();
      auditAction = 'student.subscription.package-resized';
      metadata.sessionCount = sub.sessionCount;
      metadata.sessionsRemaining = sub.sessionsRemaining;
    } else if (action === 'set-status') {
      const requestedStatus = String(req.body?.status || '').trim();
      if (!['paused', 'active', 'cancelled'].includes(requestedStatus)) {
        return res.status(400).json({ error: 'حالة الاشتراك المطلوبة غير مدعومة' });
      }
      if (['completed', 'cancelled', 'expired'].includes(sub.status) && requestedStatus !== sub.status) {
        return res.status(409).json({
          error: 'لا يمكن إعادة فتح اشتراك منتهٍ أو ملغى؛ أنشئ اشتراكاً أو منحة جديدة',
          code: 'SUBSCRIPTION_TERMINAL_STATE',
        });
      }
      if (requestedStatus === 'cancelled') {
        const oldCircleId = sub.circle;
        sub.status = 'cancelled';
        sub.circle = null;
        await sub.save();
        if (oldCircleId) {
          await Promise.all([
            GroupCircle.updateOne({ _id: oldCircleId }, { $pull: { students: student._id } }),
            User.updateOne({ _id: student._id, circle: oldCircleId }, { $unset: { circle: 1 } }),
            Session.updateMany(
              { circle: oldCircleId, status: { $in: ['pending', 'accepted'] }, scheduledAt: { $gt: now } },
              { $pull: { attendance: { student: student._id } } }
            ),
          ]);
        }
      } else if (requestedStatus === 'paused') {
        sub.status = 'paused';
        await sub.save();
      } else {
        sub.status = sub.circle ? 'active' : 'awaiting_placement';
        await sub.save();
      }
      auditAction = `student.subscription.status-${sub.status}`;
    } else {
      return res.status(400).json({ error: 'إجراء الاشتراك غير معروف' });
    }

    await logAdminAction({
      req,
      action: auditAction,
      entityType: 'student',
      entityId: String(student._id),
      reason,
      metadata,
    }).catch(() => {});

    return res.json({ success: true, subscription: sub });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/students/:id/scholarships', async (req, res) => {
  try {
    const planKey = String(req.body?.planKey || 'group').trim();
    const sessionCount = [4, 8, 12, 24].includes(Number(req.body?.sessionCount)) ? Number(req.body?.sessionCount) : 8;
    const preferredTeacherId = String(req.body?.preferredTeacherId || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 300);

    if (reason.length < 3) {
      return res.status(400).json({
        error: 'يرجى تسجيل سبب المنحة الدراسية في سجل التدقيق',
        code: 'AUDIT_REASON_REQUIRED',
      });
    }

    if (isMockMode && !isDBConnected()) {
      const mockStudent = findMockUserById(req.params.id);
      if (!mockStudent || mockStudent.role !== 'student') {
        return res.status(404).json({ error: 'الطالب غير موجود' });
      }
      const created = addMockSubscription({
        student: mockStudent._id,
        planKey,
        section: mockStudent.enrollmentSection || (mockStudent.gender === 'female' ? 'ladies' : 'men_children'),
        sessionCount,
        sessionsUsed: 0,
        sessionsRemaining: sessionCount,
        currency: 'EGP',
        pricePerSessionMinor: 0,
        totalAmountMinor: 0,
        isScholarship: true,
        status: 'awaiting_placement',
        preferredTeacher: preferredTeacherId || null,
        paidAt: new Date(),
      });
      return res.status(201).json({ success: true, subscription: created });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const existingOpen = await StudentSubscription.findOne({
      student: student._id,
      status: { $in: ['awaiting_placement', 'placed', 'active', 'paused'] },
    }).select('_id status');
    if (existingOpen) {
      return res.status(409).json({
        error: 'لدى الطالب اشتراك مفتوح بالفعل؛ عدّل الاشتراك الحالي أو ألغِه قبل منح باقة جديدة',
        code: 'SUBSCRIPTION_ALREADY_OPEN',
      });
    }

    const resolvedSection = VALID_ENROLLMENT_SECTIONS.has(student.enrollmentSection)
      ? student.enrollmentSection
      : (student.gender === 'female' ? 'ladies' : 'men_children');

    let verifiedTeacherId = null;
    if (preferredTeacherId) {
      if (!mongoose.Types.ObjectId.isValid(preferredTeacherId)) {
        return res.status(400).json({ error: 'معرف المعلم غير صالح' });
      }
      const teacherDoc = await Teacher.findOne({ _id: preferredTeacherId, status: 'approved', isVerified: true }).select('personalInfo.gender');
      if (!teacherDoc) {
        return res.status(404).json({ error: 'المعلم المختار غير موجود أو غير معتمد' });
      }
      try {
        assertGenderAndAgeCompatibility({
          student,
          teacher: teacherDoc,
          section: resolvedSection,
        });
      } catch (safeguardErr) {
        return res.status(safeguardErr.status || 409).json({
          error: safeguardErr.publicMessage || 'المعلم المختار لا يتوافق مع جنس وعمر الطالب',
          code: safeguardErr.code || 'SAFEGUARDING_VIOLATION',
        });
      }
      verifiedTeacherId = teacherDoc._id;
    }

    const plan = getSubscriptionPlan(planKey) || getSubscriptionPlan('group');
    const createdSub = await StudentSubscription.create({
      student: student._id,
      planKey: plan.key,
      section: resolvedSection,
      sessionCount,
      sessionsUsed: 0,
      sessionsRemaining: sessionCount,
      currency: 'EGP',
      pricePerSessionMinor: 0,
      totalAmountMinor: 0,
      isScholarship: true,
      status: 'awaiting_placement',
      preferredTeacher: verifiedTeacherId,
      paidAt: new Date(),
      pricingSnapshot: {
        minStudents: plan.minStudents,
        maxStudents: plan.maxStudents,
        durationMinMinutes: plan.durationMinMinutes,
        durationMaxMinutes: plan.durationMaxMinutes,
        nameAr: plan.nameAr || plan.name?.ar,
        nameEn: plan.nameEn || plan.name?.en,
        durationLabelAr: plan.durationLabelAr || plan.durationLabel?.ar,
        durationLabelEn: plan.durationLabelEn || plan.durationLabel?.en,
      },
    });

    await logAdminAction({
      req,
      action: 'student.scholarship.granted',
      entityType: 'student',
      entityId: String(student._id),
      reason,
      metadata: {
        subscriptionId: String(createdSub._id),
        planKey: plan.key,
        sessionCount,
        preferredTeacherId: verifiedTeacherId ? String(verifiedTeacherId) : null,
      },
    }).catch(() => {});

    return res.status(201).json({ success: true, subscription: createdSub });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.put('/guardians/:id', async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const mockGuardian = findMockUserById(req.params.id);
      if (!mockGuardian || mockGuardian.role !== 'guardian') {
        return res.status(404).json({ error: 'ولي الأمر غير موجود' });
      }
      const { name, email, phone, isActive, newPassword } = req.body || {};
      if (typeof name === 'string' && name.trim()) mockGuardian.name = name.trim();
      if (typeof email === 'string' && email.trim()) mockGuardian.email = email.toLowerCase().trim();
      if (phone !== undefined) mockGuardian.phone = String(phone || '').trim();
      if (typeof isActive === 'boolean') mockGuardian.isActive = isActive;
      if (newPassword && String(newPassword).trim().length >= 8) mockGuardian.password = String(newPassword).trim();
      return res.json({ success: true, guardian: mockGuardian });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid guardian id' });
    }

    const guardianUser = await User.findOne({ _id: req.params.id, role: 'guardian' })
      .select('+password +refreshTokenVersion +sessionsRevokedAt');
    if (!guardianUser) return res.status(404).json({ error: 'ولي الأمر غير موجود' });

    const { name, email, phone, isActive, newPassword, adminReason } = req.body || {};
    if (typeof name === 'string' && name.trim()) {
      guardianUser.name = name.trim();
    }
    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== guardianUser.email) {
        const dup = await User.findOne({ email: normalizedEmail, _id: { $ne: guardianUser._id } });
        if (dup) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل لحساب آخر' });
        guardianUser.email = normalizedEmail;
        guardianUser.googleSubject = undefined;
        guardianUser.emailVerified = false;
      }
    }
    if (phone !== undefined && String(phone).trim()) {
      guardianUser.phone = String(phone).trim();
    }

    let revokeSessions = false;
    if (typeof isActive === 'boolean') {
      if (isActive === false && guardianUser.isActive !== false) revokeSessions = true;
      guardianUser.isActive = isActive;
      await Guardian.updateOne({ user: guardianUser._id }, { $set: { isActive } }).catch(() => {});
    }
    if (newPassword && String(newPassword).trim()) {
      if (String(newPassword).trim().length < 8) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
      }
      guardianUser.password = String(newPassword).trim();
      revokeSessions = true;
    }
    if (revokeSessions) {
      guardianUser.refreshTokenVersion = Number(guardianUser.refreshTokenVersion || 0) + 1;
      guardianUser.sessionsRevokedAt = new Date();
    }

    await guardianUser.save();

    await logAdminAction({
      req,
      action: 'guardian.admin-profile.updated',
      entityType: 'guardian',
      entityId: String(guardianUser._id),
      reason: String(adminReason || 'تحديث حساب ولي الأمر من Family 360').trim().slice(0, 200),
      metadata: {
        fields: Object.keys(req.body || {}).filter((k) => !['newPassword', 'password', 'adminReason'].includes(k)),
      },
    }).catch(() => {});

    return res.json({ success: true, guardian: guardianUser });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/guardians/:id/link-student', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid guardian id' });
    }
    const relationship = ['father', 'mother', 'guardian', 'other'].includes(req.body?.relationship)
      ? req.body.relationship
      : 'guardian';
    const studentQuery = String(req.body?.studentIdentifier || req.body?.studentId || '').trim();
    const reason = String(req.body?.reason || 'ربط إداري مباشر بين ولي الأمر والطالب').trim().slice(0, 240);

    if (!studentQuery) {
      return res.status(400).json({ error: 'أدخل بريد الطالب أو معرّفه للربط' });
    }

    const guardianUser = await User.findOne({ _id: req.params.id, role: 'guardian' });
    if (!guardianUser) return res.status(404).json({ error: 'ولي الأمر غير موجود' });

    const studentFilter = mongoose.Types.ObjectId.isValid(studentQuery)
      ? { _id: studentQuery, role: 'student' }
      : { email: studentQuery.toLowerCase(), role: 'student' };
    const student = await User.findOne(studentFilter);
    if (!student) {
      return res.status(404).json({ error: 'لم يُعثر على حساب طالب بهذا البريد أو المعرّف' });
    }

    let guardianProfile = await Guardian.findOne({ user: guardianUser._id });
    if (!guardianProfile) {
      guardianProfile = await Guardian.create({
        user: guardianUser._id,
        isActive: guardianUser.isActive !== false,
        children: [],
      });
    }

    const alreadyLinked = (guardianProfile.children || []).some(
      (c) => String(c.student) === String(student._id)
    );
    if (alreadyLinked) {
      return res.status(409).json({ error: 'هذا الطالب مرتبط بالفعل بحساب ولي الأمر' });
    }

    await guardianProfile.addChild(student._id, relationship, {
      viewProgress: true,
      viewGrades: true,
      viewAttendance: true,
      receiveNotifications: true,
      approveEnrollments: Boolean(Number(student.age) < 18 || req.body?.approveEnrollments),
    });

    await Promise.all([
      User.findByIdAndUpdate(guardianUser._id, { $addToSet: { children: student._id } }),
      User.findByIdAndUpdate(student._id, {
        $set: {
          guardian: guardianUser._id,
          'privacyConsent.parentalConsentVerified': true,
          'privacyConsent.parentalConsentAt': new Date(),
        },
      }),
      GuardianInvitation.updateMany(
        { student: student._id, status: 'pending' },
        { $set: { status: 'accepted', respondedBy: guardianUser._id, respondedAt: new Date() } }
      ),
    ]);

    await logAdminAction({
      req,
      action: 'guardian.student-linked-by-admin',
      entityType: 'guardian',
      entityId: String(guardianUser._id),
      reason,
      metadata: { studentId: String(student._id), relationship },
    }).catch(() => {});

    return res.status(201).json({ success: true, studentId: String(student._id) });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.delete('/guardians/:id/unlink-student/:studentId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid guardian or student id' });
    }
    const guardianProfile = await Guardian.findOne({
      user: req.params.id,
      'children.student': req.params.studentId,
    });
    if (!guardianProfile) {
      return res.status(404).json({ error: 'الربط غير موجود' });
    }

    await guardianProfile.removeChild(req.params.studentId);
    await User.findByIdAndUpdate(req.params.id, { $pull: { children: req.params.studentId } });

    const alternateGuardian = await Guardian.findOne({
      user: { $ne: req.params.id },
      'children.student': req.params.studentId,
      isActive: { $ne: false },
    }).select('user');

    if (alternateGuardian?.user) {
      await User.updateOne(
        { _id: req.params.studentId, guardian: req.params.id },
        { $set: { guardian: alternateGuardian.user } }
      );
    } else {
      await User.updateOne(
        { _id: req.params.studentId, guardian: req.params.id },
        { $unset: { guardian: 1 }, $set: { 'privacyConsent.parentalConsentVerified': false } }
      );
    }

    await logAdminAction({
      req,
      action: 'guardian.student-unlinked-by-admin',
      entityType: 'guardian',
      entityId: String(req.params.id),
      reason: String(req.query?.reason || req.body?.reason || 'فك ربط طالب من حساب ولي الأمر').trim().slice(0, 240),
      metadata: { studentId: String(req.params.studentId) },
    }).catch(() => {});

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/guardian-links/:invitationId/action', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.invitationId)) {
      return res.status(400).json({ error: 'Invalid invitation id' });
    }
    const action = String(req.body?.action || '').trim();
    if (!['cancel', 'approve'].includes(action)) {
      return res.status(400).json({ error: 'الإجراء المطلوب غير مدعوم' });
    }

    const invitation = await GuardianInvitation.findById(req.params.invitationId)
      .select('+guardianPhone +guardianPhoneNormalized');
    if (!invitation) return res.status(404).json({ error: 'دعوة الربط غير موجودة' });
    if (invitation.status !== 'pending') {
      return res.status(409).json({ error: 'هذه الدعوة لم تعد معلقة' });
    }

    if (action === 'cancel') {
      invitation.status = 'cancelled';
      invitation.respondedAt = new Date();
      await invitation.save();

      await logAdminAction({
        req,
        action: 'guardian-links.cancelled-by-admin',
        entityType: 'guardian-links',
        entityId: String(invitation._id),
        reason: String(req.body?.reason || 'إلغاء دعوة ربط ولي أمر معلقة من الإدارة').slice(0, 240),
        metadata: { studentId: String(invitation.student) },
      }).catch(() => {});

      return res.json({ success: true, status: 'cancelled' });
    }

    // action === 'approve': find matching active guardian user by normalized phone or supplied guardianEmail
    const suppliedEmail = String(req.body?.guardianEmail || '').trim().toLowerCase();
    let guardianUser = null;
    if (suppliedEmail) {
      guardianUser = await User.findOne({ email: suppliedEmail, role: 'guardian', isActive: { $ne: false } });
    } else if (invitation.guardianPhoneNormalized) {
      const matches = await User.find({
        role: 'guardian',
        isActive: { $ne: false },
        phoneNormalized: invitation.guardianPhoneNormalized,
      }).limit(2);
      if (matches.length === 1) guardianUser = matches[0];
    }

    if (!guardianUser) {
      return res.status(404).json({
        error: 'لا يوجد حساب ولي أمر مسجل يطابق رقم الهاتف بعد؛ اطلب من ولي الأمر إنشاء حسابه أولاً أو أدخل بريده الإلكتروني',
        code: 'GUARDIAN_ACCOUNT_NOT_FOUND',
      });
    }

    let guardianProfile = await Guardian.findOne({ user: guardianUser._id });
    if (!guardianProfile) {
      guardianProfile = await Guardian.create({ user: guardianUser._id, isActive: true, children: [] });
    }
    const alreadyLinked = (guardianProfile.children || []).some(
      (c) => String(c.student) === String(invitation.student)
    );
    if (!alreadyLinked) {
      await guardianProfile.addChild(invitation.student, invitation.relationship || 'guardian', {
        viewProgress: true,
        viewGrades: true,
        viewAttendance: true,
        receiveNotifications: true,
      });
    }

    invitation.status = 'accepted';
    invitation.respondedBy = guardianUser._id;
    invitation.respondedAt = new Date();
    await Promise.all([
      invitation.save(),
      User.findByIdAndUpdate(guardianUser._id, { $addToSet: { children: invitation.student } }),
      User.findByIdAndUpdate(invitation.student, {
        $set: {
          guardian: guardianUser._id,
          'privacyConsent.parentalConsentVerified': true,
          'privacyConsent.parentalConsentAt': new Date(),
        },
      }),
    ]);

    await logAdminAction({
      req,
      action: 'guardian-links.approved-by-admin',
      entityType: 'guardian-links',
      entityId: String(invitation._id),
      reason: String(req.body?.reason || 'اعتماد ربط ولي الأمر بالطالب من الإدارة').slice(0, 240),
      metadata: { studentId: String(invitation.student), guardianId: String(guardianUser._id) },
    }).catch(() => {});

    return res.json({ success: true, status: 'accepted', guardianId: String(guardianUser._id) });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
