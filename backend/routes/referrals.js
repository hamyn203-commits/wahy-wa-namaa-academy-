const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const ReferralReward = require('../models/ReferralReward');
const { protect } = require('../middleware/auth');
const { isMockMode } = require('../config/runtime');

const isDBConnected = () => mongoose.connection.readyState === 1;
const isValidObjectId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(id));

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function maskDisplayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'طالب وحي ونماء';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode();
    try {
      const existing = await User.findOne({ referralCode: code }).select('_id').lean();
      if (existing) continue;
      if (typeof User.findOneAndUpdate === 'function') {
        const updated = await User.findOneAndUpdate(
          {
            _id: user._id,
            $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' }],
          },
          { $set: { referralCode: code } },
          { new: true }
        );
        if (updated?.referralCode) {
          user.referralCode = updated.referralCode;
          return updated.referralCode;
        }
        const refreshed = await User.findById(user._id).select('referralCode').lean();
        if (refreshed?.referralCode) {
          user.referralCode = refreshed.referralCode;
          return refreshed.referralCode;
        }
      } else {
        user.referralCode = code;
        await user.save();
        return code;
      }
    } catch (err) {
      if (err?.code === 11000) continue;
      throw err;
    }
  }
  throw new Error('Unable to allocate unique referral code');
}

router.get('/validate/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase().slice(0, 24);
    if (!code) return res.status(404).json({ valid: false, error: 'رمز غير صالح' });
    const referrer = await User.findOne({ referralCode: code, isActive: true }).select('name referralCode').lean();
    if (!referrer) return res.status(404).json({ valid: false, error: 'رمز غير صالح' });
    res.json({ valid: true, referrerName: maskDisplayName(referrer.name) });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    if (!isDBConnected()) {
      if (!isMockMode) {
        return res.status(503).json({ error: 'قاعدة البيانات غير متاحة حالياً' });
      }
      return res.json({
        code: null,
        link: null,
        stats: { totalInvites: 0, active: 0, pending: 0, totalPoints: 0 },
        referrals: [],
        rewards: [],
      });
    }

    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ error: 'معرف المستخدم غير صالح' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const code = await ensureReferralCode(user);

    const userObjectId = new mongoose.Types.ObjectId(String(req.user.id));
    const [referrals, rewards, pointsAgg] = await Promise.all([
      Referral.find({ referrer: req.user.id })
        .populate('referee', 'name createdAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      ReferralReward.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20).lean(),
      ReferralReward.aggregate([
        { $match: { user: userObjectId } },
        { $group: { _id: null, totalPoints: { $sum: '$points' } } },
      ]),
    ]);

    const totalPoints = Number(pointsAgg[0]?.totalPoints || 0);
    const sanitizedReferrals = referrals.map((r) => ({
      _id: r._id,
      status: r.status,
      createdAt: r.createdAt,
      referee: r.referee
        ? { name: maskDisplayName(r.referee.name), createdAt: r.referee.createdAt }
        : null,
    }));

    const siteBase = String(process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://wahywanamaa.com').replace(/\/+$/, '');
    res.json({
      code,
      link: `${siteBase}/register/student?ref=${code}`,
      stats: {
        totalInvites: referrals.length,
        active: referrals.filter((r) => r.status === 'active' || r.status === 'rewarded').length,
        pending: referrals.filter((r) => r.status === 'pending').length,
        totalPoints,
      },
      referrals: sanitizedReferrals,
      rewards,
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10), 50);
    const timeframe = String(req.query.timeframe || 'all-time').trim();
    const match = { status: { $in: ['active', 'rewarded'] } };
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

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$referrer',
          count: { $sum: 1 },
          rewarded: { $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] } },
        },
      },
      { $sort: { rewarded: -1, count: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, name: '$user.name', count: 1, rewarded: 1 } },
    ];

    const rows = await Referral.aggregate(pipeline);
    res.json({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        name: maskDisplayName(r.name),
        invites: r.count,
        rewarded: r.rewarded,
      })),
      timeframe: ['weekly', 'monthly'].includes(timeframe) ? timeframe : 'all-time',
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

async function awardSignupReferralIfVerified(referral) {
  if (!referral || !referral.referee) return false;
  const refereeUser = await User.findById(referral.referee).select('emailVerified isActive').lean().catch(() => null);
  if (!refereeUser || refereeUser.emailVerified !== true || refereeUser.isActive === false) {
    return false;
  }
  const exists = await ReferralReward.findOne({ referral: referral._id, type: 'signup' });
  if (exists) return false;
  try {
    await ReferralReward.create({
      user: referral.referrer,
      referral: referral._id,
      type: 'signup',
      points: 50,
      description: 'دعوة طالب جديد موثق',
    });
    if (referral.status !== 'rewarded') {
      referral.status = 'rewarded';
      await referral.save();
    }
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function processReferralFirstSession(studentUserId) {
  const referral = await Referral.findOne({ referee: studentUserId });
  if (!referral) return null;

  const refereeUser = await User.findById(studentUserId).select('emailVerified isActive').lean().catch(() => null);
  if (!refereeUser || refereeUser.emailVerified !== true || refereeUser.isActive === false) {
    return null;
  }

  await awardSignupReferralIfVerified(referral);

  const exists = await ReferralReward.findOne({ referral: referral._id, type: 'first_session' });
  if (exists) return null;

  const points = 100;
  try {
    await ReferralReward.create({
      user: referral.referrer,
      referral: referral._id,
      type: 'first_session',
      points,
      description: 'أكمل المدعو أول حصة بحضور فعلي',
    });
    if (referral.status !== 'rewarded') {
      referral.status = 'rewarded';
      await referral.save();
    }
    return points;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function processReferralSignup(referrerCode, newUserId) {
  if (!referrerCode || !newUserId) return null;

  const existingReferral = await Referral.findOne({ referee: newUserId });
  if (existingReferral) return existingReferral;

  const code = String(referrerCode).trim().toUpperCase().slice(0, 24);
  if (!code) return null;
  const referrer = await User.findOne({ referralCode: code, isActive: true });
  if (!referrer || referrer._id.toString() === newUserId.toString()) return null;

  const newUser = await User.findById(newUserId).select('emailVerified').lean().catch(() => null);
  const isVerified = Boolean(newUser?.emailVerified);

  let referral;
  try {
    referral = await Referral.create({
      referrer: referrer._id,
      referee: newUserId,
      code,
      status: isVerified ? 'active' : 'pending',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return Referral.findOne({ referee: newUserId });
    }
    throw error;
  }

  await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });

  if (isVerified) {
    await awardSignupReferralIfVerified(referral);
  }
  return referral;
}

module.exports = router;
module.exports.processReferralSignup = processReferralSignup;
module.exports.processReferralFirstSession = processReferralFirstSession;
module.exports.awardSignupReferralIfVerified = awardSignupReferralIfVerified;
module.exports.ensureReferralCode = ensureReferralCode;
