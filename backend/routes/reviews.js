const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Session = require('../models/Session');
const { protect, authorize } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminAudit');

router.post('/', protect, authorize('student'), async (req, res) => {
  try {
    const { sessionId, rating, comment, categories, isAnonymous } = req.body || {};

    if (!sessionId || !mongoose.Types.ObjectId.isValid(String(sessionId))) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const cleanComment = String(comment || '').trim().slice(0, 1500);

    const session = await Session.findOne({
      _id: sessionId,
      student: req.user.id,
      status: 'completed'
    });

    if (!session) {
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

    const review = await Review.create({
      student: req.user.id,
      teacher: teacherId,
      session: sessionId,
      rating: numericRating,
      comment: cleanComment,
      categories: categories && typeof categories === 'object' && !Array.isArray(categories) ? categories : undefined,
      isAnonymous: Boolean(isAnonymous)
    });

    await Review.updateTeacherRating(teacherId);

    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    if (!mongoose.Types.ObjectId.isValid(String(req.params.teacherId || ''))) {
      return res.status(400).json({ error: 'Invalid teacher ID' });
    }
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
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
      if (obj.isAnonymous) {
        obj.student = { name: 'طالب مجهول', avatar: '' };
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
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
