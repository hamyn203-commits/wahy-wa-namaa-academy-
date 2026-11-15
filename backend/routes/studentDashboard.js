const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Session = require('../models/Session');
const Teacher = require('../models/Teacher');
const TeacherTask = require('../models/TeacherTask');
const StudentTutorPreference = require('../models/StudentTutorPreference');
const User = require('../models/User');
const GuardianInvitation = require('../models/GuardianInvitation');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');
const { createScopedRateLimiter } = require('../middleware/userRateLimit');
const { findMockUserById } = require('../mockStore');
const { isMockMode } = require('../config/runtime');
const { createGuardianInvitation, expireStaleInvitations, presentStudentInvitation } = require('../services/guardianInvitations');
const { assertGenderAndAgeCompatibility } = require('../utils/safeguarding');

const guardianInvitationLimiter = createScopedRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  scope: 'student-guardian-invitation',
  message: 'تم تجاوز عدد دعوات ربط ولي الأمر المسموحة مؤقتاً. حاول بعد 15 دقيقة.',
});

const isDBConnected = () => mongoose.connection.readyState === 1;
const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

async function createUniqueGuardianLinkCode() {
  const crypto = require('crypto');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `WN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const exists = await User.exists({ guardianLinkCode: code });
    if (!exists) return code;
  }
  throw new Error('Unable to generate a unique guardian link code');
}

router.get('/profile', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Student data is temporarily unavailable' });
      }
      const mockUser = findMockUserById(req.user.id);
      return res.json({
        user: {
          _id: req.user.id,
          name: mockUser?.name || 'طالب',
          email: mockUser?.email || req.user.email,
          phone: mockUser?.phone || null,
          avatar: mockUser?.avatar || null,
          role: 'student',
          currentLevel: mockUser?.currentLevel || 'beginner',
          preferredTrack: mockUser?.preferredTrack || 'memorization',
          createdAt: mockUser?.createdAt || null,
        },
        summary: {
          totalSessions: 0,
          completedSessions: 0,
          pendingHomework: 0,
        },
      });
    }

    const user = await User.findById(req.user.id)
      .select('name email phone avatar role age enrollmentSection createdAt currentLevel preferredTrack onboarding +guardianLinkCode');
    if (!user) return res.status(404).json({ error: 'Student not found' });

    const isMinorStudent = (Number(user.age) > 0 && Number(user.age) < 18) || user.enrollmentSection === 'children';
    if (!isMinorStudent && !user.guardianLinkCode) {
      user.guardianLinkCode = await createUniqueGuardianLinkCode();
      await user.save();
    }

    const [totalSessions, completedSessions, pendingHomework] = await Promise.all([
      Session.countDocuments({ student: req.user.id }),
      Session.countDocuments({ student: req.user.id, status: 'completed' }),
      TeacherTask.countDocuments({ student: req.user.id, status: 'pending' }),
    ]);

    const safeUser = user.toObject();
    safeUser.guardianLinkCode = isMinorStudent ? null : user.guardianLinkCode;

    res.json({
      user: safeUser,
      summary: {
        totalSessions,
        completedSessions,
        pendingHomework,
      },
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/guardian-link-code/rotate', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Student data is temporarily unavailable' });
      }
      return res.status(503).json({ error: 'Guardian linking requires the database' });
    }

    const user = await User.findById(req.user.id).select('+guardianLinkCode role age enrollmentSection');
    if (!user || user.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }
    if ((Number(user.age) > 0 && Number(user.age) < 18) || user.enrollmentSection === 'children') {
      return res.status(403).json({
        error: 'يتم ربط حسابات الطلاب القُصَّر عبر دعوة موجهة لرقم هاتف ولي الأمر فقط',
        code: 'MINOR_INVITATION_ONLY',
      });
    }

    user.guardianLinkCode = await createUniqueGuardianLinkCode();
    await user.save();

    return res.json({ guardianLinkCode: user.guardianLinkCode });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to rotate guardian link code' });
  }
});

router.get('/guardian-invitations', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.json({ invitations: [] });
    }

    await expireStaleInvitations({ student: req.user.id });
    const [invitations, guardianProfiles] = await Promise.all([
      GuardianInvitation.find({ student: req.user.id })
        .select('+linkCode +guardianPhone +guardianPhoneNormalized')
        .sort({ createdAt: -1 })
        .limit(20),
      Guardian.find({ 'children.student': req.user.id, isActive: { $ne: false } })
        .populate('user', 'name avatar')
        .select('user children')
        .lean(),
    ]);

    const linkedGuardians = guardianProfiles.map((profile) => {
      const child = (profile.children || []).find(
        (entry) => entry.student && String(entry.student) === String(req.user.id),
      );
      return {
        id: profile.user?._id || profile.user,
        name: profile.user?.name || 'ولي الأمر',
        avatar: profile.user?.avatar || '',
        relationship: child?.relationship || 'guardian',
      };
    });

    return res.json({
      invitations: invitations.map(presentStudentInvitation),
      linkedGuardians,
    });
  } catch (error) {
    return res.status(500).json({ error: 'تعذر تحميل حالة ربط ولي الأمر' });
  }
});

router.post('/guardian-invitations', protect, authorize('student'), guardianInvitationLimiter, async (req, res) => {
  try {
    const invitation = await createGuardianInvitation({
      studentId: req.user.id,
      guardianPhone: req.body.guardianPhone,
      relationship: req.body.relationship || 'guardian',
      source: 'student-dashboard',
    });

    return res.status(201).json({
      success: true,
      invitation: presentStudentInvitation(invitation),
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400), code: error.code || null });
  }
});

router.delete('/guardian-invitations/:id', protect, authorize('student'), async (req, res) => {
  try {
    const invitation = await GuardianInvitation.findOne({
      _id: req.params.id,
      student: req.user.id,
      status: 'pending',
    });

    if (!invitation) {
      return res.status(404).json({ error: 'طلب الربط غير موجود أو لا يمكن إلغاؤه' });
    }

    if (isDBConnected() || User.findById !== mongoose.Model.findById) {
      const studentUser = await User.findById(req.user.id).select('age enrollmentSection');
      const isMinor = Boolean(
        studentUser && (
          (Number.isFinite(Number(studentUser.age)) && Number(studentUser.age) < 18)
          || studentUser.enrollmentSection === 'children'
        )
      );
      if (isMinor) {
        const [hasLinkedGuardian, hasOtherPending] = await Promise.all([
          Guardian.exists({ 'children.student': req.user.id, isActive: { $ne: false } }),
          GuardianInvitation.exists({
            student: req.user.id,
            status: 'pending',
            expiresAt: { $gt: new Date() },
            _id: { $ne: invitation._id },
          }),
        ]);
        if (invitation.source === 'student-registration' || (!hasLinkedGuardian && !hasOtherPending)) {
          return res.status(403).json({
            error: 'حسابات الطلاب القُصَّر تتطلب وجود ولي أمر مرتبط أو طلب ربط نشط لحمايتهم',
            code: 'MINOR_GUARDIAN_SAFEGUARD',
          });
        }
      }
    }

    invitation.status = 'cancelled';
    invitation.history.push({ action: 'cancelled', actor: req.user.id });
    await invitation.save();

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/stats', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Student data is temporarily unavailable' });
      }
      return res.json({
        pendingTrials: 0,
        upcomingSessions: 0,
        completedSessions: 0,
        homeworkPending: 0,
        homeworkSubmitted: 0,
        trialAllowance: { limit: 3, used: 0, remaining: 3 },
      });
    }

    const [pendingTrials, upcomingSessions, completedSessions, homeworkPending, homeworkSubmitted, trialUsed] = await Promise.all([
      Session.countDocuments({ student: req.user.id, type: 'trial', status: 'pending' }),
      Session.countDocuments({ student: req.user.id, status: 'accepted', scheduledAt: { $gte: new Date() } }),
      Session.countDocuments({ student: req.user.id, status: 'completed' }),
      TeacherTask.countDocuments({ student: req.user.id, status: 'pending' }),
      TeacherTask.countDocuments({ student: req.user.id, status: { $in: ['submitted', 'done'] } }),
      Session.countDocuments({
        student: req.user.id,
        type: 'trial',
        status: { $in: ['pending', 'accepted', 'completed'] },
      }),
    ]);

    res.json({
      pendingTrials,
      upcomingSessions,
      completedSessions,
      homeworkPending,
      homeworkSubmitted,
      trialAllowance: {
        limit: 3,
        used: trialUsed,
        remaining: Math.max(0, 3 - trialUsed),
      },
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

const MATCH_GOALS = new Set([
  'children',
  'adults',
  'women',
  'non-arabic',
  'tajweed',
  'ijaza',
  'arabic-language',
]);

function normalizeMatchingInput(input = {}) {
  const goals = Array.isArray(input.goals)
    ? [...new Set(input.goals.map((value) => String(value || '').trim()).filter((value) => MATCH_GOALS.has(value)))].slice(0, 5)
    : [];

  const preferredGender = ['any', 'male', 'female'].includes(input.preferredGender)
    ? input.preferredGender
    : 'any';

  const language = String(input.language || '').trim().toLowerCase().slice(0, 30);

  return { goals, preferredGender, language };
}

function scoreTutorMatch(teacher, matching) {
  let score = 35;
  const reasons = [];

  const rating = Number(teacher.rating?.average || 0);
  score += Math.min(20, Math.max(0, (rating / 5) * 20));
  if (rating >= 4.5) reasons.push('تقييم مرتفع');

  const experience = Number(teacher.quranInfo?.teachingExperience || 0);
  score += Math.min(10, Math.max(0, experience));
  if (experience >= 5) reasons.push('خبرة قوية');

  const teacherSpecs = Array.isArray(teacher.quranInfo?.specializations)
    ? teacher.quranInfo.specializations
    : [];
  if (matching.goals.length) {
    const overlap = matching.goals.filter((goal) => teacherSpecs.includes(goal));
    if (overlap.length) {
      score += 25;
      reasons.push('التخصص مناسب لهدفك');
    }
  }

  if (matching.preferredGender !== 'any') {
    if (teacher.personalInfo?.gender === matching.preferredGender) {
      score += 10;
      reasons.push('الاختيار المفضل');
    } else {
      score -= 20;
    }
  }

  if (matching.language) {
    const languages = Array.isArray(teacher.languages)
      ? teacher.languages.map((value) => String(value).toLowerCase())
      : [];
    if (languages.includes(matching.language)) {
      score += 10;
      reasons.push('اللغة مناسبة');
    } else {
      score -= 10;
    }
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.slice(0, 3),
  };
}

router.get('/tutor-preferences', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) return res.status(503).json({ error: 'Student preferences are temporarily unavailable' });
      return res.json({
        favoriteTeachers: [],
        matching: { goals: [], preferredGender: 'any', language: '' },
      });
    }

    const preference = await StudentTutorPreference.findOne({ student: req.user.id }).lean();
    return res.json({
      favoriteTeachers: (preference?.favoriteTeachers || []).map(String),
      matching: preference?.matching || { goals: [], preferredGender: 'any', language: '' },
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.put('/tutor-preferences', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.status(503).json({ error: 'Student preferences are temporarily unavailable' });
    }

    const matching = normalizeMatchingInput(req.body?.matching || req.body || {});
    const preference = await StudentTutorPreference.findOneAndUpdate(
      { student: req.user.id },
      { $set: { matching }, $setOnInsert: { student: req.user.id } },
      { upsert: true, new: true }
    ).lean();

    return res.json({
      success: true,
      favoriteTeachers: (preference.favoriteTeachers || []).map(String),
      matching: preference.matching,
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.post('/favorites/:teacherId', protect, authorize('student'), async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!isDBConnected() || !isValidObjectId(req.user.id) || !isValidObjectId(teacherId)) {
      return res.status(400).json({ error: 'Invalid favorite tutor request' });
    }

    const teacher = await Teacher.findOne({
      _id: teacherId,
      status: 'approved',
      isVerified: true,
    }).select('_id');

    if (!teacher) {
      return res.status(404).json({ error: 'Tutor is not available' });
    }

    const favorite = req.body?.favorite !== false;
    const update = favorite
      ? { $addToSet: { favoriteTeachers: teacher._id }, $setOnInsert: { student: req.user.id } }
      : { $pull: { favoriteTeachers: teacher._id }, $setOnInsert: { student: req.user.id } };

    const preference = await StudentTutorPreference.findOneAndUpdate(
      { student: req.user.id },
      update,
      { upsert: true, new: true }
    ).lean();

    return res.json({
      success: true,
      favorite,
      favoriteTeachers: (preference.favoriteTeachers || []).map(String),
    });
  } catch (error) {
    return res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/matches', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) return res.status(503).json({ error: 'Tutor matching is temporarily unavailable' });
      return res.json({ matches: [] });
    }

    const [preference, studentUser] = await Promise.all([
      StudentTutorPreference.findOne({ student: req.user.id }).lean(),
      User.findById(req.user.id).select('gender age enrollmentSection').lean(),
    ]);
    const matching = normalizeMatchingInput(preference?.matching || {});

    const teachers = await Teacher.find({
      status: 'approved',
      isVerified: true,
    })
      .select('personalInfo.gender quranInfo.specializations quranInfo.teachingExperience languages rating.average')
      .lean();

    const matches = teachers
      .filter((teacher) => {
        try {
          assertGenderAndAgeCompatibility({ student: studentUser, teacher, section: studentUser?.enrollmentSection });
          return true;
        } catch {
          return false;
        }
      })
      .map((teacher) => {
        const result = scoreTutorMatch(teacher, matching);
        return {
          teacherId: String(teacher._id),
          matchScore: result.score,
          reasons: result.reasons,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ matches });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/teachers', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Student data is temporarily unavailable' });
      }
      return res.json({ teachers: [] });
    }

    const sessions = await Session.find({
      student: req.user.id,
      status: { $in: ['accepted', 'completed'] },
    })
      .populate({
        path: 'teacher',
        select: 'personalInfo.fullName personalInfo.country personalInfo.gender media.profilePhoto rating user',
        populate: { path: 'user', select: 'name avatar' },
      })
      .sort({ scheduledAt: -1 });

    const map = {};
    sessions.forEach((s) => {
      if (!s.teacher) return;
      const id = s.teacher._id.toString();
      if (!map[id]) {
        map[id] = {
          _id: s.teacher._id,
          name: s.teacher.user?.name || s.teacher.personalInfo?.fullName,
          avatar: s.teacher.user?.avatar || s.teacher.profilePhoto,
          country: s.teacher.personalInfo?.country,
          rating: Number(s.teacher.rating?.count || 0) > 0 ? Number(s.teacher.rating?.average || 0) : 0,
          ratingCount: Number(s.teacher.rating?.count || 0),
          sessionCount: 0,
          lastSession: s.scheduledAt,
          canBookRegular: s.status === 'completed',
        };
      }
      map[id].sessionCount++;
      if (new Date(s.scheduledAt) > new Date(map[id].lastSession)) {
        map[id].lastSession = s.scheduledAt;
      }
      if (s.status === 'completed') map[id].canBookRegular = true;
    });

    res.json({ teachers: Object.values(map) });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/evaluations', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Student data is temporarily unavailable' });
      }
      return res.json({ evaluations: [] });
    }

    const sessions = await Session.find({
      student: req.user.id,
      status: 'completed',
      'teacherEvaluation.attendance': { $exists: true },
    })
      .populate({
        path: 'teacher',
        select: 'personalInfo.fullName personalInfo.country personalInfo.gender media.profilePhoto rating user',
        populate: { path: 'user', select: 'name avatar' },
      })
      .sort({ updatedAt: -1 });

    res.json({ evaluations: sessions });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/recordings', protect, authorize('student'), async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'Student data is temporarily unavailable' });
      }
      return res.json({ sessions: [] });
    }

    const sessions = await Session.find({
      student: req.user.id,
      status: 'completed',
    })
      .populate({
        path: 'teacher',
        select: 'personalInfo.fullName personalInfo.country personalInfo.gender media.profilePhoto rating user',
        populate: { path: 'user', select: 'name avatar' },
      })
      .sort({ scheduledAt: -1 })
      .limit(50);

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
