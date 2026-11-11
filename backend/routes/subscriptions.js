const express = require('express');
const router = express.Router();

const StudentSubscription = require('../models/StudentSubscription');
const User = require('../models/User');
const GroupCircle = require('../models/GroupCircle');
const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');

async function isGuardianLinkedToStudent(guardianUserId, studentId) {
  if (!guardianUserId || !studentId) return false;
  const guardianDoc = await Guardian.findOne({ user: guardianUserId, 'children.student': studentId }).select('_id').lean();
  if (guardianDoc) return true;
  const userDoc = await User.findOne({ _id: guardianUserId, children: studentId }).select('_id').lean();
  return Boolean(userDoc);
}
const { protect, authorize } = require('../middleware/auth');
const {
  placeSubscription,
  startSubscriptionCircle,
  normalizeSchedule,
  circleGenderForStudent,
  ageGroupForStudent,
} = require('../services/subscriptionPlacement');
const { circleStatusForCount, operationalCapacity } = require('../services/subscriptionCircleLifecycle');
const { getPlan } = require('../config/subscriptionPlans');
const { logAdminAction } = require('../services/adminAudit');
const { notifyUser } = require('../utils/notify');
const {
  isSection,
  isCompatibleStudentSection,
  publicPlanCatalog,
  quoteSubscription,
} = require('../config/subscriptionPlans');

function serializeSubscription(subscription) {
  const value = typeof subscription?.toObject === 'function'
    ? subscription.toObject()
    : subscription;

  if (!value) return null;

  return {
    _id: value._id,
    planKey: value.planKey,
    section: value.section,
    sessionCount: value.sessionCount,
    sessionsUsed: value.sessionsUsed,
    sessionsRemaining: value.sessionsRemaining,
    currency: value.currency,
    pricePerSessionMinor: value.pricePerSessionMinor,
    totalAmountMinor: value.totalAmountMinor,
    status: value.status,
    circle: value.circle || null,
    payment: value.payment || null,
    preferredTeacher: value.preferredTeacher || null,
    renewalOf: value.renewalOf || null,
    pricingSnapshot: value.pricingSnapshot,
    selectedAt: value.selectedAt,
    paidAt: value.paidAt || null,
    renewalQueuedAt: value.renewalQueuedAt || null,
    placedAt: value.placedAt || null,
    startedAt: value.startedAt || null,
    completedAt: value.completedAt || null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

router.get('/plans', (_req, res) => {
  return res.json({
    success: true,
    ...publicPlanCatalog(),
  });
});

router.get('/me', protect, authorize('student'), async (req, res) => {
  try {
    const subscriptions = await StudentSubscription.find({ student: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({
        path: 'preferredTeacher',
        select: 'personalInfo user',
        populate: { path: 'user', select: 'name avatar' },
      })
      .populate('circle', 'name code status capacity students schedule timezone')
      .lean();

    return res.json({
      success: true,
      subscriptions: subscriptions.map(serializeSubscription),
    });
  } catch (error) {
    return res.status(500).json({ error: 'فشل جلب الاشتراكات', details: error.message });
  }
});

router.post('/:id/renew', protect, authorize('student', 'guardian'), async (req, res) => {
  if (req.user.role === 'guardian') {
    const targetSub = await StudentSubscription.findById(req.params.id).select('student').lean();
    if (!targetSub || !(await isGuardianLinkedToStudent(req.user.id, targetSub.student))) {
      return res.status(403).json({ error: 'غير مصرح بتجديد اشتراك هذا الطالب' });
    }
    req.user = { ...req.user, id: String(targetSub.student) };
  }
  try {
    const source = await StudentSubscription.findOne({
      _id: req.params.id,
      student: req.user.id,
    });

    if (!source) {
      return res.status(404).json({ error: 'الاشتراك غير موجود', code: 'SUBSCRIPTION_NOT_FOUND' });
    }

    const canRenewActive = source.status === 'active' && source.sessionsRemaining <= 2;
    const canRenewCompleted = source.status === 'completed';
    if (!canRenewActive && !canRenewCompleted) {
      return res.status(409).json({
        error: 'التجديد متاح عند بقاء حصتين أو أقل أو بعد انتهاء الباقة',
        code: 'SUBSCRIPTION_NOT_RENEWABLE',
        remaining: source.sessionsRemaining,
        status: source.status,
      });
    }

    if (!source.preferredTeacher || !source.circle) {
      return res.status(409).json({
        error: 'لا يمكن التجديد التلقائي بدون معلم وجروب حاليين',
        code: 'RENEWAL_PLACEMENT_CONTEXT_MISSING',
      });
    }

    const sessionCount = Number(req.body.sessionCount);
    let quote;
    try {
      quote = quoteSubscription({ planKey: source.planKey, sessionCount });
    } catch (error) {
      return res.status(400).json({
        error: error.message,
        code: error.code || 'SUBSCRIPTION_RENEWAL_INVALID',
      });
    }

    const existingRenewal = await StudentSubscription.findOne({
      renewalOf: source._id,
      status: { $in: ['pending_payment', 'payment_review', 'renewal_queued', 'awaiting_placement', 'placed', 'active', 'paused'] },
    });

    if (existingRenewal) {
      return res.status(409).json({
        error: 'يوجد تجديد قائم بالفعل لهذه الباقة',
        code: 'RENEWAL_ALREADY_EXISTS',
        subscription: serializeSubscription(existingRenewal),
      });
    }

    const { plan } = quote;
    const renewal = await StudentSubscription.create({
      student: req.user.id,
      planKey: source.planKey,
      section: source.section,
      sessionCount: quote.sessionCount,
      sessionsUsed: 0,
      sessionsRemaining: quote.sessionCount,
      currency: quote.currency,
      pricePerSessionMinor: quote.pricePerSessionMinor,
      totalAmountMinor: quote.totalAmountMinor,
      status: 'pending_payment',
      preferredTeacher: source.preferredTeacher,
      circle: source.circle,
      renewalOf: source._id,
      pricingSnapshot: {
        minStudents: plan.minStudents,
        maxStudents: plan.maxStudents,
        durationMinMinutes: plan.durationMinMinutes,
        durationMaxMinutes: plan.durationMaxMinutes,
        nameAr: plan.name.ar,
        nameEn: plan.name.en,
        durationLabelAr: plan.durationLabel.ar,
        durationLabelEn: plan.durationLabel.en,
      },
      selectedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      renewal: true,
      subscription: serializeSubscription(renewal),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'يوجد تجديد قائم بالفعل',
        code: 'RENEWAL_ALREADY_EXISTS',
      });
    }
    return res.status(500).json({ error: 'فشل إنشاء التجديد', details: error.message });
  }
});

router.post('/select', protect, authorize('student', 'guardian'), async (req, res) => {
  if (req.user.role === 'guardian') {
    const requestedStudentId = String(req.body.studentId || '').trim();
    if (!requestedStudentId || !(await isGuardianLinkedToStudent(req.user.id, requestedStudentId))) {
      return res.status(403).json({ error: 'غير مصرح باختيار باقة لهذا الطالب' });
    }
    req.user = { ...req.user, id: requestedStudentId };
  }
  try {
    const planKey = String(req.body.planKey || '').trim();
    const section = String(req.body.section || '').trim();
    const sessionCount = Number(req.body.sessionCount);

    if (!isSection(section)) {
      return res.status(400).json({
        error: 'القسم غير متاح',
        code: 'SUBSCRIPTION_SECTION_INVALID',
      });
    }

    const student = await User.findById(req.user.id).select('enrollmentSection role isActive');
    if (!student || student.role !== 'student' || student.isActive === false) {
      return res.status(403).json({ error: 'حساب الطالب غير متاح', code: 'STUDENT_ACCOUNT_UNAVAILABLE' });
    }
    if (!isCompatibleStudentSection(student.enrollmentSection, section)) {
      return res.status(409).json({
        error: 'القسم المحدد لا يتطابق مع القسم المسجل في حسابك. تواصل مع الإدارة لتصحيح القسم.',
        code: 'SUBSCRIPTION_SECTION_MISMATCH',
      });
    }

    let quote;
    try {
      quote = quoteSubscription({ planKey, sessionCount });
    } catch (error) {
      return res.status(400).json({
        error: error.message,
        code: error.code || 'SUBSCRIPTION_SELECTION_INVALID',
      });
    }

    const pendingRenewal = await StudentSubscription.findOne({
      student: req.user.id,
      renewalOf: { $ne: null },
      status: 'pending_payment',
    }).select('_id status renewalOf');

    if (pendingRenewal) {
      return res.status(409).json({
        error: 'لديك طلب تجديد ينتظر الدفع. أكمل التجديد قبل اختيار باقة جديدة.',
        code: 'RENEWAL_PAYMENT_PENDING',
        subscriptionId: String(pendingRenewal._id),
        status: pendingRenewal.status,
      });
    }

    const existingOpen = await StudentSubscription.findOne({
      student: req.user.id,
      status: { $in: ['payment_review', 'renewal_queued', 'awaiting_placement', 'placed', 'active', 'paused'] },
    }).select('_id status');

    if (existingOpen) {
      return res.status(409).json({
        error: 'لديك اشتراك قائم بالفعل. أكمل مراجعته أو تسكينه قبل إنشاء اشتراك جديد.',
        code: 'SUBSCRIPTION_ALREADY_OPEN',
        subscriptionId: String(existingOpen._id),
        status: existingOpen.status,
      });
    }

    const { plan } = quote;
    const update = {
      planKey: plan.key,
      section,
      sessionCount: quote.sessionCount,
      sessionsUsed: 0,
      sessionsRemaining: quote.sessionCount,
      currency: quote.currency,
      pricePerSessionMinor: quote.pricePerSessionMinor,
      totalAmountMinor: quote.totalAmountMinor,
      status: 'pending_payment',
      circle: null,
      payment: null,
      preferredTeacher: null,
      pricingSnapshot: {
        minStudents: plan.minStudents,
        maxStudents: plan.maxStudents,
        durationMinMinutes: plan.durationMinMinutes,
        durationMaxMinutes: plan.durationMaxMinutes,
        nameAr: plan.name.ar,
        nameEn: plan.name.en,
        durationLabelAr: plan.durationLabel.ar,
        durationLabelEn: plan.durationLabel.en,
      },
      selectedAt: new Date(),
      startedAt: null,
      completedAt: null,
    };

    const subscription = await StudentSubscription.findOneAndUpdate(
      { student: req.user.id, status: 'pending_payment', renewalOf: null },
      { $set: update, $setOnInsert: { student: req.user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'تم حفظ اختيار الباقة. لن يتم الخصم قبل إتمام خطوة الدفع.',
      checkoutReady: false,
      subscription: serializeSubscription(subscription),
    });
  } catch (error) {
    return res.status(500).json({ error: 'فشل حفظ اختيار الاشتراك', details: error.message });
  }
});


router.get('/admin/placements', protect, authorize('admin'), async (req, res) => {
  try {
    const requestedStatus = String(req.query.status || 'awaiting_placement').trim();
    const allowedStatuses = new Set(['awaiting_placement', 'placed', 'active', 'all']);
    const status = allowedStatuses.has(requestedStatus) ? requestedStatus : 'awaiting_placement';
    const filter = status === 'all'
      ? { status: { $in: ['awaiting_placement', 'placed', 'active'] } }
      : { status };

    const subscriptions = await StudentSubscription.find(filter)
      .sort({ paidAt: 1, createdAt: 1 })
      .limit(100)
      .populate('student', 'name email phone gender age preferredTrack currentLevel')
      .populate({
        path: 'preferredTeacher',
        select: 'personalInfo user status isVerified',
        populate: { path: 'user', select: 'name email avatar' },
      })
      .populate('circle', 'name code status capacity students schedule timezone subscriptionPlanKey teacher')
      .lean();

    const [allOpenCircles, approvedTeachers] = await Promise.all([
      GroupCircle.find({
        status: { $nin: ['completed'] },
      })
        .select('name code status capacity students schedule timezone subscriptionPlanKey subscriptionSection teacher gender targetAgeGroup track level')
        .lean(),
      Teacher.find({ status: 'approved', isVerified: true })
        .select('personalInfo.fullName personalInfo.gender user')
        .populate('user', 'name email')
        .lean(),
    ]);

    const rows = subscriptions.map((subscription) => {
      const student = subscription.student || {};
      const expectedGender = circleGenderForStudent(student, subscription.section);
      const expectedAgeGroup = ageGroupForStudent(student);
      const expectedTrack = student.preferredTrack || 'memorization';
      const expectedLevel = student.currentLevel || 'beginner';

      const compatibleCircles = allOpenCircles
        .filter((circle) => (
          String(circle.teacher) === String(subscription.preferredTeacher?._id || '')
          && circle.subscriptionPlanKey === subscription.planKey
          && (!circle.subscriptionSection || circle.subscriptionSection === subscription.section)
          && circle.gender === expectedGender
          && circle.targetAgeGroup === expectedAgeGroup
          && circle.track === expectedTrack
          && circle.level === expectedLevel
          && !['completed', 'paused'].includes(circle.status)
          && (circle.students || []).length < operationalCapacity(circle)
        ))
        .map((circle) => ({
          _id: circle._id,
          name: circle.name,
          code: circle.code,
          status: circle.status,
          capacity: operationalCapacity(circle),
          currentCount: (circle.students || []).length,
          availableSeats: Math.max(0, operationalCapacity(circle) - (circle.students || []).length),
          schedule: circle.schedule || [],
          timezone: circle.timezone,
          isFlexible: false,
        }));

      const compatibleIds = new Set(compatibleCircles.map((c) => String(c._id)));
      const flexibleCircles = allOpenCircles
        .filter((circle) => (
          !compatibleIds.has(String(circle._id))
          && (circle.students || []).length < operationalCapacity(circle)
        ))
        .map((circle) => ({
          _id: circle._id,
          name: circle.name,
          code: circle.code,
          status: circle.status,
          teacherId: circle.teacher,
          planKey: circle.subscriptionPlanKey,
          capacity: operationalCapacity(circle),
          currentCount: (circle.students || []).length,
          availableSeats: Math.max(0, operationalCapacity(circle) - (circle.students || []).length),
          schedule: circle.schedule || [],
          timezone: circle.timezone,
          isFlexible: true,
        }));

      return {
        ...serializeSubscription(subscription),
        student: subscription.student,
        preferredTeacher: subscription.preferredTeacher,
        compatibleCircles,
        flexibleCircles,
      };
    });

    return res.json({
      subscriptions: rows,
      teachers: approvedTeachers.map((t) => ({
        _id: t._id,
        name: t.personalInfo?.fullName || t.user?.name || 'معلم',
        gender: t.personalInfo?.gender || 'male',
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'فشل تحميل طلبات التسكين', details: error.message });
  }
});

router.get('/admin/circles', protect, authorize('admin'), async (_req, res) => {
  try {
    const [circles, approvedTeachers, allStudents] = await Promise.all([
      GroupCircle.find({ subscriptionPlanKey: { $in: ['community', 'group', 'focused', 'mini', 'private'] }, status: { $ne: 'completed' } })
        .sort({ createdAt: -1 }).limit(100)
        .populate({ path: 'teacher', select: 'personalInfo user', populate: { path: 'user', select: 'name' } })
        .populate('students', 'name email phone gender age currentLevel')
        .lean(),
      Teacher.find({ status: 'approved', isVerified: true })
        .select('personalInfo.fullName personalInfo.gender user')
        .populate('user', 'name email')
        .lean(),
      User.find({ role: 'student', isActive: { $ne: false } })
        .sort({ createdAt: -1 })
        .limit(200)
        .select('name email phone gender age currentLevel circle')
        .lean(),
    ]);
    const subscriptions = await StudentSubscription.find({ circle: { $in: circles.map(item => item._id) }, status: { $in: ['placed', 'active', 'paused', 'renewal_queued'] } })
      .populate('student', 'name email').lean();
    return res.json({
      success: true,
      teachers: approvedTeachers.map((t) => ({
        _id: t._id,
        name: t.personalInfo?.fullName || t.user?.name || 'معلم',
        gender: t.personalInfo?.gender || 'male',
      })),
      students: allStudents.map((s) => ({
        _id: s._id,
        name: s.name,
        email: s.email,
        gender: s.gender,
        currentLevel: s.currentLevel,
        circleId: s.circle || null,
      })),
      circles: circles.map(circle => {
        const plan = getPlan(circle.subscriptionPlanKey || 'group');
        const rawStudentDocs = Array.isArray(circle.students) ? circle.students : [];
        const subRoster = subscriptions.filter(item => String(item.circle) === String(circle._id) && rawStudentDocs.some(s => String(s?._id || s) === String(item.student?._id)));
        const subStudentIds = new Set(subRoster.map(item => String(item.student?._id)));
        const fallbackRoster = rawStudentDocs
          .filter(s => s && typeof s === 'object' && s._id && !subStudentIds.has(String(s._id)))
          .map(s => ({
            _id: `direct-${s._id}`,
            student: { _id: s._id, name: s.name, email: s.email },
            status: ['active', 'full'].includes(circle.status) ? 'active' : 'placed',
            sessionsRemaining: plan?.defaultSessions || 8,
            sessionCount: plan?.defaultSessions || 8,
            sessionsUsed: 0,
          }));
        const fullRoster = [
          ...subRoster.map(item => ({ ...serializeSubscription(item), student: item.student })),
          ...fallbackRoster,
        ];
        return {
          _id: circle._id, name: circle.name, code: circle.code, status: circleStatusForCount(circle, plan),
          teacher: circle.teacher, plan, section: circle.subscriptionSection || subRoster[0]?.section,
          studentCount: rawStudentDocs.length, capacity: operationalCapacity(circle, plan),
          minimumToStart: plan.minStudents, missingToStart: Math.max(0, plan.minStudents - rawStudentDocs.length),
          schedule: circle.schedule, timezone: circle.timezone, startedAt: circle.startedAt || null,
          roster: fullRoster,
        };
      }),
    });
  } catch (error) { return res.status(500).json({ error: 'فشل تحميل الحلقات', details: error.message }); }
});

router.post('/admin/circles/:id/start', protect, authorize('admin'), async (req, res) => {
  try {
    const allowUnderMinimum = Boolean(req.body?.allowUnderMinimum);
    const result = await startSubscriptionCircle({
      circleId: req.params.id,
      schedule: req.body.schedule,
      timezone: req.body.timezone,
      allowUnderMinimum,
    });
    await logAdminAction({ req, action: 'subscription-circle.started', entityType: 'group-circle', entityId: result.circleId,
      reason: allowUnderMinimum ? 'تم تحديد المواعيد وبدء الحلقة بقرار إداري قبل اكتمال الحد الأدنى.' : 'تم تحديد المواعيد وبدء الحلقة بعد اكتمال الاشتراكات المدفوعة.',
      metadata: { studentCount: result.activatedStudentIds.length, allowUnderMinimum } }).catch(() => {});
    const recipients = [...result.activatedStudentIds, result.teacherUserId].filter(Boolean);
    await Promise.allSettled(recipients.map(id => notifyUser(id, {
      type: 'system', title: { ar: 'تم بدء الحلقة وتحديد مواعيدها', en: 'Your circle has started' },
      message: { ar: `بدأت حلقة ${result.circleName}. راجع المواعيد في لوحة المتابعة. لا تخصم الحصص إلا بعد إتمامها.`, en: `${result.circleName} has started. Check your dashboard for the schedule. Credits are consumed after session completion.` },
      data: { actionUrl: id === result.teacherUserId ? '/teacher/dashboard' : '/student/dashboard', metadata: { circleId: result.circleId } }, priority: 'high',
    })));
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(error.code === 'CIRCLE_NOT_FOUND' ? 404 : error.code?.includes('INVALID') ? 400 : 409)
      .json({ error: error.message || 'فشل بدء الحلقة', code: error.code || 'CIRCLE_START_FAILED' });
  }
});

router.put('/admin/circles/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });

    const { name, teacherId, schedule, timezone, capacity } = req.body || {};
    const changedFields = [];

    if (typeof name === 'string' && name.trim()) {
      circle.name = name.trim().slice(0, 120);
      changedFields.push('name');
    }

    if (teacherId && String(teacherId) !== String(circle.teacher)) {
      const nextTeacher = await Teacher.findById(teacherId);
      if (!nextTeacher) {
        return res.status(404).json({ error: 'المعلم المختار غير موجود' });
      }
      circle.teacher = nextTeacher._id;
      await StudentSubscription.updateMany(
        { circle: circle._id, status: { $in: ['placed', 'active', 'paused'] } },
        { $set: { preferredTeacher: nextTeacher._id } }
      );
      changedFields.push('teacher');
    }

    if (capacity !== undefined && Number.isFinite(Number(capacity)) && Number(capacity) >= 1 && Number(capacity) <= 20) {
      circle.capacity = Number(capacity);
      changedFields.push('capacity');
    }

    if (timezone && typeof timezone === 'string' && timezone.trim()) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone.trim() }).format();
        circle.timezone = timezone.trim();
        changedFields.push('timezone');
      } catch {
        return res.status(400).json({ error: 'المنطقة الزمنية غير صحيحة', code: 'CIRCLE_TIMEZONE_INVALID' });
      }
    }

    if (Array.isArray(schedule)) {
      const rows = normalizeSchedule(schedule);
      if (schedule.length > 0 && (!rows.length || rows.length !== schedule.length)) {
        return res.status(400).json({
          error: 'حدد أيامًا وأوقاتًا صحيحة، على أن تكون النهاية بعد البداية',
          code: 'CIRCLE_SCHEDULE_INVALID',
        });
      }
      const seen = new Set();
      for (const row of rows) {
        if (seen.has(row.day)) {
          return res.status(400).json({ error: 'حدد موعدًا واحدًا لكل يوم', code: 'CIRCLE_SCHEDULE_INVALID' });
        }
        seen.add(row.day);
      }
      circle.schedule = rows;
      changedFields.push('schedule');
    }

    await circle.save();

    await logAdminAction({
      req,
      action: 'subscription-circle.updated',
      entityType: 'group-circle',
      entityId: String(circle._id),
      reason: 'تعديل بيانات أو مواعيد أو معلم الحلقة من الإدارة',
      metadata: { changedFields, circleName: circle.name },
    }).catch(() => {});

    if (changedFields.includes('schedule') && (circle.students || []).length > 0) {
      await Promise.allSettled(
        circle.students.map((studentId) => notifyUser(studentId, {
          type: 'system',
          title: { ar: 'تحديث مواعيد الحلقة', en: 'Circle schedule updated' },
          message: {
            ar: `تم تحديث مواعيد حلقة ${circle.name}. راجع المواعيد الجديدة في لوحة المتابعة.`,
            en: `The schedule for ${circle.name} has been updated.`,
          },
          data: { actionUrl: '/student/dashboard', metadata: { circleId: String(circle._id) } },
          priority: 'high',
        }))
      );
    }

    return res.json({ success: true, circle });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل تحديث بيانات الحلقة' });
  }
});

router.post('/admin/circles/:id/students', protect, authorize('admin'), async (req, res) => {
  try {
    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });

    const { studentId, sessionCount = 8 } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'اختر الطالب المراد إضافته للحلقة' });

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const plan = getPlan(circle.subscriptionPlanKey || 'group');
    const maxCap = operationalCapacity(circle, plan);
    const alreadyInCircle = (circle.students || []).some((id) => String(id) === String(student._id));

    if (!alreadyInCircle) {
      if ((circle.students || []).length >= maxCap) {
        return res.status(409).json({ error: 'الحلقة مكتملة العدد بالفعل', code: 'CIRCLE_FULL' });
      }
      circle.students.push(student._id);
    }

    const isRunning = ['active', 'full'].includes(circle.status) || Boolean(circle.startedAt);
    const targetSubStatus = isRunning ? 'active' : 'placed';
    const now = new Date();

    let sub = await StudentSubscription.findOne({
      student: student._id,
      status: { $in: ['awaiting_placement', 'placed', 'active'] },
    }).sort({ createdAt: -1 });

    if (sub) {
      if (sub.circle && String(sub.circle) !== String(circle._id)) {
        await GroupCircle.updateOne({ _id: sub.circle }, { $pull: { students: student._id } });
      }
      sub.circle = circle._id;
      sub.preferredTeacher = circle.teacher;
      sub.placedAt = sub.placedAt || now;
      sub.status = targetSubStatus;
      if (targetSubStatus === 'active' && !sub.startedAt) sub.startedAt = now;
      await sub.save();
    } else {
      const validCount = [4, 8, 12, 24].includes(Number(sessionCount)) ? Number(sessionCount) : 8;
      const pricePerSessionMinor = plan?.pricePerSessionMinor || 5500;
      sub = await StudentSubscription.create({
        student: student._id,
        planKey: circle.subscriptionPlanKey || 'group',
        section: circle.subscriptionSection || (student.gender === 'female' ? 'ladies' : 'men_children'),
        sessionCount: validCount,
        sessionsUsed: 0,
        sessionsRemaining: validCount,
        currency: 'EGP',
        pricePerSessionMinor,
        totalAmountMinor: pricePerSessionMinor * validCount,
        status: targetSubStatus,
        preferredTeacher: circle.teacher,
        circle: circle._id,
        paidAt: now,
        placedAt: now,
        startedAt: targetSubStatus === 'active' ? now : undefined,
        pricingSnapshot: plan ? {
          minStudents: plan.minStudents,
          maxStudents: plan.maxStudents,
          durationMinMinutes: plan.durationMinMinutes,
          durationMaxMinutes: plan.durationMaxMinutes,
          nameAr: plan.name?.ar || plan.nameAr,
          nameEn: plan.name?.en || plan.nameEn,
          durationLabelAr: plan.durationLabel?.ar || plan.durationLabelAr,
          durationLabelEn: plan.durationLabel?.en || plan.durationLabelEn,
        } : undefined,
      });
    }

    circle.status = circleStatusForCount(circle, plan);
    await circle.save();

    student.circle = circle._id;
    await student.save();

    await logAdminAction({
      req,
      action: 'subscription-circle.student-added',
      entityType: 'group-circle',
      entityId: String(circle._id),
      reason: 'إضافة طالب إلى الحلقة من الإدارة',
      metadata: { studentId: String(student._id), studentName: student.name },
    }).catch(() => {});

    return res.json({ success: true, circle, subscription: serializeSubscription(sub) });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل إضافة الطالب للحلقة' });
  }
});

router.delete('/admin/circles/:id/students/:studentId', protect, authorize('admin'), async (req, res) => {
  try {
    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });

    const { studentId } = req.params;
    circle.students = (circle.students || []).filter((id) => String(id) !== String(studentId));

    const plan = getPlan(circle.subscriptionPlanKey || 'group');
    circle.status = circleStatusForCount(circle, plan);
    await circle.save();

    await Promise.all([
      User.updateOne({ _id: studentId, circle: circle._id }, { $unset: { circle: 1 } }),
      StudentSubscription.updateMany(
        { student: studentId, circle: circle._id, status: { $in: ['placed', 'active', 'paused'] } },
        { $set: { status: 'awaiting_placement', circle: null } }
      ),
    ]);

    await logAdminAction({
      req,
      action: 'subscription-circle.student-removed',
      entityType: 'group-circle',
      entityId: String(circle._id),
      reason: 'إزالة طالب من الحلقة من الإدارة وإعادته لطابور التسكين',
      metadata: { studentId: String(studentId) },
    }).catch(() => {});

    return res.json({ success: true, circle });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل إزالة الطالب من الحلقة' });
  }
});

router.post('/admin/circles', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      teacherId,
      planKey = 'group',
      section = 'men_children',
      track = 'memorization',
      level = 'beginner',
      gender = 'men',
      targetAgeGroup = 'adults',
      schedule = [],
      timezone = 'Africa/Cairo',
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'اسم المجموعة مطلوب' });
    }
    if (!teacherId) {
      return res.status(400).json({ error: 'اختر المعلم المسؤول عن المجموعة' });
    }
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'المعلم غير موجود' });
    }

    const plan = getPlan(planKey) || getPlan('group');
    const normalizedSchedule = normalizeSchedule(schedule);

    const circle = await GroupCircle.create({
      name: String(name).trim().slice(0, 120),
      track: ['memorization', 'tajweed_ijazah', 'kids_foundation'].includes(track) ? track : 'memorization',
      level: ['beginner', 'intermediate', 'advanced', 'ijazah'].includes(level) ? level : 'beginner',
      gender: ['boys', 'girls', 'men', 'women', 'kids_mixed'].includes(gender) ? gender : (section === 'ladies' ? 'women' : 'men'),
      targetAgeGroup: ['kids_4_7', 'kids_8_12', 'teens_13_17', 'adults'].includes(targetAgeGroup) ? targetAgeGroup : 'adults',
      capacity: plan.maxStudents || 8,
      subscriptionSection: section === 'ladies' ? 'ladies' : 'men_children',
      teacher: teacher._id,
      students: [],
      schedule: normalizedSchedule,
      timezone: String(timezone || 'Africa/Cairo').trim().slice(0, 80) || 'Africa/Cairo',
      status: 'forming',
      pricePerSession: {
        egp: (plan.pricePerSessionMinor || 5500) / 100,
        usd: 1,
      },
      subscriptionPlanKey: plan.key,
    });

    await logAdminAction({
      req,
      action: 'subscription-circle.created-by-admin',
      entityType: 'group-circle',
      entityId: String(circle._id),
      reason: 'إنشاء مجموعة جديدة من لوحة الإدارة',
      metadata: { name: circle.name, planKey: circle.subscriptionPlanKey },
    }).catch(() => {});

    return res.status(201).json({ success: true, circle });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل إنشاء المجموعة' });
  }
});

router.delete('/admin/circles/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });

    const circleId = circle._id;
    const circleName = circle.name;

    await Promise.all([
      User.updateMany({ circle: circleId }, { $unset: { circle: 1 } }),
      StudentSubscription.updateMany(
        { circle: circleId, status: { $in: ['placed', 'active', 'paused'] } },
        { $set: { status: 'awaiting_placement', circle: null } }
      ),
    ]);

    await GroupCircle.findByIdAndDelete(circleId);

    await logAdminAction({
      req,
      action: 'subscription-circle.deleted-by-admin',
      entityType: 'group-circle',
      entityId: String(circleId),
      reason: 'حذف الحلقة من الإدارة وإعادة الطلاب لطابور التسكين',
      metadata: { circleName },
    }).catch(() => {});

    return res.json({ success: true, deletedId: String(circleId) });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل حذف الحلقة' });
  }
});

router.put('/admin/circles/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) return res.status(404).json({ error: 'الحلقة غير موجودة' });

    const requestedStatus = String(req.body?.status || '').trim();
    if (!['active', 'paused'].includes(requestedStatus)) {
      return res.status(400).json({ error: 'الحالة المطلوبة غير صحيحة' });
    }

    const plan = getPlan(circle.subscriptionPlanKey);
    const nextStatus = requestedStatus === 'paused' ? 'paused' : circleStatusForCount(circle, plan);
    circle.status = nextStatus === 'paused' ? 'paused' : (circle.startedAt ? 'active' : nextStatus);
    await circle.save();

    await logAdminAction({
      req,
      action: requestedStatus === 'paused' ? 'subscription-circle.paused' : 'subscription-circle.resumed',
      entityType: 'group-circle',
      entityId: String(circle._id),
      reason: String(req.body?.reason || (requestedStatus === 'paused' ? 'إيقاف مؤقت للحلقة من الإدارة' : 'استئناف الحلقة من الإدارة')).slice(0, 200),
      metadata: { status: circle.status },
    }).catch(() => {});

    return res.json({ success: true, circle });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'فشل تحديث حالة الحلقة' });
  }
});

router.post('/admin/:id/place', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await placeSubscription({
      subscriptionId: req.params.id,
      existingCircleId: req.body?.existingCircleId,
      circleName: req.body?.circleName,
      schedule: req.body?.schedule,
      timezone: req.body?.timezone,
      teacherId: req.body?.teacherId,
      allowFlexibleCircle: Boolean(req.body?.allowFlexibleCircle),
    });

    if (req.body?.startImmediately && Array.isArray(req.body?.schedule) && req.body.schedule.length > 0 && !['active', 'full'].includes(result.circleStatus)) {
      const started = await startSubscriptionCircle({
        circleId: result.circleId,
        schedule: req.body.schedule,
        timezone: req.body.timezone || 'Africa/Cairo',
        allowUnderMinimum: true,
      });
      result.circleStatus = started.circleStatus || 'active';
      result.subscriptionStatus = 'active';
      result.activatedStudentIds = started.activatedStudentIds || [result.studentId];
    }

    await logAdminAction({
      req,
      action: 'subscription.placed',
      entityType: 'student-subscription',
      entityId: req.params.id,
      reason: 'تم تسكين الطالب في حلقة الاشتراك بعد اعتماد الدفع.',
      metadata: {
        circleId: result.circleId,
        teacherId: result.teacherId,
        circleStatus: result.circleStatus,
      },
    }).catch(() => {});

    if (result.subscriptionStatus === 'active') {
      await Promise.allSettled(
        (result.activatedStudentIds || [result.studentId]).map((studentId) => notifyUser(studentId, {
          type: 'system',
          title: { ar: 'تم انضمامك للحلقة النشطة', en: 'You joined an active circle' },
          message: {
            ar: `تم انضمامك لحلقة ${result.circleName || 'الاشتراك'} الجارية وتفعيل اشتراكك.`,
            en: `You joined ${result.circleName || 'your circle'} and your subscription is now active.`,
          },
          data: {
            actionUrl: '/student/dashboard',
            metadata: {
              subscriptionId: result.subscriptionId,
              circleId: result.circleId,
              status: 'active',
            },
          },
          priority: 'high',
        }))
      );
    } else {
      await notifyUser(result.studentId, {
        type: 'system',
        title: { ar: 'تم تسكينك في الحلقة', en: 'You have been placed in a circle' },
        message: {
          ar: `تم وضعك في ${result.circleName || 'الحلقة'} مع المعلم الذي اخترته. سيتم تحديد المواعيد وبدء الحلقة من الإدارة بعد اكتمال العدد.`,
          en: `You were placed in ${result.circleName || 'the circle'} with your selected tutor. Administration will set the schedule and start the circle after its minimum size is reached.`,
        },
        data: {
          actionUrl: '/student/dashboard',
          metadata: {
            subscriptionId: result.subscriptionId,
            circleId: result.circleId,
            status: result.subscriptionStatus,
          },
        },
        priority: 'high',
      }).catch(() => {});
    }

    if (result.teacherUserId) {
      notifyUser(result.teacherUserId, {
        type: 'system',
        title: { ar: 'طالب جديد في حلقة الاشتراك', en: 'New learner in your subscription circle' },
        message: {
          ar: `تم تسكين طالب جديد في ${result.circleName || 'إحدى حلقاتك'} بواسطة الإدارة.`,
          en: `Administration placed a new learner in ${result.circleName || 'one of your circles'}.`,
        },
        data: {
          actionUrl: '/teacher/dashboard',
          metadata: {
            circleId: result.circleId,
            subscriptionId: result.subscriptionId,
          },
        },
      }).catch(() => {});
    }

    return res.json({ success: true, ...result });
  } catch (error) {
    const statusByCode = {
      SUBSCRIPTION_NOT_FOUND: 404,
      STUDENT_NOT_FOUND: 404,
      PREFERRED_TEACHER_UNAVAILABLE: 409,
      SUBSCRIPTION_NOT_READY_FOR_PLACEMENT: 409,
      PREFERRED_TEACHER_REQUIRED: 409,
      CIRCLE_NOT_COMPATIBLE: 409,
      CIRCLE_FULL: 409,
      SUBSCRIPTION_PLAN_INVALID: 400,
    };
    return res.status(statusByCode[error.code] || 400).json({
      error: error.message || 'فشل تسكين الطالب',
      code: error.code || 'SUBSCRIPTION_PLACEMENT_FAILED',
    });
  }
});

router.get('/:id', protect, authorize('student', 'guardian', 'admin'), async (req, res) => {
  try {
    const subscription = await StudentSubscription.findById(req.params.id)
      .populate({
        path: 'preferredTeacher',
        select: 'personalInfo user rating status isVerified',
        populate: { path: 'user', select: 'name avatar' },
      })
      .populate('circle', 'name code status schedule timezone');

    if (!subscription) {
      return res.status(404).json({ error: 'الاشتراك غير موجود', code: 'SUBSCRIPTION_NOT_FOUND' });
    }

    const isLinkedGuardian = req.user.role === 'guardian' && (await isGuardianLinkedToStudent(req.user.id, subscription.student));
    if (req.user.role !== 'admin' && !isLinkedGuardian && String(subscription.student) !== String(req.user.id)) {
      return res.status(403).json({ error: 'غير مصرح بعرض هذا الاشتراك' });
    }

    return res.json({ success: true, subscription: serializeSubscription(subscription) });
  } catch (error) {
    return res.status(400).json({ error: 'فشل جلب بيانات الاشتراك' });
  }
});

module.exports = router;

