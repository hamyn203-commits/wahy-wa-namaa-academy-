const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const teachersRouter = require('./teachers');

function sanitizeWomanTeacher(doc) {
  if (typeof teachersRouter.sanitizePublicTeacher === 'function') {
    const sanitized = teachersRouter.sanitizePublicTeacher(doc);
    sanitized.media = { profilePhoto: sanitized.media?.profilePhoto || '' };
    return sanitized;
  }
  const raw = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  delete raw.documents;
  delete raw.reviewNotes;
  delete raw.reviewChecklist;
  delete raw.reviewStartedAt;
  delete raw.reviewCompletedAt;
  delete raw.earnings;
  delete raw.assetsPurgedAt;
  delete raw.storageOwner;
  delete raw.ledgerLockVersion;
  if (raw.personalInfo) {
    raw.personalInfo = {
      fullName: raw.personalInfo.fullName,
      gender: raw.personalInfo.gender,
      country: raw.personalInfo.country,
      city: raw.personalInfo.city,
    };
  }
  raw.media = { profilePhoto: raw.media?.profilePhoto || '' };
  return raw;
}

router.get('/teachers', async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      status: 'approved',
      isVerified: true,
      'personalInfo.gender': 'female',
    };
    const specializedFilter = { ...filter, 'quranInfo.specializations': 'women' };
    let usedFilter = specializedFilter;
    let teachers = await Teacher.find(specializedFilter)
      .populate('user', 'name avatar bio')
      .sort({ 'rating.average': -1 })
      .skip(skip)
      .limit(limitNum);

    if (!teachers.length && pageNum === 1) {
      usedFilter = filter;
      teachers = await Teacher.find(filter)
        .populate('user', 'name avatar bio')
        .sort({ 'rating.average': -1 })
        .skip(skip)
        .limit(limitNum);
    }

    const total = await Teacher.countDocuments(usedFilter);

    res.json({
      teachers: teachers.map(sanitizeWomanTeacher),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
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
