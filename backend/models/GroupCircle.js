const mongoose = require('mongoose');

const GroupCircleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Circle name is required'],
    trim: true,
    maxlength: [120, 'Circle name cannot exceed 120 characters']
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  },
  track: {
    type: String,
    enum: ['memorization', 'tajweed_ijazah', 'kids_foundation'],
    required: true,
    default: 'memorization'
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'ijazah'],
    required: true,
    default: 'beginner'
  },
  gender: {
    type: String,
    enum: ['boys', 'girls', 'men', 'women', 'kids_mixed'],
    required: true
  },
  targetAgeGroup: {
    type: String,
    enum: ['kids_4_7', 'kids_8_12', 'teens_13_17', 'adults'],
    default: 'kids_8_12'
  },
  capacity: {
    type: Number,
    default: 10,
    max: 20,
    min: 1
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  schedule: [{
    day: {
      type: String,
      enum: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      required: true
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  }],
  timezone: {
    type: String,
    default: 'Africa/Cairo'
  },
  status: {
    type: String,
    enum: ['forming', 'ready', 'active', 'full', 'completed', 'paused'],
    default: 'forming'
  },
  pricePerSession: {
    egp: { type: Number, default: 20 },
    usd: { type: Number, default: 1 }
  },
  subscriptionPlanKey: {
    type: String,
    enum: ['community', 'group', 'focused', 'mini', 'private', 'private_intensive'],
    default: undefined
  },
  startedAt: Date,
  subscriptionUsageVersion: { type: Number, default: 0 },
  subscriptionSection: { type: String, enum: ['men_children', 'ladies'] },
  currentSurah: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

GroupCircleSchema.index({ status: 1 });
GroupCircleSchema.index({ track: 1, level: 1, gender: 1 });
GroupCircleSchema.index({ teacher: 1 });

GroupCircleSchema.pre('save', function(next) {
  if (!this.code) {
    const prefix = (this.gender || 'G').charAt(0).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.code = `CIR-${prefix}-${randomSuffix}`;
  }
  if (['active', 'full'].includes(this.status) && this.students && this.students.length >= this.capacity) {
    this.status = 'full';
  }
  next();
});

module.exports = mongoose.model('GroupCircle', GroupCircleSchema);

