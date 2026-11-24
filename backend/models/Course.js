const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: {
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
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['quran', 'tajweed', 'arabic', 'islamic', 'ijazah', 'children']
  },
  programs: [{
    type: String,
    enum: ['kids', 'reverts', 'women', 'general'],
  }],
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  regionalPrices: {
    EG: { type: Number, min: 0 },
    GCC: { type: Number, min: 0 },
    WEST: { type: Number, min: 0 },
    INTL: { type: Number, min: 0 }
  },
  compareAtPrices: {
    EG: { type: Number, min: 0 },
    GCC: { type: Number, min: 0 },
    WEST: { type: Number, min: 0 },
    INTL: { type: Number, min: 0 }
  },
  duration: {
    type: String,
    required: true
  },
  durationInHours: {
    type: Number,
    required: true
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String
  },
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  learningOutcomes: {
    ar: [String],
    en: [String],
    fr: [String],
    de: [String],
    tr: [String],
    ur: [String],
    id: [String],
    ms: [String]
  },
  requirements: {
    ar: [String],
    en: [String],
    fr: [String],
    de: [String],
    tr: [String],
    ur: [String],
    id: [String],
    ms: [String]
  },
  targetAudience: {
    ar: [String],
    en: [String],
    fr: [String],
    de: [String],
    tr: [String],
    ur: [String],
    id: [String],
    ms: [String]
  },
  certificate: {
    enabled: {
      type: Boolean,
      default: true
    },
    template: {
      type: String
    }
  },
  features: {
    liveSessions: {
      type: Boolean,
      default: false
    },
    downloadableResources: {
      type: Boolean,
      default: true
    },
    mobileAccess: {
      type: Boolean,
      default: true
    },
    lifetimeAccess: {
      type: Boolean,
      default: true
    },
    assignments: {
      type: Boolean,
      default: true
    },
    quizzes: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    enrolled: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      count: {
        type: Number,
        default: 0
      }
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  tags: [String],
  seo: {
    metaTitle: {
      ar: String,
      en: String
    },
    metaDescription: {
      ar: String,
      en: String
    },
    keywords: [String]
  }
}, {
  timestamps: true
});

// Indexes for better query performance
CourseSchema.index({ slug: 1 });
CourseSchema.index({ category: 1, level: 1 });
CourseSchema.index({ instructor: 1 });
CourseSchema.index({ status: 1, publishedAt: -1 });
CourseSchema.index({ 'stats.enrolled': -1 });
CourseSchema.index({ 'stats.rating.average': -1 });
CourseSchema.index({ tags: 1 });

// Virtual for total lessons count
CourseSchema.virtual('totalLessons').get(function() {
  return this.lessons ? this.lessons.length : 0;
});

// Method to calculate completion percentage for a user
CourseSchema.methods.getCompletionPercentage = function(userId) {
  // This will be implemented when we have enrollment model
  return 0;
};

// Ensure virtuals are included in JSON output
CourseSchema.set('toJSON', { virtuals: true });
CourseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', CourseSchema);
