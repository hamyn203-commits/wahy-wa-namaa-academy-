const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  personalInfo: {
    fullName: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 18, max: 80 },
    gender: { type: String, required: true, enum: ['male', 'female'] },
    country: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String },
    phone: { type: String, required: true },
    whatsapp: { type: String },
    telegram: { type: String }
  },
  academicInfo: {
    university: { type: String, required: true },
    faculty: { type: String, required: true },
    graduationYear: { type: Number, required: true },
    specialization: { type: String, required: true },
    qualification: { type: String, required: true }
  },
  quranInfo: {
    numberOfIjazat: { type: Number, default: 0 },
    ijazaType: { type: String },
    sheikhName: { type: String },
    sanad: { type: String },
    memorizedParts: { type: Number, min: 0, max: 30, default: 30 },
    teachingExperience: { type: Number, default: 0 },
    specializations: [{
      type: String,
      enum: ['children', 'adults', 'women', 'non-arabic', 'tajweed', 'ijaza', 'arabic-language']
    }]
  },
  documents: {
    // idCard is kept for backwards compatibility with legacy teacher records.
    idCard: { type: String, default: 'not-provided' },
    idCardFront: { type: String, default: 'not-provided' },
    idCardBack: { type: String, default: 'not-provided' },
    graduationCertificateAvailable: { type: Boolean, default: false },
    graduationCertificate: { type: String, default: 'not-provided' },
    tajweedCertificatesAvailable: { type: Boolean, default: false },
    tajweedCertificates: [String],
    ijazatAvailable: { type: Boolean, default: false },
    ijazat: [String]
  },
  media: {
    profilePhoto: { type: String, required: true },
    introductionVideo: { type: String, required: true },
    recitationVideo: { type: String, required: true },
    teachingMethodVideo: { type: String, required: true },
    additionalVideos: [String],
    audioRecordings: [String]
  },
  status: {
    type: String,
    enum: ['pending', 'under-review', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  reviewNotes: [{
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    date: { type: Date, default: Date.now }
  }],
  reviewChecklist: [{
    key: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'changes-requested', 'not-applicable'],
      default: 'pending',
    },
    note: { type: String, default: '', trim: true, maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  }],
  reviewStartedAt: Date,
  reviewCompletedAt: Date,
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  stats: {
    totalStudents: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  },
  earnings: {
    totalEarned: { type: Number, default: 0 },
    pendingEarnings: { type: Number, default: 0 },
    withdrawnEarnings: { type: Number, default: 0 }
  },
  hourlyRate: { type: Number, default: 50 },
  availabilityTimezone: { type: String, default: 'Africa/Cairo', trim: true },
  availability: [{
    day: { type: String, enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] },
    slots: [{
      startTime: String,
      endTime: String,
      isBooked: { type: Boolean, default: false }
    }]
  }],
  languages: [{
    type: String,
    enum: ['arabic', 'english', 'french', 'german', 'turkish', 'urdu', 'indonesian', 'malay']
  }],
  isVerified: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  storageOwner: { type: String, trim: true, select: false },
  assetsPurgedAt: { type: Date }
}, { timestamps: true });

TeacherSchema.index({ user: 1 });
TeacherSchema.index({ status: 1 });
TeacherSchema.index({ 'personalInfo.country': 1 });
TeacherSchema.index({ 'quranInfo.specializations': 1 });
TeacherSchema.index({ 'rating.average': -1 });
TeacherSchema.index({ status: 1, isVerified: 1, 'rating.average': -1 });
TeacherSchema.index({ status: 1, createdAt: -1 });
TeacherSchema.index({ status: 1, 'personalInfo.gender': 1 });

module.exports = mongoose.model('Teacher', TeacherSchema);