const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const { Quiz, QuizAttempt } = require('../models/Quiz');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const { protect, authorize, attachTeacherProfile } = require('../middleware/auth');

function canRevealAttemptResults(quiz, attemptStatus) {
  if (!quiz || attemptStatus === 'in-progress') return false;
  const mode = quiz.settings?.showResults || 'immediately';
  if (mode === 'immediately') return true;
  if (mode === 'after-deadline') {
    return Boolean(quiz.availability?.endDate && new Date() > new Date(quiz.availability.endDate));
  }
  return false;
}

function hideQuizAnswers(value, { allowExplanations = false } = {}) {
  const quiz = typeof value?.toObject === 'function' ? value.toObject() : { ...value };
  if (!Array.isArray(quiz.questions)) return quiz;

  quiz.questions = quiz.questions.map((question) => {
    const safeQuestion = { ...question };
    delete safeQuestion.correctAnswer;
    if (!allowExplanations) {
      delete safeQuestion.explanation;
    }
    if (Array.isArray(safeQuestion.options)) {
      safeQuestion.options = safeQuestion.options.map((option) => {
        const safeOption = { ...option };
        delete safeOption.isCorrect;
        return safeOption;
      });
    }
    return safeQuestion;
  });

  return quiz;
}

function hideAttemptQuizAnswers(value) {
  const attempt = typeof value?.toObject === 'function' ? value.toObject() : { ...value };
  const revealResults = canRevealAttemptResults(attempt.quiz, attempt.status);
  const allowExplanations = revealResults && attempt.quiz?.settings?.allowReview !== false;

  if (attempt.quiz && typeof attempt.quiz === 'object') {
    attempt.quiz = hideQuizAnswers(attempt.quiz, { allowExplanations });
  }

  if (!revealResults) {
    delete attempt.score;
    delete attempt.isPassed;
    if (Array.isArray(attempt.answers)) {
      attempt.answers = attempt.answers.map((ans) => ({
        question: ans.question,
        answer: ans.answer,
      }));
    }
  }

  return attempt;
}

function isAttemptTimedOut(attempt, quiz) {
  const now = Date.now();
  if (quiz?.availability?.endDate) {
    const deadlineMs = new Date(quiz.availability.endDate).getTime();
    if (Number.isFinite(deadlineMs) && now > deadlineMs + 60 * 1000) {
      return true;
    }
  }
  const timeLimitMinutes = Number(quiz?.settings?.timeLimit || 0);
  if (timeLimitMinutes > 0 && attempt?.startedAt) {
    const startedMs = new Date(attempt.startedAt).getTime();
    if (Number.isFinite(startedMs) && now - startedMs > (timeLimitMinutes * 60 + 60) * 1000) {
      return true;
    }
  }
  return false;
}

const ALLOWED_QUIZ_FIELDS = [
  'title',
  'description',
  'course',
  'lesson',
  'type',
  'questions',
  'settings',
  'availability',
  'status',
];

function pickQuizFields(source = {}) {
  const out = {};
  for (const key of ALLOWED_QUIZ_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

// @route   GET /api/quizzes
// @desc    Get all quizzes for a course
// @access  Private
router.get('/', protect, attachTeacherProfile, async (req, res) => {
  try {
    const { courseId } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      const enrollments = await Enrollment.find({
        student: req.user.id,
        status: { $in: ['active', 'completed'] }
      }).select('course');

      const enrolledCourseIds = enrollments.map((enrollment) => enrollment.course);
      if (courseId && !enrolledCourseIds.some((id) => String(id) === String(courseId))) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }

      filter.course = courseId || { $in: enrolledCourseIds };
      filter.status = 'published';
    } else if (req.user.role === 'teacher') {
      if (!req.user.teacherProfile) return res.status(403).json({ error: 'Teacher profile is required' });
      filter.instructor = req.user.teacherProfile;
      if (courseId) filter.course = courseId;
      if (req.query.status) filter.status = req.query.status;
    } else if (req.user.role === 'admin') {
      if (courseId) filter.course = courseId;
      if (req.query.status) filter.status = req.query.status;
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const selectFields = req.user.role === 'student'
      ? '-questions'
      : '-questions.options.isCorrect -questions.correctAnswer -questions.explanation';

    const quizzes = await Quiz.find(filter)
      .populate('instructor', 'name')
      .select(selectFields)
      .sort({ createdAt: -1 });

    res.json(quizzes);
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

router.get('/my-attempts/list', protect, authorize('student'), async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user.id })
      .populate({ path: 'quiz', select: 'title type settings availability', populate: { path: 'course', select: 'title' } })
      .sort({ submittedAt: -1 })
      .limit(100);
    res.json(attempts.map(hideAttemptQuizAnswers));
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

// @route   GET /api/quizzes/my-attempts
// @desc    Get all quiz attempts for the current user
// @access  Private
router.get('/my-attempts', protect, authorize('student'), async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user.id })
      .populate({
        path: 'quiz',
        select: 'title type settings availability',
        populate: { path: 'course', select: 'title' }
      })
      .sort({ submittedAt: -1 })
      .limit(100);

    res.json(attempts.map(hideAttemptQuizAnswers));
  } catch (error) {
    console.error('Get my attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

// @route   GET /api/quizzes/:id
// @desc    Get a single quiz
// @access  Private
router.get('/:id', protect, attachTeacherProfile, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('instructor', 'personalInfo.fullName')
      .populate('course', 'title');

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (req.user.role === 'student') {
      const enrollment = await Enrollment.findOne({
        student: req.user.id,
        course: quiz.course?._id || quiz.course,
        status: { $in: ['active', 'completed'] }
      }).select('_id status');

      if (!enrollment || quiz.status !== 'published') {
        return res.status(403).json({ error: 'Not authorized to access this quiz' });
      }

      const availableNow = typeof quiz.isAvailableNow === 'function' ? Boolean(quiz.isAvailableNow()) : true;
      const attempts = await QuizAttempt.find({
        quiz: quiz._id,
        student: req.user.id,
      }).select('status startedAt submittedAt');
      const attemptList = Array.isArray(attempts) ? attempts : [];
      const hasActiveAttempt = availableNow && attemptList.some(
        (att) => att?.status === 'in-progress' && !isAttemptTimedOut(att, quiz)
      );
      const hasReviewableAttempt = attemptList.some(
        (att) => att?.status && att.status !== 'in-progress' && canRevealAttemptResults(quiz, att.status) && quiz.settings?.allowReview !== false
      );

      const sanitized = hideQuizAnswers(quiz, { allowExplanations: hasReviewableAttempt });
      const questionCount = Array.isArray(sanitized.questions) ? sanitized.questions.length : 0;
      if (!hasActiveAttempt && !hasReviewableAttempt) {
        return res.json({
          ...sanitized,
          questions: [],
          questionCount,
          questionsLocked: true,
        });
      }

      return res.json({
        ...sanitized,
        questionCount,
        questionsLocked: false,
      });
    }

    if (req.user.role === 'teacher') {
      const instructorId = quiz.instructor?._id || quiz.instructor;
      if (!req.user.teacherProfile || String(instructorId) !== String(req.user.teacherProfile)) {
        return res.status(403).json({ error: 'Not authorized to access this quiz' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(quiz);
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// @route   POST /api/quizzes
// @desc    Create a new quiz
// @access  Private (Teacher/Admin)
router.post('/', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      if (!req.user.teacherProfile) {
        return res.status(403).json({ error: 'Teacher profile is required' });
      }

      const ownsCourse = await Course.exists({
        _id: req.body.course,
        instructor: req.user.teacherProfile
      });
      if (!ownsCourse) {
        return res.status(403).json({ error: 'You can only create quizzes for your own courses' });
      }
    } else if (!await Course.exists({ _id: req.body.course })) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const quizData = {
      ...pickQuizFields(req.body || {}),
      instructor: req.user.role === 'teacher' ? req.user.teacherProfile : req.body.instructor
    };
    if (quizData.status === 'published') {
      quizData.publishedAt = new Date();
    }

    const quiz = new Quiz(quizData);
    await quiz.save();

    res.status(201).json(quiz);
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/quizzes/:id
// @desc    Update a quiz
// @access  Private (Teacher/Admin)
router.put('/:id', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (req.user.role === 'teacher' && quiz.instructor.toString() !== req.user.teacherProfile.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = pickQuizFields(req.body || {});

    if (req.user.role === 'teacher') {
      if (updates.course && String(updates.course) !== String(quiz.course)) {
        const ownsNewCourse = await Course.exists({
          _id: updates.course,
          instructor: req.user.teacherProfile
        });
        if (!ownsNewCourse) {
          return res.status(403).json({ error: 'You can only move quizzes to your own courses' });
        }
      }
    } else if (req.body?.instructor) {
      updates.instructor = req.body.instructor;
    }

    if (updates.status === 'published' && quiz.status !== 'published') {
      updates.publishedAt = new Date();
    }

    Object.assign(quiz, updates);
    await quiz.save();

    res.json(quiz);
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   DELETE /api/quizzes/:id
// @desc    Delete a quiz
// @access  Private (Teacher/Admin)
router.delete('/:id', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (req.user.role === 'teacher' && quiz.instructor.toString() !== req.user.teacherProfile.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await quiz.deleteOne();

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// @route   POST /api/quizzes/:id/start
// @desc    Start a quiz attempt
// @access  Private (Student)
router.post('/:id/start', protect, authorize('student'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.isAvailableNow()) {
      return res.status(400).json({ error: 'Quiz is not available' });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: quiz.course,
      status: 'active'
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    const previousAttempts = await QuizAttempt.countDocuments({
      quiz: req.params.id,
      student: req.user.id
    });

    if (previousAttempts >= quiz.settings.maxAttempts) {
      return res.status(400).json({ error: 'Maximum attempts reached' });
    }

    const attempt = new QuizAttempt({
      quiz: req.params.id,
      student: req.user.id,
      enrollment: enrollment._id,
      attemptNumber: previousAttempts + 1,
      answers: quiz.questions.map(q => ({
        question: q._id,
        answer: null,
        isCorrect: false,
        points: q.points
      }))
    });

    try {
      await attempt.save();
    } catch (saveErr) {
      if (saveErr?.code === 11000) {
        return res.status(409).json({ error: 'Quiz attempt already started' });
      }
      throw saveErr;
    }

    quiz.stats.attempts += 1;
    await quiz.save();

    res.status(201).json(hideAttemptQuizAnswers(attempt));
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/quizzes/attempts/:attemptId/answer
// @desc    Submit an answer for a question
// @access  Private (Student)
router.put('/attempts/:attemptId/answer', protect, authorize('student'), async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    const attempt = await QuizAttempt.findById(req.params.attemptId)
      .populate('quiz');

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (attempt.status !== 'in-progress') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    if (isAttemptTimedOut(attempt, attempt.quiz)) {
      attempt.status = 'expired';
      await attempt.save();
      return res.status(400).json({ error: 'Quiz time limit has expired', code: 'QUIZ_TIME_EXPIRED' });
    }

    const question = attempt.quiz.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const answerIndex = attempt.answers.findIndex(a => a.question.toString() === questionId);
    if (answerIndex === -1) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    attempt.answers[answerIndex].answer = answer == null ? null : String(answer).slice(0, 10000);
    await attempt.save();

    res.json(hideAttemptQuizAnswers(attempt));
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   POST /api/quizzes/attempts/:attemptId/submit
// @desc    Submit a quiz attempt
// @access  Private (Student)
router.post('/attempts/:attemptId/submit', protect, authorize('student'), async (req, res) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.attemptId)
      .populate('quiz');

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (attempt.status !== 'in-progress') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    if (isAttemptTimedOut(attempt, attempt.quiz)) {
      attempt.status = 'expired';
      await attempt.save();
      return res.status(400).json({ error: 'Quiz time limit has expired', code: 'QUIZ_TIME_EXPIRED' });
    }

    const alreadyPassedBefore = await QuizAttempt.exists({
      quiz: attempt.quiz._id,
      student: req.user.id,
      _id: { $ne: attempt._id },
      isPassed: true,
    });

    attempt.answers.forEach(answer => {
      const question = attempt.quiz.questions.id(answer.question);
      if (question) {
        if (question.type === 'multiple-choice' || question.type === 'true-false') {
          const correctOption = question.options.find(opt => opt.isCorrect);
          if (correctOption) {
            const rawText = typeof correctOption.text?.toObject === 'function'
              ? correctOption.text.toObject()
              : (correctOption.text || {});
            const correctTexts = Object.values(rawText)
              .filter((t) => typeof t === 'string' && t.trim())
              .map(t => t.toLowerCase().trim());
            const submitted = String(answer.answer || '').toLowerCase().trim();
            answer.isCorrect = Boolean(submitted && correctTexts.includes(submitted));
          } else if (question.type === 'true-false' && question.correctAnswer) {
            const expected = String(question.correctAnswer).toLowerCase().trim();
            const submitted = String(answer.answer || '').toLowerCase().trim();
            answer.isCorrect = Boolean(expected && submitted === expected);
          } else {
            answer.isCorrect = false;
          }
        } else if (question.type === 'short-answer' || question.type === 'fill-blank') {
          const expected = (question.correctAnswer || '').toLowerCase().trim();
          const submitted = String(answer.answer || '').toLowerCase().trim();
          answer.isCorrect = Boolean(expected && submitted === expected);
        } else if (question.type === 'essay') {
          answer.isCorrect = null;
        }
      }
    });

    attempt.calculateScore();
    const hasEssayQuestions = Array.isArray(attempt.quiz?.questions)
      && attempt.quiz.questions.some((q) => q?.type === 'essay');
    attempt.checkPassing(attempt.quiz.settings.passingScore);
    if (hasEssayQuestions && !attempt.isPassed) {
      attempt.status = 'submitted';
    } else {
      attempt.status = 'graded';
    }
    attempt.submittedAt = new Date();
    attempt.timeSpent = Math.max(0, (attempt.submittedAt - attempt.startedAt) / 1000);
    await attempt.save();

    // Update Progress model with gamification points only on first pass of this quiz
    if (attempt.isPassed && !alreadyPassedBefore) {
      try {
        let progress = await Progress.findOne({ student: req.user.id, course: attempt.quiz.course });
        if (!progress) {
          const Lesson = require('../models/Lesson');
          const lessons = await Lesson.find({ course: attempt.quiz.course }).select('_id');
          progress = new Progress({
            student: req.user.id,
            course: attempt.quiz.course,
            enrollment: attempt.enrollment,
            lessonProgress: lessons.map(l => ({
              lesson: l._id,
              status: 'not-started'
            })),
            overallProgress: {
              totalLessons: lessons.length
            }
          });
          await progress.save();
        }

        const quizPoints = attempt.quiz.calculateMaxScore() || 20;
        const quizBadgeKey = `quiz:${attempt.quiz._id}`;
        await Progress.updateOne(
          { _id: progress._id, 'milestones.badge': { $ne: quizBadgeKey } },
          {
            $push: {
              milestones: {
                type: 'quiz-passed',
                title: {
                  ar: `اجتياز اختبار: ${attempt.quiz.title?.ar || ''}`,
                  en: `Passed Quiz: ${attempt.quiz.title?.en || ''}`,
                  id: `Lulus Kuis: ${attempt.quiz.title?.id || attempt.quiz.title?.en || ''}`,
                },
                description: {
                  ar: `أحسنت! لقد اجتزت اختبار "${attempt.quiz.title?.ar || ''}" بنجاح`,
                  en: `Congratulations! You passed "${attempt.quiz.title?.en || ''}"`,
                  id: `Selamat! Anda berhasil lulus "${attempt.quiz.title?.id || attempt.quiz.title?.en || ''}"`,
                },
                achievedAt: new Date(),
                points: quizPoints,
                badge: quizBadgeKey,
              },
            },
          }
        );
      } catch (err) {
        console.warn('Failed to update gamification progress for quiz attempt:', err.message);
      }
    }

    const quiz = await Quiz.findById(attempt.quiz._id);
    quiz.stats.completions += 1;
    
    const allAttempts = await QuizAttempt.find({ 
      quiz: quiz._id, 
      status: 'graded' 
    });
    
    const totalScore = allAttempts.reduce((sum, att) => sum + (att.score.percentage || 0), 0);
    quiz.stats.averageScore = totalScore / allAttempts.length;
    
    const passedAttempts = allAttempts.filter(att => att.isPassed).length;
    quiz.stats.passRate = (passedAttempts / allAttempts.length) * 100;
    
    await quiz.save();

    res.json(hideAttemptQuizAnswers(attempt));
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/quizzes/attempts/:attemptId
// @desc    Get a quiz attempt with results
// @access  Private
router.get('/attempts/:attemptId', protect, attachTeacherProfile, async (req, res) => {
  try {
    const attempt = await QuizAttempt.findById(req.params.attemptId)
      .populate('quiz');

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (req.user.role === 'student') {
      if (String(attempt.student) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      return res.json(hideAttemptQuizAnswers(attempt));
    }

    if (req.user.role === 'teacher') {
      if (
        !req.user.teacherProfile ||
        !attempt.quiz ||
        String(attempt.quiz.instructor) !== String(req.user.teacherProfile)
      ) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(attempt);
  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({ error: 'Failed to fetch attempt' });
  }
});

// @route   GET /api/quizzes/:id/attempts
// @desc    Get all attempts for a quiz
// @access  Private (Teacher/Admin)
router.get('/:id/attempts', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select('instructor');
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    if (
      req.user.role === 'teacher' &&
      (!req.user.teacherProfile || String(quiz.instructor) !== String(req.user.teacherProfile))
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const attempts = await QuizAttempt.find({ quiz: req.params.id })
      .populate('student', req.user.role === 'admin' ? 'name email avatar' : 'name avatar')
      .sort({ submittedAt: -1 });

    res.json(attempts);
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

module.exports = router;
