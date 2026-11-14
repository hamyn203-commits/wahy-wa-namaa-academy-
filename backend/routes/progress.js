const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Progress = require('../models/Progress');
const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const { protect, authorize, attachTeacherProfile } = require('../middleware/auth');

// @route   GET /api/progress/my-progress
// @desc    Get progress for all enrolled courses
// @access  Private (Student)
router.get('/my-progress', protect, authorize('student'), async (req, res) => {
  try {
    const progress = await Progress.find({ student: req.user.id })
      .populate('course', 'title image slug')
      .sort({ lastUpdated: -1 });

    res.json(progress);
  } catch (error) {
    console.error('Get my progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// @route   GET /api/progress/course/:courseId
// @desc    Get progress for a specific course
// @access  Private
router.get('/course/:courseId', protect, authorize('student'), async (req, res) => {
  try {
    const progress = await Progress.findOne({
      student: req.user.id,
      course: req.params.courseId
    })
      .populate({
        path: 'lessonProgress.lesson',
        select: 'title type duration order'
      })
      .populate('course', 'title');

    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    res.json(progress);
  } catch (error) {
    console.error('Get course progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// @route   POST /api/progress/lesson
// @desc    Update lesson progress
// @access  Private (Student)
router.post('/lesson', protect, authorize('student'), async (req, res) => {
  try {
    const { lessonId, courseId, status, score, timeSpent } = req.body;

    if (!lessonId || !courseId || !['not-started', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid lesson progress payload' });
    }

    const numericScore = score == null ? null : Number(score);
    if (numericScore != null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)) {
      return res.status(400).json({ error: 'Score must be between 0 and 100' });
    }

    const numericTimeSpent = Number(timeSpent || 0);
    if (!Number.isFinite(numericTimeSpent) || numericTimeSpent < 0 || numericTimeSpent > 43200) {
      return res.status(400).json({ error: 'Invalid time spent' });
    }

    const lesson = await Lesson.findOne({
      _id: lessonId,
      course: courseId,
      isPublished: true
    }).select('_id');

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson does not belong to this course' });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: courseId,
      status: 'active'
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    let progress = await Progress.findOne({
      student: req.user.id,
      course: courseId
    });

    if (!progress) {
      const lessons = await Lesson.find({ course: courseId }).select('_id');
      progress = new Progress({
        student: req.user.id,
        course: courseId,
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

    await progress.updateLessonProgress(lessonId, status, numericScore, numericTimeSpent);

    if (status === 'completed') {
      await progress.addMilestone(
        'lesson-completed',
        { ar: 'أكملت درساً', en: 'Lesson Completed' },
        { ar: 'أحسنت! لقد أكملت درساً بنجاح', en: 'Great job! You completed a lesson' },
        10
      );
    }

    if (progress.streak.current === 7) {
      await progress.addMilestone(
        'streak',
        { ar: 'أسبوع متواصل!', en: 'Week Streak!' },
        { ar: 'رائع! لقد درست لمدة 7 أيام متواصلة', en: 'Amazing! You studied for 7 days straight' },
        50,
        'week-streak'
      );
    }

    res.json(progress);
  } catch (error) {
    console.error('Update lesson progress error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   POST /api/progress/bookmark
// @desc    Add a bookmark to a lesson
// @access  Private (Student)
router.post('/bookmark', protect, authorize('student'), async (req, res) => {
  try {
    const { lessonId, courseId, timestamp, note } = req.body;

    const numericTimestamp = Number(timestamp || 0);
    if (!lessonId || !courseId || !Number.isFinite(numericTimestamp) || numericTimestamp < 0) {
      return res.status(400).json({ error: 'Invalid bookmark payload' });
    }

    const lesson = await Lesson.exists({ _id: lessonId, course: courseId, isPublished: true });
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson does not belong to this course' });
    }

    const progress = await Progress.findOne({
      student: req.user.id,
      course: courseId
    });

    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    await progress.addBookmark(lessonId, numericTimestamp, String(note || '').slice(0, 1000));

    res.json(progress);
  } catch (error) {
    console.error('Add bookmark error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/progress/analytics
// @desc    Get learning analytics
// @access  Private (Student)
router.get('/analytics', protect, authorize('student'), async (req, res) => {
  try {
    const progress = await Progress.find({ student: req.user.id })
      .populate('course', 'title');

    const totalCourses = progress.length;
    const completedCourses = progress.filter(p => p.overallProgress.percentage === 100).length;
    const totalTimeSpent = progress.reduce((sum, p) => sum + p.overallProgress.totalTimeSpent, 0);
    const averageScore = progress.reduce((sum, p) => sum + p.overallProgress.averageScore, 0) / totalCourses;
    
    const currentStreak = Math.max(...progress.map(p => p.streak.current), 0);
    const longestStreak = Math.max(...progress.map(p => p.streak.longest), 0);

    const weeklyActivity = progress.flatMap(p => p.weeklyActivity);
    const last4Weeks = weeklyActivity
      .sort((a, b) => b.weekStart - a.weekStart)
      .slice(0, 4);

    const totalMilestones = progress.reduce((sum, p) => sum + p.milestones.length, 0);
    const totalPoints = progress.reduce((sum, p) => 
      sum + p.milestones.reduce((ms, m) => ms + (m.points || 0), 0), 0
    );

    res.json({
      overview: {
        totalCourses,
        completedCourses,
        inProgressCourses: totalCourses - completedCourses,
        totalTimeSpent,
        averageScore: averageScore || 0
      },
      streaks: {
        current: currentStreak,
        longest: longestStreak
      },
      activity: {
        last4Weeks
      },
      achievements: {
        totalMilestones,
        totalPoints
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// @route   GET /api/progress/student/:studentId
// @desc    Get progress for a specific student (Teacher/Admin)
// @access  Private (Teacher/Admin)
router.get('/student/:studentId', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const filter = { student: req.params.studentId };

    if (req.user.role === 'teacher') {
      if (!req.user.teacherProfile) {
        return res.status(403).json({ error: 'Teacher profile is required' });
      }

      const ownedCourseIds = await Course.find({
        instructor: req.user.teacherProfile
      }).distinct('_id');

      filter.course = { $in: ownedCourseIds };
    }

    const progress = await Progress.find(filter)
      .populate('course', 'title slug')
      .populate({
        path: 'lessonProgress.lesson',
        select: 'title type order'
      })
      .sort({ lastUpdated: -1 });

    res.json(progress);
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// @route   GET /api/progress/course/:courseId/students
// @desc    Get all students' progress for a course
// @access  Private (Teacher/Admin)
router.get('/course/:courseId/students', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('instructor');
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (
      req.user.role === 'teacher' &&
      (!req.user.teacherProfile || String(course.instructor) !== String(req.user.teacherProfile))
    ) {
      return res.status(403).json({ error: 'Not authorized to access this course' });
    }

    const progress = await Progress.find({ course: req.params.courseId })
      .populate('student', 'name email')
      .sort({ 'overallProgress.percentage': -1 });

    res.json(progress);
  } catch (error) {
    console.error('Get course students progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// @route   POST /api/progress/analyze/:courseId
// @desc    Analyze strengths and weaknesses
// @access  Private (Student)
router.post('/analyze/:courseId', protect, authorize('student'), async (req, res) => {
  try {
    const progress = await Progress.findOne({
      student: req.user.id,
      course: req.params.courseId
    });

    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    await progress.analyzeStrengthsAndWeaknesses();

    res.json({
      strengths: progress.strengths,
      weaknesses: progress.weaknesses
    });
  } catch (error) {
    console.error('Analyze progress error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   GET /api/progress/leaderboard
// @desc    Get leaderboard based on points and streaks
// @access  Private
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const { type = 'points' } = req.query;
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

    let sortBy = {};
    if (type === 'points') {
      sortBy = { 'milestones.points': -1 };
    } else if (type === 'streak') {
      sortBy = { 'streak.longest': -1 };
    } else if (type === 'courses') {
      sortBy = { 'overallProgress.percentage': -1 };
    }

    const leaderboard = await Progress.aggregate([
      {
        $group: {
          _id: '$student',
          totalPoints: { $sum: { $sum: '$milestones.points' } },
          longestStreak: { $max: '$streak.longest' },
          completedCourses: {
            $sum: {
              $cond: [{ $eq: ['$overallProgress.percentage', 100] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $project: {
          _id: 1,
          name: '$student.name',
          avatar: '$student.avatar',
          totalPoints: 1,
          longestStreak: 1,
          completedCourses: 1
        }
      },
      { $sort: sortBy },
      { $limit: limit }
    ]);

    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
