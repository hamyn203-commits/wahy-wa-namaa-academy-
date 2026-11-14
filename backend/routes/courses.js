const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const { protect, authorize, attachTeacherProfile } = require('../middleware/auth');

const escapeRegex = (s) => String(s || '').slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidObjectId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(String(id)));

const ALLOWED_COURSE_FIELDS = [
  'title',
  'description',
  'slug',
  'category',
  'programs',
  'level',
  'price',
  'currency',
  'duration',
  'durationInHours',
  'image',
  'thumbnail',
  'prerequisites',
  'learningOutcomes',
  'requirements',
  'targetAudience',
  'certificate',
  'features',
  'tags',
  'seo',
];

function pickCourseFields(source = {}) {
  const result = {};
  for (const field of ALLOWED_COURSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}

async function resolveLessonCompletionScore(lesson, studentId) {
  const quizId = lesson.content?.quiz;
  if (lesson.type === 'quiz' || quizId) {
    if (!quizId) {
      const err = new Error('Quiz is not configured for this lesson');
      err.statusCode = 400;
      err.publicMessage = 'Quiz must be passed before completing this lesson';
      throw err;
    }
    const { QuizAttempt } = require('../models/Quiz');
    const passedAttempt = await QuizAttempt.findOne({
      quiz: quizId,
      student: studentId,
      isPassed: true,
    })
      .sort({ 'score.percentage': -1 })
      .lean();
    if (!passedAttempt) {
      const err = new Error('Quiz not passed');
      err.statusCode = 400;
      err.publicMessage = 'Quiz must be passed before completing this lesson';
      err.code = 'QUIZ_NOT_PASSED';
      throw err;
    }
    return Math.round(Number(passedAttempt.score?.percentage ?? 100));
  }

  const assignmentId = lesson.content?.assignment;
  if (lesson.type === 'assignment' || assignmentId) {
    if (!assignmentId) {
      const err = new Error('Assignment is not configured for this lesson');
      err.statusCode = 400;
      err.publicMessage = 'Assignment must be submitted before completing this lesson';
      throw err;
    }
    const { AssignmentSubmission } = require('../models/Assignment');
    const submission = await AssignmentSubmission.findOne({
      assignment: assignmentId,
      student: studentId,
      status: { $in: ['submitted', 'graded', 'late'] },
    }).lean();
    if (!submission) {
      const err = new Error('Assignment not submitted');
      err.statusCode = 400;
      err.publicMessage = 'Assignment must be submitted before completing this lesson';
      err.code = 'ASSIGNMENT_REQUIRED';
      throw err;
    }
    return submission.grade?.percentage != null
      ? Math.round(Number(submission.grade.percentage))
      : 100;
  }

  return 100;
}

// @route   GET /api/courses
// @desc    Get all published courses with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      category,
      level,
      minPrice,
      maxPrice,
      search,
      sortBy = 'newest',
      page = 1,
      limit = 12
    } = req.query;

    // Build filter query
    const filter = { status: 'published' };

    if (category) filter.category = String(category);
    if (req.query.program) filter.programs = String(req.query.program);
    if (level) filter.level = String(level);
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice && Number.isFinite(Number(minPrice))) filter.price.$gte = Math.max(0, Number(minPrice));
      if (maxPrice && Number.isFinite(Number(maxPrice))) filter.price.$lte = Math.max(0, Number(maxPrice));
      if (!Object.keys(filter.price).length) delete filter.price;
    }
    if (search && String(search).trim()) {
      const escaped = escapeRegex(String(search).trim());
      filter.$or = [
        { 'title.ar': { $regex: escaped, $options: 'i' } },
        { 'title.en': { $regex: escaped, $options: 'i' } },
        { 'description.ar': { $regex: escaped, $options: 'i' } },
        { 'description.en': { $regex: escaped, $options: 'i' } }
      ];
    }

    // Build sort query
    let sort = {};
    switch (sortBy) {
      case 'newest':
        sort = { publishedAt: -1 };
        break;
      case 'popular':
        sort = { 'stats.enrolled': -1 };
        break;
      case 'rating':
        sort = { 'stats.rating.average': -1 };
        break;
      case 'price-low':
        sort = { price: 1 };
        break;
      case 'price-high':
        sort = { price: -1 };
        break;
      default:
        sort = { publishedAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .populate('instructor', 'name image rating')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Course.countDocuments(filter)
    ]);

    res.json({
      courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// @route   GET /api/courses/my-courses
// @desc    Get user's enrolled courses
// @access  Private
router.get('/my-courses', protect, async (req, res) => {
  try {
    const isDBConnected = () => mongoose.connection.readyState === 1;
    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.json([]);
    }

    const enrollments = await Enrollment.find({ student: req.user.id })
      .populate({
        path: 'course',
        select: 'title slug image category level stats',
        populate: { path: 'instructor', select: 'name image' }
      })
      .sort({ lastAccessedAt: -1 });

    res.json(enrollments);
  } catch (error) {
    console.error('Get my courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// @route   GET /api/courses/:slug
// @desc    Get single course by slug
// @access  Public
router.get('/:slug', async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug, status: 'published' })
      .populate('instructor', 'name image bio rating stats')
      .populate({
        path: 'lessons',
        select: 'title type duration order isFree',
        match: { isPublished: true },
        options: { sort: { order: 1 } }
      });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// @route   POST /api/courses
// @desc    Create a new course
// @access  Private (Admin/Teacher)
router.post('/', protect, attachTeacherProfile, authorize('admin', 'teacher'), async (req, res) => {
  try {
    if (req.user.role === 'teacher' && !req.user.teacherProfile) {
      return res.status(403).json({ error: 'Teacher profile is required' });
    }
    if (req.user.role === 'teacher' && req.body?.status === 'published') {
      return res.status(403).json({ error: 'Only admins can publish courses' });
    }

    const courseData = pickCourseFields(req.body || {});
    courseData.instructor = req.user.role === 'teacher' ? req.user.teacherProfile : req.body?.instructor;

    if (req.user.role === 'admin' && ['draft', 'published', 'archived'].includes(req.body?.status)) {
      courseData.status = req.body.status;
      if (req.body.status === 'published') {
        courseData.publishedAt = new Date();
      }
    } else {
      courseData.status = 'draft';
    }

    const course = new Course(courseData);
    await course.save();

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update a course
// @access  Private (Admin/Teacher)
router.put('/:id', protect, attachTeacherProfile, authorize('admin', 'teacher'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (req.user.role === 'teacher' && course.instructor.toString() !== (req.user.teacherProfile || '').toString()) {
      return res.status(403).json({ error: 'Not authorized to update this course' });
    }

    if (req.user.role === 'teacher' && req.body?.status === 'published' && course.status !== 'published') {
      return res.status(403).json({ error: 'Only admins can publish courses' });
    }

    const updates = pickCourseFields(req.body || {});
    if (req.user.role === 'admin') {
      if (req.body?.instructor && isValidObjectId(req.body.instructor)) {
        updates.instructor = req.body.instructor;
      }
      if (['draft', 'published', 'archived'].includes(req.body?.status)) {
        if (req.body.status === 'published' && course.status !== 'published') {
          updates.publishedAt = new Date();
        }
        updates.status = req.body.status;
      }
    } else if (['draft', 'archived'].includes(req.body?.status)) {
      updates.status = req.body.status;
    }

    Object.assign(course, updates);
    await course.save();

    res.json(course);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete a course
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await course.deleteOne();

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// @route   POST /api/courses/:id/enroll
// @desc    Enroll in a course
// @access  Private
router.post('/:id/enroll', protect, authorize('student'), async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, status: 'published' });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const existingEnrollment = await Enrollment.findOne({
      student: req.user.id,
      course: req.params.id
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    if (Number(course.price || 0) > 0) {
      return res.status(402).json({
        error: 'Payment is required before enrollment',
        code: 'PAYMENT_REQUIRED'
      });
    }

    const enrollment = new Enrollment({
      student: req.user.id,
      course: req.params.id,
      payment: {
        amount: 0,
        currency: course.currency,
        status: 'completed',
        paidAt: new Date()
      }
    });

    await enrollment.save();

    // Update course stats
    course.stats.enrolled += 1;
    await course.save();

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/courses/:id/lessons
// @desc    Get all lessons for a course
// @access  Private (Enrolled students)
router.get('/:id/lessons', protect, attachTeacherProfile, async (req, res) => {
  try {
    const enrollment = req.user.role === 'student'
      ? await Enrollment.findOne({
          student: req.user.id,
          course: req.params.id,
          status: { $in: ['active', 'completed'] }
        })
      : null;

    if (req.user.role === 'teacher') {
      const course = await Course.findById(req.params.id).select('instructor');
      if (!course || String(course.instructor) !== String(req.user.teacherProfile || '')) {
        return res.status(403).json({ error: 'Not authorized to access this course' });
      }
    } else if (req.user.role !== 'admin' && !enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    const lessons = await Lesson.find({ course: req.params.id, isPublished: true })
      .sort({ order: 1 })
      .select('-content.quiz -content.assignment');

    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// @route   POST /api/courses/:courseId/lessons/:lessonId/complete
// @desc    Mark a lesson as completed
// @access  Private
router.post('/:courseId/lessons/:lessonId/complete', protect, authorize('student'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.courseId) || !isValidObjectId(req.params.lessonId)) {
      return res.status(400).json({ error: 'Invalid course or lesson ID' });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: req.params.courseId,
      status: 'active'
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Not enrolled or course not active' });
    }

    const lesson = await Lesson.findOne({
      _id: req.params.lessonId,
      course: req.params.courseId,
      isPublished: true
    });
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const verifiedScore = await resolveLessonCompletionScore(lesson, req.user.id);
    await enrollment.updateProgress(lesson._id, verifiedScore);

    res.json({ message: 'Lesson completed', enrollment });
  } catch (error) {
    console.error('Complete lesson error:', error);
    const status = Number(error?.statusCode) || 400;
    res.status(status).json({
      error: safeErrorMessage(error, status),
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

module.exports = router;
