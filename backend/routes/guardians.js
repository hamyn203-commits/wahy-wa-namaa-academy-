const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Guardian = require('../models/Guardian');
const User = require('../models/User');
const Progress = require('../models/Progress');
const Enrollment = require('../models/Enrollment');
const Session = require('../models/Session');
const TeacherTask = require('../models/TeacherTask');
const { protect, authorize } = require('../middleware/auth');
const {
  findChildAccess,
  hasChildPermission,
  filterReportForPermissions,
  requireActiveGuardianProfile,
} = require('../utils/guardianSafeguarding');

const ADMIN_CHILD_PERMISSIONS = Object.freeze({
  viewProgress: true,
  viewGrades: true,
  viewAttendance: true,
  receiveNotifications: true,
  approveEnrollments: true,
});

async function resolveGuardianOrAdminChildAccess(req, studentId, requiredPermission) {
  if (req.user.role === 'admin') {
    return { ok: true, permissions: ADMIN_CHILD_PERMISSIONS, guardian: null };
  }
  const guardian = await Guardian.findOne({ user: req.user.id });
  if (!guardian) {
    return { ok: false, status: 404, error: 'Guardian profile not found' };
  }
  if (guardian.isActive === false) {
    return { ok: false, status: 403, error: 'حساب متابعة ولي الأمر غير مفعل' };
  }
  const access = findChildAccess(guardian, studentId);
  if (!access) {
    return { ok: false, status: 403, error: 'Permission denied' };
  }
  if (requiredPermission && !hasChildPermission(guardian, studentId, requiredPermission)) {
    return { ok: false, status: 403, error: 'Permission denied' };
  }
  return { ok: true, permissions: access.permissions, guardian };
}

// @route   GET /api/guardians/my-children
// @desc    Get all children for the current guardian
// @access  Private (Guardian)
router.get('/my-children', protect, authorize('guardian'), async (req, res) => {
  try {
    const guardian = await Guardian.findOne({ user: req.user.id })
      .populate({
        path: 'children.student',
        select: 'name email avatar'
      });

    if (!guardian) {
      return res.status(404).json({ error: 'Guardian profile not found' });
    }
    if (guardian.isActive === false) {
      return res.status(403).json({ error: 'حساب متابعة ولي الأمر غير مفعل' });
    }

    const safeChildren = guardian.children.map((child) => {
      const raw = typeof child.toObject === 'function' ? child.toObject() : { ...child };
      const studentId = raw.student?._id || raw.student;
      const access = findChildAccess(guardian, studentId);
      const canSeeContact = Boolean(
        access?.permissions?.viewProgress
        || access?.permissions?.viewGrades
        || access?.permissions?.viewAttendance
      );
      if (!canSeeContact && raw.student && typeof raw.student === 'object') {
        raw.student = { _id: raw.student._id, name: raw.student.name, avatar: raw.student.avatar };
      }
      return raw;
    });

    res.json(safeChildren);
  } catch (error) {
    console.error('Get my children error:', error);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// @route   POST /api/guardians/add-child
// @desc    Add a child to guardian
// @access  Private (Guardian)
router.post('/add-child', protect, authorize('guardian'), (_req, res) => {
  return res.status(410).json({
    error: 'هذا المسار تم إيقافه. استخدم كود ربط ولي الأمر من حساب الطالب.'
  });
});

// @route   DELETE /api/guardians/remove-child/:studentId
// @desc    Remove a child from guardian
// @access  Private (Guardian)
router.delete('/remove-child/:studentId', protect, authorize('guardian'), requireActiveGuardianProfile, async (req, res) => {
  try {
    const guardian = await Guardian.findOne({
      user: req.user.id,
      'children.student': req.params.studentId,
    });

    if (!guardian) {
      return res.status(404).json({ error: 'Linked child not found' });
    }

    await guardian.removeChild(req.params.studentId);

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { children: req.params.studentId },
    });

    // The legacy User.guardian field is only a compatibility pointer. If this
    // guardian owned that pointer, move it to another active guardian link when
    // possible instead of deleting a valid family relationship.
    const alternateGuardian = await Guardian.findOne({
      user: { $ne: req.user.id },
      'children.student': req.params.studentId,
      isActive: { $ne: false },
    }).select('user');

    if (alternateGuardian?.user) {
      await User.updateOne(
        { _id: req.params.studentId, guardian: req.user.id },
        { $set: { guardian: alternateGuardian.user } }
      );
    } else {
      await User.updateOne(
        { _id: req.params.studentId, guardian: req.user.id },
        { $unset: { guardian: 1 } }
      );
      // No active guardian remains: verified parental consent no longer holds.
      await User.updateOne(
        { _id: req.params.studentId },
        { $set: { 'privacyConsent.parentalConsentVerified': false } }
      );
    }

    res.json({ message: 'Child removed successfully' });
  } catch (error) {
    console.error('Remove child error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/guardians/permissions/:studentId
// @desc    Update guardian permissions for a student (Student account owner or Admin only)
// @access  Private (Student/Admin)
router.put('/permissions/:studentId', protect, authorize('student', 'admin'), async (req, res) => {
  try {
    const { permissions, guardianId } = req.body || {};

    if (req.user.role === 'student' && String(req.params.studentId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions object is required' });
    }

    const allowedPermissionKeys = new Set([
      'viewProgress',
      'viewGrades',
      'viewAttendance',
      'receiveNotifications',
      'approveEnrollments',
    ]);
    const normalizedPermissions = {};

    for (const [key, value] of Object.entries(permissions)) {
      if (!allowedPermissionKeys.has(key) || typeof value !== 'boolean') {
        return res.status(400).json({ error: 'Invalid guardian permission value' });
      }
      normalizedPermissions[key] = value;
    }

    if (!Object.keys(normalizedPermissions).length) {
      return res.status(400).json({ error: 'At least one permission is required' });
    }

    const hasRevocation = Object.values(normalizedPermissions).some((val) => val === false);
    if (
      req.user.role === 'student'
      && hasRevocation
      && (mongoose.connection.readyState === 1 || User.findById !== mongoose.Model.findById)
    ) {
      const studentDoc = await User.findById(req.user.id).select('age enrollmentSection');
      const isMinor = Boolean(
        studentDoc && (
          (Number.isFinite(Number(studentDoc.age)) && Number(studentDoc.age) < 18)
          || studentDoc.enrollmentSection === 'children'
        )
      );
      if (isMinor) {
        return res.status(403).json({
          error: 'حسابات الطلاب القُصَّر لا يمكنها إلغاء صلاحيات متابعة ولي الأمر',
          code: 'MINOR_GUARDIAN_SAFEGUARD',
        });
      }
    }

    const guardianFilter = { 'children.student': req.params.studentId };
    if (guardianId) {
      guardianFilter._id = guardianId;
    }

    const guardians = await Guardian.find(guardianFilter);
    if (!guardians.length) {
      return res.status(404).json({ error: 'Guardian profile not found' });
    }

    for (const guardian of guardians) {
      await guardian.updatePermissions(req.params.studentId, normalizedPermissions);
    }

    res.json({
      success: true,
      studentId: String(req.params.studentId),
      permissions: normalizedPermissions,
      guardiansUpdated: guardians.length,
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/guardians/child/:studentId/progress
// @desc    Get child's progress
// @access  Private (Guardian)
router.get('/child/:studentId/progress', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    const accessCheck = await resolveGuardianOrAdminChildAccess(req, req.params.studentId, 'viewProgress');
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const progress = await Progress.find({ student: req.params.studentId })
      .populate('course', 'title image slug')
      .populate({
        path: 'lessonProgress.lesson',
        select: 'title type order'
      })
      .sort({ lastUpdated: -1 });

    res.json(progress);
  } catch (error) {
    console.error('Get child progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// @route   GET /api/guardians/child/:studentId/enrollments
// @desc    Get child's enrollments
// @access  Private (Guardian)
router.get('/child/:studentId/enrollments', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    const accessCheck = await resolveGuardianOrAdminChildAccess(req, req.params.studentId, 'viewProgress');
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const enrollments = await Enrollment.find({ student: req.params.studentId })
      .populate({
        path: 'course',
        populate: { path: 'instructor', select: 'name' }
      })
      .sort({ enrolledAt: -1 });

    res.json(enrollments);
  } catch (error) {
    console.error('Get child enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// @route   GET /api/guardians/child/:studentId/achievements
// @desc    Get child's achievements
// @access  Private (Guardian)
router.get('/child/:studentId/achievements', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    const accessCheck = await resolveGuardianOrAdminChildAccess(req, req.params.studentId, 'viewProgress');
    if (!accessCheck.ok) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const progress = await Progress.find({ student: req.params.studentId })
      .populate('course', 'title');

    const achievements = progress.flatMap(p => 
      p.milestones.map(m => ({
        ...m.toObject(),
        course: p.course
      }))
    ).sort((a, b) => b.achievedAt - a.achievedAt);

    res.json(achievements);
  } catch (error) {
    console.error('Get child achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// @route   POST /api/guardians/report/:studentId
// @desc    Generate a report for a child
// @access  Private (Guardian)
router.post('/report/:studentId', protect, authorize('guardian'), async (req, res) => {
  try {
    const { type = 'weekly' } = req.body;
    const guardian = await Guardian.findOne({ user: req.user.id });

    if (!guardian) {
      return res.status(404).json({ error: 'Guardian profile not found' });
    }
    if (guardian.isActive === false) {
      return res.status(403).json({ error: 'حساب متابعة ولي الأمر غير مفعل' });
    }

    const access = findChildAccess(guardian, req.params.studentId);
    if (!access?.permissions.viewProgress) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const generated = await guardian.generateReport(req.params.studentId, type);
    if (!generated || !Array.isArray(guardian.reports) || guardian.reports.length === 0) {
      return res.status(404).json({ error: 'لا توجد بيانات دورات كافية لإصدار التقرير حالياً' });
    }

    const latestReport = guardian.reports[guardian.reports.length - 1];
    res.status(201).json(filterReportForPermissions(latestReport, access.permissions));
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/guardians/reports
// @desc    Get all reports for guardian's children
// @access  Private (Guardian)
router.get('/reports', protect, authorize('guardian'), async (req, res) => {
  try {
    const guardian = await Guardian.findOne({ user: req.user.id })
      .populate('reports.childId', 'name');

    if (!guardian) {
      return res.status(404).json({ error: 'Guardian profile not found' });
    }
    if (guardian.isActive === false) {
      return res.status(403).json({ error: 'حساب متابعة ولي الأمر غير مفعل' });
    }

    const visibleReports = guardian.reports
      .map((report) => {
        const childId = report.childId?._id || report.childId;
        const access = findChildAccess(guardian, childId);
        if (!access) return null;

        const hasAnyReportPermission =
          access.permissions.viewProgress ||
          access.permissions.viewGrades ||
          access.permissions.viewAttendance;

        return hasAnyReportPermission
          ? filterReportForPermissions(report, access.permissions)
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

    res.json(visibleReports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// @route   PUT /api/guardians/settings
// @desc    Update guardian settings
// @access  Private (Guardian)
router.put('/settings', protect, authorize('guardian'), requireActiveGuardianProfile, async (req, res) => {
  try {
    const { notificationPreferences, settings } = req.body || {};

    let guardian = await Guardian.findOne({ user: req.user.id });

    if (!guardian) {
      guardian = new Guardian({
        user: req.user.id,
        children: [],
      });
    }

    if (notificationPreferences && typeof notificationPreferences === 'object' && !Array.isArray(notificationPreferences)) {
      const EMAIL_TYPES = new Set(['progress-update', 'assignment-due', 'quiz-result', 'attendance', 'achievement', 'payment']);
      const SMS_TYPES = new Set(['urgent', 'attendance', 'payment']);
      const PUSH_TYPES = new Set(['progress-update', 'assignment-due', 'quiz-result', 'achievement']);

      if (notificationPreferences.email && typeof notificationPreferences.email === 'object') {
        if (typeof notificationPreferences.email.enabled === 'boolean') {
          guardian.notificationPreferences.email.enabled = notificationPreferences.email.enabled;
        }
        if (Array.isArray(notificationPreferences.email.types)) {
          guardian.notificationPreferences.email.types = notificationPreferences.email.types.filter((t) => EMAIL_TYPES.has(t));
        }
      }

      if (notificationPreferences.sms && typeof notificationPreferences.sms === 'object') {
        if (typeof notificationPreferences.sms.enabled === 'boolean') {
          guardian.notificationPreferences.sms.enabled = notificationPreferences.sms.enabled;
          if (notificationPreferences.sms.enabled && (mongoose.connection.readyState === 1 || User.findById !== mongoose.Model.findById)) {
            const guardianUser = await User.findById(req.user.id).select('phone');
            if (guardianUser?.phone) {
              guardian.notificationPreferences.sms.phoneNumber = guardianUser.phone;
            }
          }
        }
        if (Array.isArray(notificationPreferences.sms.types)) {
          guardian.notificationPreferences.sms.types = notificationPreferences.sms.types.filter((t) => SMS_TYPES.has(t));
        }
      }

      if (notificationPreferences.push && typeof notificationPreferences.push === 'object') {
        if (typeof notificationPreferences.push.enabled === 'boolean') {
          guardian.notificationPreferences.push.enabled = notificationPreferences.push.enabled;
        }
        if (Array.isArray(notificationPreferences.push.types)) {
          guardian.notificationPreferences.push.types = notificationPreferences.push.types.filter((t) => PUSH_TYPES.has(t));
        }
      }
    }

    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      const VALID_LANGS = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);
      const VALID_FREQ = new Set(['daily', 'weekly', 'monthly', 'never']);
      if (VALID_LANGS.has(settings.language)) {
        guardian.settings.language = settings.language;
      }
      if (typeof settings.timezone === 'string' && settings.timezone.trim().length <= 60) {
        guardian.settings.timezone = settings.timezone.trim();
      }
      if (VALID_FREQ.has(settings.reportFrequency)) {
        guardian.settings.reportFrequency = settings.reportFrequency;
      }
    }

    await guardian.save();

    res.json(guardian);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/guardians/child/:studentId/weekly-summary
router.get('/child/:studentId/weekly-summary', protect, authorize('guardian', 'admin'), async (req, res) => {
  try {
    const accessCheck = await resolveGuardianOrAdminChildAccess(req, req.params.studentId, null);
    if (!accessCheck.ok) return res.status(accessCheck.status).json({ error: accessCheck.error });
    const access = { permissions: accessCheck.permissions };
    if (!access.permissions.viewProgress && !access.permissions.viewAttendance) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const studentId = req.params.studentId;
    const studentSessionMatch = {
      $or: [{ student: studentId }, { 'attendance.student': studentId }],
    };

    const [completed, missed, homeworkPending, homeworkDone, rawRecentSessions] = await Promise.all([
      access.permissions.viewAttendance
        ? Session.countDocuments({ ...studentSessionMatch, status: 'completed', updatedAt: { $gte: weekAgo } })
        : Promise.resolve(null),
      access.permissions.viewAttendance
        ? Session.countDocuments({ ...studentSessionMatch, status: { $in: ['no-show', 'cancelled'] }, updatedAt: { $gte: weekAgo } })
        : Promise.resolve(null),
      access.permissions.viewProgress
        ? TeacherTask.countDocuments({ student: studentId, status: 'pending' })
        : Promise.resolve(null),
      access.permissions.viewProgress
        ? TeacherTask.countDocuments({ student: studentId, status: { $in: ['submitted', 'done'] }, updatedAt: { $gte: weekAgo } })
        : Promise.resolve(null),
      access.permissions.viewAttendance
        ? Session.find({ ...studentSessionMatch, status: 'completed', updatedAt: { $gte: weekAgo } })
            .populate({ path: 'teacher', select: 'user personalInfo.fullName', populate: { path: 'user', select: 'name' } })
            .sort({ scheduledAt: -1 })
            .limit(10)
        : Promise.resolve([]),
    ]);

    const recentSessions = rawRecentSessions.map((doc) => {
      const s = typeof doc.toObject === 'function' ? doc.toObject() : doc;
      const ownAttendance = Array.isArray(s.attendance)
        ? s.attendance.find((entry) => String(entry?.student?._id || entry?.student) === String(studentId))
        : null;

      const sanitized = {
        _id: s._id,
        type: s.type,
        status: s.status,
        scheduledAt: s.scheduledAt,
        duration: s.duration,
        timezone: s.timezone,
        attendanceStatus: ownAttendance?.status || 'attended',
        teacher: s.teacher
          ? {
              _id: s.teacher._id,
              name: s.teacher.user?.name || s.teacher.personalInfo?.fullName || null,
            }
          : null,
      };

      if (access.permissions.viewGrades) {
        if (s.report) sanitized.report = s.report;
        if (s.teacherEvaluation) sanitized.teacherEvaluation = s.teacherEvaluation;
      }

      return sanitized;
    });

    res.json({
      week: {
        completed,
        missed,
        homeworkPending,
        homeworkDone,
      },
      recentSessions,
      permissions: access.permissions,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

// @route   GET /api/guardians/dashboard
// @desc    Get guardian dashboard overview
// @access  Private (Guardian)
router.get('/dashboard', protect, authorize('guardian'), async (req, res) => {
  try {
    const guardian = await Guardian.findOne({ user: req.user.id })
      .populate({
        path: 'children.student',
        select: 'name email avatar'
      });

    if (!guardian) {
      return res.status(404).json({ error: 'Guardian profile not found' });
    }
    if (guardian.isActive === false) {
      return res.status(403).json({ error: 'حساب متابعة ولي الأمر غير مفعل' });
    }

    const childrenData = await Promise.all(
      guardian.children.map(async (child) => {
        const studentId = child.student?._id || child.student;
        const access = findChildAccess(guardian, studentId);
        const canViewProgress = Boolean(access?.permissions.viewProgress);

        const progress = canViewProgress
          ? await Progress.find({ student: studentId }).populate('course', 'title')
          : [];

        const enrollments = canViewProgress
          ? await Enrollment.find({ student: studentId, status: 'active' }).countDocuments()
          : null;

        const totalProgress = progress.reduce((sum, p) => sum + p.overallProgress.percentage, 0);
        const avgProgress = progress.length > 0 ? totalProgress / progress.length : 0;

        const recentAchievements = canViewProgress
          ? progress.flatMap(p => p.milestones)
              .sort((a, b) => b.achievedAt - a.achievedAt)
              .slice(0, 5)
          : [];

        const canSeeContact = Boolean(
          access?.permissions?.viewProgress
          || access?.permissions?.viewGrades
          || access?.permissions?.viewAttendance
        );
        const safeStudent = (!canSeeContact && child.student && typeof child.student === 'object')
          ? { _id: child.student._id, name: child.student.name, avatar: child.student.avatar }
          : child.student;

        return {
          student: safeStudent,
          relationship: child.relationship,
          permissions: access?.permissions || null,
          stats: canViewProgress ? {
            enrolledCourses: enrollments,
            averageProgress: avgProgress,
            totalAchievements: progress.reduce((sum, p) => sum + p.milestones.length, 0),
            currentStreak: Math.max(...progress.map(p => p.streak.current), 0)
          } : null,
          recentAchievements
        };
      })
    );

    res.json({
      children: childrenData,
      totalChildren: guardian.children.length,
      notificationPreferences: guardian.notificationPreferences
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

module.exports = router;