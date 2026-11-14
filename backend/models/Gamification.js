const mongoose = require('mongoose');

const BadgeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    ar: { type: String, required: true },
    en: { type: String, required: true },
    fr: { type: String },
    de: { type: String },
    tr: { type: String },
    ur: { type: String },
    id: { type: String },
    ms: { type: String }
  },
  description: {
    ar: { type: String, required: true },
    en: { type: String, required: true },
    fr: { type: String },
    de: { type: String },
    tr: { type: String },
    ur: { type: String },
    id: { type: String },
    ms: { type: String }
  },
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#10b981'
  },
  category: {
    type: String,
    enum: ['learning', 'achievement', 'streak', 'social', 'special'],
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common'
  },
  points: {
    type: Number,
    default: 10
  },
  requirements: {
    type: {
      type: String,
      enum: ['lessons-completed', 'courses-completed', 'streak-days', 'quizzes-passed', 'assignments-submitted', 'perfect-scores', 'time-spent', 'special'],
      required: true
    },
    target: {
      type: Number,
      required: true
    },
    timeframe: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'all-time'],
      default: 'all-time'
    }
  },
  isSecret: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unlockedBy: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

BadgeSchema.index({ code: 1 });
BadgeSchema.index({ category: 1 });
BadgeSchema.index({ rarity: 1 });
BadgeSchema.index({ isActive: 1 });

const UserBadgeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge',
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    current: {
      type: Number,
      default: 0
    },
    target: {
      type: Number,
      required: true
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  isUnlocked: {
    type: Boolean,
    default: false
  },
  notificationSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

UserBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
UserBadgeSchema.index({ user: 1, isUnlocked: 1 });
UserBadgeSchema.index({ badge: 1 });

UserBadgeSchema.methods.updateProgress = function(current) {
  this.progress.current = current;
  this.progress.percentage = (current / this.progress.target) * 100;
  
  if (current >= this.progress.target && !this.isUnlocked) {
    this.isUnlocked = true;
    this.unlockedAt = new Date();
  }
  
  return this.save();
};

const AchievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['badge-unlocked', 'level-up', 'streak-milestone', 'course-completed', 'perfect-score', 'special'],
    required: true
  },
  title: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  description: {
    ar: { type: String, required: true },
    en: { type: String, required: true }
  },
  points: {
    type: Number,
    default: 0
  },
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Badge'
  },
  metadata: {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    score: Number,
    streak: Number
  },
  achievedAt: {
    type: Date,
    default: Date.now
  },
  isSeen: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

AchievementSchema.index({ user: 1, achievedAt: -1 });
AchievementSchema.index({ user: 1, isSeen: 1 });
AchievementSchema.index({ type: 1 });

const LeaderboardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['points', 'streak', 'courses', 'quizzes', 'courses-completed', 'lessons-completed', 'quizzes-perfect'],
    required: true
  },
  timeframe: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'all-time'],
    required: true
  },
  entries: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rank: Number,
    score: Number,
    details: {
      ar: String,
      en: String
    }
  }],
  period: {
    start: Date,
    end: Date
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

LeaderboardSchema.index({ type: 1, timeframe: 1 }, { unique: true });
LeaderboardSchema.index({ lastUpdated: -1 });

LeaderboardSchema.statics.updateLeaderboard = async function(type, timeframe) {
  const Progress = mongoose.model('Progress');
  
  let scoreField = 'totalPoints';
  
  switch (type) {
    case 'points':
      scoreField = 'totalPoints';
      break;
    case 'streak':
      scoreField = 'currentStreak';
      break;
    case 'courses':
    case 'courses-completed':
      scoreField = 'completedCourses';
      break;
    case 'quizzes':
    case 'quizzes-perfect':
      scoreField = 'quizzesPassed';
      break;
    case 'lessons-completed':
      scoreField = 'completedLessons';
      break;
    default:
      scoreField = 'totalPoints';
  }

  const sortBy = { [scoreField]: -1 };

  const entries = await Progress.aggregate([
    {
      $group: {
        _id: '$student',
        totalPoints: { $sum: { $sum: '$milestones.points' } },
        currentStreak: { $max: '$streak.current' },
        completedCourses: {
          $sum: {
            $cond: [{ $eq: ['$overallProgress.percentage', 100] }, 1, 0]
          }
        },
        quizzesPassed: {
          $sum: {
            $size: {
              $filter: {
                input: { $ifNull: ['$milestones', []] },
                as: 'm',
                cond: { $eq: ['$$m.type', 'quiz-passed'] }
              }
            }
          }
        },
        completedLessons: { $sum: '$overallProgress.completedLessons' }
      }
    },
    { $sort: sortBy },
    { $limit: 100 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' }
  ]);

  const leaderboardEntries = entries.map((entry, index) => ({
    user: entry.user._id,
    rank: index + 1,
    score: entry[scoreField],
    details: {
      ar: `${entry[scoreField]} نقطة`,
      en: `${entry[scoreField]} points`
    }
  }));

  let period = {};
  const now = new Date();
  
  switch (timeframe) {
    case 'daily':
      period = {
        start: new Date(now.setHours(0, 0, 0, 0)),
        end: new Date(now.setHours(23, 59, 59, 999))
      };
      break;
    case 'weekly':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      period = {
        start: weekStart,
        end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      };
      break;
    case 'monthly':
      period = {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      };
      break;
    case 'all-time':
      period = {
        start: new Date(2020, 0, 1),
        end: new Date(2030, 11, 31)
      };
      break;
  }

  const leaderboard = await this.findOneAndUpdate(
    { type, timeframe },
    {
      entries: leaderboardEntries,
      period,
      lastUpdated: new Date()
    },
    { upsert: true, new: true }
  );

  return leaderboard;
};

const Badge = mongoose.model('Badge', BadgeSchema);
const UserBadge = mongoose.model('UserBadge', UserBadgeSchema);
const Achievement = mongoose.model('Achievement', AchievementSchema);
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);

module.exports = { Badge, UserBadge, Achievement, Leaderboard };
