const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const teachersRouter = require('./teachers');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');
const { protect, authorize } = require('../middleware/auth');

function sanitizeTeacherSuggestion(doc) {
  if (typeof teachersRouter.sanitizePublicTeacher === 'function') {
    return teachersRouter.sanitizePublicTeacher(doc);
  }
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  delete raw.documents;
  delete raw.reviewNotes;
  delete raw.reviewChecklist;
  delete raw.earnings;
  return raw;
}

router.post('/', protect, authorize('student'), async (req, res) => {
  try {
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const student = await User.findById(req.user.id).select('gender age enrollmentSection').lean();

    let calculatedLevel = 'beginner';
    const scores = {
      reading: { none: 0, basic: 1, intermediate: 2, advanced: 3 },
      memorization: { none: 0, 'some-parts': 1, half: 2, most: 3, complete: 4 },
      tajweed: { none: 0, basic: 1, good: 2, excellent: 3 }
    };

    const totalScore =
      (scores.reading[answers.readingLevel] ?? 0) +
      (scores.memorization[answers.memorizationLevel] ?? 0) +
      (scores.tajweed[answers.tajweedLevel] ?? 0);

    if (totalScore >= 8) calculatedLevel = 'advanced';
    else if (totalScore >= 4) calculatedLevel = 'intermediate';

    const recommendedPlan = {
      sessionsPerWeek: calculatedLevel === 'beginner' ? 3 : calculatedLevel === 'intermediate' ? 2 : 1,
      sessionDuration: 60,
      estimatedMonths: calculatedLevel === 'beginner' ? 24 : calculatedLevel === 'intermediate' ? 12 : 6
    };

    const teacherFilter = {
      status: 'approved',
      isVerified: true
    };

    if (answers.preferredTeacherGender && ['male', 'female'].includes(String(answers.preferredTeacherGender))) {
      teacherFilter['personalInfo.gender'] = String(answers.preferredTeacherGender);
    }

    if (Array.isArray(answers.goals) && answers.goals.length > 0) {
      const safeGoals = answers.goals.slice(0, 10).map((g) => String(g).trim().slice(0, 60)).filter(Boolean);
      if (safeGoals.length > 0) {
        teacherFilter['quranInfo.specializations'] = { $in: safeGoals };
      }
    }

    const candidates = await Teacher.find(teacherFilter)
      .populate('user', 'name avatar bio')
      .sort({ 'rating.average': -1 })
      .limit(15);

    const compatibleTeachers = candidates.filter((t) => {
      try {
        assertGenderAndAgeCompatibility({
          student,
          teacher: t,
          section: student?.enrollmentSection || null,
        });
        return true;
      } catch {
        return false;
      }
    }).slice(0, 5);

    const suggestedTeachers = compatibleTeachers.map(sanitizeTeacherSuggestion);

    const assessment = await Assessment.create({
      user: req.user.id,
      answers,
      result: {
        calculatedLevel,
        recommendedPlan,
        suggestedTeachers: compatibleTeachers.map(t => t._id)
      },
      status: 'completed'
    });

    res.status(201).json({
      success: true,
      assessment,
      suggestedTeachers
    });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/my-assessment', protect, authorize('student'), async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'result.suggestedTeachers',
        populate: { path: 'user', select: 'name avatar bio' }
      });

    if (!assessment) {
      return res.status(404).json({ error: 'No assessment found' });
    }

    const value = typeof assessment.toObject === 'function' ? assessment.toObject() : { ...assessment };
    if (Array.isArray(value.result?.suggestedTeachers)) {
      value.result.suggestedTeachers = value.result.suggestedTeachers.map(sanitizeTeacherSuggestion);
    }

    res.json(value);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;