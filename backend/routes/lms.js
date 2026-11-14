const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const { Quiz, QuizAttempt } = require('../models/Quiz');
const { AssignmentSubmission } = require('../models/Assignment');
const Certificate = require('../models/Certificate');
const { protect, authorize, attachTeacherProfile } = require('../middleware/auth');
const { notifyCourseEnrollment, notifyCertificateIssued } = require('../utils/notify');
const { isMockMode } = require('../config/runtime');

async function getCourseBySlug(slug) {
  return Course.findOne({ slug, status: 'published' });
}

async function getEnrollment(userId, courseId) {
  return Enrollment.findOne({ student: userId, course: courseId });
}

const mongoose = require('mongoose');
const isDBConnected = () => mongoose.connection.readyState === 1;
const isValidObjectId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(String(id)));

async function resolveLessonCompletionScore(lesson, studentId) {
  const quizId = lesson.content?.quiz;
  if (lesson.type === 'quiz' || quizId) {
    if (!quizId) {
      const err = new Error('Quiz is not configured for this lesson');
      err.statusCode = 400;
      err.publicMessage = 'Quiz must be passed before completing this lesson';
      throw err;
    }
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

// GET /api/lms/course/:slug — course + lessons + enrollment for student
router.get('/course/:slug', protect, attachTeacherProfile, authorize('student', 'teacher', 'admin'), async (req, res) => {
  try {
    if (!isDBConnected()) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Learning data is temporarily unavailable' });
      }

      const mockCourse = {
        _id: 'mock-course-1',
        title: 'دورة إتقان التجويد العملي',
        slug: req.params.slug || 'easy-tajweed',
        description: 'شرح ميسر وتطبيقي لأحكام التجويد ومخارج الحروف مع التمارين التفاعلية.',
        category: 'tajweed',
        level: 'beginner',
        price: 0,
        currency: 'USD',
        stats: { rating: { average: 4.9, count: 48 }, enrolled: 120 }
      };

      const mockLessons = [
        {
          _id: 'mock-lesson-1',
          title: 'الدرس الأول: مقدمة في علم التجويد وفضله',
          slug: 'intro-to-tajweed',
          order: 1,
          type: 'video',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          content: 'تعريف علم التجويد لغة واصطلاحاً، وحكم تعلمه والعمل به.',
          duration: 15,
          isPublished: true
        },
        {
          _id: 'mock-lesson-2',
          title: 'الدرس الثاني: مخارج الحروف الرئيسية',
          slug: 'letter-exits',
          order: 2,
          type: 'text',
          content: 'تنقسم مخارج الحروف العامة إلى خمسة مخارج: الجوف، والحلق، واللسان، والشفتان، والخيشوم.',
          duration: 20,
          isPublished: true
        },
        {
          _id: 'mock-lesson-3',
          title: 'الدرس الثالث: أحكام النون الساكنة والتنوين',
          slug: 'noon-sakinah',
          order: 3,
          type: 'quiz',
          content: 'أربعة أحكام: الإظهار الحلقي، والإدغام، والإقلاب، والإخفاء الحقيقي.',
          duration: 25,
          isPublished: true
        }
      ];

      const mockEnrollment = {
        _id: 'mock-enroll-1',
        student: req.user.id,
        course: mockCourse._id,
        status: 'active',
        progress: { percentage: 33, completedLessons: ['mock-lesson-1'] }
      };

      return res.json({ course: mockCourse, lessons: mockLessons, enrollment: mockEnrollment });
    }

    const course = await getCourseBySlug(req.params.slug);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    let enrollment = null;

    if (req.user.role === 'student') {
      enrollment = await Enrollment.findOne({
        student: req.user.id,
        course: course._id,
        status: { $in: ['active', 'completed'] }
      });

      if (!enrollment) {
        return res.status(403).json({
          error: 'Not enrolled in this course',
          code: 'ENROLLMENT_REQUIRED'
        });
      }
    } else if (req.user.role === 'teacher') {
      if (!req.user.teacherProfile || String(course.instructor) !== String(req.user.teacherProfile)) {
        return res.status(403).json({ error: 'Not authorized to access this course' });
      }
    }

    const lessons = await Lesson.find({ course: course._id, isPublished: true }).sort({ order: 1 });
    res.json({ course, lessons, enrollment });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

// POST /api/lms/course/:slug/enroll
router.post('/course/:slug/enroll', protect, authorize('student'), async (req, res) => {
  try {
    const course = await getCourseBySlug(req.params.slug);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const existing = await getEnrollment(req.user.id, course._id);
    if (existing) return res.status(400).json({ error: 'Already enrolled', enrollment: existing });

    if (Number(course.price || 0) > 0) {
      return res.status(402).json({
        error: 'Payment is required before enrollment',
        code: 'PAYMENT_REQUIRED'
      });
    }

    const enrollment = await Enrollment.create({
      student: req.user.id,
      course: course._id,
      payment: { amount: 0, currency: course.currency, status: 'completed', paidAt: new Date() },
    });

    course.stats.enrolled += 1;
    await course.save();

    let progress = await Progress.findOne({ student: req.user.id, course: course._id });
    if (!progress) {
      progress = await Progress.create({
        student: req.user.id,
        course: course._id,
        enrollment: enrollment._id,
      });
    }

    try {
      await notifyCourseEnrollment(req.user.id, course);
    } catch (e) {
      console.warn('Enrollment notification:', e.message);
    }

    res.status(201).json({ enrollment, progress });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// GET /api/lms/course/:slug/lesson/:lessonId
router.get('/course/:slug/lesson/:lessonId', protect, attachTeacherProfile, authorize('student', 'teacher', 'admin'), async (req, res) => {
  try {
    const course = await getCourseBySlug(req.params.slug);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const enrollment = req.user.role === 'student'
      ? await Enrollment.findOne({
          student: req.user.id,
          course: course._id,
          status: { $in: ['active', 'completed'] }
        })
      : null;

    const lesson = await Lesson.findOne({ _id: req.params.lessonId, course: course._id, isPublished: true })
      .populate({
        path: 'content.quiz',
        select: '-questions.correctAnswer -questions.options.isCorrect'
      });

    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

    if (req.user.role === 'student' && !lesson.isFree && !enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    if (
      req.user.role === 'teacher' &&
      (!req.user.teacherProfile || String(course.instructor) !== String(req.user.teacherProfile))
    ) {
      return res.status(403).json({ error: 'Not authorized to access this course' });
    }

    if (enrollment) {
      enrollment.lastAccessedAt = new Date();
      enrollment.progress.currentLesson = lesson._id;
      await enrollment.save();
    }

    lesson.stats.views += 1;
    await lesson.save();

    const completed = enrollment?.progress?.completedLessons?.some(
      (cl) => cl.lesson.toString() === lesson._id.toString()
    ) || false;

    res.json({ lesson, enrollment, completed, courseId: course._id });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

// POST /api/lms/course/:slug/lesson/:lessonId/complete
router.post('/course/:slug/lesson/:lessonId/complete', protect, authorize('student'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }
    const course = await getCourseBySlug(req.params.slug);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: course._id,
      status: 'active'
    });
    if (!enrollment) return res.status(403).json({ error: 'Not enrolled' });

    const lesson = await Lesson.findOne({
      _id: req.params.lessonId,
      course: course._id,
      isPublished: true
    });
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const verifiedScore = await resolveLessonCompletionScore(lesson, req.user.id);
    const wasAlreadyCompleted = Array.isArray(enrollment.progress?.completedLessons)
      && enrollment.progress.completedLessons.some(
        (cl) => String(cl.lesson) === String(lesson._id)
      );

    await enrollment.updateProgress(lesson._id, verifiedScore);

    if (!wasAlreadyCompleted) {
      lesson.stats.completions += 1;
      await lesson.save();

      // Update Progress model for gamification points & streaks
      let progress = await Progress.findOne({ student: req.user.id, course: course._id });
      if (!progress) {
        const lessons = await Lesson.find({ course: course._id, isPublished: true }).select('_id');
        progress = new Progress({
          student: req.user.id,
          course: course._id,
          enrollment: enrollment._id,
          lessonProgress: lessons.map(l => ({
            lesson: l._id,
            status: 'not-started'
          })),
          overallProgress: {
            totalLessons: lessons.length
          }
        });
      }

      const progressLessonAlreadyDone = Array.isArray(progress.lessonProgress)
        && progress.lessonProgress.some(
          (lp) => String(lp.lesson) === String(lesson._id) && lp.status === 'completed'
        );

      const duration = lesson.duration || 15;
      await progress.updateLessonProgress(String(lesson._id), 'completed', verifiedScore, duration);
      
      if (!progressLessonAlreadyDone) {
        // Add the lesson-completed milestone once per lesson
        await progress.addMilestone(
          'lesson-completed',
          { ar: 'أكملت درساً', en: 'Lesson Completed', id: 'Pelajaran Selesai' },
          { ar: 'أحسنت! لقد أكملت درساً بنجاح', en: 'Great job! You completed a lesson', id: 'Bagus sekali! Anda berhasil menyelesaikan pelajaran' },
          10
        );
      }
    }

    const updated = await Enrollment.findById(enrollment._id);
    let certificate = null;

    if (updated.status === 'completed' && updated.certificate?.issued && course.certificate?.enabled) {
      const existing = await Certificate.findOne({ student: req.user.id, course: course._id });
      if (!existing) {
        const certificateId = updated.certificate.certificateId || Certificate.generateCertificateId();
        const verificationUrl = `${process.env.FRONTEND_URL || 'https://wahy-wa-namaa-academy.vercel.app'}/verify-certificate/${certificateId}`;
        const qrCode = await Certificate.generateQRCode(verificationUrl);
        certificate = await Certificate.create({
          student: req.user.id,
          course: course._id,
          enrollment: updated._id,
          certificateId,
          qrCode,
          metadata: { completionDate: updated.completedAt, score: updated.progress.percentage },
          language: 'ar',
        });
        updated.certificate.certificateId = certificateId;
        updated.certificate.qrCode = qrCode;
        await updated.save();
        try {
          await notifyCertificateIssued(req.user.id, certificate, course);
        } catch (e) {
          console.warn('Certificate notification:', e.message);
        }
      }
    }

    res.json({ enrollment: updated, certificate });
  } catch (error) {
    const status = Number(error?.statusCode) || 400;
    res.status(status).json({
      error: safeErrorMessage(error, status),
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

// GET /api/lms/my-certificates
router.get('/my-certificates', protect, authorize('student'), async (req, res) => {
  try {
    const certs = await Certificate.find({ student: req.user.id })
      .populate('course', 'title slug')
      .sort({ issuedAt: -1 });
    res.json(certs);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

// POST /api/lms/seed-demo — إنشاء دورة تجريبية (admin)
router.post('/seed-demo', protect, authorize('admin'), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_BOOTSTRAP !== 'true') {
      return res.status(404).json({ error: 'Route not found' });
    }
    const existing = await Course.findOne({ slug: 'quran-memorization-beginner' });
    if (existing) return res.json({ message: 'Demo course already exists', course: existing });

    let teacher = await Teacher.findOne({ status: 'approved' });
    if (!teacher) {
      let user = await User.findOne({ role: 'teacher' });
      if (!user) {
        user = await User.create({
          name: 'الشيخ أحمد (تجريبي)',
          email: `demo-teacher-${Date.now()}@wahynamaa.example`,
          password: 'Demo1234!',
          role: 'teacher',
        });
      }
      teacher = await Teacher.create({
        user: user._id,
        personalInfo: { fullName: user.name, country: 'مصر', city: 'القاهرة', phone: '+201000000000' },
        status: 'approved',
        isVerified: true,
        isFeatured: true,
        languages: ['ar', 'en'],
      });
    }

    const course = await Course.create({
      title: { ar: 'تحفيظ القرآن — المبتدئ', en: 'Quran Memorization — Beginner' },
      description: { ar: 'دورة تجريبية لحفظ جزء عم', en: 'Demo course for Juz Amma memorization' },
      slug: 'quran-memorization-beginner',
      category: 'quran',
      level: 'beginner',
      price: 0,
      currency: 'USD',
      duration: '3 months',
      durationInHours: 20,
      instructor: teacher._id,
      image: '/courses/quran-beginner.jpg',
      status: 'published',
      publishedAt: new Date(),
      certificate: { enabled: true },
      stats: { enrolled: 0, rating: { average: 4.9, count: 0 } },
    });

    const lessons = await Lesson.insertMany([
      {
        title: { ar: 'مقدمة في الحفظ', en: 'Introduction to Memorization' },
        slug: 'intro',
        course: course._id,
        order: 1,
        type: 'video',
        duration: 15,
        isFree: true,
        isPublished: true,
        content: { video: { url: 'https://www.youtube.com/embed/2Qd_1wstBg0', provider: 'youtube', duration: 900 } },
      },
      {
        title: { ar: 'سورة الفاتحة', en: 'Surah Al-Fatiha' },
        slug: 'al-fatiha',
        course: course._id,
        order: 2,
        type: 'text',
        duration: 20,
        isPublished: true,
        content: {
          text: {
            ar: '## سورة الفاتحة\n\n1. اقرأ السورة مع التجويد\n2. راجع المخارج\n3. سجّل تلاوتك',
            en: '## Surah Al-Fatiha\n\n1. Recite with tajweed\n2. Review articulation\n3. Record your recitation',
          },
        },
      },
      {
        title: { ar: 'سورة الناس', en: 'Surah An-Nas' },
        slug: 'an-nas',
        course: course._id,
        order: 3,
        type: 'video',
        duration: 25,
        isPublished: true,
        content: { video: { url: 'https://www.youtube.com/embed/HGr1BOrrPyY', provider: 'youtube', duration: 1200 } },
      },
    ]);

    const quiz = await Quiz.create({
      title: { ar: 'اختبار جزء عم', en: 'Juz Amma Quiz' },
      description: { ar: 'اختبار قصير', en: 'Short quiz' },
      course: course._id,
      instructor: teacher._id,
      type: 'practice',
      status: 'published',
      questions: [
        {
          type: 'multiple-choice',
          question: { ar: 'كم عدد آيات سورة الفاتحة؟', en: 'How many verses in Al-Fatiha?' },
          options: [{ text: { en: '5', ar: '5' }, isCorrect: false }, { text: { en: '7', ar: '7' }, isCorrect: true }, { text: { en: '10', ar: '10' }, isCorrect: false }],
          points: 10,
        },
        {
          type: 'true-false',
          question: { ar: 'سورة الناس من جزء عم', en: 'An-Nas is from Juz Amma' },
          options: [{ text: { en: 'True', ar: 'صح' }, isCorrect: true }, { text: { en: 'False', ar: 'خطأ' }, isCorrect: false }],
          points: 10,
        },
      ],
      settings: { passingScore: 60, maxAttempts: 3, shuffleQuestions: false, showResults: 'immediately' },
    });

    const quizLesson = await Lesson.create({
      title: { ar: 'اختبار نهاية الدورة', en: 'Final Quiz' },
      slug: 'final-quiz',
      course: course._id,
      order: 4,
      type: 'quiz',
      duration: 15,
      isPublished: true,
      content: { quiz: quiz._id },
    });

    course.lessons = [...lessons.map((l) => l._id), quizLesson._id];
    await course.save();

    res.status(201).json({ message: 'Demo course created', course, lessonsCount: course.lessons.length });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
