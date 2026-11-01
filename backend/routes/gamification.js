const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Badge, UserBadge, Achievement, Leaderboard } = require('../models/Gamification');
const Progress = require('../models/Progress');
const { protect, authorize } = require('../middleware/auth');

const isDBConnected = () => mongoose.connection.readyState === 1;
const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

// @route   GET /api/gamification/badges
// @desc    Get all available badges
// @access  Public
router.get('/badges', async (req, res) => {
  try {
    if (!isDBConnected()) {
      return res.status(503).json({ error: 'Gamification data is temporarily unavailable' });
    }

    const badges = await Badge.find({ isActive: true, isSecret: false })
      .sort({ category: 1, rarity: 1 });

    res.json(badges);
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// @route   GET /api/gamification/my-badges
// @desc    Get user's badges
// @access  Private
router.get('/my-badges', protect, async (req, res) => {
  try {
    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.status(503).json({ error: 'Gamification data is temporarily unavailable' });
    }

    const userBadges = await UserBadge.find({ user: req.user.id })
      .populate('badge')
      .sort({ unlockedAt: -1 });

    const unlocked = userBadges.filter(ub => ub.isUnlocked);
    const locked = userBadges.filter(ub => !ub.isUnlocked);

    res.json({
      unlocked,
      locked,
      stats: {
        totalUnlocked: unlocked.length,
        totalLocked: locked.length,
        completionRate: userBadges.length > 0 ? (unlocked.length / userBadges.length) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Get my badges error:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// @route   GET /api/gamification/badge/:badgeId/progress
// @desc    Get progress for a specific badge
// @access  Private
router.get('/badge/:badgeId/progress', protect, async (req, res) => {
  try {
    const userBadge = await UserBadge.findOne({
      user: req.user.id,
      badge: req.params.badgeId
    }).populate('badge');

    if (!userBadge) {
      const badge = await Badge.findById(req.params.badgeId);
      if (!badge) {
        return res.status(404).json({ error: 'Badge not found' });
      }

      return res.json({
        badge,
        progress: {
          current: 0,
          target: badge.requirements.target,
          percentage: 0
        },
        isUnlocked: false
      });
    }

    res.json(userBadge);
  } catch (error) {
    console.error('Get badge progress error:', error);
    res.status(500).json({ error: 'Failed to fetch badge progress' });
  }
});

// @route   GET /api/gamification/achievements
// @desc    Get user's achievements
// @access  Private
router.get('/achievements', protect, async (req, res) => {
  try {
    const { limit = 20, unseenOnly = false } = req.query;

    const filter = { user: req.user.id };
    if (unseenOnly === 'true') {
      filter.isSeen = false;
    }

    const achievements = await Achievement.find(filter)
      .populate('badge', 'name icon color')
      .populate('metadata.course', 'title')
      .sort({ achievedAt: -1 })
      .limit(Math.min(100, Math.max(1, parseInt(limit, 10) || 20)));

    res.json(achievements);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// @route   PUT /api/gamification/achievements/:achievementId/seen
// @desc    Mark achievement as seen
// @access  Private
router.put('/achievements/:achievementId/seen', protect, async (req, res) => {
  try {
    const achievement = await Achievement.findOne({
      _id: req.params.achievementId,
      user: req.user.id
    });

    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    achievement.isSeen = true;
    await achievement.save();

    res.json(achievement);
  } catch (error) {
    console.error('Mark achievement seen error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/gamification/achievements/seen-all
// @desc    Mark all achievements as seen
// @access  Private
router.put('/achievements/seen-all', protect, async (req, res) => {
  try {
    await Achievement.updateMany(
      { user: req.user.id, isSeen: false },
      { isSeen: true }
    );

    res.json({ message: 'All achievements marked as seen' });
  } catch (error) {
    console.error('Mark all seen error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/gamification/leaderboard/:type/:timeframe
// @desc    Get leaderboard
// @access  Public
router.get('/leaderboard/:type/:timeframe', async (req, res) => {
  try {
    const { type, timeframe } = req.params;
    const { limit = 50 } = req.query;
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    if (!['points', 'streak', 'courses', 'quizzes'].includes(type) || !['weekly', 'monthly', 'all-time'].includes(timeframe)) return res.status(400).json({ error: 'Invalid leaderboard type or timeframe' });

    if (!isDBConnected()) {
      return res.json({
        type,
        timeframe,
        entries: [],
        userRank: null,
        lastUpdated: null
      });
    }

    let leaderboard = await Leaderboard.findOne({ type, timeframe })
      .populate('entries.user', 'name avatar');

    if (!leaderboard) {
      leaderboard = await Leaderboard.updateLeaderboard(type, timeframe);
      leaderboard = await Leaderboard.findById(leaderboard._id)
        .populate('entries.user', 'name avatar');
    }

    const entries = leaderboard.entries.slice(0, safeLimit);

    let userRank = null;
    if (req.user) {
      const userEntry = leaderboard.entries.find(e => e.user._id.toString() === req.user.id);
      if (userEntry) {
        userRank = userEntry.rank;
      }
    }

    res.json({
      type,
      timeframe,
      entries,
      userRank,
      lastUpdated: leaderboard.lastUpdated
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// @route   POST /api/gamification/check-badges
// @desc    Check and award badges based on progress
// @access  Private
router.post('/check-badges', protect, async (req, res) => {
  try {
    const progress = await Progress.find({ student: req.user.id });
    const badges = await Badge.find({ isActive: true });

    const newBadges = [];

    for (const badge of badges) {
      let userBadge = await UserBadge.findOne({
        user: req.user.id,
        badge: badge._id
      });

      if (!userBadge) {
        userBadge = new UserBadge({
          user: req.user.id,
          badge: badge._id,
          progress: {
            target: badge.requirements.target
          }
        });
      }

      if (userBadge.isUnlocked) continue;

      let currentValue = 0;

      switch (badge.requirements.type) {
        case 'lessons-completed':
          currentValue = progress.reduce((sum, p) => sum + p.overallProgress.completedLessons, 0);
          break;
        case 'courses-completed':
          currentValue = progress.filter(p => p.overallProgress.percentage === 100).length;
          break;
        case 'streak-days':
          currentValue = Math.max(...progress.map(p => p.streak.current), 0);
          break;
        case 'quizzes-passed':
          currentValue = progress.reduce((sum, p) => 
            sum + p.milestones.filter(m => m.type === 'quiz-passed').length, 0
          );
          break;
        case 'assignments-submitted':
          currentValue = progress.reduce((sum, p) => 
            sum + p.milestones.filter(m => m.type === 'assignment-submitted').length, 0
          );
          break;
        case 'perfect-scores':
          currentValue = progress.reduce((sum, p) => 
            sum + p.lessonProgress.filter(lp => lp.score === 100).length, 0
          );
          break;
        case 'time-spent':
          currentValue = progress.reduce((sum, p) => sum + p.overallProgress.totalTimeSpent, 0) / 3600;
          break;
      }

      await userBadge.updateProgress(currentValue);

      if (userBadge.isUnlocked && !userBadge.notificationSent) {
        const achievement = new Achievement({
          user: req.user.id,
          type: 'badge-unlocked',
          title: badge.name,
          description: badge.description,
          points: badge.points,
          badge: badge._id
        });
        await achievement.save();

        badge.unlockedBy += 1;
        await badge.save();

        userBadge.notificationSent = true;
        await userBadge.save();

        newBadges.push({
          badge,
          achievement
        });
      }
    }

    res.json({
      newBadges,
      message: newBadges.length > 0 
        ? `Congratulations! You unlocked ${newBadges.length} new badge(s)!`
        : 'No new badges unlocked'
    });
  } catch (error) {
    console.error('Check badges error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/gamification/stats
// @desc    Get user's gamification stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const progress = await Progress.find({ student: req.user.id });
    const userBadges = await UserBadge.find({ user: req.user.id, isUnlocked: true });
    const achievements = await Achievement.find({ user: req.user.id });

    const totalPoints = progress.reduce((sum, p) => 
      sum + p.milestones.reduce((ms, m) => ms + (m.points || 0), 0), 0
    );

    const currentStreak = Math.max(...progress.map(p => p.streak.current), 0);
    const longestStreak = Math.max(...progress.map(p => p.streak.longest), 0);

    const level = Math.floor(totalPoints / 100) + 1;
    const pointsToNextLevel = (level * 100) - totalPoints;

    res.json({
      points: {
        total: totalPoints,
        level,
        pointsToNextLevel
      },
      badges: {
        unlocked: userBadges.length,
        total: await Badge.countDocuments({ isActive: true })
      },
      achievements: {
        total: achievements.length,
        recent: achievements.slice(0, 5)
      },
      streaks: {
        current: currentStreak,
        longest: longestStreak
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// @route   POST /api/gamification/initialize-badges
// @desc    Initialize default badges (Admin only)
// @access  Private (Admin)
router.post('/initialize-badges', protect, authorize('admin'), async (req, res) => {
  try {
    const defaultBadges = [
      {
        code: 'FIRST_LESSON',
        name: { ar: 'الدرس الأول', en: 'First Lesson' },
        description: { ar: 'أكمل درسك الأول', en: 'Complete your first lesson' },
        icon: '📚',
        category: 'learning',
        rarity: 'common',
        points: 10,
        requirements: { type: 'lessons-completed', target: 1 }
      },
      {
        code: 'WEEK_STREAK',
        name: { ar: 'أسبوع متواصل', en: 'Week Streak' },
        description: { ar: 'ادرس لمدة 7 أيام متواصلة', en: 'Study for 7 days straight' },
        icon: '🔥',
        category: 'streak',
        rarity: 'uncommon',
        points: 50,
        requirements: { type: 'streak-days', target: 7 }
      },
      {
        code: 'COURSE_MASTER',
        name: { ar: 'سيد الدورة', en: 'Course Master' },
        description: { ar: 'أكمل دورة كاملة بنجاح', en: 'Complete a full course successfully' },
        icon: '🎓',
        category: 'achievement',
        rarity: 'rare',
        points: 100,
        requirements: { type: 'courses-completed', target: 1 }
      },
      {
        code: 'PERFECT_SCORE',
        name: { ar: 'العلامة الكاملة', en: 'Perfect Score' },
        description: { ar: 'احصل على 100% في درس', en: 'Get 100% in a lesson' },
        icon: '⭐',
        category: 'achievement',
        rarity: 'uncommon',
        points: 30,
        requirements: { type: 'perfect-scores', target: 1 }
      },
      {
        code: 'DEDICATED_LEARNER',
        name: { ar: 'المتعلم الملتزم', en: 'Dedicated Learner' },
        description: { ar: 'ادرس لمدة 10 ساعات', en: 'Study for 10 hours' },
        icon: '⏰',
        category: 'learning',
        rarity: 'rare',
        points: 75,
        requirements: { type: 'time-spent', target: 10 }
      }
    ];

    const created = [];
    for (const badgeData of defaultBadges) {
      const existing = await Badge.findOne({ code: badgeData.code });
      if (!existing) {
        const badge = new Badge(badgeData);
        await badge.save();
        created.push(badge);
      }
    }

    res.status(201).json({
      message: `Created ${created.length} badges`,
      badges: created
    });
  } catch (error) {
    console.error('Initialize badges error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
