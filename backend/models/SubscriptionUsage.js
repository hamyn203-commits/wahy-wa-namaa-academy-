const mongoose = require('mongoose');

const SubscriptionUsageSchema = new mongoose.Schema({
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentSubscription',
    required: true,
    index: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  circle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupCircle',
    required: false,
    default: null,
    index: true,
  },
  outcome: {
    type: String,
    enum: ['consumed', 'compensated'],
    required: true,
  },
  reason: {
    type: String,
    enum: ['attended', 'confirmed', 'pending', 'absent', 'late_excuse', 'eligible_excuse'],
    required: true,
  },
  processedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

SubscriptionUsageSchema.index(
  { subscription: 1, session: 1 },
  { unique: true }
);

SubscriptionUsageSchema.index({ student: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('SubscriptionUsage', SubscriptionUsageSchema);

