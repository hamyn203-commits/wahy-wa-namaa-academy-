const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Session = require('../models/Session');
const LiveSession = require('../models/LiveSession');
const { protect, authorize } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminAudit');
const { inspectChatSafety } = require('../utils/chatSafety');
const { isMockMode } = require('../config/runtime');
const { isDBConnected } = require('../config/database');
const { findMockTeacherById } = require('../mockStore');

const ALLOWED_REVIEW_CATEGORIES = ['teaching', 'patience', 'communication', 'punctuality'];

function sanitizeCategories(categories) {
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return undefined;
  const clean = {};
  for (const key of ALLOWED_REVIEW_CATEGORIES) {
    if (categories[key] != null) {
      const val = Number(categories[key]);
      if (Number.isFinite(val) && val >= 1 && val <= 5) {
        clean[key] = val;
      }
    }
  }
  return Object.keys(clean).length ? clean : undefined;
}

function maskDisplayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'طالب وحي ونماء';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

function sessionIncludesLearner(session, studentId) {
  if (!session || !studentId) return false;
  const target = String(studentId);
  if (session.student && String(session.student?._id || session.student) === target) return true;
  if (
    Array.isArray(session.attendance) &&
    session.attendance.some((entry) => entry?.student && String(entry.student?._id || entry.student) === target)
  ) {
    return true;
  }
  return false;
}

async function isSessionEligibleForStudentReview(session) {
  if (!session) return false;
  if (session.status === 'completed') return true;
  if (session.status !== 'accepted') return false;
  if (session.scheduledAt && new Date(session.scheduledAt).getTime() <= Date.now()) {
    return true;
  }
  if (Boolean(mongoose.connection?.db) || LiveSession.findOne !== mongoose.Model.findOne) {
    try {
      const q = LiveSession.findOne({ session: session._id });
      const ls = typeof q?.select === 'function' ? await q.select('endedAt classroomState').lean() : await q;
      if (ls?.endedAt || ls?.classroomState?.controls?.sessionEnded) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

router.post('/', protect, authorize('student'), async (req, res) => {
  try {
    const { sessionId, rating, comment, categories, isAnonymous, wouldContinue } = req.body || {};

    if (!sessionId || !mongoose.Types.ObjectId.isValid(String(sessionId))) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const cleanComment = String(comment || '').trim().slice(0, 1500);
    if (cleanComment) {
      const commentSafety = inspectChatSafety(cleanComment);
      if (!commentSafety.isSafe) {
        return res.status(400).json({
          error: commentSafety.warning,
          code: 'CHAT_SAFETY_VIOLATION',
          reason: commentSafety.reason,
        });
      }
    }

    const session = await Session.findOne({
      _id: sessionId,
      status: { $in: ['accepted', 'completed'] },
    });

    if (!session || !sessionIncludesLearner(session, req.user.id) || !(await isSessionEligibleForStudentReview(session))) {
      return res.status(404).json({ error: 'Completed session not found' });
    }

    const existingReview = await Review.findOne({
      student: req.user.id,
      session: sessionId
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You already reviewed this session' });
    }

    const teacherId = session.teacher;
    if (!teacherId) {
      return res.status(400).json({ error: 'Session has no teacher assigned' });
    }

    let review;
    try {
      review = await Review.create({
        student: req.user.id,
        teacher: teacherId,
        session: sessionId,
        rating: numericRating,
        comment: cleanComment,
        categories: sanitizeCategories(categories),
        isAnonymous: Boolean(isAnonymous)
      });
    } catch (createErr) {
      if (createErr?.code === 11000) {
        return res.status(400).json({ error: 'You already reviewed this session' });
      }
      throw createErr;
    }

    await Review.updateTeacherRating(teacherId);

    // Keep Session feedback synchronized for both 1-on-1 (trial/regular) and group_circle sessions
    if (typeof session.save === 'function') {
      const cleanContinue = typeof wouldContinue === 'boolean' ? wouldContinue : undefined;
      if (session.type === 'group_circle') {
        if (!Array.isArray(session.studentFeedbacks)) session.studentFeedbacks = [];
        const idx = session.studentFeedbacks.findIndex(
          (entry) => entry?.student && String(entry.student) === String(req.user.id)
        );
        const entryPayload = {
          student: req.user.id,
          rating: numericRating,
          comment: cleanComment,
          ...(cleanContinue !== undefined ? { wouldContinue: cleanContinue } : {}),
          submittedAt: new Date(),
        };
        if (idx >= 0) session.studentFeedbacks[idx] = entryPayload;
        else session.studentFeedbacks.push(entryPayload);
      } else {
        session.studentFeedback = {
          rating: numericRating,
          comment: cleanComment,
          ...(cleanContinue !== undefined ? { wouldContinue: cleanContinue } : {}),
        };
      }
      await session.save().catch(() => {});
    }

    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/student', protect, authorize('student'), async (req, res) => {
  try {
    const isDBConnected = () => mongoose.connection.readyState === 1;
    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.json([]);
    }

    const reviews = await Review.find({ student: req.user.id })
      .populate('teacher', 'personalInfo.fullName rating')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const teacherId = String(req.params.teacherId || '');
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const isKnownMockTeacher = isMockMode && !isDBConnected() && Boolean(findMockTeacherById(teacherId));

    if (!mongoose.Types.ObjectId.isValid(teacherId) && !isKnownMockTeacher) {
      return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    if (isMockMode && !isDBConnected() && Review.find === mongoose.Model.find && Review.countDocuments === mongoose.Model.countDocuments) {
      const sampleReviews = teacherId === 'mock-teacher-1'
        ? [
            {
              _id: 'mock-review-1',
              rating: 5,
              comment: 'منهج متقن في التلاوة وتصحيح المخارج مع متابعة مستمرة.',
              student: { name: 'عمر خ.', avatar: '' },
              createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
            },
          ]
        : [];
      return res.json({
        reviews: sampleReviews,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: sampleReviews.length,
          pages: sampleReviews.length ? 1 : 0,
        },
      });
    }

    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find({ teacher: req.params.teacherId, isApproved: true })
        .populate('student', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Review.countDocuments({ teacher: req.params.teacherId, isApproved: true })
    ]);

    const formattedReviews = reviews.map(review => {
      const obj = review.toObject();
      delete obj.session;
      if (obj.isAnonymous) {
        obj.student = { name: 'طالب مجهول', avatar: '' };
      } else {
        obj.student = {
          name: maskDisplayName(obj.student?.name),
          avatar: obj.student?.avatar || '',
        };
      }
      return obj;
    });

    res.json({
      reviews: formattedReviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load teacher reviews' });
  }
});

router.put('/:id/approve', protect, authorize('admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ''))) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }
    const isApproved = Boolean(req.body?.isApproved);
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await Review.updateTeacherRating(review.teacher);

    await logAdminAction({
      req,
      action: isApproved ? 'review.approved' : 'review.unapproved',
      entityType: 'review',
      entityId: review._id,
      metadata: { teacherId: String(review.teacher), isApproved },
    }).catch(() => {});

    res.json({ success: true, review });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
