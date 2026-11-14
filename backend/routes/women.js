const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');

router.get('/teachers', async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {
      status: 'approved',
      isVerified: true,
      'personalInfo.gender': 'female',
    };
    let teachers = await Teacher.find({ ...filter, 'quranInfo.specializations': 'women' })
      .populate('user', 'name avatar')
      .sort({ 'rating.average': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    if (!teachers.length) {
      teachers = await Teacher.find(filter)
        .populate('user', 'name avatar')
        .sort({ 'rating.average': -1 })
        .skip(skip)
        .limit(parseInt(limit));
    }

    const total = await Teacher.countDocuments(filter);

    res.json({
      teachers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [teachers, students] = await Promise.all([
      Teacher.countDocuments({ status: 'approved', 'personalInfo.gender': 'female', 'quranInfo.specializations': 'women' }),
      Teacher.aggregate([
        { $match: { status: 'approved', 'personalInfo.gender': 'female' } },
        { $group: { _id: null, totalStudents: { $sum: '$stats.totalStudents' } } },
      ]),
    ]);
    res.json({
      femaleTeachers: teachers,
      studentsServed: students[0]?.totalStudents || 0,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
