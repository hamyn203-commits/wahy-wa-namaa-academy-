const mongoose = require('mongoose');

const VALID_PLATFORMS = ['web', 'pwa', 'android', 'ios'];
const VALID_DEVICES = ['mobile', 'tablet', 'desktop', 'unknown'];
const VALID_STATUSES = ['visited', 'in_progress', 'submitted'];

const teacherFunnelSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, trim: true, maxlength: 80, index: true },
  visitorId: { type: String, required: true, trim: true, maxlength: 80, index: true },
  status: { type: String, enum: VALID_STATUSES, default: 'visited', index: true },
  currentStep: { type: Number, min: 1, max: 5, default: 1 },
  maxStep: { type: Number, min: 1, max: 5, default: 1, index: true },
  reachedSteps: { type: [Number], default: [1] },
  touchedFieldsCount: { type: Number, min: 0, max: 50, default: 0 },
  filesSelectedCount: { type: Number, min: 0, max: 20, default: 0 },
  emailVerified: { type: Boolean, default: false },
  fullName: { type: String, trim: true, maxlength: 120, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  whatsapp: { type: String, trim: true, maxlength: 40, default: '' },
  country: { type: String, trim: true, maxlength: 60, default: '' },
  gender: { type: String, enum: ['male', 'female', ''], default: '' },
  platform: { type: String, enum: VALID_PLATFORMS, default: 'web', index: true },
  appVersion: { type: String, trim: true, maxlength: 32, default: '' },
  deviceType: { type: String, enum: VALID_DEVICES, default: 'unknown' },
  locale: { type: String, trim: true, maxlength: 12, default: 'ar' },
  source: { type: String, trim: true, maxlength: 80, default: 'direct', index: true },
  campaign: { type: String, trim: true, maxlength: 80, default: '' },
  entryPath: { type: String, trim: true, maxlength: 180, default: '/register/teacher' },
  lastEvent: { type: String, trim: true, maxlength: 60, default: 'page_open' },
  lastError: { type: String, trim: true, maxlength: 160, default: '' },
  ipHash: { type: String, trim: true, maxlength: 64, default: '' },
  startedAt: { type: Date, default: Date.now, index: true },
  lastActiveAt: { type: Date, default: Date.now, index: true },
  submittedAt: { type: Date, default: null },
}, {
  versionKey: false,
});

teacherFunnelSessionSchema.index({ status: 1, lastActiveAt: -1 });
teacherFunnelSessionSchema.index({ maxStep: 1, status: 1 });
teacherFunnelSessionSchema.index({ startedAt: -1 });

teacherFunnelSessionSchema.statics.VALID_STATUSES = VALID_STATUSES;
teacherFunnelSessionSchema.statics.VALID_PLATFORMS = VALID_PLATFORMS;
teacherFunnelSessionSchema.statics.VALID_DEVICES = VALID_DEVICES;

module.exports = mongoose.model('TeacherFunnelSession', teacherFunnelSessionSchema);
