'use strict';

function childIdOf(child) {
  const value = child?.student?._id || child?.student;
  return value == null ? '' : String(value);
}

function findChildAccess(guardian, studentId) {
  if (!guardian || guardian.isActive === false) return null;
  const wanted = String(studentId || '');
  const child = guardian?.children?.find((entry) => childIdOf(entry) === wanted);
  if (!child) return null;

  const permissions = child.permissions || {};
  return {
    child,
    permissions: {
      viewProgress: permissions.viewProgress !== false,
      viewGrades: permissions.viewGrades !== false,
      viewAttendance: permissions.viewAttendance !== false,
      receiveNotifications: permissions.receiveNotifications !== false,
      approveEnrollments: permissions.approveEnrollments === true,
    },
  };
}

function hasChildPermission(guardian, studentId, permission) {
  const access = findChildAccess(guardian, studentId);
  return Boolean(access?.permissions?.[permission]);
}

function filterReportForPermissions(report, permissions = {}) {
  const raw = typeof report?.toObject === 'function' ? report.toObject() : { ...(report || {}) };
  const data = raw.data ? { ...raw.data } : {};

  if (!permissions.viewProgress) {
    delete data.progress;
    delete data.assignments;
    delete data.achievements;
    delete raw.summary;
  }

  if (!permissions.viewAttendance) {
    delete data.attendance;
  }

  if (!permissions.viewGrades) {
    delete data.quizzes;
  }

  return { ...raw, data };
}

/**
 * Express middleware: a guardian whose profile was deactivated by the academy
 * (`Guardian.isActive === false`) must not claim or unlink children, answer
 * invitations, change settings, or read linked trial meeting details.
 * Accounts without a Guardian profile yet (first link) are allowed through.
 */
async function requireActiveGuardianProfile(req, res, next) {
  if (req.user?.role !== 'guardian') return next();
  try {
    const Guardian = require('../models/Guardian');
    const profile = await Guardian.findOne({ user: req.user.id }).select('isActive').lean();
    if (profile && profile.isActive === false) {
      return res.status(403).json({
        code: 'GUARDIAN_DEACTIVATED',
        error: 'حساب ولي الأمر موقوف من الإدارة. يرجى التواصل مع الدعم.',
      });
    }
    return next();
  } catch {
    return res.status(503).json({ error: 'تعذر التحقق من حالة حساب ولي الأمر حالياً' });
  }
}

module.exports = {
  findChildAccess,
  hasChildPermission,
  filterReportForPermissions,
  requireActiveGuardianProfile,
};
