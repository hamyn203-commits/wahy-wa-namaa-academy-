const mongoose = require('mongoose');

const GuardianInvitationHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['created', 'renewed', 'accepted', 'rejected', 'cancelled', 'expired'],
    required: true,
  },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const GuardianInvitationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  guardianPhone: {
    type: String,
    required: true,
    trim: true,
    select: false,
  },
  guardianPhoneNormalized: {
    type: String,
    required: true,
    index: true,
    select: false,
  },
  relationship: {
    type: String,
    enum: ['father', 'mother', 'guardian', 'other'],
    default: 'guardian',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'expired'],
    default: 'pending',
    index: true,
  },
  linkCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    select: false,
  },
  source: {
    type: String,
    enum: ['student-registration', 'student-onboarding', 'student-dashboard', 'legacy'],
    default: 'student-dashboard',
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  respondedAt: Date,
  history: {
    type: [GuardianInvitationHistorySchema],
    default: [],
  },
}, { timestamps: true });

GuardianInvitationSchema.index({ student: 1, status: 1, createdAt: -1 });
GuardianInvitationSchema.index({ guardianPhoneNormalized: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model('GuardianInvitation', GuardianInvitationSchema);
