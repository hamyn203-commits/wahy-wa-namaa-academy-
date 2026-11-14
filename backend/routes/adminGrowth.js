const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Donation = require('../models/Donation');
const JobApplication = require('../models/JobApplication');
const VideoAsset = require('../models/VideoAsset');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const { protect, authorize } = require('../middleware/auth');

router.get('/summary', protect, authorize('admin'), async (_req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      donations,
      applications,
      videos,
      referrals,
      donationsByCategory,
      enrollmentsByCourse,
      monthlyRegs
    ] = await Promise.all([
      Donation.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      JobApplication.countDocuments({ status: 'new' }),
      VideoAsset.countDocuments({ isPublished: true }),
      Referral.countDocuments(),
      Donation.aggregate([
        { $match: { status: { $in: ['pledged', 'confirmed'] } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } }
      ]),
      Enrollment.aggregate([
        { $group: { _id: '$course', count: { $sum: 1 } } },
        { $lookup: {
            from: 'courses',
            localField: '_id',
            foreignField: '_id',
            as: 'courseDetails'
          }
        },
        { $unwind: { path: '$courseDetails', preserveNullAndEmptyArrays: true } },
        { $project: { title: { $ifNull: ['$courseDetails.title.ar', 'دورة افتراضية'] }, count: 1 } }
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        { $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ])
    ]);

    res.json({
      donations: donations.reduce((a, d) => ({ ...a, [d._id]: { count: d.count, total: d.total } }), {}),
      newApplications: applications,
      publishedVideos: videos,
      totalReferrals: referrals,
      donationsByCategory: donationsByCategory.reduce((a, c) => ({ ...a, [c._id]: c.total }), {}),
      enrollmentsByCourse: enrollmentsByCourse.map(e => ({ name: e.title, count: e.count })),
      monthlyRegs: monthlyRegs.map(m => ({ month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`, count: m.count }))
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
