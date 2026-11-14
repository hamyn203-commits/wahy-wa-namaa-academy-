const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
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
    enum: ['written', 'audio', 'video', 'quiz', 'practical'],
    required: true
  },
  instructions: {
    ar: String,
    en: String,
    fr: String,
    de: String,
    tr: String,
    ur: String,
    id: String,
    ms: String
  },
  dueDate: {
    type: Date,
    required: true
  },
  points: {
    type: Number,
    default: 100
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  submissionTypes: [{
    type: String,
    enum: ['text', 'file', 'audio', 'video', 'url']
  }],
  maxFileSize: {
    type: Number,
    default: 10 * 1024 * 1024
  },
  allowedFileTypes: [String],
  rubric: [{
    criteria: {
      ar: String,
      en: String
    },
    points: Number,
    description: {
      ar: String,
      en: String
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  stats: {
    submissions: {
      type: Number,
      default: 0
    },
    graded: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

AssignmentSchema.index({ course: 1, lesson: 1 });
AssignmentSchema.index({ instructor: 1 });
AssignmentSchema.index({ dueDate: 1 });
AssignmentSchema.index({ status: 1 });

const AssignmentSubmissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
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
  submissionType: {
    type: String,
    enum: ['text', 'file', 'audio', 'video', 'url'],
    required: true
  },
  content: {
    text: String,
    url: String,
    file: {
      name: String,
      url: String,
      type: String,
      size: Number
    }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'returned', 'late'],
    default: 'submitted'
  },
  grade: {
    score: Number,
    maxScore: Number,
    percentage: Number,
    feedback: {
      ar: String,
      en: String
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    gradedAt: Date
  },
  attempts: {
    type: Number,
    default: 1
  },
  isLate: {
    type: Boolean,
    default: false
  },
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

AssignmentSubmissionSchema.index({ assignment: 1, student: 1 });
AssignmentSubmissionSchema.index({ status: 1 });
AssignmentSubmissionSchema.index({ submittedAt: 1 });

AssignmentSubmissionSchema.pre('save', async function() {
  if (!this.isNew && !this.isModified('submittedAt')) {
    return;
  }
  const AssignmentModel = mongoose.model('Assignment');
  const assignment = await AssignmentModel.findById(this.assignment).select('dueDate').lean();
  if (assignment && assignment.dueDate && this.submittedAt > assignment.dueDate) {
    this.isLate = true;
    if (this.status === 'submitted') {
      this.status = 'late';
    }
  }
});

AssignmentSubmissionSchema.methods.calculateGrade = function(score, maxScore) {
  const safeMax = Math.max(1, Number(maxScore) || 100);
  const safeScore = Math.max(0, Math.min(safeMax, Number(score) || 0));
  this.grade.score = safeScore;
  this.grade.maxScore = safeMax;
  this.grade.percentage = Math.round((safeScore / safeMax) * 10000) / 100;
  this.status = 'graded';
  return this.save();
};

const Assignment = mongoose.model('Assignment', AssignmentSchema);
const AssignmentSubmission = mongoose.model('AssignmentSubmission', AssignmentSubmissionSchema);

module.exports = { Assignment, AssignmentSubmission };
