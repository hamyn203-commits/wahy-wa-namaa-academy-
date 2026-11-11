'use strict';

const mongoose = require('mongoose');
const StudentSubscription = require('../models/StudentSubscription');
const GroupCircle = require('../models/GroupCircle');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const { getPlan } = require('../config/subscriptionPlans');

const { isRunningCircle, circleStatusForCount, operationalCapacity } = require('./subscriptionCircleLifecycle');

const DAYS = new Set(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function normalizeSchedule(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 7).map((item) => ({
    day: String(item?.day || '').trim(),
    startTime: String(item?.startTime || '').trim(),
    endTime: String(item?.endTime || '').trim(),
  })).filter((item) => DAYS.has(item.day) && TIME_RE.test(item.startTime) && TIME_RE.test(item.endTime) && item.endTime > item.startTime);
}

function circleGenderForStudent(student, section) {
  const age = Number(student?.age || 0);
  const adult = age >= 18;

  if (section === 'ladies') return adult ? 'women' : 'girls';
  if (student?.gender === 'female') return adult ? 'women' : 'girls';
  return adult ? 'men' : 'boys';
}

function ageGroupForStudent(student) {
  const age = Number(student?.age || 0);
  if (age >= 18) return 'adults';
  if (age >= 13) return 'teens_13_17';
  if (age >= 8) return 'kids_8_12';
  return 'kids_4_7';
}

async function placeSubscription({
  subscriptionId,
  existingCircleId,
  circleName,
  schedule,
  timezone = 'Africa/Cairo',
  teacherId,
  allowFlexibleCircle = false,
}) {
  const dbSession = await mongoose.startSession();
  let result;

  try {
    await dbSession.withTransaction(async () => {
      const subscription = await StudentSubscription.findById(subscriptionId).session(dbSession);
      if (!subscription) {
        const error = new Error('Subscription not found');
        error.code = 'SUBSCRIPTION_NOT_FOUND';
        throw error;
      }
      if (subscription.status !== 'awaiting_placement') {
        const error = new Error('Subscription is not ready for placement');
        error.code = 'SUBSCRIPTION_NOT_READY_FOR_PLACEMENT';
        throw error;
      }
      if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
        subscription.preferredTeacher = teacherId;
      }
      if (!subscription.preferredTeacher && !existingCircleId) {
        const error = new Error('Preferred teacher is missing');
        error.code = 'PREFERRED_TEACHER_REQUIRED';
        throw error;
      }

      const plan = getPlan(subscription.planKey);
      if (!plan) {
        const error = new Error('Subscription plan is invalid');
        error.code = 'SUBSCRIPTION_PLAN_INVALID';
        throw error;
      }

      const student = await User.findById(subscription.student)
        .select('name gender age preferredTrack currentLevel circle')
        .session(dbSession);

      if (!student) {
        const error = new Error('Student not found');
        error.code = 'STUDENT_NOT_FOUND';
        throw error;
      }

      let teacher = subscription.preferredTeacher
        ? await Teacher.findOne({
            _id: subscription.preferredTeacher,
            status: 'approved',
            isVerified: true,
          }).session(dbSession)
        : null;

      let circle;
      const expectedGender = circleGenderForStudent(student, subscription.section);
      const expectedAgeGroup = ageGroupForStudent(student);
      const expectedTrack = student.preferredTrack || 'memorization';
      const expectedLevel = student.currentLevel || 'beginner';

      if (existingCircleId) {
        if (allowFlexibleCircle) {
          circle = await GroupCircle.findOne({
            _id: existingCircleId,
            status: { $nin: ['completed'] },
          }).session(dbSession);
          if (circle && (!teacher || String(circle.teacher) !== String(teacher._id))) {
            teacher = await Teacher.findOne({ _id: circle.teacher }).session(dbSession);
            if (teacher) subscription.preferredTeacher = teacher._id;
          }
        } else {
          if (!teacher) {
            const error = new Error('Preferred teacher is not available');
            error.code = 'PREFERRED_TEACHER_UNAVAILABLE';
            throw error;
          }
          circle = await GroupCircle.findOne({
            _id: existingCircleId,
            teacher: teacher._id,
            subscriptionPlanKey: plan.key,
            $or: [{ subscriptionSection: subscription.section }, { subscriptionSection: { $exists: false } }],
            gender: expectedGender,
            targetAgeGroup: expectedAgeGroup,
            track: expectedTrack,
            level: expectedLevel,
            status: { $nin: ['completed', 'paused'] },
          }).session(dbSession);
        }

        if (!circle) {
          const error = new Error('Selected circle is not compatible with this subscription');
          error.code = 'CIRCLE_NOT_COMPATIBLE';
          throw error;
        }
        if (circleName && String(circleName).trim()) {
          circle.name = String(circleName).trim().slice(0, 120);
        }
        if (Array.isArray(schedule) && schedule.length > 0) {
          const normalizedSchedule = normalizeSchedule(schedule);
          if (normalizedSchedule.length > 0) {
            circle.schedule = normalizedSchedule;
            circle.timezone = String(timezone || circle.timezone || 'Africa/Cairo').trim().slice(0, 80) || 'Africa/Cairo';
          }
        }
      } else {
        if (!teacher) {
          const error = new Error('Preferred teacher is not available');
          error.code = 'PREFERRED_TEACHER_UNAVAILABLE';
          throw error;
        }
        const normalizedSchedule = normalizeSchedule(schedule);
        const created = await GroupCircle.create([{
          name: String(circleName || '').trim().slice(0, 120)
            || `${plan.name.ar} — ${student.name}`,
          track: expectedTrack,
          level: expectedLevel,
          gender: expectedGender,
          targetAgeGroup: expectedAgeGroup,
          capacity: plan.maxStudents,
          subscriptionSection: subscription.section,
          teacher: teacher._id,
          students: [],
          schedule: normalizedSchedule,
          timezone: String(timezone || 'Africa/Cairo').trim().slice(0, 80) || 'Africa/Cairo',
          status: 'forming',
          pricePerSession: {
            egp: plan.pricePerSessionMinor / 100,
            usd: 1,
          },
          subscriptionPlanKey: plan.key,
        }], { session: dbSession });
        circle = created[0];
      }

      if (!allowFlexibleCircle) {
        const otherSection = await StudentSubscription.exists({
          circle: circle._id,
          status: { $in: ['placed', 'active', 'paused', 'renewal_queued'] },
          section: { $ne: subscription.section },
        }).session(dbSession);
        if (otherSection) {
          const error = new Error('الحلقة تابعة لقسم مختلف');
          error.code = 'CIRCLE_NOT_COMPATIBLE';
          throw error;
        }
      }
      circle.subscriptionSection = circle.subscriptionSection || subscription.section;
      circle.capacity = operationalCapacity(circle, plan);

      const alreadyInCircle = (circle.students || []).some(
        (studentId) => String(studentId) === String(student._id)
      );

      if (!alreadyInCircle) {
        if ((circle.students || []).length >= circle.capacity) {
          const error = new Error('Circle is already full');
          error.code = 'CIRCLE_FULL';
          throw error;
        }
        circle.students.push(student._id);
      }

      circle.status = circleStatusForCount(circle, plan);

      await circle.save({ session: dbSession });

      student.circle = circle._id;
      await student.save({ session: dbSession });

      const now = new Date();
      subscription.circle = circle._id;
      subscription.placedAt = now;
      subscription.status = isRunningCircle(circle) ? 'active' : 'placed';
      if (subscription.status === 'active' && !subscription.startedAt) {
        subscription.startedAt = now;
      }
      await subscription.save({ session: dbSession });

      const activatedStudentIds = subscription.status === 'active' ? [String(subscription.student)] : [];

      result = {
        subscriptionId: String(subscription._id),
        subscriptionStatus: subscription.status,
        circleId: String(circle._id),
        circleStatus: circle.status,
        studentId: String(student._id),
        teacherId: String(teacher._id),
        teacherUserId: teacher.user ? String(teacher.user) : null,
        circleName: circle.name,
        activatedStudentIds,
        studentCount: circle.students.length,
        capacity: circle.capacity,
        minimumToStart: plan.minStudents,
      };
    });

    return result;
  } finally {
    await dbSession.endSession();
  }
}

async function startSubscriptionCircle({ circleId, schedule, timezone = 'Africa/Cairo', allowUnderMinimum = false }) {
  const rows = normalizeSchedule(schedule);
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  if (!Array.isArray(schedule) || !rows.length || rows.length !== schedule.length) {
    fail('CIRCLE_SCHEDULE_INVALID', 'حدد أيامًا وأوقاتًا صحيحة، على أن تكون النهاية بعد البداية');
  }
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.day)) fail('CIRCLE_SCHEDULE_INVALID', 'حدد موعدًا واحدًا لكل يوم');
    seen.add(row.day);
  }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { fail('CIRCLE_TIMEZONE_INVALID', 'المنطقة الزمنية غير صحيحة'); }

  const dbSession = await mongoose.startSession();
  let result;
  try {
    await dbSession.withTransaction(async () => {
      const circle = await GroupCircle.findById(circleId).session(dbSession);
      if (!circle) fail('CIRCLE_NOT_FOUND', 'الحلقة غير موجودة');
      if (isRunningCircle(circle)) {
        result = { circleId: String(circle._id), alreadyStarted: true, studentIds: [], activatedStudentIds: [] };
        return;
      }
      if (!['forming', 'ready'].includes(circle.status)) {
        fail('CIRCLE_NOT_READY', 'الحلقة بدأت بالفعل أو غير متاحة للبدء');
      }
      const plan = getPlan(circle.subscriptionPlanKey || 'group');
      if (!plan) fail('SUBSCRIPTION_PLAN_INVALID', 'خطة الحلقة غير صحيحة');
      const teacher = allowUnderMinimum
        ? await Teacher.findOne({ _id: circle.teacher }).session(dbSession)
        : await Teacher.findOne({ _id: circle.teacher, status: 'approved', isVerified: true }).session(dbSession);
      if (!teacher) fail('PREFERRED_TEACHER_UNAVAILABLE', 'معلم الحلقة غير متاح');
      const placed = await StudentSubscription.find(
        allowUnderMinimum
          ? { circle: circle._id, student: { $in: circle.students }, status: { $in: ['placed', 'active'] }, sessionsRemaining: { $gt: 0 } }
          : {
              circle: circle._id, student: { $in: circle.students }, status: 'placed', sessionsRemaining: { $gt: 0 },
              planKey: plan.key, preferredTeacher: circle.teacher,
            }
      ).session(dbSession);
      const studentIds = allowUnderMinimum
        ? [...new Set((circle.students || []).map(item => String(item)))]
        : [...new Set(placed.map(item => String(item.student)))];
      circle.capacity = operationalCapacity(circle, plan);
      if (!allowUnderMinimum && (new Set(placed.map(item => item.section)).size > 1 || placed.some(item => circle.subscriptionSection && item.section !== circle.subscriptionSection))) {
        fail('CIRCLE_NOT_COMPATIBLE', 'اشتراكات الحلقة تابعة لأقسام مختلفة');
      }
      if ((!allowUnderMinimum && (studentIds.length !== circle.students.length || studentIds.length < plan.minStudents)) || studentIds.length < 1 || studentIds.length > circle.capacity) {
        fail('CIRCLE_MINIMUM_NOT_MET', `تحتاج الحلقة إلى ${plan.minStudents} طالبًا باشتراكات مدفوعة ومتوافقة قبل البدء`);
      }
      for (const row of rows) {
        const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        const duration = minutes(row.endTime) - minutes(row.startTime);
        const minDuration = allowUnderMinimum ? 15 : (plan.durationMinMinutes || 1);
        const maxDuration = allowUnderMinimum ? 240 : plan.durationMaxMinutes;
        if (duration < minDuration || duration > maxDuration) {
          fail('CIRCLE_SCHEDULE_INVALID', 'مدة الموعد غير متوافقة مع خطة الحلقة');
        }
      }
      const now = new Date();
      circle.subscriptionSection = circle.subscriptionSection || placed[0]?.section;
      circle.schedule = rows;
      circle.timezone = timezone;
      circle.startedAt = now;
      circle.status = studentIds.length >= circle.capacity ? 'full' : 'active';
      await circle.save({ session: dbSession });
      if (placed.length > 0) {
        await StudentSubscription.updateMany({ _id: { $in: placed.map(item => item._id) }, status: 'placed' },
          { $set: { status: 'active', startedAt: now } }, { session: dbSession });
      }
      result = { circleId: String(circle._id), circleName: circle.name, circleStatus: circle.status,
        studentIds, activatedStudentIds: studentIds, teacherUserId: teacher.user ? String(teacher.user) : null };
    });
    return result;
  } finally { await dbSession.endSession(); }
}

module.exports = {
  normalizeSchedule,
  circleGenderForStudent,
  ageGroupForStudent,
  placeSubscription,
  startSubscriptionCircle,
};

