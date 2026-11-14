const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const Teacher = require('../models/Teacher');
const { protect } = require('../middleware/auth');

router.post('/', protect, async (req, res) => {
  try {
    const { answers } = req.body;

    let calculatedLevel = 'beginner';
    const scores = {
      reading: { none: 0, basic: 1, intermediate: 2, advanced: 3 },
      memorization: { none: 0, 'some-parts': 1, half: 2, most: 3, complete: 4 },
      tajweed: { none: 0, basic: 1, good: 2, excellent: 3 }
    };

    const totalScore = 
      scores.reading[answers.readingLevel] +
      scores.memorization[answers.memorizationLevel] +
      scores.tajweed[answers.tajweedLevel];

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

    if (answers.preferredTeacherGender !== 'any') {
      teacherFilter['personalInfo.gender'] = answers.preferredTeacherGender;
    }

    if (answers.goals && answers.goals.length > 0) {
      teacherFilter['quranInfo.specializations'] = { $in: answers.goals };
    }

    const suggestedTeachers = await Teacher.find(teacherFilter)
      .populate('user', 'name avatar')
      .sort({ 'rating.average': -1 })
      .limit(5);

    const assessment = await Assessment.create({
      user: req.user.id,
      answers,
      result: {
        calculatedLevel,
        recommendedPlan,
        suggestedTeachers: suggestedTeachers.map(t => t._id)
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

router.get('/my-assessment', protect, async (req, res) => {
  try {
    const assessment = await Assessment.findOne({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'result.suggestedTeachers',
        populate: { path: 'user', select: 'name avatar' }
      });

    if (!assessment) {
      return res.status(404).json({ error: 'No assessment found' });
    }

    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;