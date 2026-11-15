const Notification = require('../models/Notification');
const User = require('../models/User');
const Guardian = require('../models/Guardian');

async function notifyUser(userId, { type, title, message, data = {}, priority = 'medium', channels }) {
  const user = await User.findById(userId).select('preferences email phone pushToken telegramId');
  const prefs = user?.preferences?.notifications || {};

  const defaultChannels = {
    inApp: { enabled: true },
    email: { enabled: prefs.email !== false },
    push: { enabled: prefs.push !== false && !!user?.pushToken },
    telegram: { enabled: !!(prefs.telegram !== false && process.env.TELEGRAM_BOT_TOKEN && user?.telegramId) },
    sms: { enabled: !!(prefs.sms !== false && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && user?.phone) },
  };

  return Notification.createAndSend(userId, {
    type,
    title,
    message,
    data,
    priority,
    channels: channels || defaultChannels,
  });
}

async function notifyAdmins(payload) {
  const admins = await User.find({
    role: 'admin',
    isActive: { $ne: false },
  }).select('_id');

  return Promise.allSettled(
    admins.map((admin) => notifyUser(admin._id, payload))
  );
}

async function notifyGuardiansForStudent(studentId, payload) {
  if (!studentId) return [];

  const guardians = await Guardian.find({
    isActive: true,
    children: {
      $elemMatch: {
        student: studentId,
        'permissions.receiveNotifications': { $ne: false },
      },
    },
  }).select('user');

  return Promise.allSettled(
    guardians.map((guardian) => notifyUser(guardian.user, payload))
  );
}

async function notifyTeacherForSessionRequest(session, teacherUserId) {
  const timezone = String(session?.timezone || 'Africa/Cairo');
  const scheduled = new Date(session.scheduledAt);
  return notifyUser(teacherUserId, {
    type: 'session-request',
    title: { ar: 'طلب حصة جديد', en: 'New session request' },
    message: {
      ar: `طلب حصة ${session.type === 'trial' ? 'تجريبية' : ''} — ${scheduled.toLocaleString('ar-EG', { timeZone: timezone })} (${timezone})`,
      en: `New ${session.type} session — ${scheduled.toLocaleString('en-US', { timeZone: timezone })} (${timezone})`,
    },
    data: {
      session: session._id,
      actionUrl: `/teacher/dashboard?tab=${session.type === 'trial' ? 'trials' : 'sessions'}&session=${session._id}`,
    },
    priority: 'high',
  });
}

async function notifySessionAccepted(session, studentId, meetingUrl) {
  return notifyUser(studentId, {
    type: 'session-accepted',
    title: { ar: 'تم قبول الحصة', en: 'Session accepted' },
    message: {
      ar: `تم قبول حصتك. رابط الانضمام: ${meetingUrl || 'سيُرسل لاحقاً'}`,
      en: `Your session was accepted. Join: ${meetingUrl || 'link pending'}`,
    },
    data: {
      session: session._id,
      meetingLink: meetingUrl,
      actionUrl: `/student/dashboard?tab=${session.type === 'trial' ? 'trials' : 'sessions'}&session=${session._id}`,
    },
    priority: 'high',
  });
}

async function notifyCourseEnrollment(userId, course) {
  const title = course.title?.ar || course.title?.en || 'دورة';
  return notifyUser(userId, {
    type: 'course-enrollment',
    title: { ar: 'تم التسجيل في الدورة', en: 'Course enrollment confirmed' },
    message: {
      ar: `سجّلت بنجاح في: ${title}`,
      en: `Enrolled in: ${course.title?.en || title}`,
    },
    data: { course: course._id },
  });
}

async function notifyCertificateIssued(userId, certificate, course) {
  return notifyUser(userId, {
    type: 'certificate-issued',
    title: { ar: 'شهادة جديدة', en: 'Certificate issued' },
    message: {
      ar: `تهانينا! حصلت على شهادة إتمام: ${course?.title?.ar || ''}`,
      en: `Congratulations! Certificate for: ${course?.title?.en || ''}`,
    },
    data: { certificate: certificate._id, course: course?._id },
    priority: 'high',
  });
}

module.exports = {
  notifyUser,
  notifyAdmins,
  notifyTeacherForSessionRequest,
  notifySessionAccepted,
  notifyGuardiansForStudent,
  notifyCourseEnrollment,
  notifyCertificateIssued,
};
