const mongoose = require('mongoose');

const VerificationLedgerSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['email_send_quota', 'token_jti'],
    required: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
  },
  windowStart: { type: Date },
  lastSentAt: { type: Date },
  count: { type: Number, default: 0 },
  uploadCount: { type: Number, default: 0 },
  consumed: { type: Boolean, default: false },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
}, { timestamps: true });

VerificationLedgerSchema.index({ kind: 1, key: 1 }, { unique: true });

module.exports = mongoose.models.VerificationLedger || mongoose.model('VerificationLedger', VerificationLedgerSchema);
