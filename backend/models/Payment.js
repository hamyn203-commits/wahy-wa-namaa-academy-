const mongoose = require('mongoose');
const { PAYMENT_STATUSES, SUPPORTED_CURRENCIES } = require('../utils/paymentIntegrity');

const PaymentSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['course_enrollment', 'subscription', 'donation'],
    required: true,
    index: true,
  },
  provider: {
    type: String,
    trim: true,
    lowercase: true,
    default: 'unassigned',
    maxlength: 64,
    index: true,
  },
  providerReference: {
    type: String,
    trim: true,
    maxlength: 256,
  },
  providerOrderId: {
    type: String,
    trim: true,
    maxlength: 256,
  },
  providerTransactionId: {
    type: String,
    trim: true,
    maxlength: 256,
  },
  idempotencyKey: {
    type: String,
    trim: true,
    maxlength: 256,
    unique: true,
    sparse: true,
    index: true,
  },
  manual: {
    method: {
      type: String,
      enum: ['instapay', 'mobile_wallet', 'bank_transfer'],
    },
    transferReference: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    proofReference: {
      type: String,
      trim: true,
      maxlength: 2048,
      select: false,
    },
    proofFilename: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    proofContentType: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    proofSize: {
      type: Number,
      min: 1,
    },
    proofHash: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 64,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewAction: {
      type: String,
      enum: ['approve', 'reject'],
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentSubscription',
  },
  donation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donation',
  },
  amountMinor: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Payment amountMinor must be a safe integer',
    },
  },
  refundedAmountMinor: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: (val) => Number.isSafeInteger(val) && val >= 0,
      message: 'Payment refundedAmountMinor must be a non-negative safe integer',
    },
  },
  currency: {
    type: String,
    enum: SUPPORTED_CURRENCIES,
    required: true,
    uppercase: true,
    trim: true,
  },
  status: {
    type: String,
    enum: PAYMENT_STATUSES,
    default: 'created',
    index: true,
  },
  settledAt: Date,
  failedAt: Date,
  cancelledAt: Date,
  refundedAt: Date,
  failureCode: {
    type: String,
    trim: true,
    maxlength: 128,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    select: false,
  },
}, { timestamps: true });

PaymentSchema.index(
  { provider: 1, providerReference: 1 },
  { unique: true, sparse: true }
);
PaymentSchema.index({ student: 1, course: 1, status: 1 });
PaymentSchema.index({ student: 1, subscription: 1, status: 1 });
PaymentSchema.index(
  { student: 1, course: 1, provider: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'course_enrollment',
      provider: 'manual',
      status: 'pending',
    },
  }
);
PaymentSchema.index(
  { student: 1, subscription: 1, provider: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'subscription',
      provider: 'manual',
      status: 'pending',
    },
  }
);
PaymentSchema.index(
  { 'manual.proofReference': 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: 'manual',
      status: { $in: ['pending', 'succeeded'] },
      'manual.proofReference': { $type: 'string' },
    },
  }
);
PaymentSchema.index(
  { 'manual.proofHash': 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: 'manual',
      status: { $in: ['pending', 'succeeded'] },
      'manual.proofHash': { $type: 'string' },
    },
  }
);
PaymentSchema.index(
  { 'manual.method': 1, 'manual.transferReference': 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: 'manual',
      status: { $in: ['pending', 'succeeded'] },
      'manual.transferReference': { $type: 'string' },
    },
  }
);
PaymentSchema.index(
  { student: 1, course: 1, provider: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'course_enrollment',
      provider: 'paymob',
      status: { $in: ['created', 'pending'] },
    },
  }
);
PaymentSchema.index({ provider: 1, status: 1, createdAt: -1 });
PaymentSchema.index({ donation: 1, status: 1 });

PaymentSchema.pre('validate', function paymentRelationValidation(next) {
  if (this.kind === 'course_enrollment') {
    if (!this.student || !this.course) {
      return next(new Error('Course payments require student and course'));
    }
  }

  if (this.kind === 'subscription') {
    if (!this.student || !this.subscription) {
      return next(new Error('Subscription payments require student and subscription'));
    }
  }

  if (this.kind === 'donation' && !this.donation) {
    return next(new Error('Donation payments require a donation reference'));
  }

  return next();
});

module.exports = mongoose.model('Payment', PaymentSchema);