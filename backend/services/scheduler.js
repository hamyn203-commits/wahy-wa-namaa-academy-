/**
 * Automated Session Reminder Scheduler — Wahy Wa Namaa Academy
 * Dispatches:
 * 1. 24-hour advance reminders (jitter-safe 23h to 25h window)
 * 2. 30-minute direct access reminders (jitter-safe 20m to 40m window)
 * Supports both 1-on-1 sessions and group_circle sessions, and only stamps
 * reminder flags when external delivery succeeds.
 */

const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const Guardian = require('../models/Guardian');
const GroupCircle = require('../models/GroupCircle');
const { send24HourReminder, send30MinuteReminder, resolveAbsoluteRoomUrl } = require('./whatsapp');

/**
 * Helper to resolve the best recipient phone number for a student
 * Priority: Guardian phone -> User whatsappPhone -> User phone
 */
async function resolveGuardianOrStudentPhone(studentUser) {
  if (!studentUser) return null;

  // 1. Check if student has a linked guardian in User.guardian
  if (studentUser.guardian) {
    const guardianUser = await User.findById(studentUser.guardian).select('phone whatsappPhone');
    if (guardianUser?.whatsappPhone || guardianUser?.phone) {
      return guardianUser.whatsappPhone || guardianUser.phone;
    }
  }

  // 2. Check Guardian collection where children.student matches
  const guardianDoc = await Guardian.findOne({
    isActive: true,
    'children.student': studentUser._id,
  }).populate('user', 'phone whatsappPhone');
  if (guardianDoc?.user) {
    const phone = guardianDoc.user.whatsappPhone
      || guardianDoc.user.phone
      || guardianDoc.notificationPreferences?.sms?.phoneNumber;
    if (phone) return phone;
  }

  // 3. Fallback to student's own phone / whatsappPhone
  return studentUser.whatsappPhone || studentUser.phone || null;
}

/**
 * Resolve all active student users participating in a session (1-on-1 or group_circle),
 * excluding students who already excused or were marked absent.
 */
async function resolveSessionStudents(session) {
  if (!session) return [];

  const skippedIds = new Set();
  const candidateIds = new Set();
  const populatedById = new Map();

  if (Array.isArray(session.attendance)) {
    for (const entry of session.attendance) {
      if (!entry?.student) continue;
      const rawId = typeof entry.student === 'object' && entry.student._id
        ? String(entry.student._id)
        : String(entry.student);
      if (entry.status === 'excused' || entry.status === 'absent') {
        skippedIds.add(rawId);
      } else {
        candidateIds.add(rawId);
        if (typeof entry.student === 'object' && entry.student._id && entry.student.name) {
          populatedById.set(rawId, entry.student);
        }
      }
    }
  }

  if (session.student) {
    const sid = typeof session.student === 'object' && session.student._id
      ? String(session.student._id)
      : String(session.student);
    if (!skippedIds.has(sid)) {
      candidateIds.add(sid);
      if (typeof session.student === 'object' && session.student._id) {
        populatedById.set(sid, session.student);
      }
    }
  }

  if (session.circle) {
    const circleId = typeof session.circle === 'object' && session.circle._id
      ? session.circle._id
      : session.circle;
    const circle = await GroupCircle.findById(circleId).select('students').lean().catch(() => null);
    if (Array.isArray(circle?.students)) {
      for (const s of circle.students) {
        if (!s) continue;
        const sid = String(s);
        if (!skippedIds.has(sid)) {
          candidateIds.add(sid);
        }
      }
    }
  }

  const missingIds = Array.from(candidateIds).filter((id) => !populatedById.has(id));
  if (missingIds.length > 0) {
    const users = await User.find({ _id: { $in: missingIds } })
      .select('_id name phone whatsappPhone guardian')
      .lean();
    for (const user of users) {
      populatedById.set(String(user._id), user);
    }
  }

  return Array.from(candidateIds)
    .map((id) => populatedById.get(id))
    .filter(Boolean);
}

/**
 * Check and process 24-hour reminders (23 to 25 hours ahead for cron jitter safety)
 */
async function process24HourReminders() {
  let sentSessions = 0;
  try {
    const now = new Date();
    const minTime = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const sessions = await Session.find({
      status: 'accepted',
      scheduledAt: { $gte: minTime, $lte: maxTime },
      $or: [
        { 'reminders.dayBeforeSent': false },
        { 'reminders.dayBeforeSent': { $exists: false } },
      ],
    }).populate('student', 'name phone whatsappPhone guardian');

    if (sessions.length > 0) {
      console.log(`⏰ [Scheduler] Found ${sessions.length} sessions for 24h reminder`);
    }

    for (const session of sessions) {
      try {
        const students = await resolveSessionStudents(session);
        if (students.length === 0) continue;

        const alreadySentIds = new Set(
          (session.reminders?.dayBeforeRecipients || []).map((id) => String(id))
        );

        let eligibleCount = 0;
        let deliveredCount = 0;
        const newlyDeliveredIds = [];

        for (const studentUser of students) {
          const studentId = String(studentUser._id);
          if (alreadySentIds.has(studentId)) {
            eligibleCount += 1;
            deliveredCount += 1;
            continue;
          }

          const recipientPhone = await resolveGuardianOrStudentPhone(studentUser);
          if (!recipientPhone) {
            console.warn(`⚠️ [Scheduler] No contact phone found for student ${studentUser.name} (${studentId})`);
            continue;
          }

          eligibleCount += 1;
          const delivery = await send24HourReminder(session, studentUser, recipientPhone);
          if (delivery?.success === true) {
            deliveredCount += 1;
            newlyDeliveredIds.push(studentUser._id);
            console.log(`✅ [Scheduler] 24h reminder sent for session ${session._id} to ${recipientPhone}`);
          } else {
            console.warn(`⚠️ [Scheduler] 24h reminder delivery failed for session ${session._id} (${studentId}): ${delivery?.reason || 'unknown'}`);
          }
        }

        if (newlyDeliveredIds.length > 0 || (eligibleCount > 0 && deliveredCount === eligibleCount)) {
          const allDelivered = eligibleCount > 0 && deliveredCount === eligibleCount;
          const updateDoc = {};
          if (newlyDeliveredIds.length > 0) {
            updateDoc.$addToSet = { 'reminders.dayBeforeRecipients': { $each: newlyDeliveredIds } };
          }
          if (allDelivered) {
            updateDoc.$set = {
              'reminders.dayBeforeSent': true,
              'reminders.dayBeforeSentAt': new Date(),
            };
            sentSessions += 1;
          }
          if (Object.keys(updateDoc).length > 0) {
            await Session.updateOne({ _id: session._id }, updateDoc);
          }
        }
      } catch (err) {
        console.error(`❌ [Scheduler] Failed to send 24h reminder for session ${session._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ [Scheduler] Error processing 24-hour reminders:', err.message);
  }
  return sentSessions;
}

/**
 * Check and process 30-minute reminders (20 to 40 minutes ahead for cron jitter safety)
 */
async function process30MinuteReminders() {
  let sentSessions = 0;
  try {
    const now = new Date();
    const minTime = new Date(now.getTime() + 20 * 60 * 1000);
    const maxTime = new Date(now.getTime() + 40 * 60 * 1000);

    const sessions = await Session.find({
      status: 'accepted',
      scheduledAt: { $gte: minTime, $lte: maxTime },
      $or: [
        { 'reminders.halfHourSent': false },
        { 'reminders.halfHourSent': { $exists: false } },
      ],
    }).populate('student', 'name phone whatsappPhone guardian');

    if (sessions.length > 0) {
      console.log(`⏰ [Scheduler] Found ${sessions.length} sessions for 30m reminder`);
    }

    for (const session of sessions) {
      try {
        const students = await resolveSessionStudents(session);
        if (students.length === 0) continue;

        const alreadySentIds = new Set(
          (session.reminders?.halfHourRecipients || []).map((id) => String(id))
        );
        const roomUrl = resolveAbsoluteRoomUrl(session);

        let eligibleCount = 0;
        let deliveredCount = 0;
        const newlyDeliveredIds = [];

        for (const studentUser of students) {
          const studentId = String(studentUser._id);
          if (alreadySentIds.has(studentId)) {
            eligibleCount += 1;
            deliveredCount += 1;
            continue;
          }

          const recipientPhone = await resolveGuardianOrStudentPhone(studentUser);
          if (!recipientPhone) {
            console.warn(`⚠️ [Scheduler] No contact phone found for student ${studentUser.name} (${studentId})`);
            continue;
          }

          eligibleCount += 1;
          const delivery = await send30MinuteReminder(session, studentUser, recipientPhone, roomUrl);
          if (delivery?.success === true) {
            deliveredCount += 1;
            newlyDeliveredIds.push(studentUser._id);
            console.log(`✅ [Scheduler] 30m reminder sent for session ${session._id} to ${recipientPhone}`);
          } else {
            console.warn(`⚠️ [Scheduler] 30m reminder delivery failed for session ${session._id} (${studentId}): ${delivery?.reason || 'unknown'}`);
          }
        }

        if (newlyDeliveredIds.length > 0 || (eligibleCount > 0 && deliveredCount === eligibleCount)) {
          const allDelivered = eligibleCount > 0 && deliveredCount === eligibleCount;
          const updateDoc = {};
          if (newlyDeliveredIds.length > 0) {
            updateDoc.$addToSet = { 'reminders.halfHourRecipients': { $each: newlyDeliveredIds } };
          }
          if (allDelivered) {
            updateDoc.$set = {
              'reminders.halfHourSent': true,
              'reminders.halfHourSentAt': new Date(),
            };
            sentSessions += 1;
          }
          if (Object.keys(updateDoc).length > 0) {
            await Session.updateOne({ _id: session._id }, updateDoc);
          }
        }
      } catch (err) {
        console.error(`❌ [Scheduler] Failed to send 30m reminder for session ${session._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ [Scheduler] Error processing 30-minute reminders:', err.message);
  }
  return sentSessions;
}

/**
 * Run scheduler cycle
 */
async function checkUpcomingSessions() {
  if (mongoose.connection.readyState !== 1) {
    return { dayBeforeSent: 0, halfHourSent: 0, skipped: true };
  }
  const dayBeforeSent = await process24HourReminders();
  const halfHourSent = await process30MinuteReminders();
  return { dayBeforeSent, halfHourSent, skipped: false };
}

/**
 * Starts the automated scheduler (for persistent server deployments)
 */
function startScheduler() {
  console.log('🕒 [Scheduler] Automated session reminder service initialized (interval: 5 minutes)');

  setTimeout(() => {
    checkUpcomingSessions().catch((err) => {
      console.error('❌ [Scheduler] Initial check error:', err.message);
    });
  }, 10000);

  const intervalId = setInterval(() => {
    checkUpcomingSessions().catch((err) => {
      console.error('❌ [Scheduler] Interval check error:', err.message);
    });
  }, 5 * 60 * 1000);

  return intervalId;
}

module.exports = {
  startScheduler,
  checkUpcomingSessions,
  process24HourReminders,
  process30MinuteReminders,
  resolveSessionStudents,
  resolveGuardianOrStudentPhone,
};
