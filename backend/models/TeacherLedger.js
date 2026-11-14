const mongoose = require('mongoose');

const TeacherLedgerSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Teacher reference is required'],
    index: true,
  },
  type: {
    type: String,
    enum: ['session_earning', 'bonus', 'payout', 'adjustment', 'deduction'],
    required: [true, 'Transaction type is required'],
    index: true,
  },
  idempotencyKey: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    enum: ['EGP', 'USD'],
    default: 'EGP',
    required: true,
    index: true,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    index: true,
  },
  attendeesCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  payoutMethod: {
    type: String,
    enum: ['instapay', 'vodafone_cash', 'bank_transfer', 'paypal'],
  },
  payoutDetails: {
    phone: { type: String, trim: true },
    ipaAddress: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountHolderName: { type: String, trim: true },
    paypalEmail: { type: String, trim: true, lowercase: true },
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: function () {
      return this.type === 'payout' ? 'pending' : 'completed';
    },
    index: true,
  },
  referenceNumber: {
    type: String,
    trim: true,
    maxlength: 160,
  },
  receiptUrl: {
    type: String,
    trim: true,
    maxlength: 2048,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  processedAt: {
    type: Date,
  },
}, { timestamps: true });

TeacherLedgerSchema.index({ teacher: 1, createdAt: -1 });
TeacherLedgerSchema.index({ teacher: 1, currency: 1, status: 1 });
TeacherLedgerSchema.index({ type: 1, status: 1, createdAt: -1 });
TeacherLedgerSchema.index(
  { teacher: 1, currency: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'payout',
      status: { $in: ['pending', 'processing'] },
    },
  }
);

module.exports = mongoose.model('TeacherLedger', TeacherLedgerSchema);
