const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Guardian = require('../models/Guardian');
const User = require('../models/User');
const Student = require('../models/Student');
const Session = require('../models/Session');
const GroupCircle = require('../models/GroupCircle');
const LiveSession = require('../models/LiveSession');
const Progress = require('../models/Progress');
const TeacherTask = require('../models/TeacherTask');
const GuardianInvitation = require('../models/GuardianInvitation');
const StudentSubscription = require('../models/StudentSubscription');
const { protect, authorize } = require('../middleware/auth');
const { findChildAccess, hasChildPermission } = require('../utils/guardianSafeguarding');
const { normalizePhone, maskPhone } = require('../utils/phone');
const { linkGuardianToStudent, expireStaleInvitations } = require('../services/guardianInvitations');
const { notifyUser } = require('../utils/notify');


const isDBConnected = () => mongoose.connection.readyState === 1;
const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

async function getGuardianProfile(userId, { populateChildren = false } = {}) {
  let query = Guardian.findOne({ user: userId });
  if (populateChildren) {
    query = query.populate({
      path: 'children.student',
      select: 'name email avatar circle currentLevel preferredTrack',
    });
  }

  let guardian = await query;
  if (guardian?.children?.length) return guardian;

  // One-time compatibility bridge for accounts created before Guardian became
  // the canonical relationship store.
  const legacyUser = await User.findById(userId).select('children');
  if (!legacyUser?.children?.length) return guardian;

  if (!guardian) guardian = new Guardian({ user: userId, children: [] });
  const existing = new Set((guardian.children || []).map((entry) => String(entry.student)));

  for (const childId of legacyUser.children) {
    if (!existing.has(String(childId))) {
      guardian.children.push({
        student: childId,
        relationship: 'guardian',
        permissions: {
          viewProgress: true,
          viewGrades: true,
          viewAttendance: true,
          receiveNotifications: true,
          approveEnrollments: false,
        },
      });
    }
  }

  await guardian.save();
  if (populateChildren) {
    await guardian.populate({
      path: 'children.student',
      select: 'name email avatar circle currentLevel preferredTrack',
    });
  }
  return guardian;
}

function childMatchesSession(child, session) {
  if (!child?._id || !session) return false;
  const childId = String(child._id);
  if (session.student && String(session.student) === childId) return true;
  if ((session.attendance || []).some((entry) => entry.student && String(entry.student) === childId)) return true;
  if (child.circle && session.circle) {
    const sessionCircleId = session.circle?._id || session.circle;
    if (String(child.circle) === String(sessionCircleId)) return true;
  }
  return false;
}

/**
 * @route   GET /api/guardian/children
 * @desc    جلب أبناء ولي الأمر المسجلين مع تفاصيل حلقاتهم ونسب الحضور وآخر التقييمات
 * @access  Private (Guardian, Admin)
 */
router.get('/children', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.status(503).json({ error: 'Guardian data is temporarily unavailable' });
    }

    let guardian = await Guardian.findOne({ user: req.user.id })
      .populate({
        path: 'children.student',
        select: 'name email phone avatar circle currentLevel preferredTrack'
      });

    // If guardian document doesn't exist yet, look up in User.children
    if (!guardian) {
      const user = await User.findById(req.user.id).populate('children', 'name email phone avatar circle currentLevel preferredTrack');
      if (user && user.children && user.children.length > 0) {
        guardian = new Guardian({
          user: req.user.id,
          children: user.children.map(child => ({
            student: child._id,
            relationship: 'guardian'
          }))
        });
        await guardian.save();
        await guardian.populate({
          path: 'children.student',
          select: 'name email phone avatar circle currentLevel preferredTrack'
        });
      }
    }

    if (!guardian || !guardian.children || guardian.children.length === 0) {
      return res.json({
        success: true,
        children: []
      });
    }

    const childrenDetails = await Promise.all(guardian.children.map(async (childItem) => {
      const studentUser = childItem.student;
      if (!studentUser) return null;

      const studentId = studentUser._id;

      const access = findChildAccess(guardian, studentId);
      const permissions = access?.permissions || {
        viewProgress: false,
        viewGrades: false,
        viewAttendance: false,
        receiveNotifications: false,
        approveEnrollments: false,
      };

      // Query only the data this guardian is currently allowed to view.
      const studentProfile = permissions.viewProgress
        ? await Student.findOne({ user: studentId }).lean()
        : null;

      // Circle membership is needed for scheduling context and does not expose grades.
      let circleInfo = null;
      if (studentUser.circle) {
        circleInfo = await GroupCircle.findById(studentUser.circle)
          .select('name level schedule capacity')
          .lean();
      }

      let totalSessions = 0;
      let attendedSessions = 0;
      let excusedSessions = 0;
      let absentSessions = 0;

      if (permissions.viewAttendance) {
        const now = new Date();
        const sessions = await Session.find({
          $or: [
            { student: studentId },
            { 'attendance.student': studentId }
          ],
          status: { $in: ['completed', 'accepted'] }
        }).select('scheduledAt status attendance').lean();

        sessions.forEach((sess) => {
          const isEligible = sess.status === 'completed' || (sess.scheduledAt && new Date(sess.scheduledAt) <= now);
          if (!isEligible) {
            return;
          }

          totalSessions += 1;
          const att = sess.attendance?.find(
            (entry) => entry.student && entry.student.toString() === studentId.toString()
          );
          if (att) {
            if (att.status === 'attended') attendedSessions += 1;
            else if (att.status === 'excused') excusedSessions += 1;
            else if (att.status === 'absent') absentSessions += 1;
            else if (sess.status === 'completed') attendedSessions += 1;
          } else if (sess.status === 'completed') {
            attendedSessions += 1;
          }
        });
      }

      const attendanceRate = permissions.viewAttendance && totalSessions > 0
        ? Math.round((attendedSessions / totalSessions) * 100)
        : null;

      let latestReport = null;
      if (permissions.viewGrades) {
        const sessionWithReport = await Session.findOne({
          $or: [
            { student: studentId },
            { 'studentReports.student': studentId }
          ],
          'studentReports.0': { $exists: true }
        }).sort({ scheduledAt: -1 }).lean();

        if (sessionWithReport?.studentReports) {
          const rep = sessionWithReport.studentReports.find(
            (entry) => entry.student && entry.student.toString() === studentId.toString()
          );
          if (rep) {
            latestReport = {
              memorizationScore: rep.memorizationScore,
              tajweedScore: rep.tajweedScore,
              surahRecited: rep.surahRecited,
              fromAyah: rep.fromAyah,
              toAyah: rep.toAyah,
              nextHomework: rep.nextHomework,
              notes: rep.notes,
              date: sessionWithReport.scheduledAt
            };
          }
        }
      }

      const progressList = permissions.viewProgress
        ? await Progress.find({ student: studentId }).populate('course', 'title').lean()
        : [];

      const latestSubscription = await StudentSubscription.findOne({
        student: studentId,
      }).sort({ createdAt: -1 }).lean();

      return {
        studentId: studentUser._id,
        name: studentUser.name,
        email: studentUser.email,
        phone: studentUser.phone,
        avatar: studentUser.avatar,
        relationship: childItem.relationship,
        permissions,
        circle: circleInfo,
        studentProfile: permissions.viewProgress ? {
          plan: studentProfile?.plan || 'حفظ القرآن الكريم',
          currentSurah: studentProfile?.currentSurah || 'سورة الفاتحة',
          points: studentProfile?.points || 0,
          streak: studentProfile?.streak || 0,
          level: studentProfile?.level || studentUser.currentLevel || 'مبتدئ'
        } : null,
        attendance: permissions.viewAttendance ? {
          rate: attendanceRate,
          total: totalSessions,
          attended: attendedSessions,
          excused: excusedSessions,
          absent: absentSessions
        } : null,
        latestEvaluation: permissions.viewGrades ? latestReport : null,
        coursesProgress: permissions.viewProgress ? progressList.map(p => ({
          courseTitle: p.course?.title,
          percentage: p.overallProgress?.percentage || 0
        })) : [],
        subscription: latestSubscription ? {
          _id: latestSubscription._id,
          planKey: latestSubscription.planKey,
          section: latestSubscription.section,
          sessionCount: latestSubscription.sessionCount,
          sessionsRemaining: latestSubscription.sessionsRemaining,
          sessionsUsed: latestSubscription.sessionsUsed,
          status: latestSubscription.status,
          currency: latestSubscription.currency || 'EGP',
          pricePerSessionMinor: latestSubscription.pricePerSessionMinor,
          totalAmountMinor: latestSubscription.totalAmountMinor,
          expiresAt: latestSubscription.expiresAt,
          updatedAt: latestSubscription.updatedAt
        } : null
      };
    }));

    res.json({
      success: true,
      children: childrenDetails.filter(Boolean)
    });
  } catch (error) {
    console.error('Get guardian children error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات الأبناء' });
  }
});

/**
 * @route   GET /api/guardian/family-overview
 * @desc    Lightweight multi-child family command center
 * @access  Private (Guardian)
 */
router.get('/family-overview', protect, authorize('guardian'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.status(503).json({ error: 'Guardian data is temporarily unavailable' });
    }

    const guardian = await getGuardianProfile(req.user.id, { populateChildren: true });
    const entries = (guardian?.children || []).filter((entry) => entry.student?._id);
    if (!entries.length) {
      return res.json({
        success: true,
        summary: { totalChildren: 0, upcomingSessions: 0, pendingHomework: 0, needsAttention: 0 },
        children: [],
      });
    }

    const childIds = entries.map((entry) => entry.student._id);
    const circleIds = entries.map((entry) => entry.student.circle).filter(Boolean);
    const now = new Date();

    const [futureSessions, tasks, recentCompleted] = await Promise.all([
      Session.find({
        $or: [
          { student: { $in: childIds } },
          { circle: { $in: circleIds } },
          { 'attendance.student': { $in: childIds } },
        ],
        scheduledAt: { $gte: now },
        status: { $in: ['pending', 'accepted'] },
      })
        .populate({
          path: 'teacher',
          select: 'personalInfo.fullName media.profilePhoto user',
          populate: { path: 'user', select: 'name avatar' },
        })
        .populate('circle', 'name')
        .sort({ scheduledAt: 1 })
        .limit(100)
        .lean(),
      TeacherTask.find({
        student: { $in: childIds },
        status: { $in: ['pending', 'submitted'] },
      })
        .select('student title type dueDate status teacherFeedback createdAt updatedAt')
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
      Session.find({
        $or: [
          { student: { $in: childIds } },
          { 'studentReports.student': { $in: childIds } },
        ],
        status: 'completed',
      })
        .select('student scheduledAt attendance studentReports')
        .sort({ scheduledAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const cards = entries.map((entry) => {
      const student = entry.student;
      const studentId = String(student._id);
      const permissions = findChildAccess(guardian, studentId)?.permissions || {};

      const childSessions = futureSessions.filter((session) => childMatchesSession(student, session));
      const childTasks = tasks.filter((task) => String(task.student) === studentId);
      const pendingHomework = permissions.viewProgress
        ? childTasks.filter((task) => task.status === 'pending').length
        : null;
      const submittedHomework = permissions.viewProgress
        ? childTasks.filter((task) => task.status === 'submitted').length
        : null;

      let latestReport = null;
      if (permissions.viewGrades) {
        for (const session of recentCompleted) {
          const report = (session.studentReports || []).find(
            (item) => item.student && String(item.student) === studentId,
          );
          if (report) {
            latestReport = {
              date: session.scheduledAt,
              memorizationScore: report.memorizationScore,
              tajweedScore: report.tajweedScore,
              surahRecited: report.surahRecited,
              nextHomework: report.nextHomework,
            };
            break;
          }
        }
      }

      const next = childSessions[0] || null;
      const nextTeacherName =
        next?.teacher?.user?.name
        || next?.teacher?.personalInfo?.fullName
        || 'معلم الأكاديمية';

      const overdueHomework = permissions.viewProgress
        ? childTasks.filter((task) => (
          task.status === 'pending'
          && task.dueDate
          && new Date(task.dueDate) < now
        )).length
        : 0;

      const attentionCount =
        overdueHomework
        + (submittedHomework || 0)
        + (next?.status === 'pending' ? 1 : 0);

      return {
        studentId: student._id,
        name: student.name,
        avatar: student.avatar,
        relationship: entry.relationship,
        permissions,
        level: student.currentLevel,
        preferredTrack: student.preferredTrack,
        nextSession: next ? {
          _id: next._id,
          scheduledAt: next.scheduledAt,
          status: next.status,
          type: next.type,
          teacherName: nextTeacherName,
          circleName: next.circle?.name || null,
        } : null,
        upcomingSessions: childSessions.length,
        pendingHomework,
        submittedHomework,
        overdueHomework: permissions.viewProgress ? overdueHomework : null,
        latestReport,
        attentionCount,
      };
    });

    return res.json({
      success: true,
      summary: {
        totalChildren: cards.length,
        upcomingSessions: cards.reduce((sum, child) => sum + child.upcomingSessions, 0),
        pendingHomework: cards.reduce((sum, child) => sum + (child.pendingHomework || 0), 0),
        needsAttention: cards.reduce((sum, child) => sum + child.attentionCount, 0),
      },
      children: cards,
    });
  } catch (error) {
    console.error('Get guardian family overview error:', error);
    return res.status(500).json({ error: 'تعذر تحميل ملخص الأسرة' });
  }
});

/**
 * @route   GET /api/guardian/homework/:studentId
 * @desc    Homework status for one linked child
 * @access  Private (Guardian)
 */
router.get('/homework/:studentId', protect, authorize('guardian'), async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'معرف الطالب غير صالح' });
    }

    const guardian = await Guardian.findOne({ user: req.user.id });
    if (!guardian || !hasChildPermission(guardian, studentId, 'viewProgress')) {
      return res.status(403).json({ error: 'غير مصرح بمتابعة واجبات هذا الطالب' });
    }

    const tasks = await TeacherTask.find({ student: studentId })
      .populate({
        path: 'teacher',
        select: 'personalInfo.fullName user',
        populate: { path: 'user', select: 'name' },
      })
      .select('teacher type title description dueDate status teacherFeedback reviewedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      tasks: tasks.map((task) => ({
        ...task,
        teacherName:
          task.teacher?.user?.name
          || task.teacher?.personalInfo?.fullName
          || 'معلم الأكاديمية',
      })),
    });
  } catch (error) {
    console.error('Get guardian child homework error:', error);
    return res.status(500).json({ error: 'تعذر تحميل واجبات الطالب' });
  }
});

/**
 * @route   GET /api/guardian/invitations
 * @desc    Pending child-link invitations matching this guardian phone
 * @access  Private (Guardian)
 */
router.get('/invitations', protect, authorize('guardian'), async (req, res) => {
  try {
    const guardianUser = await User.findById(req.user.id).select('name phone +phoneNormalized');
    if (!guardianUser) return res.status(404).json({ error: 'Guardian account not found' });

    const normalizedPhone = guardianUser.phoneNormalized || normalizePhone(guardianUser.phone);
    if (!normalizedPhone) {
      return res.json({
        invitations: [],
        requiresCode: true,
        message: 'أضف رقم هاتف صالح إلى حسابك أو استخدم كود الربط.',
      });
    }

    if (guardianUser.phoneNormalized !== normalizedPhone) {
      guardianUser.phoneNormalized = normalizedPhone;
      await guardianUser.save();
    }

    const duplicateCandidates = await User.find({
      role: 'guardian',
      isActive: { $ne: false },
      $or: [
        { phoneNormalized: normalizedPhone },
        ...(guardianUser.phone ? [{ phone: guardianUser.phone }] : []),
      ],
    }).select('_id');
    const duplicateCount = new Set(duplicateCandidates.map((candidate) => String(candidate._id))).size;

    if (duplicateCount > 1) {
      return res.json({
        invitations: [],
        requiresCode: true,
        message: 'يوجد أكثر من حساب ولي أمر بنفس الرقم. استخدم كود الربط لحماية بيانات الطلاب.',
      });
    }

    await expireStaleInvitations({ guardianPhoneNormalized: normalizedPhone });

    const invitations = await GuardianInvitation.find({
      guardianPhoneNormalized: normalizedPhone,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .select('+guardianPhone +guardianPhoneNormalized')
      .populate('student', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      invitations: invitations.map((invitation) => ({
        _id: invitation._id,
        student: {
          id: invitation.student?._id,
          name: invitation.student?.name || 'طالب',
          avatar: invitation.student?.avatar || '',
        },
        relationship: invitation.relationship,
        phoneMasked: maskPhone(invitation.guardianPhone),
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      })),
      requiresCode: false,
    });
  } catch (error) {
    console.error('Guardian pending invitations error:', error);
    return res.status(500).json({ error: 'تعذر تحميل طلبات ربط الأبناء' });
  }
});

/**
 * @route   POST /api/guardian/invitations/:id/respond
 * @desc    Confirm or reject a phone-matched child invitation
 * @access  Private (Guardian)
 */
router.post('/invitations/:id/respond', protect, authorize('guardian'), async (req, res) => {
  try {
    const action = req.body.action === 'reject' ? 'reject' : 'accept';
    const guardianUser = await User.findById(req.user.id).select('phone +phoneNormalized');
    const normalizedPhone = guardianUser?.phoneNormalized || normalizePhone(guardianUser?.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'لا يوجد رقم هاتف صالح في حساب ولي الأمر' });
    }

    const invitation = await GuardianInvitation.findOne({
      _id: req.params.id,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).select('+guardianPhone +guardianPhoneNormalized');

    if (!invitation) {
      return res.status(404).json({ error: 'طلب الربط غير موجود أو انتهت صلاحيته' });
    }

    if (invitation.guardianPhoneNormalized !== normalizedPhone) {
      return res.status(403).json({ error: 'طلب الربط لا يخص رقم الهاتف المسجل في حسابك' });
    }

    if (action === 'reject') {
      invitation.status = 'rejected';
      invitation.respondedBy = req.user.id;
      invitation.respondedAt = new Date();
      invitation.history.push({ action: 'rejected', actor: req.user.id });
      await invitation.save();

      notifyUser(invitation.student, {
        type: 'system',
        title: { ar: 'تم رفض طلب ربط ولي الأمر', en: 'Guardian link request declined' },
        message: { ar: 'راجع رقم ولي الأمر أو استخدم كود ربط جديد.', en: 'Check the guardian phone or use a new link code.' },
        data: { actionUrl: '/student/dashboard?tab=account' },
        priority: 'normal',
      }).catch(() => {});

      return res.json({ success: true, status: 'rejected' });
    }

    const linked = await linkGuardianToStudent({
      guardianUserId: req.user.id,
      studentId: invitation.student,
      relationship: invitation.relationship,
    });

    invitation.status = 'accepted';
    invitation.respondedBy = req.user.id;
    invitation.respondedAt = new Date();
    invitation.history.push({ action: 'accepted', actor: req.user.id });
    await invitation.save();

    await GuardianInvitation.updateMany(
      {
        student: invitation.student,
        guardianPhoneNormalized: normalizedPhone,
        status: 'pending',
        _id: { $ne: invitation._id },
      },
      {
        $set: { status: 'cancelled' },
        $push: { history: { action: 'cancelled', actor: req.user.id, at: new Date() } },
      },
    );

    notifyUser(invitation.student, {
      type: 'system',
      title: { ar: 'تم ربط ولي الأمر بنجاح', en: 'Guardian linked successfully' },
      message: { ar: 'أصبح ولي الأمر قادرًا على متابعة الحصص والتقارير حسب الصلاحيات.', en: 'Your guardian can now follow your learning progress.' },
      data: { actionUrl: '/student/dashboard?tab=account' },
      priority: 'normal',
    }).catch(() => {});

    return res.json({
      success: true,
      status: 'accepted',
      child: { id: linked.student._id, name: linked.student.name },
    });
  } catch (error) {
    console.error('Guardian invitation response error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/guardian/link-child
 * @desc    ربط حساب طالب بحساب ولي الأمر بواسطة كود الطالب أو إيميله
 * @access  Private (Guardian, Admin)
 */
router.post('/link-child', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    const { studentCode, relationship = 'guardian' } = req.body;
    const normalizedCode = String(studentCode || '').trim().toUpperCase();

    if (!/^WN-[A-F0-9]{8}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'كود ربط الطالب غير صالح' });
    }

    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.status(503).json({ error: 'ربط ولي الأمر يتطلب اتصال قاعدة البيانات' });
    }

    const invitation = await GuardianInvitation.findOne({
      linkCode: normalizedCode,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).select('+linkCode +guardianPhone +guardianPhoneNormalized');

    if (invitation) {
      const linked = await linkGuardianToStudent({
        guardianUserId: req.user.id,
        studentId: invitation.student,
        relationship: invitation.relationship || relationship,
      });

      invitation.status = 'accepted';
      invitation.respondedBy = req.user.id;
      invitation.respondedAt = new Date();
      invitation.history.push({ action: 'accepted', actor: req.user.id });
      await invitation.save();

      return res.status(201).json({
        success: true,
        message: `تم ربط الطالب ${linked.student.name} بحسابك بنجاح`,
        child: {
          id: linked.student._id,
          name: linked.student.name,
          relationship: invitation.relationship || relationship,
        },
        totalChildren: linked.guardianProfile.children.length,
      });
    }

    const student = await User.findOne({
      role: 'student',
      guardianLinkCode: normalizedCode
    }).select('+guardianLinkCode guardian name');

    if (!student) {
      return res.status(404).json({ error: 'كود الربط غير صحيح أو تم استخدامه من قبل' });
    }

    const linked = await linkGuardianToStudent({
      guardianUserId: req.user.id,
      studentId: student._id,
      relationship,
    });

    student.guardianLinkCode = undefined;
    await student.save();

    return res.status(201).json({
      success: true,
      message: `تم ربط الطالب ${student.name} بحسابك بنجاح`,
      child: {
        id: student._id,
        name: student.name,
        relationship,
      },
      totalChildren: linked.guardianProfile.children.length,
    });
  } catch (error) {
    console.error('Link child error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/guardian/reports/:studentId
 * @desc    جلب التاريخ الكامل لتقارير الطالب
 * @access  Private (Guardian, Admin)
 */
router.get('/reports/:studentId', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!isDBConnected() || !isValidObjectId(req.user.id) || !isValidObjectId(studentId)) {
      return res.status(503).json({ error: 'Guardian reports are temporarily unavailable' });
    }

    // Reports contain grades/evaluations, so linked-child membership alone is not enough.
    if (req.user.role !== 'admin') {
      const guardian = await Guardian.findOne({
        user: req.user.id,
        'children.student': studentId
      });

      if (!guardian || !hasChildPermission(guardian, studentId, 'viewGrades')) {
        return res.status(403).json({ error: 'غير مصرح بالاطلاع على تقييمات هذا الطالب' });
      }
    }

    const studentUser = await User.findById(studentId).select('name email');
    if (!studentUser) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // Fetch all sessions containing reports for this student
    const sessions = await Session.find({
      $or: [
        { student: studentId },
        { 'studentReports.student': studentId }
      ],
      'studentReports.0': { $exists: true }
    })
    .populate({ path: 'teacher', select: 'personalInfo.fullName user', populate: { path: 'user', select: 'name' } })
    .sort({ scheduledAt: -1 })
    .lean();

    const reportsHistory = [];

    sessions.forEach(sess => {
      const rep = sess.studentReports?.find(
        r => r.student && r.student.toString() === studentId.toString()
      );
      if (rep) {
        reportsHistory.push({
          sessionId: sess._id,
          scheduledAt: sess.scheduledAt,
          teacherName: sess.teacher?.user?.name || sess.teacher?.personalInfo?.fullName || sess.teacher?.name || 'المعلم',
          memorizationScore: rep.memorizationScore,
          tajweedScore: rep.tajweedScore,
          surahRecited: rep.surahRecited,
          fromAyah: rep.fromAyah,
          toAyah: rep.toAyah,
          nextHomework: rep.nextHomework,
          notes: rep.notes,
          sentToWhatsApp: rep.sentToWhatsApp,
          sentAt: rep.sentAt
        });
      }
    });

    res.json({
      success: true,
      student: {
        id: studentUser._id,
        name: studentUser.name,
        email: studentUser.email
      },
      reportsCount: reportsHistory.length,
      reports: reportsHistory
    });
  } catch (error) {
    console.error('Get student reports error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب تاريخ التقارير' });
  }
});

/**
 * @route   GET /api/guardian/upcoming-sessions
 * @desc    جلب الحصص والحلقات القادمة لجميع أبناء ولي الأمر مع حالة الحضور والاعتذار
 * @access  Private (Guardian, Admin)
 */
router.get('/upcoming-sessions', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.status(503).json({ error: 'Guardian sessions are temporarily unavailable' });
    }

    const guardian = await getGuardianProfile(req.user.id);
    let childIds = (guardian?.children || []).map((entry) => entry.student);

    const requestedStudentId = String(req.query.studentId || '').trim();
    if (requestedStudentId) {
      if (!isValidObjectId(requestedStudentId)) {
        return res.status(400).json({ error: 'معرف الطالب غير صالح' });
      }

      const linked = childIds.some((childId) => String(childId) === requestedStudentId);
      if (!linked) {
        return res.status(403).json({ error: 'هذا الطالب غير مرتبط بحساب ولي الأمر' });
      }
      childIds = [requestedStudentId];
    }

    if (childIds.length === 0) {
      return res.json({ success: true, sessions: [] });
    }

    const attendancePermissionByChild = new Map(
      childIds.map((childId) => {
        const access = guardian ? findChildAccess(guardian, childId) : null;
        // Legacy User.children links predate granular permissions; preserve access until migrated.
        return [String(childId), access ? access.permissions.viewAttendance : true];
      })
    );

    // Also find any circles where children are enrolled
    const childrenUsers = await User.find({ _id: { $in: childIds } }).select('_id name circle');
    const circleIds = childrenUsers.map(c => c.circle).filter(Boolean);

    const now = new Date();
    // Fetch upcoming sessions from 2 hours ago to future
    const threshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const upcoming = await Session.find({
      $or: [
        { student: { $in: childIds } },
        { circle: { $in: circleIds } },
        { 'attendance.student': { $in: childIds } }
      ],
      scheduledAt: { $gte: threshold },
      status: { $in: ['pending', 'accepted'] }
    })
    .populate({
      path: 'teacher',
      select: 'personalInfo.fullName media.profilePhoto user',
      populate: { path: 'user', select: 'name avatar' }
    })
    .populate('circle', 'name level schedule capacity')
    .sort({ scheduledAt: 1 })
    .limit(requestedStudentId ? 25 : 100)
    .lean();

    const liveSessions = await LiveSession.find({
      session: { $in: upcoming.map((session) => session._id) }
    }).select('session roomId').lean();

    const liveRoomBySession = new Map(
      liveSessions.map((live) => [String(live.session), live.roomId])
    );

    // Expand a shared circle session once per linked child. The old implementation
    // picked the first matching child, which made siblings in the same circle
    // disappear from the guardian dashboard.
    const formattedSessions = upcoming.flatMap((sess) => {
      const affectedChildren = childrenUsers.filter((child) => childMatchesSession(child, sess));
      const teacherName =
        sess.teacher?.user?.name ||
        sess.teacher?.personalInfo?.fullName ||
        'معلم الأكاديمية';

      const diffMs = new Date(sess.scheduledAt).getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return affectedChildren.map((child) => {
        const att = sess.attendance?.find(
          (entry) => entry.student && String(entry.student) === String(child._id)
        );

        return {
          _id: sess._id,
          instanceKey: `${sess._id}:${child._id}`,
          scheduledAt: sess.scheduledAt,
          duration: sess.duration,
          meetingLink: liveRoomBySession.get(String(sess._id))
            ? `/live/${liveRoomBySession.get(String(sess._id))}`
            : null,
          type: sess.type,
          status: sess.status,
          circleName: sess.circle?.name || (sess.type === 'trial' ? 'حصة تجريبية مجانية' : 'حلقة فردية'),
          child: { id: child._id, name: child.name },
          teacher: {
            id: sess.teacher?._id || null,
            name: teacherName,
            avatar: sess.teacher?.media?.profilePhoto || sess.teacher?.user?.avatar || null
          },
          rsvp: attendancePermissionByChild.get(String(child._id))
            ? (att ? att.status : 'pending')
            : null,
          canExcuseWithCompensation: diffHours >= 6,
          hoursUntilSession: Math.round(diffHours * 10) / 10
        };
      });
    });

    res.json({ success: true, sessions: formattedSessions });
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الحصص القادمة' });
  }
});

module.exports = router;

