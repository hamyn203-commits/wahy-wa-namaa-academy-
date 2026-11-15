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
        {
          $group: {
            _id: { status: '$status', currency: '$currency' },
            count: { $sum: 1 },
            totalMinor: {
              $sum: { $ifNull: ['$amountMinor', { $round: [{ $multiply: ['$amount', 100] }, 0] }] },
            },
          },
        },
      ]),
      JobApplication.countDocuments({ status: 'new' }),
      VideoAsset.countDocuments({ isPublished: true }),
      Referral.countDocuments(),
      Donation.aggregate([
        { $match: { status: { $in: ['pledged', 'confirmed'] } } },
        {
          $group: {
            _id: { category: '$category', status: '$status', currency: '$currency' },
            totalMinor: {
              $sum: { $ifNull: ['$amountMinor', { $round: [{ $multiply: ['$amount', 100] }, 0] }] },
            },
          },
        },
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

    const donationsSummary = donations.reduce((acc, row) => {
      const statusKey = row._id?.status || 'pledged';
      const currencyKey = row._id?.currency || 'USD';
      const rowTotal = Math.round(Number(row.totalMinor ?? Math.round(Number(row.total || 0) * 100))) / 100;
      if (!acc[statusKey]) {
        acc[statusKey] = { count: 0, total: 0, byCurrency: {} };
      }
      acc[statusKey].count += row.count;
      acc[statusKey].total = Math.round((acc[statusKey].total + rowTotal) * 100) / 100;
      acc[statusKey].byCurrency[currencyKey] = { count: row.count, total: rowTotal };
      return acc;
    }, {});

    const donationsByCategorySummary = donationsByCategory.reduce((acc, row) => {
      const catKey = row._id?.category || 'general';
      const statusKey = row._id?.status || 'confirmed';
      const currencyKey = row._id?.currency || 'USD';
      const rowTotal = Math.round(Number(row.totalMinor ?? Math.round(Number(row.total || 0) * 100))) / 100;
      if (!acc[catKey]) {
        acc[catKey] = { total: 0, pledgedTotal: 0, byCurrency: {}, pledgedByCurrency: {} };
      }
      if (statusKey === 'confirmed') {
        acc[catKey].total = Math.round((acc[catKey].total + rowTotal) * 100) / 100;
        acc[catKey].byCurrency[currencyKey] = Math.round(((acc[catKey].byCurrency[currencyKey] || 0) + rowTotal) * 100) / 100;
      } else {
        acc[catKey].pledgedTotal = Math.round((acc[catKey].pledgedTotal + rowTotal) * 100) / 100;
        acc[catKey].pledgedByCurrency[currencyKey] = Math.round(((acc[catKey].pledgedByCurrency[currencyKey] || 0) + rowTotal) * 100) / 100;
      }
      return acc;
    }, {});

    res.json({
      donations: donationsSummary,
      newApplications: applications,
      publishedVideos: videos,
      totalReferrals: referrals,
      donationsByCategory: donationsByCategorySummary,
      enrollmentsByCourse: enrollmentsByCourse.map(e => ({ name: e.title, count: e.count })),
      monthlyRegs: monthlyRegs.map(m => ({ month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`, count: m.count }))
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

module.exports = router;
