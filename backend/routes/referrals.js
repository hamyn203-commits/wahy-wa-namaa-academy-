const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const ReferralReward = require('../models/ReferralReward');
const { protect } = require('../middleware/auth');

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode();
    exists = await User.findOne({ referralCode: code });
  }
  user.referralCode = code;
  await user.save();
  return code;
}

router.get('/validate/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const referrer = await User.findOne({ referralCode: code, isActive: true }).select('name referralCode');
    if (!referrer) return res.status(404).json({ valid: false, error: 'رمز غير صالح' });
    res.json({ valid: true, referrerName: referrer.name });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const isDBConnected = () => mongoose.connection.readyState === 1;
    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.json({
        code: null,
        link: null,
        stats: { totalInvites: 0, active: 0, pending: 0, totalPoints: 0 },
        referrals: [],
        rewards: [],
      });
    }

    const user = await User.findById(req.user.id);
    const code = await ensureReferralCode(user);

    const referrals = await Referral.find({ referrer: req.user.id })
      .populate('referee', 'name createdAt')
      .sort({ createdAt: -1 });

    const rewards = await ReferralReward.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20);
    const totalPoints = rewards.reduce((s, r) => s + r.points, 0);

    res.json({
      code,
      link: `${process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://wahy-wa-namaa-academy.vercel.app'}/register/student?ref=${code}`,
      stats: {
        totalInvites: referrals.length,
        active: referrals.filter((r) => r.status === 'active' || r.status === 'rewarded').length,
        pending: referrals.filter((r) => r.status === 'pending').length,
        totalPoints,
      },
      referrals,
      rewards,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const { timeframe } = req.query;
    const match = {};
    if (timeframe === 'monthly') {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      match.createdAt = { $gte: start };
    } else if (timeframe === 'weekly') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      match.createdAt = { $gte: start };
    }

    const pipeline = [{ $match: match }];
    pipeline.push(
      { $group: { _id: '$referrer', count: { $sum: 1 }, rewarded: { $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { name: '$user.name', count: 1, rewarded: 1 } },
    );

    const rows = await Referral.aggregate(pipeline);
    res.json({ leaderboard: rows.map((r, i) => ({ rank: i + 1, name: r.name, invites: r.count, rewarded: r.rewarded })), timeframe: timeframe || 'all-time' });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

async function processReferralFirstSession(studentUserId) {
  const referral = await Referral.findOne({ referee: studentUserId });
  if (!referral) return null;

  const exists = await ReferralReward.findOne({ referral: referral._id, type: 'first_session' });
  if (exists) return null;

  const points = 100;
  await ReferralReward.create({
    user: referral.referrer,
    referral: referral._id,
    type: 'first_session',
    points,
    description: 'أكمل المدعو أول حصة',
  });
  return points;
}

async function processReferralSignup(referrerCode, newUserId) {
  if (!referrerCode) return null;

  const existingReferral = await Referral.findOne({ referee: newUserId });
  if (existingReferral) return existingReferral;

  const code = referrerCode.toUpperCase();
  const referrer = await User.findOne({ referralCode: code, isActive: true });
  if (!referrer || referrer._id.toString() === newUserId.toString()) return null;

  const referral = await Referral.create({
    referrer: referrer._id,
    referee: newUserId,
    code,
    status: 'active',
  });

  await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });

  const points = 50;
  await ReferralReward.create({
    user: referrer._id,
    referral: referral._id,
    type: 'signup',
    points,
    description: 'دعوة طالب جديد',
  });

  referral.status = 'rewarded';
  await referral.save();
  return referral;
}

module.exports = router;
module.exports.processReferralSignup = processReferralSignup;
module.exports.processReferralFirstSession = processReferralFirstSession;
module.exports.ensureReferralCode = ensureReferralCode;
