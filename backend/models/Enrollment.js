const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled', 'expired'],
    default: 'active'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  progress: {
    completedLessons: [{
      lesson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson'
      },
      completedAt: {
        type: Date,
        default: Date.now
      },
      score: {
        type: Number,
        min: 0,
        max: 100
      }
    }],
    currentLesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    timeSpent: {
      type: Number,
      default: 0
    }
  },
  certificate: {
    issued: {
      type: Boolean,
      default: false
    },
    issuedAt: {
      type: Date
    },
    certificateId: {
      type: String,
      unique: true,
      sparse: true
    },
    qrCode: {
      type: String
    }
  },
  payment: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: {
      type: String
    },
    paidAt: {
      type: Date
    }
  },
  notes: [{
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate enrollments
EnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
EnrollmentSchema.index({ status: 1 });
EnrollmentSchema.index({ expiresAt: 1 });
EnrollmentSchema.index({ 'certificate.certificateId': 1 });

// Virtual for completion percentage
EnrollmentSchema.virtual('completionPercentage').get(function() {
  return this.progress.percentage;
});

// Method to update progress
EnrollmentSchema.methods.updateProgress = async function(lessonId, score = 100) {
  const Course = mongoose.model('Course');
  const Lesson = mongoose.model('Lesson');
  const Certificate = mongoose.model('Certificate');
  const course = await Course.findById(this.course);
  
  if (!course) {
    const err = new Error('Course not found');
    err.statusCode = 404;
    err.publicMessage = 'Course not found';
    throw err;
  }

  const publishedLessons = await Lesson.find({
    course: this.course,
    isPublished: true
  }).select('_id').lean();
  const publishedIds = new Set((publishedLessons || []).map((l) => String(l._id)));
  const targetLessonId = String(lessonId || '');

  if (!targetLessonId || !publishedIds.has(targetLessonId)) {
    const err = new Error('Lesson does not belong to this course or is unpublished');
    err.statusCode = 400;
    err.publicMessage = 'Lesson does not belong to this course';
    throw err;
  }

  // Check if lesson already completed
  const alreadyCompleted = this.progress.completedLessons.some(
    cl => cl.lesson.toString() === targetLessonId
  );

  if (!alreadyCompleted) {
    const safeScore = score == null ? 100 : Math.max(0, Math.min(100, Number(score) || 0));
    this.progress.completedLessons.push({
      lesson: lessonId,
      completedAt: new Date(),
      score: safeScore
    });

    // Calculate new percentage strictly from published course lessons
    const totalLessons = publishedIds.size;
    const completedCount = this.progress.completedLessons.filter(
      (cl) => publishedIds.has(String(cl.lesson))
    ).length;
    this.progress.percentage = totalLessons > 0
      ? Math.min(100, Math.round((completedCount / totalLessons) * 100))
      : 0;

    // Update current lesson
    this.progress.currentLesson = lessonId;

    // Check if course is completed (require every published lesson, never rounding up)
    if (totalLessons > 0 && completedCount >= totalLessons) {
      this.status = 'completed';
      this.completedAt = new Date();
      
      // Issue certificate if enabled
      if (course.certificate?.enabled && !this.certificate.issued) {
        this.certificate.issued = true;
        this.certificate.issuedAt = new Date();
        this.certificate.certificateId = Certificate.generateCertificateId();
      }
    }

    this.lastAccessedAt = new Date();
    await this.save();
    return { updated: true, alreadyCompleted: false };
  }

  return { updated: false, alreadyCompleted: true };
};

// Method to check if lesson is accessible
EnrollmentSchema.methods.canAccessLesson = function(lessonId) {
  if (this.status !== 'active' && this.status !== 'completed') {
    return false;
  }
  return true;
};

// Ensure virtuals are included in JSON output
EnrollmentSchema.set('toJSON', { virtuals: true });
EnrollmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
