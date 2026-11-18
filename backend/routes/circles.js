const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GroupCircle = require('../models/GroupCircle');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Guardian = require('../models/Guardian');
const StudentSubscription = require('../models/StudentSubscription');
const Session = require('../models/Session');
const { protect, authorize } = require('../middleware/auth');
const { getPlan } = require('../config/subscriptionPlans');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');

const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

function sanitizePublicCircle(circle) {
  const value = typeof circle?.toObject === 'function' ? circle.toObject() : { ...circle };
  const studentCount = Array.isArray(value.students) ? value.students.length : 0;
  const capacity = Number(value.capacity || 10);
  const teacher = value.teacher && typeof value.teacher === 'object'
    ? {
        _id: value.teacher._id,
        personalInfo: value.teacher.personalInfo ? {
          fullName: value.teacher.personalInfo.fullName,
          gender: value.teacher.personalInfo.gender,
          country: value.teacher.personalInfo.country,
          city: value.teacher.personalInfo.city,
        } : undefined,
        academicInfo: value.teacher.academicInfo ? {
          university: value.teacher.academicInfo.university,
          qualification: value.teacher.academicInfo.qualification,
          specialization: value.teacher.academicInfo.specialization,
        } : undefined,
        quranInfo: value.teacher.quranInfo,
        media: value.teacher.media,
        rating: value.teacher.rating,
        user: value.teacher.user && typeof value.teacher.user === 'object'
          ? {
              _id: value.teacher.user._id,
              name: value.teacher.user.name,
              avatar: value.teacher.user.avatar,
            }
          : value.teacher.user,
      }
    : value.teacher;

  return {
    _id: value._id,
    name: value.name,
    track: value.track,
    level: value.level,
    gender: value.gender,
    targetAgeGroup: value.targetAgeGroup,
    capacity,
    schedule: value.schedule,
    timezone: value.timezone,
    status: value.status,
    pricePerSession: value.pricePerSession,
    subscriptionPlanKey: value.subscriptionPlanKey,
    currentSurah: value.currentSurah,
    teacher,
    currentCount: studentCount,
    availableSeats: Math.max(0, capacity - studentCount),
    isFull: studentCount >= capacity || value.status === 'full',
  };
}

const MOCK_CIRCLES = [
  {
    _id: 'mock-circle-1',
    name: 'حلقة الإتقان (حفص عن عاصم)',
    code: 'CR-ITQAN-101',
    track: 'memorization',
    level: 'intermediate',
    gender: 'all',
    capacity: 10,
    currentCount: 6,
    availableSeats: 4,
    isFull: false,
    status: 'active',
    teacher: {
      personalInfo: { fullName: 'الشيخ أحمد محمود' },
      user: { name: 'الشيخ أحمد محمود', email: 'ahmed@wahynamaa.example' }
    },
    schedule: {
      days: ['Monday', 'Wednesday'],
      time: '18:00',
      timezone: 'Africa/Cairo'
    },
    students: []
  },
  {
    _id: 'mock-circle-2',
    name: 'حلقة البراعم للصغار',
    code: 'CR-KIDS-202',
    track: 'kids_foundation',
    level: 'beginner',
    gender: 'all',
    capacity: 8,
    currentCount: 5,
    availableSeats: 3,
    isFull: false,
    status: 'active',
    teacher: {
      personalInfo: { fullName: 'الشيخة فاطمة الزهراء' },
      user: { name: 'الشيخة فاطمة الزهراء', email: 'fatima@wahynamaa.example' }
    },
    schedule: {
      days: ['Sunday', 'Tuesday'],
      time: '16:00',
      timezone: 'Africa/Cairo'
    },
    students: []
  }
];

// @route   GET /api/circles
// @desc    Get group circles with filtering (track, level, gender, status)
// @access  Public / Protected
router.get('/', async (req, res) => {
  const { track, level, gender, status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

  if (isMockMode && !isDBConnected()) {
    let filtered = [...MOCK_CIRCLES];
    if (track) filtered = filtered.filter(c => c.track === track);
    if (level) filtered = filtered.filter(c => c.level === level);
    if (gender && gender !== 'all') filtered = filtered.filter(c => c.gender === gender || c.gender === 'all');
    return res.json({
      success: true,
      circles: filtered.map(sanitizePublicCircle),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filtered.length,
        pages: 1
      }
    });
  }
  try {
    const filter = {};

    if (track) filter.track = String(track).trim();
    if (level) filter.level = String(level).trim();
    if (gender) filter.gender = String(gender).trim();
    if (status) {
      filter.status = String(status).trim();
    } else {
      filter.status = { $ne: 'completed' };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [circles, total] = await Promise.all([
      GroupCircle.find(filter)
        .populate({
          path: 'teacher',
          select: 'personalInfo academicInfo quranInfo media rating status user',
          populate: { path: 'user', select: 'name avatar' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      GroupCircle.countDocuments(filter)
    ]);

    const enrichedCircles = circles.map(sanitizePublicCircle);

    res.json({
      success: true,
      circles: enrichedCircles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب الحلقات الجماعية' });
  }
});

// @route   GET /api/circles/:id
// @desc    Get details of a single circle with teacher, students, and schedule
// @access  Public / Protected
router.get('/:id', async (req, res) => {
  if (isMockMode && !isDBConnected()) {
    const found = MOCK_CIRCLES.find(c => c._id === req.params.id) || MOCK_CIRCLES[0];
    return res.json({
      success: true,
      circle: sanitizePublicCircle(found),
      stats: {
        currentCount: found.currentCount,
        capacity: found.capacity,
        availableSeats: found.availableSeats,
        isFull: found.isFull
      }
    });
  }
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'معرف الحلقة غير صالح' });
    }
    const circle = await GroupCircle.findById(req.params.id)
      .populate({
        path: 'teacher',
        select: 'personalInfo academicInfo quranInfo media rating status user',
        populate: { path: 'user', select: 'name avatar' }
      });

    if (!circle) {
      return res.status(404).json({ error: 'الحلقة غير موجودة' });
    }

    const publicCircle = sanitizePublicCircle(circle);

    res.json({
      success: true,
      circle: publicCircle,
      stats: {
        currentCount: publicCircle.currentCount,
        capacity: publicCircle.capacity,
        availableSeats: publicCircle.availableSeats,
        isFull: publicCircle.isFull
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب بيانات الحلقة' });
  }
});

// @route   POST /api/circles
// @desc    Create a new group circle (admin only)
// @access  Protected (admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      track,
      level,
      gender,
      targetAgeGroup,
      teacherId,
      schedule,
      timezone,
      pricePerSession,
      currentSurah,
      notes,
      capacity,
      subscriptionPlanKey
    } = req.body;

    if (!name || !gender) {
      return res.status(400).json({ error: 'اسم الحلقة وجنس الطلاب مطلوبان' });
    }

    const selectedPlan = subscriptionPlanKey ? getPlan(subscriptionPlanKey) : null;
    if (subscriptionPlanKey && !selectedPlan) {
      return res.status(400).json({ error: 'خطة الاشتراك غير صحيحة', code: 'CIRCLE_PLAN_INVALID' });
    }
    if (!selectedPlan && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'يجب ربط الحلقة بخطة اشتراك معتمدة',
        code: 'CIRCLE_PLAN_REQUIRED',
      });
    }
    const manualCapacity = Math.min(20, Math.max(1, Number(capacity || 10)));
    const resolvedCapacity = selectedPlan?.maxStudents || manualCapacity;
    const resolvedPricePerSession = selectedPlan
      ? { ...(pricePerSession || {}), egp: selectedPlan.pricePerSessionMinor / 100 }
      : (pricePerSession || { egp: 20, usd: 1 });

    if (isMockMode && !isDBConnected()) {
      const genderPrefix = String(gender).charAt(0).toUpperCase() || 'C';
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const code = 'CIR-' + genderPrefix + '-' + randomCode;

      const mockCircle = {
        _id: 'mock-circle-' + Date.now(),
        name,
        code,
        track: track || 'memorization',
        level: level || 'beginner',
        gender,
        targetAgeGroup: targetAgeGroup || 'kids_8_12',
        capacity: resolvedCapacity,
        currentCount: 0,
        availableSeats: resolvedCapacity,
        isFull: false,
        status: 'forming',
        teacher: {
          personalInfo: { fullName: 'الشيخ أحمد محمود' },
          user: { name: 'الشيخ أحمد محمود', email: 'ahmed@wahynamaa.example' }
        },
        schedule: Array.isArray(schedule) ? schedule : [],
        timezone: timezone || 'Africa/Cairo',
        pricePerSession: resolvedPricePerSession,
        subscriptionPlanKey: selectedPlan?.key,
        currentSurah: currentSurah || '',
        notes: notes || '',
        students: []
      };

      MOCK_CIRCLES.unshift(mockCircle);

      return res.status(201).json({
        success: true,
        message: 'تم إنشاء الحلقة بنجاح',
        circle: mockCircle
      });
    }

    let finalTeacherId = teacherId;

    if (req.user.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: req.user.id });
      if (!teacherDoc) {
        return res.status(400).json({ error: 'لم يتم العثور على بروفايل المعلم الخاص بك' });
      }
      finalTeacherId = teacherDoc._id;
    } else if (!finalTeacherId) {
      return res.status(400).json({ error: 'يجب تحديد المعلم المسؤول عن الحلقة' });
    }

    const teacherExists = await Teacher.findById(finalTeacherId);
    if (!teacherExists) {
      return res.status(404).json({ error: 'المعلم المحدد غير موجود' });
    }
    assertGenderAndAgeCompatibility({
      teacher: teacherExists,
      circleGender: gender,
    });

    const genderPrefix = String(gender).charAt(0).toUpperCase() || 'C';
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const code = 'CIR-' + genderPrefix + '-' + randomCode;

    const circle = new GroupCircle({
      name,
      code,
      track: track || 'memorization',
      level: level || 'beginner',
      gender,
      targetAgeGroup: targetAgeGroup || 'kids_8_12',
      capacity: resolvedCapacity,
      subscriptionPlanKey: selectedPlan?.key,
      teacher: finalTeacherId,
      students: [],
      schedule: Array.isArray(schedule) ? schedule : [],
      timezone: timezone || 'Africa/Cairo',
      status: 'forming',
      pricePerSession: resolvedPricePerSession,
      currentSurah: currentSurah || '',
      notes: notes || ''
    });

    await circle.save();

    await circle.populate({
      path: 'teacher',
      select: 'personalInfo academicInfo',
      populate: { path: 'user', select: 'name avatar' }
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحلقة بنجاح',
      circle
    });
  } catch (error) {
    if (error?.status === 400) {
      const publicMsg = String(error.publicMessage || error.message || 'بيانات الحلقة غير متوافقة');
      return res.status(400).json({ error: publicMsg, code: error.code || 'CIRCLE_VALIDATION_FAILED' });
    }
    res.status(400).json({ error: 'فشل إنشاء الحلقة' });
  }
});

// @route   POST /api/circles/:id/join
// @desc    Join circle for students (Strict validation: configured capacity <= 20, gender match, no duplicate, updates User.circle)
// @access  Protected
router.post('/:id/join', protect, authorize('student', 'guardian', 'admin'), async (req, res) => {
  try {
    let studentId;

    if (req.user.role === 'student') {
      studentId = req.user.id;
    } else {
      studentId = String(req.body.studentId || '').trim();
      if (!studentId) {
        return res.status(400).json({ error: 'معرف الطالب مطلوب' });
      }

      if (req.user.role === 'guardian') {
        const linkedGuardian = await Guardian.exists({
          user: req.user.id,
          'children.student': studentId,
        });
        if (!linkedGuardian) {
          return res.status(403).json({ error: 'غير مصرح بإضافة هذا الطالب إلى الحلقة' });
        }
      }
    }

    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) {
      return res.status(404).json({ error: 'الحلقة غير موجودة' });
    }

    if (circle.subscriptionPlanKey) {
      return res.status(409).json({ error: 'حلقات الاشتراكات تتطلب اعتماد الدفع والتسكين من الإدارة', code: 'SUBSCRIPTION_PLACEMENT_REQUIRED' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'الانضمام للحلقات متاح فقط عبر باقات الاشتراك المعتمدة أو قرار المنح الإداري',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    if (circle.status === 'completed' || circle.status === 'paused') {
      return res.status(400).json({ error: 'هذه الحلقة غير متاحة للانضمام حالياً' });
    }

    const cap = Number(circle.capacity || 10);
    const currentStudents = circle.students || [];
    if (currentStudents.length >= cap) {
      if (circle.status !== 'full') {
        circle.status = 'full';
        await circle.save();
      }
      return res.status(400).json({
        error: 'عذراً، الحلقة مكتملة بالكامل',
        code: 'CIRCLE_FULL',
        capacity: cap,
      });
    }

    const studentUser = await User.findById(studentId);
    if (!studentUser || studentUser.role !== 'student') {
      return res.status(404).json({ error: 'حساب الطالب غير موجود' });
    }

    const alreadyJoined = currentStudents.some(
      (sId) => sId.toString() === studentUser._id.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({
        error: 'الطالب منضم بالفعل لهذه الحلقة',
        code: 'ALREADY_JOINED'
      });
    }

    const circleTeacher = circle.teacher
      ? await Teacher.findById(circle.teacher).select('personalInfo.gender')
      : null;
    assertGenderAndAgeCompatibility({
      student: studentUser,
      teacher: circleTeacher,
      circleGender: circle.gender,
      section: circle.subscriptionSection || studentUser.enrollmentSection || null,
    });

    const updatedCircle = await GroupCircle.findOneAndUpdate(
      {
        _id: circle._id,
        status: { $nin: ['completed', 'paused', 'full'] },
        students: { $ne: studentUser._id },
        $expr: { $lt: [{ $size: '$students' }, cap] },
      },
      { $addToSet: { students: studentUser._id } },
      { new: true }
    );

    if (!updatedCircle) {
      return res.status(409).json({
        error: 'تعذر الانضمام — الحلقة مكتملة أو الطالب مضاف بالفعل',
        code: 'CIRCLE_FULL',
        capacity: cap,
      });
    }

    let nextStatus = updatedCircle.status;
    if (updatedCircle.students.length >= cap) {
      nextStatus = 'full';
    } else if (updatedCircle.status === 'forming') {
      const circlePlan = getPlan(updatedCircle.subscriptionPlanKey);
      const minimumToStart = circlePlan?.minStudents || 3;
      if (updatedCircle.students.length >= minimumToStart) {
        nextStatus = 'active';
      }
    }
    if (nextStatus !== updatedCircle.status) {
      updatedCircle.status = nextStatus;
      await updatedCircle.save();
    }

    studentUser.circle = updatedCircle._id;
    await studentUser.save();

    res.json({
      success: true,
      message: 'تم الانضمام إلى الحلقة بنجاح',
      circle: {
        _id: updatedCircle._id,
        name: updatedCircle.name,
        code: updatedCircle.code,
        studentsCount: updatedCircle.students.length,
        status: updatedCircle.status
      }
    });
  } catch (error) {
    if (error?.status === 400) {
      const publicMsg = String(error.publicMessage || error.message || 'بيانات الطالب غير متوافقة مع الحلقة');
      return res.status(400).json({ error: publicMsg, code: error.code || 'GENDER_MISMATCH' });
    }
    res.status(500).json({ error: 'فشل الانضمام للحلقة' });
  }
});

// @route   PUT /api/circles/:id
// @desc    Update circle details or schedule (admin or assigned teacher)
// @access  Protected (admin, teacher)
router.put('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    if (isMockMode && !isDBConnected()) {
      const found = MOCK_CIRCLES.find(c => c._id === req.params.id) || MOCK_CIRCLES[0];
      if (!found) return res.status(404).json({ error: 'الحلقة غير موجودة' });
      const { name, track, level, gender, schedule, status, notes, capacity, subscriptionPlanKey } = req.body;
      if (name !== undefined) found.name = name;
      if (track !== undefined) found.track = track;
      if (level !== undefined) found.level = level;
      if (gender !== undefined) found.gender = gender;
      if (Array.isArray(schedule)) found.schedule = schedule;
      if (status !== undefined) found.status = status;
      if (notes !== undefined) found.notes = notes;
      if (capacity !== undefined) found.capacity = Math.min(20, Math.max(1, Number(capacity)));
      if (subscriptionPlanKey !== undefined) found.subscriptionPlanKey = subscriptionPlanKey;
      return res.json({
        success: true,
        message: 'تم تحديث بيانات الحلقة بنجاح',
        circle: found
      });
    }

    const circle = await GroupCircle.findById(req.params.id);
    if (!circle) {
      return res.status(404).json({ error: 'الحلقة غير موجودة' });
    }

    if (req.user.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: req.user.id });
      if (!teacherDoc || circle.teacher.toString() !== teacherDoc._id.toString()) {
        return res.status(403).json({ error: 'ليس لديك صلاحية تعديل هذه الحلقة' });
      }
    }

    const {
      name,
      track,
      level,
      gender,
      targetAgeGroup,
      schedule,
      timezone,
      status,
      currentSurah,
      notes,
      pricePerSession,
      teacherId,
      capacity,
      subscriptionPlanKey
    } = req.body;

    if (req.user.role !== 'admin') {
      const forbiddenTeacherField = [
        track, level, gender, targetAgeGroup, status,
        pricePerSession, teacherId, capacity, subscriptionPlanKey,
      ].some((v) => v !== undefined);
      if (forbiddenTeacherField) {
        return res.status(403).json({
          error: 'يقتصر تعديل المعلم على اسم الحلقة والجدول والملاحظات والسورة الحالية فقط',
          code: 'TEACHER_CIRCLE_STRUCTURAL_EDIT_FORBIDDEN',
        });
      }
    }

    if (circle.subscriptionPlanKey && (
      (status !== undefined && ['active', 'full'].includes(status) && !['active', 'full'].includes(circle.status))
      || (teacherId && String(teacherId) !== String(circle.teacher))
      || (subscriptionPlanKey !== undefined && subscriptionPlanKey !== circle.subscriptionPlanKey)
      || (capacity !== undefined && Number(capacity) !== circle.capacity)
      || (gender !== undefined && gender !== circle.gender)
      || (targetAgeGroup !== undefined && targetAgeGroup !== circle.targetAgeGroup)
      || (track !== undefined && track !== circle.track)
      || (level !== undefined && level !== circle.level)
    )) {
      return res.status(409).json({ error: 'استخدم إدارة الاشتراكات لتشغيل حلقات الاشتراكات والحفاظ على التسكين', code: 'SUBSCRIPTION_CIRCLE_MANAGED' });
    }

    if (name !== undefined) circle.name = name;
    if (track !== undefined) circle.track = track;
    if (level !== undefined) circle.level = level;
    if (gender !== undefined) circle.gender = gender;
    if (targetAgeGroup !== undefined) circle.targetAgeGroup = targetAgeGroup;
    if (Array.isArray(schedule)) circle.schedule = schedule;
    if (timezone !== undefined) circle.timezone = timezone;
    if (currentSurah !== undefined) circle.currentSurah = currentSurah;
    if (notes !== undefined) circle.notes = notes;
    if (pricePerSession !== undefined) circle.pricePerSession = pricePerSession;
    if (capacity !== undefined) {
      const normalizedCapacity = Math.min(20, Math.max(1, Number(capacity)));
      if (!Number.isFinite(normalizedCapacity) || normalizedCapacity < circle.students.length) {
        return res.status(400).json({ error: 'سعة الحلقة غير صحيحة أو أقل من عدد الطلاب الحالي' });
      }
      circle.capacity = normalizedCapacity;
    }
    if (subscriptionPlanKey !== undefined) {
      const nextPlan = subscriptionPlanKey ? getPlan(subscriptionPlanKey) : null;
      if (subscriptionPlanKey && !nextPlan) {
        return res.status(400).json({ error: 'خطة الاشتراك غير صحيحة', code: 'CIRCLE_PLAN_INVALID' });
      }
      circle.subscriptionPlanKey = nextPlan?.key;
      if (nextPlan) {
        if (circle.students.length > nextPlan.maxStudents) {
          return res.status(400).json({ error: 'عدد الطلاب الحالي أكبر من سعة الخطة الجديدة' });
        }
        circle.capacity = nextPlan.maxStudents;
        circle.pricePerSession = {
          ...(circle.pricePerSession?.toObject?.() || circle.pricePerSession || {}),
          egp: nextPlan.pricePerSessionMinor / 100,
        };
      }
    }

    let targetTeacher = null;
    if (teacherId && req.user.role === 'admin') {
      targetTeacher = await Teacher.findById(teacherId);
      if (!targetTeacher) {
        return res.status(404).json({ error: 'المعلم المحدد غير موجود' });
      }
      circle.teacher = teacherId;
    } else if (gender !== undefined) {
      targetTeacher = await Teacher.findById(circle.teacher);
    }

    if (targetTeacher) {
      assertGenderAndAgeCompatibility({
        teacher: targetTeacher,
        circleGender: circle.gender,
      });
    }

    if ((gender !== undefined || teacherId !== undefined) && Array.isArray(circle.students) && circle.students.length > 0) {
      const rosterTeacher = targetTeacher || await Teacher.findById(circle.teacher);
      const enrolledStudents = await User.find({ _id: { $in: circle.students } }).select('gender age enrollmentSection onboarding');
      for (const enrolledStudent of enrolledStudents || []) {
        assertGenderAndAgeCompatibility({
          student: enrolledStudent,
          teacher: rosterTeacher,
          circleGender: circle.gender,
        });
      }
    }

    if (status !== undefined) {
      if (status === 'full' || circle.students.length >= (circle.capacity || 10)) {
        circle.status = circle.students.length >= (circle.capacity || 10) ? 'full' : status;
      } else {
        circle.status = status;
      }
    }

    await circle.save();

    res.json({
      success: true,
      message: 'تم تحديث بيانات الحلقة بنجاح',
      circle
    });
  } catch (error) {
    if (error?.status === 400 || error?.status === 403) {
      const publicMsg = String(error.publicMessage || error.message || 'بيانات التحديث غير متوافقة');
      return res.status(error.status).json({ error: publicMsg, code: error.code || 'CIRCLE_UPDATE_FAILED' });
    }
    res.status(400).json({ error: 'فشل تحديث بيانات الحلقة' });
  }
});

// @route   DELETE /api/circles/:id
// @desc    Archive or delete a circle (admin only)
// @access  Protected (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const archive = String(req.query.archive ?? 'true');

    if (isMockMode && !isDBConnected()) {
      const idx = MOCK_CIRCLES.findIndex(c => c._id === req.params.id);
      if (idx !== -1) {
        if (archive === 'true') {
          MOCK_CIRCLES[idx].status = 'completed';
          return res.json({ success: true, message: 'تمت أرشفة الحلقة بنجاح' });
        } else {
          MOCK_CIRCLES.splice(idx, 1);
          return res.json({ success: true, message: 'تم حذف الحلقة نهائياً' });
        }
      }
      return res.status(404).json({ error: 'الحلقة غير موجودة' });
    }

    const circle = await GroupCircle.findById(req.params.id);

    if (!circle) {
      return res.status(404).json({ error: 'الحلقة غير موجودة' });
    }

    if (archive === 'true') {
      circle.status = 'completed';
      await circle.save();

      await Promise.all([
        User.updateMany({ circle: circle._id }, { $unset: { circle: '' } }),
        StudentSubscription.updateMany(
          { circle: circle._id, status: { $in: ['placed', 'active', 'paused'] } },
          { $set: { status: 'awaiting_placement', circle: null } }
        ),
        StudentSubscription.updateMany(
          { circle: circle._id, status: 'renewal_queued' },
          { $set: { circle: null } }
        ),
        Session.updateMany(
          { circle: circle._id, status: { $in: ['pending', 'accepted'] } },
          { $set: { status: 'cancelled', cancellationReason: 'تمت أرشفة الحلقة' } }
        ),
      ]);

      return res.json({
        success: true,
        message: 'تمت أرشفة الحلقة بنجاح وإلغاء ارتباط الطلاب بها'
      });
    }

    await Promise.all([
      User.updateMany({ circle: circle._id }, { $unset: { circle: '' } }),
      StudentSubscription.updateMany(
        { circle: circle._id, status: { $in: ['placed', 'active', 'paused'] } },
        { $set: { status: 'awaiting_placement', circle: null } }
      ),
      StudentSubscription.updateMany(
        { circle: circle._id, status: 'renewal_queued' },
        { $set: { circle: null } }
      ),
      Session.updateMany(
        { circle: circle._id, status: { $in: ['pending', 'accepted'] } },
        { $set: { status: 'cancelled', cancellationReason: 'تم حذف الحلقة' } }
      ),
    ]);
    await GroupCircle.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'تم حذف الحلقة نهائياً'
    });
  } catch (error) {
    res.status(500).json({ error: 'فشل حذف أو أرشفة الحلقة' });
  }
});

module.exports = router;

