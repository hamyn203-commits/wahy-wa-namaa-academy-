const mongoose = require('mongoose');

const QuizQuestionSchema = new mongoose.Schema({
  question: {
    ar: { type: String, required: true },
    en: { type: String, required: true },
    fr: { type: String },
    de: { type: String },
    tr: { type: String },
    ur: { type: String },
    id: { type: String },
    ms: { type: String }
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-blank'],
    required: true
  },
  options: [{
    text: {
      ar: String,
      en: String,
      id: String,
      ms: String
    },
    isCorrect: Boolean
  }],
  correctAnswer: String,
  points: {
    type: Number,
    default: 1
  },
  explanation: {
    ar: String,
    en: String
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  tags: [String],
  media: {
    type: String,
    enum: ['image', 'audio', 'video'],
    url: String
  }
});

const QuizSchema = new mongoose.Schema({
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
    ar: String,
    en: String
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  type: {
    type: String,
    enum: ['quiz', 'midterm', 'final', 'practice'],
    default: 'quiz'
  },
  questions: [QuizQuestionSchema],
  settings: {
    timeLimit: {
      type: Number,
      default: 30
    },
    passingScore: {
      type: Number,
      default: 70
    },
    maxAttempts: {
      type: Number,
      default: 1
    },
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    shuffleOptions: {
      type: Boolean,
      default: false
    },
    showResults: {
      type: String,
      enum: ['immediately', 'after-deadline', 'manual'],
      default: 'immediately'
    },
    allowReview: {
      type: Boolean,
      default: true
    }
  },
  availability: {
    startDate: Date,
    endDate: Date,
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  stats: {
    attempts: {
      type: Number,
      default: 0
    },
    completions: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

QuizSchema.index({ course: 1, lesson: 1 });
QuizSchema.index({ instructor: 1 });
QuizSchema.index({ status: 1 });
QuizSchema.index({ 'availability.startDate': 1, 'availability.endDate': 1 });

QuizSchema.methods.calculateMaxScore = function() {
  return this.questions.reduce((sum, q) => sum + q.points, 0);
};

QuizSchema.methods.isAvailableNow = function() {
  const now = new Date();
  if (!this.availability.isAvailable) return false;
  if (this.availability.startDate && now < this.availability.startDate) return false;
  if (this.availability.endDate && now > this.availability.endDate) return false;
  return true;
};

const QuizAttemptSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  enrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: true
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  answers: [{
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz.questions'
    },
    answer: String,
    isCorrect: Boolean,
    points: Number
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  timeSpent: Number,
  score: {
    raw: Number,
    percentage: Number,
    maxScore: Number
  },
  status: {
    type: String,
    enum: ['in-progress', 'submitted', 'graded', 'expired'],
    default: 'in-progress'
  },
  feedback: {
    ar: String,
    en: String
  },
  isPassed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

QuizAttemptSchema.index({ quiz: 1, student: 1 });
QuizAttemptSchema.index({ quiz: 1, student: 1, attemptNumber: 1 }, { unique: true });
QuizAttemptSchema.index({ status: 1 });
QuizAttemptSchema.index({ submittedAt: 1 });

QuizAttemptSchema.methods.calculateScore = function() {
  let totalPoints = 0;
  let earnedPoints = 0;

  this.answers.forEach(answer => {
    totalPoints += answer.points || 0;
    if (answer.isCorrect) {
      earnedPoints += answer.points || 0;
    }
  });

  this.score = {
    raw: earnedPoints,
    percentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0,
    maxScore: totalPoints
  };

  return this.score;
};

QuizAttemptSchema.methods.checkPassing = function(passingScore) {
  this.isPassed = this.score.percentage >= passingScore;
  return this.isPassed;
};

const Quiz = mongoose.model('Quiz', QuizSchema);
const QuizAttempt = mongoose.model('QuizAttempt', QuizAttemptSchema);

module.exports = { Quiz, QuizAttempt };
