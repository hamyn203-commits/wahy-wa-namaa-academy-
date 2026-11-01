const mongoose = require('mongoose');

const TrialRequestSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
  guardianName: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  whatsappPhone: {
    type: String,
    required: [true, 'WhatsApp number is required for notifications'],
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  country: {
    type: String,
    default: 'مصر'
  },
  city: {
    type: String,
    default: 'القاهرة'
  },
  age: {
    type: Number,
    min: 4,
    max: 100
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  preferredTrack: {
    type: String,
    enum: ['memorization', 'tajweed_ijazah', 'kids_foundation'],
    default: 'memorization'
  },
  preferredTeacherGender: {
    type: String,
    enum: ['male', 'female', 'any'],
    default: 'any'
  },
  preferredDate: {
    type: Date
  },
  preferredTimeSlot: {
    type: String,
    default: 'evening'
  },
  scheduledSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  assignedTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'no_show', 'cancelled'],
    default: 'pending'
  },
  assessment: {
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'ijazah']
    },
    recommendedTrack: {
      type: String,
      enum: ['memorization', 'tajweed_ijazah', 'kids_foundation']
    },
    notes: String,
    assignedCircle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupCircle'
    },
    evaluatedAt: Date
  },
  // Linked platform account (set when the request is submitted while signed in,
  // or when the admin assigns the trial and a matching account is found).
  studentUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currentLevel: {
    type: String,
    trim: true,
    maxlength: 40,
    default: ''
  },
  preferredDay: {
    type: String,
    trim: true,
    maxlength: 20,
    default: ''
  },
  referenceNumber: {
    type: String,
    trim: true,
    maxlength: 40
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

TrialRequestSchema.index({ status: 1 });
TrialRequestSchema.index({ whatsappPhone: 1 });
TrialRequestSchema.index({ assignedTeacher: 1 });
TrialRequestSchema.index({ studentUser: 1, createdAt: -1 });
TrialRequestSchema.index({ submittedBy: 1, createdAt: -1 });
TrialRequestSchema.index({ scheduledSession: 1 });

module.exports = mongoose.model('TrialRequest', TrialRequestSchema);
