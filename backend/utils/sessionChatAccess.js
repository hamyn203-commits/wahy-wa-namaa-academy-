const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');

function refId(value) {
  return String(value?._id || value?.id || value || '');
}

async function sessionHasStudent(session, studentId) {
  const sid = refId(studentId);
  if (!session || !sid) return false;
  if (refId(session.student) === sid) return true;
  if (Array.isArray(session.attendance) && session.attendance.some((entry) => refId(entry?.student) === sid)) {
    return true;
  }
  // Group-circle lessons: `attendance` is the authoritative paid roster.
  // Circle membership alone must never grant access to a lesson.
  return false;
}

async function canAccessSession(session, userId, userRole, { allowGuardianRead = false } = {}) {
  const normalizedUserId = String(userId || '');
  if (!session || !normalizedUserId) return false;
  if (userRole === 'admin') return true;
  if (userRole === 'student') {
    return sessionHasStudent(session, normalizedUserId);
  }
  if (userRole === 'teacher') {
    const teacher = await Teacher.findOne({ user: normalizedUserId }).select('_id');
    return Boolean(teacher && refId(session.teacher) === refId(teacher));
  }
  if (allowGuardianRead && userRole === 'guardian') {
    const guardian = await Guardian.findOne({ user: normalizedUserId, isActive: true })
      .select('children.student children.permissions')
      .lean();
    for (const child of guardian?.children || []) {
      const canObserve = child?.permissions?.viewAttendance !== false || child?.permissions?.viewProgress !== false;
      if (canObserve && child?.student && (await sessionHasStudent(session, child.student))) {
        return true;
      }
    }
  }
  return false;
}

module.exports = { refId, canAccessSession };
