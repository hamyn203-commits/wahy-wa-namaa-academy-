const mongoose = require('mongoose');

const GuardianSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  children: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    relationship: {
      type: String,
      enum: ['father', 'mother', 'guardian', 'other'],
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    permissions: {
      viewProgress: {
        type: Boolean,
        default: true
      },
      viewGrades: {
        type: Boolean,
        default: true
      },
      viewAttendance: {
        type: Boolean,
        default: true
      },
      receiveNotifications: {
        type: Boolean,
        default: true
      },
      approveEnrollments: {
        type: Boolean,
        default: false
      }
    }
  }],
  notificationPreferences: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      types: [{
        type: String,
        enum: ['progress-update', 'assignment-due', 'quiz-result', 'attendance', 'achievement', 'payment']
      }]
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      phoneNumber: String,
      types: [{
        type: String,
        enum: ['urgent', 'attendance', 'payment']
      }]
    },
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      types: [{
        type: String,
        enum: ['progress-update', 'assignment-due', 'quiz-result', 'achievement']
      }]
    }
  },
  reports: [{
    type: {
      type: String,
      enum: ['weekly', 'monthly', 'custom']
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    data: {
      progress: Number,
      attendance: Number,
      assignments: {
        completed: Number,
        pending: Number,
        overdue: Number
      },
      quizzes: {
        taken: Number,
        averageScore: Number
      },
      achievements: Number
    },
    summary: {
      ar: String,
      en: String
    }
  }],
  settings: {
    language: {
      type: String,
      enum: ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'],
      default: 'ar'
    },
    timezone: {
      type: String,
      default: 'Africa/Cairo'
    },
    reportFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'never'],
      default: 'weekly'
    }
  },
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

GuardianSchema.index({ user: 1 });
GuardianSchema.index({ 'children.student': 1 });
GuardianSchema.index({ isActive: 1 });

GuardianSchema.methods.addChild = function(studentId, relationship, permissions = {}) {
  const existingChild = this.children.find(c => c.student.toString() === studentId);
  
  if (existingChild) {
    throw new Error('Child already added');
  }

  this.children.push({
    student: studentId,
    relationship,
    permissions: {
      viewProgress: permissions.viewProgress !== false,
      viewGrades: permissions.viewGrades !== false,
      viewAttendance: permissions.viewAttendance !== false,
      receiveNotifications: permissions.receiveNotifications !== false,
      approveEnrollments: permissions.approveEnrollments || false
    }
  });

  return this.save();
};

GuardianSchema.methods.removeChild = function(studentId) {
  this.children = this.children.filter(c => c.student.toString() !== studentId);
  if (Array.isArray(this.reports)) {
    this.reports = this.reports.filter(r => String(r.childId?._id || r.childId || r.student || '') !== String(studentId));
  }
  return this.save();
};

GuardianSchema.methods.updatePermissions = function(studentId, permissions) {
  const child = this.children.find(c => c.student.toString() === studentId);
  
  if (!child) {
    throw new Error('Child not found');
  }

  Object.assign(child.permissions, permissions);
  return this.save();
};

GuardianSchema.methods.generateReport = function(childId, type = 'weekly') {
  const Progress = mongoose.model('Progress');
  const Enrollment = mongoose.model('Enrollment');
  
  return Enrollment.findOne({ student: childId, status: 'active' })
    .then(enrollment => {
      if (!enrollment) return null;
      
      return Progress.findOne({ student: childId, course: enrollment.course });
    })
    .then(progress => {
      if (!progress) return null;

      const report = {
        type,
        generatedAt: new Date(),
        childId,
        data: {
          progress: progress.overallProgress.percentage,
          attendance: 100,
          assignments: {
            completed: 0,
            pending: 0,
            overdue: 0
          },
          quizzes: {
            taken: 0,
            averageScore: progress.overallProgress.averageScore || 0
          },
          achievements: progress.milestones.length
        },
        summary: {
          ar: `تقدم الطالب: ${progress.overallProgress.percentage.toFixed(1)}%`,
          en: `Student progress: ${progress.overallProgress.percentage.toFixed(1)}%`
        }
      };

      this.reports.push(report);
      if (this.reports.length > 50) {
        this.reports = this.reports.slice(-50);
      }
      return this.save();
    });
};

GuardianSchema.methods.hasPermission = function(studentId, permission) {
  if (this.isActive === false) return false;
  const child = this.children.find(c => c.student.toString() === studentId);
  return Boolean(child && child.permissions[permission]);
};

const Guardian = mongoose.model('Guardian', GuardianSchema);

module.exports = Guardian;
