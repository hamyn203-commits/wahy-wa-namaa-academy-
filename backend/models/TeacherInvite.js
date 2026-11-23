const mongoose = require('mongoose');

const TeacherInviteUsageSchema = new mongoose.Schema({
  reservationId: { type: String, trim: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, trim: true, lowercase: true },
  name: { type: String, trim: true },
  usedAt: { type: Date, default: Date.now },
}, { _id: false });

const TeacherInviteSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    select: false,
  },
  tokenPreview: {
    type: String,
    required: true,
    trim: true,
    maxlength: 16,
  },
  label: {
    type: String,
    trim: true,
    maxlength: 120,
    default: '',
  },
  locale: {
    type: String,
    enum: ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'],
    default: 'ar',
  },
  maxUses: {
    type: Number,
    required: true,
    min: 1,
    max: 50,
    default: 1,
  },
  usedCount: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  lockToFirstIp: {
    type: Boolean,
    default: true,
  },
  boundIpHash: {
    type: String,
    default: null,
    select: false,
  },
  boundIpMasked: {
    type: String,
    trim: true,
    maxlength: 48,
    default: '',
  },
  boundAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  usedBy: {
    type: [TeacherInviteUsageSchema],
    default: [],
  },
}, { timestamps: true });

TeacherInviteSchema.index({ createdAt: -1 });
TeacherInviteSchema.index({ revokedAt: 1, expiresAt: 1 });

module.exports = mongoose.model('TeacherInvite', TeacherInviteSchema);
