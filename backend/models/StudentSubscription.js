const mongoose = require('mongoose');

const safeInteger = {
  validator: (value) => Number.isSafeInteger(value) && value >= 0,
  message: 'Value must be a non-negative safe integer',
};

const StudentSubscriptionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  planKey: {
    type: String,
    enum: ['community', 'group', 'focused', 'mini', 'private'],
    required: true,
  },
  section: {
    type: String,
    enum: ['men_children', 'ladies'],
    required: true,
  },
  sessionCount: {
    type: Number,
    enum: [4, 8, 12, 24],
    required: true,
  },
  sessionsUsed: {
    type: Number,
    default: 0,
    validate: safeInteger,
  },
  sessionsRemaining: {
    type: Number,
    required: true,
    validate: safeInteger,
  },
  currency: {
    type: String,
    enum: ['EGP'],
    default: 'EGP',
  },
  pricePerSessionMinor: {
    type: Number,
    required: true,
    validate: safeInteger,
  },
  totalAmountMinor: {
    type: Number,
    required: true,
    validate: safeInteger,
  },
  status: {
    type: String,
    enum: ['pending_payment', 'payment_review', 'renewal_queued', 'awaiting_placement', 'placed', 'active', 'paused', 'completed', 'cancelled', 'expired'],
    default: 'pending_payment',
    index: true,
  },
  preferredTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null,
  },
  renewalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentSubscription',
    default: null,
    index: true,
  },
  circle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupCircle',
    default: null,
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  pricingSnapshot: {
    minStudents: { type: Number, min: 1, max: 20 },
    maxStudents: { type: Number, min: 1, max: 20 },
    durationMinMinutes: { type: Number, min: 1, max: 180, default: null },
    durationMaxMinutes: { type: Number, min: 1, max: 180 },
    nameAr: { type: String, maxlength: 120 },
    nameEn: { type: String, maxlength: 120 },
    durationLabelAr: { type: String, maxlength: 120 },
    durationLabelEn: { type: String, maxlength: 120 },
  },
  selectedAt: {
    type: Date,
    default: Date.now,
  },
  paidAt: Date,
  renewalQueuedAt: Date,
  placedAt: Date,
  startedAt: Date,
  completedAt: Date,
  lowBalanceNotifiedAt: Date,
}, { timestamps: true });

StudentSubscriptionSchema.index({ student: 1, status: 1, createdAt: -1 });
StudentSubscriptionSchema.index(
  { student: 1 },
  { unique: true, partialFilterExpression: { status: 'pending_payment' } }
);
StudentSubscriptionSchema.index({ circle: 1, status: 1 });
StudentSubscriptionSchema.index({ status: 1, createdAt: -1 });
StudentSubscriptionSchema.index({ preferredTeacher: 1, status: 1 });
StudentSubscriptionSchema.index(
  { renewalOf: 1 },
  { unique: true, partialFilterExpression: { renewalOf: { $type: 'objectId' } } }
);

StudentSubscriptionSchema.pre('validate', function(next) {
  if (this.sessionsUsed > this.sessionCount) {
    this.invalidate('sessionsUsed', 'Used sessions cannot exceed the package size');
  }
  if (this.sessionsRemaining > this.sessionCount) {
    this.invalidate('sessionsRemaining', 'Remaining sessions cannot exceed the package size');
  }
  if ((this.sessionsUsed + this.sessionsRemaining) > this.sessionCount) {
    this.invalidate('sessionsRemaining', 'Used and remaining sessions exceed the package size');
  }
  next();
});

module.exports = mongoose.model('StudentSubscription', StudentSubscriptionSchema);

