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

module.exports = {
  findChildAccess,
  hasChildPermission,
  filterReportForPermissions,
};
