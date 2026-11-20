const mongoose = require('mongoose');

const VALID_PLATFORMS = ['web', 'pwa', 'android', 'ios'];
const VALID_DEVICES = ['mobile', 'tablet', 'desktop', 'unknown'];

const siteVisitSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, trim: true, maxlength: 80, index: true },
  sessionId: { type: String, required: true, trim: true, maxlength: 80, index: true },
  path: { type: String, required: true, trim: true, maxlength: 180, index: true },
  rawPath: { type: String, trim: true, maxlength: 200, default: '' },
  locale: { type: String, trim: true, maxlength: 12, default: 'ar' },
  platform: { type: String, enum: VALID_PLATFORMS, default: 'web', index: true },
  appVersion: { type: String, trim: true, maxlength: 32, default: '' },
  deviceType: { type: String, enum: VALID_DEVICES, default: 'unknown', index: true },
  source: { type: String, trim: true, maxlength: 80, default: 'direct', index: true },
  medium: { type: String, trim: true, maxlength: 60, default: '' },
  campaign: { type: String, trim: true, maxlength: 80, default: '' },
  hourLocal: { type: Number, min: 0, max: 23, required: true, index: true },
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  dateKey: { type: String, required: true, maxlength: 16, index: true },
  ipHash: { type: String, trim: true, maxlength: 64, default: '' },
  createdAt: { type: Date, default: Date.now, index: { expires: 60 * 60 * 24 * 180 } },
}, {
  versionKey: false,
});

siteVisitSchema.index({ createdAt: -1 });
siteVisitSchema.index({ dateKey: 1, visitorId: 1 });
siteVisitSchema.index({ platform: 1, createdAt: -1 });
siteVisitSchema.index({ path: 1, createdAt: -1 });
siteVisitSchema.index({ hourLocal: 1, createdAt: -1 });

siteVisitSchema.statics.VALID_PLATFORMS = VALID_PLATFORMS;
siteVisitSchema.statics.VALID_DEVICES = VALID_DEVICES;

module.exports = mongoose.model('SiteVisit', siteVisitSchema);
